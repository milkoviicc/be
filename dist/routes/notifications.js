"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRouter = void 0;
const express_1 = require("express");
const notificationService_1 = require("../services/notificationService");
const prismaClient_1 = require("../utils/prismaClient");
const date_1 = require("../utils/date");
const router = (0, express_1.Router)();
// GET /notifications — fetch (and recompute) today's notifications
router.get("/", async (req, res) => {
    if (!req.userId)
        return res.status(401).json({ error: "Unauthorized" });
    const notifications = await (0, notificationService_1.getNotificationsForUser)(req.userId);
    return res.json(notifications);
});
// PATCH /notifications/:id/read — mark single notification as read
router.patch("/:id/read", async (req, res) => {
    if (!req.userId)
        return res.status(401).json({ error: "Unauthorized" });
    const id = String(req.params.id);
    const row = await prismaClient_1.prisma.notification.findUnique({ where: { id } });
    if (!row || row.userId !== req.userId) {
        return res.status(404).json({ error: "Not found" });
    }
    const updated = await prismaClient_1.prisma.notification.update({
        where: { id },
        data: { isRead: true },
    });
    return res.json({ id: updated.id, isRead: updated.isRead });
});
// POST /notifications/read-all — mark all of today's as read
router.post("/read-all", async (req, res) => {
    if (!req.userId)
        return res.status(401).json({ error: "Unauthorized" });
    const dateOnly = (0, date_1.utcMidnightForAppDate)();
    await prismaClient_1.prisma.notification.updateMany({
        where: { userId: req.userId, date: dateOnly, isRead: false },
        data: { isRead: true },
    });
    return res.json({ ok: true });
});
exports.notificationsRouter = router;
