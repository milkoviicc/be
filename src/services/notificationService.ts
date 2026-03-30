import { prisma } from "../utils/prismaClient";

export type NotificationType = "success" | "warning" | "danger" | "info";

export interface AppNotification {
  id: string;
  type: NotificationType;
  key: string;
  params?: Record<string, string | number>;
  isRead: boolean;
}

/** Date-only UTC midnight for deduplication */
function todayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function getNotificationsForUser(userId: string): Promise<AppNotification[]> {
  const today = new Date();
  const dateOnly = todayUtc();

  const [user, todayBudget, goals] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { currentStreakDays: true },
    }),
    prisma.dailyBudget.findUnique({
      where: { userId_date: { userId, date: dateOnly } },
    }),
    prisma.savingsGoal.findMany({ where: { userId, completedAt: null } }),
  ]);

  type Computed = {
    key: string;
    type: NotificationType;
    params?: Record<string, string | number>;
  };

  const computed: Computed[] = [];

  // ── Spending alerts ──────────────────────────────────────────────────────
  if (todayBudget) {
    const limit = Number(todayBudget.baseDailyAllowance) + Number(todayBudget.carryOverFromPrev);
    const spent = Number(todayBudget.spentToday);

    if (limit > 0) {
      const pct = spent / limit;

      if (pct >= 1) {
        computed.push({
          key: "budgetExceeded",
          type: "danger",
          params: { overspent: (spent - limit).toFixed(2) },
        });
      } else if (pct >= 0.9) {
        computed.push({
          key: "budget90",
          type: "danger",
          params: { pct: String(Math.round(pct * 100)), remaining: (limit - spent).toFixed(2) },
        });
      } else if (pct >= 0.7) {
        computed.push({
          key: "budget70",
          type: "warning",
          params: { pct: String(Math.round(pct * 100)) },
        });
      }
    }
  }

  // ── Carry-over bonus ─────────────────────────────────────────────────────
  if (todayBudget && Number(todayBudget.carryOverFromPrev) > 0) {
    computed.push({
      key: "carryOver",
      type: "success",
      params: { amount: Number(todayBudget.carryOverFromPrev).toFixed(2) },
    });
  }

  // ── Streak ───────────────────────────────────────────────────────────────
  if (user && user.currentStreakDays >= 3) {
    computed.push({
      key: "streak",
      type: "success",
      params: { days: user.currentStreakDays },
    });
  }

  // ── Savings goal progress ────────────────────────────────────────────────
  for (const goal of goals) {
    const saved  = Number(goal.startingBalance ?? 0);
    const target = Number(goal.goalAmount);
    const pct    = target > 0 ? saved / target : 0;

    if (pct >= 0.9 && pct < 1) {
      computed.push({
        key: `goalNear_${goal.id}`,
        type: "success",
        params: { name: goal.name, pct: String(Math.round(pct * 100)), target: target.toFixed(0) },
      });
    }

    if (todayBudget && Number(todayBudget.baseDailyAllowance) === 0 && target > saved) {
      const daysLeft = Math.max(1, Math.ceil((goal.targetDate.getTime() - today.getTime()) / 86400000));
      const needed   = (target - saved) / daysLeft;
      computed.push({
        key: `goalAtRisk_${goal.id}`,
        type: "warning",
        params: { name: goal.name, needed: needed.toFixed(2) },
      });
    }
  }

  // ── Upsert today's notifications to DB ───────────────────────────────────
  if (computed.length > 0) {
    await Promise.all(
      computed.map((n) =>
        prisma.notification.upsert({
          where: { userId_key_date: { userId, key: n.key, date: dateOnly } },
          create: { userId, type: n.type, key: n.key, params: n.params ?? {}, date: dateOnly, isRead: false },
          update: { type: n.type, params: n.params ?? {} },
        })
      )
    );
  }

  // ── Fetch today's notifications from DB (preserving isRead state) ─────────
  const rows = await prisma.notification.findMany({
    where: { userId, date: dateOnly },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((r) => ({
    id: r.id,
    type: r.type as NotificationType,
    key: r.key,
    params: (r.params as Record<string, string | number>) ?? {},
    isRead: r.isRead,
  }));
}
