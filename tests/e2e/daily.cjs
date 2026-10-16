// Actual packaged extension, offline, in a disposable Chromium profile.
// Only clocks are overridden. Learner state is created through visible controls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.KALIMAT_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '../..');
const source = path.resolve(process.env.KALIMAT_EXTENSION_PATH || path.join(root, 'extension/dist/chrome'));
const output = path.resolve(process.env.KALIMAT_E2E_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'kalimat-daily-results-')));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'kalimat-daily-'));
const profile = path.join(temporary, 'profile');
const extension = path.join(temporary, 'extension');
const result = { checks: [], pageErrors: [], requests: [], limitations: ['Popup is rendered as an extension page, not a physical toolbar popup.', 'File import uses the browser file input; the native file picker is not exercised.', 'Dates are simulated in the page and service worker.'] };
fs.mkdirSync(output, { recursive: true });
let context;
let id;
let now = new Date('2026-10-17T12:00:00').getTime();
const fixturePath = path.resolve(process.env.KALIMAT_E2E_SOURCE_BACKUP || path.join(root, 'tests/fixtures/source-backup.json'));
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
result.fixture = { path: fixturePath, provenance: process.env.KALIMAT_E2E_SOURCE_BACKUP ? 'Imported source-backed replay fixture; cached verification, not a fresh live fetch.' : 'Imported previous disposable live-source backup; cached verification, not a fresh live fetch.' };
const check = label => { result.checks.push(label); console.log('PASS', label); };
// Shared controllable Date implementation, without changes to application state.
function installClock(timestamp) {
  globalThis.__kalimatE2ENow = timestamp;
  const RealDate = globalThis.__kalimatE2ERealDate || Date;
  globalThis.__kalimatE2ERealDate = RealDate;
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [globalThis.__kalimatE2ENow])); }
    static now() { return globalThis.__kalimatE2ENow; }
  };
}
const readProfile = page => page.evaluate(async () => {
  const exported = await chrome.runtime.sendMessage({ type: 'state.export' });
  if (exported.kind !== 'export' || exported.storageWarning) throw new Error('Profile export failed');
  return JSON.parse(exported.text);
});
async function start() {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.KALIMAT_CHROMIUM || '/usr/bin/chromium', headless: true,
    args: ['--password-store=basic', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    viewport: { width: 1280, height: 900 }, acceptDownloads: true,
  });
  context.on('page', page => page.on('pageerror', error => result.pageErrors.push(error.message)));
  context.on('request', request => { if (/^https?:/.test(request.url())) result.requests.push(request.url()); });
  await context.setOffline(true);
  await context.addInitScript(installClock, now);
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 15000 });
  id = new URL(worker.url()).host;
  await worker.evaluate(installClock, now);
}
async function setDate(localISO) {
  now = new Date(localISO).getTime();
  await context.addInitScript(installClock, now);
  for (const page of context.pages()) await page.evaluate(installClock, now);
  for (const worker of context.serviceWorkers()) await worker.evaluate(installClock, now);
}
async function open(page, surface) {
  await page.goto(`chrome-extension://${id}/${surface}/${surface}.html`);
  await page.locator(surface === 'popup' ? '#assigned:visible, #empty:visible, #daily-source-setup:visible' : '#today-card:visible, #today-empty:visible, #today-source-setup:visible').first().waitFor();
}
async function screenshot(page, name) { await page.screenshot({ path: path.join(output, name), fullPage: true }); }
(async () => {
  assert.ok(fs.existsSync(path.join(source, 'manifest.json')), 'KALIMAT_EXTENSION_PATH must point to an unpacked Chrome package');
  fs.cpSync(source, extension, { recursive: true });
  await start();
  let popup = await context.newPage();
  await popup.setViewportSize({ width: 380, height: 600 });
  await open(popup, 'popup');
  await popup.locator('#daily-source-setup').waitFor({ state: 'visible' });
  let state = await readProfile(popup);
  assert.deepEqual(state.assignments, {});
  assert.deepEqual(await popup.evaluate(async () => (await chrome.permissions.getAll()).origins || []), []);
  await popup.locator('#daily-source-offline').click();
  await popup.locator('#empty').waitFor({ state: 'visible' });
  assert.deepEqual((await readProfile(popup)).assignments, {});
  check('fresh offline consent creates no daily assignment; declining sources honestly shows unavailable');
  const importer = await context.newPage();
  await importer.goto(`chrome-extension://${id}/atlas/atlas.html?view=settings`);
  await importer.locator('#import-file').setInputFiles(fixturePath);
  await importer.waitForFunction(() => document.querySelector('#status').textContent.includes('تم استيراد الملف'));
  await importer.close();
  await popup.reload();
  await popup.locator('#assigned').waitFor({ state: 'visible' });
  const word = (await popup.locator('#word').innerText()).trim();
  state = await readProfile(popup);
  const day = '2026-10-17';
  const wordId = state.assignments[day].wordId;
  const assignedCard = state.wordSnapshots[wordId];
  if (assignedCard.senseContext) assert.ok((await popup.locator('#sense-context').innerText()).includes(assignedCard.senseContext));
  assert.equal(state.wordSnapshots[wordId].contentVersion, 3);
  assert.deepEqual(state.assignments['2026-10-16'], fixture.assignments['2026-10-16']);
  assert.deepEqual(state.favorites, fixture.favorites);
  assert.deepEqual(state.history, fixture.history);
  assert.deepEqual(state.srs, fixture.srs);
  check('UI-imported historical backup supplies a real cached source word and preserves prior learner data');
  assert.equal(await popup.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  check('popup has no horizontal overflow at 380px; full-page capture includes source-consent disclosure');
  await screenshot(popup, 'popup-fresh.png');
  await popup.locator('#save').click();
  await popup.waitForFunction(() => document.querySelector('#save').getAttribute('aria-pressed') === 'true');
  await popup.close();
  popup = await context.newPage();
  await popup.setViewportSize({ width: 380, height: 600 });
  await open(popup, 'popup');
  await popup.waitForFunction(() => document.querySelector('#save').getAttribute('aria-pressed') === 'true');
  assert.equal((await popup.locator('#word').innerText()).trim(), word);
  let atlas = await context.newPage();
  await open(atlas, 'atlas');
  assert.equal((await atlas.locator('#today-card h3').innerText()).trim(), word);
  await atlas.waitForFunction(() => document.querySelector('#today-save').getAttribute('aria-pressed') === 'true');
  assert.equal(await atlas.locator('#today-source-summary').isVisible(), true);
  if (assignedCard.senseContext) {
    assert.ok((await atlas.locator('#today-card .sense-context').innerText()).includes(assignedCard.senseContext));
    const construction = await atlas.locator('#today-card .sense-context').boundingBox();
    const meaning = await atlas.locator('#today-card > .meaning').boundingBox();
    assert.ok(construction.y + construction.height <= meaning.y, 'Source construction must appear before its dependent definition');
  }
  check('saved word survives popup reopen and matches Atlas');
  await screenshot(atlas, 'atlas-fresh.png');
  await atlas.locator('.today-feedback summary').click();
  await atlas.locator('#today-difficult').click();
  await atlas.waitForFunction(() => document.querySelector('#today-difficult').getAttribute('aria-pressed') === 'true');
  state = await readProfile(atlas);
  assert.equal(state.srs[wordId].nextReviewDate, '2026-10-18');
  check('visible difficult feedback enrolls the word for tomorrow');
  await setDate('2026-10-18T23:59:00');
  await atlas.reload();
  await atlas.locator('#today-empty').waitFor({ state: 'visible' });
  await atlas.locator('#due-review-badge').waitFor({ state: 'visible' });
  const staleTitle = await atlas.locator('#today-empty').innerText();
  await setDate('2026-10-19T00:01:00');
  // Keep Atlas open; its displayed unavailable state intentionally remains from Oct 18.
  assert.equal(await atlas.locator('#today-empty').innerText(), staleTitle);
  await atlas.locator('#due-review-badge').click();
  await atlas.locator('#card-front-flip').click();
  if (assignedCard.senseContext) assert.ok((await atlas.locator('#card-back-meaning-ar').innerText()).includes(assignedCard.senseContext));
  await atlas.locator('#rate-good').click();
  await atlas.waitForFunction(async id => {
    const value = JSON.parse((await chrome.runtime.sendMessage({ type: 'state.export' })).text);
    return value.srs[id]?.lastReviewedDate === '2026-10-19';
  }, wordId);
  state = await readProfile(atlas);
  assert.equal(state.srs[wordId].history.at(-1).date, '2026-10-19');
  assert.equal(state.srs[wordId].nextReviewDate, '2026-10-20');
  check('visible review control on stale Atlas commits after local midnight on the new day');
  await screenshot(atlas, 'atlas-midnight-review.png');
  await atlas.locator('#practice-close').click();
  await atlas.locator('#settings').focus();
  await atlas.keyboard.press('Enter');
  await atlas.locator('#discovery-enable').waitFor();
  check('keyboard Enter opens settings through the existing button');
  assert.equal(await atlas.locator('#discovery-disable').isVisible(), true);
  check('settings retain imported source preference and disclose missing host permission');
  await screenshot(atlas, 'atlas-settings.png');
  await atlas.setViewportSize({ width: 390, height: 844 });
  assert.equal(await atlas.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Settings must not overflow horizontally at 390px');
  await atlas.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await atlas.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
  await atlas.locator('#discovery-enable').waitFor();
  await screenshot(atlas, 'atlas-settings-390.png');
  check('390px settings has no horizontal overflow and stays usable with reduced motion');
  await atlas.setViewportSize({ width: 1280, height: 900 });
  const downloadPromise = atlas.waitForEvent('download');
  await atlas.locator('#export').click();
  const download = await downloadPromise;
  const exportedFile = path.join(output, 'learner-export.json');
  await download.saveAs(exportedFile);
  const exported = JSON.parse(fs.readFileSync(exportedFile, 'utf8'));
  assert.equal(exported.srs[wordId].lastReviewedDate, '2026-10-19');
  atlas.once('dialog', dialog => dialog.accept());
  await atlas.locator('#clear').click();
  await atlas.waitForFunction(async () => Object.keys(JSON.parse((await chrome.runtime.sendMessage({ type: 'state.export' })).text).srs).length === 0);
  await atlas.locator('#settings').click();
  await atlas.locator('#import-file').setInputFiles(exportedFile);
  await atlas.waitForFunction(() => document.querySelector('#status').textContent.includes('تم استيراد الملف'));
  state = await readProfile(atlas);
  assert.deepEqual(state.srs[wordId], exported.srs[wordId]);
  assert.equal(state.favorites[wordId], true);
  check('UI JSON export, clear and import restore saved word and review');
  await context.close(); context = null;
  await start();
  atlas = await context.newPage();
  await open(atlas, 'atlas');
  state = await readProfile(atlas);
  assert.deepEqual(state.srs[wordId], exported.srs[wordId]);
  assert.equal(state.favorites[wordId], true);
  assert.equal(state.discovery.enabled, true);
  assert.deepEqual(state.wordSnapshots, exported.wordSnapshots);
  assert.deepEqual(state.assignments, exported.assignments);
  for (const [key, value] of Object.entries(fixture.favorites)) assert.deepEqual(state.favorites[key], value);
  check('imported saved word and review survive Chromium restart');
  const vocabulary = JSON.parse(fs.readFileSync(path.join(extension, 'data/vocabulary.json'), 'utf8'));
  const legacy = vocabulary.find(item => item.editorialChecked === false);
  if (legacy) {
    await atlas.locator('#explore').click();
    await atlas.locator('#atlas-search').fill(legacy.word);
    await atlas.locator('#search-results button').filter({ hasText: legacy.word }).first().click();
    await atlas.locator('#explore-card .source-note').filter({ hasText: 'من المجموعة السابقة' }).waitFor();
    await screenshot(atlas, 'atlas-legacy-warning.png');
    check('archived vocabulary remains accessible with its review warning');
  } else {
    result.limitations.push('Package has no editorialChecked:false legacy entry; archive warning check was unavailable.');
  }
  assert.deepEqual(result.pageErrors, []);
  assert.deepEqual(result.requests, [], 'Default offline workflow must make no external network request');
  check('no page errors or external requests during the offline imported-fixture workflow');
})().catch(async error => {
  result.error = error.stack; console.error(error); process.exitCode = 1;
  if (context) for (const [index, page] of context.pages().entries()) {
    await page.screenshot({ path: path.join(output, `failure-${index}.png`), fullPage: true }).catch(() => {});
  }
}).finally(async () => {
  try { if (context) await context.close(); } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
    result.profileRemoved = !fs.existsSync(profile);
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(result, null, 2) + '\n');
    console.log('OUTPUT', output);
  }
});
