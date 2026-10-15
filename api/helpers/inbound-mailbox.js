/**
 * Banker-confirmation mailbox configuration.
 *
 * One mailbox: needconfirmation@ruloans.com.
 *   - SMTP (send)  -> a transactional relay (ZeptoMail), whose login (`emailapikey` + token) differs
 *                     from the mailbox itself, so it has its own INBOUND_SMTP_USER / INBOUND_SMTP_PASS.
 *   - IMAP (fetch) -> the Zoho mailbox (INBOUND_EMAIL / INBOUND_EMAIL_PASSWORD).
 *   - From address -> INBOUND_EMAIL.
 *
 * The former Gmail mailbox (needconfirmation@ruloans.vip) has been retired: it is no longer
 * connected to, sent from, or searched. Its address is only kept in RETIRED_MAILBOX_ADDRESSES so the
 * CRM never CCs the dead mailbox and still recognises old messages from it as "from the CRM".
 *
 * Everything is env-driven with the correct provider defaults, so a config change needs no code change.
 * Values are read on each call so tests / a running process pick up env edits without a restart.
 */

const asStr = (v, d) => (v === undefined || v === null || v === '' ? d : String(v).trim());
const asNum = (v, d) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
};
const asBool = (v, d) => (v === undefined || v === null || v === '' ? d : String(v).trim().toLowerCase() !== 'false');
const asFolders = (v, d) => asStr(v, d).split(',').map((s) => s.trim()).filter(Boolean);

// Addresses of mailboxes the CRM used to send from and no longer does (lower-case).
const RETIRED_MAILBOX_ADDRESSES = ['needconfirmation@ruloans.vip'];

/** The live banker mailbox config (SMTP relay + Zoho IMAP). */
function getMailbox() {
    return {
        email: asStr(process.env.INBOUND_EMAIL, ''),
        password: process.env.INBOUND_EMAIL_PASSWORD || '',
        smtp: {
            host: asStr(process.env.INBOUND_SMTP_HOST, 'smtp.zoho.in'),
            port: asNum(process.env.INBOUND_SMTP_PORT, 465),
            secure: asBool(process.env.INBOUND_SMTP_SECURE, true),
            // SMTP auth can differ from the mailbox / IMAP login and the From address.
            // Defaults to the mailbox address + password (Zoho); a relay whose credentials
            // differ (ZeptoMail: user "emailapikey" + a Send Mail Token, while IMAP stays on
            // Zoho) sets INBOUND_SMTP_USER / INBOUND_SMTP_PASS.
            user: asStr(process.env.INBOUND_SMTP_USER, asStr(process.env.INBOUND_EMAIL, '')),
            pass: process.env.INBOUND_SMTP_PASS || process.env.INBOUND_EMAIL_PASSWORD || '',
        },
        imap: {
            host: asStr(process.env.INBOUND_IMAP_HOST, 'imap.zoho.in'),
            port: asNum(process.env.INBOUND_IMAP_PORT, 993),
            secure: asBool(process.env.INBOUND_IMAP_SECURE, true),
        },
        folders: asFolders(process.env.INBOUND_IMAP_FOLDERS, 'INBOX,Sent'),
    };
}

/** Lower-cased addresses of retired CRM mailboxes (never CC these; still "from the CRM"). */
function getRetiredMailboxAddresses() {
    return [...RETIRED_MAILBOX_ADDRESSES];
}

/** Lower-cased list of every address that counts as "the CRM banker mailbox" (live + retired). */
function getCrmMailboxAddresses() {
    const out = [];
    const live = getMailbox().email;
    if (live) out.push(live.toLowerCase());
    return [...out, ...getRetiredMailboxAddresses()];
}

module.exports = {
    getMailbox,
    getRetiredMailboxAddresses,
    getCrmMailboxAddresses,
};
