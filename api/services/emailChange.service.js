const crypto = require("crypto");
const axios = require("axios");
const { QueryTypes } = require("sequelize");
const { sendEmailSmtp, crmLoginOtpEmailTemplate } = require("../helpers/commonhelper");
const { callNsApi } = require("../helpers/commonhelper");

const isDevEnvironment = () => String(process.env.ENVIRONMENT || "").trim().toLowerCase() === "dev";

const OTP_EXPIRES_MINUTES = 10;
const COOLDOWN_AFTER_ATTEMPTS = 3;
const COOLDOWN_SECONDS = 60;
const LOCK_AFTER_ATTEMPTS = 5;
const LOCK_MINUTES = 30;
const ADMIN_VERIFY_HOURS = 24;

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hashOtp = (otp) => crypto.createHash("sha256").update(String(otp)).digest("hex");

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const formatSecondsRemaining = (untilDate) => {
    const sec = Math.max(1, Math.ceil((new Date(untilDate) - new Date()) / 1000));
    return sec;
};

/** CRM frontend page (link in admin verification email). */
const getCrmVerifyEmailBaseUrl = () => {
    if (process.env.CRM_VERIFY_EMAIL_URL) {
        return String(process.env.CRM_VERIFY_EMAIL_URL).replace(/\/$/, "");
    }
    if (process.env.CRM_URL) {
        return `${String(process.env.CRM_URL).replace(/\/$/, "")}/verify-email`;
    }
    return "";
};

const getCrmApiHost = () => {
    if (!process.env.CRM_API_BASE_URL) return "";
    return String(process.env.CRM_API_BASE_URL).replace(/\/$/, "");
};

/** API endpoint the CRM /verify-email page calls (CRM_VERIFY_EMAIL_API_URL overrides). */
exports.getCrmVerifyEmailApiUrl = () => {
    if (process.env.CRM_VERIFY_EMAIL_API_URL) {
        return String(process.env.CRM_VERIFY_EMAIL_API_URL).replace(/\/$/, "");
    }
    return `${getCrmApiHost()}/v1/dsa/verifyDsaEmail`;
};

/** Link in verification emails — CRM SPA, not the API host (crm-uat.ruloans.com/verify-email?token=). */
exports.getCrmVerifyEmailPublicUrl = (token) => {
    const base = getCrmVerifyEmailBaseUrl();
    const tokenStr = String(token || "").trim();
    return tokenStr ? `${base}?token=${encodeURIComponent(tokenStr)}` : base;
};

exports.getCrmVerifyEmailBaseUrl = getCrmVerifyEmailBaseUrl;

exports.getDsaEmailById = async (dsa_id) => {
    const rows = await _db2.query(
        `SELECT dsa_id, email_address, COALESCE(is_email_address_verified, 0) AS is_email_address_verified
         FROM ru_direct_selling_agents
         WHERE dsa_id = ?
         LIMIT 1`,
        { replacements: [dsa_id], type: QueryTypes.SELECT }
    );
    return rows?.[0] || null;
};

exports.isEmailTakenByOtherDsa = async (email, excludeDsaId) => {
    const em = normalizeEmail(email);
    if (!em) {
        return false;
    }
    const rows = await _db2.query(
        `SELECT dsa_id FROM ru_direct_selling_agents
         WHERE email_address IS NOT NULL
           AND TRIM(email_address) != ''
           AND LOWER(TRIM(email_address)) = ?
           AND dsa_id != ?
         LIMIT 1`,
        { replacements: [em, excludeDsaId], type: QueryTypes.SELECT }
    );
    return !!rows?.length;
};

/** Validates format + uniqueness (other DSA) before email change / OTP. */
exports.assertNewDsaEmailAvailable = async (dsa_id, new_email, { requireDifferentFromCurrent = true } = {}) => {
    const em = normalizeEmail(new_email);
    if (!em) {
        throw new Error("New email is required");
    }
    if (!EMAIL_FORMAT_RE.test(em)) {
        throw new Error("Enter a valid email address");
    }

    const dsa = await exports.getDsaEmailById(dsa_id);
    if (!dsa) {
        throw new Error("DSA not found");
    }

    const current = normalizeEmail(dsa.email_address);
    if (requireDifferentFromCurrent && current && current === em) {
        throw new Error("New email must be different from the current email");
    }

    if (await exports.isEmailTakenByOtherDsa(em, dsa_id)) {
        throw new Error("This email is already in use by a DSA");
    }

    return { email: em, dsa };
};

