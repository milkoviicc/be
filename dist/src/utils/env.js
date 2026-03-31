"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProduction = void 0;
exports.envValue = envValue;
const NODE_ENV = process.env.NODE_ENV || "development";
exports.isProduction = NODE_ENV === "production";
function envValue({ prod, dev, fallback }) {
    if (!exports.isProduction && dev && process.env[dev])
        return process.env[dev];
    return process.env[prod] ?? (dev ? process.env[dev] : undefined) ?? fallback;
}
