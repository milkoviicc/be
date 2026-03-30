"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAuthEvent = logAuthEvent;
const prismaClient_1 = require("../utils/prismaClient");
async function logAuthEvent(args) {
    const ipAddress = args.req.ip || args.req.socket.remoteAddress || null;
    const userAgent = args.req.get("user-agent") || null;
    try {
        await prismaClient_1.prisma.authAuditLog.create({
            data: {
                eventType: args.eventType,
                success: args.success,
                userId: args.userId ?? null,
                email: args.email ?? null,
                ipAddress,
                userAgent,
                meta: (args.meta ?? undefined),
            },
        });
    }
    catch {
        // Never break auth flow on logging failure.
    }
}
