const { simpleParser } = require('mailparser');
const { logger } = require('../helpers/logger');
const { withImap } = require('./gmail-imap-manager');
const { getMailbox } = require('../helpers/inbound-mailbox');

/**
 * Mailbox fetch layer for banker-confirmation threads.
 *
 * Reads the live Zoho banker mailbox (folders from `getMailbox().folders`) using only
 * RFC-standard IMAP SEARCH (HEADER Message-ID / SUBJECT). Note Zoho only honours `SUBJECT`
 * and `HEADER Message-ID` — arbitrary `HEADER In-Reply-To / References` search returns `[]`
 * — so a reply is matched mainly through the `RU-{freshLeadId}` subject marker.
 */

function sanitizeMessageId(messageId) {
    if (!messageId) return '';
    return String(messageId).replace(/^<|>$/g, '');
}

function wrapMessageId(messageId) {
    const raw = sanitizeMessageId(messageId);
    if (!raw) return '';
    return raw.startsWith('<') ? raw : `<${raw}>`;
}

function formatAddressList(list) {
    if (!list) return '';
    const arr = Array.isArray(list) ? list : [list];
    return arr
        .map((a) => {
            if (!a) return '';
            if (typeof a === 'string') return a;
            const name = a.name ? `${a.name} ` : '';
            const addr = a.address || '';
            return name && addr ? `${name.trim()} <${addr}>` : addr || name.trim();
        })
        .filter(Boolean)
        .join(', ');
}

