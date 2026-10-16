const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  createProfile,
  validateStoredProfile,
  applyFeedback,
  recordReview,
  getDueReviewWords,
  getReviewStats,
  getReviewOptions,
  parseImport,
  serializeExport,
  pruneAssignments,
} = require("../shared/state.js");

const vocabulary = ["w1", "w2", "w3"].map((id) => ({ id }));
const numericVocabulary = [1, 2, 3].map((id) => ({ id }));
const seed = "a".repeat(32);

function profileWithAssignment(dateKey, wordId = "w1", overrides = {}) {
  const profile = createProfile({ seedHex: seed, level: 2, interests: ["travel"] });
  const assignments = { ...profile.assignments, ...overrides.assignments, [dateKey]: { wordId } };
  return { ...profile, ...overrides, assignments, assignmentOrdinal: Math.max(overrides.assignmentOrdinal ?? 0, Object.keys(assignments).length) };
}

function feedbackFor(profile, dateKey) {
  return profile.assignments[dateKey].status;
}

function numericSrsItem(wordId, repetition) {
  return {
    wordId,
    repetition,
    interval: 1,
    ef: 2.5,
    nextReviewDate: "2026-08-17",
    lastReviewedDate: "2026-08-16",
    reviewCount: repetition,
    lapses: 0,
    history: [],
  };
}

function rejected(raw) {
  const result = validateStoredProfile(raw, vocabulary);
  assert.equal(result.canPersist, false);
  assert.deepEqual(result.recoveryRaw, raw);
}

test("future and corrupt state stays recoverable and read-only", () => {
  const raw = { schemaVersion: 999, marker: "keep-me" };
  const result = validateStoredProfile(raw, vocabulary);
  assert.equal(result.canPersist, false);
  assert.deepEqual(result.recoveryRaw, raw);
});

test("future schemas and malformed preferences stay recoverable and read-only", () => {
  const base = profileWithAssignment("2026-07-30");
  for (const raw of [
    { ...base, schemaVersion: 2 },
    { ...base, schemaVersion: 3 },
    { ...base, preferences: { ...base.preferences, speechRate: 9 } },
    { ...base, preferences: { ...base.preferences, dailyReviewLimit: -1 } },
    { ...base, preferences: "bad" },
    { ...base, preferences: { ...base.preferences, unexpected: true } },
  ]) {
    rejected(raw);
  }
});

test("supplied preference fields validate while missing fields use defaults", () => {
  const base = profileWithAssignment("2026-07-30");
  const partial = validateStoredProfile({ ...base, preferences: { speechRate: 1.25 } }, vocabulary);
  assert.equal(partial.canPersist, true);
  assert.deepEqual(partial.profile.preferences, {
    allowRemoteSpeech: false,
    showEnglish: false,
    speechRate: 1.25,
    speechRepeat: 1,
    dailyReviewLimit: 20,
  });
  for (const preferences of [
    { showEnglish: "yes" },
    { speechRate: 0.49 },
    { speechRate: 1.51 },
    { speechRepeat: 2 },
    { dailyReviewLimit: 2.5 },
    { dailyReviewLimit: 101 },
  ]) {
    rejected({ ...base, preferences });
  }
});

test("clear-data defaults create a bounded canonical profile", () => {
  const profile = createProfile({});
  assert.equal(profile.schemaVersion, 1);
  assert.equal(profile.algorithmVersion, 1);
  assert.match(profile.seedHex, /^[0-9a-f]{32}$/);
  assert.equal(profile.level, 1);
  assert.deepEqual(profile.interests, []);
  assert.deepEqual(Object.keys(profile.wordStates), []);
  assert.equal(Object.getPrototypeOf(profile.wordStates), null);
  assert.equal(Object.getPrototypeOf(profile.assignments), null);
  assert.equal(profile.evidenceCutoff, null);
  assert.equal(profile.assignmentOrdinal, 0);
});

