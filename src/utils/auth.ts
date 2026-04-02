import { Response } from "express";
import { createHmac } from "crypto";

const NODE_ENV = process.env.NODE_ENV || "development";
export const CSRF_COOKIE_NAME = "smartsave_csrf";

// Deterministic CSRF token derived from user ID.
// No cookie or DB needed — works cross-domain and survives iOS WebKit ITP.
const CSRF_SECRET = (process.env.JWT_SECRET || "dev-session-secret") + ":csrf";

export function generateCsrfToken(userId: string): string {
  return createHmac("sha256", CSRF_SECRET).update(userId).digest("hex");
}

export function clearAuthCookies(res: Response) {
  const secure = NODE_ENV === "production";
  const sameSite = NODE_ENV === "production" ? "none" : ("lax" as const);
  res.clearCookie(CSRF_COOKIE_NAME, { secure, sameSite, path: "/" });
}

/** @deprecated Cookie is no longer used for CSRF validation. Use generateCsrfToken(userId) instead. */
export function issueCsrfCookie(_res: Response): string {
  return "";
}
