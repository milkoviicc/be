"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.REFRESH_COOKIE_NAME = exports.ACCESS_COOKIE_NAME = void 0;
exports.parseAccessToken = parseAccessToken;
exports.issueSessionCookies = issueSessionCookies;
exports.rotateSessionFromRefresh = rotateSessionFromRefresh;
exports.revokeCurrentSession = revokeCurrentSession;
exports.clearSessionCookies = clearSessionCookies;
const crypto_1 = require("crypto");
const prismaClient_1 = require("../utils/prismaClient");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const NODE_ENV = process.env.NODE_ENV || "development";
const REFRESH_TTL_MS = Number(process.env.REFRESH_TOKEN_TTL_MS || 1000 * 60 * 60 * 24 * 30);
const ACCESS_TIME_ZONE = process.env.ACCESS_TOKEN_TIME_ZONE || "Europe/Zagreb";
const ACCESS_EXPIRY_HOUR = 2;
const JWT_SECRET = process.env.JWT_SECRET || "dev-session-secret";
if (NODE_ENV === "production" && JWT_SECRET === "dev-session-secret") {
    throw new Error("JWT_SECRET must be set in production");
}
exports.ACCESS_COOKIE_NAME = "smartsave_access";
exports.REFRESH_COOKIE_NAME = "smartsave_refresh";
function cookieBase() {
    return {
        secure: NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
    };
}
function sha256(value) {
    return (0, crypto_1.createHash)("sha256").update(value).digest("hex");
}
function getIp(req) {
    return req.ip || req.socket.remoteAddress || null;
}
function getZonedParts(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date);
    const year = Number(parts.find((p) => p.type === "year")?.value);
    const month = Number(parts.find((p) => p.type === "month")?.value);
    const day = Number(parts.find((p) => p.type === "day")?.value);
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    const minute = Number(parts.find((p) => p.type === "minute")?.value);
    const second = Number(parts.find((p) => p.type === "second")?.value);
    if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute) || Number.isNaN(second)) {
        throw new Error(`Failed to resolve zoned datetime for ${timeZone}`);
    }
    return { year, month, day, hour, minute, second };
}
function zonedDateTimeToUtcDate(year, month, day, hour, minute, second, timeZone) {
    let utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    // Iteratively align guessed UTC instant to desired wall-clock time in target timezone.
    for (let i = 0; i < 4; i++) {
        const zoned = getZonedParts(utcGuess, timeZone);
        const desired = Date.UTC(year, month - 1, day, hour, minute, second);
        const seen = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);
        const deltaMs = desired - seen;
        if (deltaMs === 0)
            break;
        utcGuess = new Date(utcGuess.getTime() + deltaMs);
    }
    return utcGuess;
}
function nextAccessExpiryUtc(now = new Date()) {
    const zonedNow = getZonedParts(now, ACCESS_TIME_ZONE);
    const targetBase = new Date(Date.UTC(zonedNow.year, zonedNow.month - 1, zonedNow.day));
    if (zonedNow.hour >= ACCESS_EXPIRY_HOUR) {
        targetBase.setUTCDate(targetBase.getUTCDate() + 1);
    }
    const targetYear = targetBase.getUTCFullYear();
    const targetMonth = targetBase.getUTCMonth() + 1;
    const targetDay = targetBase.getUTCDate();
    return zonedDateTimeToUtcDate(targetYear, targetMonth, targetDay, ACCESS_EXPIRY_HOUR, 0, 0, ACCESS_TIME_ZONE);
}
function parseAccessToken(raw) {
    try {
        const decoded = jsonwebtoken_1.default.verify(raw, JWT_SECRET);
        if (!decoded?.sub || !decoded?.exp)
            return null;
        return { sub: decoded.sub, exp: decoded.exp };
    }
    catch {
        return null;
    }
}
function mintRefreshToken() {
    return (0, crypto_1.randomBytes)(48).toString("hex");
}
async function issueSessionCookies(res, req, userId) {
    const accessExpiry = nextAccessExpiryUtc();
    const accessToken = jsonwebtoken_1.default.sign({ sub: userId, exp: Math.floor(accessExpiry.getTime() / 1000) }, JWT_SECRET, { algorithm: "HS256", noTimestamp: true });
    const refreshToken = mintRefreshToken();
    const refreshTokenHash = sha256(refreshToken);
    const ua = req.get("user-agent") || null;
    const ip = getIp(req);
    await prismaClient_1.prisma.userSession.create({
        data: {
            userId,
            refreshTokenHash,
            userAgent: ua,
            ipAddress: ip,
            expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        },
    });
    res.cookie(exports.ACCESS_COOKIE_NAME, accessToken, {
        ...cookieBase(),
        httpOnly: true,
        maxAge: Math.max(1000, accessExpiry.getTime() - Date.now()),
    });
    res.cookie(exports.REFRESH_COOKIE_NAME, refreshToken, {
        ...cookieBase(),
        httpOnly: true,
        maxAge: REFRESH_TTL_MS,
    });
}
async function rotateSessionFromRefresh(req, res) {
    const refreshToken = req.cookies?.[exports.REFRESH_COOKIE_NAME];
    if (!refreshToken)
        return null;
    const hash = sha256(refreshToken);
    const now = new Date();
    const existing = await prismaClient_1.prisma.userSession.findUnique({ where: { refreshTokenHash: hash } });
    if (!existing || existing.revokedAt || existing.expiresAt <= now)
        return null;
    const newRefresh = mintRefreshToken();
    const newHash = sha256(newRefresh);
    const accessExpiry = nextAccessExpiryUtc();
    const newAccess = jsonwebtoken_1.default.sign({ sub: existing.userId, exp: Math.floor(accessExpiry.getTime() / 1000) }, JWT_SECRET, { algorithm: "HS256", noTimestamp: true });
    await prismaClient_1.prisma.userSession.update({
        where: { id: existing.id },
        data: {
            refreshTokenHash: newHash,
            expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
            userAgent: req.get("user-agent") || existing.userAgent,
            ipAddress: getIp(req) || existing.ipAddress,
        },
    });
    res.cookie(exports.ACCESS_COOKIE_NAME, newAccess, {
        ...cookieBase(),
        httpOnly: true,
        maxAge: Math.max(1000, accessExpiry.getTime() - Date.now()),
    });
    res.cookie(exports.REFRESH_COOKIE_NAME, newRefresh, {
        ...cookieBase(),
        httpOnly: true,
        maxAge: REFRESH_TTL_MS,
    });
    return existing.userId;
}
async function revokeCurrentSession(req, res) {
    const refreshToken = req.cookies?.[exports.REFRESH_COOKIE_NAME];
    if (refreshToken) {
        const hash = sha256(refreshToken);
        await prismaClient_1.prisma.userSession.updateMany({
            where: { refreshTokenHash: hash, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }
    clearSessionCookies(res);
}
function clearSessionCookies(res) {
    const base = cookieBase();
    res.clearCookie(exports.ACCESS_COOKIE_NAME, base);
    res.clearCookie(exports.REFRESH_COOKIE_NAME, base);
}
