const test = require("node:test");
const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const childProcess = require("node:child_process");

globalThis.crypto ??= webcrypto;

const { createProfile } = require("../shared/state.js");
const { getLocalDateKey } = require("../shared/date.js");
const { selectDaily, sha256Hex, rankCandidates } = require("../shared/selector.js");

const seedHex = "a".repeat(32);
const dateKey = "2026-07-30";

function word(id, overrides = {}) {
  return {
    id,
    difficultyBand: "beginner",
    usefulnessBand: "medium",
    topics: ["language"],
    partOfSpeech: "noun",
    register: "standard",
    reviewed: true,
    ...overrides,
  };
}

function profile(overrides = {}) {
  const base = createProfile({ seedHex, level: 1, interests: ["language"] });
  const assignments = { ...base.assignments, ...overrides.assignments };
  return {
    ...base,
    ...overrides,
    assignments,
    assignmentOrdinal: overrides.assignmentOrdinal ?? Object.keys(assignments).length,
    wordStates: { ...base.wordStates, ...overrides.wordStates },
    recentIds: overrides.recentIds ?? base.recentIds,
  };
}

async function selected(vocabulary, profileValue = profile(), date = dateKey) {
  return selectDaily({ vocabulary, profile: profileValue, dateKey: date });
}

test("same inputs select the same word regardless of corpus order", async () => {
  const vocabulary = [word("w1"), word("w2"), word("w3")];
  const a = await selected(vocabulary);
  const b = await selected([...vocabulary].reverse());
  assert.deepEqual(a, b);
});

test("all-known corpus terminates explicitly", async () => {
  const vocabulary = [word("w1"), word("w2")];
  const allKnownProfile = profile({
    wordStates: {
      w1: { status: "known", dateKey },
      w2: { status: "known", dateKey },
    },
  });
  assert.deepEqual(await selected(vocabulary, allKnownProfile), { kind: "no-new-word" });
});

test("existing local dates survive timezone travel, DST, leap day, forward jumps, and rollback", async () => {
  const vocabulary = [word("w1"), word("w2")];
  const zoneDate = (zone, instant = "2026-07-30T00:30:00Z") => childProcess.execFileSync(process.execPath, ["-e", `process.stdout.write(require('./extension/shared/date.js').getLocalDateKey(new Date('${instant}')))`], { cwd: require("node:path").join(__dirname, "..", ".."), env: { ...process.env, TZ: zone } }).toString();
  const losAngeles = zoneDate("America/Los_Angeles");
  const tokyo = zoneDate("Asia/Tokyo");
  assert.equal(losAngeles, "2026-07-29");
  assert.equal(tokyo, "2026-07-30");
  assert.equal(zoneDate("Europe/Berlin", "2026-03-29T00:30:00Z"), "2026-03-29");
  assert.equal(zoneDate("Europe/Berlin", "2026-03-29T01:30:00Z"), "2026-03-29");
  assert.equal(zoneDate("Europe/Berlin", "2024-02-29T12:00:00Z"), "2024-02-29");
  const fixed = profile({ assignments: { "2024-02-29": { wordId: "w2" }, "2026-11-01": { wordId: "w1" }, [losAngeles]: { wordId: "w1" }, [tokyo]: { wordId: "w2" }, "2026-08-15": { wordId: "w2" } } });
  assert.deepEqual(await selected(vocabulary, fixed, "2024-02-29"), { kind: "assigned", wordId: "w2" });
  assert.deepEqual(await selected(vocabulary, fixed, "2026-11-01"), { kind: "assigned", wordId: "w1" });
  assert.deepEqual(await selected(vocabulary, fixed, losAngeles), { kind: "assigned", wordId: "w1" });
  assert.deepEqual(await selected(vocabulary, fixed, tokyo), { kind: "assigned", wordId: "w2" });
  assert.deepEqual(await selected(vocabulary, fixed, getLocalDateKey(new Date(2026, 7, 15))), { kind: "assigned", wordId: "w2" });
  assert.equal((await selected(vocabulary, fixed, "2026-07-30")).kind, "assigned");
});

test("forward clock jumps and rollback keep the original local-day assignment", async () => {
  const vocabulary = [word("w1"), word("w2")];
  const originalDate = getLocalDateKey(new Date(2026, 6, 30));
  const jumpedDate = getLocalDateKey(new Date(2026, 7, 15));
  const original = profile({ assignments: { [originalDate]: { wordId: "w1" } } });
  const afterJump = await selected(vocabulary, original, jumpedDate);
  assert.equal(afterJump.kind, "assigned");
  const persistedJump = { ...original, assignments: { ...original.assignments, [jumpedDate]: { wordId: afterJump.wordId } } };
  assert.deepEqual(await selected(vocabulary, persistedJump, originalDate), { kind: "assigned", wordId: "w1" });
});

test("level 4 selection remains deterministic across corpus order", async () => {
  const vocabulary = [word("beginner"), word("advanced", { difficultyBand: "advanced" })];
  const a = await selected(vocabulary, profile({ level: 4 }));
  const b = await selected([...vocabulary].reverse(), profile({ level: 4 }));
  assert.deepEqual(a, b);
});

