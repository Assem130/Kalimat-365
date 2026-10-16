// Frozen-corpus supply check. Retrieval success does not certify Arabic correctness.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const d = require(process.env.KALIMAT_SUPPLY_DISCOVERY ? path.resolve(process.env.KALIMAT_SUPPLY_DISCOVERY) : '../../extension/shared/discovery');
const v = require('../../extension/shared/vocabulary');
const index = process.env.KALIMAT_SUPPLY_INDEX ? require(path.resolve(process.env.KALIMAT_SUPPLY_INDEX))
  : d.mergeIndexes(require('../../extension/data/discovery-index.json'), require('../../extension/data/lmf-index.json'));
// Match real request queries to frozen responses; never return an unrelated topic.
const queries = {science:'البحث العلمي',culture:'الفنون والأدب',society:'المجتمع والتعليم',
  environment:'حماية البيئة',economics:'الاقتصاد والعمل',language:'اللغة والترجمة'};
const corpora = {
  original: require('../fixtures/discovery-passages.json'),
  heldout: require('../fixtures/discovery-heldout-passages.json'),
};
const seeds = ['supply-alpha', 'supply-beta', 'supply-gamma'];
const days = 30;
const minimumFound = 27; // Fixed before supply expansion; do not tune to results.
const reportOnly = process.argv.includes('--report-only');
const outputArg = process.argv.find(arg => arg.startsWith('--output='));
const output = outputArg?.slice('--output='.length) || process.env.KALIMAT_SUPPLY_OUTPUT;
const dateKey = day => new Date(Date.UTC(2026, 9, 16 + day)).toISOString().slice(0, 10);
const lexical = words => new Set(words.map(d.lexicalKey));
function batches(passages) {
  return [...new Set(passages.map(p => p.topic))].map(topic => ({topic,
    pages: passages.filter(p => p.topic === topic).slice(0, d.LIMITS.passages).map(p => {
      assert.ok(Number.isSafeInteger(p.revision) && p.url.endsWith(`oldid=${p.revision}`));
      return {title:p.title, pageid:p.pageid, lastrevid:p.revision, extract:p.passage};
    }),
  }));
}
async function retrieve(batchList, seen, day, seedHex) {
  const requests = [];
  const topics = batchList.map(batch => batch.topic);
  let routingError;
  const result = await d.discover({index, excludeKeys:seen, topics,
    dateKey:dateKey(day), seedHex, fetchFn:async request => {
      const url = new URL(request);
      const query = url.searchParams.get('gsrsearch');
      const batch = batchList.find(batch => queries[batch.topic] === query);
      if (!batch) { routingError = `Unexpected replay query: ${query}`; throw Error(routingError); }
      requests.push({topic:batch.topic, query, offset:url.searchParams.get('gsroffset'),
        sourcePages:batch.pages.map(p => ({pageid:p.pageid,revisionId:p.lastrevid}))});
      return new Response(JSON.stringify({query:{pages:batch.pages}}),{headers:{'content-type':'application/json'}});
    }});
  assert.equal(routingError, undefined);
  assert.notEqual(result.kind, 'unavailable', 'Attributed local replay cannot fail as a network outage');
  if (result.word) {
    v.validateDiscoveryCard(result.word);
    assert.ok(d.isEligibleSnapshot(result.word, index), 'Returned lesson must retain production eligibility');
    assert.ok(!lexical(seen).has(d.lexicalKey(result.word.word)), 'Repeated encountered lexical word');
    assert.equal(result.word.reviewed, false);
    seen.push(result.word.word);
  }
  return {dateKey:dateKey(day), selectedTopics:topics, requests, ...result};
}
async function pool(batchList) {
  // Exhaust the fixed replay routes, rather than treating catalog rows as lessons.
  // This is a reachable-pool measurement for this corpus, not the live web ceiling.
  const seen = [], lessons = [];
  for (let round = 0; round <= index.length; round++) {
    let added = 0;
    for (const batch of batchList) {
      const result = await retrieve([batch], seen, 0, 'supply-pool');
      if (result.word) { lessons.push(result.word); added++; }
    }
    if (!added) return {count:lessons.length, exhausted:true, lessons};
  }
  throw Error('Replay pool did not exhaust within catalog bound');
}
(async () => {
  const originalIds = new Set(corpora.original.map(p => p.pageid));
  assert.ok(corpora.heldout.every(p => !originalIds.has(p.pageid)), 'Heldout corpus must remain separate');
  const report = {days, minimumFound, seeds, reportOnly,
    engine:process.env.KALIMAT_SUPPLY_DISCOVERY || 'current',index:process.env.KALIMAT_SUPPLY_INDEX || 'current merged catalog',
    limits:'All corpus interests selected together. Requests route by actual search query to frozen topic batches; offsets are recorded but replay the same batch. Simulated dates; semantic correctness and live-network supply remain unproven.',
    corpora:{}, passed:true};
  for (const [name, passages] of Object.entries(corpora)) {
    const batchList = batches(passages);
    const initialPool = await pool(batchList);
    const runs = [];
    for (const seed of seeds) {
      const seen = [], results = [];
      for (let day = 0; day < days; day++) {
        results.push(await retrieve(batchList, seen, day, seed));
      }
      let longestEmptyStreak = 0, streak = 0;
      for (const result of results) { streak = result.word ? 0 : streak + 1; longestEmptyStreak = Math.max(longestEmptyStreak, streak); }
      const found = results.filter(result => result.word).length;
      const passed = found >= minimumFound;
      runs.push({seed, found, empty:days-found, longestEmptyStreak, passed, results});
      report.passed &&= passed;
      console.log(`${name} ${seed}: ${found}/${days}, longest empty streak ${longestEmptyStreak}; ${passed ? 'PASS' : 'FAIL'}`);
    }
    report.corpora[name] = {passages:passages.length, topics:batchList.map(b => b.topic), initialPool, runs};
    console.log(`${name}: ${initialPool.count} distinct eligible lessons reachable from a fresh profile.`);
  }
  if (output) fs.writeFileSync(output, JSON.stringify(report,null,2)+'\n');
  if (!report.passed && !reportOnly) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
