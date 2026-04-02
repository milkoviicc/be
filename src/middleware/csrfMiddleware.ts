import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "./authMiddleware";
import { generateCsrfToken } from "../utils/auth";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function csrfMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const expected = generateCsrfToken(req.userId);
  const headerToken = req.header("x-csrf-token");

  if (!headerToken || headerToken !== expected) {
    return res.status(403).json({ error: "CSRF token missing or invalid" });
  }

  return next();
}