test("cooldown is min(14, floor(eligible / 3)) and relaxes only after all bands are exhausted", async () => {
  const vocabulary = [word("recent"), word("other-a"), word("other-b")];
  const result = await selected(vocabulary, profile({ recentIds: ["recent", "other-a", "other-b"] }));
  assert.equal(result.kind, "assigned");

  const wideVocabulary = [word("recent"), word("advanced", { difficultyBand: "advanced" }), word("another", { difficultyBand: "advanced" })];
  const wideResult = await selected(wideVocabulary, profile({ recentIds: ["recent"] }));
  assert.notEqual(wideResult.wordId, "recent");

  const digest = async (value) => value.endsWith("\u001frecent-2") ? "0".repeat(64) : "f".repeat(64);
  const floorVocabulary = [word("recent-1"), word("recent-2"), word("available"), ...Array.from({ length: 5 }, (_, index) => word(`advanced-${index}`, { difficultyBand: "advanced" }))];
  const floorResult = await selectDaily({ vocabulary: floorVocabulary, profile: profile({ recentIds: ["recent-1", "recent-2"] }), dateKey, digestHex: digest });
  assert.ok(!["recent-1", "recent-2"].includes(floorResult.wordId));

  const cappedVocabulary = [...Array.from({ length: 15 }, (_, index) => word(`recent-${index}`)), ...Array.from({ length: 30 }, (_, index) => word(`advanced-cap-${index}`, { difficultyBand: "advanced" }))];
  const capResult = await selectDaily({ vocabulary: cappedVocabulary, profile: profile({ recentIds: Array.from({ length: 15 }, (_, index) => `recent-${index}`) }), dateKey, digestHex: digest });
  assert.ok(!Array.from({ length: 14 }, (_, index) => `recent-${index}`).includes(capResult.wordId));
});

test("skips known, unreviewed, and malformed candidates", async () => {
  const result = await selected([
    word("known"),
    word("unreviewed", { reviewed: false }),
    { id: "broken", reviewed: true },
    word("usable"),
  ], profile({ wordStates: { known: { status: "known", dateKey } } }));
  assert.deepEqual(result, { kind: "assigned", wordId: "usable" });
});

test("diversifies root, topic, register, and part of speech across eligible bands", async () => {
  const vocabulary = [
    word("recent", { root: "k-t-b", topics: ["travel"], register: "classical", partOfSpeech: "verb" }),
    word("same", { root: "k-t-b", topics: ["travel"], register: "classical", partOfSpeech: "verb", usefulnessBand: "high" }),
    word("varied", { root: "q-r-a", topics: ["food"], register: "colloquial", partOfSpeech: "adjective", usefulnessBand: "low" }),
  ];
  const result = await selected(vocabulary, profile({ interests: [], recentIds: ["recent"] }));
  assert.deepEqual(result, { kind: "assigned", wordId: "varied" });
});

test("known recent words still diversify the next assignment", async () => {
  const vocabulary = [word("known", { root: "k-t-b", topics: ["travel"], register: "classical", partOfSpeech: "verb" }), word("same", { root: "k-t-b", topics: ["travel"], register: "classical", partOfSpeech: "verb", usefulnessBand: "high" }), word("varied", { root: "q-r-a", topics: ["food"], register: "colloquial", partOfSpeech: "adjective" })];
  assert.deepEqual(await selected(vocabulary, profile({ interests: [], recentIds: ["known"], wordStates: { known: { status: "known", dateKey } } })), { kind: "assigned", wordId: "varied" });
});

test("every seventh new assignment broadens beyond optional interests", async () => {
  const vocabulary = [word("interest", { topics: ["language"] }), word("outside", { topics: ["food"] }), word("prior")];
  const assignments = Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`2026-07-${String(index + 1).padStart(2, "0")}`, { wordId: "prior" }]));
  const equallyUnseen = { assignments, wordStates: { prior: { status: "known", dateKey: "2026-07-06" } } };
  assert.deepEqual(await selected(vocabulary, profile({ ...equallyUnseen, assignmentOrdinal: 7 })), { kind: "assigned", wordId: "interest" });
  assert.deepEqual(await selected(vocabulary, profile({ ...equallyUnseen, assignmentOrdinal: 6 })), { kind: "assigned", wordId: "outside" });
});

test("lifetime assignment ordinal keeps every-seventh broadening after assignment pruning", async () => {
  const vocabulary = [word("interest", { topics: ["language"] }), word("outside", { topics: ["food"] }), word("prior")];
  const assignments = Object.fromEntries(Array.from({ length: 5000 }, (_, index) => [new Date(Date.UTC(2000, 0, index + 1)).toISOString().slice(0, 10), { wordId: "prior" }]));
  const pruned = { assignments, wordStates: { prior: { status: "known", dateKey: "2026-01-28" } } };
  assert.equal(Object.keys(assignments).length, 5000);
  assert.deepEqual(await selected(vocabulary, profile({ ...pruned, assignmentOrdinal: 5003 })), { kind: "assigned", wordId: "interest" });
  assert.deepEqual(await selected(vocabulary, profile({ ...pruned, assignmentOrdinal: 5004 })), { kind: "assigned", wordId: "outside" });
});