test("review queue is bounded and carries exact SM-2 options", () => {
  const reviewVocabulary = Array.from({ length: 21 }, (_, index) => ({ id: `w${index + 1}` }));
  const reviewProfile = createProfile({ seedHex: seed, level: 1, interests: ["language"] });
  reviewProfile.srs = Object.fromEntries(reviewVocabulary.map((item) => [item.id, {
    wordId: item.id,
    repetition: 0,
    interval: 0,
    ef: 2.5,
    nextReviewDate: "2026-08-17",
    lastReviewedDate: null,
    reviewCount: 0,
    lapses: 0,
    history: [],
  }]));
  reviewProfile.history = Object.fromEntries(reviewVocabulary.map((item) => [item.id, { firstSeen: "2026-08-17" }]));

  const due = getDueReviewWords(reviewProfile, reviewVocabulary, "2026-08-17", 20);
  assert.equal(due.length, 20);
  assert.equal(due[0].reviewOptions.good.nextReviewDate, "2026-08-18");
  assert.deepEqual(due[0].reviewOptions.easy, getReviewOptions(due[0].srs, "2026-08-17").easy);
});

test("import and stored-profile validation normalize non-finite and bounded SRS values", () => {
  const source = profileWithAssignment("2026-08-17", "w1");
  source.srs = {
    w1: {
      wordId: "w1",
      repetition: 2,
      interval: "__SRS_INTERVAL__",
      ef: "__SRS_EF__",
      nextReviewDate: "2026-08-17",
      lastReviewedDate: "2026-08-16",
      reviewCount: 2,
      lapses: 0,
      history: [{ date: "2026-08-16", grade: 4, rating: "good", interval: "__SRS_INTERVAL__", ef: "__SRS_EF__" }],
    },
  };
  const nonFiniteJson = JSON.stringify(source)
    .replace(/"__SRS_INTERVAL__"/g, "1e400")
    .replace(/"__SRS_EF__"/g, "1e400");
  const nonFiniteRaw = JSON.parse(nonFiniteJson);

  const assertFiniteReview = (review) => {
    assert.ok(Number.isFinite(review.interval));
    assert.match(review.nextReviewDate, /^\d{4}-\d{2}-\d{2}$/);
  };
  const assertNormalized = (profile) => {
    const item = profile.srs.w1;
    assert.equal(item.interval, 0);
    assert.equal(item.ef, 2.5);
    assert.equal(item.history[0].interval, 0);
    assert.equal(item.history[0].ef, 2.5);

    const options = getReviewOptions(item, "2026-08-18");
    for (const review of Object.values(options)) assertFiniteReview(review);
    const due = getDueReviewWords(profile, vocabulary, "2026-08-18");
    assert.equal(due.length, 1);
    for (const review of Object.values(due[0].reviewOptions)) assertFiniteReview(review);

    const reviewed = recordReview(profile, "w1", "good", "2026-08-18", vocabulary);
    assert.ok(Number.isFinite(reviewed.srs.w1.interval));
    assert.ok(Number.isFinite(reviewed.srs.w1.ef));
    assert.match(reviewed.srs.w1.nextReviewDate, /^\d{4}-\d{2}-\d{2}$/);
    const stats = getReviewStats(reviewed, vocabulary, "2026-08-18");
    assert.ok(Number.isFinite(stats.averageEF));
    assert.ok(Number.isFinite(stats.retentionRate));
  };

  assertNormalized(parseImport(nonFiniteJson, vocabulary));
  const stored = validateStoredProfile(nonFiniteRaw, vocabulary);
  assert.equal(stored.canPersist, true);
  assertNormalized(stored.profile);

  const bounded = profileWithAssignment("2026-08-17", "w1", {
    srs: {
      w1: { wordId: "w1", interval: 100000, ef: 10, history: [{ interval: 100000, ef: 10 }] },
      w2: { wordId: "w2", interval: 100000.0001, ef: 10.0001, history: [{ interval: 100000.0001, ef: 10.0001 }] },
    },
  });
  const validated = validateStoredProfile(bounded, vocabulary);
  assert.equal(validated.profile.srs.w1.interval, 100000);
  assert.equal(validated.profile.srs.w1.ef, 10);
  assert.equal(validated.profile.srs.w1.history[0].interval, 100000);
  assert.equal(validated.profile.srs.w1.history[0].ef, 10);
  assert.equal(validated.profile.srs.w2.interval, 0);
  assert.equal(validated.profile.srs.w2.ef, 2.5);
  assert.equal(validated.profile.srs.w2.history[0].interval, 0);
  assert.equal(validated.profile.srs.w2.history[0].ef, 2.5);
});

