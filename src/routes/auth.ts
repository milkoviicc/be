import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "../utils/prismaClient";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";
import { csrfMiddleware } from "../middleware/csrfMiddleware";
import { rateLimitAuth } from "../middleware/rateLimitMiddleware";
import { processSalaryIfDue } from "../services/salaryService";
import { clearAuthCookies, generateCsrfToken } from "../utils/auth";
import { issueSessionCookies, revokeCurrentSession } from "../services/sessionService";
import { logAuthEvent } from "../services/auditService";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(3),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  monthlyNetIncome: z.number().nonnegative().optional(),
  monthlyHousingCost: z.number().nonnegative().optional(),
  monthlyUtilitiesCost: z.number().nonnegative().optional(),
  monthlyOtherFixedCosts: z.number().nonnegative().optional(),
});

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(8),
});

const GITHUB_CLIENT_ID     = process.env.GITHUB_CLIENT_ID || "";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";
const GITHUB_REDIRECT_URI  = process.env.GITHUB_REDIRECT_URI || "http://localhost:4000/auth/github/callback";
const FRONTEND_URL         = process.env.FRONTEND_URL || "http://localhost:3000";


function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, username, firstName, lastName]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               username:
 *                 type: string
 *                 minLength: 3
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Invalid payload
 *       409:
 *         description: Email already registered or username already taken
 */
router.post("/register", rateLimitAuth(8, 15 * 60 * 1000, "auth-register"), async (req, res) => {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    await logAuthEvent({ req, eventType: "auth.register.invalid_payload", success: false });
    return res.status(400).json({ error: "Invalid payload", details: parseResult.error.flatten() });
  }

  const { email, password, username, firstName, lastName, monthlyNetIncome, monthlyHousingCost, monthlyUtilitiesCost, monthlyOtherFixedCosts } =
    parseResult.data;

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    await logAuthEvent({ req, eventType: "auth.register.email_exists", success: false, email });
    return res.status(409).json({ error: "Email already registered" });
  }

  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) {
    await logAuthEvent({ req, eventType: "auth.register.username_exists", success: false, email });
    return res.status(409).json({ error: "Username already taken" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      username,
      firstName: capitalize(firstName),
      lastName:  capitalize(lastName),
      monthlyNetIncome,
      monthlyHousingCost,
      monthlyUtilitiesCost,
      monthlyOtherFixedCosts,
    },
  });

  const accessToken = await issueSessionCookies(res, req, user.id);
  const csrfToken = generateCsrfToken(user.id);
  await logAuthEvent({ req, eventType: "auth.register.success", success: true, userId: user.id, email: user.email });
  return res.status(201).json({
    accessToken,
    csrfToken,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  });
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with email or username and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier, password]
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Email address or username
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Logged in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Invalid payload
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", rateLimitAuth(10, 15 * 60 * 1000, "auth-login"), async (req, res) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    await logAuthEvent({ req, eventType: "auth.login.invalid_payload", success: false });
    return res.status(400).json({ error: "Invalid payload", details: parseResult.error.flatten() });
  }

  const { identifier, password } = parseResult.data;

  const isEmail = identifier.includes("@");
  const user = isEmail
    ? await prisma.user.findUnique({ where: { email: identifier } })
    : await prisma.user.findUnique({ where: { username: identifier } });

  if (!user || !user.passwordHash) {
    await logAuthEvent({ req, eventType: "auth.login.user_not_found", success: false, email: identifier });
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await logAuthEvent({ req, eventType: "auth.login.invalid_password", success: false, userId: user.id, email: user.email });
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const accessToken = await issueSessionCookies(res, req, user.id);
  const csrfToken = generateCsrfToken(user.id);
  await logAuthEvent({ req, eventType: "auth.login.success", success: true, userId: user.id, email: user.email });
  return res.json({
    accessToken,
    csrfToken,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      currentBalance: user.currentBalance,
      currency: user.currency,
    },
  });
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user's full profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Unauthorized
 */
router.get("/me", authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Credit salary automatically if today is the configured salary day
  await processSalaryIfDue(req.userId).catch(() => {}); // non-blocking, never fail the request

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      currentBalance: true,
      monthlyNetIncome: true,
      monthlyHousingCost: true,
      monthlyUtilitiesCost: true,
      monthlyOtherFixedCosts: true,
      currency: true,
      salaryDay: true,
      lastSalaryDate: true,
      currentStreakDays: true,
      bestStreakDays: true,
      lastStreakDate: true,
    },
  });

  if (!user) return res.status(404).json({ error: "User not found" });

  const csrfToken = generateCsrfToken(req.userId!);

  return res.json({ ...user, csrfToken });
});

/**
 * @swagger
 * /auth/me:
 *   patch:
 *     summary: Update current user's profile and financial settings
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               currentBalance:
 *                 type: number
 *                 description: Current spendable account balance (not savings)
 *               monthlyNetIncome:
 *                 type: number
 *               monthlyHousingCost:
 *                 type: number
 *               monthlyUtilitiesCost:
 *                 type: number
 *               monthlyOtherFixedCosts:
 *                 type: number
 *     responses:
 *       200:
 *         description: Updated user profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 *       400:
 *         description: Invalid payload
 *       401:
 *         description: Unauthorized
 */
