// Real extension E2E: accept the native permission prompt in the disposable window.
// No source responses, learner data, permissions or assignments are injected.
// Later dates use a worker-only clock so the real assignment engine runs each day.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.KALIMAT_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '../..');
const extension = path.join(root, 'extension/dist/chrome');
const output = process.env.KALIMAT_E2E_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'kalimat-e2e-results-'));
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kalimat-e2e-profile-'));
const origins = ['https://ar.wikipedia.org/*', 'https://ar.wiktionary.org/*'];
const result = { checks: [], network: [], pageErrors: [], dates: [], profileRemoved: false };
const check = label => { result.checks.push(label); console.log('PASS', label); };
let context;
let id;
let clockOffset = 0;
let firstDate;
const launch = (headless = false, profilePath = profile) => chromium.launchPersistentContext(profilePath, {
  executablePath: process.env.KALIMAT_CHROMIUM || '/usr/bin/chromium', headless,
  args: ['--password-store=basic', '--ozone-platform=x11', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  viewport: { width: 1280, height: 900 }, acceptDownloads: true,
});
const readProfile = page => page.evaluate(async () => {
  const value = await chrome.runtime.sendMessage({ type: 'state.export' });
  if (value.kind !== 'export' || value.storageWarning) throw new Error('Profile export failed');
  return JSON.parse(value.text);
});
const permissions = page => page.evaluate(async () => (await chrome.permissions.getAll()).origins || []);
function observeContext() {
  context.on('response', response => {
    if (/^https:\/\/ar\.(wikipedia|wiktionary)\.org\//.test(response.url())) result.network.push({ url: response.url(), status: response.status() });
  });
  context.on('page', page => page.on('pageerror', error => result.pageErrors.push(error.message)));
}
async function worker() {
  return context.serviceWorkers()[0] || context.waitForEvent('serviceworker', { timeout: 15000 });
}
function installDay({ firstDate, offset }) {
  const RealDate = globalThis.__e2eRealDate || Date;
  globalThis.__e2eRealDate = RealDate;
  const target = new RealDate(`${firstDate}T12:00:00`);
  target.setDate(target.getDate() + offset);
  const delta = target.getTime() - RealDate.now();
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [RealDate.now() + delta])); }
    static now() { return RealDate.now() + delta; }
  };
}
async function setDay(offset) {
  clockOffset = offset;
  const clock = { firstDate, offset };
  await context.addInitScript(installDay, clock);
  await (await worker()).evaluate(installDay, clock);
  for (const page of context.pages()) await page.evaluate(installDay, clock);
  const dateKey = await (await worker()).evaluate(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  result.dates.push({ offset, dateKey, simulated: true });
  return dateKey;
}
async function atlas(page) {
  await page.goto(`chrome-extension://${id}/atlas/atlas.html`);
  await page.locator('#today-card h3').waitFor({ timeout: 90000 });
}
async function daily(page, dateKey) {
  const current = await readProfile(page);
  const assigned = current.assignments[dateKey];
  assert.ok(assigned, `Missing daily assignment for ${dateKey}`);
  const card = current.wordSnapshots?.[String(assigned.wordId)];
  assert.ok(card, `Expected a live sourced daily word for ${dateKey}, got ${assigned.wordId}: ${await page.locator('#today-card').innerText()}`);
  assert.equal(card.contentVersion, 3);
  assert.match(card.word, /[\u0621-\u064a]/);
  assert.ok(card.meaningAr?.trim() && card.exampleAr?.trim(), 'Daily word needs an Arabic definition and example');
  require(path.join(root, "extension/shared/vocabulary.js")).validateDiscoveryCard(card);
  if (card.senseContext) assert.ok((await page.locator("#today-card").innerText()).includes(card.senseContext));
  assert.ok(card.exampleSource?.url, 'Example needs a source link');
  assert.equal(await page.locator('#today-card h3').innerText(), card.word);
  assert.ok((await page.locator('#today-card').innerText()).includes(card.meaningAr));
  return { current, card };
}
async function popupWord(card, file) {
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 380, height: 600 });
  await popup.goto(`chrome-extension://${id}/popup/popup.html`);
  await popup.waitForFunction(word => document.querySelector('#word')?.textContent === word, card.word);
  assert.equal(await popup.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  if (file) await popup.screenshot({ path: path.join(output, file), fullPage: true });
  await popup.close();
}
(async () => {
  try {
    for (const name of ['background.js', 'shared/discovery.js', 'shared/state.js', 'atlas/atlas.js', 'atlas/atlas.html', 'popup/popup.js', 'popup/popup.html']) {
      assert.deepEqual(fs.readFileSync(path.join(extension, name)), fs.readFileSync(path.join(root, 'extension', name)), `Stale package: ${name}`);
    }
    // A separate fresh profile exercises the explicit offline choice. Its data
    // never enters the real-grant profile used for the source checks below.
    const offlineProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'kalimat-e2e-offline-'));
    let offlineContext;
    try {
      offlineContext = await launch(true, offlineProfile);
      const offlineWorker = offlineContext.serviceWorkers()[0] || await offlineContext.waitForEvent('serviceworker');
      const offlineId = new URL(offlineWorker.url()).host;
      const offlinePopup = await offlineContext.newPage();
      await offlineContext.setOffline(true);
      await offlinePopup.goto(`chrome-extension://${offlineId}/popup/popup.html`);
      await offlinePopup.locator('#daily-source-setup').waitFor({ state: 'visible' });
      assert.deepEqual((await readProfile(offlinePopup)).assignments, {});
      await offlinePopup.locator('#daily-source-offline').click();
      await offlinePopup.locator('#empty').waitFor({ state: 'visible' });
      const offlineState = await readProfile(offlinePopup);
      assert.notEqual(offlineState.discovery?.enabled, true);
      assert.deepEqual(offlineState.assignments, {});
      assert.deepEqual(await permissions(offlinePopup), []);
      check('Fresh popup requires consent; offline choice honestly shows unavailable without assignments or grants');
    } finally {
      if (offlineContext) await offlineContext.close();
      fs.rmSync(offlineProfile, { recursive: true, force: true });
    }
    context = await launch(); observeContext();
    id = new URL((await worker()).url()).host; result.extensionId = id;
    let page = await context.newPage();
    await page.goto(`chrome-extension://${id}/atlas/atlas.html`);
    await page.locator('#today-source-start').waitFor({ state: 'visible' });
    assert.deepEqual(await permissions(page), []);
    const initial = await readProfile(page);
    assert.notEqual(initial.discovery?.enabled, true);
    assert.deepEqual(initial.assignments, {});
    firstDate = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
    result.dates.push({offset: 0, dateKey: firstDate, simulated: false});
    const freshPopup = await context.newPage();
    await freshPopup.goto(`chrome-extension://${id}/popup/popup.html`);
    await freshPopup.locator('#daily-source-setup').waitFor({ state: 'visible' });
    assert.deepEqual((await readProfile(freshPopup)).assignments, {});
    await freshPopup.close();
    check('Fresh Atlas and popup show consent before any daily assignment or host grant');
    await page.locator('#settings').click();
    console.log('Accept the Wikipedia/Wiktionary prompt in the disposable test window if shown.');
    await page.locator('#discovery-enable').click();
    await page.locator('#discovery-disable').waitFor({ timeout: Number(process.env.KALIMAT_PERMISSION_TIMEOUT_MS) || 120000 });
    assert.deepEqual((await permissions(page)).sort(), origins);
    await atlas(page);
    const first = await daily(page, firstDate);
    result.dailyWord = first.card;
    assert.equal(first.current.discovery.enabled, true);
    assert.equal(Object.keys(first.current.assignments).length, 1);
    assert.ok(result.network.some(item => item.status === 200), 'Expected real Wikimedia HTTP success');
    check('Real consent automatically loads the first live sourced daily word');
    // Native permission prompts need a visible window. All remaining work is headless.
    await context.close(); context = await launch(true); observeContext();
    await setDay(0);
    page = await context.newPage(); await atlas(page);
    assert.deepEqual((await permissions(page)).sort(), origins);
    assert.equal((await daily(page, firstDate)).card.id, first.card.id);
    await popupWord(first.card, 'popup-380.png');
    check('Restart and popup retain the same daily source word and real grants');
    await page.locator('#today-save').click();
    await page.waitForFunction(() => document.querySelector('#today-save').getAttribute('aria-pressed') === 'true');
    const saved = await readProfile(page);
    assert.equal(saved.favorites[first.card.id], true);
    await page.locator('details.today-feedback summary').click();
    await page.locator('#today-known').click();
    await page.waitForFunction(() => document.querySelector('#today-known').getAttribute('aria-pressed') === 'true');
    const known = await readProfile(page);
    assert.deepEqual(known.favorites, saved.favorites);
    assert.deepEqual(known.srs, saved.srs);
    assert.deepEqual(known.assignments, saved.assignments);
    assert.equal(known.discovery.knownKeys.length, saved.discovery.knownKeys.length + 1);
    await page.reload(); await page.locator('#today-card h3').waitFor();
    assert.equal(await page.locator('#today-known').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#today-save').getAttribute('aria-pressed'), 'true');
    await page.screenshot({ path: path.join(output, 'atlas-1280.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(output, 'atlas-390.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    check('Main daily save and known persist after reload, preserve review state, and fit desktop/mobile');
    const nextDate = await setDay(1);
    await atlas(page);
    const next = await daily(page, nextDate);
    assert.notEqual(next.card.id, first.card.id);
    assert.deepEqual(next.current.favorites, known.favorites);
    assert.deepEqual(next.current.srs, known.srs);
    await popupWord(next.card);
    result.nextDailyWord = next.card;
    check('Next simulated day automatically obtains a different live source word with popup parity');
    await page.locator('#settings').click();
    await page.locator('#discovery-disable').click();
    await page.locator('#discovery-enable').waitFor();
    assert.equal((await readProfile(page)).discovery.enabled, false);
    await context.setOffline(true);
    const offlineDate = await setDay(3);
    await page.goto(`chrome-extension://${id}/atlas/atlas.html`);
    await page.locator('#today-empty').waitFor({ state: 'visible' });
    const beforeEnable = await readProfile(page);
    assert.equal(beforeEnable.assignments[offlineDate], undefined);
    assert.deepEqual(beforeEnable.favorites, next.current.favorites);
    assert.deepEqual(beforeEnable.srs, next.current.srs);
    await page.locator('#settings').click();
    await page.locator('#discovery-enable').click();
    await page.waitForFunction(async () => {
      const profile = JSON.parse((await chrome.runtime.sendMessage({ type: 'state.export' })).text);
      return profile.discovery.enabled === true && !document.querySelector('#discovery-disable').disabled;
    });
    await page.locator('#today-empty').waitFor({ state: 'visible' });
    const afterEnable = await readProfile(page);
    assert.equal(afterEnable.discovery.enabled, true);
    assert.deepEqual(afterEnable.assignments, beforeEnable.assignments);
    assert.deepEqual(afterEnable.favorites, beforeEnable.favorites);
    assert.deepEqual(afterEnable.srs, beforeEnable.srs);
    check('Offline later day creates no bundled assignment and preserves earlier source words and learner state');
    // Configuring sources without a current word returns to Today.
    // Reopen settings after each completed action before using its controls.
    await page.locator('#settings').click();
    await page.locator('#discovery-disable').click();
    await page.waitForFunction(async () => {
      const profile = JSON.parse((await chrome.runtime.sendMessage({ type: 'state.export' })).text);
      return profile.discovery.enabled === false && !document.querySelector('#discovery-enable').disabled;
    });
    await page.locator('#today-empty').waitFor({ state: 'visible' });
    await page.locator('#settings').click();
    const downloadEvent = page.waitForEvent('download'); await page.locator('#export').click();
    await (await downloadEvent).saveAs(path.join(output, 'backup.json'));
    const backup = JSON.parse(fs.readFileSync(path.join(output, 'backup.json'), 'utf8'));
    assert.equal(backup.favorites[first.card.id], true);
    await page.goto(`chrome-extension://${id}/atlas/atlas.html?view=explore&id=${encodeURIComponent(first.card.id)}`);
    await page.locator('#explore-save').waitFor();
    await page.locator('#explore-save').click();
    await page.waitForFunction(() => document.querySelector('#explore-save').getAttribute('aria-pressed') === 'false');
    assert.equal((await readProfile(page)).favorites[first.card.id], undefined);
    await page.locator('#settings').click();
    await page.locator('#import-file').setInputFiles(path.join(output, 'backup.json'));
    await page.waitForFunction(() => document.querySelector('#status').textContent === 'تم استيراد الملف.');
    assert.deepEqual(await readProfile(page), backup);
    check('UI backup export and import restore the complete learner profile');
    await context.close(); context = await launch(true); observeContext();
    await setDay(clockOffset); await context.setOffline(true);
    page = await context.newPage();
    await page.goto(`chrome-extension://${id}/atlas/atlas.html`);
    await page.locator('#today-empty').waitFor({ state: 'visible' });
    assert.deepEqual(await readProfile(page), backup);
    assert.deepEqual((await permissions(page)).sort(), origins);
    await page.goto(`chrome-extension://${id}/atlas/atlas.html?view=explore&id=${encodeURIComponent(first.card.id)}`);
    await page.locator('#explore-save').waitFor();
    assert.equal(await page.locator('#explore-save').getAttribute('aria-pressed'), 'true');
    assert.ok((await page.locator('#explore-card').innerText()).includes(first.card.meaningAr));
    // A historical daily route uses its persisted assignment while fully offline.
    await page.goto(`chrome-extension://${id}/atlas/atlas.html?date=${firstDate}`);
    await page.locator('#explore-card h3').waitFor();
    assert.equal(await page.locator('#explore-card h3').innerText(), first.card.word);
    assert.deepEqual(await readProfile(page), backup);
    assert.deepEqual(result.pageErrors, []);
    check('Offline restart retains the full profile, source text, saved state and permission grants');
    result.status = 'passed';
  } catch (error) {
    result.status = 'failed'; result.error = error.stack; console.error(error); process.exitCode = 1;
    if (context) for (const [index, page] of context.pages().entries()) {
      await page.screenshot({ path: path.join(output, `failure-${index}.png`), fullPage: true }).catch(() => {});
    }
  } finally {
    if (context) await context.close();
    fs.rmSync(profile, { recursive: true, force: true }); result.profileRemoved = !fs.existsSync(profile);
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    console.log('Evidence:', output);
  }
})();
