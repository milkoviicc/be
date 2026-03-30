"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processSalaryIfDue = processSalaryIfDue;
const prismaClient_1 = require("../utils/prismaClient");
const client_1 = require("@prisma/client/runtime/client");
const date_1 = require("../utils/date");
/**
 * If today (UTC) is the user's salary day and it hasn't been processed yet this month:
 * - Adds monthlyNetIncome to currentBalance
 * - Subtracts fixed monthly costs (housing + utilities + other)
 * - Records a salary income transaction (isExcluded so it doesn't double-count in spentToday)
 * - Stamps lastSalaryDate to prevent double-processing
 */
async function processSalaryIfDue(userId) {
    // Persist as UTC while preserving the app timezone calendar day.
    const todayDate = (0, date_1.utcMidnightForAppDate)();
    const user = await prismaClient_1.prisma.user.findUnique({
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
    if (!user?.salaryDay || !user.monthlyNetIncome)
        return;
    // Compare UTC day of month
    if (todayDate.getUTCDate() !== user.salaryDay)
        return;
    // Already processed this month?
    if (user.lastSalaryDate) {
        const last = user.lastSalaryDate;
        if (last.getUTCFullYear() === todayDate.getUTCFullYear() &&
            last.getUTCMonth() === todayDate.getUTCMonth())
            return;
    }
    const income = user.monthlyNetIncome;
    const housing = user.monthlyHousingCost ?? new client_1.Decimal(0);
    const utilities = user.monthlyUtilitiesCost ?? new client_1.Decimal(0);
    const other = user.monthlyOtherFixedCosts ?? new client_1.Decimal(0);
    const fixedCosts = housing.add(utilities).add(other);
    const net = income.sub(fixedCosts);
    const newBalance = (user.currentBalance ?? new client_1.Decimal(0)).add(net);
    await prismaClient_1.prisma.$transaction([
        prismaClient_1.prisma.user.update({
            where: { id: userId },
            data: { currentBalance: newBalance, lastSalaryDate: todayDate },
        }),
        prismaClient_1.prisma.transaction.create({
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
