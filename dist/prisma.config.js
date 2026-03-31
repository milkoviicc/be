"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const config_1 = require("prisma/config");
const isProduction = (process.env.NODE_ENV || "development") === "production";
function envValue(prod, dev) {
    if (!isProduction && dev && process.env[dev])
        return process.env[dev];
    return process.env[prod] ?? (dev ? process.env[dev] : undefined);
}
const directUrl = envValue("DIRECT_URL", "DEV_DIRECT_URL") ||
    envValue("DB_DIRECT_URL", "DEV_DB_DIRECT_URL") ||
    envValue("DATABASE_URL", "DEV_DATABASE_URL");
exports.default = (0, config_1.defineConfig)({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
    },
    datasource: {
        url: directUrl,
    },
});
