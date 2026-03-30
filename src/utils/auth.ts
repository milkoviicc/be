import { Response } from "express";
import { randomBytes } from "crypto";

const NODE_ENV = process.env.NODE_ENV || "development";
export const CSRF_COOKIE_NAME = "smartsave_csrf";

export function clearAuthCookies(res: Response) {
  const secure = NODE_ENV === "production";
  const sameSite = NODE_ENV === "production" ? "none" : ("lax" as const);
  res.clearCookie(CSRF_COOKIE_NAME, { secure, sameSite, path: "/" });
}

export function issueCsrfCookie(res: Response): string {
  const secure = NODE_ENV === "production";
  const sameSite = NODE_ENV === "production" ? "none" : ("lax" as const);
  const csrfToken = randomBytes(32).toString("hex");
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure,
    sameSite,
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
  return csrfToken;
}
