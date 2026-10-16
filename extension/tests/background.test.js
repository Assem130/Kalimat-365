const test = require("node:test");
const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

globalThis.crypto ??= webcrypto;

const realVocabulary = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "vocabulary.json"), "utf8"));

function word(id, overrides = {}) {
  return {
    id,
    contentVersion: 1,
    word: "word",
    normalized: "word",
    pronunciation: "/word/",
    meaningAr: "meaning",
    meaningEn: "meaning",
    exampleAr: "example",
    difficultyBand: "beginner",
    usefulnessBand: "high",
    topics: ["language"],
    partOfSpeech: "noun",
    register: "standard",
    reviewed: true,
    ...overrides,
  };
}

function fakeEvent() {
  return { listeners: [], addListener(listener) { this.listeners.push(listener); } };
}

function fakeExtension({ profile, reminder, vocabulary = [word("w1"), word("w2")], storageFailure = false, storageSetFailures = 0, profileSetFailures = 0, reminderWarningSetFailures = 0, permissions = true, hostPermissions = true, reminderApis = true, alarm, alarmGetFailures = 0, alarmCreateFailures = 0, alarmClearFailures = 0, notificationFailure = false, tabFailure = false, api = "chrome" } = {}) {
  const values = Object.create(null);
  if (profile !== undefined) values["kalimat.profile"] = structuredClone(profile);
  if (reminder !== undefined) values["kalimat.reminder"] = structuredClone(reminder);
  const alarms = new Map();
  if (alarm) alarms.set(alarm.name, alarm);
  const calls = { set: 0, clear: 0, create: [], contextMenus: [], notifications: [], tabs: [], permissionRequests: 0 };
  let remainingSetFailures = storageSetFailures;
  let remainingProfileSetFailures = profileSetFailures;
  let remainingReminderWarningSetFailures = reminderWarningSetFailures;
  let remainingAlarmGetFailures = alarmGetFailures;
  let remainingAlarmCreateFailures = alarmCreateFailures;
  let remainingAlarmClearFailures = alarmClearFailures;
  let storageAvailable = !storageFailure;
  let permissionsGranted = permissions;
  let hostPermissionsGranted = hostPermissions;
  const runtime = { onMessage: fakeEvent(), onStartup: fakeEvent(), onInstalled: fakeEvent(), getURL: (path) => `extension://kalimat/${path}` };
  const alarmApi = {
    onAlarm: fakeEvent(),
    async get(name) { if (remainingAlarmGetFailures-- > 0) throw new Error("alarm unavailable"); return alarms.get(name); },
    async create(name, details) { if (remainingAlarmCreateFailures-- > 0) throw new Error("alarm unavailable"); calls.create.push({ name, details }); alarms.set(name, { name, ...details }); },
    async clear(name) { calls.clear += 1; if (remainingAlarmClearFailures-- > 0) throw new Error("alarm unavailable"); return alarms.delete(name); },
  };
  const notificationApi = {
    onClicked: fakeEvent(),
    async create(id, options) { if (notificationFailure) throw new Error("notification unavailable"); calls.notifications.push({ id, options }); },
  };
  const contextMenuApi = {
    onClicked: fakeEvent(),
    create(details, callback) { calls.contextMenus.push(details); callback?.(); },
  };
  const extension = {
    storage: { local: {
      async get(key) { if (!storageAvailable) throw new Error("storage unavailable"); return { [key]: structuredClone(values[key]) }; },
      async set(next) {
        if (!storageAvailable || remainingSetFailures-- > 0 || (Object.hasOwn(next, "kalimat.profile") && remainingProfileSetFailures-- > 0) || (Object.hasOwn(next, "kalimat.reminder.warning") && remainingReminderWarningSetFailures-- > 0)) throw new Error("storage unavailable");
        calls.set += 1;
        Object.assign(values, structuredClone(next));
      },
    } },
    permissions: {
      onRemoved: fakeEvent(),
      async contains(query) {
        if (query?.origins?.length || query?.permissions?.some((p) => p.includes("wiktionary") || p.includes("wikimedia") || p.startsWith("http"))) {
          return hostPermissionsGranted;
        }
        return permissionsGranted;
      },
      async request(query) {
        calls.permissionRequests += 1;
        if (query?.origins?.length || query?.permissions?.some((p) => p.includes("wiktionary") || p.includes("wikimedia") || p.startsWith("http"))) {
          return hostPermissionsGranted;
        }
        return permissionsGranted;
      },
    },
    contextMenus: contextMenuApi,
    runtime,
    tabs: { async create(details) { if (tabFailure) throw new Error("tab unavailable"); calls.tabs.push(details); } },
  };
  function installReminderApis() {
    extension.alarms = alarmApi;
    extension.notifications = notificationApi;
  }
  if (reminderApis) installReminderApis();
  return { extension, values, alarms, calls, vocabulary, api, installReminderApis, setPermissions(value) { permissionsGranted = value; }, setHostPermissions(value) { hostPermissionsGranted = value; }, setStorageAvailable(value) { storageAvailable = value; }, failNextWrites(count) { remainingSetFailures = count; } };
}

function loadBackground(options = {}) {
  const fake = fakeExtension(options);
  const prior = { chrome: globalThis.chrome, browser: globalThis.browser, fetch: globalThis.fetch };
  if (fake.api === "browser") {
    delete globalThis.chrome;
    globalThis.browser = fake.extension;
  } else {
    delete globalThis.browser;
    globalThis.chrome = fake.extension;
  }
  globalThis.fetch = async (url, fetchOptions) => {
    if (typeof url === "string" && url.includes("vocabulary.json")) {
      if (typeof options.vocabularyFetch === "function") return options.vocabularyFetch(url, fetchOptions);
      return { ok: true, async json() { return fake.vocabulary; }, async text() { return JSON.stringify(fake.vocabulary); } };
    }
    if (typeof options.fetch === "function") return options.fetch(url, fetchOptions);
    return { ok: true, async json() { return fake.vocabulary; }, async text() { return JSON.stringify(fake.vocabulary); } };
  };
  delete require.cache[require.resolve("../background.js")];
  const background = require("../background.js");
  return {
    ...fake,
    background,
    restore() {
      if (prior.chrome === undefined) delete globalThis.chrome; else globalThis.chrome = prior.chrome;
      if (prior.browser === undefined) delete globalThis.browser; else globalThis.browser = prior.browser;
      globalThis.fetch = prior.fetch;
      delete require.cache[require.resolve("../background.js")];
    },
  };
}

async function withBackground(options, callback) {
  const fixture = loadBackground(options);
  try { await callback(fixture); } finally { fixture.restore(); }
}

async function withLocalDay(day, callback) {
  const RealDate = globalThis.Date;
  globalThis.Date = class FixedDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [`${day}T12:00:00`])); }
  };
  try { await callback(); } finally { globalThis.Date = RealDate; }
}

function profile(overrides = {}) {
  const { createProfile } = require("../shared/state.js");
  return { ...createProfile({ seedHex: "a".repeat(32), level: 1, interests: ["language"] }), ...overrides };
}

// Model old installs explicitly. Retained assignments must remain usable after
// removing the bundled selector from new daily assignments.
function retainedProfile(day = require("../shared/date.js").getLocalDateKey(new Date()), id = "w1", overrides = {}) {
  return profile({ assignments: { [day]: { wordId: id } }, assignmentOrdinal: 1, ...overrides });
}
function sourceProfile(overrides = {}) {
  return profile({ discovery: { enabled: true, topics: [], knownKeys: [] }, ...overrides });
}

test("concurrent source assignment requests persist and return one local-day word", async () => {
  await withBackground({ profile: sourceProfile(), fetch: freeSourceFetch([]) }, async ({ background, values }) => {
    await withLocalDay("2026-07-30", async () => {
      const results = await Promise.all([background.handleMessage({ type: "assignment.get" }), background.handleMessage({ type: "assignment.get" })]);
      assert.deepEqual(results[0], results[1]);
      assert.equal(Object.keys(values["kalimat.profile"].assignments).length, 1);
      assert.equal(values["kalimat.profile"].assignmentOrdinal, 1);
    });
  });
});

test("Firefox browser APIs use the same background message adapter", async () => {
  await withBackground({ api: "browser", profile: retainedProfile("2026-07-30") }, async ({ background, extension }) => {
    assert.equal(extension.runtime.onMessage.listeners.length, 1);
    await withLocalDay("2026-07-30", async () => {
      const result = await background.handleMessage({ type: "assignment.get" });
      assert.equal(result.kind, "assigned");
      assert.equal(result.dateKey, "2026-07-30");
    });
  });
});

test("first-run background serves settings and assignments without optional reminder APIs", async () => {
  let fixture;
  assert.doesNotThrow(() => { fixture = loadBackground({ permissions: false, reminderApis: false }); });
  try {
    assert.deepEqual(await fixture.background.handleMessage({ type: "settings.get" }), { kind: "settings", reminder: { enabled: false, time: "09:00" } });
    assert.equal((await fixture.background.handleMessage({ type: "assignment.get" })).kind, "no-new-word");
  } finally { fixture?.restore(); }
});

test("real numeric vocabulary keeps assignment, save, and review canonical and transactional", async () => {
  await withBackground({ vocabulary: realVocabulary, profile: retainedProfile("2026-08-17", 1), permissions: false, reminderApis: false }, async ({ background, values }) => {
    await withLocalDay("2026-08-17", async () => {
      const assigned = await background.handleMessage({ type: "assignment.get" });
      assert.equal(assigned.kind, "assigned");
      assert.equal(Number.isInteger(assigned.wordId), true);
      assert.ok(assigned.wordId >= 1 && assigned.wordId <= realVocabulary.length);

      const saved = await background.handleMessage({ type: "word.save", wordId: `w${assigned.wordId}`, saved: true });
      assert.equal(saved.kind, "ok");
      assert.equal(saved.wordId, assigned.wordId);
      assert.equal(saved.saved, true);

      const beforeInvalid = JSON.stringify(values["kalimat.profile"]);
      await assert.rejects(background.handleMessage({ type: "word.review", wordId: "w999", rating: "good", dateKey: "2026-08-17" }), /unknown/i);
      await assert.rejects(background.handleMessage({ type: "word.review", wordId: assigned.wordId, rating: "invalid", dateKey: "2026-08-17" }), /rating/i);
      assert.equal(JSON.stringify(values["kalimat.profile"]), beforeInvalid);

      // Daily feedback enrolls the card before deliberate practice.
      await background.handleMessage({ type: "word.feedback", wordId: assigned.wordId, status: "known", dateKey: "2026-08-17" });
      const reviewed = await background.handleMessage({ type: "word.review", wordId: `w${assigned.wordId}`, rating: "good", dateKey: "2026-08-17" });
      assert.equal(reviewed.kind, "ok");
      assert.equal(reviewed.srs.wordId, assigned.wordId);
      assert.equal(reviewed.srs.reviewCount, 2);
      const afterReview = JSON.stringify(values["kalimat.profile"]);

      const replay = await background.handleMessage({ type: "word.review", wordId: assigned.wordId, rating: "good", dateKey: "2026-08-17" });
      assert.equal(replay.srs.reviewCount, 2);
      assert.equal(JSON.stringify(values["kalimat.profile"]), afterReview);
    });
  });
});

