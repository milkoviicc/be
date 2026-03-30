import { Router } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { prisma } from "../utils/prismaClient";
import { syncMockTransactions } from "../services/openBankingService";
import { refreshTodayBudgetSpent } from "../services/budgetService";
import { utcMidnightForAppDate } from "../utils/date";

const router = Router();

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
router.get("/", async (req: AuthenticatedRequest, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const transactions = await prisma.transaction.findMany({
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

const createSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  type: z.enum(["expense", "income"]),
  merchant: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  categoryId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});

router.post("/", async (req: AuthenticatedRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const { amount, type, merchant, description, categoryId, date } = parsed.data;

  // Expenses are stored as negative, income as positive
  const signedAmount = type === "expense" ? -Math.abs(amount) : Math.abs(amount);

  // Validate categoryId belongs to the global category list
  if (categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!cat) return res.status(400).json({ error: "Category not found" });
  }

  const [year, month, day] = date.split("-").map(Number);
  const txDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  const transaction = await prisma.transaction.create({
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
  const today = utcMidnightForAppDate();
  const isToday =
    txDate.getUTCFullYear() === today.getUTCFullYear() &&
    txDate.getUTCMonth() === today.getUTCMonth() &&
    txDate.getUTCDate() === today.getUTCDate();

  if (isToday) {
    await refreshTodayBudgetSpent(req.userId);
  }

  return res.status(201).json(transaction);
});

const deleteSchema = z.object({ id: z.string() });

router.delete("/:id", async (req: AuthenticatedRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const { id } = deleteSchema.parse({ id: req.params.id });

  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx || tx.userId !== req.userId) {
    return res.status(404).json({ error: "Transaction not found" });
  }

  await prisma.transaction.delete({ where: { id } });
  await refreshTodayBudgetSpent(req.userId);

  return res.json({ ok: true });
});

const syncSchema = z.object({
  accountId: z.string(),
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
router.post("/sync", async (req: AuthenticatedRequest, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const parseResult = syncSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid payload", details: parseResult.error.flatten() });
  }

  const { accountId } = parseResult.data;

  const account = await prisma.account.findFirst({
    where: { id: accountId, userId: req.userId },
  });
  if (!account) {
    return res.status(404).json({ error: "Account not found" });
  }

  const provider = process.env.OPEN_BANKING_PROVIDER || "mock";

  if (provider === "mock") {
    await syncMockTransactions(req.userId, accountId);
  } else {
    // Placeholder: real integration with Tink/Plaid-style provider would go here.
  }

  await refreshTodayBudgetSpent(req.userId);

  return res.json({ status: "ok" });
});

export const transactionsRouter = router;

