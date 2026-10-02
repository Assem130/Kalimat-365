const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ReviewSession = require("../shared/review-session.js");

const popup = path.join(__dirname, "..", "popup");
const files = Object.fromEntries(["popup.html", "popup.css", "popup.js"].map((name) => [name, path.join(popup, name)]));
const atlas = path.join(__dirname, "..", "atlas");
let activeElement = null;

test("review session keeps queue, reveal, submission, and recovery transitions shared", () => {
  const session = ReviewSession.create();
  const queue = ReviewSession.parseQueue({
    kind: "queue", words: [{ wordId: 1, word: { id: 1, word: "كلمة", meaningAr: "لفظ" } }],
    dueCount: 1, visibleCount: 1, remainingCount: 0,
  });
  ReviewSession.acceptQueue(session, queue);
  ReviewSession.showCard(session, 0);
  assert.equal(ReviewSession.toggleReveal(session), true);
  assert.equal(ReviewSession.beginSubmission(session)?.wordId, 1);
  assert.equal(ReviewSession.advance(session), null);
  ReviewSession.recover(session);
  assert.equal(ReviewSession.isRecovery(session), true);
  assert.equal(ReviewSession.count(session), 0);
});

function atlasSource(name) {
  return fs.readFileSync(path.join(atlas, name), "utf8");
}

function source(name) {
  return fs.readFileSync(files[name], "utf8");
}

class FakeCanvasContext {
  constructor() {
    this.calls = [];
    this.font = "";
    this.fillStyle = "";
    this.strokeStyle = "";
    this.lineWidth = 1;
    this.textAlign = "start";
    this.textBaseline = "alphabetic";
    this.direction = "inherit";
  }
  createLinearGradient(x0, y0, x1, y1) {
    this.calls.push({ method: "createLinearGradient", args: [x0, y0, x1, y1] });
    return {
      addColorStop: (offset, color) => {
        this.calls.push({ method: "addColorStop", args: [offset, color] });
      },
    };
  }
  fillRect(x, y, w, h) {
    this.calls.push({ method: "fillRect", args: [x, y, w, h], fillStyle: this.fillStyle });
  }
  strokeRect(x, y, w, h) {
    this.calls.push({ method: "strokeRect", args: [x, y, w, h], strokeStyle: this.strokeStyle, lineWidth: this.lineWidth });
  }
  fillText(text, x, y) {
    this.calls.push({ method: "fillText", args: [text, x, y], font: this.font, fillStyle: this.fillStyle, textAlign: this.textAlign, direction: this.direction });
  }
  measureText(text) {
    return { width: String(text || "").length * 10 };
  }
  save() { this.calls.push({ method: "save" }); }
  restore() { this.calls.push({ method: "restore" }); }
  beginPath() { this.calls.push({ method: "beginPath" }); }
  moveTo(x, y) { this.calls.push({ method: "moveTo", args: [x, y] }); }
  lineTo(x, y) { this.calls.push({ method: "lineTo", args: [x, y] }); }
  stroke() { this.calls.push({ method: "stroke", strokeStyle: this.strokeStyle, lineWidth: this.lineWidth }); }
}

class FakeCanvasElement {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.context = new FakeCanvasContext();
  }
  getContext(type) {
    if (type === "2d") return this.context;
    return null;
  }
  toBlob(callback, type = "image/png") {
    const blob = { type, size: 1024, isBlob: true };
    if (typeof callback === "function") callback(blob);
  }
  toDataURL(type = "image/png") {
    return `data:${type};base64,fakecanvasdata`;
  }
}

function setConnected(node, connected) {
  node.isConnected = connected;
  for (const child of node.children ?? []) setConnected(child, connected);
}

function element(connected = true) {
  const attributes = Object.create(null);
  const classes = new Set();
  return {
    textContent: "", hidden: false, disabled: false, checked: false, value: "", dataset: {}, attributes, focuses: 0, children: [], open: false, className: "", isConnected: connected,
    classList: {
      add(...names) { names.forEach((name) => classes.add(name)); },
      remove(...names) { names.forEach((name) => classes.delete(name)); },
      toggle(name, force) {
        const next = force === undefined ? !classes.has(name) : Boolean(force);
        if (next) classes.add(name); else classes.delete(name);
        return next;
      },
      contains(name) { return classes.has(name); },
    },
    setAttribute(name, value) { this.attributes[name] = { name, value: String(value) }; },
    getAttribute(name) { return this.attributes[name]?.value ?? null; },
    hasAttribute(name) { return Object.hasOwn(this.attributes, name); },
    removeAttribute(name) { delete this.attributes[name]; },
    addEventListener(type, listener) { this.listeners[type] = listener; }, listeners: {}, focus() { this.focuses += 1; activeElement = this; },
    append(...nodes) {
      for (const node of nodes) { this.children.push(node); setConnected(node, this.isConnected); }
    },
    replaceChildren(...nodes) {
      for (const node of this.children) setConnected(node, false);
      this.children = [];
      this.append(...nodes);
    },
    get childElementCount() { return this.children.length; },
    querySelector(selector) {
      if (selector === ".rate-interval") return this.children.find((child) => child?.className === "rate-interval") || null;
      return null;
    },
    showModal() { this.open = true; },
    close() { this.open = false; this.listeners.close?.({ target: this }); },
  };
}

function popupApi(responses = {}, options = {}) {
  activeElement = null;
  const elements = new Map();
  const ids = [
    "status", "action-status", "onboarding", "assigned", "assigned-title", "assignment-date", "interest-count", "empty", "error", "recovery", "warning",
    "empty-title", "error-title", "error-retry", "word", "meaning-ar", "meaning-en", "example", "example-en",
    "translation", "vocalization", "vocalization-details", "register", "error-atlas", "recovery-atlas", "pronunciation", "fixed-label", "save", "speak", "reminder", "reminder-time",
    "onboarding-submit", "onboarding-skip", "explore", "explore-empty", "recovery-reset",
    "known", "difficult", "theme-select", "streak-badge", "btn-export-anki", "btn-export-card",
    "due-review-badge", "practice-dialog", "practice-body", "practice-progress", "practice-close",
    "practice-finished", "practice-finished-message", "practice-error", "practice-error-message", "practice-retry", "practice-finish-btn", "flashcard-card", "card-front-face", "card-back-face", "card-front-flip", "card-front-word",
    "card-front-vocalization", "card-front-weight", "card-front-root", "card-front-speak", "card-back-meaning-ar",
    "card-back-meaning-en", "card-back-example-ar", "card-back-context", "practice-ratings", "rate-again", "rate-hard", "rate-good", "rate-easy",
  ];
  for (const id of ids) elements.set(id, element());
  elements.get("assigned").hidden = true;
  elements.get("error").hidden = true;
  elements.get("interest-count").textContent = "0/3";
  elements.get("streak-badge").setAttribute("aria-label", "تتابع القراءة والزيارة");
  elements.get("streak-badge").title = "تتابع القراءة والزيارة";
  for (const id of ["rate-again", "rate-hard", "rate-good", "rate-easy"]) {
    const interval = element();
    interval.className = "rate-interval";
    elements.get(id).children = [interval];
  }
  elements.get("reminder-time").value = "09:00";
  elements.get("theme-select").value = options.theme || "paper";
  elements.get("streak-badge").textContent = "🔥 لا يوجد تتابع بعد";
  const inputs = ["classical-arabic", "daily-life", "family", "food", "language", "travel"].map((value) => ({ ...element(), value, name: "interest" }));
  const downloads = [];
  const storageData = {
    "kalimat.profile": Object.hasOwn(options, "profile") ? options.profile : {},
    "kalimat.theme": options.theme || "paper",
    ...(options.storage || {}),
  };
  const storageListeners = [];
  const storage = {
    local: {
      get(keys, cb) {
        if (options.storageReadFailure && keys === "kalimat.profile") return Promise.reject(new Error("storage unavailable"));
        let result = {};
        if (typeof keys === "string") {
          if (storageData[keys] !== undefined) result[keys] = storageData[keys];
        } else if (Array.isArray(keys)) {
          for (const k of keys) { if (storageData[k] !== undefined) result[k] = storageData[k]; }
        } else if (keys && typeof keys === "object") {
          for (const k of Object.keys(keys)) {
            result[k] = storageData[k] !== undefined ? storageData[k] : keys[k];
          }
        } else {
          result = { ...storageData };
        }
        if (typeof cb === "function") cb(result);
        return Promise.resolve(result);
      },
      set(items, cb) {
        const changes = {};
        for (const [k, v] of Object.entries(items || {})) {
          changes[k] = { oldValue: storageData[k], newValue: v };
          storageData[k] = v;
        }
        for (const fn of storageListeners) {
          try { fn(changes, "local"); } catch (_) {}
        }
        if (typeof cb === "function") cb();
        return Promise.resolve();
      },
    },
    onChanged: {
      addListener(fn) { storageListeners.push(fn); },
      removeListener(fn) {
        const idx = storageListeners.indexOf(fn);
        if (idx !== -1) storageListeners.splice(idx, 1);
      },
    },
  };
  storage.local.onChanged = storage.onChanged;
  const documentElement = {
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = { name, value: String(value) }; },
    getAttribute(name) { return this.attributes[name]?.value ?? null; },
  };
  const body = {
    appendChild(node) {
      if (node && node.download !== undefined) {
        // anchor appended
      }
    },
    removeChild() {},
  };
  const documentListeners = {};
  const document = {
    readyState: "loading",
    get activeElement() { return activeElement; },
    documentElement,
    body,
    fonts: { ready: Promise.resolve() },
    getElementById(id) { return elements.get(id); },
    createElement(tag) {
      if (tag === "canvas") return new FakeCanvasElement();
      if (tag === "a") {
        const a = element();
        a.download = "";
        a.href = "";
        a.click = function () {
          downloads.push({ href: this.href, download: this.download, filename: this.download });
        };
        a.remove = function () {};
        return a;
      }
      return element();
    },
    querySelectorAll(selector) { return selector === 'input[name="interest"]' ? inputs : []; },
    addEventListener(type, listener) { documentListeners[type] = listener; },
    dispatchEvent(event) { return documentListeners[event?.type]?.(event); },
  };
  const calls = [];
  const extension = {
    runtime: {
      sendMessage(message) {
        calls.push(message);
        const response = responses[message.type];
        const result = typeof response === "function" ? response(message, calls) : response;
        return result instanceof Error ? Promise.reject(result) : Promise.resolve(result ?? {});
      },
      getURL(value) { return `extension://kalimat/${value}`; },
    },
    permissions: {
      request(value) {
        calls.push({ permission: value });
        if (options.permissionError) return Promise.reject(options.permissionError);
        return Promise.resolve(Object.hasOwn(options, "permissionResult") ? options.permissionResult : true);
      },
    },
    tabs: { create(value) { calls.push({ tab: value }); return Promise.resolve(); } },
    storage,
  };
  const createdUrls = new Map();
  const recordedBlobs = new Map();
  let urlCounter = 0;
  const mockURL = {
    createObjectURL(blob) {
      const url = `blob:kalimat/${++urlCounter}`;
      createdUrls.set(url, blob);
      recordedBlobs.set(url, blob);
      return url;
    },
    revokeObjectURL(url) {
      createdUrls.delete(url);
    },
  };
  const vocabulary = options.vocabulary ?? [
    { id: "w1", word: "كلمة", normalized: "كلمة", meaningAr: "معنى", meaningEn: "meaning", pronunciation: "/w1/", exampleAr: "مثال", contextAr: "سياق" },
  ];
  const context = {
    document,
    chrome: extension,
    Promise,
    console,
    confirm: options.confirm,
    URLSearchParams,
    URL: Object.assign(class extends URL {}, mockURL),
    Blob: globalThis.Blob,
    fetch: async (url) => {
      if (typeof url === "string" && url.includes("vocabulary.json")) {
        return { ok: true, async json() { return options.vocabulary ?? vocabulary; } };
      }
      return { ok: false };
    },
    globalThis: null,
  };
  if (Object.hasOwn(options, "speechSynthesis")) context.speechSynthesis = options.speechSynthesis;
  if (Object.hasOwn(options, "SpeechSynthesisUtterance")) context.SpeechSynthesisUtterance = options.SpeechSynthesisUtterance;
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "shared", "date.js"), "utf8"), context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "shared", "review-session.js"), "utf8"), context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "shared", "speech.js"), "utf8"), context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "shared", "vocabulary.js"), "utf8"), context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "shared", "theme.js"), "utf8"), context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "shared", "streak.js"), "utf8"), context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "shared", "export.js"), "utf8"), context);
  vm.runInNewContext(source("popup.js"), context, { filename: files["popup.js"] });
  return { api: context.KalimatPopup, elements, inputs, calls, context, documentListeners, downloads, storageData, storageListeners, createdUrls, recordedBlobs };
}

