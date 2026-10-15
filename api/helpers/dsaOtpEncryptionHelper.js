const crypto = require("crypto");

const PLAIN_PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const PLAIN_AADHAAR_REGEX = /^[2-9]{1}[0-9]{11}$/;

const looksLikePlainPan = (value) => PLAIN_PAN_REGEX.test(String(value || "").trim().toUpperCase());
const looksLikePlainAadhaar = (value) => PLAIN_AADHAAR_REGEX.test(String(value || "").trim());

const normalizePlainPan = (value) => String(value).trim().toUpperCase();
const normalizePlainAadhaar = (value) => String(value).trim();

const getDsaOtpEncryptionKey = () => {
    const keyB64 = process.env.DSA_OTP_ENCRYPTION_KEY;
    if (!keyB64) {
        return null;
    }
    const key = Buffer.from(keyB64, "base64");
    if (key.length !== 32) {
        throw new Error("DSA_OTP_ENCRYPTION_KEY must decode to 32 bytes for AES-256-CBC");
    }
    return key;
};

const decryptWithIvAndCiphertext = (key, iv, encrypted) => {
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8").trim();
};

const tryDecryptEncryptedValue = (raw, key) => {
    if (raw.includes(":")) {
        const [ivPart, cipherPart] = raw.split(":");
        const iv = Buffer.from(ivPart, "base64");
        const encrypted = Buffer.from(cipherPart, "base64");
        if (iv.length !== 16) {
            throw new Error("Invalid encryption IV");
        }
        return decryptWithIvAndCiphertext(key, iv, encrypted);
    }

    const payload = Buffer.from(raw, "base64");
    if (payload.length <= 16) {
        throw new Error("Invalid encrypted payload");
    }
    const iv = payload.subarray(0, 16);
    const encrypted = payload.subarray(16);
    return decryptWithIvAndCiphertext(key, iv, encrypted);
};

/**
 * Resolves PAN / Aadhaar from either plaintext or AES-256-CBC encrypted payload.
 * Plaintext (including lowercase PAN) is accepted as fallback.
 */
exports.decryptDsaOtpField = (value, { field } = {}) => {
    if (value == null || value === "") {
        return value;
    }

    const raw = String(value).trim();
    const isPanField = field === "pan_number";
    const isAadhaarField = field === "aadhar_number";

    if (isPanField && looksLikePlainPan(raw)) {
        return normalizePlainPan(raw);
    }
    if (isAadhaarField && looksLikePlainAadhaar(raw)) {
        return normalizePlainAadhaar(raw);
    }
    if (!isPanField && !isAadhaarField) {
        if (looksLikePlainPan(raw)) {
            return normalizePlainPan(raw);
        }
        if (looksLikePlainAadhaar(raw)) {
            return normalizePlainAadhaar(raw);
        }
    }

    const key = getDsaOtpEncryptionKey();
    if (!key) {
        if (isPanField && looksLikePlainPan(raw)) {
            return normalizePlainPan(raw);
        }
        if (isAadhaarField && looksLikePlainAadhaar(raw)) {
            return normalizePlainAadhaar(raw);
        }
        throw new Error("DSA_OTP_ENCRYPTION_KEY is not configured");
    }

    try {
        const decrypted = tryDecryptEncryptedValue(raw, key);
        if (isPanField || looksLikePlainPan(decrypted)) {
            return normalizePlainPan(decrypted);
        }
        if (isAadhaarField || looksLikePlainAadhaar(decrypted)) {
            return normalizePlainAadhaar(decrypted);
        }
        return decrypted;
    } catch (decryptError) {
        if (isPanField && looksLikePlainPan(raw)) {
            return normalizePlainPan(raw);
        }
        if (isAadhaarField && looksLikePlainAadhaar(raw)) {
            return normalizePlainAadhaar(raw);
        }
        throw decryptError;
    }
};

exports.decryptDsaKycSensitiveFields = (body = {}) => {
    const next = { ...body };
    if (next.pan_number != null && next.pan_number !== "") {
        next.pan_number = exports.decryptDsaOtpField(next.pan_number, { field: "pan_number" });
    }
    if (next.aadhar_number != null && next.aadhar_number !== "") {
        next.aadhar_number = exports.decryptDsaOtpField(next.aadhar_number, { field: "aadhar_number" });
    }
    return next;
};

exports.looksLikePlainPan = looksLikePlainPan;
exports.looksLikePlainAadhaar = looksLikePlainAadhaar;
