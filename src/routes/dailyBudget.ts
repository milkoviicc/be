import { Router } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { getOrCreateTodayBudget, refreshTodayBudgetSpent } from "../services/budgetService";
import { processSalaryIfDue } from "../services/salaryService";

const router = Router();

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
router.get("/", async (req: AuthenticatedRequest, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  await processSalaryIfDue(req.userId).catch(() => {});
  const budget = await refreshTodayBudgetSpent(req.userId);

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
router.get("/raw", async (req: AuthenticatedRequest, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const budget = await getOrCreateTodayBudget(req.userId);
  return res.json(budget);
});

export const dailyBudgetRouter = router;

