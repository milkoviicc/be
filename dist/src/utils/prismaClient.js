"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const default_1 = require(".prisma/client/default");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = __importDefault(require("pg"));
const env_1 = require("./env");
const databaseUrl = (0, env_1.envValue)({ prod: "DATABASE_URL", dev: "DEV_DATABASE_URL" }) ||
    "postgresql://postgres:postgres@localhost:5432/postgres?schema=public";
const pool = new pg_1.default.Pool({
    connectionString: databaseUrl,
});
const adapter = new adapter_pg_1.PrismaPg(pool);
exports.prisma = new default_1.PrismaClient({ adapter });
