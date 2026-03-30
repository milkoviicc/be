import { Router } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { getNotificationsForUser } from "../services/notificationService";
import { prisma } from "../utils/prismaClient";
import { utcMidnightForAppDate } from "../utils/date";

const router = Router();

// GET /notifications — fetch (and recompute) today's notifications
router.get("/", async (req: AuthenticatedRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const notifications = await getNotificationsForUser(req.userId);
  return res.json(notifications);
});

// PATCH /notifications/:id/read — mark single notification as read
router.patch("/:id/read", async (req: AuthenticatedRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const id = String(req.params.id);
  const row = await prisma.notification.findUnique({ where: { id } });
  if (!row || row.userId !== req.userId) {
    return res.status(404).json({ error: "Not found" });
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  return res.json({ id: updated.id, isRead: updated.isRead });
});

// POST /notifications/read-all — mark all of today's as read
router.post("/read-all", async (req: AuthenticatedRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const dateOnly = utcMidnightForAppDate();

  await prisma.notification.updateMany({
    where: { userId: req.userId, date: dateOnly, isRead: false },
    data: { isRead: true },
  });

  return res.json({ ok: true });
});

export const notificationsRouter = router;
