import "dotenv/config";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import cookieParser from "cookie-parser";

import { authRouter } from "./routes/auth";
import { transactionsRouter } from "./routes/transactions";
import { goalsRouter } from "./routes/goals";
import { dailyBudgetRouter } from "./routes/dailyBudget";
import { categoriesRouter } from "./routes/categories";
import { accountsRouter } from "./routes/accounts";
import { notificationsRouter } from "./routes/notifications";
import { authMiddleware } from "./middleware/authMiddleware";
import { csrfMiddleware } from "./middleware/csrfMiddleware";
import { swaggerSpec } from "./docs/swagger";

const app = express();

const PORT = process.env.APP_PORT ? Number(process.env.APP_PORT) : 4000;
const ORIGIN = process.env.APP_ORIGIN || "http://localhost:3000";
const ORIGINS = ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);

app.use(
  cors({
    origin: ORIGINS.length <= 1 ? ORIGINS[0] : ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  })
);

app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  res.setHeader("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'; base-uri 'self'");
  next();
});

app.use(cookieParser());
app.use(express.json());

// Swagger UI
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is healthy
 */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "smartsave-backend" });
});

// Public auth routes
app.use("/auth", authRouter);

// Protected routes
app.use("/transactions", authMiddleware, csrfMiddleware, transactionsRouter);
app.use("/goals", authMiddleware, csrfMiddleware, goalsRouter);
app.use("/daily-budget", authMiddleware, csrfMiddleware, dailyBudgetRouter);
app.use("/categories", authMiddleware, csrfMiddleware, categoriesRouter);
app.use("/accounts", authMiddleware, csrfMiddleware, accountsRouter);
app.use("/notifications", authMiddleware, csrfMiddleware, notificationsRouter);

app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
);

app.listen(PORT, () => {
  console.log(`SmartSave backend listening on http://localhost:${PORT}`);
});