test("SHA-256 uses UTF-8 bytes and ranks Unicode IDs deterministically", async () => {
  assert.equal(await sha256Hex("كلمة"), "259d7f07e205d2f8d10db102faafb028c8a2ea3bb4e1cf18abd81201f9b419dc");
  const ranked = await rankCandidates({
    candidates: [word("é"), word("z")],
    profile: profile({ interests: [] }),
    dateKey,
    recentWords: [],
    broaden: false,
  });
  assert.deepEqual(ranked.map((candidate) => candidate.id).sort(), ["z", "é"].sort());
  assert.deepEqual(ranked.map((candidate) => candidate.id), (await rankCandidates({
    candidates: [word("z"), word("é")], profile: profile({ interests: [] }), dateKey, recentWords: [], broaden: false,
  })).map((candidate) => candidate.id));
});

test("explain mode exposes the winning tuple without changing default results", async () => {
  const result = await selectDaily({ vocabulary: [word("w1")], profile: profile(), dateKey, digestHex: async () => "0".repeat(64), explain: true });
  assert.deepEqual(result, { kind: "assigned", wordId: "w1", explanation: { cooldown: 0, cooldownRelaxed: false, broaden: false, tuple: [0, 0, 0, 0, 0, "0".repeat(64)] } });
  assert.deepEqual(await selected([word("w1")]), { kind: "assigned", wordId: "w1" });
});

test("legacy profiles select an assigned word for every local day in a leap year", async () => {
  const vocabulary = Array.from({ length: 60 }, (_, index) => word(`w${index}`, {
    difficultyBand: ["beginner", "intermediate", "advanced"][index % 3],
    usefulnessBand: ["high", "medium", "low"][index % 3],
    topics: [["language"], ["travel"], ["food"]][index % 3],
    root: `r${index % 9}`,
    register: ["standard", "classical", "colloquial"][index % 3],
    partOfSpeech: ["noun", "verb", "adjective"][index % 3],
  }));
  for (const settings of [{ level: 1, interests: [] }, { level: 2, interests: ["travel"] }, { level: 4, interests: ["food", "language"] }]) {
    let simulated = profile(settings);
    for (let ordinal = 0; ordinal < 366; ordinal += 1) {
      const day = new Date(Date.UTC(2024, 0, ordinal + 1)).toISOString().slice(0, 10);
      const result = await selected(vocabulary, simulated, day);
      assert.equal(result.kind, "assigned", `${JSON.stringify(settings)} ${day}`);
      simulated = {
        ...simulated,
        assignments: { ...simulated.assignments, [day]: { wordId: result.wordId } },
        recentIds: [result.wordId, ...simulated.recentIds].slice(0, 16),
      };
    }
  }
});


test("literary advanced words compete regardless of legacy level and usefulness", async () => {
  const vocabulary = [word("beginner", { usefulnessBand: "high" }), word("literary", { difficultyBand: "advanced", usefulnessBand: "low", register: "classical" })];
  const digestHex = async (value) => value.endsWith("literary") ? "0".repeat(64) : "f".repeat(64);
  for (const level of [1, 2, 3, 4]) assert.equal((await selectDaily({ vocabulary, profile: profile({ level }), dateKey, digestHex })).wordId, "literary");
});

test("same-day assignment survives changed interests and legacy proficiency", async () => {
  const vocabulary = [word("first"), word("second", { difficultyBand: "advanced" })];
  const saved = profile({ assignments: { [dateKey]: { wordId: "first" } }, interests: ["food"], level: 4 });
  assert.deepEqual(await selected(vocabulary, saved), { kind: "assigned", wordId: "first" });
});

test("unrated encounters reach all bands unseen first, then least recent outside cooldown", async () => {
  const vocabulary = Array.from({ length: 18 }, (_, index) => word(`entry-${index}`, { difficultyBand: ["beginner", "intermediate", "advanced"][index % 3] }));
  const current = profile({ interests: [] });
  const sequence = [];
  for (let index = 0; index < 36; index += 1) {
    const date = `2026-${index < 30 ? "09" : "10"}-${String(index < 30 ? index + 1 : index - 29).padStart(2, "0")}`;
    const result = await selected(vocabulary, current, date);
    assert.ok(!sequence.slice(-6).includes(result.wordId));
    sequence.push(result.wordId);
    current.assignments[date] = { wordId: result.wordId };
    current.assignmentOrdinal += 1;
    current.recentIds = [result.wordId, ...current.recentIds.filter((id) => id !== result.wordId)].slice(0, 16);
  }
  assert.equal(new Set(sequence.slice(0, 18)).size, 18);
  assert.deepEqual(sequence.slice(18), sequence.slice(0, 18));
  assert.deepEqual(new Set(sequence.slice(0, 18).map((id) => vocabulary.find((entry) => entry.id === id).difficultyBand)), new Set(["beginner", "intermediate", "advanced"]));
});
