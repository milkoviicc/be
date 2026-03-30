"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.goalsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prismaClient_1 = require("../utils/prismaClient");
const router = (0, express_1.Router)();
const goalSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    goalAmount: zod_1.z.number().positive(),
    targetDate: zod_1.z.string().datetime(),
    startingBalance: zod_1.z.number().optional(),
    primaryAccountId: zod_1.z.string().optional(),
});
function pathId(value) {
    if (typeof value === "string" && value.length > 0)
        return value;
    return null;
}
/**
 * @swagger
 * /goals:
 *   post:
 *     summary: Create a savings goal
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, goalAmount, targetDate]
 *             properties:
 *               name:
 *                 type: string
 *               goalAmount:
 *                 type: number
 *               targetDate:
 *                 type: string
 *                 format: date-time
 *               startingBalance:
 *                 type: number
 *               primaryAccountId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Goal created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SavingsGoal'
 *       400:
 *         description: Invalid payload
 *       401:
 *         description: Unauthorized
 */
router.post("/", async (req, res) => {
    if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const parseResult = goalSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid payload", details: parseResult.error.flatten() });
    }
    const { name, goalAmount, targetDate, startingBalance, primaryAccountId } = parseResult.data;
    const goal = await prismaClient_1.prisma.savingsGoal.create({
        data: {
            userId: req.userId,
            name,
            goalAmount,
            targetDate: new Date(targetDate),
            startingBalance,
            primaryAccountId,
        },
    });
    return res.status(201).json(goal);
});
/**
 * @swagger
 * /goals:
 *   get:
 *     summary: List savings goals
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of savings goals
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SavingsGoal'
 *       401:
 *         description: Unauthorized
 */
router.get("/", async (req, res) => {
    if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const goals = await prismaClient_1.prisma.savingsGoal.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: "desc" },
    });
    return res.json(goals);
});
/**
 * @swagger
 * /goals/{id}:
 *   patch:
 *     summary: Update a savings goal (e.g. mark as completed or update saved amount)
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               completedAt: { type: string, format: date-time, nullable: true }
 *               startingBalance: { type: number }
 *     responses:
 *       200:
 *         description: Updated goal
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Goal not found
 */
router.patch("/:id", async (req, res) => {
    if (!req.userId)
        return res.status(401).json({ error: "Unauthorized" });
    const goalId = pathId(req.params.id);
    if (!goalId)
        return res.status(400).json({ error: "Invalid goal id" });
    const schema = zod_1.z.object({
        completedAt: zod_1.z.string().datetime().nullable().optional(),
        startingBalance: zod_1.z.number().nonnegative().optional(),
    });
    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid payload", details: parseResult.error.flatten() });
    }
    const goal = await prismaClient_1.prisma.savingsGoal.findFirst({
        where: { id: goalId, userId: req.userId },
    });
    if (!goal)
        return res.status(404).json({ error: "Goal not found" });
    const { completedAt, startingBalance } = parseResult.data;
    const updated = await prismaClient_1.prisma.savingsGoal.update({
        where: { id: goalId },
        data: {
            ...(completedAt !== undefined && { completedAt: completedAt ? new Date(completedAt) : null }),
            ...(startingBalance !== undefined && { startingBalance }),
        },
    });
    return res.json(updated);
});
/**
 * @swagger
 * /goals/{id}:
 *   delete:
 *     summary: Delete a savings goal
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Goal not found
 */
router.delete("/:id", async (req, res) => {
    if (!req.userId)
        return res.status(401).json({ error: "Unauthorized" });
    const goalId = pathId(req.params.id);
    if (!goalId)
        return res.status(400).json({ error: "Invalid goal id" });
    const goal = await prismaClient_1.prisma.savingsGoal.findFirst({
        where: { id: goalId, userId: req.userId },
    });
    if (!goal)
        return res.status(404).json({ error: "Goal not found" });
    await prismaClient_1.prisma.savingsGoal.delete({ where: { id: goalId } });
    return res.status(204).send();
});
exports.goalsRouter = router;
