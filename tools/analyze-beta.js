"use strict";

const fs = require("node:fs");

const BANDS = ["intermediate", "advanced"];
const ROOT_FIELDS = new Set(["schemaVersion", "studyId", "participants"]);
const PARTICIPANT_FIELDS = new Set([
    "code", "band", "day0Comprehension", "daysUsed", "contextUsefulness",
    "difficultyFit", "day21Comprehension", "retentionIntent", "flaggedWordIds"
]);

function plainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function rejectUnknown(value, allowed, label) {
    const unknown = Object.keys(value).find(key => !allowed.has(key));
    if (unknown) throw new TypeError(`${label} has unknown field: ${unknown}`);
}

function scalar(value, min, max, label, { nullable = false, integer = false } = {}) {
    if (nullable && value === null) return;
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
        throw new TypeError(`${label} must be ${integer ? "an integer" : "a number"} from ${min} to ${max}`);
    }
}

function validateStudy(study) {
    if (!plainObject(study)) throw new TypeError("Study must be an object");
    rejectUnknown(study, ROOT_FIELDS, "Study");
    if (study.schemaVersion !== 1) throw new TypeError("schemaVersion must be 1");
    if (typeof study.studyId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$/.test(study.studyId)) throw new TypeError("Invalid studyId");
    if (!Array.isArray(study.participants) || study.participants.length < 12 || study.participants.length > 18) {
        throw new TypeError("participants must contain 12 to 18 enrolled learners");
    }

    const codes = new Set();
    for (const participant of study.participants) {
        if (!plainObject(participant)) throw new TypeError("Participant must be an object");
        rejectUnknown(participant, PARTICIPANT_FIELDS, "Participant");
        if (typeof participant.code !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/.test(participant.code)) throw new TypeError("Invalid participant code");
        if (codes.has(participant.code)) throw new TypeError(`Duplicate participant code: ${participant.code}`);
        codes.add(participant.code);
        if (!BANDS.includes(participant.band)) throw new TypeError(`Invalid learner band: ${participant.band}`);
        scalar(participant.day0Comprehension, 0, 100, "day0Comprehension");
        scalar(participant.daysUsed, 0, 21, "daysUsed", { nullable: true, integer: true });
        scalar(participant.contextUsefulness, 1, 5, "contextUsefulness", { nullable: true, integer: true });
        scalar(participant.difficultyFit, 1, 5, "difficultyFit", { nullable: true, integer: true });
        scalar(participant.day21Comprehension, 0, 100, "day21Comprehension", { nullable: true });
        scalar(participant.retentionIntent, 1, 5, "retentionIntent", { nullable: true, integer: true });
        if (participant.flaggedWordIds !== undefined) {
            if (!Array.isArray(participant.flaggedWordIds)) throw new TypeError("flaggedWordIds must be an array");
            const ids = new Set();
            for (const id of participant.flaggedWordIds) {
                if (!Number.isSafeInteger(id) || id < 1 || ids.has(id)) throw new TypeError("flaggedWordIds must contain unique positive integers");
                ids.add(id);
            }
        }
    }
    return study;
}

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function thresholdGate(participants, field, threshold) {
    if (participants.some(participant => participant[field] === null)) return "insufficient";
    return median(participants.map(participant => participant[field])) >= threshold ? "pass" : "fail";
}

function analyzeStudy(input) {
    const study = validateStudy(input);
    const participants = study.participants;
    const enrolled = participants.length;
    const usageMissing = participants.some(participant => participant.daysUsed === null);
    const consistent = participants.filter(participant => participant.daysUsed !== null && participant.daysUsed >= 12);
    const consistentByBand = Object.fromEntries(BANDS.map(band => [band, consistent.filter(participant => participant.band === band).length]));
    const flagged = new Map();
    for (const participant of participants) {
        for (const id of participant.flaggedWordIds || []) flagged.set(id, (flagged.get(id) || 0) + 1);
    }

    const gates = {
        consistentUsage: usageMissing ? "insufficient" : (consistent.length / enrolled >= 0.5 ? "pass" : "fail"),
        bandCoverage: usageMissing ? "insufficient" : (BANDS.every(band => consistentByBand[band] >= 2) ? "pass" : "fail"),
        contextUsefulness: thresholdGate(participants, "contextUsefulness", 4),
        comprehension: thresholdGate(participants, "day21Comprehension", 70)
    };
    const requiredDay21 = ["daysUsed", "contextUsefulness", "difficultyFit", "day21Comprehension", "retentionIntent"];
    const completeDay21 = participants.every(participant => requiredDay21.every(field => participant[field] !== null));
    const status = !completeDay21 ? "insufficient" : (Object.values(gates).includes("fail") ? "fail" : "pass");

    return {
        studyId: study.studyId,
        status,
        gates,
        metrics: {
            enrolled,
            consistentUsers: consistent.length,
            consistentRate: consistent.length / enrolled,
            consistentByBand,
            medianContextUsefulness: participants.every(p => p.contextUsefulness !== null) ? median(participants.map(p => p.contextUsefulness)) : null,
            medianDifficultyFit: participants.every(p => p.difficultyFit !== null) ? median(participants.map(p => p.difficultyFit)) : null,
            medianDay21Comprehension: participants.every(p => p.day21Comprehension !== null) ? median(participants.map(p => p.day21Comprehension)) : null,
            medianRetentionIntent: participants.every(p => p.retentionIntent !== null) ? median(participants.map(p => p.retentionIntent)) : null,
            flaggedWords: [...flagged.entries()].sort((a, b) => a[0] - b[0]).map(([wordId, count]) => ({ wordId, count }))
        }
    };
}

function display(value) {
    return value === null ? "insufficient" : String(value);
}

function renderMarkdown(result) {
    const metrics = result.metrics;
    const flags = metrics.flaggedWords.length
        ? metrics.flaggedWords.map(item => `- Word ${item.wordId}: ${item.count} flags`).join("\n")
        : "- None";
    return `# Kalimat beta aggregate: ${result.studyId}\n\n` +
        `Status: **${result.status}**\n\n` +
        `## Gates\n\n` +
        `- Consistent usage: ${result.gates.consistentUsage}\n` +
        `- Learner-band coverage: ${result.gates.bandCoverage}\n` +
        `- Context usefulness: ${result.gates.contextUsefulness}\n` +
        `- Day-21 comprehension: ${result.gates.comprehension}\n\n` +
        `## Aggregate metrics\n\n` +
        `- Enrolled: ${metrics.enrolled}\n` +
        `- Consistent users: ${metrics.consistentUsers} (${(metrics.consistentRate * 100).toFixed(1)}%)\n` +
        `- Consistent intermediate/advanced: ${metrics.consistentByBand.intermediate}/${metrics.consistentByBand.advanced}\n` +
        `- Median context usefulness: ${display(metrics.medianContextUsefulness)}\n` +
        `- Median difficulty fit: ${display(metrics.medianDifficultyFit)}\n` +
        `- Median Day-21 comprehension: ${display(metrics.medianDay21Comprehension)}\n` +
        `- Median retention intention: ${display(metrics.medianRetentionIntent)}\n\n` +
        `## Flagged words\n\n${flags}\n`;
}

if (require.main === module) {
    if (process.argv.length !== 3) throw new Error("Usage: node tools/analyze-beta.js <responses.json>");
    const study = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
    process.stdout.write(renderMarkdown(analyzeStudy(study)));
}

module.exports = { analyzeStudy, renderMarkdown, validateStudy };