const OTP_SESSION_TABLE = "ru_dsa_email_otp_sessions";

const getActiveLockForEmail = async (dsa_id, email_address) => {
    const rows = await _db2.query(
        `SELECT locked_until FROM ${OTP_SESSION_TABLE}
         WHERE dsa_id = ? AND email_address = ? AND locked_until IS NOT NULL AND locked_until > NOW()
         LIMIT 1`,
        { replacements: [dsa_id, normalizeEmail(email_address)], type: QueryTypes.SELECT }
    );
    return rows?.[0] || null;
};

const getLatestUnconsumedOtp = async (dsa_id, email_address) => {
    const rows = await _db2.query(
        `SELECT id, dsa_id, email_address, otp_hash, attempt_count, expires_at, cooldown_until, locked_until, is_consumed
         FROM ${OTP_SESSION_TABLE}
         WHERE dsa_id = ? AND email_address = ? AND is_consumed = 0
         LIMIT 1`,
        { replacements: [dsa_id, normalizeEmail(email_address)], type: QueryTypes.SELECT }
    );
    return rows?.[0] || null;
};

const invalidateUnconsumedOtps = async (dsa_id, email_address) => {
    await _db2.query(
        `UPDATE ${OTP_SESSION_TABLE} SET is_consumed = 1, updated_at = NOW()
         WHERE dsa_id = ? AND email_address = ? AND is_consumed = 0`,
        { replacements: [dsa_id, normalizeEmail(email_address)], type: QueryTypes.UPDATE }
    );
};

/** Same table + upsert pattern as DSA email verification (`dsa-services.js`). */
const upsertOtpSession = async (dsa_id, email_address, otp_hash) => {
    const emailNorm = normalizeEmail(email_address);
    await _db2.query(
        `INSERT INTO ${OTP_SESSION_TABLE}
            (dsa_id, email_address, otp_hash, attempt_count, expires_at, cooldown_until, locked_until, is_consumed)
         VALUES
            (?, ?, ?, 0, DATE_ADD(NOW(), INTERVAL ? MINUTE), NULL, NULL, 0)
         ON DUPLICATE KEY UPDATE
            otp_hash = VALUES(otp_hash),
            attempt_count = 0,
            expires_at = VALUES(expires_at),
            cooldown_until = NULL,
            locked_until = NULL,
            is_consumed = 0,
            updated_at = NOW()`,
        {
            replacements: [dsa_id, emailNorm, otp_hash, OTP_EXPIRES_MINUTES],
            type: QueryTypes.INSERT
        }
    );
};

const sendDevGchatNotification = async ({ to, subject, body }) => {
    const webhookUrl = process.env.DEV_GCHAT_WEBHOOK_URL;
    if (!webhookUrl) {
        throw new Error("DEV_GCHAT_WEBHOOK_URL is not set in .env");
    }
    const text = [`*${subject}*`, `To: ${to}`, "", body].join("\n");
    await axios.post(
        webhookUrl,
        { text },
        { headers: { "Content-Type": "application/json" }, timeout: 15000 }
    );
};

const sendOtpEmail = async (to, otp) => {
    const subject = "Email change OTP for Novostack CRM";
    if (isDevEnvironment()) {
        await sendDevGchatNotification({
            to,
            subject: `[DEV] ${subject}`,
            body: `Email change OTP: *${otp}*\nValid for ${OTP_EXPIRES_MINUTES} minutes.`
        });
        return;
    }
    await sendEmailSmtp(
        {
            to,
            subject,
            text: "Here is your email change OTP for Novostack CRM",
            body: crmLoginOtpEmailTemplate(otp, `${OTP_EXPIRES_MINUTES} minutes`)
        },
        true
    );
};

const getNsVendorIdentifiersForDsa = async (dsa_id) => {
    if (!dsa_id) return { internalid: "", pan_number: "" };
    const rows = await _db2.query(
        `SELECT COALESCE(netsuite_vendor_id, '') AS internalid, COALESCE(permanent_account_number, '') AS pan_number
         FROM ru_dsa_kyc_data
         WHERE dsa_id = ?
         LIMIT 1`,
        { replacements: [dsa_id], type: QueryTypes.SELECT }
    );
    const row = rows?.[0] || {};
    return {
        internalid: String(row.internalid || "").trim(),
        pan_number: String(row.pan_number || "").trim()
    };
};

