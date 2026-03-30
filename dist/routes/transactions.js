"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prismaClient_1 = require("../utils/prismaClient");
const openBankingService_1 = require("../services/openBankingService");
const budgetService_1 = require("../services/budgetService");
const date_1 = require("../utils/date");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /transactions:
 *   get:
 *     summary: List recent transactions
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of transactions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Transaction'
 *       401:
 *         description: Unauthorized
 */
router.get("/", async (req, res) => {
    if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const transactions = await prismaClient_1.prisma.transaction.findMany({
        where: { userId: req.userId },
        orderBy: { date: "desc" },
        take: 200,
        include: {
            category: true,
            account: true,
        },
    });
    return res.json(transactions);
});
const createSchema = zod_1.z.object({
    amount: zod_1.z.number().positive("Amount must be positive"),
    type: zod_1.z.enum(["expense", "income"]),
    merchant: zod_1.z.string().max(200).optional(),
    description: zod_1.z.string().max(500).optional(),
    categoryId: zod_1.z.string().optional(),
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});
router.post("/", async (req, res) => {
    if (!req.userId)
        return res.status(401).json({ error: "Unauthorized" });
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    const { amount, type, merchant, description, categoryId, date } = parsed.data;
    // Expenses are stored as negative, income as positive
    const signedAmount = type === "expense" ? -Math.abs(amount) : Math.abs(amount);
    // Validate categoryId belongs to the global category list
    if (categoryId) {
        const cat = await prismaClient_1.prisma.category.findUnique({ where: { id: categoryId } });
        if (!cat)
            return res.status(400).json({ error: "Category not found" });
    }
    const [year, month, day] = date.split("-").map(Number);
    const txDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const transaction = await prismaClient_1.prisma.transaction.create({
        data: {
            userId: req.userId,
            amount: signedAmount,
            merchant: merchant ?? null,
            description: description ?? null,
            categoryId: categoryId ?? null,
            date: txDate,
            currency: "EUR",
        },
        include: { category: true },
    });
    // Recalculate today's budget if the transaction is for today
    const today = (0, date_1.utcMidnightForAppDate)();
    const isToday = txDate.getUTCFullYear() === today.getUTCFullYear() &&
        txDate.getUTCMonth() === today.getUTCMonth() &&
        txDate.getUTCDate() === today.getUTCDate();
    if (isToday) {
        await (0, budgetService_1.refreshTodayBudgetSpent)(req.userId);
    }
    return res.status(201).json(transaction);
});
const deleteSchema = zod_1.z.object({ id: zod_1.z.string() });
router.delete("/:id", async (req, res) => {
    if (!req.userId)
        return res.status(401).json({ error: "Unauthorized" });
    const { id } = deleteSchema.parse({ id: req.params.id });
    const tx = await prismaClient_1.prisma.transaction.findUnique({ where: { id } });
    if (!tx || tx.userId !== req.userId) {
        return res.status(404).json({ error: "Transaction not found" });
    }
    await prismaClient_1.prisma.transaction.delete({ where: { id } });
    await (0, budgetService_1.refreshTodayBudgetSpent)(req.userId);
    return res.json({ ok: true });
});
const syncSchema = zod_1.z.object({
    accountId: zod_1.z.string(),
});
/**
 * @swagger
 * /transactions/sync:
 *   post:
 *     summary: Sync transactions from connected account
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accountId]
 *             properties:
 *               accountId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sync completed
 *       400:
 *         description: Invalid payload
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Account not found
 */
router.post("/sync", async (req, res) => {
    if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const parseResult = syncSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid payload", details: parseResult.error.flatten() });
    }
    const { accountId } = parseResult.data;
    const account = await prismaClient_1.prisma.account.findFirst({
        where: { id: accountId, userId: req.userId },
    });
    if (!account) {
        return res.status(404).json({ error: "Account not found" });
    }
    const provider = process.env.OPEN_BANKING_PROVIDER || "mock";
    if (provider === "mock") {
        await (0, openBankingService_1.syncMockTransactions)(req.userId, accountId);
    }
    else {
        // Placeholder: real integration with Tink/Plaid-style provider would go here.
    }
    await (0, budgetService_1.refreshTodayBudgetSpent)(req.userId);
    return res.json({ status: "ok" });
});
exports.transactionsRouter = router;