test("import rejects conflicting numeric SRS aliases and stored state enters recovery", () => {
  const profile = createProfile({ seedHex: seed, level: 2, interests: ["travel"] });
  const raw = {
    ...profile,
    srs: {
      "1": numericSrsItem("1", 1),
      w1: numericSrsItem("w1", 2),
    },
  };

  assert.throws(() => parseImport(JSON.stringify(raw), numericVocabulary), /Invalid import\./);
  const stored = validateStoredProfile(raw, numericVocabulary);
  assert.equal(stored.canPersist, false);
  assert.deepEqual(stored.recoveryRaw, raw);
});

test("import rejects SRS entries beyond the numeric vocabulary bound", () => {
  const profile = createProfile({ seedHex: seed, level: 2, interests: ["travel"] });
  const raw = {
    ...profile,
    srs: {
      "1": numericSrsItem("1", 1),
      "2": numericSrsItem("2", 1),
      "3": numericSrsItem("3", 1),
      w1: numericSrsItem("w1", 1),
    },
  };

  assert.throws(() => parseImport(JSON.stringify(raw), numericVocabulary), /Invalid import\./);
  const stored = validateStoredProfile(raw, numericVocabulary);
  assert.equal(stored.canPersist, false);
  assert.deepEqual(stored.recoveryRaw, raw);
});

test("legacy profiles migrate a bounded lifetime assignment ordinal without recovery mode", () => {
  const legacy = profileWithAssignment("2026-07-30");
  delete legacy.assignmentOrdinal;
  const migrated = validateStoredProfile(legacy, vocabulary);
  assert.equal(migrated.canPersist, true);
  assert.equal(migrated.profile.assignmentOrdinal, 1);

  const explicit = validateStoredProfile({ ...legacy, assignmentOrdinal: 5004 }, vocabulary);
  assert.equal(explicit.profile.assignmentOrdinal, 5004);
  assert.equal(validateStoredProfile({ ...legacy, assignmentOrdinal: -1 }, vocabulary).canPersist, false);
});

test("legacy profiles and imports retain explicit English preferences", () => {
  const legacy = profileWithAssignment("2026-07-30");
  legacy.preferences.showEnglish = true;
  delete legacy.showEnglish;
  const stored = validateStoredProfile(legacy, vocabulary);
  assert.equal(stored.canPersist, true);
  assert.equal(stored.profile.showEnglish, true);
  assert.equal(stored.migrated, true);

  const imported = parseImport(JSON.stringify(legacy), vocabulary);
  assert.equal(imported.showEnglish, true);
});

test("existing assignments and word state remain readable across the 0.2.0 corpus refresh", () => {
  const currentVocabulary = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "vocabulary.json"), "utf8"));
  const stored = profileWithAssignment("2026-07-30", "w60", {
    wordStates: { w57: { status: "known", dateKey: "2026-07-29", saved: true } },
    recentIds: ["w57", "w60"],
  });
  const result = validateStoredProfile(stored, currentVocabulary);
  assert.equal(result.canPersist, true);
  assert.equal(result.profile.assignments["2026-07-30"].wordId, 60);
  assert.equal(result.profile.wordStates[57].saved, true);
  assert.deepEqual(result.profile.recentIds, [57, 60]);
});

test("unknown or malformed showEnglish data remains read-only recovery", () => {
  const valid = profileWithAssignment("2026-07-30");
  rejected({ ...valid, showEnglish: "yes" });
  rejected({ ...valid, showEnglish: false, unknown: true });
});

test("stored profiles reject unknown, dangerous, malformed, and invalid enum data without changing it", () => {
  const valid = profileWithAssignment("2026-07-30");
  rejected({ ...valid, unexpected: true });
  rejected(JSON.parse('{"schemaVersion":1,"__proto__":{"polluted":true}}'));
  rejected({ ...valid, seedHex: "A".repeat(32) });
  rejected({ ...valid, level: 5 });
  rejected({ ...valid, interests: ["travel", "food", "family", "language"] });
  rejected({ ...valid, interests: ["uncontrolled"] });
  rejected({ ...valid, assignments: { "2026-02-29": { wordId: "w1" } } });
  rejected({ ...valid, wordStates: { w1: { status: "maybe", dateKey: "2026-07-30", saved: false } } });
  rejected([]);
  rejected(null);
});

