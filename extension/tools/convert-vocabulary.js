"use strict";

const fs = require("node:fs");
const path = require("node:path");
const words = require("../../words.js");
const { validateVocabulary } = require("../shared/vocabulary.js");
const metadataPath = path.join(__dirname, "..", "data", "vocabulary-metadata.json");
const METADATA = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
const metadataBySourceId = new Map(METADATA.map((record) => [record.sourceId, record]));
const editorialReview = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "editorial-review.json"), "utf8"));
if (editorialReview.version !== 1 || !Array.isArray(editorialReview.entries) || editorialReview.entries.length !== words.length) {
  throw new TypeError("Editorial review must cover the complete vocabulary.");
}
const editorialById = new Map();
for (const entry of editorialReview.entries) {
  if (!words.some((word) => word.id === entry.id) || editorialById.has(entry.id)
      || !["source-checked", "needs-review"].includes(entry.status)
      || typeof entry.notes !== "string" || !entry.notes.trim()
      || !Array.isArray(entry.sources)
      || (entry.status === "source-checked" && entry.sources.length === 0)) {
    throw new TypeError(`Invalid editorial review: ${entry.id}`);
  }
  for (const source of entry.sources) {
    const url = new URL(source.url);
    if (typeof source.title !== "string" || !source.title.trim()
        || url.protocol !== "https:" || url.username || url.password) {
      throw new TypeError(`Invalid editorial source: ${entry.id}`);
    }
  }
  editorialById.set(entry.id, entry);
}

const CATEGORY_TOPICS = {
  "شمائل ومروءة": ["virtues", "character", "classical-arabic"],
  "أدب وشعر": ["poetry", "literature", "classical-arabic"],
  "طبيعة وفلك": ["nature", "astronomy", "classical-arabic"],
  "رحلة وعزم": ["travel", "resolve", "classical-arabic"],
  "خلق وحياة": ["creation", "life", "classical-arabic"],
  "مشاعر وفؤاد": ["emotions", "heart", "classical-arabic"],
  "زمن وفصول": ["time", "seasons", "classical-arabic"],
  "لغة وفصاحة": ["language", "eloquence", "classical-arabic"],
  "مجتمع وألفة": ["community", "society", "classical-arabic"],
  "إيمان وروحانية": ["faith", "spirituality", "classical-arabic"],
  "علم ومعرفة": ["knowledge", "intellect", "classical-arabic"],
  "حكمة وفلسفة": ["wisdom", "philosophy", "classical-arabic"],
};

function normalizeArabic(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .normalize("NFC");
}

const vocabulary = words.map((seed) => {
  const metadata = metadataBySourceId.get(seed.id);
  if (!metadata || metadata.reviewed !== true) throw new TypeError(`Missing reviewed metadata for source ${seed.id}.`);
  const source = seed;
  const exampleAr = source.example;
  return {
    id: seed.id,
    contentVersion: 2,
    difficultyBand: metadata.difficultyBand || "advanced",
    usefulnessBand: metadata.usefulnessBand || "medium",
    topics: metadata.topics || CATEGORY_TOPICS[seed.category] || ["classical-arabic"],
    category: source.category,
    partOfSpeech: metadata.partOfSpeech || "noun",
    register: metadata.register || "classical",
    reviewed: true,
    editorialChecked: editorialById.get(seed.id).status === "source-checked",
    word: source.word,
    normalized: normalizeArabic(source.word),
    pronunciation: source.pronunciation,
    vocalization: source.vocalization,
    weight: source.weight,
    pattern: source.weight,
    root: source.root ? source.root.replace(/ـ/g, "") : "",
    meaning: source.meaning,
    meaningAr: source.meaning,
    englishMeaning: source.englishMeaning,
    meaningEn: source.englishMeaning,
    example: source.example,
    exampleAr,
    context: source.context,
    contextAr: source.context,
    contextEnglish: source.contextEnglish,
    contextEn: source.contextEnglish,
    ...Object.fromEntries(["exampleKind", "exampleSource", "usageNote"]
      .filter((field) => Object.hasOwn(metadata, field))
      .map((field) => [field, metadata[field]])),
  };
});

for (const word of vocabulary) {
  for (const field of ["contextAr", "contextEn"]) {
    if (typeof word[field] !== "string" || word[field].length < 1 || word[field].length > 4096) {
      throw new TypeError(`Invalid vocabulary context: ${word.id}.${field}`);
    }
  }
}
const validated = validateVocabulary(vocabulary);
const output = path.join(__dirname, "..", "data", "vocabulary.json");
const serialized = `${JSON.stringify(validated, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (fs.readFileSync(output, "utf8").replace(/\r\n/g, "\n") !== serialized) throw new Error("Generated vocabulary differs from the tracked corpus. Regenerate and review the change.");
  console.log(`Checked ${validated.length} vocabulary records: ${output}`);
} else {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, serialized, "utf8");
  console.log(`Validated ${validated.length} vocabulary records: ${output}`);
}
