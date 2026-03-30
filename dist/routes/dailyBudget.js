"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyBudgetRouter = void 0;
const express_1 = require("express");
const budgetService_1 = require("../services/budgetService");
const salaryService_1 = require("../services/salaryService");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /daily-budget:
 *   get:
 *     summary: Get today's dynamic daily spending limit
 *     tags: [Budget]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Today's budget
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DailyBudget'
 *       401:
 *         description: Unauthorized
 */
router.get("/", async (req, res) => {
    if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    await (0, salaryService_1.processSalaryIfDue)(req.userId).catch(() => { });
    const budget = await (0, budgetService_1.refreshTodayBudgetSpent)(req.userId);
    return res.json({
        date: budget.date,
        baseDailyAllowance: budget.baseDailyAllowance.toString(),
        carryOverFromPrev: budget.carryOverFromPrev.toString(),
        spentToday: budget.spentToday.toString(),
        computedLimit: budget.computedLimit.toString(),
    });
});
/**
 * @swagger
 * /daily-budget/raw:
 *   get:
 *     summary: Get raw today's budget record (no spend refresh)
 *     tags: [Budget]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Raw budget record
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DailyBudget'
 *       401:
 *         description: Unauthorized
 */
router.get("/raw", async (req, res) => {
    if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const budget = await (0, budgetService_1.getOrCreateTodayBudget)(req.userId);
    return res.json(budget);
});
exports.dailyBudgetRouter = router;