function atlasApi(responses = {}, options = {}) {
  activeElement = null;
  const elements = new Map();
  const dynamicById = (id, nodes = [...elements.values()]) => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = dynamicById(id, node.children ?? []);
      if (found) return found;
    }
    return null;
  };
  const ids = [
    "status", "today-action-status", "warning", "today", "explore", "history", "settings",
    "today-view", "explore-view", "history-view", "settings-view", "onboarding", "recovery",
    "empty", "error", "today-title", "explore-title", "history-title", "settings-title",
    "onboarding-title", "recovery-title", "empty-title", "error-title", "today-card", "today-date", "today-empty",
    "explore-card", "atlas-search", "search-count", "search-results", "return-today",
    "history-filter", "history-list", "settings-english", "settings-remote-speech", "settings-speech-rate", "settings-speech-repeat", "settings-save", "settings-time",
    "settings-reminder", "export", "import-file", "clear", "recovery-export", "recovery-import",
    "recovery-clear", "onboarding-settings", "today-save", "today-known", "today-difficult", "explore-lookup",
    "theme-select", "streak-badge", "today-export-card", "history-export-anki", "btn-export-anki",
    "due-review-badge", "practice-dialog", "practice-body", "practice-progress", "practice-close",
    "practice-finished", "practice-finished-message", "practice-error", "practice-error-message", "practice-retry", "practice-finish-btn", "flashcard-card", "card-front-face", "card-back-face", "card-front-flip", "card-front-word",
    "card-front-vocalization", "card-front-weight", "card-front-root", "card-front-speak", "card-back-meaning-ar",
    "card-back-meaning-en", "card-back-example-ar", "card-back-context", "practice-ratings", "rate-again", "rate-hard", "rate-good", "rate-easy",
  ];
  for (const id of ids) elements.set(id, element());
  for (const id of ["rate-again", "rate-hard", "rate-good", "rate-easy"]) {
    const interval = element();
    interval.className = "rate-interval";
    elements.get(id).children = [interval];
  }
  elements.get("history-filter").value = "all";
  elements.get("settings-speech-rate").value = "0.85";
  elements.get("settings-speech-repeat").value = "1";
  elements.get("theme-select").value = options.theme || "paper";
  elements.get("streak-badge").textContent = "🔥 لا يوجد تتابع بعد";
  const levels = [1, 2, 3].map((value) => ({ ...element(), value: String(value), name: "atlas-level" }));
  const interests = ["classical-arabic", "daily-life", "family", "food", "language", "travel"].map((value) => ({ ...element(), value, name: "atlas-interest" }));
  const downloads = [];
  const storageData = {
    "kalimat.theme": options.theme || "paper",
    ...(options.storage || {}),
  };
  const storageListeners = [];
  const storage = {
    local: {
      get(keys, cb) {
        let result = {};
        if (typeof keys === "string") {
          if (storageData[keys] !== undefined) result[keys] = storageData[keys];
        } else if (Array.isArray(keys)) {
          for (const k of keys) { if (storageData[k] !== undefined) result[k] = storageData[k]; }
        } else if (keys && typeof keys === "object") {
          for (const k of Object.keys(keys)) {
            result[k] = storageData[k] !== undefined ? storageData[k] : keys[k];
          }
        } else {
          result = { ...storageData };
        }
        if (typeof cb === "function") cb(result);
        return Promise.resolve(result);
      },
      set(items, cb) {
        const changes = {};
        for (const [k, v] of Object.entries(items || {})) {
          changes[k] = { oldValue: storageData[k], newValue: v };
          storageData[k] = v;
        }
        for (const fn of storageListeners) {
          try { fn(changes, "local"); } catch (_) {}
        }
        if (typeof cb === "function") cb();
        return Promise.resolve();
      },
    },
    onChanged: {
      addListener(fn) { storageListeners.push(fn); },
      removeListener(fn) {
        const idx = storageListeners.indexOf(fn);
        if (idx !== -1) storageListeners.splice(idx, 1);
      },
    },
  };
  storage.local.onChanged = storage.onChanged;
  const documentElement = {
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = { name, value: String(value) }; },
    getAttribute(name) { return this.attributes[name]?.value ?? null; },
  };
  const body = {
    appendChild(node) {
      if (node && node.download !== undefined) {
        // anchor appended
      }
    },
    removeChild() {},
  };
  const documentListeners = {};
  const document = {
    readyState: "loading",
    get activeElement() { return activeElement; },
    documentElement,
    body,
    fonts: { ready: Promise.resolve() },
    getElementById(id) { return elements.get(id) ?? dynamicById(id); },
    createElement(tag) {
      if (tag === "canvas") return new FakeCanvasElement();
      if (tag === "a") {
        const a = element();
        a.download = "";
        a.href = "";
        a.click = function () {
          downloads.push({ href: this.href, download: this.download, filename: this.download });
        };
        a.remove = function () {};
        return a;
      }
      return element(false);
    },
    querySelector(selector) {
      const level = selector.match(/input\[name="atlas-level"\]\[value="(\d)"\]/);
      if (level) return levels.find((input) => input.value === level[1]) ?? null;
      if (selector === 'input[name="atlas-level"]:checked') return levels.find((input) => input.checked) ?? null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector.includes('name="atlas-interest"')) return selector.includes(":checked") ? interests.filter((input) => input.checked) : interests;
      if (selector.includes('name="atlas-level"')) return levels;
      return [];
    },
    addEventListener(type, listener) { documentListeners[type] = listener; },
    dispatchEvent(event) { return documentListeners[event?.type]?.(event); },
  };
  const calls = [];
  const extension = {
    runtime: {
      sendMessage(message) {
        calls.push(message);
        const response = responses[message.type];
        const result = typeof response === "function" ? response(message, calls) : response;
        return result instanceof Error ? Promise.reject(result) : Promise.resolve(result ?? {});
      },
      getURL(value) { return `extension://kalimat/${value}`; },
    },
    permissions: {
      request() {
        if (options.permissionError) return Promise.reject(options.permissionError);
        return Promise.resolve(Object.hasOwn(options, "permissionResult") ? options.permissionResult : true);
      },
    },
    storage,
  };
  const vocabulary = options.vocabulary ?? [
    { id: "w1", word: "كلمة", normalized: "كلمة", meaningAr: "معنى", meaningEn: "meaning", pronunciation: "/w1/", exampleAr: "مثال", contextAr: "سياق" },
    { id: "w2", word: "ثانية", normalized: "ثانية", meaningAr: "شرح", meaningEn: "second", pronunciation: "/w2/", exampleAr: "مثال ثان", contextAr: "سياق ثان" },
  ];
  const createdUrls = new Map();
  const recordedBlobs = new Map();
  let urlCounter = 0;
  const mockURL = {
    createObjectURL(blob) {
      const url = `blob:kalimat/${++urlCounter}`;
      createdUrls.set(url, blob);
      recordedBlobs.set(url, blob);
      return url;
    },
    revokeObjectURL(url) {
      createdUrls.delete(url);
    },
  };
  const context = {
    document,
    chrome: options.firefox ? undefined : extension,
    browser: options.firefox ? extension : undefined,
    Promise,
    console,
    URLSearchParams,
    URL: Object.assign(class extends URL {}, mockURL),
    Blob: globalThis.Blob,
    location: { search: options.search ?? "" },
    fetch: async () => ({ ok: true, async json() { return vocabulary; } }),
    confirm: options.confirm ?? (() => true),
    globalThis: null,
  };
  if (Object.hasOwn(options, "speechSynthesis")) context.speechSynthesis = options.speechSynthesis;
  if (Object.hasOwn(options, "SpeechSynthesisUtterance")) context.SpeechSynthesisUtterance = options.SpeechSynthesisUtterance;
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "shared", "date.js"), "utf8"), context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "shared", "review-session.js"), "utf8"), context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "shared", "speech.js"), "utf8"), context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "shared", "vocabulary.js"), "utf8"), context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "shared", "theme.js"), "utf8"), context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "shared", "streak.js"), "utf8"), context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "shared", "export.js"), "utf8"), context);
  vm.runInNewContext(atlasSource("atlas.js"), context, { filename: path.join(atlas, "atlas.js") });
  return { api: context.KalimatAtlas, elements, levels, interests, calls, context, documentListeners, downloads, storageData, storageListeners, createdUrls, recordedBlobs };
}

