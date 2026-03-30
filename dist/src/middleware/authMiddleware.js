"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const sessionService_1 = require("../services/sessionService");
const auditService_1 = require("../services/auditService");
async function authMiddleware(req, res, next) {
    const token = req.cookies?.[sessionService_1.ACCESS_COOKIE_NAME];
    if (token) {
        const payload = (0, sessionService_1.parseAccessToken)(token);
        if (payload && payload.exp * 1000 > Date.now()) {
            req.userId = payload.sub;
            return next();
        }
    }
    try {
        const userId = await (0, sessionService_1.rotateSessionFromRefresh)(req, res);
        if (!userId) {
            await (0, auditService_1.logAuthEvent)({ req, eventType: "auth.session.invalid", success: false });
            return res.status(401).json({ error: "Invalid or expired token" });
        }
        req.userId = userId;
        await (0, auditService_1.logAuthEvent)({ req, eventType: "auth.session.refreshed", success: true, userId });
        return next();
    }
    catch {
        await (0, auditService_1.logAuthEvent)({ req, eventType: "auth.session.refresh_failed", success: false });
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}