test("a rejected vocabulary load is cleared so the next message can retry", async () => {
  let attempts = 0;
  await withBackground({
    profile: retainedProfile("2026-07-30"),
    vocabularyFetch: async () => {
      attempts += 1;
      if (attempts === 1) return { ok: false, status: 503 };
      return { ok: true, async json() { return [word("w1"), word("w2")]; } };
    },
  }, async ({ background, vocabulary }) => {
    await assert.rejects(background.handleMessage({ type: "assignment.get" }), /Vocabulary unavailable/);
    let result;
    await withLocalDay("2026-07-30", async () => { result = await background.handleMessage({ type: "assignment.get" }); });
    assert.equal(result.kind, "assigned");
    assert.equal(result.word.id, result.wordId);
    assert.ok(vocabulary.some((item) => item.id === result.word.id));
  });
  assert.equal(attempts, 2);
});

test("review queue reports total and remaining counts when the daily limit caps visibility", async () => {
  const vocabulary = Array.from({ length: 21 }, (_, index) => word(`w${index + 1}`));
  const base = profile({
    srs: Object.fromEntries(vocabulary.map((item) => [item.id, {
      wordId: item.id,
      repetition: 0,
      interval: 0,
      ef: 2.5,
      nextReviewDate: "2026-08-17",
      lastReviewedDate: null,
      reviewCount: 0,
      lapses: 0,
      history: [],
    }])),
    history: Object.fromEntries(vocabulary.map((item) => [item.id, { firstSeen: "2026-08-17" }])),
  });

  await withBackground({ profile: base, vocabulary, permissions: false, reminderApis: false }, async ({ background }) => {
    const result = await background.handleMessage({ type: "review.queue", dateKey: "2026-08-17" });
    assert.equal(result.kind, "queue");
    assert.equal(result.dueCount, 21);
    assert.equal(result.visibleCount, 20);
    assert.equal(result.remainingCount, 1);
    assert.equal(result.words.length, 20);
  });
});

