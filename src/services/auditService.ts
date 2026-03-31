import { Request } from "express";
import { prisma } from "../utils/prismaClient";
import { Prisma } from ".prisma/client/default";

export async function logAuthEvent(args: {
  req: Request;
  eventType: string;
  success: boolean;
  userId?: string | null;
  email?: string | null;
  meta?: Record<string, unknown>;
}) {
  const ipAddress = args.req.ip || args.req.socket.remoteAddress || null;
  const userAgent = args.req.get("user-agent") || null;

  try {
    await prisma.authAuditLog.create({
      data: {
        eventType: args.eventType,
        success: args.success,
        userId: args.userId ?? null,
        email: args.email ?? null,
        ipAddress,
        userAgent,
        meta: (args.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch {
    // Never break auth flow on logging failure.
  }
}
