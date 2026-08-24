"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeStudy, renderMarkdown, validateStudy } = require("../tools/analyze-beta.js");
const { summarizeExport } = require("../tools/summarize-beta-export.js");

function participant(index, overrides = {}) {
    return {
        code: `P${String(index).padStart(2, "0")}`,
        band: ["intermediate", "advanced"][(index - 1) % 2],
        day0Comprehension: 55,
        daysUsed: 14,
        contextUsefulness: 4,
        difficultyFit: 4,
        day21Comprehension: 75,
        retentionIntent: 4,
        flaggedWordIds: [],
        ...overrides
    };
}

test("a complete qualifying cohort passes every beta gate", () => {
    const study = { schemaVersion: 1, studyId: "baseline-2026-08", participants: Array.from({ length: 12 }, (_, i) => participant(i + 1)) };
    const result = analyzeStudy(study);
    assert.equal(result.status, "pass");
    assert.deepEqual(result.gates, {
        consistentUsage: "pass",
        bandCoverage: "pass",
        contextUsefulness: "pass",
        comprehension: "pass"
    });
    assert.equal(result.metrics.consistentUsers, 12);
    assert.equal(result.metrics.medianContextUsefulness, 4);
    assert.equal(result.metrics.medianDay21Comprehension, 75);
});

test("complete data below a threshold fails", () => {
    const participants = Array.from({ length: 12 }, (_, i) => participant(i + 1, {
        daysUsed: i < 5 ? 12 : 11,
        contextUsefulness: 3,
        day21Comprehension: 65
    }));
    const result = analyzeStudy({ schemaVersion: 1, studyId: "low-signal", participants });
    assert.equal(result.status, "fail");
    assert.equal(result.gates.consistentUsage, "fail");
    assert.equal(result.gates.contextUsefulness, "fail");
    assert.equal(result.gates.comprehension, "fail");
});

test("missing required Day-21 data is insufficient, never a pass", () => {
    const participants = Array.from({ length: 12 }, (_, i) => participant(i + 1));
    participants[0].day21Comprehension = null;
    const result = analyzeStudy({ schemaVersion: 1, studyId: "incomplete", participants });
    assert.equal(result.status, "insufficient");
    assert.equal(result.gates.comprehension, "insufficient");
});

test("validation rejects unknown fields, duplicate codes, and out-of-range scalars", () => {
    const participants = Array.from({ length: 12 }, (_, i) => participant(i + 1));
    participants[0].notes = "raw response must not enter the aggregate";
    assert.throws(() => validateStudy({ schemaVersion: 1, studyId: "bad", participants }), /unknown field/i);
    delete participants[0].notes;
    participants[1].code = participants[0].code;
    assert.throws(() => validateStudy({ schemaVersion: 1, studyId: "bad", participants }), /duplicate participant code/i);
    participants[1].code = "P02";
    participants[0].contextUsefulness = 6;
    assert.throws(() => validateStudy({ schemaVersion: 1, studyId: "bad", participants }), /contextUsefulness/);
    participants[0].contextUsefulness = 4.5;
    assert.throws(() => validateStudy({ schemaVersion: 1, studyId: "bad", participants }), /contextUsefulness/);
});

test("aggregate Markdown is deterministic and excludes participant codes", () => {
    const participants = Array.from({ length: 12 }, (_, i) => participant(i + 1, { flaggedWordIds: i < 2 ? [17] : [] }));
    const result = analyzeStudy({ schemaVersion: 1, studyId: "privacy-check", participants });
    const first = renderMarkdown(result);
    const second = renderMarkdown(result);
    assert.equal(first, second);
    assert.doesNotMatch(first, /P01|P02/);
    assert.match(first, /Word 17: 2 flags/);
});

test("local export summarizer returns scalars for website and extension backups", () => {
    assert.deepEqual(summarizeExport({
        history: {
            1: { firstSeen: "2026-07-31" },
            2: { firstSeen: "2026-08-01" },
            3: { firstSeen: "2026-08-03" }
        },
        srs: { 1: { history: [{ date: "2026-08-20" }, { date: "2026-08-22" }] } }
    }, { startDate: "2026-08-01", endDate: "2026-08-21" }), {
        daysUsed: 3
    });

    assert.deepEqual(summarizeExport({
        assignments: {
            "2026-08-01": { wordId: 7 },
            "2026-08-02": { wordId: 8 },
            "2026-08-05": { wordId: 9 }
        },
        srs: { 8: { lastReviewedDate: "2026-08-23", history: [{ date: "2026-08-21" }] } }
    }, { startDate: "2026-08-02", endDate: "2026-08-22" }), {
        daysUsed: 3
    });
    assert.throws(() => summarizeExport({ history: {} }), /study start and end dates/);
    assert.throws(() => summarizeExport({ history: {} }, { startDate: "2026-02-30", endDate: "2026-03-22" }), /valid calendar dates/);
    assert.throws(() => summarizeExport({ history: {} }, { startDate: "2026-08-01", endDate: "2026-08-20" }), /21 inclusive days/);
});
