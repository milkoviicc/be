"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.utcMidnightForAppDate = utcMidnightForAppDate;
exports.appTimeZone = appTimeZone;
const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Europe/Zagreb";
function getZonedDateParts(date, timeZone = APP_TIME_ZONE) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const parts = formatter.formatToParts(date);
    const year = Number(parts.find((p) => p.type === "year")?.value);
    const month = Number(parts.find((p) => p.type === "month")?.value);
    const day = Number(parts.find((p) => p.type === "day")?.value);
    if (!year || !month || !day) {
        throw new Error(`Unable to resolve calendar date in timezone: ${timeZone}`);
    }
    return { year, month, day };
}
/**
 * Returns a UTC timestamp anchored to 00:00:00Z for the calendar day
 * in the configured app timezone. This keeps day/month/year stable
 * while still storing DateTime values in UTC.
 */
function utcMidnightForAppDate(date = new Date()) {
    const { year, month, day } = getZonedDateParts(date, APP_TIME_ZONE);
    return new Date(Date.UTC(year, month - 1, day));
}
function appTimeZone() {
    return APP_TIME_ZONE;
}