test("browser background bootstrap imports the shared domain modules", async () => {
  const fake = fakeExtension({ permissions: false, reminderApis: false });
  const imported = [];
  const context = vm.createContext({ chrome: fake.extension, console, crypto: webcrypto, TextEncoder, fetch: async () => ({ ok: true, async json() { return fake.vocabulary; } }) });
  context.globalThis = context;
  context.importScripts = (...relativePaths) => {
    for (const relative of relativePaths) {
      imported.push(relative);
      vm.runInContext(fs.readFileSync(path.join(__dirname, "..", relative), "utf8"), context, { filename: relative });
    }
  };
  assert.doesNotThrow(() => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8"), context, { filename: "background.js" }));
  assert.deepEqual(imported, ["shared/date.js", "shared/vocabulary.js", "shared/review-policy.js", "shared/state.js", "shared/lookup.js", "shared/discovery.js"]);
  for (const name of ["KalimatDate", "KalimatVocabulary", "KalimatReviewPolicy", "KalimatState", "KalimatLookup", "KalimatDiscovery"]) assert.equal(typeof context[name], "object");
  assert.equal((await fake.extension.runtime.onMessage.listeners[0]({ type: "settings.get" })).kind, "settings");
});

test("background registers the selection context menu on worker startup", () => {
  const fixture = loadBackground({ permissions: false, reminderApis: false });
  try {
    assert.deepEqual(fixture.calls.contextMenus, [{
      id: "kalimat-lookup-selection",
      title: "ابحث في كَلِمات",
      contexts: ["selection"],
    }]);
    assert.equal(fixture.extension.contextMenus.onClicked.listeners.length, 1);
  } finally { fixture.restore(); }
});

test("reminder configuration registers newly available optional API listeners once", async () => {
  await withBackground({ permissions: false, reminderApis: false }, async ({ background, extension, installReminderApis, setPermissions }) => {
    installReminderApis();
    setPermissions(true);
    assert.deepEqual(await background.handleMessage({ type: "reminder.configure", enabled: true, time: "09:00" }), { enabled: true, time: "09:00" });
    await background.handleMessage({ type: "reminder.configure", enabled: true, time: "10:00" });
    assert.equal(extension.alarms.onAlarm.listeners.length, 1);
    assert.equal(extension.notifications.onClicked.listeners.length, 1);
  });
});

test("available optional reminder APIs register listeners synchronously on worker restart", () => {
  const fixture = loadBackground({ permissions: true });
  try {
    assert.equal(fixture.extension.alarms.onAlarm.listeners.length, 1);
    assert.equal(fixture.extension.notifications.onClicked.listeners.length, 1);
  } finally { fixture.restore(); }
});

test("an existing assignment survives feedback and settings changes", async () => {
  const existing = profile({ assignments: { "2026-07-30": { wordId: "w1" } }, assignmentOrdinal: 1 });
  await withBackground({ profile: existing }, async ({ background }) => {
    await background.handleMessage({ type: "word.feedback", dateKey: "2026-07-30", wordId: "w1", status: "known" });
    await background.handleMessage({ type: "settings.update", level: 2, interests: ["travel"] });
    await withLocalDay("2026-07-30", async () => {
      assert.deepEqual(await background.handleMessage({ type: "assignment.get" }), { kind: "assigned", wordId: "w1", dateKey: "2026-07-30", word: word("w1"), status: "known", showEnglish: false });
    });
  });
});

test("feedback rejects unknown message fields before changing profile state", async () => {
  const existing = profile({ assignments: { "2026-07-30": { wordId: "w1" } }, assignmentOrdinal: 1 });
  await withBackground({ profile: existing }, async ({ background, values }) => {
    await assert.rejects(background.handleMessage({ type: "word.feedback", dateKey: "2026-07-30", wordId: "w1", status: "known", extra: true }), /Invalid feedback/);
    assert.equal(values["kalimat.profile"].assignments["2026-07-30"].status, undefined);
  });
});

test("read-only messages reject unknown fields", async () => {
  await withBackground({}, async ({ background }) => {
    await assert.rejects(background.handleMessage({ type: "assignment.get", extra: true }), /Invalid assignment/);
    await assert.rejects(background.handleMessage({ type: "assignment.get", dateKey: "not-a-date" }), /Invalid assignment/);
    await assert.rejects(background.handleMessage({ type: "settings.get", extra: true }), /Invalid settings/);
    await assert.rejects(background.handleMessage({ type: "state.export", extra: true }), /Invalid export/);
  });
});

test("Atlas can read a retained date without creating an assignment for another day", async () => {
  const existing = profile({ assignments: { "2026-07-28": { wordId: "w2" } }, assignmentOrdinal: 1 });
  await withBackground({ profile: existing }, async ({ background, values }) => {
    assert.deepEqual(await background.handleMessage({ type: "assignment.get", dateKey: "2026-07-28" }), { kind: "assigned", wordId: "w2", dateKey: "2026-07-28", word: word("w2"), showEnglish: false });
    assert.deepEqual(await background.handleMessage({ type: "assignment.get", dateKey: "2026-07-29" }), { kind: "no-new-word", dateKey: "2026-07-29" });
    assert.deepEqual(values["kalimat.profile"].assignments, existing.assignments);
  });
});

test("a dated query is read-only even when it names the current day", async () => {
  const existing = profile();
  await withBackground({ profile: existing }, async ({ background, values }) => {
    await withLocalDay("2026-07-30", async () => {
      assert.deepEqual(await background.handleMessage({ type: "assignment.get", dateKey: "2026-07-30" }), { kind: "no-new-word", dateKey: "2026-07-30" });
    });
    assert.deepEqual(Object.keys(values["kalimat.profile"].assignments), []);
    assert.equal(values["kalimat.profile"].assignmentOrdinal, 0);
  });
});

test("settings snapshot returns only the current validated reminder", async () => {
  await withBackground({ reminder: { enabled: true, time: "18:45" } }, async ({ background }) => {
    assert.deepEqual(await background.handleMessage({ type: "settings.get" }), { kind: "settings", reminder: { enabled: true, time: "18:45" } });
  });
});

test("onboarding, save, export, import, and clear use validated profile state", async () => {
  await withBackground({}, async ({ background, values }) => {
    await background.handleMessage({ type: "onboarding.complete", level: 2, interests: ["travel"] });
    await background.handleMessage({ type: "word.save", wordId: "w1", saved: true });
    const exported = await background.handleMessage({ type: "state.export" });
    assert.equal(exported.kind, "export");
    assert.equal(JSON.parse(exported.text).wordStates.w1.saved, true);
    await background.handleMessage({ type: "state.clear" });
    assert.deepEqual(Object.keys(values["kalimat.profile"].wordStates), []);
    await background.handleMessage({ type: "state.import", text: exported.text });
    assert.equal(values["kalimat.profile"].level, 2);
    assert.equal(values["kalimat.profile"].wordStates.w1.saved, true);
  });
});

test("settings retain English visibility alongside level and interests", async () => {
  const initial = profile({
    showEnglish: true,
    preferences: { ...profile().preferences, showEnglish: true },
  });
  await withBackground({ profile: initial }, async ({ background, vocabulary }) => {
    await background.handleMessage({ type: "settings.update", level: 3, interests: ["travel"], showEnglish: false });
    const exported = await background.handleMessage({ type: "state.export" });
    const parsed = JSON.parse(exported.text);
    assert.equal(parsed.showEnglish, false);
    assert.equal(parsed.preferences.showEnglish, false);
    const checked = require("../shared/state.js").validateStoredProfile(parsed, vocabulary);
    assert.equal(checked.canPersist, true);
    assert.equal(checked.profile.preferences.showEnglish, false);
  });
});

test("settings update persists valid speech preferences and rejects invalid fields atomically", async () => {
  const initial = profile({
    preferences: { ...profile().preferences, speechRate: 0.85, speechRepeat: 1 },
  });
  await withBackground({ profile: initial }, async ({ background, values }) => {
    const result = await background.handleMessage({ type: "settings.update", level: 2, interests: ["travel"], speechRate: 1.25, speechRepeat: 3 });
    assert.equal(result.kind, "ok");
    assert.equal(values["kalimat.profile"].preferences.speechRate, 1.25);
    assert.equal(values["kalimat.profile"].preferences.speechRepeat, 3);

    const persisted = JSON.stringify(values["kalimat.profile"]);
    await assert.rejects(background.handleMessage({ type: "settings.update", speechRate: 0.49 }), /Invalid settings/);
    await assert.rejects(background.handleMessage({ type: "settings.update", speechRate: 1.51 }), /Invalid settings/);
    await assert.rejects(background.handleMessage({ type: "settings.update", speechRepeat: 2 }), /Invalid settings/);
    await assert.rejects(background.handleMessage({ type: "settings.update", speechRate: 1, unknown: true }), /Invalid settings/);
    assert.equal(JSON.stringify(values["kalimat.profile"]), persisted);
  });
});

test("legacy stored profile missing top-level English flag retains explicit preferences", async () => {
  for (const showEnglish of [false, true]) {
    const legacy = profile({ assignments: { "2026-07-30": { wordId: "w1" } }, assignmentOrdinal: 1 });
    legacy.preferences.showEnglish = showEnglish;
    delete legacy.showEnglish;
    await withBackground({ profile: legacy }, async ({ background, values }) => {
      await withLocalDay("2026-07-30", async () => background.handleMessage({ type: "assignment.get" }));
      assert.equal(values["kalimat.profile"].showEnglish, showEnglish);
      assert.equal(values["kalimat.profile"].preferences.showEnglish, showEnglish);
    });
  }
});

for (const legacy of [true, false]) {
  for (const operation of ["save", "clear"]) {
    for (const failedWrites of [1, 3]) {
      test(`${legacy ? "legacy" : "current"} profile preserves pending ${operation} after ${failedWrites} write failure${failedWrites === 1 ? "" : "s"} and background reconstruction`, async () => {
        for (const showEnglish of [false, true]) {
          const initial = retainedProfile("2026-07-30", 1, {
            wordStates: { 2: { saved: true } }, favorites: { 2: true }, showEnglish,
          });
          initial.preferences.showEnglish = showEnglish;
          if (legacy) delete initial.showEnglish;
          const expectAction = (value) => {
            if (operation === "save") {
              assert.equal(value.wordStates[1]?.saved, true);
              assert.equal(value.favorites[1], true);
              assert.equal(value.wordStates[2]?.saved, true);
              assert.equal(value.favorites[2], true);
              assert.equal(value.assignments["2026-07-30"].wordId, 1);
              assert.equal(value.showEnglish, showEnglish);
              assert.equal(value.preferences.showEnglish, showEnglish);
            } else {
              for (const key of ["wordStates", "favorites", "assignments", "history", "srs"]) {
                assert.deepEqual(Object.keys(value[key]), []);
              }
            }
          };
          let persisted;
          await withBackground({ profile: initial, vocabulary: realVocabulary, profileSetFailures: failedWrites }, async ({ background, values }) => {
            const original = structuredClone(values["kalimat.profile"]);
            const result = await background.handleMessage(operation === "save"
              ? { type: "word.save", wordId: 1, saved: true }
              : { type: "state.clear" });
            assert.equal(result.kind, "ok");
            assert.equal(result.storageWarning, true);
            if (operation === "clear") {
              assert.equal(result.profilePersisted, false);
              assert.equal(result.reminderWarning, false);
            }
            assert.deepEqual(values["kalimat.profile"], original);
            for (let attempt = 1; attempt < failedWrites; attempt++) {
              const pending = await background.handleMessage({ type: "state.export" });
              assert.equal(pending.kind, "export");
              assert.equal(pending.storageWarning, true);
              expectAction(JSON.parse(pending.text));
              assert.deepEqual(values["kalimat.profile"], original);
            }
            const recovered = await background.handleMessage({ type: "state.export" });
            assert.equal(recovered.kind, "export");
            assert.equal(recovered.storageWarning, undefined);
            expectAction(JSON.parse(recovered.text));
            persisted = structuredClone(values["kalimat.profile"]);
            assert.deepEqual(JSON.parse(recovered.text), persisted);
          });
          // Recreate module state only after the pending profile is durably saved.
          await withBackground({ profile: persisted, vocabulary: realVocabulary }, async ({ background }) => {
            const restored = await background.handleMessage({ type: "state.export" });
            assert.equal(restored.kind, "export");
            assert.equal(restored.storageWarning, undefined);
            assert.deepEqual(JSON.parse(restored.text), persisted);
            expectAction(JSON.parse(restored.text));
          });
        }
      });
    }
  }
}

for (const newerLegacy of [true, false]) {
  test(`a newer ${newerLegacy ? "legacy" : "current"} durable profile supersedes a pending legacy save`, async () => {
    const original = profile();
    delete original.showEnglish;
    const newer = profile({ level: 3, showEnglish: true, wordStates: { 2: { saved: true } }, favorites: { 2: true } });
    newer.preferences.showEnglish = true;
    if (newerLegacy) delete newer.showEnglish;
    await withBackground({ profile: original, vocabulary: realVocabulary, profileSetFailures: 1 }, async ({ background, values }) => {
      const result = await background.handleMessage({ type: "word.save", wordId: 1, saved: true });
      assert.equal(result.storageWarning, true);
      values["kalimat.profile"] = structuredClone(newer);
      const exported = await background.handleMessage({ type: "state.export" });
      assert.equal(exported.kind, "export");
      assert.equal(exported.storageWarning, undefined);
      const restored = JSON.parse(exported.text);
      assert.equal(restored.level, 3);
      assert.equal(restored.wordStates[1], undefined);
      assert.equal(restored.favorites[1], undefined);
      assert.equal(restored.wordStates[2].saved, true);
      assert.equal(restored.favorites[2], true);
      assert.equal(restored.showEnglish, true);
      assert.equal(restored.preferences.showEnglish, true);
      assert.deepEqual(restored, values["kalimat.profile"]);
    });
  });
}

test("assignment response restores validated feedback, save, and English visibility", async () => {
  const existing = profile({
    showEnglish: false,
    assignments: { "2026-07-30": { wordId: "w1", status: "known" } },
    wordStates: { w1: { status: "known", dateKey: "2026-07-30", saved: true } },
    assignmentOrdinal: 1,
  });
  await withBackground({ profile: existing }, async ({ background }) => {
    await withLocalDay("2026-07-30", async () => {
      assert.deepEqual(await background.handleMessage({ type: "assignment.get" }), {
        kind: "assigned", wordId: "w1", dateKey: "2026-07-30", word: word("w1"), status: "known", saved: true, showEnglish: false,
      });
    });
  });
});

test("a profile read failure never fabricates a daily assignment and reports a warning", async () => {
  await withBackground({ storageFailure: true }, async ({ background }) => {
    await withLocalDay("2026-07-30", async () => {
      const first = await background.handleMessage({ type: "assignment.get" });
      const second = await background.handleMessage({ type: "assignment.get" });
      assert.deepEqual(first, second);
      assert.equal(first.kind, "no-new-word");
      assert.equal(first.storageWarning, true);
      assert.equal((await background.handleMessage({ type: "state.export" })).storageWarning, true);
    });
  });
});

test("a transient write failure keeps the source session assignment until persistence succeeds", async () => {
  const original = sourceProfile();
  await withBackground({ profile: original, storageSetFailures: 1, fetch: freeSourceFetch([]) }, async ({ background, values }) => {
    await withLocalDay("2026-07-30", async () => {
      assert.equal((await background.handleMessage({ type: "assignment.get" })).storageWarning, true);
      const exported = await background.handleMessage({ type: "state.export" });
      assert.ok(JSON.parse(exported.text).assignments["2026-07-30"]);
      assert.ok(values["kalimat.profile"].assignments["2026-07-30"]);
    });
  });
});

test("a newer persisted profile wins over a stale session fallback", async () => {
  const original = sourceProfile();
  const newer = profile({ level: 3 });
  await withBackground({ profile: original, storageSetFailures: 1, fetch: freeSourceFetch([]) }, async ({ background, values }) => {
    await withLocalDay("2026-07-30", async () => {
      await background.handleMessage({ type: "assignment.get" });
      values["kalimat.profile"] = newer;
      const exported = await background.handleMessage({ type: "state.export" });
      assert.equal(JSON.parse(exported.text).level, 3);
      assert.equal(JSON.parse(exported.text).assignments["2026-07-30"], undefined);
    });
  });
});

test("a transient import write retries against its original storage baseline", async () => {
  const imported = profile({ level: 3 });
  await withBackground({ profile: profile(), storageSetFailures: 1 }, async ({ background, values }) => {
    const result = await background.handleMessage({ type: "state.import", text: JSON.stringify(imported) });
    assert.equal(result.storageWarning, true);
    const exported = await background.handleMessage({ type: "state.export" });
    assert.equal(JSON.parse(exported.text).level, 3);
    assert.equal(values["kalimat.profile"].level, 3);
  });
});

test("a transient clear write retries against its original storage baseline", async () => {
  const original = profile({ wordStates: { w1: { saved: true } } });
  await withBackground({ profile: original, storageSetFailures: 1 }, async ({ background, values }) => {
    const result = await background.handleMessage({ type: "state.clear" });
    assert.equal(result.storageWarning, true);
    assert.equal(result.reminderWarning, false);
    const exported = await background.handleMessage({ type: "state.export" });
    assert.deepEqual(JSON.parse(exported.text).wordStates, {});
    assert.deepEqual(Object.keys(values["kalimat.profile"].wordStates), []);
  });
});

test("a newer profile wins after a transient import write failure", async () => {
  const newer = profile({ level: 4 });
  await withBackground({ profile: profile(), storageSetFailures: 1 }, async ({ background, values }) => {
    await background.handleMessage({ type: "state.import", text: JSON.stringify(profile({ level: 3 })) });
    values["kalimat.profile"] = newer;
    const exported = await background.handleMessage({ type: "state.export" });
    assert.equal(JSON.parse(exported.text).level, 4);
  });
});

test("an import after a failed read retains the session profile until storage returns", async () => {
  await withBackground({ storageFailure: true }, async ({ background, values, setStorageAvailable }) => {
    const result = await background.handleMessage({ type: "state.import", text: JSON.stringify(profile({ level: 3 })) });
    assert.equal(result.storageWarning, true);
    setStorageAvailable(true);
    const exported = await background.handleMessage({ type: "state.export" });
    assert.equal(JSON.parse(exported.text).level, 3);
    assert.equal(values["kalimat.profile"].level, 3);
  });
});

test("valid recovery import replaces raw state and exits recovery mode", async () => {
  const invalid = { schemaVersion: 999, marker: "keep" };
  const imported = profile({ level: 3 });
  await withBackground({ profile: invalid }, async ({ background, values }) => {
    assert.deepEqual(await background.handleMessage({ type: "assignment.get" }), { kind: "recovery", recoveryRaw: invalid });
    assert.deepEqual(await background.handleMessage({ type: "state.import", text: JSON.stringify(imported) }), { kind: "ok" });
    assert.equal((await background.handleMessage({ type: "state.export" })).kind, "export");
    assert.equal(JSON.parse((await background.handleMessage({ type: "state.export" })).text).level, 3);
    assert.equal(values["kalimat.profile"].schemaVersion, 1);
  });
});

test("invalid stored state remains untouched and returns recovery mode", async () => {
  const invalid = { schemaVersion: 999, marker: "keep" };
  await withBackground({ profile: invalid }, async ({ background, values, calls }) => {
    assert.deepEqual(await background.handleMessage({ type: "assignment.get" }), { kind: "recovery", recoveryRaw: invalid });
    assert.deepEqual(values["kalimat.profile"], invalid);
    assert.equal(calls.set, 0);
  });
});

test("onboarding leaves invalid stored state in recovery mode", async () => {
  const invalid = { schemaVersion: 999, marker: "keep" };
  await withBackground({ profile: invalid }, async ({ background, values, calls }) => {
    assert.deepEqual(await background.handleMessage({ type: "onboarding.complete", level: 2, interests: ["travel"] }), { kind: "recovery", recoveryRaw: invalid });
    assert.deepEqual(values["kalimat.profile"], invalid);
    assert.equal(calls.set, 0);
  });
});

test("clearing state disables the separate reminder and cancels its alarm", async () => {
  await withBackground({ profile: profile(), reminder: { enabled: true, time: "09:00" }, alarm: { name: "kalimat.reminder", when: Date.now() + 1000 } }, async ({ background, values, alarms, calls }) => {
    const result = await background.handleMessage({ type: "state.clear" });
    assert.equal(result.kind, "ok");
    assert.deepEqual(values["kalimat.reminder"], { enabled: false, time: "09:00" });
    assert.equal(alarms.has("kalimat.reminder"), false);
    assert.ok(calls.clear >= 1);
  });
});

test("clearing state reports storage warning without clearing an alarm when reminder persistence fails", async () => {
  await withBackground({ profile: profile(), reminder: { enabled: true, time: "09:00" }, alarm: { name: "kalimat.reminder", when: Date.now() + 1000 }, storageSetFailures: 2 }, async ({ background, alarms }) => {
    const result = await background.handleMessage({ type: "state.clear" });
    assert.equal(result.kind, "ok");
    assert.equal(result.storageWarning, true);
    assert.equal(result.reminderWarning, true);
    assert.equal(alarms.has("kalimat.reminder"), true);
  });
});

test("background never requests optional permissions", async () => {
  await withBackground({ permissions: false }, async ({ background, calls }) => {
    await background.handleMessage({ type: "reminder.configure", enabled: true, time: "09:00" });
    assert.equal(calls.permissionRequests, 0);
  });
});

test("reminder configuration stores a valid time and schedules the next local occurrence", async () => {
  await withBackground({ permissions: true }, async ({ background, values, calls }) => {
    const result = await background.handleMessage({ type: "reminder.configure", enabled: true, time: "09:00" });
    assert.deepEqual(result, { enabled: true, time: "09:00" });
    assert.deepEqual(values["kalimat.reminder"], { enabled: true, time: "09:00" });
    assert.equal(calls.create.length, 1);
    assert.equal(calls.create[0].name, "kalimat.reminder");
    assert.ok(calls.create[0].details.when > Date.now());
  });
});

test("reminder enable rolls storage back when alarm creation fails", async () => {
  await withBackground({ permissions: true, alarmCreateFailures: 1 }, async ({ background, values, alarms }) => {
    const result = await background.handleMessage({ type: "reminder.configure", enabled: true, time: "09:00" });
    assert.deepEqual(result, { enabled: false, time: "09:00", storageWarning: true });
    assert.deepEqual(values["kalimat.reminder"], { enabled: false, time: "09:00" });
    assert.equal(alarms.has("kalimat.reminder"), false);
  });
});

test("reminder disable rolls storage back when alarm clearing fails", async () => {
  const alarm = { name: "kalimat.reminder", when: Date.now() + 60000 };
  await withBackground({ reminder: { enabled: true, time: "09:00" }, alarm, alarmClearFailures: 1 }, async ({ background, values, alarms }) => {
    const result = await background.handleMessage({ type: "reminder.configure", enabled: false, time: "09:00" });
    assert.deepEqual(result, { enabled: true, time: "09:00", storageWarning: true });
    assert.deepEqual(values["kalimat.reminder"], { enabled: true, time: "09:00" });
    assert.equal(alarms.has("kalimat.reminder"), true);
  });
});

test("failed reminder persistence leaves the existing alarm and setting authoritative", async () => {
  const alarm = { name: "kalimat.reminder", when: Date.now() + 60000 };
  await withBackground({ reminder: { enabled: true, time: "09:00" }, alarm, storageSetFailures: 1 }, async ({ background, values, alarms }) => {
    const result = await background.handleMessage({ type: "reminder.configure", enabled: true, time: "10:00" });
    assert.deepEqual(result, { enabled: true, time: "09:00", storageWarning: true });
    assert.deepEqual(values["kalimat.reminder"], { enabled: true, time: "09:00" });
    assert.equal(alarms.has("kalimat.reminder"), true);
  });
});

test("unknown alarm snapshots never clear an existing alarm during a failed disable rollback", async () => {
  const alarm = { name: "kalimat.reminder", when: Date.now() + 60000 };
  await withBackground({ reminder: { enabled: true, time: "09:00" }, alarm, alarmGetFailures: 2, alarmClearFailures: 1 }, async ({ background, values, alarms }) => {
    const result = await background.handleMessage({ type: "reminder.configure", enabled: false, time: "09:00" });
    assert.deepEqual(result, { enabled: true, time: "09:00", storageWarning: true });
    assert.deepEqual(values["kalimat.reminder"], { enabled: true, time: "09:00" });
    assert.equal(alarms.has("kalimat.reminder"), true);
  });
});

test("startup reconciliation create failures are surfaced by settings", async () => {
  await withBackground({ reminder: { enabled: true, time: "09:00" }, alarmCreateFailures: 1 }, async ({ background }) => {
    const settings = await background.handleMessage({ type: "settings.get" });
    assert.deepEqual(settings, { kind: "settings", reminder: { enabled: true, time: "09:00" }, storageWarning: true });
  });
});

test("startup reconciliation retains and retries a warning whose marker write fails", async () => {
  await withBackground({ reminder: { enabled: true, time: "09:00" }, alarmCreateFailures: 2, reminderWarningSetFailures: 2 }, async ({ background, extension, values }) => {
    await extension.runtime.onStartup.listeners[0]();
    const settings = await background.handleMessage({ type: "settings.get" });
    assert.deepEqual(settings, { kind: "settings", reminder: { enabled: true, time: "09:00" }, storageWarning: true });
    assert.equal(values["kalimat.reminder.warning"], true);
  });
});

test("disabled stale-alarm reconciliation failures are surfaced by settings", async () => {
  const alarm = { name: "kalimat.reminder", when: Date.now() + 60000 };
  await withBackground({ reminder: { enabled: false, time: "09:00" }, alarm, alarmClearFailures: 1 }, async ({ background }) => {
    const settings = await background.handleMessage({ type: "settings.get" });
    assert.deepEqual(settings, { kind: "settings", reminder: { enabled: false, time: "09:00" }, storageWarning: true });
  });
});

test("permission revocation clear failures surface a warning without claiming disabled storage", async () => {
  const alarm = { name: "kalimat.reminder", when: Date.now() + 60000 };
  await withBackground({ reminder: { enabled: true, time: "09:00" }, alarm, alarmClearFailures: 1 }, async ({ background, extension, setPermissions }) => {
    await new Promise(setImmediate);
    setPermissions(false);
    await extension.permissions.onRemoved.listeners[0]({ permissions: ["notifications"] });
    const settings = await background.handleMessage({ type: "settings.get" });
    assert.deepEqual(settings, { kind: "settings", reminder: { enabled: true, time: "09:00" }, storageWarning: true });
  });
});

test("permission revocation retains and retries a warning whose marker write fails", async () => {
  const alarm = { name: "kalimat.reminder", when: Date.now() + 60000 };
  await withBackground({ reminder: { enabled: true, time: "09:00" }, alarm, alarmClearFailures: 1, reminderWarningSetFailures: 1 }, async ({ background, extension, setPermissions, values }) => {
    await new Promise(setImmediate);
    setPermissions(false);
    await extension.permissions.onRemoved.listeners[0]({ permissions: ["notifications"] });
    const settings = await background.handleMessage({ type: "settings.get" });
    assert.deepEqual(settings, { kind: "settings", reminder: { enabled: true, time: "09:00" }, storageWarning: true });
    assert.equal(values["kalimat.reminder.warning"], true);
  });
});

test("notifications use Arabic title and body", async () => {
  await withBackground({ reminder: { enabled: true, time: "09:00" }, permissions: true }, async ({ extension, calls }) => {
    await new Promise(setImmediate);
    await extension.alarms.onAlarm.listeners[0]({ name: "kalimat.reminder" });
    assert.match(calls.notifications[0].options.title, /[\u0600-\u06ff]/);
    assert.match(calls.notifications[0].options.message, /[\u0600-\u06ff]/);
  });
});

test("notification failure persists a reminder warning after the alarm clears", async () => {
  await withBackground({ reminder: { enabled: true, time: "09:00" }, notificationFailure: true }, async ({ extension, calls, values }) => {
    await new Promise(setImmediate);
    await extension.alarms.onAlarm.listeners[0]({ name: "kalimat.reminder" });
    assert.ok(calls.clear >= 1);
    assert.equal(values["kalimat.reminder.warning"], true);
  });
});

test("startup recreates a missing enabled reminder alarm", async () => {
  await withBackground({ reminder: { enabled: true, time: "09:00" } }, async ({ extension, calls }) => {
    await extension.runtime.onStartup.listeners[0]();
    assert.equal(calls.create.length, 1);
  });
});

test("notification clicks open Atlas so the normal daily assignment flow runs", async () => {
  await withBackground({}, async ({ extension, calls }) => {
    await withLocalDay("2026-07-30", async () => extension.notifications.onClicked.listeners[0]("kalimat.reminder"));
    assert.deepEqual(calls.tabs, [{ url: "extension://kalimat/atlas/atlas.html" }]);
  });
});

test("revoked permissions disable reminders without changing assignments", async () => {
  const existing = profile({ assignments: { "2026-07-30": { wordId: "w1" } }, assignmentOrdinal: 1 });
  await withBackground({ profile: existing, reminder: { enabled: true, time: "09:00" }, permissions: true }, async ({ extension, values, calls, setPermissions }) => {
    setPermissions(false);
    await extension.permissions.onRemoved.listeners[0]({ permissions: ["notifications"] });
    assert.deepEqual(values["kalimat.reminder"], { enabled: false, time: "09:00" });
    assert.equal(values["kalimat.profile"].assignments["2026-07-30"].wordId, "w1");
    assert.ok(calls.clear >= 1);
  });
});

test("permission revocation preserves the alarm when disabling settings fails", async () => {
  await withBackground({ reminder: { enabled: true, time: "09:00" }, permissions: true, storageSetFailures: 1 }, async ({ extension, values, alarms, calls, setPermissions }) => {
    await new Promise(setImmediate);
    setPermissions(false);
    await assert.doesNotReject(extension.permissions.onRemoved.listeners[0]({ permissions: ["notifications"] }));
    assert.equal(alarms.has("kalimat.reminder"), true);
    assert.equal(calls.clear, 0);
    assert.deepEqual(values["kalimat.reminder"], { enabled: true, time: "09:00" });
  });
});

test("alarm and notification event listeners consume failing side effects", async () => {
  await withBackground({ reminder: { enabled: true, time: "09:00" }, notificationFailure: true, tabFailure: true }, async ({ extension }) => {
    await new Promise(setImmediate);
    await assert.doesNotReject(extension.alarms.onAlarm.listeners[0]({ name: "kalimat.reminder" }));
    await assert.doesNotReject(extension.notifications.onClicked.listeners[0]("kalimat.reminder"));
  });
});

test("alarm firing surfaces a reminder warning when clearing the alarm fails", async () => {
  const alarm = { name: "kalimat.reminder", when: Date.now() + 60000 };
  await withBackground({ reminder: { enabled: true, time: "09:00" }, alarm, alarmClearFailures: 1 }, async ({ background, extension }) => {
    await new Promise(setImmediate);
    await extension.alarms.onAlarm.listeners[0]({ name: "kalimat.reminder" });
    const settings = await background.handleMessage({ type: "settings.get" });
    assert.deepEqual(settings, { kind: "settings", reminder: { enabled: true, time: "09:00" }, storageWarning: true });
  });
});

test("startup and install listeners consume reminder storage failures", async () => {
  await withBackground({ storageFailure: true }, async ({ extension }) => {
    await assert.doesNotReject(extension.runtime.onStartup.listeners[0]());
    await assert.doesNotReject(extension.runtime.onInstalled.listeners[0]());
  });
});

test("background evaluation realigns an enabled stale reminder alarm", async () => {
  await withBackground({ reminder: { enabled: true, time: "09:00" }, alarm: { name: "kalimat.reminder", when: 0 } }, async ({ calls }) => {
    await new Promise(setImmediate);
    assert.equal(calls.create.length, 1);
    assert.equal(calls.create[0].name, "kalimat.reminder");
  });
});

test("a new valid-date assignment prunes 5,001 records while lifetime cadence continues", async () => {
  const assignments = Object.create(null);
  for (let index = 0; index < 5000; index += 1) assignments[new Date(Date.UTC(2000, 0, index + 1)).toISOString().slice(0, 10)] = { wordId: "interest" };
  const existing = sourceProfile({ assignments, assignmentOrdinal: 5004 });
  await withBackground({ profile: existing, fetch: freeSourceFetch([]), vocabulary: [word("interest"), word("outside", { topics: ["food"], usefulnessBand: "low" })] }, async ({ background, values }) => {
    await withLocalDay("2026-07-30", async () => {
      assert.equal((await background.handleMessage({ type: "assignment.get" })).word.word, "استنزاف");
    });
    assert.equal(Object.keys(values["kalimat.profile"].assignments).length, 5000);
    assert.equal(values["kalimat.profile"].assignmentOrdinal, 5005);
    assert.ok(String(values["kalimat.profile"].assignments["2026-07-30"].wordId).startsWith("wk_"));
    assert.equal(Object.hasOwn(values["kalimat.profile"].assignments, "2000-01-01"), false);
  });
});

test("online.lookup rejects unknown fields, wordId/lang options, malformed queries, and prototype keys", async () => {
  await withBackground({}, async ({ background }) => {
    // Extra/unexpected fields
    await assert.rejects(background.handleMessage({ type: "online.lookup", query: "كلمة", wordId: "w1" }), /Invalid lookup/i);
    await assert.rejects(background.handleMessage({ type: "online.lookup", query: "كلمة", word: "كلمة" }), /Invalid lookup/i);
    await assert.rejects(background.handleMessage({ type: "online.lookup", query: "كلمة", lang: "ar" }), /Invalid lookup/i);
    await assert.rejects(background.handleMessage({ type: "online.lookup", query: "كلمة", provider: "wiktionary" }), /Invalid lookup/i);
    await assert.rejects(background.handleMessage({ type: "online.lookup", query: "كلمة", url: "https://ar.wiktionary.org" }), /Invalid lookup/i);
    await assert.rejects(background.handleMessage({ type: "online.lookup", query: "كلمة", headers: {} }), /Invalid lookup/i);
    await assert.rejects(background.handleMessage({ type: "online.lookup", query: "كلمة", options: {} }), /Invalid lookup/i);
    await assert.rejects(background.handleMessage({ type: "online.lookup", query: "كلمة", extra: true }), /Invalid lookup/i);
    // Malformed query values
    await assert.rejects(background.handleMessage({ type: "online.lookup", query: "" }), /Invalid lookup/i);
    await assert.rejects(background.handleMessage({ type: "online.lookup", query: "   " }), /Invalid lookup/i);
    await assert.rejects(background.handleMessage({ type: "online.lookup", query: 123 }), /Invalid lookup/i);
    await assert.rejects(background.handleMessage({ type: "online.lookup", query: "a".repeat(257) }), /Invalid lookup/i);
    await assert.rejects(background.handleMessage({ type: "online.lookup", query: "__proto__" }), /Invalid lookup/i);
  });
});

test("online.lookup returns permission-needed when Chrome optional host permission is not granted", async () => {
  await withBackground({ hostPermissions: false }, async ({ background, calls }) => {
    const result = await background.handleMessage({ type: "online.lookup", query: "كلمة" });
    assert.deepEqual(result, { kind: "permission-needed" });
    assert.equal(calls.permissionRequests, 0, "Background service worker must never request permissions directly");
  });
});

test("online.lookup returns unsupported on Firefox without host permissions", async () => {
  await withBackground({ api: "browser", hostPermissions: false }, async ({ background }) => {
    const result = await background.handleMessage({ type: "online.lookup", query: "كلمة" });
    assert.deepEqual(result, { kind: "unsupported" });
  });
});

test("online.lookup canonicalizes Arabic query for the fixed plain-text API and preserves hamzas", async () => {
  const urls = [];
  await withBackground({
    hostPermissions: true,
    fetch: async (url) => {
      urls.push(url);
      return {
        ok: true,
        status: 200,
        headers: new Map([["content-type", "application/json; charset=utf-8"]]),
        async text() {
          return JSON.stringify({ query: { pages: [{ pageid: 1, title: "\u0627\u0644\u064a", extract: "\u062a\u0639\u0631\u064a\u0641" }] } });
        },
      };
    },
  }, async ({ background }) => {
    const result = await background.handleMessage({ type: "online.lookup", query: "\u0640\u0625\u0650\u0644\u064e\u0649\u0670" });
    assert.equal(result.kind, "online-result");
    assert.equal(result.query, "\u0627\u0644\u064a");
    assert.equal(new URL(urls[0]).searchParams.get("titles"), "\u0627\u0644\u064a");

    await background.handleMessage({ type: "online.lookup", query: "\u0624\u0626" });
    assert.equal(new URL(urls[1]).searchParams.get("titles"), "\u0624\u0626");
  });
});

test("online.lookup requires JSON content type and rejects HTML-shaped or malformed payloads", async () => {
  for (const response of [
    { ok: true, status: 200, async text() { return JSON.stringify({ query: { pages: [{ pageid: 1, title: "\u0643\u0644\u0645\u0629", extract: "\u0645\u0639\u0646\u0649" }] } }); } },
    { ok: true, status: 200, headers: new Map([["content-type", "text/html"]]), async text() { return "<p>\u0645\u0639\u0646\u0649</p>"; } },
    { ok: true, status: 200, headers: new Map([["content-type", "application/json"]]), async text() { return JSON.stringify({ parse: { title: "\u0643\u0644\u0645\u0629", text: { "*": "<p>\u0645\u0639\u0646\u0649</p>" } } }); } },
    { ok: true, status: 200, headers: new Map([["content-type", "application/json"]]), async text() { return JSON.stringify({ query: { pages: [{ pageid: 1, title: "\u0643\u0644\u0645\u0629" }] } }); } },
    { ok: true, status: 200, headers: new Map([["content-type", "application/json"]]), async text() { return JSON.stringify({ error: { code: "badrequest" } }); } },
    { ok: false, status: 503, headers: new Map([["content-type", "application/json"]]), async text() { return JSON.stringify({}); } },
    { ok: true, status: 200, headers: new Map([["content-type", "application/json"]]), async text() { return "x".repeat(262145); } },
  ]) {
    await withBackground({ hostPermissions: true, fetch: async () => response }, async ({ background }) => {
      const result = await background.handleMessage({ type: "online.lookup", query: "\u0643\u0644\u0645\u0629" });
      assert.equal(result.kind, "error");
    });
  }
});

test("online.lookup uses fixed ar.wiktionary.org endpoint with security options and returns safe online-result DTO", async () => {
  const hostilePayload = {
    query: { pages: [{ pageid: 1, title: "كَلِمَة", extract: "لفظ يدل على معنى." }] },
  };
  let capturedFetchOptions = null;
  await withBackground({
    hostPermissions: true,
    fetch: async (url, options) => {
      capturedFetchOptions = { url, ...options };
      assert.match(url, /^https:\/\/ar\.wiktionary\.org\//i, "Must only fetch from fixed ar.wiktionary.org endpoint");
      return {
        ok: true,
        status: 200,
        headers: new Map([["content-type", "application/json"]]),
        async json() { return hostilePayload; },
        async text() { return JSON.stringify(hostilePayload); },
      };
    },
  }, async ({ background }) => {
    const result = await background.handleMessage({ type: "online.lookup", query: "كَلِمَة" });
    assert.equal(result.kind, "online-result");
    assert.equal(result.query, "كلمة");
    assert.equal(result.unreviewed, true);
    assert.equal(typeof result.headword, "string");
    assert.equal(typeof result.definitionAr, "string");
    assert.equal(typeof result.sourceUrl, "string");
    assert.match(result.sourceUrl, /^https:\/\/ar\.wiktionary\.org\//i);
    assert.equal(typeof result.retrievedAt, "string");
    assert.doesNotMatch(result.definitionAr, /<script|<img|onerror|javascript:/i, "definitionAr must remain plain text");
    assert.ok(result.definitionAr.length > 0);

    // Verify fetch security constraints
    assert.equal(capturedFetchOptions.credentials, "omit");
    assert.equal(capturedFetchOptions.redirect, "error");
    assert.equal(capturedFetchOptions.cache, "no-store");
    assert.ok(capturedFetchOptions.signal !== undefined, "Fetch must include an abort signal timeout");
  });
});

test("online.lookup handles remote 404, network errors, and hostile/oversized responses safely", async () => {
  await withBackground({
    hostPermissions: true,
    fetch: async () => ({ ok: false, status: 404, async json() { return {}; }, async text() { return "Not found"; } }),
  }, async ({ background }) => {
    const result = await background.handleMessage({ type: "online.lookup", query: "غيرموجود" });
    assert.equal(result.kind, "not-found");
  });

  await withBackground({
    hostPermissions: true,
    fetch: async () => { throw new Error("Network offline"); },
  }, async ({ background }) => {
    const result = await background.handleMessage({ type: "online.lookup", query: "كلمة" });
    assert.equal(result.kind, "error");
  });
});

test("online.lookup is strictly read-only and never modifies profile or assignment state", async () => {
  const initialProfile = profile({ assignments: { "2026-07-30": { wordId: "w1" } }, assignmentOrdinal: 1 });
  await withBackground({
    profile: initialProfile,
    hostPermissions: true,
    fetch: async () => ({ ok: true, status: 200, headers: new Map([["content-type", "application/json"]]), async text() { return JSON.stringify({ query: { pages: [{ pageid: 1, title: "كلمة", extract: "معنى" }] } }); } }),
  }, async ({ background, values, calls }) => {
    await background.handleMessage({ type: "online.lookup", query: "كلمة" });
    assert.deepEqual(values["kalimat.profile"].assignments, initialProfile.assignments);
    assert.equal(values["kalimat.profile"].assignmentOrdinal, 1);
    assert.equal(calls.set, 0);
  });
});


test("saved-only save and unsave survive export/import without SRS enrollment", async () => {
  await withBackground({}, async ({ background, values }) => {
    await background.handleMessage({ type: "word.save", wordId: "w1", saved: true });
    let exported = await background.handleMessage({ type: "state.export" });
    let profile = JSON.parse(exported.text);
    assert.equal(profile.favorites.w1, true);
    assert.equal(profile.srs.w1, undefined);
    await background.handleMessage({ type: "word.save", wordId: "w1", saved: false });
    exported = await background.handleMessage({ type: "state.export" });
    profile = JSON.parse(exported.text);
    assert.equal(profile.favorites.w1, undefined);
    await background.handleMessage({ type: "state.import", text: exported.text });
    assert.equal(values["kalimat.profile"].favorites.w1, undefined);
    assert.equal(values["kalimat.profile"].srs.w1, undefined);
  });
});


test("daily feedback replay and corrections preserve a same-grade deliberate review", async () => {
  await withBackground({ profile: retainedProfile() }, async ({ background, values }) => {
    const assignment = await background.handleMessage({ type: "assignment.get" });
    const feedback = { type: "word.feedback", wordId: assignment.wordId, dateKey: assignment.dateKey, status: "known" };
    await background.handleMessage(feedback);
    await background.handleMessage(feedback);
    assert.equal(values["kalimat.profile"].srs[assignment.wordId].reviewCount, 1);
    const review = { type: "word.review", wordId: assignment.wordId, dateKey: assignment.dateKey, rating: "good" };
    await background.handleMessage(review);
    const practiced = JSON.stringify(values["kalimat.profile"].srs);
    assert.equal(values["kalimat.profile"].srs[assignment.wordId].reviewCount, 2);
    await background.handleMessage(review);
    await background.handleMessage({ ...feedback, status: "difficult" });
    await background.handleMessage(feedback);
    assert.equal(JSON.stringify(values["kalimat.profile"].srs), practiced);
  });
});

for (const mutation of ["clear", "replacement import"]) {
  test(`background rejects an old queued review after ${mutation} without restoring learner data`, async () => {
    await withBackground({ vocabulary: realVocabulary, profile: retainedProfile("2026-08-16", 1) }, async ({ background, values, calls }) => {
      await withLocalDay("2026-08-17", async () => {
        let assigned;
        await withLocalDay("2026-08-16", async () => {
          assigned = await background.handleMessage({ type: "assignment.get" });
          await background.handleMessage({ type: "word.feedback", wordId: assigned.wordId, dateKey: assigned.dateKey, status: "difficult" });
        });
        const queue = await background.handleMessage({ type: "review.queue" });
        assert.equal(queue.words[0].word.id, assigned.wordId);
        const retainedId = assigned.wordId === 1 ? 2 : 1;
        if (mutation === "clear") await background.handleMessage({ type: "state.clear" });
        else {
          const imported = require("../shared/state.js").recordReview(profile({ favorites: { [retainedId]: true } }), retainedId, "again", "2026-08-16", realVocabulary);
          await background.handleMessage({ type: "state.import", text: JSON.stringify(imported) });
        }
        const before = JSON.stringify(values["kalimat.profile"]);
        const writes = calls.set;
        const result = await background.handleMessage({ type: "word.review", wordId: `w${assigned.wordId}`, rating: "good", dateKey: "2026-08-17" });
        assert.equal(result.kind, "stale");
        assert.equal(JSON.stringify(values["kalimat.profile"]), before, "deleted history, SRS and wordStates must stay deleted");
        assert.equal(calls.set, writes, "stale reviews must not persist anything");
        const currentQueue = await background.handleMessage({ type: "review.queue" });
        assert.deepEqual(currentQueue.words.map((item) => item.word.id), mutation === "clear" ? [] : [retainedId]);
      });
    });
  });
}


test("repeated failed review writes never become durable success", async () => {
  const fixture = loadBackground({ profile: retainedProfile() });
  try {
    const assigned = await fixture.background.handleMessage({ type: "assignment.get" });
    await fixture.background.handleMessage({ type: "word.feedback", wordId: assigned.wordId, dateKey: assigned.dateKey, status: "known" });
    const count = fixture.values["kalimat.profile"].srs[assigned.wordId].reviewCount;
    const set = fixture.extension.storage.local.set;
    fixture.extension.storage.local.set = async () => { throw new Error("write rejected"); };
    const message = { type: "word.review", wordId: assigned.wordId, dateKey: assigned.dateKey, rating: "good" };
    await assert.rejects(fixture.background.handleMessage(message), /not persisted/);
    await assert.rejects(fixture.background.handleMessage(message), /not persisted/);
    assert.equal(fixture.values["kalimat.profile"].srs[assigned.wordId].reviewCount, count);
    fixture.extension.storage.local.set = set;
    const recovered = await fixture.background.handleMessage(message);
    assert.equal(recovered.storageWarning, false);
    assert.equal(recovered.srs.reviewCount, count + 1);
    assert.equal((await fixture.background.handleMessage(message)).srs.reviewCount, count + 1);
  } finally { fixture.restore(); }
});


test("remote speech consent validates and survives settings export import", async () => {
  await withBackground({ profile: profile() }, async ({ background, values }) => {
    assert.equal(JSON.parse((await background.handleMessage({ type: "state.export" })).text).preferences.allowRemoteSpeech, false);
    await assert.rejects(background.handleMessage({ type: "settings.update", allowRemoteSpeech: "true" }), /Invalid settings/);
    await background.handleMessage({ type: "settings.update", allowRemoteSpeech: true });
    const exported = await background.handleMessage({ type: "state.export" });
    await background.handleMessage({ type: "settings.update", allowRemoteSpeech: false });
    await background.handleMessage({ type: "state.import", text: exported.text });
    assert.equal(values["kalimat.profile"].preferences.allowRemoteSpeech, true);
  });
});

test("clear reports profile persistence separately and returns actual reminder", async () => {
  await withBackground({ profile: profile(), reminder: { enabled: true, time: "10:30" }, alarmClearFailures: 1 }, async ({ background }) => {
    const result = await background.handleMessage({ type: "state.clear" });
    assert.equal(result.profilePersisted, true);
    assert.equal(result.reminderWarning, true);
    assert.equal(result.storageWarning, true);
    assert.deepEqual(result.reminder, { enabled: true, time: "10:30" });
  });
});


test("clear returns unknown reminder when its snapshot cannot be read without disabling an active alarm", async () => {
  await withBackground({ profile: profile(), reminder: { enabled: true, time: "10:30" }, alarm: { name: "kalimat.reminder", scheduledTime: Date.now() + 60000 } }, async ({ background, extension, values, calls, alarms }) => {
    await background.ensureReminder();
    const clearsBefore = calls.clear;
    const alarmBefore = alarms.get("kalimat.reminder");
    const get = extension.storage.local.get;
    let reads = 0;
    extension.storage.local.get = async (key) => {
      if (key === "kalimat.reminder") { reads++; throw new Error("reminder unreadable"); }
      return get(key);
    };
    const result = await background.handleMessage({ type: "state.clear" });
    assert.equal(result.profilePersisted, true);
    assert.equal(result.reminder, null);
    assert.equal(result.reminderWarning, true);
    assert.equal(result.storageWarning, true);
    assert.equal(reads, 1);
    assert.equal(calls.clear, clearsBefore);
    assert.equal(alarms.get("kalimat.reminder"), alarmBefore);
    assert.equal(values["kalimat.reminder"].enabled, true);
    assert.equal(Object.keys(values["kalimat.profile"].assignments).length, 0);
  });
});

function freeSourceFetch(calls, { offline = false } = {}) {
  return async url => {
    calls.push(url);
    if (url.includes('lmf-index.json')) return { ok: true, json: async () => [] };
    if (url.includes('discovery-index.json')) return { ok: true, json: async () => require('../data/discovery-index.json').filter(row=>row[0]==='استنزاف') };
    if (offline) throw new Error('offline');
    const data = { query: { pages: [{ pageid: 100, title: 'الموارد', lastrevid: 900, extract: 'يؤدي استنزاف الموارد الطبيعية إلى أضرار كبيرة تهدد مستقبل البشرية وحياة الكائنات، ولذلك يجب أن تعمل المؤسسات على حماية الموارد.' }] } };
    return { ok: true, headers: { get: name => name === 'content-type' ? 'application/json' : null }, text: async () => JSON.stringify(data) };
  };
}

test('discovery requires opt-in permission and never makes unrequested remote calls', async () => {
  const calls = [];
  await withBackground({ hostPermissions: false, fetch: freeSourceFetch(calls) }, async ({ background, values }) => {
    assert.equal((await background.handleMessage({ type: 'discovery.get' })).enabled, false);
    assert.equal((await background.handleMessage({ type: 'discovery.find' })).kind, 'permission-required');
    assert.equal((await background.handleMessage({ type: 'discovery.configure', enabled: true, topics: ['culture'] })).kind, 'permission-required');
    assert.equal(values['kalimat.profile'], undefined);
    assert.equal(calls.length, 0);
  });
});

test('source discovery preserves today, save and export survive a fresh worker offline', async () => {
  const calls = []; let exported, wordId, stored;
  await withLocalDay('2026-10-16', async () => {
    await withBackground({ profile: retainedProfile("2026-10-16"), fetch: freeSourceFetch(calls) }, async ({ background, values }) => {
      const before = await background.handleMessage({ type: 'assignment.get' });
      await background.handleMessage({ type: 'discovery.configure', enabled: true, topics: ['culture'] });
      const found = await background.handleMessage({ type: 'discovery.find' });
      assert.equal(found.kind, 'found'); wordId = found.word.id;
      assert.equal(found.word.meaningAr, 'إفراغ أو استهلاك الشيء حتى نفاده.');
      assert.equal((await background.handleMessage({ type: 'assignment.get' })).wordId, before.wordId);
      await background.handleMessage({ type: 'word.save', wordId, saved: true });
      exported = (await background.handleMessage({ type: 'state.export' })).text;
      stored = JSON.parse(JSON.stringify(values['kalimat.profile']));
      assert.equal(stored.favorites[wordId], true);
    });
  });
  const offlineCalls = [];
  await withLocalDay('2026-10-17', async () => {
    await withBackground({ profile: stored, fetch: freeSourceFetch(offlineCalls, { offline: true }) }, async ({ background, values }) => {
      const assigned = await background.handleMessage({ type: 'assignment.get' });
      assert.equal(assigned.wordId, wordId);
      assert.equal(assigned.saved, true);
      assert.equal(assigned.word.exampleKind, 'quotation');
      assert.equal(offlineCalls.filter(url=>url.startsWith('https://')).length, 0);
      await background.handleMessage({ type: 'state.import', text: exported });
      assert.equal((await background.handleMessage({ type: 'discovery.get' })).word.id, wordId);
      await background.handleMessage({ type: 'discovery.known', wordId });
      assert.deepEqual(values['kalimat.profile'].discovery.knownKeys, ['استنزاف']);
      assert.equal(values['kalimat.profile'].srs[wordId], undefined);
      assert.equal(values['kalimat.profile'].favorites[wordId], true);
      assert.equal((await background.handleMessage({ type: 'discovery.get' })).word, undefined);
      const next = await background.handleMessage({ type: 'assignment.get' });
      assert.notEqual(next.wordId, wordId);
      assert.equal(next.discoveryStatus, 'unavailable');
    });
  });
});

test('discovered daily words can enter and complete a deliberate review', async () => {
  await withLocalDay('2026-10-16', async () => {
    await withBackground({ fetch: freeSourceFetch([]) }, async ({ background, values }) => {
      await background.handleMessage({ type: 'discovery.configure', enabled: true, topics: [] });
      const assigned = await background.handleMessage({ type: 'assignment.get' });
      assert.match(assigned.wordId, /^wk_/);
      await background.handleMessage({ type: 'word.feedback', wordId: assigned.wordId, dateKey: assigned.dateKey, status: 'difficult' });
      const result = await background.handleMessage({ type: 'word.review', wordId: assigned.wordId, dateKey: '2026-10-17', rating: 'good' });
      assert.equal(result.kind, 'ok');
      assert.ok(values['kalimat.profile'].srs[assigned.wordId]);
      assert.equal((await background.handleMessage({ type: 'assignment.get' })).wordId, assigned.wordId);
    });
  });
});

test('a failed source snapshot write reports warning and retries without losing favorites', async () => {
  await withBackground({ profile: profile({ favorites: { w1: true } }), fetch: freeSourceFetch([]) }, async ({ background, failNextWrites, values }) => {
    await background.handleMessage({ type: 'discovery.configure', enabled: true, topics: [] });
    failNextWrites(1);
    const result = await background.handleMessage({ type: 'discovery.find' });
    assert.equal(result.kind, 'found');
    assert.equal(result.storageWarning, true);
    assert.equal(values['kalimat.profile'].wordSnapshots, undefined);
    const recovered = await background.handleMessage({ type: 'discovery.get' });
    assert.equal(recovered.word.id, result.word.id);
    assert.equal(recovered.storageWarning, undefined);
    assert.equal(values['kalimat.profile'].wordSnapshots[result.word.id].word, 'استنزاف');
    assert.equal(values['kalimat.profile'].favorites.w1, true);
  });
});

test('an unavailable daily source can retry immediately when the source recovers', async () => {
  const calls = [];
  let offline = true;
  await withBackground({ profile: sourceProfile(), fetch: url => freeSourceFetch(calls, { offline })(url) }, async ({ background, values }) => {
    const failed = await background.handleMessage({ type: 'assignment.get' });
    assert.equal(failed.kind, 'no-new-word');
    assert.equal(failed.discoveryStatus, 'unavailable');
    assert.equal(Object.keys(values['kalimat.profile'].assignments).length, 0);
    const count = calls.length;
    offline = false;
    assert.equal((await background.handleMessage({ type: 'assignment.get' })).kind, 'no-new-word');
    assert.equal(calls.length, count, 'Automatic reopens retain the short network cooldown');
    const retried = await background.handleMessage({ type: 'assignment.get', retry: true });
    assert.equal(retried.kind, 'assigned');
    assert.equal(retried.word.word, 'استنزاف');
    assert.ok(calls.length > count);
    assert.equal(Object.keys(values['kalimat.profile'].assignments).length, 1);
  });
});

test('saving cannot make an otherwise valid source backup exceed its import budget', async () => {
  const state = require('../shared/state.js');
  let source;
  await withBackground({ fetch: freeSourceFetch([]) }, async ({ background }) => {
    await background.handleMessage({ type: 'discovery.configure', enabled: true, topics: [] });
    source = (await background.handleMessage({ type: 'discovery.find' })).word;
  });
  const large = profile({ wordSnapshots: {}, discovery: { enabled: false, topics: [], knownKeys: [] } });
  for (let i = 1; i <= 512; i++) {
    const id = `wk_${i}_abcdef12`;
    large.wordSnapshots[id] = { ...source, id, meaningAr: 'ك'.repeat(680), exampleAr: 'ك'.repeat(800) };
  }
  const limit = 2 * 1024 * 1024;
  let size = Buffer.byteLength(state.serializeExport(large));
  for (let i = 0; i < 2048; i++) {
    const key = String(i) + 'ك'.repeat(70);
    const added = Buffer.byteLength(JSON.stringify(key)) + (i ? 1 : 0);
    if (size + added > limit - 8) {
      const last = 'ن'.repeat(Math.floor((limit - 8 - size - 3) / 2));
      if (last) large.discovery.knownKeys.push(last);
      break;
    }
    large.discovery.knownKeys.push(key); size += added;
  }
  const text = state.serializeExport(large);
  assert.ok(Buffer.byteLength(text) > limit - 20 && Buffer.byteLength(text) <= limit);
  state.parseImport(text, [word('w1'), word('w2')]);
  await withBackground({ profile: large }, async ({ background, values }) => {
    await assert.rejects(background.handleMessage({ type: 'word.save', wordId: 'w1', saved: true }), /capacity/);
    assert.equal(values['kalimat.profile'].favorites.w1, undefined);
    const retained = await background.handleMessage({ type: 'state.export' });
    assert.equal(retained.text, text);
    assert.doesNotThrow(() => state.parseImport(retained.text, [word('w1'), word('w2')]));
  });
});

test('fresh installs require explicit source consent and disabled profiles never assign bundled words', async () => {
  await withBackground({ hostPermissions: true }, async ({ background, values, calls }) => {
    const fresh = await background.handleMessage({ type: 'discovery.get' });
    assert.equal(fresh.needsSetup, true);
    assert.equal(fresh.enabled, false);
    assert.equal(fresh.configured, false);
    assert.equal(values['kalimat.profile'], undefined);
    const first = await background.handleMessage({ type: 'assignment.get' });
    assert.equal(first.kind, 'no-new-word');
    assert.equal(first.discoveryStatus, 'setup-required');
    assert.equal(values['kalimat.profile'], undefined);
    assert.equal(calls.permissionRequests, 0, 'A browser grant alone is not source consent');
    await background.handleMessage({ type: 'discovery.configure', enabled: false, topics: [] });
    const offline = await background.handleMessage({ type: 'discovery.get' });
    assert.equal(offline.needsSetup, false);
    assert.equal(offline.configured, true);
    assert.equal(offline.enabled, false);
    assert.equal((await background.handleMessage({ type: 'assignment.get' })).discoveryStatus, 'disabled');
    assert.equal(Object.keys(values['kalimat.profile'].assignments).length, 0);
  });
});

test('enabling daily sources preserves the existing day and automatically assigns the next day once', async () => {
  let stored, previous;
  await withLocalDay('2026-10-16', async () => {
    await withBackground({ profile: retainedProfile('2026-10-16') }, async ({ background, values }) => {
      previous = await background.handleMessage({ type: 'assignment.get' });
      await background.handleMessage({ type: 'word.save', wordId: previous.wordId, saved: true });
      assert.equal((await background.handleMessage({ type: 'discovery.get' })).needsSetup, false);
      await background.handleMessage({ type: 'discovery.configure', enabled: true, topics: ['culture'] });
      assert.equal((await background.handleMessage({ type: 'assignment.get' })).wordId, previous.wordId);
      stored = JSON.parse(JSON.stringify(values['kalimat.profile']));
    });
  });
  const calls = [];
  await withLocalDay('2026-10-17', async () => {
    await withBackground({ profile: stored, fetch: freeSourceFetch(calls) }, async ({ background, values }) => {
      const [popup, atlas] = await Promise.all([
        background.handleMessage({ type: 'assignment.get' }),
        background.handleMessage({ type: 'assignment.get' }),
      ]);
      assert.equal(popup.word.contentVersion, 3);
      assert.equal(popup.word.word, 'استنزاف');
      assert.equal(atlas.wordId, popup.wordId);
      assert.equal(Object.keys(values['kalimat.profile'].wordSnapshots).length, 1);
      assert.equal(values['kalimat.profile'].assignments['2026-10-16'].wordId, previous.wordId);
      assert.equal(values['kalimat.profile'].favorites[previous.wordId], true);
      const requestCount = calls.length;
      assert.equal((await background.handleMessage({ type: 'assignment.get' })).wordId, popup.wordId);
      assert.equal(calls.length, requestCount, 'Opening either view again must reuse the daily assignment');
    });
  });
});

test('stricter quality preserves legacy saved history but skips the card for new assignments', async () => {
  const legacy = require('../../tests/fixtures/legacy-theory-card.json');
  const seed = profile({
    discovery: { enabled: true, topics: [], knownKeys: [] },
    wordSnapshots: { [legacy.id]: legacy }, favorites: { [legacy.id]: true }, wordStates: { [legacy.id]: { saved: true } },
    assignments: { '2026-10-15': { wordId: legacy.id } }, assignmentOrdinal: 1,
  });
  await withLocalDay('2026-10-16', async () => {
    await withBackground({ profile: seed, fetch: freeSourceFetch([]) }, async ({ background, values }) => {
      const historical = await background.handleMessage({ type: 'assignment.get', dateKey: '2026-10-15' });
      assert.deepEqual(historical.word, legacy);
      assert.equal(historical.saved, true);
      const current = await background.handleMessage({ type: 'assignment.get' });
      assert.equal(current.word.word, 'استنزاف');
      assert.deepEqual(values['kalimat.profile'].wordSnapshots[legacy.id], legacy);
      assert.equal(values['kalimat.profile'].favorites[legacy.id], true);
      const exported = (await background.handleMessage({ type: 'state.export' })).text;
      await background.handleMessage({ type: 'state.import', text: exported });
      assert.deepEqual((await background.handleMessage({ type: 'assignment.get', dateKey: '2026-10-15' })).word, legacy);
      assert.equal((await background.handleMessage({ type: 'assignment.get' })).wordId, current.wordId);
    });
    // An unassigned old snapshot must not bypass new eligibility through the cache.
    await withBackground({ profile: { ...seed, assignments: {}, assignmentOrdinal: 0 }, fetch: freeSourceFetch([]) }, async ({ background, values }) => {
      assert.equal((await background.handleMessage({ type: 'assignment.get' })).word.word, 'استنزاف');
      assert.deepEqual(values['kalimat.profile'].wordSnapshots[legacy.id], legacy);
    });
  });
});


test("deliberate review commits on the current local day despite a stale surface date", async () => {
  await withBackground({ profile: retainedProfile("2026-10-16") }, async ({ background, values, extension }) => {
    let assigned;
    await withLocalDay("2026-10-16", async () => {
      assigned = await background.handleMessage({ type: "assignment.get" });
      await background.handleMessage({ type: "word.feedback", wordId: assigned.wordId, dateKey: assigned.dateKey, status: "difficult" });
    });
    // The queued request starts before midnight; profile loading finishes after it.
    const originalGet = extension.storage.local.get;
    let release;
    let entered;
    const reading = new Promise(resolve => { entered = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    extension.storage.local.get = async (...args) => {
      entered();
      await gate;
      return originalGet(...args);
    };
    await withLocalDay("2026-10-16", async () => {
      const pending = background.handleMessage({ type: "word.review", wordId: assigned.wordId, rating: "good", dateKey: assigned.dateKey });
      await reading;
      await withLocalDay("2026-10-17", async () => {
        release();
        const result = await pending;
        assert.equal(result.kind, "ok");
        assert.equal(result.srs.lastReviewedDate, "2026-10-17");
        assert.equal(result.srs.nextReviewDate, "2026-10-18");
        assert.equal(result.dueCount, 0);
      });
    });
    assert.equal(values["kalimat.profile"].srs[assigned.wordId].history.at(-1).date, "2026-10-17");
  });
});


for (const [zone, instant, localDay] of [
  ["Pacific/Kiritimati", "2026-10-16T10:01:00Z", "2026-10-17"],
  ["Pacific/Honolulu", "2026-10-17T09:59:00Z", "2026-10-16"],
]) {
  test(`review date follows local midnight rather than UTC in ${zone}`, async () => {
    const priorTZ = process.env.TZ;
    const RealDate = globalThis.Date;
    process.env.TZ = zone;
    globalThis.Date = class FixedDate extends RealDate {
      constructor(...args) { super(...(args.length ? args : [instant])); }
    };
    try {
      await withBackground({ profile: retainedProfile(localDay) }, async ({ background }) => {
        const assigned = await background.handleMessage({ type: "assignment.get" });
        assert.equal(assigned.dateKey, localDay);
        await background.handleMessage({ type: "word.feedback", wordId: assigned.wordId, dateKey: localDay, status: "difficult" });
        const reviewed = await background.handleMessage({ type: "word.review", wordId: assigned.wordId, rating: "good", dateKey: instant.slice(0, 10) });
        assert.equal(reviewed.srs.lastReviewedDate, localDay);
      });
    } finally {
      globalThis.Date = RealDate;
      if (priorTZ === undefined) delete process.env.TZ; else process.env.TZ = priorTZ;
    }
  });
}

test('unencountered archive words remain eligible while encountered spellings are excluded', async () => {
  const archiveWord = word('w1', { word: 'استنزاف', normalized: 'استنزاف' });
  await withBackground({ vocabulary: [archiveWord], profile: sourceProfile(), fetch: freeSourceFetch([]) }, async ({ background }) => {
    assert.equal((await background.handleMessage({ type: 'assignment.get' })).word.word, 'استنزاف');
  });
  await withBackground({ vocabulary: [archiveWord], profile: sourceProfile({ assignments: { '2020-01-01': { wordId: 'w1' } }, assignmentOrdinal: 1 }), fetch: freeSourceFetch([]) }, async ({ background, values }) => {
    const result = await background.handleMessage({ type: 'assignment.get' });
    assert.equal(result.kind, 'no-new-word');
    assert.equal(values['kalimat.profile'].assignments['2020-01-01'].wordId, 'w1');
  });
});

test('automatic unavailable discovery requests retain the short cooldown', async () => {
  const calls = [];
  await withBackground({ profile: sourceProfile(), fetch: freeSourceFetch(calls, { offline: true }) }, async ({ background }) => {
    assert.equal((await background.handleMessage({ type: 'discovery.find' })).kind, 'unavailable');
    const count = calls.length;
    assert.equal((await background.handleMessage({ type: 'discovery.find' })).kind, 'unavailable');
    assert.equal(calls.length, count);
  });
});

test('unconfigured old installs retain today without forcing source consent or modifying stored state', async () => {
  const old = retainedProfile();
  const calls = [];
  await withBackground({ profile: old, hostPermissions: false, fetch: freeSourceFetch(calls) }, async ({ background, values }) => {
    const before = JSON.stringify(values['kalimat.profile']);
    assert.equal((await background.handleMessage({ type: 'discovery.get' })).needsSetup, false);
    assert.equal((await background.handleMessage({ type: 'assignment.get' })).wordId, 'w1');
    assert.equal(JSON.stringify(values['kalimat.profile']), before);
    assert.equal(calls.length, 0);
  });
});
