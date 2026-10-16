// Deterministic replay of 50 actual, revision-attributed Arabic passages.
// This complements live E2E; an empty result can never pass this coverage check.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const d = require(path.join(root, 'extension/shared/discovery'));
const v = require(path.join(root, 'extension/shared/vocabulary'));
const index = d.mergeIndexes(require(path.join(root, 'extension/data/discovery-index.json')), require(path.join(root, 'extension/data/lmf-index.json')));
const passages = require('../fixtures/discovery-passages.json');
const bundled = require(path.join(root, 'extension/data/vocabulary.json')).map(w => w.word);
(async () => {
  const results = [];
  for (const p of passages) {
    const result = await d.discover({index,excludeKeys:bundled,topics:[p.topic],dateKey:'2026-10-16',seedHex:'coverage',fetchFn:async () => new Response(JSON.stringify({query:{pages:[{title:p.title,pageid:p.pageid,lastrevid:p.revision,extract:p.passage,...(p.passage.includes('قد تشير إلى') ? {pageprops:{disambiguation:''}} : {})}]}}),{headers:{'content-type':'application/json'}})});
    if (result.kind === 'found') v.validateDiscoveryCard(result.word);
    results.push({passage:p.id,kind:result.kind,word:result.word,diagnostics:result.diagnostics});
  }
  const found = results.filter(r => r.kind === 'found');
  const unique = new Set(found.map(r=>d.lexicalKey(r.word.word)));
  const articleExamples = found.filter(r=>r.word.exampleSource.url.startsWith("https://ar.wikipedia.org/")).length;
  // Daily discovery reads up to eight passages, not one isolated paragraph.
  // Keep the single-passage metric visible; do not restore weak cards for yield.
  const daily = [], seen = [...bundled];
  for (const topic of [...new Set(passages.map(p=>p.topic))]) {
    const pages = passages.filter(p=>p.topic===topic).slice(0,d.LIMITS.passages)
      .map(p=>({title:p.title,pageid:p.pageid,lastrevid:p.revision,extract:p.passage}));
    const result = await d.discover({index,excludeKeys:seen,topics:[topic],dateKey:'2026-10-16',seedHex:'coverage',
      fetchFn:async()=>new Response(JSON.stringify({query:{pages}}),{headers:{'content-type':'application/json'}})});
    if(result.word) { v.validateDiscoveryCard(result.word); seen.push(result.word.word); }
    daily.push({topic,...result});
  }
  for(const {word} of [...found,...daily].filter(r=>r.word)) {
    assert.ok(d.isEligibleSnapshot(word,index), `New card must pass current quality checks: ${word.word}`);
    assert.ok(!['نظرية','منارة','استلم','استثنى','استوطن','عبارة','تفريخ','مجموعة','تاريخ','قانون','صالون'].includes(d.normalizeKey(word.word)), `Quality regression: ${word.word}`);
  }
  const report = {daily,articleExamples,dictionaryExamples:found.length-articleExamples,passages:passages.length,found:found.length,distinctWords:unique.size,results};
  if (process.env.KALIMAT_COVERAGE_OUTPUT) fs.writeFileSync(process.env.KALIMAT_COVERAGE_OUTPUT,JSON.stringify(report,null,2)+'\n');
  console.log(`${found.length}/${passages.length} passages produce a lesson; ${unique.size} distinct words.`);
  console.log([...new Map(found.map(r=>[r.word.word,r.word.meaningAr]))]);
  console.log(`${daily.filter(r=>r.kind==='found').length}/${daily.length} daily topic searches produce different eligible lessons.`);
  // The former 25/50 gate rewarded basic or misleading cards. The quality gate
  // retains positive yield requirements and tests the actual multi-passage flow.
  assert.ok(found.length >= 12, 'Strict screening must still find useful lessons in the fixed corpus');
  assert.ok(unique.size >= 6, 'Quality coverage must not repeat one phrase');
  assert.ok(daily.filter(r=>r.kind==='found').length >= 4, 'At least four daily topic searches must yield eligible non-repeated words');
})().catch(error=>{console.error(error);process.exitCode=1;});