test("feedback edits replace rather than duplicate evidence", () => {
  const original = profileWithAssignment("2026-07-30", "w1", {
    wordStates: { w1: { status: "known", dateKey: "2026-07-30", saved: true } },
  });
  const once = applyFeedback(original, { dateKey: "2026-07-30", wordId: "w1", status: "known" });
  const edited = applyFeedback(once, { dateKey: "2026-07-30", wordId: "w1", status: "difficult" });
  assert.equal(edited.wordStates.w1.status, "difficult");
  assert.equal(edited.wordStates.w1.saved, true);
  assert.equal(feedbackFor(edited, "2026-07-30"), "difficult");
  assert.equal(Object.keys(edited.assignments).length, 1);
  assert.equal(original.assignments["2026-07-30"].status, undefined);
  assert.equal(Object.getPrototypeOf(edited.wordStates), null);
});

test("feedback shifts ability only for six matching distinct post-cutoff daily responses", () => {
  let rising = createProfile({ seedHex: seed, level: 2, interests: [] });
  for (let day = 1; day <= 8; day += 1) {
    const dateKey = `2026-07-${String(day).padStart(2, "0")}`;
    rising = applyFeedback(profileWithAssignment(dateKey, "w1", rising), {
      dateKey, wordId: "w1", status: day <= 6 ? "known" : "difficult",
    });
  }
  assert.equal(rising.level, 3);
  assert.equal(rising.evidenceCutoff, "2026-07-08");

  const reversed = applyFeedback(rising, { dateKey: "2026-07-01", wordId: "w1", status: "difficult" });
  assert.equal(reversed.level, 2);
  assert.equal(reversed.evidenceCutoff, null);
  assert.equal(reversed.assignments["2026-07-01"].status, "difficult");

  const afterCutoff = applyFeedback(profileWithAssignment("2026-07-09", "w1", rising), {
    dateKey: "2026-07-09", wordId: "w1", status: "known",
  });
  const editedAfterCutoff = applyFeedback(afterCutoff, {
    dateKey: "2026-07-09", wordId: "w1", status: "difficult",
  });
  assert.equal(editedAfterCutoff.level, 3);
  assert.equal(editedAfterCutoff.evidenceCutoff, "2026-07-08");

  let mixed = createProfile({ seedHex: seed, level: 2, interests: [] });
  for (let day = 1; day <= 6; day += 1) {
    const dateKey = `2026-06-${String(day).padStart(2, "0")}`;
    mixed = applyFeedback(profileWithAssignment(dateKey, "w1", mixed), {
      dateKey, wordId: "w1", status: day <= 5 ? "known" : "difficult",
    });
  }
  assert.equal(mixed.level, 2);
  assert.equal(mixed.evidenceCutoff, null);
});

