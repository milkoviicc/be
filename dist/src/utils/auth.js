"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSRF_COOKIE_NAME = void 0;
exports.clearAuthCookies = clearAuthCookies;
exports.issueCsrfCookie = issueCsrfCookie;
const crypto_1 = require("crypto");
const NODE_ENV = process.env.NODE_ENV || "development";
exports.CSRF_COOKIE_NAME = "smartsave_csrf";
function clearAuthCookies(res) {
    const secure = NODE_ENV === "production";
    const sameSite = NODE_ENV === "production" ? "none" : "lax";
    res.clearCookie(exports.CSRF_COOKIE_NAME, { secure, sameSite, path: "/" });
}
function issueCsrfCookie(res) {
    const secure = NODE_ENV === "production";
    const sameSite = NODE_ENV === "production" ? "none" : "lax";
    const csrfToken = (0, crypto_1.randomBytes)(32).toString("hex");
    res.cookie(exports.CSRF_COOKIE_NAME, csrfToken, {
        httpOnly: false,
        secure,
        sameSite,
        path: "/",
        maxAge: 1000 * 60 * 60 * 24 * 7,
    });
    return csrfToken;
}
