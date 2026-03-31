"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = __importDefault(require("pg"));
const env_1 = require("../src/utils/env");
const connectionString = (0, env_1.envValue)({ prod: "DATABASE_URL", dev: "DEV_DATABASE_URL" }) ||
    "postgresql://postgres:postgres@localhost:5432/postgres?schema=public";
const pool = new pg_1.default.Pool({ connectionString });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
const categories = [
    { name: "groceries", displayName: "Groceries", color: "#22c55e" },
    { name: "food", displayName: "Food & Dining", color: "#f97316" },
    { name: "rent", displayName: "Rent", color: "#6366f1" },
    { name: "utilities", displayName: "Utilities", color: "#0ea5e9" },
    { name: "transport", displayName: "Transport", color: "#eab308" },
    { name: "health", displayName: "Health", color: "#ef4444" },
    { name: "gym", displayName: "Gym & Fitness", color: "#10b981" },
    { name: "pets", displayName: "Pets", color: "#f59e0b" },
    { name: "fun", displayName: "Fun", color: "#a855f7" },
    { name: "concerts", displayName: "Concerts", color: "#ec4899" },
    { name: "events", displayName: "Events", color: "#14b8a6" },
    { name: "shopping", displayName: "Shopping", color: "#f43f5e" },
    { name: "subscriptions", displayName: "Subscriptions", color: "#8b5cf6" },
    { name: "travel", displayName: "Travel", color: "#06b6d4" },
    { name: "education", displayName: "Education", color: "#3b82f6" },
    { name: "personal_care", displayName: "Personal Care", color: "#d946ef" },
    { name: "savings", displayName: "Savings", color: "#34d399" },
    { name: "other", displayName: "Other", color: "#64748b" },
];
async function main() {
    console.log("Seeding categories...");
    for (const cat of categories) {
        await prisma.category.upsert({
            where: { name: cat.name },
            update: { displayName: cat.displayName, color: cat.color },
            create: cat,
        });
        console.log(`  ✓ ${cat.displayName}`);
    }
    console.log(`\nDone — ${categories.length} categories seeded.`);
}
main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