async function streamToBuffer(content) {
    if (!content) return null;
    if (Buffer.isBuffer(content)) return content;
    if (typeof content === 'string') return Buffer.from(content);
    const chunks = [];
    for await (const chunk of content) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

function normalizeParsedMessage(parsed, uid) {
    const from = formatAddressList(parsed.from?.value || parsed.from);
    const date = parsed.date ? parsed.date.toISOString() : null;
    return {
        uid,
        from,
        to: formatAddressList(parsed.to?.value || parsed.to),
        cc: formatAddressList(parsed.cc?.value || parsed.cc),
        subject: parsed.subject || '',
        date,
        message_id: parsed.messageId || null,
        in_reply_to: parsed.inReplyTo || null,
        references: Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [],
        body_html: parsed.html || parsed.textAsHtml || null,
        body_text: parsed.text || '',
        body: parsed.html || parsed.textAsHtml || parsed.text || ''
    };
}

/**
 * Collect the UIDs in one folder that belong to a thread — RFC IMAP SEARCH:
 *   - the seed itself                          (HEADER Message-ID)
 *   - anything replying into the seed          (OR HEADER In-Reply-To / References)
 *   - anything still carrying the lead marker  (SUBJECT "RU-{freshLeadId}")
 *
 * The RU-{freshLeadId} marker is a per-lead UUID, so it can't pull in another lead's
 * mail.
 * @returns {Promise<number[]>} folder-relative UIDs
 */
async function searchThreadUidsInFolder(im, folder, rawId, freshLeadId) {
    const uidSet = new Set();

    const seed = await im.search({ header: { 'message-id': rawId } }, { uid: true });
    (seed || []).forEach((uid) => uidSet.add(uid));

    try {
        const refs = await im.search(
            { or: [{ header: { 'in-reply-to': rawId } }, { header: { references: rawId } }] },
            { uid: true }
        );
        (refs || []).forEach((uid) => uidSet.add(uid));
    } catch (err) {
        // Some IMAP servers reject OR + HEADER search; seed + subject-marker still cover it.
        logger.warn('imap_ref_search_unsupported', { folder, error: err?.message });
    }

    if (freshLeadId) {
        const marker = await im.search({ subject: `RU-${freshLeadId}` }, { uid: true });
        (marker || []).forEach((uid) => uidSet.add(uid));
    }
    return [...uidSet];
}

/**
 * Collect the raw messages in one folder that belong to a thread.
 * @returns {Promise<Array<{ uid:number, folder:string, rawBuffer:Buffer }>>}
 */
async function collectThreadMessagesInFolder(im, folder, rawId, freshLeadId) {
    const lock = await im.getMailboxLock(folder);
    try {
        const uids = await searchThreadUidsInFolder(im, folder, rawId, freshLeadId);

        const out = [];
        for (const uid of uids) {
            const { content } = await im.download(uid, undefined, { uid: true });
            if (!content) continue;
            const rawBuffer = await streamToBuffer(content);
            if (!rawBuffer) continue;
            out.push({ uid, folder, rawBuffer });
        }
        return out;
    } finally {
        lock.release();
    }
}

/**
 * Fetch mailbox messages for a lead's stored `mail_thread_id` (RFC Message-ID)
 * from the banker mailbox, across its configured folders.
 * @param {string} mailThreadId
 * @param {string} [freshLeadId]
 * @param {{ includeRaw?: boolean }} [options]
 * @returns {Promise<Array<object>>} normalized messages, ascending by date ([] if none)
 */
async function fetchThreadByMailThreadId(mailThreadId, freshLeadId, options = {}) {
    const { includeRaw = false } = options;
    const rawId = sanitizeMessageId(mailThreadId);
    if (!rawId) return [];

    const { folders } = getMailbox();

    return withImap('fetchThreadByMailThreadId', async (im) => {
        const raws = [];
        for (const folder of folders) {
            try {
                const found = await collectThreadMessagesInFolder(im, folder, rawId, freshLeadId);
                raws.push(...found);
            } catch (err) {
                logger.warn('imap_folder_fetch_failed', { folder, error: err?.message });
            }
        }

        // Parse outside the mailbox lock; dedupe across folders by Message-ID.
        const byId = new Map();
        for (const { uid, folder, rawBuffer } of raws) {
            const parsed = await simpleParser(rawBuffer);
            const normalized = normalizeParsedMessage(parsed, uid);
            if (includeRaw) normalized.raw_eml = rawBuffer;
            const dedupeKey = sanitizeMessageId(normalized.message_id).toLowerCase() || `${folder}:${uid}`;
            if (!byId.has(dedupeKey)) byId.set(dedupeKey, normalized);
        }

        const messages = [...byId.values()];
        messages.sort((a, b) => {
            const da = a.date ? new Date(a.date).getTime() : 0;
            const db = b.date ? new Date(b.date).getTime() : 0;
            return da - db;
        });
        return messages;
    });
}

/**
 * Search a mailbox for messages matching an RFC Message-ID. Returns IMAP UIDs
 * (folder-relative). Kept for API-surface stability; not used at runtime.
 * @returns {Promise<number[]>}
 */
async function searchByMessageId(messageId) {
    const rawId = sanitizeMessageId(messageId);
    if (!rawId) return [];

    const folders = getMailbox().folders;

    return withImap('searchByMessageId', async (im) => {
        const uids = [];
        for (const folder of folders) {
            const lock = await im.getMailboxLock(folder);
            try {
                const found = await im.search({ header: { 'message-id': rawId } }, { uid: true });
                (found || []).forEach((u) => uids.push(u));
            } finally {
                lock.release();
            }
        }
        return uids;
    });
}

/**
 * Find messages by exact subject in the banker mailbox and return metadata.
 * `threadId` is always null (no provider-agnostic thread id). Kept for API-surface
 * stability; not used at runtime.
 * @returns {Promise<Array<{ uid:number, subject:string, messageId:string, threadId:null }>>}
 */
async function findBySubject(subject) {
    const trimmed = (subject || '').trim();
    if (!trimmed) return [];

    const folders = getMailbox().folders;

    return withImap('findBySubject', async (im) => {
        const rows = [];
        for (const folder of folders) {
            const lock = await im.getMailboxLock(folder);
            try {
                const uids = await im.search({ subject: trimmed }, { uid: true });
                if (!uids?.length) continue;
                for await (const msg of im.fetch(uids, { uid: true, envelope: true, flags: true }, { uid: true })) {
                    rows.push({
                        uid: msg.uid,
                        subject: msg.envelope?.subject,
                        messageId: msg.envelope?.messageId,
                        threadId: null,
                    });
                }
            } finally {
                lock.release();
            }
        }
        return rows;
    });
}

/**
 * Fetch raw RFC822 content for the latest message in a lead mail thread.
 * @returns {Promise<{ content: Buffer, subject: string, message_id: string|null, date: string|null }|null>}
 */
async function fetchLatestRawEmlByMailThreadId(mailThreadId, freshLeadId) {
    const messages = await fetchThreadByMailThreadId(mailThreadId, freshLeadId, { includeRaw: true });
    const latest = messages[messages.length - 1];
    if (!latest?.raw_eml) return null;

    return {
        content: latest.raw_eml,
        subject: latest.subject || '',
        message_id: latest.message_id || null,
        date: latest.date || null
    };
}

module.exports = {
    searchByMessageId,
    findBySubject,
    fetchThreadByMailThreadId,
    fetchLatestRawEmlByMailThreadId,
    sanitizeMessageId,
    wrapMessageId,
};
