"use strict";

const crypto = require("crypto");
const { QueryTypes } = require("sequelize");
const { logger } = require("../helpers/logger");

/**
 * trusted_devices.user_id is VARCHAR(191) storing the same UUID string as users.id
 * (BIN_TO_UUID from application queries). Token hash is stored in `fingerprint` column.
 */
function getDb() {
    if (typeof global !== "undefined" && global._db7) {
        return global._db7;
    }
    const { sequelize } = require("../../models");
    return sequelize;
}

function normalizeSelectRows(result) {
    if (!result) {
        return [];
    }
    if (
        Array.isArray(result) &&
        result.length === 2 &&
        Array.isArray(result[0]) &&
        result[1] &&
        typeof result[1] === "object"
    ) {
        return result[0];
    }
    return Array.isArray(result) ? result : [];
}

function sha256(val) {
    return crypto.createHash("sha256").update(val).digest("hex");
}

function extractClientIp(req) {
    if (!req) {
        return "";
    }
    const xff = req.headers["x-forwarded-for"];
    if (xff) {
        const first = String(xff).split(",")[0].trim();
        if (first) {
            return first;
        }
    }
    if (req.socket && req.socket.remoteAddress) {
        return req.socket.remoteAddress;
    }
    if (req.ip) {
        return req.ip;
    }
    return "";
}

function generateDeviceToken() {
    const rawToken = crypto.randomBytes(32).toString("hex");
    return { rawToken, tokenHash: sha256(rawToken) };
}

async function revokeAllDevicesForUser(userId) {
    try {
        const db = getDb();
        await db.query(
            `UPDATE trusted_devices
             SET revoked_at = NOW()
             WHERE user_id = ? AND revoked_at IS NULL`,
            { replacements: [userId], type: QueryTypes.UPDATE }
        );
    } catch (e) {
        logger.error("TrustedDeviceService.revokeAllDevicesForUser:", e);
    }
}

/** One active trusted device per user — other devices must use OTP on next login. */
async function revokeOtherTrustedDevicesExcept(userId, tokenHash) {
    if (!userId || !tokenHash) {
        return;
    }
    try {
        const db = getDb();
        await db.query(
            `UPDATE trusted_devices
             SET revoked_at = NOW()
             WHERE user_id = ? AND fingerprint != ? AND revoked_at IS NULL`,
            { replacements: [userId, tokenHash], type: QueryTypes.UPDATE }
        );
    } catch (e) {
        logger.error("TrustedDeviceService.revokeOtherTrustedDevicesExcept:", e);
    }
}

async function trustDevice(userId, tokenHash, ipAddress, userAgent) {
    try {
        const db = getDb();
        // New "remember me" on this device replaces any other trusted device.
        await revokeAllDevicesForUser(userId);

        const expiresAt = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);
        await db.query(
            `INSERT INTO trusted_devices
                (user_id, fingerprint, ip_address, user_agent, trusted_at, last_seen_at, expires_at)
             VALUES (?, ?, ?, ?, NOW(), NOW(), ?)`,
            {
                replacements: [userId, tokenHash, ipAddress || null, userAgent || null, expiresAt],
                type: QueryTypes.INSERT
            }
        );
    } catch (e) {
        logger.error("TrustedDeviceService.trustDevice:", e);
    }
}

async function isTrustedDevice(tokenHash) {
    if (!tokenHash) {
        return null;
    }
    try {
        const db = getDb();
        const raw = await db.query(
            `SELECT
                BIN_TO_UUID(u.id) AS id,
                u.email AS userEmail,
                u.name AS userName,
                u.status AS status,
                u.isDeleted AS isDeleted,
                u.tokenUpdatedAt AS tokenUpdatedAt
             FROM trusted_devices td
             INNER JOIN users u ON BIN_TO_UUID(u.id) = td.user_id
             WHERE td.fingerprint = ?
               AND td.revoked_at IS NULL
               AND td.expires_at > NOW()
             LIMIT 1`,
            { replacements: [tokenHash], type: QueryTypes.SELECT }
        );
        const rows = normalizeSelectRows(raw);
        if (!rows || !rows[0]) {
            return null;
        }
        await revokeOtherTrustedDevicesExcept(rows[0].id, tokenHash);
        await db.query(
            `UPDATE trusted_devices SET last_seen_at = NOW() WHERE fingerprint = ?`,
            { replacements: [tokenHash], type: QueryTypes.UPDATE }
        );
        return rows[0];
    } catch (e) {
        logger.error("TrustedDeviceService.isTrustedDevice:", e);
        return null;
    }
}

async function revokeDevice(tokenHash) {
    if (!tokenHash) {
        return false;
    }
    try {
        const db = getDb();
        await db.query(
            `UPDATE trusted_devices SET revoked_at = NOW() WHERE fingerprint = ? AND revoked_at IS NULL`,
            { replacements: [tokenHash], type: QueryTypes.UPDATE }
        );
        return true;
    } catch (e) {
        logger.error("TrustedDeviceService.revokeDevice:", e);
        return false;
    }
}

/** Revoke one trusted device row by id; returns false if not found or not owned by user. */
async function revokeTrustedDeviceById(deviceId, userIdUuid) {
    if (!deviceId || !userIdUuid) {
        return false;
    }
    try {
        const db = getDb();
        const raw = await db.query(
            `SELECT fingerprint
             FROM trusted_devices
             WHERE id = ?
               AND user_id = ?
               AND revoked_at IS NULL
               AND expires_at > NOW()
             LIMIT 1`,
            { replacements: [deviceId, userIdUuid], type: QueryTypes.SELECT }
        );
        const rows = normalizeSelectRows(raw);
        if (!rows[0]?.fingerprint) {
            return false;
        }
        return revokeDevice(rows[0].fingerprint);
    } catch (e) {
        logger.error("TrustedDeviceService.revokeTrustedDeviceById:", e);
        return false;
    }
}

const trustedDeviceSelectColumns = `
    id,
    user_id,
    fingerprint,
    device_id,
    device_type,
    ip_address,
    user_agent,
    trusted_at,
    last_seen_at,
    expires_at,
    revoked_at
`;

async function getTrustedDevicesForUser(userIdUuid) {
    try {
        const db = getDb();
        const query = `
            SELECT ${trustedDeviceSelectColumns}
            FROM trusted_devices
            WHERE user_id = ?
              AND expires_at > NOW()
              AND revoked_at IS NULL
            ORDER BY last_seen_at DESC
        `;
        const raw = await db.query(query, {
            replacements: [userIdUuid],
            type: QueryTypes.SELECT
        });
        return normalizeSelectRows(raw);
    } catch (e) {
        logger.error("TrustedDeviceService.getTrustedDevicesForUser:", e);
        return [];
    }
}

async function getTrustedDeviceRowByTokenHash(tokenHash) {
    if (!tokenHash) {
        return null;
    }
    try {
        const db = getDb();
        const query = `
            SELECT ${trustedDeviceSelectColumns}
            FROM trusted_devices
            WHERE fingerprint = ?
              AND expires_at > NOW()
              AND revoked_at IS NULL
            LIMIT 1
        `;
        const raw = await db.query(query, {
            replacements: [tokenHash],
            type: QueryTypes.SELECT
        });
        const rows = normalizeSelectRows(raw);
        return rows && rows[0] ? rows[0] : null;
    } catch (e) {
        logger.error("TrustedDeviceService.getTrustedDeviceRowByTokenHash:", e);
        return null;
    }
}

function redisSetEx(redisClient, key, seconds, value) {
    if (typeof redisClient.setAsync === "function") {
        return redisClient.setAsync(key, value, "EX", seconds);
    }
    return new Promise((resolve, reject) => {
        redisClient.set(key, value, "EX", seconds, (err, reply) => (err ? reject(err) : resolve(reply)));
    });
}

function redisGet(redisClient, key) {
    if (typeof redisClient.getAsync === "function") {
        return redisClient.getAsync(key);
    }
    return new Promise((resolve, reject) => {
        redisClient.get(key, (err, reply) => (err ? reject(err) : resolve(reply)));
    });
}

function redisDel(redisClient, key) {
    if (typeof redisClient.delAsync === "function") {
        return redisClient.delAsync(key);
    }
    return new Promise((resolve, reject) => {
        redisClient.del(key, (err, reply) => (err ? reject(err) : resolve(reply)));
    });
}

async function storePendingFingerprint(redisClient, userId, _fingerprint) {
    try {
        const key = `pending_trust:${userId}`;
        await redisSetEx(redisClient, key, 600, "1");
    } catch (e) {
        logger.error("TrustedDeviceService.storePendingFingerprint:", e);
    }
}

async function getPendingFingerprint(redisClient, userId) {
    try {
        const v = await redisGet(redisClient, `pending_trust:${userId}`);
        return v || null;
    } catch (e) {
        logger.error("TrustedDeviceService.getPendingFingerprint:", e);
        return null;
    }
}

async function clearPendingFingerprint(redisClient, userId) {
    try {
        await redisDel(redisClient, `pending_trust:${userId}`);
    } catch (e) {
        logger.error("TrustedDeviceService.clearPendingFingerprint:", e);
    }
}

module.exports = {
    sha256,
    extractClientIp,
    generateDeviceToken,
    trustDevice,
    isTrustedDevice,
    revokeDevice,
    revokeTrustedDeviceById,
    revokeAllDevicesForUser,
    revokeOtherTrustedDevicesExcept,
    getTrustedDevicesForUser,
    getTrustedDeviceRowByTokenHash,
    storePendingFingerprint,
    getPendingFingerprint,
    clearPendingFingerprint
};
