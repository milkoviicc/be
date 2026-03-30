import { prisma } from "../utils/prismaClient";
import { Decimal } from "@prisma/client/runtime/client";
import { utcMidnightForAppDate } from "../utils/date";

export async function getOrCreateTodayBudget(userId: string) {
  // Store UTC, but keep the app's calendar day stable (e.g. Europe/Zagreb).
  const dateOnly = utcMidnightForAppDate();

  let budget = await prisma.dailyBudget.findUnique({
    where: { userId_date: { userId, date: dateOnly } },
  });

  // Always recalculate so changes to goals/income are reflected immediately

  const todayStart = dateOnly.getTime();
  const msPerDay = 24 * 60 * 60 * 1000;
  // Last day of current UTC month
  const endOfMonth = new Date(Date.UTC(dateOnly.getUTCFullYear(), dateOnly.getUTCMonth() + 1, 0));
  const daysLeftInMonthRaw = Math.round((endOfMonth.getTime() - todayStart) / msPerDay) + 1;
  const daysLeftInMonth = daysLeftInMonthRaw <= 0 ? 1 : daysLeftInMonthRaw;

  const [user, goals] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        monthlyNetIncome: true,
        monthlyHousingCost: true,
        monthlyUtilitiesCost: true,
        monthlyOtherFixedCosts: true,
        currentBalance: true,
        salaryDay: true,
        currentStreakDays: true,
        bestStreakDays: true,
        lastStreakDate: true,
      },
    }),
    prisma.savingsGoal.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  let baseDailyAllowance = new Decimal(0);

  if (user?.currentBalance) {
    // Balance-based calculation: daily = currentBalance / daysUntilNextSalary
    const salaryDay = user.salaryDay;
    let daysUntilPayday: number;

    if (salaryDay) {
      // Find next occurrence of salary day (UTC dates throughout)
      let nextPayday = new Date(Date.UTC(dateOnly.getUTCFullYear(), dateOnly.getUTCMonth(), salaryDay));
      if (nextPayday.getTime() <= todayStart) {
        nextPayday = new Date(Date.UTC(dateOnly.getUTCFullYear(), dateOnly.getUTCMonth() + 1, salaryDay));
      }
      daysUntilPayday = Math.max(1, Math.round((nextPayday.getTime() - todayStart) / msPerDay));
    } else {
      daysUntilPayday = daysLeftInMonth;
    }

    baseDailyAllowance = user.currentBalance.div(daysUntilPayday);
    if (baseDailyAllowance.lessThan(0)) baseDailyAllowance = new Decimal(0);

  } else if (user?.monthlyNetIncome) {
    // Income-based fallback when no current balance is set
    const income = user.monthlyNetIncome;
    const housing = user.monthlyHousingCost ?? new Decimal(0);
    const utilities = user.monthlyUtilitiesCost ?? new Decimal(0);
    const otherFixed = user.monthlyOtherFixedCosts ?? new Decimal(0);
    const fixedCosts = housing.add(utilities).add(otherFixed);

    let variableIncome = income.sub(fixedCosts);
    if (variableIncome.lessThan(0)) variableIncome = new Decimal(0);

    let totalGoalSavingsPerMonth = new Decimal(0);
    for (const goal of goals) {
      const targetStart = new Date(
        Date.UTC(goal.targetDate.getUTCFullYear(), goal.targetDate.getUTCMonth(), goal.targetDate.getUTCDate()),
      ).getTime();
      const remainingAmount = goal.goalAmount.sub(goal.startingBalance ?? new Decimal(0));
      if (remainingAmount.lessThanOrEqualTo(0)) continue;
      const remainingDaysRaw = Math.ceil((targetStart - todayStart) / msPerDay);
      const remainingMonths = Math.max(1, Math.ceil(remainingDaysRaw / 30));
      totalGoalSavingsPerMonth = totalGoalSavingsPerMonth.add(remainingAmount.div(remainingMonths));
    }

    let leftoverForSpendingPerMonth = variableIncome.sub(totalGoalSavingsPerMonth);
    if (leftoverForSpendingPerMonth.lessThan(0)) leftoverForSpendingPerMonth = new Decimal(0);

    baseDailyAllowance = leftoverForSpendingPerMonth.div(daysLeftInMonth);
  }
  // else: no data yet — stays at 0, nudges user to complete onboarding

  const yesterdayDate = new Date(Date.UTC(dateOnly.getUTCFullYear(), dateOnly.getUTCMonth(), dateOnly.getUTCDate() - 1));

  const yesterday = await prisma.dailyBudget.findUnique({
    where: { userId_date: { userId, date: yesterdayDate } },
  });

  const carryOverFromPrev = yesterday ? yesterday.computedLimit.sub(yesterday.spentToday) : new Decimal(0);

  // Update streak based on yesterday's performance
  if (yesterday && user) {
    const yesterdayLimit = yesterday.baseDailyAllowance.add(yesterday.carryOverFromPrev);
    const withinBudget = yesterday.spentToday.lte(yesterdayLimit);

    const isConsecutiveDay =
      user.lastStreakDate &&
      new Date(
        Date.UTC(user.lastStreakDate.getUTCFullYear(), user.lastStreakDate.getUTCMonth(), user.lastStreakDate.getUTCDate()),
      ).getTime() === yesterdayDate.getTime();

    let newCurrentStreak = user.currentStreakDays;
    if (withinBudget) {
      newCurrentStreak = isConsecutiveDay ? user.currentStreakDays + 1 : 1;
    } else {
      newCurrentStreak = 0;
    }

    const newBestStreak = Math.max(user.bestStreakDays, newCurrentStreak);

    await prisma.user.update({
      where: { id: userId },
      data: {
        currentStreakDays: newCurrentStreak,
        bestStreakDays: newBestStreak,
        lastStreakDate: yesterdayDate,
      },
    });
  }

  const computedLimit = baseDailyAllowance.add(carryOverFromPrev);

  const existingSpent = budget?.spentToday ?? new Decimal(0);
  const finalComputedLimit = baseDailyAllowance.add(carryOverFromPrev).sub(existingSpent);

  budget = await prisma.dailyBudget.upsert({
    where: { userId_date: { userId, date: dateOnly } },
    create: {
      userId,
      date: dateOnly,
      baseDailyAllowance,
      carryOverFromPrev,
      spentToday: new Decimal(0),
      computedLimit,
      goalId: goals[0]?.id ?? undefined,
    },
    update: {
      baseDailyAllowance,
      carryOverFromPrev,
      computedLimit: finalComputedLimit,
      goalId: goals[0]?.id ?? undefined,
    },
  });

  return budget;
}

