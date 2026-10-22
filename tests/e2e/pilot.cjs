// Real packaged new-tab override, offline, using disposable Chromium profiles.
// Only clocks are simulated. State changes use visible controls and JSON import.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.KALIMAT_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '../..');
const source = path.resolve(process.env.KALIMAT_EXTENSION_PATH || path.join(root, 'extension/dist/chrome'));
const output = path.resolve(process.env.KALIMAT_E2E_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'kalimat-pilot-results-')));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'kalimat-pilot-'));
const extension = path.join(temporary, 'extension');
const profile = path.join(temporary, 'profile');
const storeMode = process.env.KALIMAT_E2E_STORE === '1';
const result = { checks: [], pageErrors: [], requests: [], limitations: ['Dates are simulated in pages and the service worker.', 'Popup is opened as an extension page; native toolbar placement is not tested.', 'Chromium only; Firefox installation is not exercised.'] };
let context;
let id;
let now = new Date('2026-10-22T12:00:00').getTime();
fs.mkdirSync(output, { recursive: true });
function installClock(timestamp) {
  globalThis.__pilotNow = timestamp;
  const RealDate = globalThis.__pilotRealDate || Date;
  globalThis.__pilotRealDate = RealDate;
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [globalThis.__pilotNow])); }
    static now() { return globalThis.__pilotNow; }
  };
}
const check = label => { result.checks.push(label); console.log('PASS', label); };
const readProfile = page => page.evaluate(async () => {
  const reply = await chrome.runtime.sendMessage({ type: 'state.export' });
  if (reply.kind !== 'export' || reply.storageWarning) throw new Error('Profile export failed');
  return JSON.parse(reply.text);
});
async function start(directory = profile) {
  context = await chromium.launchPersistentContext(directory, {
    executablePath: process.env.KALIMAT_CHROMIUM || '/usr/bin/chromium', headless: true,
    args: ['--password-store=basic', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    viewport: { width: 1280, height: storeMode ? 800 : 900 }, acceptDownloads: true,
  });
  context.on('page', page => page.on('pageerror', error => result.pageErrors.push(error.message)));
  context.on('request', request => { if (/^https?:/.test(request.url())) result.requests.push(request.url()); });
  await context.setOffline(true);
  await context.addInitScript(installClock, now);
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  id = new URL(worker.url()).host;
  await worker.evaluate(installClock, now);
}
async function setDate(iso) {
  now = new Date(iso).getTime();
  await context.addInitScript(installClock, now);
  for (const page of context.pages()) await page.evaluate(installClock, now);
  for (const worker of context.serviceWorkers()) await worker.evaluate(installClock, now);
}
async function newTab() {
  if (storeMode) {
    const launcher = await context.newPage();
    await launcher.goto(`chrome-extension://${id}/popup/popup.html`);
    await launcher.locator('#assigned').waitFor({ state: 'visible' });
    const opened = context.waitForEvent('page');
    await launcher.locator('a[href="../newtab/newtab.html"]').click();
    const reader = await opened;
    await reader.locator('#encounter').waitFor({ state: 'visible' });
    await launcher.close();
    return reader;
  }
  const page = await context.newPage();
  await page.goto('chrome://newtab');
  await page.locator('#encounter').waitFor({ state: 'visible' });
  assert.ok(page.url().includes(id), 'Native new-tab must load the extension override');
  return page;
}
async function capture(page, name) { await page.screenshot({ path: path.join(output, name), fullPage: true }); }
async function imported(page, file) {
  await page.goto(`chrome-extension://${id}/atlas/atlas.html?view=settings`);
  await page.locator('#import-file').setInputFiles(file);
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('تم استيراد الملف'));
}
(async () => {
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'))).chrome_url_overrides, storeMode ? undefined : { newtab: 'newtab/newtab.html' });
  fs.cpSync(source, extension, { recursive: true });
  await start();
  let page = await newTab();
  const firstWord = await page.locator('#word').innerText();
  assert.equal((await readProfile(page)).pilot.encounters['2026-10-22'], 'pilot_minwal');
  assert.equal(await page.locator('#full').isVisible(), true);
  assert.deepEqual(await page.evaluate(async () => (await chrome.permissions.getAll()).origins || []), []);
  check(storeMode ? 'store package leaves new-tab override absent; popup opens the offline reading page without host permissions' : 'native new-tab shows the full approved daily encounter offline without host permissions');
  if (storeMode) await page.emulateMedia({ reducedMotion: 'reduce' });
  await capture(page, 'newtab-full.png');
  const lightBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(previous => getComputedStyle(document.body).backgroundColor !== previous, lightBackground);
  const darkBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await capture(page, 'newtab-dark.png');
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.waitForFunction(previous => getComputedStyle(document.body).backgroundColor !== previous, darkBackground);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await capture(page, 'newtab-390.png');
  await page.setViewportSize({ width: 320, height: 700 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({ width: 1280, height: 900 });
  check('new-tab follows system light/dark and fits 390px and 320px with reduced motion');
  const fixture = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/source-backup.json')));
  fixture.assignments['2026-10-22'] = { wordId: 196 };
  fixture.assignmentOrdinal = 2;
  const fixturePath = path.join(output, 'legacy-input.json');
  fs.writeFileSync(fixturePath, JSON.stringify(fixture));
  let atlas = await context.newPage();
  await imported(atlas, fixturePath);
  await page.reload();
  await page.locator('#full').waitFor({ state: 'visible' });
  let state = await readProfile(page);
  for (const key of ['assignments', 'favorites', 'srs', 'wordStates']) assert.deepEqual(state[key], fixture[key]);
  for (const [key, value] of Object.entries(fixture.history)) assert.deepEqual(state.history[key], value);
  for (const [key, value] of Object.entries(fixture.wordSnapshots)) assert.deepEqual(state.wordSnapshots[key], value);
  await atlas.locator('#today').click();
  assert.equal((await atlas.locator('#today-card h3').innerText()).trim(), firstWord);
  await atlas.locator('#today-card details').filter({ hasText: 'مثال وتفاصيل الاستعمال' }).locator('summary').click();
  assert.ok(await atlas.locator('#today-card a[href*="arabicacademy.gov.eg"]').isVisible());
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 380, height: 650 });
  await popup.goto(`chrome-extension://${id}/popup/popup.html`);
  await popup.locator('#assigned').waitFor({ state: 'visible' });
  assert.equal((await popup.locator('#word').innerText()).trim(), firstWord);
  assert.ok(await popup.locator('#source-attribution a').isVisible());
  await capture(popup, 'popup-pilot.png');
  await popup.close();
  check('popup and Atlas show the same pilot entry and its dictionary source');
  await atlas.locator('#history').click();
  assert.equal(await atlas.locator('[data-history-key^="day:2026-10-22:"]').count(), 2);
  await atlas.locator('[data-history-key="day:2026-10-22:196"]').click();
  await atlas.locator('#explore-card').waitFor({ state: 'visible' });
  assert.equal((await readProfile(atlas)).assignments['2026-10-22'].wordId, 196);
  check('legacy backup retains saved data and both legacy and pilot same-date history remain accessible');
  await page.locator('#save').click();
  await page.waitForFunction(() => document.querySelector('#save').getAttribute('aria-pressed') === 'true');
  await page.locator('#dismiss').focus();
  await page.keyboard.press('Enter');
  await page.locator('#reopen').waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'reopen');
  assert.equal(await page.locator('#full').isVisible(), false);
  await capture(page, 'newtab-compact.png');
  const another = await newTab();
  await another.locator('#reopen').waitFor({ state: 'visible' });
  await another.locator('#reopen').click();
  await another.locator('#full').waitFor({ state: 'visible' });
  assert.equal(await another.locator('#save').getAttribute('aria-pressed'), 'true');
  await another.close();
  check('keyboard dismissal becomes a compact reminder across tabs; reopening preserves saving');
  await context.close(); context = null;
  await start(); page = await newTab();
  await page.locator('#reopen').waitFor({ state: 'visible' });
  state = await readProfile(page);
  assert.equal(state.favorites.pilot_minwal, true);
  assert.deepEqual(state.assignments, fixture.assignments);
  check('dismissal, saved pilot word, and existing history survive browser restart');
  await setDate('2026-10-23T00:01:00');
  await page.reload();
  await page.locator('#full').waitFor({ state: 'visible' });
  assert.equal((await readProfile(page)).pilot.encounters['2026-10-23'], 'pilot_kazm');
  assert.equal(await page.locator('#recall').isVisible(), false);
  await setDate('2026-10-24T12:00:00');
  await page.reload();
  await page.locator('#recall').waitFor({ state: 'visible' });
  await page.locator('#reveal').click();
  await page.locator('#recall-answer').waitFor({ state: 'visible' });
  await capture(page, 'newtab-recall.png');
  await page.locator('#skip').click();
  await page.locator('#recall').waitFor({ state: 'hidden' });
  await page.reload();
  await page.locator('#encounter').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#recall').isVisible(), false);
  assert.deepEqual((await readProfile(page)).srs, fixture.srs);
  check('new day restores full entry; occasional recall can reveal or skip without a review backlog');
  await setDate('2026-11-05T12:00:00');
  await page.reload();
  await page.locator('#full').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#word').innerText(), firstWord);
  check('exhausted fourteen-day reserve revisits approved content');
  atlas = await context.newPage();
  await atlas.goto(`chrome-extension://${id}/atlas/atlas.html?view=settings`);
  const downloadPromise = atlas.waitForEvent('download');
  await atlas.locator('#export').click();
  const backup = path.join(output, 'pilot-backup.json');
  await (await downloadPromise).saveAs(backup);
  const exported = JSON.parse(fs.readFileSync(backup));
  atlas.once('dialog', dialog => dialog.accept());
  await atlas.locator('#clear').click();
  await atlas.waitForFunction(async () => !JSON.parse((await chrome.runtime.sendMessage({ type: 'state.export' })).text).favorites.pilot_minwal);
  await imported(atlas, backup);
  state = await readProfile(atlas);
  for (const key of ['assignments', 'favorites', 'srs', 'wordStates', 'wordSnapshots', 'pilot']) assert.deepEqual(state[key], exported[key]);
  check('visible export, clear, and import round-trip both old data and pilot state');
  await context.close(); context = null;
  await start(path.join(temporary, 'second-profile')); page = await newTab();
  assert.equal(await page.locator('#word').innerText(), firstWord);
  assert.equal(await page.locator('#full').isVisible(), true);
  assert.equal(await page.locator('#recall').isVisible(), false);
  check('another fresh profile gets the same calendar entry without recalling unseen words');
  assert.deepEqual(result.pageErrors, []);
  assert.deepEqual(result.requests, []);
  check('offline workflow has no page errors or external requests');
})().catch(async error => {
  result.error = error.stack; console.error(error); process.exitCode = 1;
  if (context) for (const [index, page] of context.pages().entries()) await capture(page, `failure-${index}.png`).catch(() => {});
}).finally(async () => {
  if (context) await context.close();
  fs.rmSync(temporary, { recursive: true, force: true });
  result.profileRemoved = !fs.existsSync(profile);
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(result, null, 2) + '\n');
  console.log('OUTPUT', output);
});
