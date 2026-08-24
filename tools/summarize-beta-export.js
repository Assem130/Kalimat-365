"use strict";

const fs = require("node:fs");

const DATE_KEY = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

function plainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function dateOrdinal(value) {
    if (!DATE_KEY.test(value || "")) return null;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return Math.floor(date.getTime() / 86400000);
}

function summarizeExport(input, { startDate, endDate } = {}) {
    if (!plainObject(input)) throw new TypeError("Kalimat export must be an object");
    if (typeof startDate !== "string" || typeof endDate !== "string") throw new TypeError("Valid inclusive study start and end dates are required");
    const start = dateOrdinal(startDate);
    const end = dateOrdinal(endDate);
    if (start === null || end === null) throw new TypeError("Study window must use valid calendar dates");
    if (end - start !== 20) throw new TypeError("Study window must span exactly 21 inclusive days");
    let dates = [];
    if (plainObject(input.assignments)) {
        dates.push(...Object.keys(input.assignments));
    } else if (plainObject(input.history)) {
        const records = Object.values(input.history);
        dates.push(...records.map(record => plainObject(record) ? record.firstSeen : null));
    } else {
        throw new TypeError("Unrecognized Kalimat export");
    }
    if (plainObject(input.srs)) {
        for (const item of Object.values(input.srs)) {
            if (!plainObject(item)) continue;
            if (item.lastReviewedDate !== null && item.lastReviewedDate !== undefined) dates.push(item.lastReviewedDate);
            if (Array.isArray(item.history)) dates.push(...item.history.map(entry => plainObject(entry) ? entry.date : null));
        }
    }
    if (dates.some(date => typeof date !== "string" || !DATE_KEY.test(date))) throw new TypeError("Kalimat export contains an invalid date");
    const uniqueDates = [...new Set(dates)].filter(date => date >= startDate && date <= endDate).sort();
    return { daysUsed: uniqueDates.length };
}

if (require.main === module) {
    if (process.argv.length !== 5) throw new Error("Usage: node tools/summarize-beta-export.js <kalimat-export.json> <study-start> <study-end>");
    const input = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
    process.stdout.write(`${JSON.stringify(summarizeExport(input, { startDate: process.argv[3], endDate: process.argv[4] }), null, 2)}\n`);
}

module.exports = { summarizeExport };
