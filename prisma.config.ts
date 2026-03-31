import "dotenv/config";
import { defineConfig } from "prisma/config";

const isProduction = (process.env.NODE_ENV || "development") === "production";

function envValue(prod: string, dev?: string): string | undefined {
  if (!isProduction && dev && process.env[dev]) return process.env[dev];
  return process.env[prod] ?? (dev ? process.env[dev] : undefined);
}

const directUrl =
  envValue("DIRECT_URL", "DEV_DIRECT_URL") ||
  envValue("DB_DIRECT_URL", "DEV_DB_DIRECT_URL") ||
  envValue("DATABASE_URL", "DEV_DATABASE_URL");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: directUrl,
  },
});