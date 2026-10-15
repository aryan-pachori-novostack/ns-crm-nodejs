const { ImapFlow } = require('imapflow');
const { logger } = require('../helpers/logger');
const { getMailbox } = require('../helpers/inbound-mailbox');

/**
 * IMAP connection manager for the banker mailbox (process-local).
 *
 * Holds one persistent ImapFlow client to the live Zoho banker mailbox.
 *
 * Why persistent: a new IMAP connection per operation is expensive (TLS + auth);
 * one warm connection amortizes that across queries.
 *
 * Mailbox locking: ImapFlow mailbox selection is connection-global, so callers must
 * use `getMailboxLock()` on the client from `ensureConnection()` (or go through
 * `withImap(...)`).
 *
 * Reconnect: on drop, schedule reconnect with capped exponential backoff,
 * de-duplicated.
 */

const st = { client: null, connectPromise: null, reconnectTimer: null, reconnectAttempt: 0, keepaliveTimer: null };
let isShuttingDown = false;

const nowMs = () => Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function logEvent(event, meta = {}) {
    logger.info(event, { event, ...meta });
}

function logWarn(event, meta = {}) {
    logger.warn(event, { event, ...meta });
}

function logError(event, meta = {}) {
    logger.error(event, { event, ...meta });
}

function clearReconnectTimer() {
    if (st.reconnectTimer) clearTimeout(st.reconnectTimer);
    st.reconnectTimer = null;
}

function clearKeepaliveTimer() {
    if (st.keepaliveTimer) clearInterval(st.keepaliveTimer);
    st.keepaliveTimer = null;
}

function scheduleReconnect(reason) {
    if (isShuttingDown) return;
    if (st.reconnectTimer) return; // already scheduled

    st.reconnectAttempt += 1;
    const base = Math.min(30_000, 500 * Math.pow(2, Math.min(st.reconnectAttempt, 6))); // cap
    const jitter = Math.floor(Math.random() * 250);
    const delayMs = base + jitter;

    logWarn('imap_reconnect_scheduled', { reason, reconnectAttempt: st.reconnectAttempt, delayMs });

    st.reconnectTimer = setTimeout(async () => {
        st.reconnectTimer = null;
        try {
            await connect({ reason: 'reconnect' });
            logEvent('imap_reconnect_success', { reconnectAttempt: st.reconnectAttempt });
            st.reconnectAttempt = 0;
        } catch (err) {
            logError('imap_reconnect_failure', { reconnectAttempt: st.reconnectAttempt, error: err?.message });
            scheduleReconnect('reconnect_failure');
        }
    }, delayMs);
    st.reconnectTimer.unref?.();
}

function startKeepalive() {
    // A periodic NOOP keeps the connection warm; providers drop idle IMAP sockets.
    if (st.keepaliveTimer) return;
    st.keepaliveTimer = setInterval(async () => {
        if (!st.client) return;
        try {
            await st.client.noop();
        } catch (err) {
            logWarn('imap_keepalive_failed', { error: err?.message });
            scheduleReconnect('keepalive_failed');
        }
    }, 60_000);
    st.keepaliveTimer.unref?.();
}

function attachClientEventHandlers(im) {
    im.on('close', () => {
        logWarn('imap_close');
        scheduleReconnect('close');
    });
    im.on('error', (err) => {
        logWarn('imap_error', { error: err?.message });
    });
}

async function connect({ reason = 'connect' } = {}) {
    if (isShuttingDown) throw new Error('IMAP manager is shutting down');
    if (st.client?.usable) return st.client;
    if (st.connectPromise) return st.connectPromise;

    st.connectPromise = (async () => {
        clearReconnectTimer();
        const mb = getMailbox();
        const user = mb.email;
        const pass = mb.password;
        if (!user || !pass) {
            throw new Error('IMAP mailbox is not configured (INBOUND_EMAIL / INBOUND_EMAIL_PASSWORD env vars missing)');
        }

        const startedAt = nowMs();
        logEvent('imap_connect_start', { reason, host: mb.imap.host, user });

        const im = new ImapFlow({
            host: mb.imap.host,
            port: mb.imap.port,
            secure: mb.imap.secure,
            auth: { user, pass },
            logger: false,
        });

        attachClientEventHandlers(im);

        await im.connect();

        st.client = im;
        startKeepalive();

        logEvent('imap_connect_success', { reason, latencyMs: nowMs() - startedAt });
        return st.client;
    })();

    try {
        return await st.connectPromise;
    } finally {
        st.connectPromise = null;
    }
}

async function disconnect({ reason = 'disconnect' } = {}) {
    clearReconnectTimer();
    clearKeepaliveTimer();

    const im = st.client;
    st.client = null;
    st.connectPromise = null;

    if (!im) return;
    try {
        logEvent('imap_disconnect_start', { reason });
        await im.logout().catch(() => im.close());
        logEvent('imap_disconnect_success', { reason });
    } catch (err) {
        logError('imap_disconnect_failure', { reason, error: err?.message });
    }
}

async function disconnectAll({ reason = 'disconnect_all' } = {}) {
    isShuttingDown = true;
    await disconnect({ reason });
}

async function ensureConnection() {
    return connect({ reason: 'ensureConnection' });
}

async function withRetry(fn, { op, maxAttempts = 5 } = {}) {
    let attempt = 0;
    let lastErr;
    while (attempt < maxAttempts) {
        attempt += 1;
        const startedAt = nowMs();
        try {
            const res = await fn({ attempt });
            if (attempt > 1) {
                logEvent('imap_retry_success', { op, attempt, latencyMs: nowMs() - startedAt });
            }
            return res;
        } catch (err) {
            lastErr = err;
            const msg = err?.message || String(err);
            const isTemporary =
                /ECONNRESET|EPIPE|ETIMEDOUT|ENOTFOUND|socket|Connection closed|Temporary|rate/i.test(msg);

            logWarn('imap_retry', { op, attempt, error: msg });

            if (!isTemporary || attempt >= maxAttempts) {
                throw err;
            }
            const backoff = Math.min(10_000, 250 * Math.pow(2, Math.min(attempt, 5)));
            await sleep(backoff + Math.floor(Math.random() * 200));
            scheduleReconnect('retry_temporary_error');
        }
    }
    throw lastErr;
}

/**
 * Run `fn(imapClient, ctx)` against the banker mailbox, with connect + retry handling.
 * The single entry point the fetch layer should use.
 */
async function withImap(op, fn) {
    return withRetry(
        async (ctx) => {
            const im = await ensureConnection();
            return fn(im, ctx);
        },
        { op }
    );
}

let shutdownHandlersRegistered = false;
function registerGracefulShutdown() {
    if (shutdownHandlersRegistered) return;
    shutdownHandlersRegistered = true;

    const handler = async (signal) => {
        try {
            logWarn('imap_shutdown_signal', { signal });
            await disconnectAll({ reason: signal });
        } finally {
            process.exit(0);
        }
    };

    process.once('SIGINT', handler);
    process.once('SIGTERM', handler);
}

registerGracefulShutdown();

module.exports = {
    connect,
    disconnect,
    disconnectAll,
    ensureConnection,
    withRetry,
    withImap,
};
