import { Router } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { prisma } from "../utils/prismaClient";
import { syncMockTransactions } from "../services/openBankingService";
import { refreshTodayBudgetSpent } from "../services/budgetService";

const router = Router();

/**
 * @swagger
 * /accounts:
 *   get:
 *     summary: List connected bank accounts
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of accounts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Account'
 *       401:
 *         description: Unauthorized
 */
router.get("/", async (req: AuthenticatedRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const accounts = await prisma.account.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { transactions: true } },
    },
  });

  return res.json(accounts);
});

const createSchema = z.object({
  name: z.string().min(1),
  institutionName: z.string().min(1),
  currency: z.string().default("EUR"),
});

/**
 * @swagger
 * /accounts:
 *   post:
 *     summary: Connect a new (mock) bank account
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, institutionName]
 *             properties:
 *               name:
 *                 type: string
 *               institutionName:
 *                 type: string
 *               currency:
 *                 type: string
 *                 default: EUR
 *     responses:
 *       201:
 *         description: Account connected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Account'
 *       400:
 *         description: Invalid payload
 *       401:
 *         description: Unauthorized
 */
router.post("/", async (req: AuthenticatedRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const parseResult = createSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid payload", details: parseResult.error.flatten() });
  }

  const { name, institutionName, currency } = parseResult.data;

  const account = await prisma.account.create({
    data: {
      userId: req.userId,
      provider: "mock",
      providerAccountId: `mock_${req.userId}_${Date.now()}`,
      name,
      institutionName,
      currency,
    },
    include: {
      _count: { select: { transactions: true } },
    },
  });

  return res.status(201).json(account);
});

/**
 * @swagger
 * /accounts/{id}/sync:
 *   post:
 *     summary: Sync transactions for a connected account
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Account with updated transaction count
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Account'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Account not found
 */
router.post("/:id/sync", async (req: AuthenticatedRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const account = await prisma.account.findFirst({
    where: { id: req.params.id as string, userId: req.userId },
  });
  if (!account) return res.status(404).json({ error: "Account not found" });

  const provider = process.env.OPEN_BANKING_PROVIDER || "mock";
  if (provider === "mock") {
    await syncMockTransactions(req.userId, account.id);
  }

  await refreshTodayBudgetSpent(req.userId);

  const updated = await prisma.account.findUnique({
    where: { id: account.id },
    include: { _count: { select: { transactions: true } } },
  });

  return res.json(updated);
});

/**
 * @swagger
 * /accounts/{id}:
 *   delete:
 *     summary: Disconnect (delete) a bank account
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Account disconnected
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Account not found
 */
router.delete("/:id", async (req: AuthenticatedRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const account = await prisma.account.findFirst({
    where: { id: req.params.id as string, userId: req.userId },
  });
  if (!account) return res.status(404).json({ error: "Account not found" });

  await prisma.account.delete({ where: { id: account.id } });

  return res.json({ status: "ok" });
});

export const accountsRouter = router;
