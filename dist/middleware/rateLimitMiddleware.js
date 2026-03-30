"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitAuth = rateLimitAuth;
const buckets = new Map();
function keyFrom(req, suffix) {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    return `${ip}:${suffix}`;
}
function rateLimitAuth(maxRequests, windowMs, suffix) {
    return (req, res, next) => {
        const key = keyFrom(req, suffix);
        const now = Date.now();
        const current = buckets.get(key);
        if (!current || current.resetAt <= now) {
            buckets.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }
        if (current.count >= maxRequests) {
            const retryAfterSec = Math.ceil((current.resetAt - now) / 1000);
            res.setHeader("Retry-After", String(retryAfterSec));
            return res.status(429).json({ error: "Too many requests, please try again later." });
        }
        current.count += 1;
        buckets.set(key, current);
        return next();
    };
}