test("imports reject bounded hostile data before returning a separate profile", () => {
  const valid = profileWithAssignment("2026-07-30");
  const imported = parseImport(serializeExport(valid), vocabulary);
  imported.assignments["2026-07-30"].wordId = "w2";
  assert.equal(valid.assignments["2026-07-30"].wordId, "w1");

  assert.throws(() => parseImport("x".repeat(2 * 1024 * 1024 + 1), vocabulary), /import/i);
  assert.throws(() => parseImport("[]", vocabulary), /import/i);
  assert.throws(() => parseImport(JSON.stringify({ ...valid, schemaVersion: 2 }), vocabulary), /import/i);
  assert.throws(() => parseImport(JSON.stringify({ ...valid, schemaVersion: 3 }), vocabulary), /import/i);
  assert.throws(() => parseImport(JSON.stringify({ ...valid, unknown: true }), vocabulary), /import/i);
  assert.throws(() => parseImport('{"schemaVersion":1,"__proto__":{}}', vocabulary), /import/i);
  assert.throws(() => parseImport(JSON.stringify({ ...valid, assignments: { "2026-07-30": { wordId: "x".repeat(65) } } }), vocabulary), /import/i);
  assert.throws(() => parseImport(JSON.stringify({ ...valid, seedHex: "a".repeat(2001) }), vocabulary), /import/i);
  assert.throws(() => parseImport(JSON.stringify({ ...valid, recentIds: Array(17).fill("w1") }), vocabulary), /import/i);
  assert.throws(() => parseImport(JSON.stringify({ ...valid, assignments: { "2026-07-30": { wordId: "w1", extra: "x".repeat(16 * 1024) } } }), vocabulary), /import/i);

  const largeVocabulary = Array.from({ length: 10001 }, (_, index) => ({ id: `w${index}` }));
  const wordStates = Object.fromEntries(largeVocabulary.map(({ id }) => [id, { status: "known", dateKey: "2026-07-30", saved: false }]));
  assert.throws(() => parseImport(JSON.stringify({ ...valid, wordStates }), largeVocabulary), /import/i);

  const assignments = {};
  for (let day = 1; day <= 5001; day += 1) {
    assignments[new Date(Date.UTC(2000, 0, day)).toISOString().slice(0, 10)] = { wordId: "w1" };
  }
  rejected({ ...valid, assignments });
  assert.throws(() => parseImport(JSON.stringify({ ...valid, assignments }), vocabulary), /import/i);
});

test("pruning retains the newest 5000 assignments and export is newline-terminated without mutations", () => {
  const assignments = {};
  for (let day = 1; day <= 5001; day += 1) {
    const date = new Date(Date.UTC(2000, 0, day));
    assignments[date.toISOString().slice(0, 10)] = { wordId: "w1" };
  }
  const original = profileWithAssignment("2026-07-30", "w1", { assignments });
  const pruned = pruneAssignments(original);
  assert.equal(Object.keys(pruned.assignments).length, 5000);
  assert.equal(Object.hasOwn(pruned.assignments, "2000-01-01"), false);
  assert.equal(Object.hasOwn(original.assignments, "2000-01-01"), true);
  assert.equal(Object.getPrototypeOf(pruned.assignments), null);

  const exported = serializeExport(pruned);
  assert.equal(exported.endsWith("\n"), true);
  const parsed = JSON.parse(exported);
  parsed.assignments["2000-01-03"].wordId = "w2";
  assert.equal(pruned.assignments["2000-01-03"].wordId, "w1");
});


test("daily feedback grades SRS once and preserves later deliberate practice", () => {
  const dateKey = "2026-09-30";
  const first = applyFeedback(profileWithAssignment(dateKey), { dateKey, wordId: "w1", status: "known" }, vocabulary);
  const repeated = applyFeedback(first, { dateKey, wordId: "w1", status: "known" }, vocabulary);
  assert.deepEqual(repeated.srs, parseImport(serializeExport(first), vocabulary).srs);
  const practiced = recordReview(parseImport(serializeExport(first), vocabulary), "w1", "good", dateKey, vocabulary);
  assert.equal(practiced.srs.w1.reviewCount, 2);
  const replay = recordReview(practiced, "w1", "good", dateKey, vocabulary);
  assert.deepEqual(replay.srs, practiced.srs);
  const corrected = applyFeedback(practiced, { dateKey, wordId: "w1", status: "difficult" }, vocabulary);
  assert.equal(corrected.assignments[dateKey].status, "difficult");
  assert.deepEqual(corrected.srs, parseImport(serializeExport(practiced), vocabulary).srs);
  const restored = applyFeedback(corrected, { dateKey, wordId: "w1", status: "known" }, vocabulary);
  assert.deepEqual(restored.srs, parseImport(serializeExport(practiced), vocabulary).srs);
});

