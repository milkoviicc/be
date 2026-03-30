"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.csrfMiddleware = csrfMiddleware;
const auth_1 = require("../utils/auth");
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
function csrfMiddleware(req, res, next) {
    if (SAFE_METHODS.has(req.method))
        return next();
    const cookieToken = req.cookies?.[auth_1.CSRF_COOKIE_NAME];
    const headerToken = req.header("x-csrf-token");
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return res.status(403).json({ error: "CSRF token missing or invalid" });
    }
    return next();
}
