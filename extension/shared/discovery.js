(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.KalimatDiscovery = api;
})(globalThis, function () {
  "use strict";

  const ORIGINS = ["https://ar.wikipedia.org", "https://ar.wiktionary.org"];
  const LMF_URL = "https://lindat.mff.cuni.cz/repository/items/d4d8ef1a-0e51-42d1-9a94-113cb81afa76";
  const LIMITS = Object.freeze({ passages: 8, titles: 50, bytes: 524288, timeoutMs: 8000 });
  // These are reading-source controls, not a list of words to teach.
  const QUERIES = {
    science: "البحث العلمي", culture: "الفنون والأدب", society: "المجتمع والتعليم",
    environment: "حماية البيئة", economics: "الاقتصاد والعمل", language: "اللغة والترجمة",
  };
  function mergeIndexes(...indexes) {
    const groups = new Map();
    for (const index of indexes) {
      if (!Array.isArray(index)) throw new TypeError("Invalid discovery catalog");
      for (const row of index) {
        if (!Array.isArray(row) || typeof row[0] !== "string" || !Array.isArray(row[1]) || !Array.isArray(row[2])) throw new TypeError("Invalid discovery catalog row");
        const previous = groups.get(row[0]);
        if (previous) {
          previous[1] = [...new Set([...previous[1], ...row[1]])];
          previous[2].push(...row[2]);
        } else groups.set(row[0], [row[0], [...row[1]], [...row[2]]]);
      }
    }
    return [...groups.values()].sort((a, b) => a[0].localeCompare(b[0]));
  }
  function normalizeKey(value) {
    return typeof value === "string" ? value.normalize("NFC").replace(/[\u064b-\u065f\u0670\u0640]/g, "").replace(/\s+/g, " ").trim() : "";
  }
  function lexicalKey(value) { return normalizeKey(value).replace(/^ال(?=.{3})/u, ""); }
  function hash(value) {
    let h = 2166136261;
    for (const c of value) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, "0");
  }
  const tokens = text => normalizeKey(text).match(/[\u0621-\u063a\u0641-\u064a]+/g) || [];
  const stop = new Set(tokens("على إلى من عن في أن إن هذا هذه ذلك التي الذي هو هي أو ما لا بين مع يتم خلال كان كما كل وقد ذات له لها بها فيها وهو وهي غير صار أصبح تكون يكون بعض جميع نفس نفسه مثل فقط أكثر أقل حتى منذ عبر قبل بعد دون جدا حين"));
  function terms(text, word = "") {
    const own = new Set(tokens(word).map(lexicalKey));
    return new Set(tokens(text).map(lexicalKey).filter(t => t.length >= 3 && !stop.has(t) && !own.has(t)));
  }
  function overlap(a, b) { let n = 0; for (const t of a) if (b.has(t)) n++; return n; }
  function plainWiki(line) {
    // Render only the small, inspectable subset whose visible text is unambiguous.
    let text = line.replace(/\[\[([^\[\]|]+)\|([^\[\]]+)\]\]/g, "$2").replace(/\[\[([^\[\]]+)\]\]/g, "$1").replace(/'{2,5}/g, "");
    text = text.replace(/\{\{(?:متعد|لازم|قديم|مجاز|عامية|اسم|صفة|فعل|مذكر|مؤنث|مفرد|معربة|لا جمع)\}\}/g, "").trim();
    if (/[{}\[\]<>|]|https?:|&\w+;|[A-Za-z]/u.test(text)) return null;
    return text.replace(/\s+/g, " ").trim();
  }
  // Source QA exclusions identify faulty revisions, never words to teach.
  // 12820: a hypothesis is incorrectly defined as contrary to fact.
  // 140115: its square example incorrectly says all four sides are parallel.
  // 199672: citizenship gloss paired with a political-dependence example.
  // 224746: uncorroborated cooperative sense, held out pending source review.
  const rejectedRevisions = new Set(["12820:1084156", "140115:1079291", "199672:1141360", "224746:1141409", "9740:1086519", "134191:1091225", "140652:1091788", "225039:1140858", "224876:1140921", "14954:1091774", "225040:1141107"]);
  // Corpus frequency is an attestation/commonness guard, not a proficiency score.
  // Prefer transferable vocabulary over concrete object labels in enrichment mode.
  // Further revision holds: restrictive receive/exception glosses; suspect
  // shelter wording; status-vs-moral-superiority pairing; settlement restriction;
  // and fragmentary relapse example. Future source corrections remain eligible.
  function isReliableSense(sense) {
    const definition = normalizeKey(sense?.definition);
    if (!definition || definition.length > 240 || definition.includes(":") || /فعل (?:متعد|لازم|مطاوعة|تعد)|مفعول به|تصريف/.test(definition)) return false;
    if (/^(?:كما (?:يمكن|قد)|يمكن أن|قد |فعل مطاوعة|يستخدم أيضا|معناه أيضا|المعنى السابق|ومن معانيه|ويقال)|(?:المذكور|المشار إليه|ما سبق)|^(?:حال|صفة) (?:او|أو|ال)/.test(definition)) return false;
    // Reject literal object/place/animal labels, even if the spelling is uncommon.
    const head = definition.replace(/^(?:[اأ]سم[،,.]?\s*|هو\s+|هي\s+|ال)/, "").replace(/^ال/, "");
    if (/^(?:غاز|سائل|أداة|آلة|جهاز|برج|مئذنة|محجة|مكان|موضع|حيوان|طائر|نبات|شجرة|مادة|معدن|ثوب|لباس|طعام|جزء من الجسم|عضو|نوع من|بيت|بناء|مبنى|وعاء|صندوق|مجلس|قطعة|إناء|غرفة)(?:[،,. ]|$)/.test(head)) return false;
    return true;
  }
  function completeExample(example) {
    return typeof example === "string" && /[.!؟]$/.test(example.trim()) &&
      !/\s[-–]\s|\.\.\.|…|مرادفات|أضداد|==|قال |قول |الخ\./.test(example) &&
      !/(?:قد تشير إلى|قد يشير إلى)/.test(example);
  }
  function isUsefulEntry(entry) {
    if (!entry || rejectedRevisions.has(`${entry.pageid}:${entry.revisionId}`)) return false;
    const zipf = entry.frequency?.zipf;
    return Number.isFinite(zipf) && zipf >= 1.5 && zipf <= 3.5 &&
      (entry.senses || []).some(isReliableSense);
  }
  function isEligibleSnapshot(word, index) {
    const entries = index.find(row => row[0] === normalizeKey(word.word))?.[2] || [];
    return entries.some(entry => {
      if (!isUsefulEntry(entry)) return false;
      if (entry.source?.kind === "lmf") {
        const source = word.source;
        if (word.id !== `lmf_${entry.source.recordId}` || word.word !== entry.title ||
            word.senseContext !== (entry.source.contexts?.join(" / ") || undefined) || source?.url !== LMF_URL ||
            source.license !== "CC-BY-NC-4.0" || word.exampleSource?.url !== LMF_URL ||
            word.exampleSource.reference !== `LMF: ${entry.source.entryId} / ${entry.source.senseId}` ||
            ["sha256", "entryId", "senseId", "recordId"].some(key => source[key] !== entry.source[key])) return false;
        return entry.senses.some(sense => sense.definition === word.meaningAr && sense.examples.includes(word.exampleAr) &&
          Boolean(rankDictionaryExample({...entry,senses:[{...sense,examples:[word.exampleAr]}]}, {key:normalizeKey(word.word),passages:[]})));
      }
      return entry.revisionId === word.source?.revisionId && entry.senses.some(sense => sense.definition === word.meaningAr && isReliableSense(sense) &&
        (word.exampleSource?.url?.startsWith(ORIGINS[1] + "/")
          ? sense.examples.includes(word.exampleAr) && Boolean(rankDictionaryExample({...entry,senses:[{...sense,examples:[word.exampleAr]}]},{key:normalizeKey(word.word),passages:[]}))
          : rankEntry(entry,{key:normalizeKey(word.word),passages:[{text:word.exampleAr}]})?.meaning === word.meaningAr));
    });
  }
  function parseEntry(page) {
    if (rejectedRevisions.has(`${page?.pageid}:${page?.revision ?? page?.revisions?.[0]?.revid}`)) return null;
    const text = page?.text ?? page?.revisions?.[0]?.slots?.main?.content;
    if (typeof text !== "string" || text.length > 100000 || !page.title) return null;
    // Do not redistribute ambiguous modern-dictionary copying or named entities.
    if (/اسم\s+علم|أسماء\s+الأعلام|اسم شخص|اسم مدينة|عاصمة|دولة\s+(?:في|أوروبية)|قارة|بلدان|جنس\s+من|نوع\s+من\s+(?:النبات|الحيوان|الطيور)|الغني|المعجم الوسيط|لسان العرب/.test(normalizeKey(text))) return null;
    const sections = text.split(/^==\s*(?!=)(.+?)(?<![=])\s*==\s*$/m);
    let arabic = null;
    for (let i = 1; i < sections.length; i += 2) {
      if (/^(?:\{\{اللغة\|عربية\}\}|\[\[عربية\]\]|عربية)$/.test(normalizeKey(sections[i]))) { arabic = sections[i + 1]; break; }
    }
    if (!arabic) return null;
    const lines = arabic.split("\n");
    const heading = lines.findIndex(line => /^={3,4}\s*(?:المعاني|المعانى|معاني)\s*={3,4}\s*$/.test(normalizeKey(line)));
    // Older entries put definitions immediately below the Arabic heading.
    const body = lines.slice(heading + 1).join("\n").split(/^={3,}/m)[0];
    const definitions = [], senses = [];
    let currentSense = null;
    for (const line of body.split("\n")) {
      const example = line.match(/^#:\s*(.+)$/);
      if (example && currentSense) {
        const clean = plainWiki(example[1]);
        if (clean && clean.length >= 25 && clean.length <= 500 && !/قرآن|سورة|آية|حديث|رواه|قال تعالى/.test(normalizeKey(clean))) currentSense.examples.push(clean);
        continue;
      }
      const numbered = line.match(/^#(?![:*#])\s*(.+)$/);
      if (numbered) currentSense = null;
      const raw = numbered ? numbered[1] : null;
      if (!raw || /^\s*\'\'[^\']/.test(raw)) continue;
      // Do not erase a register/domain label and present its sense as general Arabic.
      if (/\{\{(?:قديم|مجاز|عامية)(?:[|}])/.test(raw)) continue;
      const clean = plainWiki(raw);
      if (!clean || clean.length < 16 || clean.length > 700 || tokens(clean).length < 3) continue;
      const n = normalizeKey(clean);
      if (n.length < 16 || /ضمير|حرف جر|اسم موصول|فعل ناقص|وحدة زمنية/.test(n)) continue;
      if (/^(?:المضارع|الماضي|المفرد|قيمة عددية|اسم تفضيل|جمع|مثنى|مؤنث|تصريف|صيغة|مصدر\s+(?:الفعل|فعل|للفعل)|المؤنث|المنسوب|نطق أقل|طريقة هجاء|نسبة إلى|اسم\s+(?:حرف|لغة))|\b(?:TODO)\b/.test(n)) continue;
      if (/^(?:في\s+)?(?:الفيزياء|الكيمياء|الرياضيات|النحو|البناء):/.test(n)) continue;
      if (/^(?:هو\s+)?(?:علم|العلم|فرع\s+من|أحد فروع|الدراسة العلمية)\s|أو علم |، علم يبحث/.test(n)) continue;
      if (/(?:^|\s)(?:اللغة|لغة|الشهر|تقويم)\s|نسبة إلى|لغات جرمانية|اسم يطلق على/.test(n)) continue;
      const remaining = terms(clean, page.title);
      if (remaining.size < 2 || n === normalizeKey(page.title)) continue;
      definitions.push(clean);
      currentSense = {definition: clean, examples: []};
      senses.push(currentSense);
    }
    if (!definitions.length) return null;
    const pos = /\{\{صفة\}\}/.test(arabic) ? "adjective" : /\{\{(?:فعل|عربية-فعل|صندوق معلومات فعل)(?:[|}])|===+\s*فعل\s*===+/.test(normalizeKey(arabic)) ? "verb" : page.title.includes(" ") && /جملة/.test(body.slice(0, 180)) ? "phrase" : /صندوق معلومات اسم/.test(arabic) ? "noun" : "other";
    return { title: page.title, pageid: page.pageid, revisionId: page.revision ?? page.revisions?.[0]?.revid, definitions: [...new Set(definitions)], senses, partOfSpeech: pos, senseCount: (body.match(/^#(?![:*#])/gm) || []).length };
  }
  function extractPassages(pages) {
    return (Array.isArray(pages) ? pages : []).filter(p => p?.pageid > 0 && !p.missing && !p.pageprops?.disambiguation && !(p.pageprops && Object.hasOwn(p.pageprops, "disambiguation")) && typeof p.extract === "string")
      .slice(0, LIMITS.passages).flatMap(p => p.extract.split(/\n+/).filter(s => s.length >= 100 && s.length <= 5000 && !/[<>\[\]{}=]|قد تشير إلى|توضيح/.test(s)).slice(0, 4).map(text => ({ title: p.title, pageid: p.pageid, revisionId: p.lastrevid, text })));
  }
  function rankDictionaryExample(entry, candidate) {
    if (!entry || normalizeKey(entry.title) !== candidate.key) return null;

    // Short ambiguous citation forms need article context, not dictionary fallback.
    if (candidate.key.length < 5 && !candidate.key.includes(" ")) return null;
    const matches = [];
    if (entry.partOfSpeech === "verb" && candidate.passages.length && candidate.passages.every(p => tokens(p.text).some(t => ["ال","وال","فال","بال","كال","لل"].some(prefix => t === prefix + candidate.key)))) return null;
    for (const sense of entry.senses || []) {
      if (normalizeKey(sense.definition).startsWith(candidate.key + " ")) continue;
      if (!isReliableSense(sense)) continue;
      // These are examples attached to this exact sense by the source editor.
      // Never borrow a neighboring sense's example or invent a sentence.
      if (/مرادفات|أضداد|==|قال |قول |الخ\.|\.\.\./.test(sense.examples?.join(" ") || "")) continue;
      if (sense.definition.length < 16 || tokens(sense.definition).length < 3) continue;
      for (const example of sense.examples || []) {
        if (!completeExample(example)) continue;
        if (/(?:^|[ :])(?:هو|هي|كون) /.test(normalizeKey(example))) continue;
        if (/[؛،].*[؛،]/.test(example) || /مرادفات|أضداد|==|قال |قول |الخ\.|\.\.\./.test(example)) continue;
        if (example.length < 25 || example.length > 360 || tokens(example).length < 4) continue;
        const exampleTokens = tokens(example);
        if (entry.partOfSpeech === "verb" &&
            exampleTokens.some(t => ["ال", "وال", "فال", "بال", "كال", "لل"].some(prefix => t === prefix + candidate.key)) &&
            !exampleTokens.some(t => t === candidate.key || t === "و" + candidate.key || t === "ف" + candidate.key)) continue;
        if (!extractCandidates([{text:example}], [[candidate.key,[entry.title]]]).length) continue;
        matches.push({entry,candidate,meaning:sense.definition,example,score:0,
          passage:{title:entry.title,revisionId:entry.revisionId,dictionary:true}});
      }
    }
    const context = candidate.context || terms(candidate.passages.map(p => p.text).join(" "));
    const affinity = r => overlap(terms(`${r.meaning} ${r.example}`,candidate.key),context);
    return matches.sort((a,b) => affinity(b)-affinity(a) || a.example.length-b.example.length)[0] || null;
  }
  function extractCandidates(passages, index, excludeKeys = []) {
    const map = new Map(Array.isArray(index) ? index.filter(x => Array.isArray(x) && typeof x[0] === "string" && Array.isArray(x[1])).map(([k,v]) => [normalizeKey(k), v.filter(t => typeof t === "string")]) : []);
    const entries = new Map(index.filter(x => Array.isArray(x?.[2])).map(x => [x[0], x[2]]));
    const excluded = new Set(excludeKeys.map(lexicalKey));
    const candidates = new Map();
    for (const passage of passages) {
      const words = tokens(passage.text);
      for (let i = 0; i < words.length; i++) {
        const variants = new Set([words[i]]);
        if (/^[وف].{4}/u.test(words[i])) variants.add(words[i].slice(1));
        for (const w of [...variants]) {
          if (/^ال.{3}/u.test(w)) variants.add(w.slice(2));
          if (/^[بك]ال.{3}/u.test(w)) variants.add(w.slice(3));
          if (/^لل.{3}/u.test(w)) variants.add(w.slice(2));
        }
        // Exact phrases keep their prepositions; never strip a phrase prefix.
        for (const count of [2, 3]) if (i + count <= words.length) variants.add(words.slice(i, i + count).join(" "));
        for (const key of variants) {
          if (!map.has(key) || excluded.has(lexicalKey(key)) || key.length < 4 || key.length > 30 || stop.has(key)) continue;
          if (!candidates.has(key)) candidates.set(key, { key, titles: map.get(key), entries: entries.get(key), passages: [] });
          const candidate = candidates.get(key);
          if (!candidate.passages.includes(passage)) candidate.passages.push(passage);
        }
      }
    }
    return [...candidates.values()].sort((a,b) => ((b.passages.length + Number(b.key.includes(" "))) - (a.passages.length + Number(a.key.includes(" ")))) || hash(a.key).localeCompare(hash(b.key)));
  }
  function rankEntry(entry, candidate) {
    if (!entry || normalizeKey(entry.title) !== candidate.key) return null;
    const matches = [];
    for (const passage of candidate.passages) {
      const sentences = (passage.text.match(/[^.!؟\n]+[.!؟]?/g) || []).flatMap(s => s.length > 360 ? (s.match(/[^،؛]+[،؛]?/g) || []) : [s]);
      for (const sentence of sentences) {
        if (!completeExample(sentence) || /[=]|؛/.test(sentence) || sentence.length < 40 || sentence.length > 360 || !extractCandidates([{...passage,text:sentence}],[[candidate.key,[entry.title]]]).length) continue;
        if (entry.partOfSpeech === "verb" && tokens(sentence).some(t => ["ال", "وال", "فال", "بال", "كال", "لل"].some(prefix => t === prefix + candidate.key))) continue;
        const context = terms(sentence, candidate.key);
        const senses = entry.definitions.map(definition => {
          if (!isReliableSense({definition})) return {definition,score:-1};
          const sense = entry.senses?.find(s => s.definition === definition);
          if (!sense?.examples?.some(completeExample)) return {definition,score:-1};
          const exampleScore = Math.max(0, ...(sense?.examples || []).map(example => {
            // Evidence must be local to the word, not a shared unrelated sentence.
            const local = text => tokens(text).map(lexicalKey);
            const a = local(example), b = local(sentence), key = lexicalKey(candidate.key);
            return a.some((t,i) => t === key && b.some((u,j) => u === key &&
              ((a[i+1] && !stop.has(a[i+1]) && a[i+1] === b[j+1]) ||
               (a[i-1] && !stop.has(a[i-1]) && a[i-1] === b[j-1])))) ? 3 : 0;
          }));
          return {definition,score: (entry.senseCount > 1 || entry.definitions.length > 1) ? exampleScore : Math.max(overlap(terms(definition,candidate.key),context),exampleScore)};
        }).sort((a,b)=>b.score-a.score);
        const first = senses[0];
        if ((entry.senseCount > 1 || senses.length > 1) && (first.score < 2 || (senses[1] && first.score <= senses[1].score))) continue;
        if (first.score < 1 && entry.partOfSpeech !== "phrase") continue;
        matches.push({entry,candidate,meaning:first.definition,passage,example:sentence.trim(),score:first.score});
      }
    }
    return matches.sort((a,b) => b.score-a.score)[0] || null;
  }
  async function request(origin, params, fetchFn, timeoutMs = LIMITS.timeoutMs) {
    if (!ORIGINS.includes(origin)) throw new Error("origin");
    const controller = new AbortController();
    let timer;
    try {
      return await Promise.race([(async () => {
        const response = await fetchFn(`${origin}/w/api.php?${new URLSearchParams({format:"json",formatversion:"2",origin:"*",...params})}`, {method:"GET",credentials:"omit",redirect:"error",cache:"no-store",signal:controller.signal});
        if (!response?.ok || response.headers?.get("content-type")?.split(";")[0].trim() !== "application/json") throw new Error("response");
        if (Number(response.headers?.get("content-length")) > LIMITS.bytes) throw new Error("size");
        let text = "";
        if (response.body?.getReader) {
          const reader = response.body.getReader(), decoder = new TextDecoder(); let bytes = 0;
          try { for (;;) { const {done,value} = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > LIMITS.bytes) throw new Error("size"); text += decoder.decode(value,{stream:true}); } text += decoder.decode(); }
          catch (error) { await reader.cancel().catch(() => {}); throw error; }
        } else { text = await response.text(); if (new TextEncoder().encode(text).length > LIMITS.bytes) throw new Error("size"); }
        const data = JSON.parse(text); if (data.error) throw new Error("api"); return data;
      })(), new Promise((_,reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("timeout")); }, timeoutMs); })]);
    } finally { clearTimeout(timer); controller.abort(); }
  }
  async function discover({index, excludeKeys = [], topics = [], dateKey = "", seedHex = "", fetchFn = globalThis.fetch} = {}) {
    const diagnostics = { passages:0, candidates:0, titles:0, rejected:0, requests:0 };
    if (typeof fetchFn !== "function" || !Array.isArray(index)) return {kind:"unavailable", diagnostics};
    // Title inventories lack frequency evidence and cannot power enrichment.
    if (!index.some(row => Array.isArray(row[2]))) return {kind:"unavailable",diagnostics:{...diagnostics,reason:"catalog-required"}};
    const deadline = Date.now() + 20000;
    const boundedRequest = (origin,params) => request(origin,params,fetchFn,Math.max(1,Math.min(LIMITS.timeoutMs,deadline-Date.now())));
    try {
      const rotation = parseInt(hash(`${dateKey}:${seedHex}`),16);
      const selectedTopics = [...new Set(topics.filter(t => Object.hasOwn(QUERIES,t)))];
      const choices = selectedTopics.length ? selectedTopics : Object.keys(QUERIES);
      // A sparse topic need not make the day empty. Try at most three selected
      // interests, within the same total deadline and unchanged quality gates.
      for (let attempt = 0; attempt < Math.min(3, choices.length); attempt++) {
        const topic = choices[(rotation + attempt) % choices.length];
        diagnostics.requests++;
        const data = await boundedRequest(ORIGINS[0], {action:"query",generator:"search",gsrsearch:QUERIES[topic],gsrnamespace:"0",gsrlimit:String(LIMITS.passages),gsroffset:String(rotation % 40),prop:"extracts|pageprops|info",explaintext:"1",exintro:"1",exlimit:String(LIMITS.passages),redirects:"1"});
        const passages = extractPassages(data.query?.pages); diagnostics.passages += passages.length;
        const candidates = extractCandidates(passages,index,excludeKeys); diagnostics.candidates += candidates.length;
        const selected = [], titles = [], alternatives = [];
        for (const candidate of candidates) {
          const valid = [...new Set(candidate.titles.filter(t => normalizeKey(t) === candidate.key && !/[|\x00-\x1f]/.test(t)))].sort((a,b) => (Number(b !== normalizeKey(b)) - Number(a !== normalizeKey(a))) || a.localeCompare(b));
          if (!valid.length || titles.length >= LIMITS.titles) continue;
          titles.push(valid[0]); alternatives.push(...valid.slice(1,3)); selected.push(candidate);
        }
        for (const title of alternatives) if (titles.length < LIMITS.titles) titles.push(title);
        diagnostics.titles = titles.length;
        // Reproducible, attributed entries with local frequency evidence.
        const entries = selected.flatMap(c => c.entries || []);
        const results = [];
        for (const entry of entries) {
          const candidate = selected.find(c => c.key === normalizeKey(entry.title));
          const ranked = isUsefulEntry(entry) && candidate && (entry.source?.kind === "lmf" ? rankDictionaryExample(entry,candidate) : (rankEntry(entry,candidate) || rankDictionaryExample(entry,candidate)));
          if (ranked && (entry.source?.kind === "lmf" || (entry.pageid > 0 && Number.isSafeInteger(entry.revisionId)))) results.push(ranked); else diagnostics.rejected++;
        }
        // Dictionary-led retrieval offers source-attached sense/example pairs.
        // Lexical overlap is only a retrieval heuristic: it does not establish
        // semantic relevance to the reading or an occurrence in that article.
        const context = terms(passages.map(p => p.text).join(" "));
        const excluded = new Set(excludeKeys.map(lexicalKey));
        const related = [];
        for (const [key,,catalogEntries] of index) {
          if (!Array.isArray(catalogEntries) || excluded.has(lexicalKey(key)) || selected.some(c => c.key === key)) continue;
          for (const entry of catalogEntries) {
            if (!isUsefulEntry(entry)) continue;
            const ranked = rankDictionaryExample(entry,{key,passages:[],context});
            if (!ranked) continue;
            const affinity = overlap(terms(`${ranked.meaning} ${ranked.example}`,key),context);
            if (affinity < 2) continue;
            related.push({...ranked,related:true,affinity});
          }
        }
        // Both routes must clear the same quality gate. Exact occurrence alone
        // cannot outrank a better supported lesson related to the reading.
        for (const result of results) result.affinity = overlap(terms(`${result.meaning} ${result.example}`,result.candidate.key),context);
        results.push(...related);
        diagnostics.relatedLessons = related.length;
        diagnostics.lessons = results.length;
        // Favor relevant, attested enrichment vocabulary; length is not difficulty.
        results.sort((a,b) => Math.min(b.affinity,4)-Math.min(a.affinity,4) ||
          b.score-a.score || Math.abs(a.entry.frequency.zipf-3)-Math.abs(b.entry.frequency.zipf-3) ||
          hash(`${seedHex}:${dateKey}:${a.candidate.key}`).localeCompare(hash(`${seedHex}:${dateKey}:${b.candidate.key}`)));
        for (const r of results) {
          const sourceUrl = `${ORIGINS[1]}/w/index.php?oldid=${r.entry.revisionId}`;
          const exampleOrigin = r.passage.dictionary ? ORIGINS[1] : ORIGINS[0];
          const exampleUrl = Number.isSafeInteger(r.passage.revisionId) ? `${exampleOrigin}/w/index.php?oldid=${r.passage.revisionId}` : `${ORIGINS[0]}/wiki/${encodeURIComponent(r.passage.title)}`;
          const word = {contentVersion:3,id:`wk_${r.entry.pageid}_${hash(`${r.entry.pageid}:${r.meaning}`)}`,word:r.entry.title,normalized:normalizeKey(r.entry.title),meaningAr:r.meaning,exampleAr:r.example,topics:[topic],partOfSpeech:r.entry.partOfSpeech,register:"standard",reviewed:false,source:{title:r.entry.title,url:sourceUrl,revisionId:r.entry.revisionId,license:"CC-BY-SA-4.0"},exampleKind:"quotation",exampleSource:{title:r.passage.title,url:exampleUrl,reference:`${r.passage.dictionary ? "مثال ويكاموس للمعنى المختار" : "ويكيبيديا العربية"}، ${r.passage.title}`},discoveryReason:r.related ? "اقتراح من ويكاموس. المعنى ومثاله من المصدر نفسه، ولا يثبت تداخل الألفاظ صلته بموضوع القراءة. لم تخضع لمراجعة بشرية." : r.passage.dictionary ? "اكتُشفت في قراءة عربية. المعنى ومثاله من ويكاموس، ولا يُنسب هذا المعنى إلى سياق المقال. لم تخضع لمراجعة بشرية." : "لفظة موثقة في قراءة عربية، ومعناها من ويكاموس. لم تخضع لمراجعة بشرية."};
          if (r.entry.source?.kind === "lmf") {
            const {sha256, entryId, senseId, recordId} = r.entry.source;
            const title = `${r.entry.title}، معجم اللغة العربية المعاصرة`;
            word.id = `lmf_${recordId}`;
            const senseContext = r.entry.source.contexts?.join(" / ");
            if (senseContext) word.senseContext = senseContext;
            word.source = {title, url:LMF_URL, license:"CC-BY-NC-4.0", sha256, entryId, senseId, recordId};
            word.exampleSource = {title, url:LMF_URL, reference:`LMF: ${entryId} / ${senseId}`};
            word.discoveryReason = "اقتراح معجمي من معجم اللغة العربية المعاصرة. المعنى ومثاله من المدخل نفسه، ولا يثبت تداخل الألفاظ صلته بموضوع القراءة. لم يراجعه فريق كلمات.";
          }
          if (new TextEncoder().encode(JSON.stringify(word)).length <= 4096) return {kind:"found",word,diagnostics};
        }
      }
      return {kind:"empty",diagnostics};
    } catch (_) { return {kind:"unavailable",diagnostics}; }
  }
  return {ORIGINS,LMF_URL,LIMITS,mergeIndexes,normalizeKey,lexicalKey,plainWiki,parseEntry,extractPassages,extractCandidates,rankEntry,rankDictionaryExample,isUsefulEntry,isReliableSense,isEligibleSnapshot,discover};
});