/* export async function refreshTodayBudgetSpent(userId: string) {
  const today = new Date();
  const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const agg = await prisma.transaction.aggregate({
    where: {
      userId,
      isExcluded: false,
      date: {
        gte: dateOnly,
        lt: new Date(dateOnly.getTime() + 24 * 60 * 60 * 1000),
      },
    },
    _sum: { amount: true },
  });

  const spentToday = agg._sum.amount ?? new Decimal(0);

  const budget = await getOrCreateTodayBudget(userId);

  const computedLimit = budget.baseDailyAllowance.add(budget.carryOverFromPrev).sub(spentToday);

  return prisma.dailyBudget.update({
    where: { userId_date: { userId, date: dateOnly } },
    data: {
      spentToday,
      computedLimit,
    },
  });
} */

export async function refreshTodayBudgetSpent(userId: string) {
  const dateOnly = utcMidnightForAppDate();

  // Get or create budget with correct income-based baseDailyAllowance
  const budget = await getOrCreateTodayBudget(userId);

  // Recalculate spentToday: sum only expenses (negative amounts) and store as positive
  const agg = await prisma.transaction.aggregate({
    where: {
      userId,
      isExcluded: false,
      amount: { lt: 0 },
      date: {
        gte: dateOnly,
        lt: new Date(dateOnly.getTime() + 24 * 60 * 60 * 1000),
      },
    },
    _sum: { amount: true },
  });

  // sum is negative (e.g. -120), negate to get positive spentToday
  const spentToday = (agg._sum.amount ?? new Decimal(0)).abs();
  const computedLimit = budget.baseDailyAllowance.add(budget.carryOverFromPrev).sub(spentToday);

  return prisma.dailyBudget.update({
    where: { userId_date: { userId, date: dateOnly } },
    data: { spentToday, computedLimit },
  });
}