import { prisma } from "../utils/prismaClient";
import { Decimal } from "@prisma/client/runtime/client";
import { utcMidnightForAppDate } from "../utils/date";

/**
 * If today (UTC) is the user's salary day and it hasn't been processed yet this month:
 * - Adds monthlyNetIncome to currentBalance
 * - Subtracts fixed monthly costs (housing + utilities + other)
 * - Records a salary income transaction (isExcluded so it doesn't double-count in spentToday)
 * - Stamps lastSalaryDate to prevent double-processing
 */
export async function processSalaryIfDue(userId: string): Promise<void> {
  // Persist as UTC while preserving the app timezone calendar day.
  const todayDate = utcMidnightForAppDate();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      salaryDay: true,
      monthlyNetIncome: true,
      monthlyHousingCost: true,
      monthlyUtilitiesCost: true,
      monthlyOtherFixedCosts: true,
      currentBalance: true,
      lastSalaryDate: true,
    },
  });

  if (!user?.salaryDay || !user.monthlyNetIncome) return;

  // Compare UTC day of month
  if (todayDate.getUTCDate() !== user.salaryDay) return;

  // Already processed this month?
  if (user.lastSalaryDate) {
    const last = user.lastSalaryDate;
    if (
      last.getUTCFullYear() === todayDate.getUTCFullYear() &&
      last.getUTCMonth()    === todayDate.getUTCMonth()
    ) return;
  }

  const income = user.monthlyNetIncome;
  const housing = user.monthlyHousingCost ?? new Decimal(0);
  const utilities = user.monthlyUtilitiesCost ?? new Decimal(0);
  const other = user.monthlyOtherFixedCosts ?? new Decimal(0);
  const fixedCosts = housing.add(utilities).add(other);
  const net = income.sub(fixedCosts);
  const newBalance = (user.currentBalance ?? new Decimal(0)).add(net);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { currentBalance: newBalance, lastSalaryDate: todayDate },
    }),
    prisma.transaction.create({
      data: {
        userId,
        amount: net,
        merchant: "Monthly Salary",
        description: fixedCosts.greaterThan(0)
          ? `Net after fixed costs (−${fixedCosts.toFixed(2)})`
          : undefined,
        date: todayDate,
        isExcluded: true,
      },
    }),
  ]);
}