test("saved-only entries synchronize favorites without creating learning records", () => {
  const profile = createProfile({ seedHex: seed });
  profile.wordStates.w1 = { saved: true };
  const saved = validateStoredProfile(profile, vocabulary).profile;
  assert.equal(saved.favorites.w1, true);
  assert.equal(saved.srs.w1, undefined);
  assert.equal(saved.history.w1, undefined);
  saved.wordStates.w1.saved = false;
  const unsaved = parseImport(serializeExport(saved), vocabulary);
  assert.equal(unsaved.favorites.w1, undefined);
  assert.equal(unsaved.srs.w1, undefined);
  const legacy = { ...profile, wordStates: {}, favorites: { w1: true } };
  assert.equal(parseImport(JSON.stringify(legacy), vocabulary).favorites.w1, true);
});


test("only newly created profiles default to Arabic-first English visibility", () => {
  assert.equal(createProfile().showEnglish, false);
  assert.equal(createProfile().preferences.showEnglish, false);
  assert.equal(createProfile({ showEnglish: true }).showEnglish, true);
});

function sourceSnapshot() {
  return {
    id: "wk_123_abcdef012345", contentVersion: 3,
    word: "استدامة", normalized: "استدامة", meaningAr: "استمرار الشيء وبقاؤه.",
    exampleAr: "تسهم الاستدامة في حفظ الموارد.", topics: ["environment"],
    partOfSpeech: "noun", register: "standard", reviewed: false,
    source: { title: "استدامة", url: "https://ar.wiktionary.org/wiki/استدامة", revisionId: 12, license: "CC-BY-SA-4.0" },
    exampleKind: "quotation", exampleSource: { title: "استدامة", url: "https://ar.wikipedia.org/wiki/استدامة", reference: "مقدمة المقالة" },
    discoveryReason: "مصطلح مفيد لفهم نقاشات البيئة.",
  };
}

test("optional discovery fields do not alter legacy serialized profiles", () => {
  const original = profileWithAssignment("2026-08-17");
  const before = serializeExport(original);
  const restored = parseImport(before, vocabulary);
  assert.equal(serializeExport(restored), before);
  assert.equal(Object.hasOwn(restored, "wordSnapshots"), false);
  assert.equal(Object.hasOwn(restored, "discovery"), false);
});

test("source snapshots restore assignment, save, history and reviews using only the bundled vocabulary", () => {
  const card = sourceSnapshot();
  const raw = profileWithAssignment("2026-08-17", card.id, {
    wordSnapshots: { [card.id]: card },
    discovery: { enabled: true, topics: ["environment"], knownKeys: ["استدامة"] },
    recentIds: [card.id], wordStates: { [card.id]: { saved: true } },
  });
  const imported = parseImport(JSON.stringify(raw), vocabulary);
  assert.equal(imported.assignments["2026-08-17"].wordId, card.id);
  assert.equal(imported.favorites[card.id], true);
  const feedback = applyFeedback(imported, { dateKey: "2026-08-17", wordId: card.id, status: "difficult" }, vocabulary);
  const exported = serializeExport(feedback);
  const restart = validateStoredProfile(JSON.parse(exported), vocabulary);
  assert.equal(restart.canPersist, true);
  assert.equal(restart.profile.history[card.id].firstSeen, "2026-08-17");
  assert.equal(restart.profile.srs[card.id].wordId, card.id);
  assert.equal(getDueReviewWords(restart.profile, vocabulary, "2026-08-18")[0].word.id, card.id);
  const reviewed = recordReview(restart.profile, card.id, "good", "2026-08-18", vocabulary);
  assert.equal(reviewed.srs[card.id].reviewCount, 2);
  assert.equal(parseImport(serializeExport(reviewed), vocabulary).wordSnapshots[card.id].meaningAr, card.meaningAr);
});

