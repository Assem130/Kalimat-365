(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.KalimatVocabulary = api;
})(globalThis, function () {
  "use strict";

  const REQUIRED_KEYS = ["id", "contentVersion", "word", "normalized", "pronunciation", "difficultyBand", "usefulnessBand", "topics", "partOfSpeech", "register", "reviewed"];
  const V2_KEYS = ["contextAr", "contextEn"];
  const ALIAS_KEYS = ["vocalization", "category", "weight", "pattern", "meaning", "meaningAr", "englishMeaning", "meaningEn", "example", "exampleAr", "context", "contextAr", "contextEnglish", "contextEn", "root", "relatedIds"];
  const ALLOWED_KEYS = new Set([...REQUIRED_KEYS, ...V2_KEYS, ...ALIAS_KEYS, "exampleKind", "exampleSource", "usageNote", "editorialChecked"]);
  const ENUMS = {
    difficultyBand: new Set(["beginner", "intermediate", "advanced"]),
    usefulnessBand: new Set(["low", "medium", "high"]),
    partOfSpeech: new Set(["noun", "verb", "adjective", "adverb", "phrase", "other"]),
    register: new Set(["standard", "classical", "colloquial"]),
  };
  const ID = /^(?!__proto__$|constructor$|prototype$)[A-Za-z0-9_-]{1,64}$/;
  const USEFULNESS_ORDER = { high: 3, medium: 2, low: 1 };
  const DIFFICULTY_ORDER = { beginner: 1, intermediate: 2, advanced: 3 };

  function fail(message) {
    throw new TypeError(`Invalid vocabulary: ${message}`);
  }

  function text(value, field, max = 4096) {
    if (typeof value !== "string" || value.length < 1 || value.length > max) fail(field);
    return value;
  }

  const DISCOVERY_TOPICS = new Set(["science", "culture", "society", "environment", "economics", "language"]);
  const DISCOVERY_KEYS = new Set(["id", "contentVersion", "word", "normalized", "meaningAr", "exampleAr", "topics", "partOfSpeech", "register", "reviewed", "source", "exampleKind", "exampleSource", "discoveryReason"]);
  const LMF_SOURCE_URL = "https://lindat.mff.cuni.cz/repository/items/d4d8ef1a-0e51-42d1-9a94-113cb81afa76";

  function exactObject(value, keys, label) {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype
      || Object.keys(value).length !== keys.size || Object.keys(value).some((key) => !keys.has(key))) fail(label);
  }

  function sourceUrl(value, hosts, label) {
    text(value, label, 2048);
    let url;
    try { url = new URL(value); } catch (_) { fail(label); }
    if (url.protocol !== "https:" || !hosts.includes(url.hostname) || url.username || url.password || url.port || url.hash
      || /[\s\\]/.test(value) || !value.startsWith(url.origin + "/")) fail(label);
    const wikiPath = /^\/wiki\/[^/]+(?:\/[^/]+)*$/.test(url.pathname) && !url.search;
    const revisionPath = url.pathname === "/w/index.php" && /^[1-9][0-9]*$/.test(url.searchParams.get("oldid") || "")
      && [...url.searchParams.keys()].every((key) => key === "oldid" || key === "title")
      && new Set(url.searchParams.keys()).size === [...url.searchParams.keys()].length;
    if (!wikiPath && !revisionPath) fail(label);
  }

  function validateDiscoveryCard(record) {
    const withSenseContext = typeof record?.id === "string" && record.id.startsWith("lmf_") && Object.hasOwn(record, "senseContext");
    exactObject(record, withSenseContext ? new Set([...DISCOVERY_KEYS, "senseContext"]) : DISCOVERY_KEYS, "discovery card keys");
    if (record.contentVersion !== 3 || !/^(?:(?:wk_[1-9][0-9]*|wd_[1-9][0-9]*)_[a-f0-9]{8,16}|lmf_[a-f0-9]{32})$/.test(record.id) || record.id.length > 64) fail("discovery id");
    const lmf = record.id.startsWith("lmf_");
    if (withSenseContext) {
      text(record.senseContext, "senseContext", 512);
      if (!record.senseContext.trim() || /[\u0000-\u001F\u007F]/.test(record.senseContext)) fail("senseContext");
    }
    if (record.reviewed !== false) fail("discovery reviewed");
    for (const [field, max] of [["word", 80], ["normalized", 80], ["meaningAr", 700], ["exampleAr", 1000], ["discoveryReason", 200]]) {
      text(record[field], field, max);
      if (!record[field].trim() || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(record[field])) fail(field);
    }
    if (!ENUMS.partOfSpeech.has(record.partOfSpeech) || !["standard", "classical"].includes(record.register)) fail("discovery metadata");
    if (!Array.isArray(record.topics) || !record.topics.length || record.topics.length > 6 || new Set(record.topics).size !== record.topics.length
      || record.topics.some((topic) => !DISCOVERY_TOPICS.has(topic))) fail("discovery topics");
    exactObject(record.source, new Set(lmf ? ["title", "url", "license", "sha256", "entryId", "senseId", "recordId"] : ["title", "url", "revisionId", "license"]), "discovery source");
    text(record.source.title, "source title", 512);
    if (lmf) {
      if (record.source.url !== LMF_SOURCE_URL || record.source.license !== "CC-BY-NC-4.0"
        || typeof record.source.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(record.source.sha256)
        || typeof record.source.recordId !== "string" || !/^[a-f0-9]{32}$/.test(record.source.recordId)
        || record.id !== `lmf_${record.source.recordId}`) fail("discovery source metadata");
      for (const field of ["entryId", "senseId"]) {
        text(record.source[field], `source ${field}`, 128);
        if (!record.source[field].trim() || /[\u0000-\u001F\u007F]/.test(record.source[field])) fail("discovery source metadata");
      }
    } else {
      if (!Number.isSafeInteger(record.source.revisionId) || record.source.revisionId < 1 || !["CC-BY-SA-4.0", "CC0-1.0"].includes(record.source.license)) fail("discovery source metadata");
      sourceUrl(record.source.url, ["ar.wiktionary.org", "www.wikidata.org"], "discovery source URL");
    }
    if (record.exampleKind !== "quotation") fail("discovery example kind");
    exactObject(record.exampleSource, new Set(["title", "url", "reference"]), "discovery example source");
    text(record.exampleSource.title, "example source title", 512);
    text(record.exampleSource.reference, "example reference", 512);
    if (lmf) {
      if (record.exampleSource.url !== LMF_SOURCE_URL || record.exampleSource.reference !== `LMF: ${record.source.entryId} / ${record.source.senseId}`) fail("discovery example source");
    } else sourceUrl(record.exampleSource.url, ["ar.wikipedia.org", "ar.wiktionary.org"], "discovery example URL");
    if (new TextEncoder().encode(JSON.stringify(record)).byteLength > 4096) fail("discovery card size");
    return Object.freeze({ ...record, topics: Object.freeze([...record.topics]), source: Object.freeze({ ...record.source }), exampleSource: Object.freeze({ ...record.exampleSource }) });
  }

  function validateEditorialCard(record) {
    exactObject(record, new Set(["id", "contentVersion", "word", "normalized", "meaningAr", "exampleAr", "exampleKind", "reviewed", "editorialChecked", "source"]), "editorial card keys");
    if (record.contentVersion !== 4 || !/^pilot_[a-z0-9_]{1,50}$/.test(record.id) || record.reviewed !== true || record.editorialChecked !== true || record.exampleKind !== "original") fail("editorial metadata");
    for (const field of ["word", "normalized", "meaningAr", "exampleAr"]) text(record[field], field, 1200);
    exactObject(record.source, new Set(["title", "url"]), "editorial source");
    text(record.source.title, "source title", 512);
    const url = new URL(text(record.source.url, "source URL", 2048));
    if (url.protocol !== "https:" || !["www.arabicacademy.gov.eg", "www.islamweb.net", "sina.birzeit.edu"].includes(url.hostname) || url.username || url.password) fail("editorial source URL");
    return Object.freeze({ ...record, source: Object.freeze({ ...record.source }) });
  }

  function searchable(record) {
    if (record?.reviewed === true) return true;
    if (record?.contentVersion !== 3) return false;
    try { validateDiscoveryCard(record); return true; } catch (_) { return false; }
  }

  function validateVocabulary(raw) {
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 10000) fail("records");
    const ids = new Set();
    const records = raw.map((record) => {
      if (!record || typeof record !== "object" || Array.isArray(record) || Object.getPrototypeOf(record) !== Object.prototype) fail("record");
      if (record.contentVersion === 3 || record.contentVersion === 4) {
        const checked = record.contentVersion === 4 ? validateEditorialCard(record) : validateDiscoveryCard(record);
        if (ids.has(checked.id)) fail("unique IDs");
        ids.add(checked.id);
        return checked;
      }
      const keys = Object.keys(record);
      if (keys.some((key) => !ALLOWED_KEYS.has(key))) fail("record keys");
      if (REQUIRED_KEYS.some((key) => !Object.hasOwn(record, key))) fail("record keys");

      const isIdValid = (Number.isInteger(record.id) && record.id >= 1 && record.id <= 10000) || (typeof record.id === "string" && ID.test(record.id));
      if (!isIdValid || ids.has(record.id)) fail(ids.has(record.id) ? "unique IDs" : "id");
      ids.add(record.id);

      if (!Number.isInteger(record.contentVersion) || record.contentVersion < 1 || record.contentVersion > 1000) fail("contentVersion");

      for (const field of ["word", "normalized", "pronunciation"]) text(record[field], field);

      const meaningAr = record.meaningAr || record.meaning;
      const meaningEn = record.meaningEn || record.englishMeaning;
      const exampleAr = record.exampleAr || record.example;
      text(meaningAr, "meaningAr");
      text(meaningEn, "meaningEn");
      text(exampleAr, "exampleAr");

      if (record.contentVersion === 2) {
        const contextAr = record.contextAr || record.context;
        const contextEn = record.contextEn || record.contextEnglish;
        text(contextAr, "contextAr");
        text(contextEn, "contextEn");
      }

      for (const field of ["difficultyBand", "usefulnessBand", "partOfSpeech", "register"]) if (!ENUMS[field].has(record[field])) fail(field);
      if (!Array.isArray(record.topics) || record.topics.length < 1 || record.topics.length > 8 || record.topics.some((topic) => text(topic, "topics", 64) !== topic)) fail("topics");
      if (Object.hasOwn(record, "editorialChecked") && typeof record.editorialChecked !== "boolean") fail("editorialChecked");
      if (record.reviewed !== true) throw new TypeError("Vocabulary records must be reviewed.");

      for (const field of ["root", "pattern", "weight", "vocalization", "category"]) {
        if (Object.hasOwn(record, field) && record[field] !== undefined) text(record[field], field, 512);
      }

      if (Object.hasOwn(record, "relatedIds") && record.relatedIds !== undefined) {
        if (!Array.isArray(record.relatedIds) || record.relatedIds.length > 16 || record.relatedIds.some((id) => !ID.test(String(id)))) fail("relatedIds");
      }
      if (Object.hasOwn(record, "usageNote")) text(record.usageNote, "usageNote");
      if (Object.hasOwn(record, "exampleKind") && !["original", "quotation"].includes(record.exampleKind)) fail("exampleKind");
      if (Object.hasOwn(record, "exampleSource")) {
        const source = record.exampleSource;
        if (record.exampleKind !== "quotation" || !source || typeof source !== "object" || Array.isArray(source) || Object.getPrototypeOf(source) !== Object.prototype) fail("exampleSource");
        if (Object.keys(source).length !== 3 || !["title", "url", "reference"].every((key) => Object.hasOwn(source, key))) fail("exampleSource keys");
        for (const field of ["title", "reference"]) text(source[field], `exampleSource.${field}`, 512);
        text(source.url, "exampleSource.url", 2048);
        let url;
        try { url = new URL(source.url); } catch { fail("exampleSource.url"); }
        if (!/^https:\/\//i.test(source.url) || url.protocol !== "https:" || !url.hostname || url.username || url.password || /[\s\\]/.test(source.url)) fail("exampleSource.url");
      }
      if (JSON.stringify(record).length > 8192) fail("record size");
      const normalized = { ...record };
      if (normalized.exampleSource) normalized.exampleSource = Object.freeze({ ...normalized.exampleSource });
      if (normalized.relatedIds) normalized.relatedIds = Object.freeze([...normalized.relatedIds]);
      normalized.topics = Object.freeze([...normalized.topics]);
      return Object.freeze(normalized);
    });
    for (const record of records) if (record.relatedIds && record.relatedIds.some((id) => !ids.has(id))) fail("related IDs");
    return Object.freeze(records);
  }

  function findWord(vocabulary, id) {
    if (!Array.isArray(vocabulary) || id === null || id === undefined) return undefined;
    const strId = String(id);
    const exact = vocabulary.find((word) => word && String(word.id) === strId);
    if (exact) return exact;
    const numId = /^(?:w)?[0-9]+$/.test(strId) ? Number(strId.replace(/^w/, "")) : NaN;
    return vocabulary.find((word) => {
      if (!word) return false;
      if (word.id === id || String(word.id) === strId) return true;
      if (Number.isInteger(numId) && (word.id === numId || word.id === `w${numId}` || String(word.id) === String(numId))) {
        return true;
      }
      return false;
    });
  }

  function canonicalSearchKey(value) {
    if (typeof value !== "string" || value.length === 0) return "";
    return value
      .trim()
      .toLowerCase()
      .replace(/\u0640/g, "")
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي");
  }

  // ponytail: canonical keys are memoized in a WeakMap (validated records are
  // frozen); the cache dies with each record and never leaks into JSON.
  const canonicalKeyCache = new WeakMap();

  function cachedCanonicalKey(item, field) {
    let entry = canonicalKeyCache.get(item);
    if (!entry) {
      entry = {};
      canonicalKeyCache.set(item, entry);
    }
    if (entry[field] === undefined) {
      entry[field] = canonicalSearchKey(item[field]);
    }
    return entry[field];
  }

  function rankVocabulary(vocabulary, query) {
    if (!Array.isArray(vocabulary)) return [];
    const canonicalQuery = canonicalSearchKey(query);
    if (!canonicalQuery) {
      return [...vocabulary].filter((word) => searchable(word));
    }

    const scored = [];
    for (const item of vocabulary) {
      if (!searchable(item)) continue;

      const headword = cachedCanonicalKey(item, "word");
      const normalized = cachedCanonicalKey(item, "normalized");

      let tier = null;
      if (item.word === query.trim()) {
        tier = 0.5;
      } else if (headword === canonicalQuery || normalized === canonicalQuery) {
        tier = 1;
      } else if (headword.startsWith(canonicalQuery) || normalized.startsWith(canonicalQuery)) {
        tier = 2;
      } else if (headword.includes(canonicalQuery) || normalized.includes(canonicalQuery)) {
        tier = 3;
      } else {
        // ponytail: combined meta keys memoized per record; preserves the
        // original field-fallback semantics while computing each key once.
        let metaKeys = canonicalKeyCache.get(item)?.meta;
        if (!metaKeys) {
          const metaFields = [
            item.root,
            item.pattern || item.weight,
            item.meaningAr || item.meaning,
            item.meaningEn || item.englishMeaning,
            item.contextAr || item.context,
            item.contextEn || item.contextEnglish,
            item.exampleAr || item.example,
            item.category,
            item.vocalization,
            item.partOfSpeech,
            item.register,
            item.pronunciation,
          ];
          metaKeys = metaFields.filter(Boolean).map((f) => canonicalSearchKey(f));
          let entry = canonicalKeyCache.get(item);
          if (!entry) {
            entry = {};
            canonicalKeyCache.set(item, entry);
          }
          entry.meta = metaKeys;
        }
        let matchesMeta = metaKeys.some((key) => key.includes(canonicalQuery));
        if (!matchesMeta && Array.isArray(item.topics)) {
          matchesMeta = item.topics.some((t) => t && canonicalSearchKey(t).includes(canonicalQuery));
        }
        if (matchesMeta) {
          tier = 4;
        }
      }

      if (tier !== null) {
        scored.push({ item, tier });
      }
    }

    scored.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      const uDiff = (USEFULNESS_ORDER[b.item.usefulnessBand] || 0) - (USEFULNESS_ORDER[a.item.usefulnessBand] || 0);
      if (uDiff !== 0) return uDiff;
      const dDiff = (DIFFICULTY_ORDER[a.item.difficultyBand] || 0) - (DIFFICULTY_ORDER[b.item.difficultyBand] || 0);
      if (dDiff !== 0) return dDiff;
      return String(a.item.id).localeCompare(String(b.item.id), undefined, { numeric: true });
    });

    return scored.map((entry) => entry.item);
  }

  return { validateEditorialCard, validateVocabulary, validateDiscoveryCard, findWord, canonicalSearchKey, rankVocabulary };
});
