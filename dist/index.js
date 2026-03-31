"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const auth_1 = require("./routes/auth");
const transactions_1 = require("./routes/transactions");
const goals_1 = require("./routes/goals");
const dailyBudget_1 = require("./routes/dailyBudget");
const categories_1 = require("./routes/categories");
const accounts_1 = require("./routes/accounts");
const notifications_1 = require("./routes/notifications");
const authMiddleware_1 = require("./middleware/authMiddleware");
const csrfMiddleware_1 = require("./middleware/csrfMiddleware");
const swagger_1 = require("./docs/swagger");
const app = (0, express_1.default)();
const PORT = process.env.APP_PORT ? Number(process.env.APP_PORT) : 4000;
const ORIGIN = process.env.DEV_APP_ORIGIN || "http://localhost:3000";
const ORIGINS = ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
app.use((0, cors_1.default)({
    origin: ORIGINS.length <= 1 ? ORIGINS[0] : ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
}));
app.use((req, res, next) => {
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
    res.setHeader("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'; base-uri 'self'");
    next();
});
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
// Swagger UI
app.use("/docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec));
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
app.use("/auth", auth_1.authRouter);
// Protected routes
app.use("/transactions", authMiddleware_1.authMiddleware, csrfMiddleware_1.csrfMiddleware, transactions_1.transactionsRouter);
app.use("/goals", authMiddleware_1.authMiddleware, csrfMiddleware_1.csrfMiddleware, goals_1.goalsRouter);
app.use("/daily-budget", authMiddleware_1.authMiddleware, csrfMiddleware_1.csrfMiddleware, dailyBudget_1.dailyBudgetRouter);
app.use("/categories", authMiddleware_1.authMiddleware, csrfMiddleware_1.csrfMiddleware, categories_1.categoriesRouter);
app.use("/accounts", authMiddleware_1.authMiddleware, csrfMiddleware_1.csrfMiddleware, accounts_1.accountsRouter);
app.use("/notifications", authMiddleware_1.authMiddleware, csrfMiddleware_1.csrfMiddleware, notifications_1.notificationsRouter);
app.use(
// eslint-disable-next-line @typescript-eslint/no-unused-vars
(err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
});
app.listen(PORT, () => {
    console.log(`SmartSave backend listening on http://localhost:${PORT}`);
});