const triggerNsVendorUpdateForVerifiedEmail = async ({ dsa_id, vendor_email }) => {
    try {
        const emailValue = vendor_email != null ? String(vendor_email).trim() : "";
        if (!emailValue) {
            console.warn("[NS_VENDOR_UPDATE] Skipped: empty verified email", { dsa_id });
            return;
        }

        const { internalid, pan_number } = await getNsVendorIdentifiersForDsa(dsa_id);
        if (!internalid && !pan_number) {
            console.warn("[NS_VENDOR_UPDATE] Skipped: missing internalid and pan_number", { dsa_id });
            return;
        }

        const payload = {
            internalid: internalid || "",
            pan_number: internalid ? "" : pan_number,
            vendor_update: "True",
            vendor_email: emailValue
        };

        console.log("[NS_VENDOR_UPDATE] Attempt", {
            dsa_id,
            identifier_used: internalid ? "internalid" : "pan_number",
            internalid: payload.internalid || null,
            pan_number: payload.pan_number || null,
            has_vendor_email: true
        });

        const response = await callNsApi({
            api: "customscript_ruloans_rest_send_vendor",
            payload
        });

        console.log("[NS_VENDOR_UPDATE] Response", {
            dsa_id,
            identifier_used: internalid ? "internalid" : "pan_number",
            code: response?.Code ?? null,
            status: response?.Status ?? null,
            message: response?.message ?? null
        });
    } catch (error) {
        // NetSuite update should not block email verification success.
        console.error("[NS_VENDOR_UPDATE] Failed (non-blocking)", {
            dsa_id,
            error: error?.message || error
        });
    }
};

const assertNotLocked = async (dsa_id, email_address) => {
    const lockRow = await getActiveLockForEmail(dsa_id, email_address);
    if (lockRow?.locked_until) {
        const sec = formatSecondsRemaining(lockRow.locked_until);
        throw new Error(`Too many failed attempts. Try again in ${Math.ceil(sec / 60)} minute(s).`);
    }
};

const assertResendNotOnCooldown = async (session) => {
    if (session?.cooldown_until && new Date(session.cooldown_until) > new Date()) {
        const sec = formatSecondsRemaining(session.cooldown_until);
        throw new Error(`Please wait ${sec} second(s) before requesting a new OTP.`);
    }
};

exports.sendOtpToEmail = async (dsa_id, email_address, { isResend = false } = {}) => {
    const em = normalizeEmail(email_address);
    if (!em) {
        throw new Error("Email is required");
    }

    await assertNotLocked(dsa_id, em);

    if (isResend) {
        const existing = await getLatestUnconsumedOtp(dsa_id, em);
        await assertResendNotOnCooldown(existing);
    }

    await invalidateUnconsumedOtps(dsa_id, em);

    const otp = generateOtp();
    await upsertOtpSession(dsa_id, em, hashOtp(otp));
    await sendOtpEmail(em, otp);

    return { message: "OTP sent successfully" };
};

exports.verifyOtpForEmail = async (dsa_id, email_address, otp) => {
    const em = normalizeEmail(email_address);
    const otpStr = String(otp || "").trim();
    if (!otpStr) {
        throw new Error("OTP is required");
    }

    if (String(process.env.ENVIRONMENT || "").trim().toLowerCase() === "dev" && otpStr === "666666") {
        await invalidateUnconsumedOtps(dsa_id, em);
        return { message: "OTP verified successfully" };
    }

    const session = await getLatestUnconsumedOtp(dsa_id, em);
    if (!session) {
        throw new Error("OTP expired or not found. Request a new code.");
    }

    if (session.locked_until && new Date(session.locked_until) > new Date()) {
        const sec = formatSecondsRemaining(session.locked_until);
        throw new Error(`Too many failed attempts. Try again in ${Math.ceil(sec / 60)} minute(s).`);
    }

    if (session.cooldown_until && new Date(session.cooldown_until) > new Date()) {
        const sec = formatSecondsRemaining(session.cooldown_until);
        throw new Error(`Please wait ${sec} second(s) before trying again.`);
    }

    if (!session.expires_at || new Date(session.expires_at) <= new Date()) {
        throw new Error("OTP expired or not found. Request a new code.");
    }

    if (hashOtp(otpStr) !== session.otp_hash) {
        const newCount = (Number(session.attempt_count) || 0) + 1;
        let cooldownSql = "";
        let lockSql = "";
        const replacements = [newCount, session.id];

        if (newCount >= COOLDOWN_AFTER_ATTEMPTS && newCount < LOCK_AFTER_ATTEMPTS) {
            cooldownSql = ", cooldown_until = DATE_ADD(NOW(), INTERVAL ? SECOND)";
            replacements.splice(1, 0, COOLDOWN_SECONDS);
        }
        if (newCount >= LOCK_AFTER_ATTEMPTS) {
            lockSql = ", locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE)";
            replacements.splice(cooldownSql ? 2 : 1, 0, LOCK_MINUTES);
        }

        await _db2.query(
            `UPDATE ${OTP_SESSION_TABLE} SET attempt_count = ?${cooldownSql}${lockSql}, updated_at = NOW() WHERE id = ?`,
            { replacements, type: QueryTypes.UPDATE }
        );

        if (newCount >= LOCK_AFTER_ATTEMPTS) {
            throw new Error("Too many failed attempts. Try again in 30 minutes.");
        }
        if (newCount >= COOLDOWN_AFTER_ATTEMPTS) {
            throw new Error(`Invalid OTP. Please wait ${COOLDOWN_SECONDS} seconds before trying again.`);
        }
        throw new Error("Invalid OTP. Please try again.");
    }

    await _db2.query(
        `UPDATE ${OTP_SESSION_TABLE} SET is_consumed = 1, updated_at = NOW() WHERE id = ?`,
        { replacements: [session.id], type: QueryTypes.UPDATE }
    );

    return { message: "OTP verified successfully" };
};