router.patch("/me", authMiddleware, csrfMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const SUPPORTED_CURRENCIES = ["EUR","USD","GBP","CHF","HRK","SEK","NOK","DKK","PLN","CZK","HUF"] as const;

  const schema = z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    currentBalance: z.number().min(0).optional(),
    monthlyNetIncome: z.number().nonnegative().optional(),
    monthlyHousingCost: z.number().nonnegative().optional(),
    monthlyUtilitiesCost: z.number().nonnegative().optional(),
    monthlyOtherFixedCosts: z.number().nonnegative().optional(),
    currency: z.enum(SUPPORTED_CURRENCIES).optional(),
    salaryDay: z.number().int().min(1).max(28).nullable().optional(),
  });

  const parseResult = schema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid payload", details: parseResult.error.flatten() });
  }

  const { currentBalance, firstName, lastName, currency, salaryDay, ...rest } = parseResult.data;

  const updated = await prisma.user.update({
    where: { id: req.userId },
    data: {
      ...rest,
      ...(firstName  !== undefined && { firstName:  capitalize(firstName) }),
      ...(lastName   !== undefined && { lastName:   capitalize(lastName)  }),
      ...(currentBalance !== undefined && { currentBalance: currentBalance.toString() }),
      ...(currency   !== undefined && { currency }),
      ...(salaryDay  !== undefined && { salaryDay }),
    },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      currentBalance: true,
      monthlyNetIncome: true,
      monthlyHousingCost: true,
      monthlyUtilitiesCost: true,
      monthlyOtherFixedCosts: true,
      currency: true,
      salaryDay: true,
      lastSalaryDate: true,
    },
  });

  return res.json(updated);
});

router.post("/logout", csrfMiddleware, async (req: AuthenticatedRequest, res) => {
  await revokeCurrentSession(req, res);
  clearAuthCookies(res);
  await logAuthEvent({ req, eventType: "auth.logout", success: true, userId: req.userId ?? null });
  return res.json({ ok: true });
});

/**
 * @swagger
 * /auth/github:
 *   get:
 *     summary: Redirect to GitHub OAuth consent screen
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: Redirects to GitHub
 */
router.get("/github", (_req, res) => {
  if (!GITHUB_CLIENT_ID) {
    return res.status(501).json({ error: "GitHub OAuth not configured" });
  }
  const params = new URLSearchParams({
    client_id:    GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_REDIRECT_URI,
    scope:        "user:email",
  });
  return res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

/**
 * @swagger
 * /auth/github/callback:
 *   get:
 *     summary: GitHub OAuth callback — exchanges code for JWT and redirects to frontend
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema: { type: string }
 *     responses:
 *       302:
 *         description: Redirects to frontend with token
 */
router.get("/github/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept":        "application/json",
      },
      body: JSON.stringify({
        client_id:     GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri:  GITHUB_REDIRECT_URI,
      }),
    });
    if (!tokenRes.ok) {
      return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
    }
    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
    }

    const ghHeaders = {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept:        "application/vnd.github+json",
    };

    // Get GitHub user profile
    const userRes = await fetch("https://api.github.com/user", { headers: ghHeaders });
    if (!userRes.ok) {
      return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
    }
    const ghUser = await userRes.json() as {
      id: number;
      login: string;
      name?: string;
      email?: string | null;
    };

    // Email may be private — fetch from /user/emails if needed
    let email = ghUser.email ?? null;
    if (!email) {
      const emailRes = await fetch("https://api.github.com/user/emails", { headers: ghHeaders });
      if (emailRes.ok) {
        const emails = await emailRes.json() as { email: string; primary: boolean; verified: boolean }[];
        email = emails.find((e) => e.primary && e.verified)?.email
          ?? emails.find((e) => e.verified)?.email
          ?? null;
      }
    }
    if (!email) {
      return res.redirect(`${FRONTEND_URL}/login?error=oauth_no_email`);
    }

    // Split name into first / last (GitHub name is a single string)
    const [firstName = ghUser.login, lastName = ""] = (ghUser.name ?? ghUser.login).split(" ");

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const base = ghUser.login.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
      let username = base;
      let attempt = 0;
      while (await prisma.user.findUnique({ where: { username } })) {
        attempt++;
        username = `${base}${attempt}`;
      }
      user = await prisma.user.create({
        data: { email, username, firstName: capitalize(firstName), lastName: capitalize(lastName), passwordHash: null },
      });
    }

    // Upsert OAuthAccount
    await prisma.oAuthAccount.upsert({
      where: { provider_providerAccountId: { provider: "github", providerAccountId: String(ghUser.id) } },
      create: {
        userId:            user.id,
        provider:          "github",
        providerAccountId: String(ghUser.id),
        accessToken:       tokenData.access_token,
      },
      update: { accessToken: tokenData.access_token },
    });

    await issueSessionCookies(res, req, user.id);
    await logAuthEvent({ req, eventType: "auth.oauth.github.success", success: true, userId: user.id, email: user.email });
    return res.redirect(`${FRONTEND_URL}/auth/callback`);
  } catch (err) {
    await logAuthEvent({ req, eventType: "auth.oauth.github.failed", success: false });
    console.error("GitHub OAuth error:", err);
    return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
  }
});

export const authRouter = router;

