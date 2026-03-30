import { Request, Response, NextFunction } from "express";
import { parseAccessToken, ACCESS_COOKIE_NAME, rotateSessionFromRefresh } from "../services/sessionService";
import { logAuthEvent } from "../services/auditService";

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Check Authorization: Bearer header first (cross-domain clients)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const payload = parseAccessToken(authHeader.slice(7));
    if (payload && payload.exp * 1000 > Date.now()) {
      req.userId = payload.sub;
      return next();
    }
  }

  // Fall back to cookie
  const cookieToken = req.cookies?.[ACCESS_COOKIE_NAME];
  if (cookieToken) {
    const payload = parseAccessToken(cookieToken);
    if (payload && payload.exp * 1000 > Date.now()) {
      req.userId = payload.sub;
      return next();
    }
  }

  try {
    const userId = await rotateSessionFromRefresh(req, res);
    if (!userId) {
      await logAuthEvent({ req, eventType: "auth.session.invalid", success: false });
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    req.userId = userId;
    await logAuthEvent({ req, eventType: "auth.session.refreshed", success: true, userId });
    return next();
  } catch {
    await logAuthEvent({ req, eventType: "auth.session.refresh_failed", success: false });
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

