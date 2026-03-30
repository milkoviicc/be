import { Response } from "express";
import { randomBytes } from "crypto";

const NODE_ENV = process.env.NODE_ENV || "development";
export const CSRF_COOKIE_NAME = "smartsave_csrf";

export function clearAuthCookies(res: Response) {
  const secure = NODE_ENV === "production";
  const base = { secure, sameSite: "lax" as const, path: "/" };
  res.clearCookie(CSRF_COOKIE_NAME, base);
}

export function issueCsrfCookie(res: Response) {
  const secure = NODE_ENV === "production";
  const csrfToken = randomBytes(32).toString("hex");
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
}