test("popup ships separate native files without unsafe markup or timer work", () => {
  for (const file of Object.values(files)) assert.equal(fs.existsSync(file), true, `${path.basename(file)} is missing`);
  const html = source("popup.html");
  const css = source("popup.css");
  const js = source("popup.js");
  assert.match(html, /<html\s+lang="ar"\s+dir="rtl">/);
  assert.match(html, /<link[^>]+href="popup\.css"/);
  assert.match(html, /<script\s+src="\.\.\/shared\/date\.js"><\/script>[\s\S]*<script\s+src="popup\.js"><\/script>/);
  assert.match(html, /<script\s+src="\.\.\/shared\/speech\.js"><\/script>/);
  assert.match(html, /<script\s+src="popup\.js"><\/script>/);
  const withoutApprovedRemote = `${html.replace("https://assem130.github.io/Kalimat-365/privacy.html", "")}\n${css}\n${js}`;
  assert.doesNotMatch(withoutApprovedRemote, /https?:\/\/|\b(?:innerHTML|outerHTML)\b|\b(?:setInterval|setTimeout)\s*\(/);
  assert.doesNotMatch(`${html}\n${js}`, /online[ -]lookup|lookup-result/i, "Popup must keep online lookup in Atlas only");
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  assert.doesNotMatch(html, /<script(?![^>]+\bsrc=)[^>]*>/i);
  assert.doesNotMatch(html, /<style\b/i);
});


test("popup renders practical context before the literary fallback as safe text", () => {
  const { api, elements } = popupApi();
  assert.ok(api);
  api.renderAssigned({ kind: "assigned", word: { id: "w1", word: "كلمة", meaningAr: "معنى", meaningEn: "meaning", contextAr: "<img onerror=alert(1)>", exampleKind: "original", exampleAr: "مثال أدبي", pronunciation: "/test/" } });
  assert.equal(elements.get("example").textContent, "<img onerror=alert(1)>");
  api.renderAssigned({ kind: "assigned", word: { id: "w1", word: "كلمة", meaningAr: "معنى", meaningEn: "meaning", exampleKind: "original", exampleAr: "مثال أدبي", pronunciation: "/test/" } });
  assert.equal(elements.get("example").textContent, "مثال أدبي");
});

test("popup keeps the assignment hidden until render and formats a validated local date", async () => {
  let resolveAssignment;
  const pendingAssignment = new Promise((resolve) => { resolveAssignment = resolve; });
  const fixture = popupApi({
    "assignment.get": () => pendingAssignment,
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
  });
  const initializing = fixture.api.initialize();
  await new Promise(setImmediate);
  assert.equal(fixture.elements.get("assigned").hidden, true);

  resolveAssignment({ kind: "assigned", dateKey: "2026-02-03", word: { id: "w1", word: "كلمة", meaningAr: "معنى", pronunciation: "/w1/" } });
  await initializing;
  const expected = new Date(2026, 1, 3).toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  assert.equal(fixture.elements.get("assigned").hidden, false);
  assert.equal(fixture.elements.get("assignment-date").hidden, false);
  assert.equal(fixture.elements.get("assignment-date").textContent, expected);

  fixture.api.renderAssigned({ kind: "assigned", dateKey: "2026-02-30", word: { id: "w1", word: "كلمة", meaningAr: "معنى", pronunciation: "/w1/" } });
  assert.equal(fixture.elements.get("assignment-date").hidden, true);
  assert.equal(fixture.elements.get("assignment-date").textContent, "");

  const invalid = popupApi({
    "assignment.get": { kind: "assigned", dateKey: "2026-02-30", word: { id: "w1", word: "كلمة", meaningAr: "معنى", pronunciation: "/w1/" } },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
  });
  await invalid.api.initialize();
  assert.equal(invalid.elements.get("assigned").hidden, true);
  assert.equal(invalid.elements.get("error").hidden, false);
});

test("popup shows English practical context only when enabled and preserves text content", () => {
  const { api, elements, inputs } = popupApi();
  api.renderAssigned({ kind: "assigned", word: { id: "w1", word: "<img onerror=alert(1)>", meaningAr: "معنى", meaningEn: "meaning", contextAr: "سياق", contextEn: "<img onerror=alert(1)>", exampleAr: "مثال", pronunciation: "/test/" } });
  assert.equal(elements.get("word").textContent, "<img onerror=alert(1)>");
  assert.equal(elements.get("example-en").textContent, "<img onerror=alert(1)>");
  assert.equal(elements.get("example-en").hidden, false);
  api.renderAssigned({ kind: "assigned", showEnglish: false, word: { id: "w1", word: "كلمة", meaningAr: "معنى", meaningEn: "meaning", contextAr: "سياق", contextEn: "in context", exampleAr: "مثال", pronunciation: "/test/" } });
  assert.equal(elements.get("example-en").hidden, true);
  assert.equal(elements.get("translation").hidden, true);
});


test("save uses a real attribute value and toggles both ways", async () => {
  const { api, elements, calls } = popupApi({ "word.save": { kind: "ok" } });
  api.renderAssigned({ kind: "assigned", dateKey: "2026-07-30", word: { id: "w1", word: "كلمة", meaningAr: "معنى", exampleAr: "مثال", pronunciation: "/test/" } });
  await api.toggleSave();
  await api.toggleSave();
  assert.equal(elements.get("save").getAttribute("aria-pressed"), "false");
  assert.deepEqual(JSON.parse(JSON.stringify(calls.slice(-2))), [
    { type: "word.save", wordId: "w1", saved: true },
    { type: "word.save", wordId: "w1", saved: false },
  ]);
});

test("popup Explore preserves the current word and supports empty-corpus browsing", async () => {
  const fixture = popupApi();
  fixture.api.renderAssigned({ kind: "assigned", word: { id: "w1", word: "كلمة", meaningAr: "معنى", exampleAr: "مثال", pronunciation: "/test/" } });
  await fixture.api.openAtlas();
  assert.deepEqual(JSON.parse(JSON.stringify(fixture.calls.at(-1))), {
    tab: { url: "extension://kalimat/atlas/atlas.html?view=explore&id=w1&q=%D9%83%D9%84%D9%85%D8%A9" },
  });

  const empty = popupApi();
  await empty.api.openAtlas();
  assert.deepEqual(JSON.parse(JSON.stringify(empty.calls.at(-1))), {
    tab: { url: "extension://kalimat/atlas/atlas.html?view=explore&id=&q=" },
  });
});

test("popup no-word and load-error states focus a clear state and disable word actions", async () => {
  const noWord = popupApi({ "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } }, "assignment.get": { kind: "no-new-word" } });
  await noWord.api.initialize();
  assert.equal(noWord.elements.get("empty").hidden, false);
  assert.equal(noWord.elements.get("empty-title").focuses, 1);
  assert.equal(noWord.elements.get("save").disabled, true);

  const failed = popupApi({ "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } }, "assignment.get": new Error("load") });
  await failed.api.initialize();
  assert.equal(failed.elements.get("error").hidden, false);
  assert.equal(failed.elements.get("error-title").focuses, 1);
  assert.match(failed.elements.get("status").textContent, /تعذّر تحميل/);
});

test("Atlas ships a dark, accessible four-view page without unsafe sinks or timer work", () => {
  for (const name of ["atlas.html", "atlas.css", "atlas.js"]) assert.equal(fs.existsSync(path.join(atlas, name)), true, `${name} is missing`);
  const html = atlasSource("atlas.html");
  const css = atlasSource("atlas.css");
  const js = atlasSource("atlas.js");
  assert.match(html, /<html\s+lang="ar"\s+dir="rtl">/);
  assert.match(html, /<link[^>]+href="atlas\.css"/);
  assert.match(html, /<script\s+src="atlas\.js"><\/script>/);
  assert.match(html, /<script\s+src="\.\.\/shared\/speech\.js"><\/script>/);
  assert.match(html, /id="today-date"/);
  assert.match(js, /word-speak/);
  for (const id of ["today", "explore", "history", "settings", "atlas-search", "return-today", "history-filter", "settings-english", "settings-time", "export", "import-file", "clear", "recovery-export", "recovery-import", "recovery-clear", "today-action-status", "explore-lookup"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /id="today-action-status"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.doesNotMatch(html, /id="today-lookup"/);
  assert.doesNotMatch(html, /name="atlas-level"|id="streak-badge"/);
  assert.doesNotMatch(html, />\s*(?:A1-A2|B1-B2|C1|مبتدئ|متوسط|متقدم|beginner|intermediate|advanced)\s*</i, "Atlas must not advertise unsupported challenge bands");
  assert.match(html, /<input[^>]+id="settings-speech-rate"[^>]+type="number"[^>]+min="0\.5"[^>]+max="1\.5"[^>]+step="0\.05"/);
  assert.match(html, /<select[^>]+id="settings-speech-repeat"[\s\S]*value="1"[\s\S]*value="3"/);
  assert.equal((html.match(/name="atlas-interest"/g) || []).length, 6);
  assert.match(html, /<button[^>]+id="settings-reminder"[^>]+role="switch"[^>]+aria-checked="false"/);
  assert.doesNotMatch(html, /<button[^>]+id="settings-reminder"[^>]*aria-pressed=/);
  assert.match(html, /id="search-count"[^>]+aria-live="polite"/);
  const withoutApprovedRemote = `${html.replace("https://assem130.github.io/Kalimat-365/privacy.html", "")}\n${css}\n${js.replace(/https:\/\/ar\.wiktionary\.org[^\s"'`)]*/g, "")}`;
  assert.doesNotMatch(withoutApprovedRemote, /https?:\/\/|\b(?:innerHTML|outerHTML)\b|\b(?:setInterval|setTimeout)\s*\(/);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  assert.match(css, /background:\s*#102b2a/i);
  assert.match(css, /:focus-visible/);
  assert.match(css, /button\[aria-pressed="true"\][^{]*\{[^}]*color:/);
  assert.match(css, /#settings-reminder\[aria-checked="true"\][^{]*\{/);
  assert.match(css, /\.file-button[^}]*focus-visible/);
  assert.match(css, /:focus-visible[^}]*box-shadow/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /\.action-status/);
  assert.match(html, /id="import-file"[^>]+tabindex="-1"/);
  assert.match(html, /id="recovery-import"[^>]+tabindex="-1"/);
  assert.match(html, /label class="file-button" tabindex="0"/);
});

test("Atlas keeps the daily anchor while exploration, history, settings, and recovery use validated messages", () => {
  const js = atlasSource("atlas.js");
  assert.match(js, /type:\s*"assignment\.get",\s*dateKey/);
  assert.match(js, /type:\s*"state\.export"/);
  assert.match(js, /type:\s*"state\.import",\s*text/);
  assert.match(js, /type:\s*"state\.clear"/);
  assert.match(js, /type:\s*"settings\.update",\s*\.\.\.submitted/);
  assert.match(js, /type:\s*"reminder\.configure",\s*enabled,\s*time/);
  assert.match(js, /new Blob\(/);
  assert.match(js, /globalThis\.confirm/);
  assert.match(js, /KalimatVocabulary\?\.canonicalSearchKey/);
  assert.match(js, /relatedIds/);
  assert.doesNotMatch(js, /state\s*=\s*\{[^}]*viewed/);
  assert.doesNotMatch(js, /regenerate|Math\.random/);
});

test("Atlas Today formats its validated local date and shares speech controls with Explore", async () => {
  const word = { id: "w1", word: "كلمة", meaningAr: "معنى", meaningEn: "meaning", pronunciation: "/w1/", exampleAr: "مثال" };
  const speechCalls = [];
  class FakeUtterance { constructor(text) { this.text = text; } }
  const speechSynthesis = {
    getVoices() { return [{ lang: "ar", localService: true }]; },
    cancel() { speechCalls.push("cancel"); },
    speak(utterance) { speechCalls.push({ text: utterance.text }); },
  };
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-02-03" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile({ assignments: { "2026-02-03": { wordId: "w1" } }, assignmentOrdinal: 1 })) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
  }, { vocabulary: [word], speechSynthesis, SpeechSynthesisUtterance: FakeUtterance });
  await fixture.api.initialize();

  const expectedDate = new Date(2026, 1, 3).toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const date = fixture.elements.get("today-date");
  assert.equal(date.hidden, false);
  assert.equal(date.textContent, expectedDate);

  const todaySpeaker = fixture.elements.get("today-card").children.find((node) => node.className === "word-speak");
  assert.ok(todaySpeaker);
  assert.equal(todaySpeaker.type, "button");
  assert.match(todaySpeaker.getAttribute("aria-label"), /استمع/);
  assert.equal(todaySpeaker.disabled, false);
  todaySpeaker.listeners.click({});
  assert.deepEqual(speechCalls, ["cancel", { text: word.word }]);

  fixture.api.viewWord(word);
  const exploreSpeaker = fixture.elements.get("explore-card").children.find((node) => node.className === "word-speak");
  assert.ok(exploreSpeaker);
  assert.equal(exploreSpeaker.type, "button");
  assert.equal(exploreSpeaker.disabled, false);
  assert.equal(fixture.elements.get("explore-card").children.some((node) => node.className === "today-date"), false);
});

test("Atlas hides an invalid Today date and disables shared speakers without Web Speech", async () => {
  const word = { id: "w1", word: "كلمة", meaningAr: "معنى", pronunciation: "/w1/" };
  class FakeUtterance { constructor(text) { this.text = text; } }
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-02-30" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
  }, { vocabulary: [word], speechSynthesis: undefined, SpeechSynthesisUtterance: FakeUtterance });
  await fixture.api.initialize();

  const date = fixture.elements.get("today-date");
  assert.equal(date.hidden, true);
  assert.equal(date.textContent, "");
  const todaySpeaker = fixture.elements.get("today-card").children.find((node) => node.className === "word-speak");
  assert.ok(todaySpeaker);
  assert.equal(todaySpeaker.disabled, true);

  fixture.api.viewWord(word);
  const exploreSpeaker = fixture.elements.get("explore-card").children.find((node) => node.className === "word-speak");
  assert.ok(exploreSpeaker);
  assert.equal(exploreSpeaker.disabled, true);
});

test("Atlas speech settings preserve legacy level 4 without a visible proficiency control", async () => {
  for (const speechRate of [0.7, 0.85, 1, 1.25]) {
    const profile = atlasProfile({
      level: 4,
      preferences: { speechRate, speechRepeat: 3, showEnglish: true, dailyReviewLimit: 20 },
    });
    const fixture = atlasApi({
      "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-02-03" },
      "state.export": { kind: "export", text: JSON.stringify(profile) },
      "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
      "settings.update": { kind: "ok" },
    });
    await fixture.api.initialize();
    assert.equal(fixture.elements.get("settings-speech-rate").value, String(speechRate));
    assert.equal(fixture.elements.get("settings-speech-repeat").value, "3");
    assert.equal(fixture.levels.some((control) => control.checked), false);
    fixture.elements.get("settings-speech-rate").value = "1.25";
    fixture.elements.get("settings-speech-repeat").value = "1";
    await fixture.api.saveSettings();
    const update = fixture.calls.find((message) => message.type === "settings.update");
    assert.equal(update.level, 4);
    assert.equal(update.speechRate, 1.25);
    assert.equal(update.speechRepeat, 1);
  }
});

test("Popup speech honors stored rate and repeat while stale utterances cannot restart a new click", async () => {
  const utterances = [];
  class FakeUtterance {
    constructor(text) { this.text = text; }
  }
  const speechSynthesis = {
    getVoices() { return [{ lang: "ar-SA", name: "Arabic Natural", localService: true }]; },
    cancel() {},
    speak(utterance) { utterances.push(utterance); },
  };
  const fixture = popupApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-02-03" },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
  }, {
    profile: { assignments: {}, preferences: { speechRate: 0.7, speechRepeat: 3 } },
    speechSynthesis,
    SpeechSynthesisUtterance: FakeUtterance,
  });
  await fixture.api.initialize();

  fixture.elements.get("speak").listeners.click();
  const stale = utterances[0];
  fixture.elements.get("speak").listeners.click();
  const current = utterances[1];
  stale.onend();
  assert.equal(utterances.length, 2);
  assert.equal(fixture.context.globalThis._activeUtterance, current);
  current.onend();
  assert.equal(utterances.length, 3);
  utterances[2].onend();
  assert.equal(utterances.length, 4);
  utterances[3].onend();
  assert.equal(fixture.context.globalThis._activeUtterance, null);
  assert.deepEqual(utterances.map((utterance) => utterance.rate), [0.7, 0.7, 0.7, 0.7]);
});

test("Atlas speech honors stored rate and repeat while stale utterances cannot restart a new click", async () => {
  const utterances = [];
  class FakeUtterance {
    constructor(text) { this.text = text; }
  }
  const speechSynthesis = {
    getVoices() { return [{ lang: "ar-SA", name: "Arabic Natural", localService: true }]; },
    cancel() {},
    speak(utterance) { utterances.push(utterance); },
  };
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-02-03" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile({ preferences: { speechRate: 1.25, speechRepeat: 3 } })) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
  }, { speechSynthesis, SpeechSynthesisUtterance: FakeUtterance });
  await fixture.api.initialize();

  fixture.api.speak("كلمة");
  const stale = utterances[0];
  fixture.api.speak("كلمة");
  const current = utterances[1];
  stale.onend();
  assert.equal(utterances.length, 2);
  assert.equal(fixture.context.globalThis._activeUtterance, current);
  current.onend();
  assert.equal(utterances.length, 3);
  utterances[2].onend();
  assert.equal(utterances.length, 4);
  utterances[3].onend();
  assert.equal(fixture.context.globalThis._activeUtterance, null);
  assert.deepEqual(utterances.map((utterance) => utterance.rate), [1.25, 1.25, 1.25, 1.25]);
});

function atlasProfile(overrides = {}) {
  return {
    schemaVersion: 1, algorithmVersion: 1, seedHex: "a".repeat(32), level: 1, interests: [], showEnglish: true,
    wordStates: {}, assignments: {}, assignmentOrdinal: 0, recentIds: [], evidenceCutoff: null, ...overrides,
  };
}

test("Atlas dated query loads only the retained date plus profile and settings", async () => {
  const profile = atlasProfile({ assignments: { "2026-07-28": { wordId: "w2" } }, assignmentOrdinal: 1 });
  const fixture = atlasApi({
    "assignment.get": (message) => message.dateKey ? { kind: "assigned", wordId: "w2", dateKey: message.dateKey } : { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": { kind: "export", text: JSON.stringify(profile) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
  }, { search: "?date=2026-07-28" });
  assert.equal(typeof fixture.api.initialize, "function");
  await fixture.api.initialize();
  assert.equal(fixture.calls.some((message) => message.type === "assignment.get" && message.dateKey === undefined), false);
  assert.deepEqual(fixture.calls.filter((message) => message.type === "assignment.get").map((message) => message.dateKey), ["2026-07-28"]);
});


test("Atlas blank Explore shows every reviewed local word and ranks exact and prefix matches", async () => {
  const vocabulary = [
    { id: "meta", word: "كتاب", normalized: "كتاب", meaningAr: "لفظ", meaningEn: "book", pronunciation: "/meta/", exampleAr: "مثال", difficultyBand: "advanced", usefulnessBand: "low", reviewed: true },
    { id: "prefix", word: "كاتب", normalized: "كاتب", meaningAr: "كاتب", meaningEn: "writer", pronunciation: "/prefix/", exampleAr: "مثال", difficultyBand: "beginner", usefulnessBand: "high", reviewed: true },
    { id: "exact", word: "كتب", normalized: "كتب", meaningAr: "فعل", meaningEn: "wrote", pronunciation: "/exact/", exampleAr: "مثال", difficultyBand: "intermediate", usefulnessBand: "medium", reviewed: true },
  ];
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "exact", dateKey: "2026-07-30" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
  }, { vocabulary });
  await fixture.api.initialize();
  fixture.elements.get("explore").listeners.click();
  assert.equal(fixture.elements.get("explore-view").hidden, false);
  fixture.elements.get("atlas-search").value = "";
  fixture.elements.get("atlas-search").listeners.input();
  assert.equal(fixture.elements.get("search-results").children.length, vocabulary.length);
  assert.match(fixture.elements.get("search-count").textContent, /3/);
  fixture.elements.get("atlas-search").value = "كتب";
  fixture.api.search();
  assert.equal(fixture.elements.get("search-results").children[0].textContent.startsWith("كتب"), true);
  assert.equal(fixture.elements.get("search-results").children.length, 1);
  assert.equal(fixture.elements.get("search-count").textContent, "1 نتيجة");
  fixture.elements.get("atlas-search").value = "كُتِب";
  fixture.api.search();
  assert.equal(fixture.elements.get("search-results").children.length, 1, "Arabic normalization must preserve local matches");
  fixture.elements.get("atlas-search").value = "writer";
  fixture.api.search();
  assert.equal(fixture.elements.get("search-results").children.length, 1, "English metadata queries must find local words");
  fixture.elements.get("atlas-search").value = "لاشيء";
  fixture.api.search();
  assert.equal(fixture.elements.get("search-results").children.length, 0);
  assert.equal(fixture.elements.get("search-count").textContent, "لا توجد نتائج محلية. جرّب تهجئة أخرى.");
  fixture.elements.get("atlas-search").value = "";
  fixture.api.search();
  assert.equal(fixture.elements.get("search-results").children.length, vocabulary.length, "blank search must recover the local results");
  assert.equal(fixture.elements.get("search-count").textContent, "3 كلمة");
});

test("Atlas online lookup requests permission inside submit and stops on denial without messaging", async () => {
  const responses = {
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
  };
  for (const options of [{ permissionResult: false }, { permissionError: new Error("denied") }]) {
    const fixture = atlasApi(responses, options);
    await fixture.api.initialize();
    const button = fixture.elements.get("explore-lookup");
    await fixture.api.lookupOnline("كلمة", button);
    assert.equal(fixture.calls.filter((message) => message.type === "online.lookup").length, 0);
    assert.match(fixture.elements.get("status").textContent, /إذن|تعذّر|رفض/);
    assert.equal(button.focuses, 1);
    assert.equal(button.disabled, false);
  }
});

test("Firefox keeps Explore local-only without an unavailable online action", async () => {
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
  }, { firefox: true });
  await fixture.api.initialize();
  assert.equal(fixture.elements.get("explore-lookup").hidden, true);
  assert.equal(fixture.elements.get("explore-lookup").listeners.click, undefined);
});

test("Atlas renders a safe unreviewed online result separately from local learning state", async () => {
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "online.lookup": { kind: "online-result", query: "كلمة", headword: "كلمة", definitionAr: "<img onerror=alert(1)>", sourceUrl: "https://ar.wiktionary.org/wiki/%D9%83%D9%84%D9%85%D8%A9", retrievedAt: "2026-08-11T00:00:00.000Z", unreviewed: true },
  });
  await fixture.api.initialize();
  await fixture.api.lookupOnline("كلمة", fixture.elements.get("explore-lookup"));
  assert.equal(fixture.calls.filter((message) => message.type === "online.lookup").length, 1);
  const card = fixture.elements.get("explore-card");
  assert.equal(card.children[0].textContent, "قاموس خارجي (غير مراجعة)");
  assert.equal(card.children[2].textContent, "<img onerror=alert(1)>");
  assert.match(card.children.find((node) => node.className === "online-attribution").textContent, /CC BY-SA 4\.0.*GFDL/);
  assert.match(card.children.find((node) => node.className === "online-retrieved").textContent, /2026-08-11T00:00:00\.000Z/);
  assert.equal(card.children.some((node) => node.tagName === "BUTTON"), false);
  assert.equal(fixture.calls.some((message) => message.type === "word.feedback" || message.type === "word.save"), false);
});

test("Atlas initial daily response merges returned status and save into History", async () => {
  const profile = atlasProfile();
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30", status: "known", saved: true },
    "state.export": { kind: "export", text: JSON.stringify(profile) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
  });
  await fixture.api.initialize();
  await fixture.api.renderHistory();
  assert.equal(fixture.elements.get("history-list").children.length, 1);
  assert.match(fixture.elements.get("history-list").children[0].textContent, /known|معروف/i);
  fixture.elements.get("history-filter").value = "saved";
  await fixture.api.renderHistory();
  assert.equal(fixture.elements.get("history-list").children.length, 1);
});

test("Atlas history rows show status and retain descending chronology across filters", async () => {
  const profile = atlasProfile({
    wordStates: { w1: { status: "known", dateKey: "2026-07-29", saved: true }, w2: { status: "difficult", dateKey: "2026-07-28" } },
    assignments: { "2026-07-28": { wordId: "w2", status: "difficult" }, "2026-07-29": { wordId: "w1", status: "known" } }, assignmentOrdinal: 2,
  });
  const fixture = atlasApi({ "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" }, "state.export": { kind: "export", text: JSON.stringify(profile) }, "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } } });
  await fixture.api.initialize();
  await fixture.api.renderHistory();
  assert.match(fixture.elements.get("history-list").children[0].textContent, /2026-07-30/);
  assert.match(fixture.elements.get("history-list").children[0].textContent, /known|معروف/i);
  fixture.elements.get("history-filter").value = "difficult";
  await fixture.api.renderHistory();
  assert.equal(fixture.elements.get("history-list").children.length, 1);
  assert.match(fixture.elements.get("history-list").children[0].textContent, /2026-07-28/);
});

test("Atlas valid recovery import clears raw recovery state and returns to the imported profile", async () => {
  const invalid = { schemaVersion: 999, marker: "keep" };
  const imported = atlasProfile({ level: 3 });
  let recovered = true;
  const fixture = atlasApi({
    "assignment.get": () => recovered ? { kind: "recovery", recoveryRaw: invalid } : { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": () => recovered ? { kind: "recovery", recoveryRaw: invalid } : { kind: "export", text: JSON.stringify(imported) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "state.import": () => { recovered = false; return { kind: "ok" }; },
  });
  await fixture.api.initialize();
  assert.equal(fixture.elements.get("recovery").hidden, false);
  await fixture.api.importState({ files: [{ size: JSON.stringify(imported).length, async text() { return JSON.stringify(imported); } }], value: "file" });
  assert.equal(fixture.elements.get("recovery").hidden, true);
  assert.equal(fixture.elements.get("today-view").hidden, false);
  assert.equal(fixture.api.getRecoveryRaw(), null);
});

test("Atlas import reports a committed import when refresh fails", async () => {
  const imported = atlasProfile({ level: 3 });
  const fixture = atlasApi({
    "assignment.get": new Error("refresh failed"),
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "state.import": { kind: "ok" },
  });
  await fixture.api.initialize();
  await fixture.api.importState({ files: [{ size: JSON.stringify(imported).length, async text() { return JSON.stringify(imported); } }], value: "file" });
  assert.match(fixture.elements.get("status").textContent, /استوردنا|import/i);
  assert.doesNotMatch(fixture.elements.get("status").textContent, /لم نغيّر|unchanged/i);
});

test("Atlas return-to-today shows and focuses the Today view", async () => {
  const profile = atlasProfile({ assignments: { "2026-07-29": { wordId: "w2" }, "2026-07-30": { wordId: "w1" } }, assignmentOrdinal: 2 });
  const fixture = atlasApi({
    "assignment.get": (message) => message.dateKey ? { kind: "assigned", wordId: "w2", dateKey: message.dateKey } : { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": { kind: "export", text: JSON.stringify(profile) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
  });
  await fixture.api.initialize();
  await fixture.api.loadAssignment("2026-07-29");
  await fixture.api.returnToToday();
  assert.equal(fixture.elements.get("today-view").hidden, false);
  assert.ok(fixture.elements.get("today-title").focuses > 0);
  assert.equal(fixture.elements.get("return-today").hidden, true);
});

test("Atlas no-word and load-error states are focused and leave Today actions disabled", async () => {
  const empty = atlasApi({ "assignment.get": { kind: "no-new-word", dateKey: "2026-07-30" }, "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) }, "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } } });
  await empty.api.initialize();
  assert.equal(empty.elements.get("empty").hidden, false);
  assert.equal(empty.elements.get("empty-title").focuses, 1);
  assert.equal(empty.elements.get("today-save").disabled, true);

  const failed = atlasApi({ "assignment.get": new Error("load"), "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) }, "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } } });
  await failed.api.initialize();
  assert.equal(failed.elements.get("error").hidden, false);
  assert.equal(failed.elements.get("error-title").focuses, 1);
});

test("Atlas mutation warnings and reminder races keep authoritative returned state", async () => {
  const profile = atlasProfile({ assignments: { "2026-07-30": { wordId: "w1" } }, assignmentOrdinal: 1 });
  let releaseFirst;
  let reminderCalls = 0;
  const first = new Promise((resolve) => { releaseFirst = resolve; });
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": { kind: "export", text: JSON.stringify(profile) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "word.save": { kind: "ok", storageWarning: true },
    "reminder.configure": () => { reminderCalls += 1; return reminderCalls === 1 ? first : { enabled: true, time: "18:45" }; },
  });
  await fixture.api.initialize();
  await fixture.api.toggleSave();
  assert.equal(fixture.elements.get("warning").hidden, false);
  assert.equal(fixture.elements.get("settings-reminder").getAttribute("aria-checked"), "false");
  const pending = fixture.api.configureReminder();
  const queued = fixture.api.configureReminder();
  releaseFirst({ enabled: false, time: "09:00" });
  await Promise.all([pending, queued]);
  assert.equal(fixture.api.getReminder().time, "18:45");
  assert.equal(fixture.elements.get("settings-reminder").getAttribute("aria-checked"), "true");
  assert.equal(fixture.elements.get("settings-reminder").getAttribute("aria-pressed"), null);
});

test("Atlas feedback and save update Today and History from returned authoritative fields", async () => {
  const profile = atlasProfile({ assignments: { "2026-07-30": { wordId: "w1" } }, assignmentOrdinal: 1 });
  let responseStatus = "known";
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": () => ({ kind: "export", text: JSON.stringify(profile) }),
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "word.feedback": () => {
      profile.assignments["2026-07-30"].status = responseStatus;
      profile.wordStates.w1 = { status: responseStatus, dateKey: "2026-07-30" };
      return { kind: "ok", wordId: "w1", dateKey: "2026-07-30", status: responseStatus };
    },
    "word.save": { kind: "ok", wordId: "w1", saved: true },
  });
  await fixture.api.initialize();
  await fixture.api.feedback("known");
  responseStatus = "difficult";
  await fixture.api.feedback("difficult");
  await fixture.api.toggleSave();
  await fixture.api.renderHistory();
  assert.match(fixture.elements.get("history-list").children[0].textContent, /difficult|صعب/i);
  fixture.elements.get("history-filter").value = "saved";
  await fixture.api.renderHistory();
  assert.equal(fixture.elements.get("history-list").children.length, 1);
  assert.equal(fixture.elements.get("today-difficult").getAttribute("aria-pressed"), "true");
  assert.equal(fixture.elements.get("today-save").getAttribute("aria-pressed"), "true");
});

test("Atlas Today actions expose adjacent pending, success, failure, and focus states", async () => {
  let releaseKnown;
  let releaseSave;
  const knownResult = new Promise((resolve) => { releaseKnown = resolve; });
  const saveResult = new Promise((resolve) => { releaseSave = resolve; });
  let committedStatus;
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": () => ({ kind: "export", text: JSON.stringify(atlasProfile({ assignments: { "2026-07-30": { wordId: "w1", ...(committedStatus ? { status: committedStatus } : {}) } } })) }),
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "word.feedback": async (message) => {
      const result = message.status === "known" ? await knownResult : { kind: "ok", wordId: "w1", dateKey: "2026-07-30", status: "difficult" };
      committedStatus = result.status;
      return result;
    },
    "word.save": () => saveResult,
  });
  await fixture.api.initialize();
  const known = fixture.elements.get("today-known");
  const knownPending = fixture.api.feedback("known");
  await new Promise(setImmediate);
  assert.equal(known.disabled, true);
  assert.equal(known.getAttribute("aria-busy"), "true");
  releaseKnown({ kind: "ok", wordId: "w1", dateKey: "2026-07-30", status: "known" });
  await knownPending;
  assert.equal(known.getAttribute("aria-pressed"), "true");
  assert.equal(known.focuses, 1);
  assert.equal(fixture.elements.get("today-action-status").textContent, "تم حفظ تقييمك.");
  assert.equal(fixture.elements.get("today-action-status").getAttribute("role"), "status");

  await fixture.api.feedback("difficult");
  assert.equal(fixture.elements.get("today-difficult").getAttribute("aria-pressed"), "true");
  assert.equal(fixture.elements.get("today-difficult").focuses, 1);

  const save = fixture.elements.get("today-save");
  save.focus();
  const savePending = fixture.api.toggleSave();
  activeElement = fixture.context.document.body;
  await new Promise(setImmediate);
  assert.equal(save.disabled, true);
  assert.equal(save.getAttribute("aria-busy"), "true");
  releaseSave({ kind: "ok", wordId: "w1", saved: true });
  await savePending;
  assert.equal(save.getAttribute("aria-pressed"), "true");
  assert.equal(fixture.context.document.activeElement, save);
  assert.equal(fixture.elements.get("today-action-status").textContent, "حُفظت الكلمة.");

  const failed = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": () => ({ kind: "export", text: JSON.stringify(atlasProfile({ assignments: { "2026-07-30": { wordId: "w1", ...(committedStatus ? { status: committedStatus } : {}) } } })) }),
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "word.feedback": new Error("offline"),
    "word.save": new Error("offline"),
  });
  await failed.api.initialize();
  await failed.api.feedback("difficult");
  assert.equal(failed.elements.get("today-difficult").getAttribute("aria-pressed"), "false");
  assert.equal(failed.elements.get("today-difficult").focuses, 1);
  assert.equal(failed.elements.get("today-action-status").getAttribute("role"), "alert");
  await failed.api.toggleSave();
  assert.equal(failed.elements.get("today-save").getAttribute("aria-pressed"), "false");
  assert.equal(failed.context.document.activeElement, failed.elements.get("today-difficult"), "a direct Save call must not pull focus from another control");
  assert.equal(failed.elements.get("today-action-status").textContent, "تعذّر الحفظ.");
});

test("Atlas ignores duplicate feedback and save requests while the first mutation is pending", async () => {
  let releaseFeedback;
  let releaseSave;
  const feedbackResult = new Promise((resolve) => { releaseFeedback = resolve; });
  const saveResult = new Promise((resolve) => { releaseSave = resolve; });
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "word.feedback": () => feedbackResult,
    "word.save": () => saveResult,
  });
  await fixture.api.initialize();

  const feedbackPending = fixture.api.feedback("known");
  await new Promise(setImmediate);
  await fixture.api.feedback("difficult");
  assert.equal(fixture.calls.filter((message) => message.type === "word.feedback").length, 1);
  releaseFeedback({ kind: "ok", wordId: "w1", dateKey: "2026-07-30", status: "known" });
  await feedbackPending;

  const savePending = fixture.api.toggleSave();
  await new Promise(setImmediate);
  await fixture.api.toggleSave();
  assert.equal(fixture.calls.filter((message) => message.type === "word.save").length, 1);
  releaseSave({ kind: "ok", wordId: "w1", saved: true });
  await savePending;
});

test("Atlas recovery feedback keeps focus in the recovery view", async () => {
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "word.feedback": { kind: "recovery", recoveryRaw: { broken: true } },
  });
  await fixture.api.initialize();
  await fixture.api.feedback("known");
  assert.equal(fixture.elements.get("recovery").hidden, false);
  assert.equal(fixture.elements.get("recovery-title").focuses, 1);
  assert.equal(fixture.elements.get("today-known").focuses, 0);
});

test("Atlas settings rerender English visibility in Today and the current Explore card", async () => {
  const profile = atlasProfile({ assignments: { "2026-07-30": { wordId: "w1" } }, assignmentOrdinal: 1 });
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": { kind: "export", text: JSON.stringify(profile) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "settings.update": { kind: "ok" },
  });
  await fixture.api.initialize();
  fixture.api.viewWord({ id: "w1", word: "كلمة", meaningAr: "معنى", meaningEn: "meaning", pronunciation: "/w1/", exampleAr: "مثال" });
  fixture.elements.get("settings-english").checked = false;
  fixture.levels[0].checked = true;
  await fixture.api.saveSettings();
  assert.equal(fixture.elements.get("today-card").children.some((node) => node.className === "english"), false);
  assert.equal(fixture.elements.get("explore-card").children.some((node) => node.className === "english"), false);
});

test("Atlas renders practical context before the literary example and honors English visibility", async () => {
  const word = { id: "w1", word: "كلمة", normalized: "كلمة", meaningAr: "معنى", meaningEn: "meaning", contextAr: "سياق عملي", contextEn: "practical context", exampleAr: "مثال أدبي", pronunciation: "/w1/" };
  const responses = {
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile({ assignments: { "2026-07-30": { wordId: "w1" } }, assignmentOrdinal: 1 })) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
  };
  const visible = atlasApi(responses, { vocabulary: [word] });
  await visible.api.initialize();
  const cards = visible.elements.get("today-card").children;
  const context = cards.find((node) => node.className === "context");
  const example = cards.find((node) => node.className === "example");
  const contextEnglish = cards.find((node) => node.children?.some((child) => child.className === "context english"))?.children.find((node) => node.className === "context english");
  assert.ok(context && example && contextEnglish);
  assert.ok(cards.indexOf(context) < cards.indexOf(example));
  assert.equal(context.children.at(-1).textContent, "سياق عملي");
  assert.equal(contextEnglish.children.at(-1).textContent, "practical context");

  const hidden = atlasApi({ ...responses, "state.export": { kind: "export", text: JSON.stringify(atlasProfile({ showEnglish: false, assignments: { "2026-07-30": { wordId: "w1" } }, assignmentOrdinal: 1 })) } }, { vocabulary: [word] });
  await hidden.api.initialize();
  assert.equal(hidden.elements.get("today-card").children.some((node) => node.className === "context english"), false);
});

test("Atlas renders the current card's exact review intervals", async () => {
  const word = { id: "w1", word: "كلمة", meaningAr: "معنى", meaningEn: "meaning", pronunciation: "/w1/", exampleAr: "مثال" };
  const reviewOptions = {
    again: { interval: 1, nextReviewDate: "2026-08-18", label: "غدًا" },
    hard: { interval: 1, nextReviewDate: "2026-08-18", label: "غدًا" },
    good: { interval: 1, nextReviewDate: "2026-08-18", label: "غدًا" },
    easy: { interval: 1, nextReviewDate: "2026-08-18", label: "غدًا" },
  };
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-08-17" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile({ assignments: { "2026-08-17": { wordId: "w1" } }, assignmentOrdinal: 1 })) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "review.queue": { kind: "queue", words: [{ word, reviewOptions }], dueCount: 1, visibleCount: 1, remainingCount: 0 },
  }, { vocabulary: [word] });
  await fixture.api.initialize();
  await fixture.api.loadDueReviews();
  await fixture.api.openPracticeModal();

  for (const id of ["rate-again", "rate-hard", "rate-good", "rate-easy"]) {
    assert.equal(fixture.elements.get(id).children[0].textContent, "غدًا");
  }
});

test("Atlas flip control exposes state, keeps speaker independent, and resets for the next card", async () => {
  const words = [
    { id: "w1", word: "الأولى", meaningAr: "معنى أول", pronunciation: "/w1/", exampleAr: "مثال" },
    { id: "w2", word: "الثانية", meaningAr: "معنى ثان", pronunciation: "/w2/", exampleAr: "مثال" },
  ];
  const reviewOptions = { again: { label: "غدًا" }, hard: { label: "غدًا" }, good: { label: "غدًا" }, easy: { label: "غدًا" } };
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-08-17" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile({ assignments: { "2026-08-17": { wordId: "w1" } }, assignmentOrdinal: 1 })) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "review.queue": { kind: "queue", words: words.map((word) => ({ word, reviewOptions })), dueCount: 2, visibleCount: 2, remainingCount: 0 },
    "word.review": { kind: "ok" },
  }, { vocabulary: words });
  await fixture.api.initialize();
  await fixture.api.loadDueReviews();
  await fixture.api.openPracticeModal();

  const flip = fixture.elements.get("card-front-flip");
  const card = fixture.elements.get("flashcard-card");
  fixture.elements.get("card-front-speak").listeners.click({ stopPropagation() {} });
  assert.equal(card.classList.contains("flipped"), false);

  flip.listeners.click({ stopPropagation() {} });
  assert.equal(flip.getAttribute("aria-pressed"), "true");
  assert.equal(flip.getAttribute("aria-label"), "أخفِ المعنى");
  assert.equal(fixture.elements.get("status").textContent, "كُشف المعنى.");
  flip.listeners.click({ stopPropagation() {} });
  assert.equal(flip.getAttribute("aria-pressed"), "false");
  assert.equal(flip.getAttribute("aria-label"), "اقلب البطاقة");
  assert.equal(fixture.elements.get("status").textContent, "أُخفي المعنى.");

  await fixture.api.submitRating("good");
  assert.equal(fixture.elements.get("card-front-flip").getAttribute("aria-pressed"), "false");
  assert.equal(fixture.elements.get("card-front-flip").getAttribute("aria-label"), "اقلب البطاقة");
});

test("Atlas does not reopen stale review cards while the post-close queue refresh is pending", async () => {
  const firstWord = { id: "w1", word: "الأولى", meaningAr: "معنى أول", pronunciation: "/w1/", exampleAr: "مثال" };
  const remainingWord = { id: "w2", word: "الثانية", meaningAr: "معنى ثان", pronunciation: "/w2/", exampleAr: "مثال" };
  const reviewOptions = { again: { label: "غدًا" }, hard: { label: "غدًا" }, good: { label: "غدًا" }, easy: { label: "غدًا" } };
  const initialQueue = { kind: "queue", words: [{ word: firstWord, reviewOptions }], dueCount: 2, visibleCount: 1, remainingCount: 1 };
  const refreshedQueue = { kind: "queue", words: [{ word: remainingWord, reviewOptions }], dueCount: 1, visibleCount: 1, remainingCount: 0 };
  let queueCalls = 0;
  let resolveRefresh;
  const refreshPending = new Promise((resolve) => { resolveRefresh = resolve; });
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-08-17" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile({ assignments: { "2026-08-17": { wordId: "w1" } }, assignmentOrdinal: 1 })) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "review.queue": () => {
      queueCalls += 1;
      return queueCalls <= 2 ? initialQueue : refreshPending;
    },
  }, { vocabulary: [firstWord, remainingWord] });
  await fixture.api.initialize();
  await fixture.api.loadDueReviews();
  await fixture.api.openPracticeModal();
  assert.equal(fixture.elements.get("practice-dialog").open, true);

  fixture.api.closePracticeModal();
  fixture.api.openPracticeModal();
  assert.equal(queueCalls, 3);
  assert.equal(fixture.elements.get("practice-dialog").open, false, "reopen waits for the authoritative refresh");

  resolveRefresh(refreshedQueue);
  await new Promise(setImmediate);
  assert.equal(fixture.elements.get("practice-dialog").open, true);
  assert.equal(fixture.elements.get("card-front-word").textContent, "الثانية");
});

test("Atlas startup loads a due badge and keeps zero due hidden", async () => {
  const profile = atlasProfile({ assignments: { "2026-08-17": { wordId: "w1" } }, assignmentOrdinal: 1 });
  const base = {
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-08-17" },
    "state.export": { kind: "export", text: JSON.stringify(profile) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
  };
  const due = atlasApi({ ...base, "review.queue": { kind: "queue", words: [{ wordId: "w1", word: { id: "w1", word: "كلمة", meaningAr: "معنى" } }], dueCount: 1, visibleCount: 1, remainingCount: 0 } });
  await due.api.initialize();
  assert.equal(due.calls.filter((message) => message.type === "review.queue").length, 1);
  assert.equal(due.elements.get("due-review-badge").hidden, false);
  assert.match(due.elements.get("due-review-badge").getAttribute("aria-label"), /المراجعات المستحقة/);
  const warned = atlasApi({ ...base, "assignment.get": { ...base["assignment.get"], storageWarning: true }, "review.queue": { kind: "queue", words: [{ wordId: "w1", word: { id: "w1", word: "كلمة", meaningAr: "معنى" } }], dueCount: 1, visibleCount: 1, remainingCount: 0 } });
  await warned.api.initialize();
  assert.equal(warned.elements.get("warning").hidden, false, "queue hydration must preserve an assignment storage warning");
  const zero = atlasApi({ ...base, "review.queue": { kind: "queue", words: [], dueCount: 0, visibleCount: 0, remainingCount: 0 } });
  await zero.api.initialize();
  assert.equal(zero.elements.get("due-review-badge").hidden, true);
});

test("Atlas paints the daily word before hydrating the review queue", async () => {
  let releaseQueue;
  let queueResolved = false;
  const pendingQueue = new Promise((resolve) => { releaseQueue = resolve; });
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-08-17" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile({ assignments: { "2026-08-17": { wordId: "w1" } }, assignmentOrdinal: 1 })) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "review.queue": () => pendingQueue,
  });
  fixture.elements.get("today-view").hidden = true;
  const heading = fixture.elements.get("today-title");
  const originalFocus = heading.focus.bind(heading);
  let focusBeforeQueue = false;
  heading.focus = () => {
    if (!queueResolved) focusBeforeQueue = true;
    originalFocus();
  };
  const initializing = fixture.api.initialize();
  await new Promise(setImmediate);
  assert.equal(fixture.calls.some((message) => message.type === "review.queue"), true, "review queue must hydrate in the background");
  assert.equal(fixture.elements.get("today-view").hidden, false, "the daily word must paint before the queue round-trip resolves");
  assert.equal(heading.focuses, 1, "today view must be focused once, without waiting on the queue");
  assert.equal(focusBeforeQueue, true, "focus must happen before queue hydration completes");
  queueResolved = true;
  releaseQueue({ kind: "queue", words: [], dueCount: 0, visibleCount: 0, remainingCount: 0 });
  await initializing;
  assert.equal(heading.focuses, 1, "queue hydration must not refocus the view");
});

test("Atlas rejected queues render a retryable error and do not claim completion", async () => {
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-08-17" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile({ assignments: { "2026-08-17": { wordId: "w1" } }, assignmentOrdinal: 1 })) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "review.queue": new Error("queue"),
  });
  await fixture.api.initialize();
  assert.equal(fixture.elements.get("due-review-badge").hidden, true);
  await fixture.api.openPracticeModal();
  await new Promise(setImmediate);
  assert.equal(fixture.elements.get("practice-dialog").open, true);
  assert.equal(fixture.elements.get("practice-body").hidden, false);
  assert.equal(fixture.elements.get("practice-finished").hidden, true);
  assert.equal(fixture.elements.get("practice-error").hidden, false);

  const inconsistent = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-08-17" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile({ assignments: { "2026-08-17": { wordId: "w1" } }, assignmentOrdinal: 1 })) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "review.queue": { kind: "queue", words: [], dueCount: 1, visibleCount: 1, remainingCount: 0 },
  });
  await inconsistent.api.initialize();
  assert.equal(inconsistent.elements.get("due-review-badge").hidden, true);
  await inconsistent.api.openPracticeModal();
  await new Promise(setImmediate);
  assert.equal(inconsistent.elements.get("practice-error").hidden, false, "inconsistent queue counts must be retryable errors");
  assert.equal(inconsistent.elements.get("practice-finished").hidden, true);
});

test("Atlas review reveal gate controls keyboard ratings and returns focus to its invoker", async () => {
  const words = [
    { id: "w1", word: "الأولى", meaningAr: "معنى أول", pronunciation: "/w1/" },
    { id: "w2", word: "الثانية", meaningAr: "معنى ثان", pronunciation: "/w2/" },
  ];
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-08-17" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile({ assignments: { "2026-08-17": { wordId: "w1" } }, assignmentOrdinal: 1 })) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "review.queue": { kind: "queue", words: words.map((word) => ({ wordId: word.id, word })), dueCount: 2, visibleCount: 2, remainingCount: 0 },
    "word.review": { kind: "ok" },
  }, { vocabulary: words });
  await fixture.api.initialize();
  const invoker = fixture.elements.get("due-review-badge");
  invoker.focus();
  await fixture.api.openPracticeModal();
  assert.equal(fixture.elements.get("rate-good").disabled, true);
  assert.equal(fixture.elements.get("card-front-face").getAttribute("aria-hidden"), "false");
  assert.equal(fixture.elements.get("card-back-face").getAttribute("aria-hidden"), "true");
  const event = { type: "keydown", key: "1", target: { tagName: "DIV" }, preventDefault() {} };
  fixture.documentListeners.keydown(event);
  assert.equal(fixture.calls.some((message) => message.type === "word.review"), false);
  fixture.elements.get("card-front-flip").listeners.click({});
  assert.equal(fixture.elements.get("rate-good").disabled, false);
  assert.equal(fixture.elements.get("card-back-face").getAttribute("aria-hidden"), "false");
  fixture.documentListeners.keydown(event);
  await new Promise(setImmediate);
  assert.equal(fixture.calls.filter((message) => message.type === "word.review").length, 1);
  assert.equal(fixture.elements.get("rate-good").disabled, true);
  fixture.elements.get("card-front-flip").listeners.click({});
  fixture.documentListeners.keydown({ type: "keydown", key: "2", target: { tagName: "DIV" }, preventDefault() {} });
  await new Promise(setImmediate);
  assert.equal(fixture.calls.filter((message) => message.type === "word.review").length, 2);
  fixture.api.closePracticeModal();
  assert.equal(fixture.context.document.activeElement, invoker);
});

test("Atlas rejected ratings restore revealed controls for a retry", async () => {
  const word = { id: "w1", word: "كلمة", meaningAr: "معنى", pronunciation: "/w1/" };
  let releaseReview;
  let reviewCalls = 0;
  const pendingReview = new Promise((resolve) => { releaseReview = resolve; });
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-08-17" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile({ assignments: { "2026-08-17": { wordId: "w1" } }, assignmentOrdinal: 1 })) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "review.queue": { kind: "queue", words: [{ wordId: "w1", word }], dueCount: 1, visibleCount: 1, remainingCount: 0 },
    "word.review": () => {
      reviewCalls += 1;
      return reviewCalls === 1 ? pendingReview : { kind: "ok" };
    },
  });
  await fixture.api.initialize();
  await fixture.api.openPracticeModal();
  assert.equal(fixture.elements.get("rate-good").disabled, true);
  fixture.elements.get("card-front-flip").listeners.click({});
  assert.equal(fixture.elements.get("rate-good").disabled, false);
  const firstAttempt = fixture.api.submitRating("good");
  assert.equal(fixture.elements.get("rate-good").disabled, true);
  releaseReview(new Error("review"));
  await firstAttempt;
  assert.equal(fixture.elements.get("rate-good").disabled, false);
  assert.equal(fixture.elements.get("card-back-face").getAttribute("aria-hidden"), "false");
  await fixture.api.submitRating("good");
  assert.equal(reviewCalls, 2);
});

test("Atlas search includes practical context and vocabulary metadata", async () => {
  const word = { id: "w1", word: "كلمة", normalized: "كلمة", meaningAr: "معنى", meaningEn: "meaning", contextAr: "market counter", contextEn: "at the market", exampleAr: "مثال", pronunciation: "/w1/", root: "k-t-b", pattern: "fa3ala", register: "standard", partOfSpeech: "verb", reviewed: true };
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile({ assignments: { "2026-07-30": { wordId: "w1" } }, assignmentOrdinal: 1 })) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
  }, { vocabulary: [word] });
  await fixture.api.initialize();
  for (const query of ["market", "k-t-b", "fa3ala", "standard", "verb"]) {
    fixture.elements.get("atlas-search").value = query;
    fixture.api.search();
    assert.equal(fixture.elements.get("search-results").children.length, 1, query);
    assert.match(fixture.elements.get("search-results").children[0].textContent, /كلمة/);
  }
});

test("Atlas clear followed by onboarding settings requests and renders a new daily assignment", async () => {
  const profile = atlasProfile({ assignments: { "2026-07-30": { wordId: "w1" } }, assignmentOrdinal: 1 });
  let assignmentCalls = 0;
  const fixture = atlasApi({
    "assignment.get": () => { assignmentCalls += 1; return { kind: "assigned", wordId: assignmentCalls === 1 ? "w1" : "w2", dateKey: "2026-07-30" }; },
    "state.export": { kind: "export", text: JSON.stringify(profile) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "state.clear": { kind: "ok" },
    "settings.update": { kind: "ok" },
  });
  await fixture.api.initialize();
  await fixture.api.clearState();
  fixture.levels[0].checked = true;
  fixture.elements.get("settings-english").checked = true;
  await fixture.api.saveSettings();
  assert.equal(assignmentCalls, 2);
  assert.equal(fixture.elements.get("today-view").hidden, false);
  assert.equal(fixture.elements.get("today-card").children.length > 0, true);
});

test("Atlas clear does not retain a profile-only warning as a reminder warning", async () => {
  const profile = atlasProfile({ assignments: { "2026-07-30": { wordId: "w1" } }, assignmentOrdinal: 1 });
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": { kind: "export", text: JSON.stringify(profile) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "state.clear": { kind: "ok", storageWarning: true, reminderWarning: false },
    "settings.update": { kind: "ok" },
  });
  await fixture.api.initialize();
  await fixture.api.clearState();
  assert.equal(fixture.elements.get("warning").hidden, false);
  fixture.levels[0].checked = true;
  await fixture.api.saveSettings();
  assert.equal(fixture.elements.get("warning").hidden, true);
});

test("Atlas exposes theme-select, streak-badge, and export controls in HTML", () => {
  const html = atlasSource("atlas.html");
  assert.match(html, /<select\s+id="theme-select"[^>]*aria-label="اختر السمة"/);
  assert.match(html, /<option\s+value="paper">ورقي<\/option>/);
  assert.match(html, /<option\s+value="emerald">زمردي<\/option>/);
  assert.match(html, /<option\s+value="midnight">ليلي<\/option>/);
  assert.doesNotMatch(html, /id="streak-badge"/);
  assert.match(html, /<button\s+id="today-export-card"[^>]*>بطاقة للمشاركة<\/button>/);
  assert.match(html, /<button\s+id="history-export-anki"[^>]*>تصدير إلى Anki \(CSV\)<\/button>/);
  assert.match(html, /<button\s+id="btn-export-anki"[^>]*>تصدير بطاقات Anki \(CSV\)<\/button>/);
  assert.match(html, /<script\s+src="\.\.\/shared\/theme\.js"><\/script>/);
  assert.match(html, /<script\s+src="\.\.\/shared\/streak\.js"><\/script>/);
  assert.match(html, /<script\s+src="\.\.\/shared\/export\.js"><\/script>/);
});

test("Atlas ThemeController initializes, binds select, and persists theme changes", async () => {
  const profile = atlasProfile({ assignments: { "2026-08-14": { wordId: "w1" } }, assignmentOrdinal: 1 });
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-08-14" },
    "state.export": { kind: "export", text: JSON.stringify(profile) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
  }, { theme: "midnight" });
  await fixture.api.initialize();

  const themeSelect = fixture.elements.get("theme-select");
  assert.equal(themeSelect.value, "midnight");
  assert.equal(fixture.context.document.documentElement.getAttribute("data-theme"), "midnight");

  themeSelect.value = "emerald";
  if (themeSelect.listeners["change"]) {
    await themeSelect.listeners["change"]();
  }
  assert.equal(fixture.context.document.documentElement.getAttribute("data-theme"), "emerald");
  assert.equal(fixture.storageData["kalimat.theme"], "emerald");

  for (const listener of fixture.storageListeners) {
    listener({ "kalimat.theme": { newValue: "paper" } }, "local");
  }
  assert.equal(themeSelect.value, "paper");
  assert.equal(fixture.context.document.documentElement.getAttribute("data-theme"), "paper");
});


test("Atlas Anki CSV and Social Card exports download valid deck and 1080x1080 PNG", async () => {
  const word = {
    id: "w1",
    word: "كِتَابٌ",
    meaningAr: "مُؤَلَّفٌ",
    meaningEn: "book",
    pronunciation: "/kitaab/",
    contextAr: "قَرَأْتُ كِتَابًا",
    exampleAr: "خَيْرُ جَلِيسٍ",
    root: "ك-ت-ب",
    pattern: "فِعَال",
  };
  const profile = atlasProfile({
    assignments: { "2026-08-14": { wordId: "w1", status: "known" } },
    assignmentOrdinal: 1,
    wordStates: { w1: { status: "known", saved: true } },
  });
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-08-14" },
    "state.export": { kind: "export", text: JSON.stringify(profile) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
  }, { vocabulary: [word] });
  await fixture.api.initialize();

  await fixture.api.exportAnkiCSV();
  assert.equal(fixture.downloads.length, 1);
  assert.equal(fixture.downloads[0].download, "kalimat-anki-deck.csv");

  await fixture.api.exportSocialCard(word, fixture.elements.get("today-export-card"));
  assert.equal(fixture.downloads.length, 2);
  assert.equal(fixture.downloads[1].download, "kalimat-word-w1.png");
});

test("All popup and atlas files maintain zero CSP violations and no unsafe sinks", () => {
  const popupHtml = source("popup.html");
  const popupCss = source("popup.css");
  const popupJs = source("popup.js");
  const atlasHtml = atlasSource("atlas.html");
  const atlasCss = atlasSource("atlas.css");
  const atlasJs = atlasSource("atlas.js");

  for (const [name, content] of [["popup.html", popupHtml], ["atlas.html", atlasHtml]]) {
    assert.doesNotMatch(content, /\son[a-z]+\s*=/i, `${name} has inline event handler`);
    assert.doesNotMatch(content, /<script(?![^>]+\bsrc=)[^>]*>/i, `${name} has inline script`);
    assert.doesNotMatch(content, /<style\b/i, `${name} has inline style tag`);
  }

  for (const [name, content] of [["popup.js", popupJs], ["atlas.js", atlasJs]]) {
    const withoutApprovedRemote = content.replace(/https:\/\/ar\.wiktionary\.org[^\s"'`)]*/g, "");
    assert.doesNotMatch(withoutApprovedRemote, /https?:\/\/|\b(?:innerHTML|outerHTML)\b|\b(?:setInterval|setTimeout)\s*\(/, `${name} contains unsafe sink or timer`);
  }
});

for (const surface of ["Atlas"]) {
  test(`${surface} refreshes daily and external review changes without replacing an active or pending card`, async () => {
    const profile = atlasProfile({ assignments: { "2026-07-30": { wordId: "w1" } }, assignmentOrdinal: 1 });
    const word = { id: "w1", word: "كلمة", meaningAr: "معنى", pronunciation: "/w1/" };
    let due = true;
    let releaseRating;
    const pendingRating = new Promise((resolve) => { releaseRating = resolve; });
    const responses = {
      "assignment.get": { kind: "assigned", wordId: "w1", word, dateKey: "2026-07-30" },
      "state.export": () => ({ kind: "export", text: JSON.stringify(profile) }),
      "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
      "review.queue": () => ({ kind: "queue", words: due ? [{ wordId: "w1", word }] : [], dueCount: due ? 1 : 0, visibleCount: due ? 1 : 0, remainingCount: 0 }),
      "word.feedback": () => {
        due = false;
        profile.assignments["2026-07-30"].status = "known";
        profile.wordStates.w1 = { status: "known", dateKey: "2026-07-30" };
        return { kind: "ok", status: "known", dateKey: "2026-07-30", wordId: "w1" };
      },
      "word.review": () => pendingRating,
    };
    const fixture = surface === "popup" ? popupApi(responses, { profile, vocabulary: [word] }) : atlasApi(responses, { vocabulary: [word] });
    await fixture.api.initialize();
    await (surface === "popup" ? fixture.api.sendFeedback("known") : fixture.api.feedback("known"));
    assert.equal(fixture.elements.get("due-review-badge").hidden, true, "feedback removes the now-reviewed daily word from the queue");
    // A change in another page refreshes the idle badge and the saved indicator.
    due = true;
    profile.wordStates.w1.saved = true;
    for (const listener of fixture.storageListeners) listener({ "kalimat.profile": { newValue: profile } }, "local");
    await new Promise(setImmediate);
    assert.equal(fixture.elements.get("due-review-badge").hidden, false);
    assert.equal(fixture.elements.get(surface === "popup" ? "save" : "today-save").getAttribute("aria-pressed"), "true");
    // The new session rechecks authority even without a delivered storage event.
    due = false;
    await fixture.api.openPracticeModal();
    assert.equal(fixture.elements.get("practice-finished").hidden, false);
    fixture.api.closePracticeModal();
    await new Promise(setImmediate);
    due = true;
    await fixture.api.openPracticeModal();
    fixture.elements.get("card-front-flip").listeners.click({});
    due = false;
    for (const listener of fixture.storageListeners) listener({ "kalimat.profile": { newValue: profile } }, "local");
    await new Promise(setImmediate);
    assert.equal(fixture.elements.get("card-front-word").textContent, word.word);
    assert.equal(fixture.elements.get("card-front-flip").getAttribute("aria-pressed"), "true");
    const rating = fixture.api.submitRating("good");
    await new Promise(setImmediate);
    for (const listener of fixture.storageListeners) listener({ "kalimat.profile": { newValue: profile } }, "local");
    await new Promise(setImmediate);
    assert.equal(fixture.elements.get("card-front-word").textContent, word.word);
    assert.equal(fixture.elements.get("rate-good").disabled, true);
    releaseRating({ kind: "ok" });
    await rating;
  });
}

for (const surface of ["Atlas"]) {
  test(`${surface} reloads authority after feedback overlaps a pending startup queue`, async () => {
    const profile = atlasProfile({ assignments: { "2026-07-30": { wordId: "w1" } }, assignmentOrdinal: 1 });
    const word = { id: "w1", word: "كلمة", meaningAr: "معنى", pronunciation: "/w1/" };
    let releaseStartupQueue;
    const startupQueue = new Promise((resolve) => { releaseStartupQueue = resolve; });
    let queueCalls = 0;
    const responses = {
      "assignment.get": { kind: "assigned", wordId: "w1", word, dateKey: "2026-07-30" },
      "state.export": () => ({ kind: "export", text: JSON.stringify(profile) }),
      "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
      "review.queue": () => {
        queueCalls += 1;
        return queueCalls === 1 ? startupQueue : { kind: "queue", words: [], dueCount: 0, visibleCount: 0, remainingCount: 0 };
      },
      "word.feedback": () => {
        profile.assignments["2026-07-30"].status = "known";
        profile.wordStates.w1 = { status: "known", dateKey: "2026-07-30" };
        return { kind: "ok", status: "known", wordId: "w1", dateKey: "2026-07-30" };
      },
    };
    const fixture = surface === "popup" ? popupApi(responses, { profile, vocabulary: [word] }) : atlasApi(responses, { vocabulary: [word] });
    const startup = fixture.api.initialize();
    await new Promise(setImmediate);
    assert.equal(queueCalls, 1);
    const feedback = surface === "popup" ? fixture.api.sendFeedback("known") : fixture.api.feedback("known");
    await new Promise(setImmediate);
    assert.equal(profile.assignments["2026-07-30"].status, "known");
    releaseStartupQueue({ kind: "queue", words: [{ wordId: "w1", word }], dueCount: 1, visibleCount: 1, remainingCount: 0 });
    await Promise.all([startup, feedback]);
    assert.equal(queueCalls, 2, "forced refresh waits for a subsequent authoritative request");
    assert.equal(fixture.elements.get("due-review-badge").hidden, true);
  });
}

for (const surface of ["Atlas"]) {
  for (const replacement of [false, true]) {
    test(`${surface} discards a stale review card and retries the current ${replacement ? "imported" : "cleared"} queue`, async () => {
      const word = { id: "w1", word: "كلمة", meaningAr: "معنى" };
      const replacementWord = { id: "w2", word: "جديد", meaningAr: "معنى جديد" };
      const profile = atlasProfile({ assignments: { "2026-07-30": { wordId: "w1" } }, assignmentOrdinal: 1 });
      let stale = false;
      const responses = {
        "assignment.get": { kind: "assigned", wordId: "w1", word, dateKey: "2026-07-30" },
        "state.export": { kind: "export", text: JSON.stringify(profile) },
        "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
        "review.queue": () => {
          const words = stale ? (replacement ? [{ word: replacementWord }] : []) : [{ word }];
          return { kind: "queue", words, dueCount: words.length, visibleCount: words.length, remainingCount: 0 };
        },
        "word.review": () => ({ kind: "stale" }),
      };
      const fixture = surface === "popup" ? popupApi(responses, { profile, vocabulary: [word, replacementWord] }) : atlasApi(responses, { vocabulary: [word, replacementWord] });
      await fixture.api.initialize();
      await fixture.api.openPracticeModal();
      fixture.elements.get("card-front-flip").listeners.click({});
      stale = true; // Authority changed without a delivered storage event.
      await fixture.api.submitRating("good");
      assert.equal(fixture.elements.get("practice-error").hidden, false);
      assert.match(fixture.elements.get("practice-error-message").textContent, /تغيّرت بيانات التعلّم/);
      assert.equal(fixture.elements.get("card-front-word").textContent, "");
      assert.equal(fixture.elements.get("rate-good").disabled, true);
      await fixture.api.submitRating("good");
      assert.equal(fixture.calls.filter((message) => message.type === "word.review").length, 1, "retrying rating cannot resend the rejected card");
      await fixture.elements.get("practice-retry").listeners.click({});
      await new Promise(setImmediate);
      assert.equal(fixture.elements.get("practice-error").hidden, true);
      assert.equal(fixture.elements.get("practice-finished").hidden, replacement);
      assert.equal(fixture.elements.get("card-front-word").textContent, replacement ? replacementWord.word : "");
    });
  }
}


test("failed profile mutations retain durable controls and retry explicit save intent", async () => {
  for (const surface of ["popup", "atlas"]) {
    let fail = true;
    const replies = {
      "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
      "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
      "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
      "word.save": (message) => ({ kind: "ok", wordId: "w1", saved: message.saved, storageWarning: fail }),
      "word.feedback": { kind: "ok", status: "known", storageWarning: true },
    };
    const fixture = surface === "popup" ? popupApi(replies) : atlasApi(replies);
    if (surface === "popup") await fixture.api.renderAssigned({ word: { id: "w1", word: "كلمة" }, dateKey: "2026-07-30" });
    else await fixture.api.initialize();
    const save = fixture.elements.get(surface === "popup" ? "save" : "today-save");
    save.focus();
    await fixture.api.toggleSave();
    assert.notEqual(save.getAttribute("aria-pressed"), "true");
    assert.match(fixture.elements.get(surface === "popup" ? "action-status" : "status").textContent, /مؤقت.*لم يُحفظ/);
    assert.equal(save.disabled, false);
    assert.equal(fixture.context.document.activeElement, save);
    fail = false;
    await fixture.api.toggleSave();
    const saves = fixture.calls.filter((message) => message.type === "word.save");
    assert.deepEqual(saves.map((message) => message.saved), [true, true]);
    assert.equal(save.getAttribute("aria-pressed"), "true");
    if (surface !== "popup") {
      await fixture.api.feedback("known");
      assert.match(fixture.elements.get("status").textContent, /مؤقت.*لم يُحفظ/);
      assert.notEqual(fixture.elements.get("today-known").getAttribute("aria-pressed"), "true");
    }
  }
});

test("Atlas failed settings import and clear never announce durable success", async () => {
  const profile = atlasProfile();
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": { kind: "export", text: JSON.stringify(profile) },
    "settings.get": { kind: "settings", reminder: { enabled: true, time: "10:30" } },
    "settings.update": { kind: "ok", storageWarning: true },
    "state.import": { kind: "ok", storageWarning: true },
    "state.clear": { kind: "ok", profilePersisted: false, storageWarning: true, reminderWarning: true, reminder: { enabled: true, time: "10:30" } },
  });
  await fixture.api.initialize();
  fixture.levels[0].checked = true;
  fixture.elements.get("settings-remote-speech").checked = true;
  await fixture.api.saveSettings();
  assert.match(fixture.elements.get("status").textContent, /مؤقتة.*لم تُحفظ/);
  await fixture.api.importState({ files: [{ size: 10, text: async () => JSON.stringify(profile) }], value: "file" });
  assert.match(fixture.elements.get("status").textContent, /مؤقت.*لم يُحفظ/);
  await fixture.api.clearState();
  assert.match(fixture.elements.get("status").textContent, /مؤقت.*لم يُحفظ/);
  assert.equal(fixture.api.getReminder().enabled, true);
  assert.equal(fixture.api.getReminder().time, "10:30");
  assert.equal(fixture.elements.get("settings-reminder").getAttribute("aria-checked"), "true");
  await fixture.api.returnToToday();
  assert.equal(fixture.elements.get("today-view").hidden, false, "failed clear retains the prior current assignment");
  assert.doesNotMatch(fixture.elements.get("today-card").children.find((node) => node.className === "word-speak").textContent, /الإنترنت/, "failed settings/clear do not adopt draft consent");
  assert.equal(fixture.calls.filter((call) => call.type === "state.export").length, 1, "failed clear does not discard the confirmed profile");
});

test("clear profile success is separate from a failed reminder disable", async () => {
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
    "settings.get": { kind: "settings", reminder: { enabled: true, time: "10:30" } },
    "state.clear": { kind: "ok", profilePersisted: true, storageWarning: true, reminderWarning: true, reminder: { enabled: true, time: "10:30" } },
  });
  await fixture.api.initialize();
  await fixture.api.clearState();
  assert.match(fixture.elements.get("status").textContent, /مُسحت البيانات.*التذكير/);
  assert.equal(fixture.elements.get("onboarding").hidden, false);
  assert.equal(fixture.api.getReminder().enabled, true);
});


test("Atlas shows remote possibility before playback and reports empty inventories and async errors", async () => {
  const spoken = [];
  let voices = [];
  class Utterance { constructor(text) { this.text = text; } }
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile({ preferences: { allowRemoteSpeech: true } })) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
  }, { speechSynthesis: { getVoices: () => voices, speak: (item) => spoken.push(item), cancel() {} }, SpeechSynthesisUtterance: Utterance });
  await fixture.api.initialize();
  const speaker = fixture.elements.get("today-card").children.find((node) => node.className === "word-speak");
  assert.match(speaker.textContent, /الإنترنت/);
  assert.match(speaker.getAttribute("aria-label"), /الإنترنت/);
  assert.equal(fixture.elements.get("settings-remote-speech").checked, true);
  fixture.api.speak("كلمة");
  assert.match(fixture.elements.get("status").textContent, /لم تجهز.*مجددًا/);
  assert.equal(spoken.length, 0);
  voices = [{ lang: "ar-SA", localService: false }];
  fixture.api.speak("كلمة");
  assert.equal(spoken.length, 1);
  spoken[0].onstart();
  assert.match(fixture.elements.get("status").textContent, /جارٍ النطق/);
  spoken[0].onerror();
  assert.match(fixture.elements.get("status").textContent, /تعذّر تشغيل النطق/);
});


test("Atlas warning import resets selection so the same file can be retried", async () => {
  const fixture = atlasApi({
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.import": { kind: "ok", storageWarning: true },
  });
  await fixture.api.initialize();
  const input = { files: [{ size: 10, text: async () => JSON.stringify(atlasProfile()) }], value: "same-file.json" };
  await fixture.api.importState(input);
  assert.equal(input.value, "");
  assert.match(fixture.elements.get("status").textContent, /مؤقت.*لم يُحفظ/);
  input.value = "same-file.json";
  await fixture.api.importState(input);
  assert.equal(input.value, "");
  assert.equal(fixture.calls.filter((message) => message.type === "state.import").length, 2);
});

test("unknown clear reminder retains prior confirmed controls in Atlas", async () => {
  const clear = { kind: "ok", profilePersisted: true, storageWarning: true, reminderWarning: true, reminder: null };
  const atlas = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
    "settings.get": { kind: "settings", reminder: { enabled: true, time: "10:30" } },
    "state.clear": clear,
  });
  await atlas.api.initialize();
  await atlas.api.clearState();
  assert.equal(atlas.api.getReminder().enabled, true);
  assert.equal(atlas.api.getReminder().time, "10:30");
  assert.equal(atlas.elements.get("settings-reminder").getAttribute("aria-checked"), "true");
  assert.equal(atlas.elements.get("onboarding").hidden, false);

});

test("deferred Atlas settings commit uses submitted consent and speech preferences", async () => {
  let release;
  let voices = [{ lang: "ar", localService: false }];
  const spoken = [];
  class Utterance { constructor(text) { this.text = text; } }
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "settings.update": () => new Promise((resolve) => { release = resolve; }),
  }, { speechSynthesis: { getVoices: () => voices, speak: (item) => spoken.push(item), cancel() {} }, SpeechSynthesisUtterance: Utterance });
  await fixture.api.initialize();
  fixture.elements.get("settings-remote-speech").checked = false;
  fixture.elements.get("settings-english").checked = false;
  fixture.elements.get("settings-speech-rate").value = "0.7";
  fixture.elements.get("settings-speech-repeat").value = "1";
  const pending = fixture.api.saveSettings();
  assert.equal(fixture.elements.get("settings-remote-speech").disabled, true);
  assert.equal(fixture.elements.get("settings-save").disabled, true);
  // Scripted changes model the original pending-form race even though user editing is locked.
  fixture.elements.get("settings-remote-speech").checked = true;
  fixture.elements.get("settings-english").checked = true;
  fixture.elements.get("settings-speech-rate").value = "1.2";
  fixture.elements.get("settings-speech-repeat").value = "3";
  release({ kind: "ok" });
  await pending;
  const submitted = fixture.calls.find((message) => message.type === "settings.update");
  assert.equal(submitted.allowRemoteSpeech, false);
  assert.equal(submitted.showEnglish, false);
  assert.equal(submitted.speechRate, 0.7);
  assert.equal(submitted.speechRepeat, 1);
  assert.equal(fixture.elements.get("settings-remote-speech").disabled, false);
  assert.match(fixture.elements.get("status").textContent, /لم تُحفظ/);
  assert.equal(fixture.elements.get("settings-remote-speech").checked, true, "later draft is retained honestly");
  fixture.api.speak("كلمة");
  assert.equal(spoken.length, 0, "unsaved consent does not permit remote playback");
  voices = [{ lang: "ar", localService: true }];
  fixture.api.speak("كلمة");
  assert.equal(spoken[0].rate, 0.7);
  spoken[0].onend();
  assert.equal(spoken.length, 1, "submitted repeat remains authoritative");
});


test("popup source keeps the encounter prominent with Arabic, disclosure, and recovery routes", () => {
  const html = source("popup.html");
  assert.match(html, /<h1>كَلِمات<\/h1>/);
  assert.match(html, /في الاستعمال/);
  assert.match(html, /id="translation" hidden/);
  assert.ok(html.indexOf('id="explore"') < html.indexOf('id="translation"'));
  assert.ok(html.indexOf('id="explore"') < html.indexOf('id="vocalization-details"'));
  assert.match(source("popup.css"), /overflow-y: auto/);
  assert.match(source("popup.css"), /main \{ width: 380px; max-width: 100%/);
  assert.match(html, /id="pronunciation"[^>]*lang="en"[^>]*dir="ltr"/);
  assert.doesNotMatch(html, /id="(?:known|difficult|onboarding|reminder|streak-badge|theme-select|practice-dialog|btn-export-anki)"/);
  assert.match(html, /id="recovery-atlas"/);
  assert.match(source("popup.css"), /min-height: 44px/);
  assert.match(source("popup.css"), /#word[^}]*line-height: 1.65/);
  assert.match(source("popup.css"), /:focus-visible/);
  assert.match(source("popup.css"), /prefers-reduced-motion/);
});

test("fresh popup gets a word directly and storage refresh preserves keyboard focus", async () => {
  const profile = atlasProfile({ showEnglish: false, wordStates: { w1: { saved: true } } });
  const fixture = popupApi({
    "assignment.get": { kind: "assigned", word: { id: "w1", word: "كَلِمَة", meaningAr: "معنى", register: "classical" }, dateKey: "2026-07-30", showEnglish: false },
    "state.export": { kind: "export", text: JSON.stringify(profile) },
  }, { profile: undefined });
  await fixture.api.initialize();
  assert.equal(fixture.elements.get("assigned").hidden, false);
  assert.equal(fixture.elements.get("word").focuses, 0);
  assert.equal(fixture.elements.get("translation").hidden, true);
  assert.equal(fixture.elements.get("register").textContent, "أدبي");
  assert.deepEqual(fixture.calls.filter((call) => call.type !== "state.export").map((call) => call.type), ["assignment.get"]);
  const focused = fixture.elements.get("explore");
  focused.focus();
  for (const listener of fixture.storageListeners) listener({ "kalimat.profile": { newValue: profile } }, "local");
  await new Promise(setImmediate);
  assert.equal(fixture.context.document.activeElement, focused);
  assert.equal(fixture.elements.get("save").getAttribute("aria-pressed"), "true");
});

test("popup leaves unaudited quotations to Atlas and keeps recovery data intact", async () => {
  const fixture = popupApi({ "assignment.get": { kind: "recovery", recoveryRaw: { broken: true } } }, { profile: { broken: true } });
  fixture.api.renderAssigned({ word: { id: 1, word: "كلمة", exampleAr: "unverified quotation" }, dateKey: "2026-07-30" });
  assert.equal(fixture.elements.get("example").textContent, "");
  await fixture.api.initialize();
  assert.equal(fixture.elements.get("recovery").hidden, false);
  await fixture.elements.get("recovery-atlas").listeners.click();
  assert.ok(fixture.calls.some((call) => call.tab?.url?.endsWith("atlas/atlas.html?view=settings")));
  assert.equal(fixture.calls.some((call) => call.type === "state.clear"), false);
});

test("Atlas saved-only history words open details without a missing assignment request", async () => {
  const word = { id: "w2", word: "محفوظة", meaningAr: "معنى", reviewed: true };
  const fixture = atlasApi({
    "assignment.get": { kind: "no-new-word" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile({ wordStates: { w2: { saved: true } } })) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
  }, { vocabulary: [word] });
  await fixture.api.initialize();
  fixture.elements.get("history-filter").value = "saved";
  fixture.api.renderHistory();
  const row = fixture.elements.get("history-list").children[0];
  assert.match(row.textContent, /محفوظة/);
  row.listeners.click();
  assert.equal(fixture.elements.get("explore-card").hidden, false);
  assert.equal(fixture.calls.filter((call) => call.type === "assignment.get").length, 1);
});

test("Atlas labels provenance neutrally and protects source navigation", async () => {
  const word = { id: "w1", word: "كلمة", meaningAr: "معنى", exampleAr: "<b>مثال</b>", vocalization: "ضبط", usageNote: "ملاحظة" };
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
  }, { vocabulary: [word] });
  await fixture.api.initialize();
  const card = fixture.elements.get("explore-card");
  const label = () => card.children.find((node) => node.className === "example").children[0].textContent;
  fixture.api.viewWord(word);
  assert.equal(label(), "مثال");
  fixture.api.viewWord({ ...word, exampleKind: "original" });
  assert.equal(label(), "مثال من تحرير كلمات");
  fixture.api.viewWord({ ...word, exampleKind: "quotation", exampleSource: { title: "مصدر", reference: "مرجع", url: "https://example.org/source" } });
  assert.equal(label(), "شاهد");
  assert.equal(card.children.find((node) => node.href)?.href, "https://example.org/source");
  assert.equal(card.children.find((node) => node.className === "example").children[1].textContent, "<b>مثال</b>");
  fixture.api.viewWord({ ...word, exampleKind: "quotation", exampleSource: { url: "javascript:alert(1)" } });
  assert.equal(card.children.some((node) => node.href), false);
});

test("Atlas settings restores locked focus only in the unchanged settings view", async () => {
  for (const outcome of ["lost", "new-control", "navigate", "leave-return"]) {
    let release;
    const fixture = atlasApi({
      "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
      "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
      "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
      "settings.update": () => new Promise((resolve) => { release = resolve; }),
    });
    await fixture.api.initialize();
    fixture.elements.get("settings").listeners.click();
    const control = fixture.elements.get("settings-save");
    control.focus();
    const pending = fixture.api.saveSettings();
    activeElement = null; // Model browser focus lost when a focused button becomes disabled.
    if (outcome === "new-control") fixture.elements.get("settings-time").focus();
    if (outcome === "navigate" || outcome === "leave-return") fixture.elements.get("explore").listeners.click();
    if (outcome === "leave-return") { fixture.elements.get("settings").listeners.click(); activeElement = null; }
    const focuses = control.focuses;
    release({ kind: "ok" });
    await pending;
    assert.equal(control.focuses, focuses + (outcome === "lost" ? 1 : 0), outcome);
    assert.equal(control.disabled, false);
  }
});


test("popup assignment fallback remains reachable when direct storage reading fails", async () => {
  const fixture = popupApi({
    "assignment.get": { kind: "assigned", word: { id: "w1", word: "كلمة" }, dateKey: "2026-07-30", storageWarning: true },
  }, { storageReadFailure: true });
  await fixture.api.initialize();
  assert.equal(fixture.elements.get("assigned").hidden, false);
  assert.equal(fixture.elements.get("warning").hidden, false);
  assert.equal(fixture.calls.filter((call) => call.type === "assignment.get").length, 1);
});

test("warning exports cannot turn temporary saves or consent into confirmed state", async () => {
  for (const surface of ["popup", "atlas"]) {
    for (const reopening of [false, true]) {
      const confirmed = atlasProfile({ showEnglish: false, preferences: { allowRemoteSpeech: false, speechRate: 0.7, speechRepeat: 1, showEnglish: false, dailyReviewLimit: 20 } });
      const temporary = { ...confirmed, showEnglish: true, wordStates: { w1: { saved: true } }, preferences: { ...confirmed.preferences, allowRemoteSpeech: true, speechRate: 1.2 } };
      let warned = reopening;
      const spoken = [];
      class Utterance { constructor(text) { this.text = text; } }
      const replies = {
        "assignment.get": () => ({ kind: "assigned", wordId: "w1", dateKey: "2026-07-30", saved: warned, storageWarning: warned }),
        "state.export": () => ({ kind: "export", text: JSON.stringify(warned ? temporary : confirmed), storageWarning: warned }),
        "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
        "word.save": { kind: "ok", saved: true, storageWarning: true },
      };
      const options = { profile: confirmed, storage: { "kalimat.profile": confirmed }, speechSynthesis: { getVoices: () => [{ lang: "ar", localService: false }], speak: (item) => spoken.push(item), cancel() {} }, SpeechSynthesisUtterance: Utterance };
      const fixture = surface === "popup" ? popupApi(replies, options) : atlasApi(replies, options);
      await fixture.api.initialize();
      const saved = fixture.elements.get(surface === "popup" ? "save" : "today-save");
      if (!reopening) {
        await fixture.api.toggleSave();
        assert.equal(saved.getAttribute("aria-pressed"), "false");
        warned = true;
        for (const listener of fixture.storageListeners) listener({ "kalimat.profile": { newValue: temporary } }, "local");
        await new Promise(setImmediate);
      }
      assert.equal(saved.getAttribute("aria-pressed"), "false", `${surface} ${reopening ? "reopen" : "refresh"}`);
      fixture.api.speak("كلمة");
      assert.equal(spoken.length, 0, "temporary consent cannot enable remote playback");
    }
  }
});


test("popup save keeps explicit intent, disables duplicate clicks, and announces once", async () => {
  let release;
  const fixture = popupApi({ "word.save": () => new Promise((resolve) => { release = resolve; }) });
  fixture.api.renderAssigned({ word: { id: "w1", word: "كلمة" }, dateKey: "2026-07-30" });
  const save = fixture.elements.get("save");
  save.focus();
  const first = fixture.api.toggleSave();
  await fixture.api.toggleSave();
  assert.equal(fixture.calls.filter((call) => call.type === "word.save").length, 1);
  assert.equal(save.disabled, true);
  assert.match(fixture.elements.get("action-status").textContent, /جارٍ/);
  release({ kind: "ok", saved: true });
  await first;
  assert.equal(save.disabled, false);
  assert.equal(save.getAttribute("aria-pressed"), "true");
  assert.equal(fixture.elements.get("status").textContent, "");
  assert.equal(fixture.elements.get("status").getAttribute("aria-live"), "off");
  assert.match(fixture.elements.get("action-status").textContent, /حُفظت/);
});

test("popup local voice feedback handles missing inventories and asynchronous failure", async () => {
  let voices = [];
  const spoken = [];
  class Utterance { constructor(text) { this.text = text; } }
  const fixture = popupApi({ "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" } }, {
    profile: { preferences: { allowRemoteSpeech: false } },
    speechSynthesis: { getVoices: () => voices, speak: (item) => spoken.push(item), cancel() {} }, SpeechSynthesisUtterance: Utterance,
  });
  await fixture.api.initialize();
  fixture.api.speak();
  assert.equal(spoken.length, 0);
  assert.match(fixture.elements.get("action-status").textContent, /لم تجهز/);
  voices = [{ lang: "ar", localService: false }];
  fixture.api.speak();
  assert.equal(spoken.length, 0);
  assert.match(fixture.elements.get("action-status").textContent, /إعدادات الأطلس/);
  voices = [{ lang: "ar", localService: true }];
  fixture.api.speak();
  spoken[0].onstart();
  assert.match(fixture.elements.get("action-status").textContent, /جارٍ النطق/);
  spoken[0].onerror({ error: "synthesis-failed" });
  assert.match(fixture.elements.get("action-status").textContent, /تعذّر/);
});

test("Atlas settings continuation opens controls while recovery keeps precedence", async () => {
  const replies = {
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
  };
  const fixture = atlasApi(replies, { search: "?view=settings" });
  await fixture.api.initialize();
  assert.equal(fixture.elements.get("settings-view").hidden, false);
  assert.equal(fixture.elements.get("today-view").hidden, true);
  const recovery = atlasApi({ ...replies, "state.export": { kind: "recovery", recoveryRaw: { broken: true } } }, { search: "?view=settings" });
  await recovery.api.initialize();
  assert.equal(recovery.elements.get("recovery").hidden, false);
});


test("Atlas current-word ID and settings routes retain the current daily continuation", async () => {
  for (const search of ["?view=explore&id=w1", "?view=settings"]) {
    const fixture = atlasApi({
      "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
      "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
      "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    }, { search });
    await fixture.api.initialize();
    assert.equal(fixture.elements.get(search.includes("settings") ? "settings-view" : "explore-view").hidden, false);
    if (search.includes("id=")) assert.equal(fixture.elements.get("return-today").hidden, true, "current word does not need a redundant return action");
    await fixture.api.returnToToday();
    assert.equal(fixture.elements.get("today-view").hidden, false, search);
    assert.equal(fixture.elements.get("empty").hidden, true, search);
    assert.equal(fixture.elements.get("today-card").children[0].textContent, "كلمة");
    assert.equal(fixture.calls.filter((call) => call.type === "assignment.get").length, 1);
  }
});

test("Atlas historical return and Today navigation load the current day without relabeling history", async () => {
  for (const throughNavigation of [false, true]) {
    const history = { id: "w2", word: "سابقة", meaningAr: "معنى" };
    const today = { id: "w1", word: "اليوم", meaningAr: "معنى" };
    const fixture = atlasApi({
      "assignment.get": (message) => message.dateKey
        ? { kind: "assigned", wordId: "w2", dateKey: "2026-07-28" }
        : { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
      "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
      "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    }, { search: "?date=2026-07-28", vocabulary: [today, history] });
    await fixture.api.initialize();
    assert.equal(fixture.elements.get("explore-card").children[0].textContent, "سابقة");
    assert.equal(fixture.elements.get("today-card").children.length, 0);
    if (throughNavigation) await fixture.elements.get("today").listeners.click();
    else await fixture.api.returnToToday();
    assert.equal(fixture.elements.get("today-view").hidden, false);
    assert.equal(fixture.elements.get("today-card").children[0].textContent, "اليوم");
    assert.equal(fixture.elements.get("today-date").textContent.includes("٢٨"), false);
    assert.deepEqual(fixture.calls.filter((call) => call.type === "assignment.get").map((call) => call.dateKey), ["2026-07-28", undefined]);
  }
});


test("Atlas committed clear can continue directly through Today and Return without a storage event", async () => {
  for (const route of ["today", "return"]) {
    for (const reminderResult of ["off", "failed", "unknown"]) {
      let durable = atlasProfile({ preferences: { allowRemoteSpeech: true, showEnglish: true, speechRate: 1.2, speechRepeat: 1, dailyReviewLimit: 20 } });
      const fixture = atlasApi({
        "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
        "state.export": () => ({ kind: "export", text: JSON.stringify(durable) }),
        "settings.get": { kind: "settings", reminder: { enabled: true, time: "10:30" } },
        "state.clear": () => {
          durable = atlasProfile({ showEnglish: false, preferences: { allowRemoteSpeech: false, showEnglish: false, speechRate: 0.85, speechRepeat: 1, dailyReviewLimit: 20 } });
          return { kind: "ok", profilePersisted: true, storageWarning: reminderResult !== "off", reminderWarning: reminderResult !== "off", reminder: reminderResult === "unknown" ? null : { enabled: reminderResult === "failed", time: "10:30" } };
        },
        "word.save": { kind: "ok", wordId: "w1", saved: true },
      });
      await fixture.api.initialize();
      await fixture.api.clearState();
      if (route === "return") {
        fixture.elements.get("explore").listeners.click();
        fixture.api.viewWord({ id: "w2", word: "سابقة", meaningAr: "معنى" });
        await fixture.api.returnToToday();
      } else await fixture.elements.get("today").listeners.click();
      assert.equal(fixture.elements.get("today-view").hidden, false, `${route}/${reminderResult}`);
      assert.equal(fixture.elements.get("error").hidden, true);
      assert.equal(fixture.elements.get("today-card").children[0].textContent, "كلمة");
      assert.equal(fixture.api.getReminder().enabled, reminderResult !== "off");
      assert.equal(fixture.elements.get("warning").hidden, reminderResult === "off");
      assert.doesNotMatch(fixture.elements.get("today-card").children.find((node) => node.className === "word-speak").textContent, /الإنترنت/);
      await fixture.api.toggleSave();
      assert.equal(fixture.elements.get("today-save").getAttribute("aria-pressed"), "true", "the adopted profile supports subsequent Save");
      assert.equal(fixture.calls.filter((call) => call.type === "settings.update").length, 0);
      assert.equal(fixture.calls.filter((call) => call.type === "state.export").length, 2);
    }
  }
});

test("Atlas post-clear continuation keeps recovery precedence and rejects temporary consent", async () => {
  for (const recovery of [false, true]) {
    let cleared = false;
    const confirmed = atlasProfile({ showEnglish: false, preferences: { allowRemoteSpeech: false } });
    const temporary = atlasProfile({ wordStates: { w1: { saved: true } }, preferences: { allowRemoteSpeech: true } });
    const fixture = atlasApi({
      "assignment.get": () => ({ kind: "assigned", wordId: "w1", dateKey: "2026-07-30", saved: cleared, storageWarning: cleared }),
      "state.export": () => cleared ? (recovery ? { kind: "recovery", recoveryRaw: { broken: true } } : { kind: "export", text: JSON.stringify(temporary), storageWarning: true }) : { kind: "export", text: JSON.stringify(confirmed) },
      "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
      "state.clear": () => { cleared = true; return { kind: "ok", profilePersisted: true, reminder: { enabled: false, time: "09:00" } }; },
    }, { storage: { "kalimat.profile": confirmed } });
    await fixture.api.initialize();
    await fixture.api.clearState();
    await fixture.api.returnToToday();
    assert.equal(fixture.elements.get(recovery ? "recovery" : "today-view").hidden, false);
    assert.equal(fixture.elements.get("error").hidden, true);
    if (!recovery) {
      assert.equal(fixture.elements.get("today-save").getAttribute("aria-pressed"), "false");
      assert.doesNotMatch(fixture.elements.get("today-card").children.find((node) => node.className === "word-speak").textContent, /الإنترنت/);
      assert.equal(fixture.elements.get("warning").hidden, false);
    }
  }
});

const exploreSaveVocabulary = [
  { id: "w1", word: "كلمة", meaningAr: "معنى", reviewed: true },
  { id: "w2", word: "ثانية", meaningAr: "شرح", reviewed: true },
];

test("Atlas generated Explore Save keeps non-today intent, blocks pending duplicates, and announces both states", async () => {
  let profile = atlasProfile();
  const releases = [];
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": () => ({ kind: "export", text: JSON.stringify(profile) }),
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "word.save": () => new Promise((resolve) => { releases.push(resolve); }),
  }, { vocabulary: exploreSaveVocabulary });
  await fixture.api.initialize();
  fixture.elements.get("explore").listeners.click();
  fixture.elements.get("search-results").children.find((row) => row.textContent.startsWith("ثانية")).listeners.click();
  const save = fixture.context.document.getElementById("explore-save");
  save.focus();
  const saving = save.listeners.click();
  await save.listeners.click();
  assert.equal(fixture.calls.filter((call) => call.type === "word.save").length, 1);
  assert.equal(save.disabled, true);
  assert.equal(save.getAttribute("aria-busy"), "true");
  assert.equal(fixture.elements.get("status").textContent, "جارٍ تحديث الحفظ…");

  profile = atlasProfile({ wordStates: { w2: { saved: true } } });
  for (const listener of fixture.storageListeners) listener({ "kalimat.profile": { newValue: profile } }, "local");
  await new Promise(setImmediate);
  assert.equal(fixture.context.document.getElementById("explore-save"), save, "refresh must preserve the pending control");
  assert.equal(save.disabled, true);
  assert.equal(save.getAttribute("aria-pressed"), "false", "the response confirms the submitted intent");
  releases[0]({ kind: "ok", wordId: "w2", saved: true });
  await saving;
  assert.equal(save.disabled, false);
  assert.equal(save.getAttribute("aria-busy"), "false");
  assert.equal(save.getAttribute("aria-pressed"), "true");
  assert.equal(fixture.elements.get("today-save").getAttribute("aria-pressed"), "false");
  assert.equal(fixture.elements.get("status").textContent, "حُفظت الكلمة.");
  assert.equal(fixture.elements.get("status").getAttribute("aria-live"), "polite");
  assert.equal(fixture.elements.get("today-action-status").textContent, "");

  const removing = save.listeners.click();
  releases[1]({ kind: "ok", wordId: "w2", saved: false });
  await removing;
  assert.deepEqual(fixture.calls.filter((call) => call.type === "word.save").map((call) => [call.wordId, call.saved]), [["w2", true], ["w2", false]]);
  assert.equal(save.getAttribute("aria-pressed"), "false");
  assert.equal(fixture.elements.get("status").textContent, "أزيل الحفظ.");
  assert.equal(fixture.elements.get("status").getAttribute("role"), "status");
});

test("Atlas generated Explore Save retains confirmed state after warning or failure and retries the same intent", async () => {
  for (const outcome of ["warning", "failure"]) {
    let failed = true;
    const fixture = atlasApi({
      "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
      "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
      "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
      "word.save": (message) => failed && outcome === "failure" ? new Error("storage unavailable") : { kind: "ok", wordId: "w2", saved: message.saved, storageWarning: failed },
    }, { vocabulary: exploreSaveVocabulary });
    await fixture.api.initialize();
    fixture.elements.get("explore").listeners.click();
    fixture.elements.get("search-results").children.find((row) => row.textContent.startsWith("ثانية")).listeners.click();
    const save = fixture.context.document.getElementById("explore-save");
    await save.listeners.click();
    assert.equal(save.getAttribute("aria-pressed"), "false", outcome);
    assert.equal(save.disabled, false);
    assert.equal(save.getAttribute("aria-busy"), "false");
    assert.match(fixture.elements.get("status").textContent, outcome === "warning" ? /مؤقت.*لم يُحفظ/ : /تعذّر الحفظ/);
    assert.doesNotMatch(fixture.elements.get("status").textContent, /حُفظت الكلمة/);
    assert.equal(fixture.elements.get("status").getAttribute("aria-live"), "polite");
    failed = false;
    await save.listeners.click();
    assert.deepEqual(fixture.calls.filter((call) => call.type === "word.save").map((call) => call.saved), [true, true]);
    assert.equal(save.getAttribute("aria-pressed"), "true");
    assert.equal(fixture.elements.get("status").textContent, "حُفظت الكلمة.");
  }
});

test("Atlas pending Save restores lost focus only in the original view and connected card", async () => {
  for (const surface of ["today", "explore"]) {
    const outcomes = ["lost", "new-control", "navigate", "leave-return", ...(surface === "explore" ? ["replace-card"] : [])];
    for (const outcome of outcomes) {
      let release;
      const fixture = atlasApi({
        "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
        "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
        "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
        "word.save": () => new Promise((resolve) => { release = resolve; }),
      }, { vocabulary: exploreSaveVocabulary });
      await fixture.api.initialize();
      const openExplore = () => {
        fixture.elements.get("explore").listeners.click();
        fixture.elements.get("search-results").children.find((row) => row.textContent.startsWith("ثانية")).listeners.click();
      };
      if (surface === "explore") openExplore();
      const save = fixture.context.document.getElementById(`${surface}-save`);
      save.focus();
      const pending = save.listeners.click();
      activeElement = fixture.context.document.body; // A disabled focused button can leave focus on the document.
      if (outcome === "new-control") fixture.elements.get(surface === "today" ? "today-known" : "atlas-search").focus();
      if (outcome === "navigate" || outcome === "leave-return") fixture.elements.get(surface === "today" ? "explore" : "settings").listeners.click();
      if (outcome === "leave-return") {
        if (surface === "today") await fixture.elements.get("today").listeners.click();
        else openExplore();
        activeElement = fixture.context.document.body;
      }
      if (outcome === "replace-card") {
        fixture.elements.get("atlas-search").listeners.input();
        fixture.elements.get("search-results").children.find((row) => row.textContent.startsWith("ثانية")).listeners.click();
        activeElement = fixture.context.document.body;
      }
      const destination = fixture.context.document.activeElement;
      const focuses = save.focuses;
      release({ kind: "ok", wordId: surface === "today" ? "w1" : "w2", saved: true });
      await pending;
      assert.equal(save.focuses, focuses + (outcome === "lost" ? 1 : 0), `${surface}/${outcome}`);
      assert.equal(fixture.context.document.activeElement, outcome === "lost" ? save : destination, `${surface}/${outcome}`);
      assert.equal(save.disabled, surface === "today" && outcome === "navigate");
      if (outcome === "replace-card") assert.equal(save.isConnected, false);
    }
  }
});

test("Atlas external profile changes synchronize an open Explore Save and the next click intent", async () => {
  let profile = atlasProfile();
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": () => ({ kind: "export", text: JSON.stringify(profile) }),
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "word.save": (message) => ({ kind: "ok", wordId: "w2", saved: message.saved }),
  }, { vocabulary: exploreSaveVocabulary });
  await fixture.api.initialize();
  fixture.elements.get("explore").listeners.click();
  fixture.elements.get("search-results").children.find((row) => row.textContent.startsWith("ثانية")).listeners.click();
  const save = fixture.context.document.getElementById("explore-save");
  save.focus();
  profile = atlasProfile({ wordStates: { w2: { saved: true } } });
  for (const listener of fixture.storageListeners) listener({ "kalimat.profile": { newValue: profile } }, "local");
  await new Promise(setImmediate);
  assert.equal(fixture.context.document.getElementById("explore-save"), save);
  assert.equal(save.getAttribute("aria-pressed"), "true");
  assert.equal(fixture.context.document.activeElement, save);
  await save.listeners.click();
  assert.deepEqual(fixture.calls.filter((call) => call.type === "word.save").map((call) => [call.wordId, call.saved]), [["w2", false]]);
  assert.equal(save.getAttribute("aria-pressed"), "false");
  assert.equal(fixture.elements.get("status").textContent, "أزيل الحفظ.");
});

test("Atlas external changes update visible saved History and preserve or recover its focused row", async () => {
  let profile = atlasProfile({
    assignments: { "2026-07-30": { wordId: "w1" }, "2026-07-29": { wordId: "w2" } }, assignmentOrdinal: 2,
    wordStates: { w1: { saved: true }, w2: { saved: true } },
  });
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": () => ({ kind: "export", text: JSON.stringify(profile) }),
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
  });
  const refresh = async () => {
    for (const listener of fixture.storageListeners) listener({ "kalimat.profile": { newValue: profile } }, "local");
    await new Promise(setImmediate);
  };
  await fixture.api.initialize();
  const filter = fixture.elements.get("history-filter");
  filter.value = "saved";
  fixture.elements.get("history").listeners.click();
  const rows = () => fixture.elements.get("history-list").children;
  const row = () => rows().find((item) => item.textContent.includes("ثانية"));
  const original = row();
  original.focus();
  profile.assignments["2026-07-29"].status = "known";
  await refresh();
  assert.match(row().textContent, /معروف/);
  assert.notEqual(row(), original);
  assert.equal(original.isConnected, false);
  assert.equal(fixture.context.document.activeElement, row(), "a surviving row keeps focus after refresh");

  filter.focus();
  profile.assignments["2026-07-29"].status = "difficult";
  await refresh();
  assert.match(row().textContent, /صعب/);
  assert.equal(fixture.context.document.activeElement, filter, "refresh preserves a different focused target");

  row().focus();
  profile.wordStates.w2.saved = false;
  await refresh();
  assert.equal(rows().length, 1);
  assert.equal(row(), undefined);
  assert.equal(fixture.context.document.activeElement, filter, "a removed row returns focus to the filter");
});

test("Atlas ordinary import after Clear confirms success and restores history and preferences", async () => {
  let profile = atlasProfile();
  const imported = atlasProfile({
    interests: ["food", "travel"], showEnglish: false,
    preferences: { showEnglish: false, allowRemoteSpeech: true, speechRate: 1.15, speechRepeat: 3 },
    assignments: { "2026-07-30": { wordId: "w1", status: "known" }, "2026-07-29": { wordId: "w2", status: "difficult" } }, assignmentOrdinal: 2,
    wordStates: { w1: { status: "known" }, w2: { status: "difficult", saved: true } },
  });
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": () => ({ kind: "export", text: JSON.stringify(profile) }),
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "state.clear": () => { profile = atlasProfile(); return { kind: "ok", profilePersisted: true, reminder: { enabled: false, time: "09:00" } }; },
    "state.import": (message) => { profile = JSON.parse(message.text); return { kind: "ok" }; },
  });
  await fixture.api.initialize();
  await fixture.elements.get("clear").listeners.click();
  assert.equal(fixture.elements.get("onboarding").hidden, false);
  const input = fixture.elements.get("import-file");
  const text = JSON.stringify(imported);
  input.files = [{ size: text.length, text: async () => text }];
  input.value = "backup.json";
  await input.listeners.change();
  assert.equal(input.value, "");
  assert.equal(fixture.elements.get("status").textContent, "تم استيراد الملف.");
  assert.equal(fixture.elements.get("status").getAttribute("aria-live"), "polite");
  assert.equal(fixture.elements.get("onboarding").hidden, true);
  assert.equal(fixture.elements.get("today-view").hidden, false);
  assert.equal(fixture.elements.get("settings-english").checked, false);
  assert.equal(fixture.elements.get("settings-remote-speech").checked, true);
  assert.equal(fixture.elements.get("settings-speech-rate").value, "1.15");
  assert.equal(fixture.elements.get("settings-speech-repeat").value, "3");
  assert.deepEqual(fixture.interests.filter((interest) => interest.checked).map((interest) => interest.value), ["food", "travel"]);
  assert.equal(fixture.elements.get("today-card").children.some((node) => node.children?.some((child) => child.textContent === "شرح بالإنجليزية والنطق اللاتيني")), false);
  fixture.elements.get("history-filter").value = "saved";
  fixture.elements.get("history").listeners.click();
  const rows = fixture.elements.get("history-list").children;
  assert.equal(rows.length, 1);
  assert.match(rows[0].textContent, /2026-07-29.*ثانية.*صعب/);
  assert.equal(fixture.calls.filter((call) => call.type === "settings.update").length, 0, "import restores preferences without a settings submission");
});

test("Atlas pending import file reading blocks competing mutations and releases the lock after a read failure", async () => {
  let failRead;
  const reading = new Promise((_, reject) => { failRead = reject; });
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "word.save": { kind: "ok", wordId: "w1", saved: true },
    "settings.update": { kind: "ok" },
    "state.clear": { kind: "ok", profilePersisted: true },
  }, { vocabulary: exploreSaveVocabulary });
  await fixture.api.initialize();
  const input = { files: [{ size: 10, text: () => reading }], value: "backup.json" };
  const importing = fixture.api.importState(input);
  await fixture.api.clearState();
  await fixture.api.toggleSave();
  await fixture.api.feedback("known");
  fixture.elements.get("explore").listeners.click();
  fixture.elements.get("search-results").children.find((row) => row.textContent.startsWith("ثانية")).listeners.click();
  await fixture.context.document.getElementById("explore-save").listeners.click();
  fixture.elements.get("settings").listeners.click();
  await fixture.api.saveSettings();
  assert.equal(fixture.calls.some((call) => ["state.clear", "state.import", "word.save", "word.feedback", "settings.update"].includes(call.type)), false);
  assert.match(fixture.elements.get("status").textContent, /جارٍ.*اكتمالها/);

  failRead(new Error("file unreadable"));
  await importing;
  assert.equal(input.value, "");
  assert.match(fixture.elements.get("status").textContent, /تعذّر استيراد الملف/);
  await fixture.elements.get("today").listeners.click();
  assert.equal(fixture.elements.get("today-save").disabled, false);
  await fixture.elements.get("today-save").listeners.click();
  assert.equal(fixture.calls.filter((call) => call.type === "word.save").length, 1);
  await fixture.api.clearState();
  assert.equal(fixture.calls.filter((call) => call.type === "state.clear").length, 1);
  assert.equal(fixture.elements.get("onboarding").hidden, false);
});

test("Atlas pending Clear blocks cached Today, generated Explore, settings, and import until failure recovery", async () => {
  let release;
  let clears = 0;
  let fileReads = 0;
  const fixture = atlasApi({
    "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
    "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
    "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
    "word.save": { kind: "ok", wordId: "w1", saved: true },
    "settings.update": { kind: "ok" },
    "state.clear": () => ++clears === 1 ? new Promise((resolve) => { release = resolve; }) : { kind: "ok", profilePersisted: true },
  }, { vocabulary: exploreSaveVocabulary });
  await fixture.api.initialize();
  const clearing = fixture.elements.get("clear").listeners.click();
  await fixture.elements.get("today").listeners.click();
  assert.equal(fixture.elements.get("today-save").disabled, true);
  await fixture.elements.get("today-save").listeners.click();
  await fixture.api.feedback("known");
  fixture.elements.get("explore").listeners.click();
  fixture.elements.get("search-results").children.find((row) => row.textContent.startsWith("ثانية")).listeners.click();
  await fixture.context.document.getElementById("explore-save").listeners.click();
  fixture.elements.get("settings").listeners.click();
  await fixture.api.saveSettings();
  const input = { files: [{ size: 10, text: async () => { fileReads += 1; return JSON.stringify(atlasProfile()); } }], value: "backup.json" };
  await fixture.api.importState(input);
  await fixture.api.clearState();
  assert.equal(input.value, "");
  assert.equal(fileReads, 0, "a blocked import must not start reading its file");
  assert.deepEqual(fixture.calls.filter((call) => ["state.clear", "state.import", "word.save", "word.feedback", "settings.update"].includes(call.type)).map((call) => call.type), ["state.clear"]);

  release({ kind: "error" });
  await clearing;
  assert.match(fixture.elements.get("status").textContent, /تعذّر مسح البيانات/);
  await fixture.elements.get("today").listeners.click();
  assert.equal(fixture.elements.get("today-save").disabled, false);
  await fixture.elements.get("today-save").listeners.click();
  await fixture.api.saveSettings();
  assert.equal(fixture.calls.filter((call) => call.type === "word.save").length, 1);
  assert.equal(fixture.calls.filter((call) => call.type === "settings.update").length, 1);
  await fixture.api.clearState();
  assert.equal(fixture.calls.filter((call) => call.type === "state.clear").length, 2);
  assert.equal(fixture.elements.get("onboarding").hidden, false);
});

test("Atlas pending Save or settings prevents profile replacement and allows retry after commit", async () => {
  for (const mutation of ["word.save", "settings.update"]) {
    let release;
    let fileReads = 0;
    const fixture = atlasApi({
      "assignment.get": { kind: "assigned", wordId: "w1", dateKey: "2026-07-30" },
      "state.export": { kind: "export", text: JSON.stringify(atlasProfile()) },
      "settings.get": { kind: "settings", reminder: { enabled: false, time: "09:00" } },
      [mutation]: () => new Promise((resolve) => { release = resolve; }),
      "state.import": { kind: "ok" },
      "state.clear": { kind: "ok", profilePersisted: true },
    });
    await fixture.api.initialize();
    if (mutation === "settings.update") fixture.elements.get("settings").listeners.click();
    const pending = mutation === "word.save" ? fixture.api.toggleSave() : fixture.api.saveSettings();
    const input = { files: [{ size: 10, text: async () => { fileReads += 1; return JSON.stringify(atlasProfile()); } }], value: "backup.json" };
    await fixture.api.clearState();
    await fixture.api.importState(input);
    assert.equal(fixture.calls.some((call) => call.type === "state.clear" || call.type === "state.import"), false, mutation);
    assert.equal(fileReads, 0);
    assert.equal(input.value, "");
    assert.match(fixture.elements.get("status").textContent, /جارٍ.*اكتمالها/);
    release({ kind: "ok", wordId: "w1", saved: true });
    await pending;
    await fixture.api.importState(input);
    await fixture.api.clearState();
    assert.equal(fileReads, 1);
    assert.equal(fixture.calls.filter((call) => call.type === "state.import").length, 1);
    assert.equal(fixture.calls.filter((call) => call.type === "state.clear").length, 1);
  }
});