test("invalid discovery imports preserve raw recovery data and reject bad snapshots or known keys", () => {
  const card = sourceSnapshot();
  const original = profileWithAssignment("2026-08-17");
  const invalid = [
    { wordSnapshots: { wrong: card } },
    { wordSnapshots: { [card.id]: { ...card, reviewed: true } } },
    { wordSnapshots: { [card.id]: { ...card, source: { ...card.source, url: "https://evil.test/wiki/a" } } } },
    { discovery: { enabled: true, topics: ["science"], knownKeys: ["x", "x"] } },
    { discovery: { enabled: true, topics: ["science"], knownKeys: ["x\u0000"] } },
    { discovery: { enabled: true, topics: ["science"], knownKeys: ["x".repeat(81)] } },
    { discovery: { enabled: true, topics: ["science"], knownKeys: Array.from({ length: 2049 }, (_, i) => String(i)) } },
    { discovery: { enabled: true, topics: ["science"], knownKeys: [], extra: true } },
    { discovery: { enabled: true, topics: ["unknown"], knownKeys: [] } },
  ];
  for (const fields of invalid) {
    const raw = { ...original, ...fields };
    assert.throws(() => parseImport(JSON.stringify(raw), vocabulary), /Invalid import/);
    const checked = validateStoredProfile(raw, vocabulary);
    assert.equal(checked.canPersist, false);
    assert.equal(checked.recoveryRaw, raw);
  }
});

test("mixed LMF and Wikimedia snapshots preserve learner data without the source catalog", () => {
  const wiki = sourceSnapshot();
  const wd = {...wiki,id:"wd_123_abcdef012345",source:{...wiki.source,url:"https://www.wikidata.org/wiki/Q123",license:"CC0-1.0"}};
  const url = "https://lindat.mff.cuni.cz/repository/items/d4d8ef1a-0e51-42d1-9a94-113cb81afa76";
  const lmf = {...wiki,id:`lmf_${'a'.repeat(32)}`,
    source:{title:"Historical LMF",url,license:"CC-BY-NC-4.0",sha256:'b'.repeat(64),entryId:"entry-old",senseId:"sense-old",recordId:'a'.repeat(32)},
    exampleSource:{title:"Historical LMF",url,reference:"LMF: entry-old / sense-old"}};
  const raw = profileWithAssignment("2026-08-17", lmf.id, {
    assignments:{"2026-08-15":{wordId:wiki.id},"2026-08-16":{wordId:wd.id}},
    wordSnapshots:Object.fromEntries([wiki,wd,lmf].map(card=>[card.id,card])),
    discovery:{enabled:true,topics:["environment"],knownKeys:["استدامة"]},
    recentIds:[wiki.id,wd.id,lmf.id],favorites:{[wiki.id]:true,[lmf.id]:true},
  });
  const imported = parseImport(JSON.stringify(raw), vocabulary);
  const learned = applyFeedback(imported,{dateKey:"2026-08-17",wordId:lmf.id,status:"difficult"},vocabulary);
  const saved = serializeExport(learned);
  const restored = parseImport(saved,vocabulary);
  assert.equal(serializeExport(restored),saved);
  assert.deepEqual(restored.wordSnapshots,learned.wordSnapshots);
  for (const field of ["assignments","favorites","srs","history","discovery","recentIds"]) assert.deepEqual(restored[field],learned[field]);
  const restarted = validateStoredProfile(JSON.parse(saved),vocabulary);
  assert.equal(restarted.canPersist,true);
  assert.equal(restarted.profile.wordSnapshots[lmf.id].source.sha256,'b'.repeat(64));
  assert.equal(getDueReviewWords(restarted.profile,vocabulary,"2026-08-18")[0].word.id,lmf.id);
});

test("snapshot bounds and collisions cannot replace existing word content", () => {
  const api = require("../shared/state.js");
  const card = sourceSnapshot();
  const raw = { ...createProfile(), wordSnapshots: { [card.id]: card } };
  assert.equal(api.mergeVocabulary(vocabulary, raw).length, vocabulary.length + 1);
  assert.equal(api.mergeVocabulary([...vocabulary, card], raw).length, vocabulary.length + 1);
  assert.throws(() => api.mergeVocabulary([...vocabulary, { ...card, meaningAr: "معنى مختلف" }], raw), /collision/);
  const oversized = Object.fromEntries(Array.from({ length: 513 }, (_, index) => {
    const entry = { ...card, id: `wk_${index + 1}_abcdef012345` };
    return [entry.id, entry];
  }));
  assert.throws(() => parseImport(JSON.stringify({ ...raw, wordSnapshots: oversized }), vocabulary), /Invalid import/);
  const missing = { ...profileWithAssignment("2026-08-17", card.id), wordSnapshots: {} };
  assert.equal(validateStoredProfile(missing, vocabulary).canPersist, false);
});
