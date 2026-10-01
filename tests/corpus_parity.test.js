"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const words = require("../words.js");
const extensionVocabulary = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "extension", "data", "vocabulary.json"), "utf8")
);

const FIELD_MAP = [
  ["word", "word"],
  ["pronunciation", "pronunciation"],
  ["vocalization", "vocalization"],
  ["weight", "pattern"],
  ["root", "root"],
  ["category", "category"],
  ["meaning", "meaningAr"],
  ["englishMeaning", "meaningEn"],
  ["context", "contextAr"],
  ["contextEnglish", "contextEn"],
];

const EXAMPLE_OVERRIDES = {
  24: "فاحَ أَرِيجُ الياسمين في الفناء بعد أن سُقيت الأزهار.",
  25: "أثارَت الرسالةُ القديمةُ في نفسه شَجَنًا ممزوجًا بالشوق.",
  32: "سادَ الوِئامُ بين أفراد الفريق بعد حوار صريح.",
  41: "أضاءَ القمرُ الطريقَ وسطَ الدُّجى.",
  46: "بدا وجهُ الطفل نَضيرًا بعد نوم هادئ.",
};

const GENERIC_ATTRIBUTION = /— شاعر (?:قديم|حديث)$/;

function indexByNumericId(records) {
  return new Map(records.map((record) => [Number(record.id), record]));
}

test("website and extension vocabularies stay lexically identical by ID", () => {
  const websiteById = indexByNumericId(words);
  const extensionById = indexByNumericId(extensionVocabulary);
  const websiteIds = [...websiteById.keys()].sort((a, b) => a - b);
  const extensionIds = [...extensionById.keys()].sort((a, b) => a - b);

  assert.deepEqual(extensionIds, websiteIds, "Corpus ID sets must match");

  for (const id of websiteIds) {
    const website = websiteById.get(id);
    const extension = extensionById.get(id);
    for (const [websiteField, extensionField] of FIELD_MAP) {
      assert.equal(
        extension[extensionField],
        website[websiteField],
        `Corpus parity mismatch for record ${id}, field ${websiteField} -> ${extensionField}`
      );
    }

    if (Object.hasOwn(EXAMPLE_OVERRIDES, id)) {
      assert.match(website.example, GENERIC_ATTRIBUTION, `Record ${id} must retain its generic attribution in the website corpus`);
      assert.equal(extension.exampleAr, EXAMPLE_OVERRIDES[id], `Corpus parity mismatch for record ${id}, field example -> exampleAr`);
      assert.notEqual(extension.exampleAr, website.example, `Record ${id} must use the moderated extension example`);
      assert.doesNotMatch(extension.exampleAr, GENERIC_ATTRIBUTION, `Record ${id} extension example must not keep generic attribution`);
    } else {
      assert.equal(extension.exampleAr, website.example, `Corpus parity mismatch for record ${id}, field example -> exampleAr`);
    }
  }

  const differingExampleIds = websiteIds.filter((id) => websiteById.get(id).example !== extensionById.get(id).exampleAr);
  assert.deepEqual(
    differingExampleIds,
    Object.keys(EXAMPLE_OVERRIDES).map(Number).sort((a, b) => a - b),
    "Only the documented generic-attribution examples may differ"
  );
});


test("converter check accepts CRLF and detects metadata drift without rewriting corpus", () => {
  const childProcess = require("node:child_process");
  const os = require("node:os");
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "kalimat-corpus-"));
  try {
    const root = path.join(__dirname, "..");
    for (const relative of ["words.js", "extension/tools/convert-vocabulary.js", "extension/shared/vocabulary.js", "extension/data/vocabulary.json", "extension/data/vocabulary-metadata.json"]) {
      const destination = path.join(temporary, relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(root, relative), destination);
    }
    const converter = path.join(temporary, "extension/tools/convert-vocabulary.js");
    const output = path.join(temporary, "extension/data/vocabulary.json");
    const original = fs.readFileSync(output);
    childProcess.execFileSync(process.execPath, [converter, "--check"]);
    assert.deepEqual(fs.readFileSync(output), original);
    const crlf = Buffer.from(original.toString("utf8").replace(/\r?\n/g, "\r\n"));
    fs.writeFileSync(output, crlf);
    childProcess.execFileSync(process.execPath, [converter, "--check"]);
    assert.deepEqual(fs.readFileSync(output), crlf);
    const changed = JSON.parse(original);
    changed[0].topics = ["unexpected-topic"];
    fs.writeFileSync(output, `${JSON.stringify(changed, null, 2)}\n`.replace(/\n/g, "\r\n"));
    const drifted = fs.readFileSync(output);
    const result = childProcess.spawnSync(process.execPath, [converter, "--check"], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Generated vocabulary differs/);
    assert.deepEqual(fs.readFileSync(output), drifted);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});


test("converter carries only supplied metadata provenance into the runtime corpus", () => {
  const metadata = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "extension/data/vocabulary-metadata.json"), "utf8"));
  const byId = new Map(metadata.map((record) => [record.sourceId, record]));
  for (const word of extensionVocabulary) {
    for (const field of ["exampleKind", "exampleSource", "usageNote"]) {
      assert.equal(Object.hasOwn(word, field), Object.hasOwn(byId.get(word.id), field), `${word.id}.${field} presence drift`);
      assert.deepEqual(word[field], byId.get(word.id)[field], `${word.id}.${field} value drift`);
    }
  }
});
