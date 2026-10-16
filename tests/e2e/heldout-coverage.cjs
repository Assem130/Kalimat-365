// Replay a separate, revision-attributed corpus. This measures retrieval; it
// does not certify Arabic meanings, proficiency, or semantic topic relevance.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const d = require('../../extension/shared/discovery');
const v = require('../../extension/shared/vocabulary');
const index = d.mergeIndexes(require('../../extension/data/discovery-index.json'), require('../../extension/data/lmf-index.json'));
const passages = require('../fixtures/discovery-heldout-passages.json');
const previous = new Set(require('../fixtures/discovery-passages.json').map(p => p.pageid));
const page = p => ({title:p.title,pageid:p.pageid,lastrevid:p.revision,extract:p.passage});
const replay = pages => async () => new Response(JSON.stringify({query:{pages}}),{headers:{'content-type':'application/json'}});
const options = {index,dateKey:'2026-10-16',seedHex:'heldout'};
(async () => {
  const results = [], daily = [], seen = [];
  for (const p of passages) {
    assert.ok(!previous.has(p.pageid), `Held-out article overlaps original corpus: ${p.title}`);
    assert.ok(Number.isSafeInteger(p.revision) && p.url.endsWith(`oldid=${p.revision}`));
    const result = await d.discover({...options,topics:[p.topic],fetchFn:replay([page(p)])});
    results.push({id:p.id,title:p.title,source:p.url,...result});
  }
  for (const topic of [...new Set(passages.map(p => p.topic))]) {
    const result = await d.discover({...options,topics:[topic],excludeKeys:seen,
      fetchFn:replay(passages.filter(p => p.topic === topic).map(page))});
    if (result.word) seen.push(result.word.word);
    daily.push({topic,...result});
  }
  for (const result of [...results,...daily]) {
    assert.notEqual(result.kind,'unavailable','A local attributed replay must not fail as a network error');
    if (!result.word) continue;
    v.validateDiscoveryCard(result.word);
    assert.ok(d.isEligibleSnapshot(result.word,index));
    assert.equal(result.word.reviewed,false);
    if (result.diagnostics.relatedLessons && !d.extractCandidates(
      passages.filter(p => p.topic === result.word.topics[0]).map(p => ({text:p.passage})),
      [[d.normalizeKey(result.word.word),[result.word.word]]]).length) {
      assert.match(result.word.discoveryReason,/لا يثبت تداخل الألفاظ/);
    }
  }
  const found = results.filter(r => r.word);
  const entries = index.flatMap(row => row[2]);
  const useful = entries.filter(d.isUsefulEntry);
  const report = {passages:passages.length,found:found.length,
    distinctWords:new Set(found.map(r => d.lexicalKey(r.word.word))).size,
    articleExamples:found.filter(r => r.word.exampleSource.url.startsWith(d.ORIGINS[0])).length,
    dailyFound:daily.filter(r => r.word).length,
    catalog:{entries:entries.length,passesFrequencyAndGloss:useful.length,
      withAnySourceExample:useful.filter(e => e.senses.some(s => s.examples.length)).length,
      usableDictionaryExample:useful.filter(e => d.rankDictionaryExample(e,{key:d.normalizeKey(e.title),passages:[]})).length},
    humanCorrectness:'unproven',semanticTopicRelevance:'unproven',results,daily};
  if (process.env.KALIMAT_COVERAGE_OUTPUT) fs.writeFileSync(process.env.KALIMAT_COVERAGE_OUTPUT,JSON.stringify(report,null,2)+'\n');
  console.log(`${report.found}/${report.passages} held-out passages; ${report.distinctWords} distinct words; ${report.articleExamples} article examples; ${report.dailyFound}/${daily.length} non-repeated topic batches.`);
  console.log(JSON.stringify(report.catalog));
})().catch(error => {console.error(error);process.exitCode=1;});