exports.sendOtpOldEmail = async (dsa_id) => {
    const dsa = await exports.getDsaEmailById(dsa_id);
    if (!dsa?.email_address) {
        throw new Error("No email on file for this DSA");
    }
    return exports.sendOtpToEmail(dsa_id, dsa.email_address);
};

exports.resendOtpOldEmail = async (dsa_id) => {
    const dsa = await exports.getDsaEmailById(dsa_id);
    if (!dsa?.email_address) {
        throw new Error("No email on file for this DSA");
    }
    return exports.sendOtpToEmail(dsa_id, dsa.email_address, { isResend: true });
};

exports.verifyOtpOldEmail = async (dsa_id, otp) => {
    const dsa = await exports.getDsaEmailById(dsa_id);
    if (!dsa?.email_address) {
        throw new Error("No email on file for this DSA");
    }
    return exports.verifyOtpForEmail(dsa_id, dsa.email_address, otp);
};

exports.sendOtpNewEmail = async (dsa_id, new_email) => {
    const { email: em } = await exports.assertNewDsaEmailAvailable(dsa_id, new_email);
    return exports.sendOtpToEmail(dsa_id, em);
};

exports.resendOtpNewEmail = async (dsa_id, new_email) => {
    const { email: em } = await exports.assertNewDsaEmailAvailable(dsa_id, new_email);
    return exports.sendOtpToEmail(dsa_id, em, { isResend: true });
};

exports.verifyOtpNewEmail = async (dsa_id, new_email, otp) => {
    const { email: em } = await exports.assertNewDsaEmailAvailable(dsa_id, new_email, {
        requireDifferentFromCurrent: false
    });

    await exports.verifyOtpForEmail(dsa_id, em, otp);

    await _db2.query(
        `UPDATE ru_direct_selling_agents
         SET email_address = ?, is_email_address_verified = 1, updated_at = NOW()
         WHERE dsa_id = ?`,
        { replacements: [em, dsa_id], type: QueryTypes.UPDATE }
    );
    await triggerNsVendorUpdateForVerifiedEmail({ dsa_id, vendor_email: em });

    return { message: "Email updated successfully", email: em };
};

const adminVerificationEmailBody = (verifyUrl) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Verify your new email</title></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f7fa;">
  <table align="center" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:30px 0;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:10px;overflow:hidden;">
        <tr><td style="background:#111827;padding:20px;text-align:center;color:#fff;font-size:20px;font-weight:bold;">Novostack CRM</td></tr>
        <tr><td style="padding:28px;color:#333;font-size:15px;line-height:1.6;">
          <p>Your email address on Novostack CRM was updated by an administrator.</p>
          <p>Please verify your new email by clicking the button below. This link expires in <strong>24 hours</strong>.</p>
          <p style="text-align:center;margin:28px 0;">
            <a href="${verifyUrl}" style="background:#004aad;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">Verify email</a>
          </p>
          <p style="font-size:13px;color:#666;">If you did not expect this change, contact support immediately.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const sendAdminVerificationEmail = async (to, verifyUrl) => {
    const subject = "Verify your new email — Novostack CRM";
    if (isDevEnvironment()) {
        await sendDevGchatNotification({
            to,
            subject: `[DEV] ${subject}`,
            body: `Verify email for ${to} (expires in ${ADMIN_VERIFY_HOURS}h):\n${verifyUrl}`
        });
        return;
    }
    await sendEmailSmtp(
        {
            to,
            subject,
            text: "Please verify your new email address for Novostack CRM",
            body: adminVerificationEmailBody(verifyUrl)
        },
        true
    );
};

