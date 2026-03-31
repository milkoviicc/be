import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { envValue } from "./env";

const databaseUrl =
  envValue({ prod: "DATABASE_URL", dev: "DEV_DATABASE_URL" }) ||
  "postgresql://postgres:postgres@localhost:5432/postgres?schema=public";

const pool = new pg.Pool({
  connectionString: databaseUrl,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });

