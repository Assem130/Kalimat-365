const test = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const python = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const extensionRoot = path.join(__dirname, "..");
const distRoot = path.join(extensionRoot, "dist");
const browsers = ["chrome", "firefox"];
const releaseVersion = JSON.parse(fs.readFileSync(path.join(extensionRoot, "manifest.chrome.json"), "utf8")).version;
const archiveNames = Object.fromEntries(browsers.map((browser) => [browser, `kalimat-${browser}-${releaseVersion}.zip`]));
const runtimeFiles = [
  "assets/fonts/Amiri-Bold.woff2",
  "assets/fonts/Amiri-Regular.woff2",
  "assets/fonts/OFL.txt",
  "assets/fonts/Outfit-Regular.woff2",
  "atlas/atlas.css",
  "atlas/atlas.html",
  "atlas/atlas.js",
  "background.js",
  "data/discovery-index.json",
  "data/discovery-index-notice.md",
  "data/lmf-index.json",
  "data/lmf-NOTICE.md",
  "data/lmf-source-holds.json",
  "data/wordfreq-NOTICE.md",
  "data/vocabulary.json",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
  "popup/popup.css",
  "popup/popup.html",
  "popup/popup.js",
  "shared/date.js",
  "shared/pilot.js",
  "newtab/newtab.html",
  "newtab/newtab.css",
  "newtab/newtab.js",
  "shared/discovery.js",
  "shared/export.js",
  "shared/lookup.js",
  "shared/review-policy.js",
  "shared/review-session.js",
  "shared/speech.js",
  "shared/state.js",
  "shared/streak.js",
  "shared/theme.css",
  "shared/theme-init.js",
  "shared/theme.js",
  "shared/vocabulary.js",
];
const expectedPackageFiles = new Set([...runtimeFiles, "manifest.json"]);
let packageOutput = "";
let packageChecked = false;

function listFiles(root, prefix = "") {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return listFiles(path.join(root, entry.name), relative);
    return [relative.replaceAll("\\", "/")];
  });
}

function manifest(name) {
  return JSON.parse(fs.readFileSync(path.join(extensionRoot, `manifest.${name}.json`), "utf8"));
}

function packageManifest(browser) {
  return JSON.parse(fs.readFileSync(path.join(distRoot, browser, "manifest.json"), "utf8"));
}

function archiveEntries(browser) {
  const bytes = fs.readFileSync(path.join(distRoot, archiveNames[browser]));
  const eocd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocd >= 0, `${browser} archive is missing its end record`);
  const count = bytes.readUInt16LE(eocd + 10);
  const centralOffset = bytes.readUInt32LE(eocd + 16);
  const entries = new Map();
  let offset = centralOffset;
  for (let index = 0; index < count; index += 1) {
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50, `${browser} archive has an invalid central entry`);
    assert.equal(bytes.readUInt16LE(offset + 4) >> 8, 3, "ZIP platform must be fixed to Unix");
    assert.equal(bytes.readUInt16LE(offset + 12), 0, "ZIP time must be midnight");
    assert.equal(bytes.readUInt16LE(offset + 14), 33, "ZIP date must be 1980-01-01");
    assert.equal(bytes.readUInt32LE(offset + 38) >>> 16, 0o100644, "ZIP permissions must be fixed");
    const method = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const name = bytes.toString("utf8", offset + 46, offset + 46 + nameLength).replaceAll("\\", "/");
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const compressed = bytes.subarray(
      localOffset + 30 + localNameLength + localExtraLength,
      localOffset + 30 + localNameLength + localExtraLength + compressedSize,
    );
    const content = method === 0 ? compressed : method === 8 ? zlib.inflateRawSync(compressed) : null;
    assert.ok(content, `${browser}/${name} uses an unsupported ZIP method`);
    assert.equal(content.length, uncompressedSize, `${browser}/${name} has an invalid size`);
    entries.set(name, content);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function assertSafeManifest(value, browser = "chrome") {
  assert.equal(value.manifest_version, 3);
  assert.deepEqual(value.permissions, ["storage", "contextMenus"]);
  assert.deepEqual(value.optional_permissions, ["alarms", "notifications"]);
  assert.deepEqual(value.omnibox, { keyword: "km" });
  assert.deepEqual(value.optional_host_permissions, ["https://ar.wikipedia.org/*", "https://ar.wiktionary.org/*"]);
  assert.equal(Object.hasOwn(value, "host_permissions"), false);
  assert.equal(Object.hasOwn(value, "content_scripts"), false);
  assert.equal(value.content_security_policy.extension_pages, "script-src 'self'; object-src 'self'");
  assert.equal(value.action.default_popup, "popup/popup.html");
}

function ensurePackages() {
  if (packageChecked) return;
  if (process.env.KALIMAT_PACKAGE_ALREADY_BUILT !== "1") {
    packageOutput = childProcess.execFileSync(
      python,
      [path.join(extensionRoot, "tools", "package.py")],
      { stdio: "pipe" },
    ).toString();
  }
  packageChecked = true;
}

function packageTextFiles(browser) {
  return listFiles(path.join(distRoot, browser))
    .filter((relative) => /\.(?:css|html|js|json|md)$/i.test(relative))
    .map((relative) => ({ relative, text: fs.readFileSync(path.join(distRoot, browser, relative), "utf8") }));
}

function assertNoUnsafePayload(browser) {
  const files = packageTextFiles(browser);
  const forbiddenPath = /(?:^|\/)(?:tests|tools)(?:\/|$)|\.map$|(?:^|\/)manifest\.(?:chrome|firefox)\.json$|(?:^|\/)PRIVACY\.md$/i;
  const allowedRemoteUrl = /^https:\/\/(?:ar\.wiktionary\.org|ar\.wikipedia\.org|www\.wikidata\.org)(?:\/|$)/i;
  const allowedPrivacyUrl = /^https:\/\/assem130\.github\.io\/Kalimat-365\/privacy\.html$/i;
  const remoteUrlRegex = /\b(?:https?|wss?):\/\/[^\s"'`<>]+/gi;
  const unsafeSink = /\b(?:innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\s*\(|new\s+Function\s*\(|Function\s*\(|set(?:Timeout|Interval)\s*\(\s*["'])/;
  const secret = /-----BEGIN [^-]+ PRIVATE KEY-----|(?:api[_-]?key|access[_-]?token|secret[_-]?key|password)\s*[:=]\s*["'][^"']{8,}["']|\b(?:sk|pk|ghp|github_pat|xox[baprs]-)[A-Za-z0-9_-]{16,}\b/i;
  for (const relative of listFiles(path.join(distRoot, browser))) {
    assert.equal(forbiddenPath.test(relative), false, `${browser}/${relative} is development-only`);
  }
  for (const { relative, text } of files) {
    let urlScanText = text;
    if (relative === "data/vocabulary.json") {
      const { validateVocabulary } = require("../shared/vocabulary.js");
      // Exempt only the validated source field, never URLs elsewhere in a record.
      urlScanText = JSON.stringify(validateVocabulary(JSON.parse(text)).map((record) =>
        record.exampleSource ? { ...record, exampleSource: { ...record.exampleSource, url: "" } } : record));
    }
    if (relative === "shared/pilot.js") {
      const catalog = /const cards = (\[[\s\S]*?\])\.map\(card =>/.exec(text);
      assert.ok(catalog, "Pilot catalog must remain a static JSON array");
      const records = require("../shared/vocabulary.js").validateVocabulary(JSON.parse(catalog[1]));
      assert.equal(records.length, 14);
      assert.ok(records.every(record => record.contentVersion === 4));
      const sanitized = JSON.stringify(records.map(record => ({ ...record, source: { ...record.source, url: "" } })));
      urlScanText = text.replace(catalog[1], sanitized);
    }
    // Attribution files contain source/license links, not executable requests.
    if (["data/discovery-index-notice.md", "data/wordfreq-NOTICE.md", "data/lmf-NOTICE.md"].includes(relative)) urlScanText = "";
    const urls = urlScanText.match(remoteUrlRegex) || [];
    for (const url of urls) {
      const isAllowed =
        (["shared/discovery.js", "shared/vocabulary.js"].includes(relative) && url === "https://lindat.mff.cuni.cz/repository/items/d4d8ef1a-0e51-42d1-9a94-113cb81afa76") ||
        (relative === "manifest.json" && allowedRemoteUrl.test(url)) ||
        (["background.js", "atlas/atlas.js", "shared/lookup.js", "shared/discovery.js"].includes(relative) && allowedRemoteUrl.test(url)) ||
        (relative === "popup/popup.js" && ["https://ar.wikipedia.org/*", "https://ar.wiktionary.org/*"].includes(url)) ||
        (["popup/popup.html", "atlas/atlas.html"].includes(relative) && allowedPrivacyUrl.test(url)) ||
        (relative === "data/discovery-index-notice.md" && [
          "https://dumps.wikimedia.org/arwiktionary/20261001/).",
          "https://ar.wiktionary.org/wiki/ويكاموس:حقوق_التأليف_والنشر).",
          "https://creativecommons.org/licenses/by-sa/4.0/)",
        ].includes(url));
      assert.ok(isAllowed, `${browser}/${relative} contains unauthorized remote URL: ${url}`);
    }
    assert.equal(unsafeSink.test(text), false, `${browser}/${relative} contains an unsafe sink`);
    assert.equal(secret.test(text), false, `${browser}/${relative} contains a secret-like value`);
    assert.equal(/sourceMappingURL=/i.test(text), false, `${browser}/${relative} contains a source map reference`);
    if (/\.html$/i.test(relative)) {
      assert.equal(/<script(?![^>]*\bsrc\s*=)/i.test(text), false, `${browser}/${relative} contains inline script`);
      assert.equal(/\son[a-z]+\s*=/i.test(text), false, `${browser}/${relative} contains an inline event handler`);
    }
  }
}

test("Chrome manifest uses a MV3 service worker with fixed optional Wikimedia origins", () => {
  const chrome = manifest("chrome");
  assertSafeManifest(chrome, "chrome");
  assert.match(chrome.version, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(Object.keys(chrome.background), ["service_worker"]);
  assert.equal(chrome.background.service_worker, "background.js");
});

test("Firefox manifest uses ordered event-page scripts with optional Wikimedia origins", () => {
  const firefox = manifest("firefox");
  assertSafeManifest(firefox, "firefox");
  assert.equal(firefox.version, releaseVersion);
  assert.deepEqual(firefox.browser_specific_settings, {
    gecko: {
      id: "kalimat@assem130.github.io",
      data_collection_permissions: { required: ["none"] },
    },
  });
  assert.deepEqual(Object.keys(firefox.background), ["scripts"]);
  assert.deepEqual(firefox.background.scripts, ["shared/date.js", "shared/pilot.js", "shared/vocabulary.js", "shared/review-policy.js", "shared/state.js", "shared/lookup.js", "shared/discovery.js", "background.js"]);
});

test("packaged CSS enforces design tokens, system Arabic typography, and accessible focus styles", () => {
  for (const rel of ["popup/popup.css", "atlas/atlas.css", "shared/theme.css"]) {
    const css = fs.readFileSync(path.join(extensionRoot, rel), "utf8");
    assert.doesNotMatch(css, /@import\s+url\(/i, `${rel} must not import remote stylesheets`);
    assert.doesNotMatch(css, /https?:\/\//i, `${rel} must not contain remote URLs`);
    assert.match(css, /--[a-z0-9-]+:/i, `${rel} must declare CSS custom properties (theme tokens)`);
    if (rel === "shared/theme.css") {
      assert.match(css, /--(?:sans|serif):[^;]+(?:Amiri|Traditional Arabic|Outfit|Segoe UI|system-ui|sans-serif)/i, `${rel} must declare local typography tokens`);
      assert.match(css, /@font-face\s*\{[^}]*font-family:\s*["']?Amiri["']?[^}]*url\(["']?\.\.\/assets\/fonts\/Amiri-Regular\.woff2["']?\)/i);
      assert.match(css, /@font-face\s*\{[^}]*font-family:\s*["']?Outfit["']?[^}]*url\(["']?\.\.\/assets\/fonts\/Outfit-Regular\.woff2["']?\)/i);
    } else {
      assert.match(css, /font-family:[^;]+(?:system-ui|Segoe UI|Amiri|Traditional Arabic|Outfit|sans-serif|var\(--(?:sans|serif)\))/i, `${rel} must use native/system Arabic typography stack`);
    }
    assert.match(css, /:focus-visible/i, `${rel} must define focus-visible indicators`);
  }
});

test("privacy document states local learning storage, online-query scope, analytics limits, and controls", () => {
  const privacy = fs.readFileSync(path.join(extensionRoot, "PRIVACY.md"), "utf8");
  assert.match(privacy, /(?:browser|local) storage|storage\.local/i);
  assert.match(privacy, /learning data stays in the browser's local extension storage/i);
  assert.match(privacy, /only the normalized query/i);
  assert.match(privacy, /Wikimedia servers|ar\.wiktionary\.org/i);
  assert.match(privacy, /unreviewed/i);
  assert.match(privacy, /Manually queried online lookup results.*cannot be saved/i);
  assert.match(privacy, /stays off until you enable it and grant access/i);
  assert.match(privacy, /Automatically sourced definitions and quotations are unreviewed/i);
  assert.match(privacy, /Reading a daily entry makes no network request/i);
  assert.match(privacy, /grant access to `ar\.wikipedia\.org` and `ar\.wiktionary\.org`/i);
  assert.match(privacy, /known.word exclusions.*included in extension JSON export\/import/i);
  assert.match(privacy, /Firefox dictionary lookup is local/i);
  assert.match(privacy, /opt.in remote browser speech/i);
  assert.doesNotMatch(privacy, /No backend or server receives your data/i);
  assert.match(privacy, /no (?:analytics|tracking)|without (?:analytics|tracking)/i);
  assert.match(privacy, /optional reminder|reminder.{0,24}optional/i);
  assert.match(privacy, /export/i);
  assert.match(privacy, /delete|deletion|clear/i);
});

test("packager reports per-browser file and byte totals", () => {
  ensurePackages();
  if (process.env.KALIMAT_PACKAGE_ALREADY_BUILT === "1") {
    const script = fs.readFileSync(path.join(extensionRoot, "tools", "package.py"), "utf8");
    assert.match(script, /vocabulary/i);
    assert.match(script, /popup/i);
    assert.match(script, /bytes/i);
  } else {
    assert.match(packageOutput, /Chrome.*files.*bytes/i);
    assert.match(packageOutput, /Firefox.*files.*bytes/i);
  }
});

test("both packages contain exactly the runtime allowlist and selected manifest", () => {
  ensurePackages();
  for (const browser of browsers) {
    assert.deepEqual(new Set(listFiles(path.join(distRoot, browser))), expectedPackageFiles, `${browser} package drifted from the allowlist`);
    assert.doesNotThrow(() => assertSafeManifest(packageManifest(browser), browser));
    assert.deepEqual(packageManifest(browser), manifest(browser));
    assert.equal(manifest(browser).version, releaseVersion);
    assert.equal(packageManifest(browser).background.service_worker ?? undefined, browser === "chrome" ? "background.js" : undefined);
    if (browser === "firefox") assert.deepEqual(packageManifest(browser).background.scripts, manifest("firefox").background.scripts);
  }
});

test("ZIP archives have expected flat roots and browser-selected manifests", () => {
  ensurePackages();
  for (const browser of browsers) {
    const archive = path.join(distRoot, archiveNames[browser]);
    assert.equal(fs.existsSync(archive), true, `${archiveNames[browser]} was not created`);
    const entries = archiveEntries(browser);
    assert.deepEqual([...entries.keys()], [...runtimeFiles, "manifest.json"], `${browser} archive drifted from the runtime allowlist`);
    assert.deepEqual(JSON.parse(entries.get("manifest.json").toString("utf8")), manifest(browser));
  }
});

test("ZIP archive bytes match their selected source files exactly", () => {
  ensurePackages();
  for (const browser of browsers) {
    const entries = archiveEntries(browser);
    for (const relative of expectedPackageFiles) {
      const sourceRelative = relative === "manifest.json" ? `manifest.${browser}.json` : relative;
      assert.deepEqual(entries.get(relative), fs.readFileSync(path.join(extensionRoot, sourceRelative)), `${browser}/${relative} drifted from source`);
    }
  }
});

test("clean packaging produces byte-identical ZIP archives", () => {
  const packageScript = path.join(extensionRoot, "tools", "package.py");
  const runPackage = () => childProcess.execFileSync(
    python,
    [packageScript],
    { stdio: "pipe" },
  );
  const archiveHashes = () => Object.fromEntries(
    browsers.map((browser) => [
      browser,
      crypto.createHash("sha256").update(fs.readFileSync(path.join(distRoot, archiveNames[browser]))).digest("hex"),
    ]),
  );

  runPackage();
  const firstHashes = archiveHashes();
  runPackage();
  assert.deepEqual(archiveHashes(), firstHashes);
});

test("packaged runtime files match source exactly", () => {
  ensurePackages();
  const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  for (const browser of browsers) {
    for (const relative of runtimeFiles) {
      assert.equal(hash(path.join(extensionRoot, relative)), hash(path.join(distRoot, browser, relative)), `${browser}/${relative} drifted from source`);
    }
  }
});

test("packages contain no remote code, unsafe sinks, secrets, or development files", () => {
  ensurePackages();
  for (const browser of browsers) assertNoUnsafePayload(browser);
});

test("runtime vocabulary and popup code stay below release budgets", () => {
  ensurePackages();
  for (const browser of browsers) {
    const packageRoot = path.join(distRoot, browser);
    assert.ok(fs.statSync(path.join(packageRoot, "data/vocabulary.json")).size < 2_097_152, `${browser} vocabulary exceeds 2 MiB`);
    const popupBytes = ["popup/popup.html", "popup/popup.css", "popup/popup.js"]
      .reduce((total, relative) => total + fs.statSync(path.join(packageRoot, relative)).size, 0);
    assert.ok(popupBytes < 102_400, `${browser} popup code exceeds 100 KiB`);
  }
});

function packageFixture(change, check) {
  const temporary = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "kalimat-package-"));
  try {
    const copy = path.join(temporary, "extension");
    fs.cpSync(extensionRoot, copy, { recursive: true, filter: (file) => file !== distRoot });
    change(copy, temporary);
    const result = childProcess.spawnSync(python, [path.join(copy, "tools", "package.py")], { encoding: "utf8" });
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, /Packaging failed:/);
    check?.(copy, temporary, result);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

test("packager rejects unexpected sources and missing runtime files before output", () => {
  packageFixture((copy) => fs.writeFileSync(path.join(copy, "unexpected.txt"), "secret"), (copy) => {
    assert.equal(fs.existsSync(path.join(copy, "dist")), false);
  });
  packageFixture((copy) => fs.unlinkSync(path.join(copy, "background.js")), (copy) => {
    assert.equal(fs.existsSync(path.join(copy, "dist")), false);
  });
});

test("packager rejects unsafe dist, browser, and archive targets without touching unrelated data", () => {
  for (const relative of ["dist", "dist/chrome", "dist/firefox", `dist/${archiveNames.chrome}`, `dist/${archiveNames.firefox}`]) {
    packageFixture((copy, temporary) => {
      const target = path.join(copy, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (relative.endsWith(".zip")) fs.mkdirSync(target);
      else fs.writeFileSync(target, "keep");
      fs.writeFileSync(relative === "dist" ? path.join(temporary, "sentinel") : path.join(copy, "dist/sentinel"), "keep");
    }, (copy, temporary, result) => {
      assert.match(result.stderr, /unsafe dist target|unvalidated package target|unvalidated package archive/);
      const target = path.join(copy, relative);
      if (!relative.endsWith(".zip")) assert.equal(fs.readFileSync(target, "utf8"), "keep");
      assert.equal(fs.readFileSync(relative === "dist" ? path.join(temporary, "sentinel") : path.join(copy, "dist/sentinel"), "utf8"), "keep");
    });
  }
});

test("packager refuses source and output symlinks including nested cleanup targets", (t) => {
  const probe = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "kalimat-link-"));
  try {
    try { fs.symlinkSync(probe, path.join(probe, "probe"), process.platform === "win32" ? "junction" : "dir"); }
    catch (error) {
      if (["EPERM", "EACCES"].includes(error.code)) { t.skip("OS denies creating test symlinks"); return; }
      throw error;
    }
  } finally { fs.rmSync(probe, { recursive: true, force: true }); }
  for (const relative of ["background.js", "shared", "dist", "dist/chrome", "dist/firefox/nested", `dist/${archiveNames.chrome}`]) {
    packageFixture((copy, temporary) => {
      const external = path.join(temporary, "external");
      fs.mkdirSync(external);
      fs.writeFileSync(path.join(external, "sentinel"), "keep");
      const target = path.join(copy, relative);
      fs.rmSync(target, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.symlinkSync(external, target, process.platform === "win32" ? "junction" : "dir");
    }, (_, temporary) => assert.equal(fs.readFileSync(path.join(temporary, "external/sentinel"), "utf8"), "keep"));
  }
});

test("package cleanup preserves unrelated dist files", () => {
  ensurePackages();
  const sentinel = path.join(distRoot, "unrelated.txt");
  fs.writeFileSync(sentinel, "keep");
  try {
    childProcess.execFileSync(python, [path.join(extensionRoot, "tools/package.py")]);
    assert.equal(fs.readFileSync(sentinel, "utf8"), "keep");
  } finally { fs.unlinkSync(sentinel); }
});


test("packager rejects invalid manifests, Firefox disclosures, and over-budget payloads before cleanup", () => {
  for (const change of [
    (copy) => {
      const file = path.join(copy, "manifest.chrome.json");
      const value = JSON.parse(fs.readFileSync(file));
      value.version = "9.0.0";
      fs.writeFileSync(file, JSON.stringify(value));
    },
    (copy) => {
      const file = path.join(copy, "manifest.firefox.json");
      const value = JSON.parse(fs.readFileSync(file));
      value.browser_specific_settings.gecko.data_collection_permissions.required = ["unexpected"];
      fs.writeFileSync(file, JSON.stringify(value));
    },
    (copy) => fs.writeFileSync(path.join(copy, "data/vocabulary.json"), Buffer.alloc(2_097_152)),
    (copy) => fs.writeFileSync(path.join(copy, "popup/popup.js"), Buffer.alloc(102_400)),
  ]) {
    packageFixture((copy) => {
      fs.mkdirSync(path.join(copy, "dist/chrome"), { recursive: true });
      fs.writeFileSync(path.join(copy, "dist/chrome/sentinel"), "keep");
      change(copy);
    }, (copy, _, result) => {
      assert.match(result.stderr, /Invalid chrome manifest|Chrome and Firefox manifest versions must match|Invalid Firefox store disclosure|Release budget exceeded/);
      assert.equal(fs.readFileSync(path.join(copy, "dist/chrome/sentinel"), "utf8"), "keep");
    });
  }
});


test("vocabulary source URL exception preserves the outbound URL guard", () => {
  ensurePackages();
  const file = path.join(distRoot, "chrome/data/vocabulary.json");
  const original = fs.readFileSync(file);
  try {
    const records = JSON.parse(original);
    const source = records.find((record) => record.exampleSource);
    assert.ok(source);
    source.meaningEn = source.exampleSource.url;
    fs.writeFileSync(file, JSON.stringify(records));
    assert.throws(() => assertNoUnsafePayload("chrome"), /unauthorized remote URL/);
    records.splice(0, records.length, ...JSON.parse(original));
    records.find((record) => record.exampleSource).exampleSource.url = "https://user:pass@example.org/";
    fs.writeFileSync(file, JSON.stringify(records));
    assert.throws(() => assertNoUnsafePayload("chrome"), /exampleSource.url/);
  } finally { fs.writeFileSync(file, original); }
});

test("discovery index builder preserves Arabic spelling variants and all matching titles without network", () => {
  const scratch = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "kalimat-title-index-"));
  try {
    const input = path.join(scratch, "titles.gz");
    const output = path.join(scratch, "index.json");
    fs.writeFileSync(input, zlib.gzipSync("page_title\nكِتاب\nكتاب\nأمل\nامل\nعلى\nعلي\nLatin\nعلم_البيئة\nأ\nعربي1\n"));
    childProcess.execFileSync(python, [path.join(extensionRoot, "tools/build-discovery-index.py"), "--input", input, "--output", output]);
    const data = JSON.parse(fs.readFileSync(output, "utf8"));
    const index = new Map(data);
    assert.deepEqual(index.get("كتاب"), ["كتاب", "كِتاب"]);
    assert.ok(index.has("أمل") && index.has("امل"));
    assert.ok(index.has("على") && index.has("علي"));
    assert.deepEqual(index.get("علم البيئة"), ["علم البيئة"]);
    assert.equal(index.has("Latin"), false);
    assert.equal(index.has("أ"), false);
    assert.equal(index.has("عربي1"), false);
    const before = fs.readFileSync(output);
    childProcess.execFileSync(python, [path.join(extensionRoot, "tools/build-discovery-index.py"), "--input", input, "--output", output]);
    assert.deepEqual(fs.readFileSync(output), before);
    const builder = fs.readFileSync(path.join(extensionRoot, "tools/build-discovery-index.py"), "utf8");
    assert.doesNotMatch(builder, /\b(?:requests|urllib|http\.client|socket)\b/);
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});

test("shipped discovery catalog contains revision-attributed definitions and examples", () => {
  const bytes = fs.readFileSync(path.join(extensionRoot, "data/discovery-index.json"));
  assert.ok(bytes.length <= 12 * 1024 * 1024);
  const index = JSON.parse(bytes.toString("utf8"));
  assert.ok(index.length >= 2000);
  let exampleCount = 0;
  for (const [key, titles, entries] of index) {
    assert.ok(entries.length > 0);
    for (const entry of entries) {
      assert.ok(titles.includes(entry.title));
      assert.equal(require('../shared/discovery').normalizeKey(entry.title), key);
      assert.ok(entry.pageid > 0 && entry.revisionId > 0 && entry.definitions.length > 0);
      for (const sense of entry.senses) {
        assert.ok(entry.definitions.includes(sense.definition));
        exampleCount += sense.examples.length;
      }
    }
  }
  assert.ok(exampleCount >= 400, 'Catalog must contain usable source examples, not only titles');
  const notice = fs.readFileSync(path.join(extensionRoot, "data/discovery-index-notice.md"), "utf8");
  assert.match(notice, /6310c9c836312b7fd5f4f6bb1e2e0acb8584994e02bb3453b9c713a0589244d8/);
  assert.match(notice, /creativecommons\.org\/licenses\/by-sa\/4\.0/);
  assert.match(notice, /Arabic Wiktionary contributors/);
});

test('new-tab takeover is opt-in and both package modes retain the page and same output paths', () => {
  childProcess.execFileSync(python, [path.join(extensionRoot, 'tools/package.py'), '--new-tab']);
  for (const browser of browsers) {
    const target = path.join(distRoot, browser);
    const manifest = JSON.parse(fs.readFileSync(path.join(target, 'manifest.json'), 'utf8'));
    assert.deepEqual(manifest.chrome_url_overrides, { newtab: 'newtab/newtab.html' });
    assert.ok(fs.existsSync(path.join(target, 'newtab/newtab.html')));
  }
  childProcess.execFileSync(python, [path.join(extensionRoot, 'tools/package.py')]);
  for (const browser of browsers) {
    const target = path.join(distRoot, browser);
    const manifest = JSON.parse(fs.readFileSync(path.join(target, 'manifest.json'), 'utf8'));
    assert.equal(manifest.chrome_url_overrides, undefined);
    assert.ok(fs.existsSync(path.join(target, 'newtab/newtab.html')));
  }
});


test("pilot source exception leaves URLs outside validated catalog fields guarded", () => {
  ensurePackages();
  const file = path.join(distRoot, "chrome/shared/pilot.js");
  const original = fs.readFileSync(file, "utf8");
  try {
    fs.writeFileSync(file, original + '\nconst unexpected = "https://www.arabicacademy.gov.eg/ar/search_engine/roots/نول";\n');
    assert.throws(() => assertNoUnsafePayload("chrome"), /unauthorized remote URL/);
    fs.writeFileSync(file, original.replace('https://www.arabicacademy.gov.eg/ar/search_engine/roots/نول', 'https://example.org/untrusted'));
    assert.throws(() => assertNoUnsafePayload("chrome"), /editorial source URL/);
  } finally { fs.writeFileSync(file, original); }
});