exports.adminChangeDsaEmail = async (dsa_id, new_email) => {
    const { email: em } = await exports.assertNewDsaEmailAvailable(dsa_id, new_email);

    const token = crypto.randomBytes(32).toString("hex");
    const verifyUrl = exports.getCrmVerifyEmailPublicUrl(token);

    await _db2.query(
        `UPDATE ru_direct_selling_agents
         SET email_address = ?,
             is_email_address_verified = 0,
             email_verification_token = ?,
             email_verification_expires = DATE_ADD(NOW(), INTERVAL ? HOUR),
             updated_at = NOW()
         WHERE dsa_id = ?`,
        { replacements: [em, token, ADMIN_VERIFY_HOURS, dsa_id], type: QueryTypes.UPDATE }
    );

    await sendAdminVerificationEmail(em, verifyUrl);

    return {
        message: isDevEnvironment()
            ? "Email updated. Verification details sent to dev Google Chat."
            : "Email updated. Verification link sent to the new address.",
        email: em
    };
};

const masterQueryOpts = (replacements, type) => ({
    replacements,
    type,
    useMaster: true
});

exports.verifyEmailByToken = async (token) => {
    const tokenStr = String(token || "").trim();
    if (!tokenStr) {
        throw new Error("Invalid verification link. No token provided.");
    }

    const validRows = await _db2.query(
        `SELECT dsa_id
         FROM ru_direct_selling_agents
         WHERE email_verification_token = ?
           AND email_verification_expires IS NOT NULL
           AND email_verification_expires > NOW()
         LIMIT 1`,
        masterQueryOpts([tokenStr], QueryTypes.SELECT)
    );

    if (!validRows?.length) {
        const staleRows = await _db2.query(
            `SELECT dsa_id FROM ru_direct_selling_agents
             WHERE email_verification_token = ?
             LIMIT 1`,
            masterQueryOpts([tokenStr], QueryTypes.SELECT)
        );
        if (staleRows?.length) {
            throw new Error("Link expired. Please contact your admin to resend.");
        }
        throw new Error(
            "This verification link has already been used. If your email is already verified, no further action is needed."
        );
    }

    await _db2.query(
        `UPDATE ru_direct_selling_agents
         SET is_email_address_verified = 1,
             email_verification_token = NULL,
             email_verification_expires = NULL,
             updated_at = NOW()
         WHERE email_verification_token = ?
           AND email_verification_expires > NOW()`,
        masterQueryOpts([tokenStr], QueryTypes.UPDATE)
    );
    const dsa_id = validRows?.[0]?.dsa_id;
    if (dsa_id) {
        const dsa = await exports.getDsaEmailById(dsa_id);
        await triggerNsVendorUpdateForVerifiedEmail({ dsa_id, vendor_email: dsa?.email_address });
    }

    return { message: "Email verified successfully" };
};

exports.adminResendVerificationEmail = async (dsa_id) => {
    const dsa = await exports.getDsaEmailById(dsa_id);
    if (!dsa?.email_address) {
        throw new Error("DSA email not found");
    }

    const token = crypto.randomBytes(32).toString("hex");
    const verifyUrl = exports.getCrmVerifyEmailPublicUrl(token);

    await _db2.query(
        `UPDATE ru_direct_selling_agents
         SET email_verification_token = ?,
             email_verification_expires = DATE_ADD(NOW(), INTERVAL ? HOUR),
             updated_at = NOW()
         WHERE dsa_id = ?`,
        { replacements: [token, ADMIN_VERIFY_HOURS, dsa_id], type: QueryTypes.UPDATE }
    );

    await sendAdminVerificationEmail(normalizeEmail(dsa.email_address), verifyUrl);

    return {
        message: isDevEnvironment()
            ? "Verification details resent to dev Google Chat."
            : "Verification email resent successfully"
    };
};
