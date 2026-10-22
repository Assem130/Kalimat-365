// Packaged extension E2E in disposable Chromium profiles.
// Actions use visible UI; only synthetic initial storage, the clock, and
// temporary rejection of background profile writes are controlled by this test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require(process.env.KALIMAT_PLAYWRIGHT_PATH || 'playwright');

const root = path.resolve(process.env.KALIMAT_REPO_ROOT || path.join(__dirname, '../..'));
const source = path.resolve(process.env.KALIMAT_EXTENSION_PATH || path.join(root, 'extension/dist/chrome'));
const output = path.resolve(process.env.KALIMAT_E2E_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'kalimat-recovery-results-')));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'kalimat-recovery-browser-'));
const extension = path.join(temporary, 'extension');
const stateApi = require(path.join(root, 'extension/shared/state.js'));
const vocabulary = JSON.parse(fs.readFileSync(path.join(source, 'data/vocabulary.json'), 'utf8'));
const day = '2026-10-17';
const card = require(path.join(root, 'extension/shared/pilot.js')).forDate(day);
const timestamp = new Date(`${day}T12:00:00Z`).getTime();
const jsonClone = value => JSON.parse(JSON.stringify(value));
const report = {
  cases: [], pageErrors: [], consoleErrors: [], externalRequests: [],
  limitations: [
    'Headless Chrome for Testing; popup rendered as an extension page, not the physical toolbar bubble.',
    'Legacy state is synthetic and seeded directly into real chrome.storage.local in a disposable profile.',
    'Only background profile writes are intentionally rejected; this does not simulate actual disk or quota exhaustion.',
    'Dates are controlled; save and clear use visible controls. Read-only assertions also use the public export message and browser storage.',
    'Browser restart occurs only after successful persistence. No durability claim is made for still-unwritten in-memory changes.',
    'No Firefox browser, live discovery, audible speech, or human linguistic review is covered.',
  ],
};
fs.mkdirSync(output, { recursive: true });
fs.cpSync(source, extension, { recursive: true });
if (process.env.KALIMAT_BACKGROUND_OVERRIDE) {
  fs.copyFileSync(path.resolve(process.env.KALIMAT_BACKGROUND_OVERRIDE), path.join(extension, 'background.js'));
}
report.backgroundSha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(extension, 'background.js'))).digest('hex');

function installClock(now) {
  const RealDate = Date;
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  };
}

function fixture(showEnglish) {
  let value = stateApi.createProfile({ seedHex: 'a'.repeat(32), level: 2, interests: ['language', 'travel'], showEnglish });
  value.preferences.speechRate = 1.25;
  value.preferences.speechRepeat = 3;
  value.assignments[day] = { wordId: 1 };
  value.assignmentOrdinal = 1;
  value.recentIds = [1];
  value.wordStates[2] = { saved: true };
  value.favorites[2] = true;
  value = stateApi.recordReview(value, 2, 'good', '2026-10-16', vocabulary);
  delete value.showEnglish;
  const checked = stateApi.validateStoredProfile(value, vocabulary);
  assert.equal(checked.canPersist, true, 'Synthetic legacy fixture must be valid');
  assert.equal(checked.migrated, true, 'Fixture must actually enter legacy migration');
  return { legacy: jsonClone(value), normalized: jsonClone(checked.profile) };
}

function withEncounter(profile) {
  return {
    ...jsonClone(profile),
    pilot: { encounters: { [day]: card.id } },
    wordSnapshots: { ...jsonClone(profile.wordSnapshots || {}), [card.id]: jsonClone(card) },
    history: { ...jsonClone(profile.history), [card.id]: { firstSeen: day } },
  };
}

function assertAction(operation, actual, expected, reopened = false) {
  if (operation === 'save') {
    const saved = withEncounter(expected);
    saved.wordStates[card.id] = { saved: true };
    saved.favorites[card.id] = true;
    assert.deepEqual(actual, saved, 'Saved word and the complete existing profile must survive');
  } else {
    for (const key of ['wordStates', 'favorites', 'assignments', 'srs']) {
      assert.deepEqual(actual[key], {}, `${key} must remain cleared`);
    }
    // Opening the popup after clear records only the new pilot encounter.
    assert.deepEqual(actual.history, reopened ? { [card.id]: { firstSeen: day } } : {});
    assert.deepEqual(actual.wordSnapshots || {}, reopened ? { [card.id]: jsonClone(card) } : {});
    assert.deepEqual(actual.pilot, reopened ? { encounters: { [day]: card.id } } : undefined);
    assert.deepEqual(actual.recentIds, []);
    assert.equal(actual.assignmentOrdinal, 0);
    assert.equal(actual.level, 1);
    assert.deepEqual(actual.interests, []);
    assert.equal(actual.showEnglish, false);
    assert.deepEqual(actual.preferences, jsonClone(stateApi.createProfile().preferences));
    assert.notEqual(actual.seedHex, expected.seedHex);
  }
}

async function runCase(operation, showEnglish) {
  const name = `${operation}-english-${showEnglish}`;
  const record = { name, checks: [], surfaces: [] };
  report.cases.push(record);
  const check = label => { record.checks.push(label); console.log('PASS', name, label); };
  const profile = path.join(temporary, name);
  let context;
  let worker;
  let id;
  const start = async () => {
    context = await chromium.launchPersistentContext(profile, {
      executablePath: process.env.KALIMAT_CHROMIUM || '/usr/bin/chromium',
      headless: true, timezoneId: 'UTC', viewport: { width: 1280, height: 900 },
      args: ['--password-store=basic', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    context.setDefaultTimeout(15000);
    report.browserVersion = context.browser()?.version();
    context.on('page', page => {
      page.on('pageerror', error => report.pageErrors.push({ case: name, message: error.message }));
      page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push({ case: name, text: message.text() }); });
    });
    context.on('request', request => { if (/^https?:/.test(request.url())) report.externalRequests.push({ case: name, url: request.url() }); });
    await context.setOffline(true);
    await context.addInitScript(installClock, timestamp);
    worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    id = new URL(worker.url()).host;
    await worker.evaluate(installClock, timestamp);
  };
  const open = async (surface, suffix = '') => {
    const page = await context.newPage();
    if (surface === 'popup') await page.setViewportSize({ width: 380, height: 700 });
    await page.goto(`chrome-extension://${id}/${surface}/${surface}.html${suffix}`);
    assert.ok((await page.title()).trim());
    record.surfaces.push({ url: page.url(), title: await page.title() });
    return page;
  };
  const exportProfile = page => page.evaluate(() => chrome.runtime.sendMessage({ type: 'state.export' }));
  const durableProfile = () => worker.evaluate(async () => (await chrome.storage.local.get('kalimat.profile'))['kalimat.profile']);
  const capture = (page, phase) => page.screenshot({ path: path.join(output, `${name}-${phase}.png`), fullPage: true });
  try {
    await start();
    // Drain initial extension startup through its public API before seeding.
    const bootstrap = await open('popup');
    await bootstrap.locator('#assigned').waitFor({ state: 'visible' });
    assert.equal((await exportProfile(bootstrap)).kind, 'export');
    await bootstrap.close();
    const { legacy, normalized } = fixture(showEnglish);
    await worker.evaluate(async legacyProfile => {
      await chrome.storage.local.set({ 'kalimat.profile': legacyProfile, 'kalimat.reminder': { enabled: false, time: '09:00' } });
      const originalSet = chrome.storage.local.set.bind(chrome.storage.local);
      globalThis.__kalimatE2EFault = { blocked: true, failedWrites: 0, successfulProfileWrites: 0 };
      const injectedSet = async (...args) => {
        const fault = globalThis.__kalimatE2EFault;
        if (Object.hasOwn(args[0], 'kalimat.profile')) {
          if (fault.blocked) {
            fault.failedWrites += 1;
            throw new Error('E2E controlled profile write failure');
          }
          await originalSet(...args);
          fault.successfulProfileWrites += 1;
          return;
        }
        return originalSet(...args);
      };
      chrome.storage.local.set = injectedSet;
      if (chrome.storage.local.set !== injectedSet) throw new Error('Browser write-failure injection was not installed');
    }, legacy);
    let page = await open(operation === 'save' ? 'popup' : 'atlas', operation === 'clear' ? '?view=settings' : '');
    if (operation === 'save') {
      await page.locator('#assigned').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#save').getAttribute('aria-pressed'), 'false');
      await page.locator('#save').click();
      await page.waitForFunction(() => document.querySelector('#action-status').textContent.includes('التغيير مؤقت ولم يُحفظ'));
    } else {
      await page.locator('#clear').waitFor({ state: 'visible' });
      page.once('dialog', async dialog => { assert.equal(dialog.type(), 'confirm'); await dialog.accept(); });
      await page.locator('#clear').click();
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('المسح مؤقت ولم يُحفظ'));
    }
    await page.locator('#warning').waitFor({ state: 'visible' });
    assert.deepEqual(await durableProfile(), legacy);
    check('visible action reports temporary state; real durable storage remains unchanged');
    await capture(page, 'pending');
    for (let attempt = 1; attempt <= 3; attempt++) {
      const pending = await exportProfile(page);
      assert.equal(pending.kind, 'export');
      assert.equal(pending.storageWarning, true);
      assertAction(operation, JSON.parse(pending.text), normalized);
      assert.deepEqual(await durableProfile(), legacy);
    }
    record.faultsWhilePending = await worker.evaluate(() => globalThis.__kalimatE2EFault);
    assert.ok(record.faultsWhilePending.failedWrites >= 4);
    assert.equal(record.faultsWhilePending.successfulProfileWrites, 0);
    check('three repeated failed retries retain the pending action and accurate warning');
    await worker.evaluate(() => { globalThis.__kalimatE2EFault.blocked = false; });
    await page.close();
    page = await open('popup');
    await page.locator('#assigned').waitFor({ state: 'visible' });
    const recovered = await exportProfile(page);
    assert.equal(recovered.kind, 'export');
    assert.equal(recovered.storageWarning, undefined);
    const persisted = JSON.parse(recovered.text);
    assertAction(operation, persisted, normalized, true);
    assert.deepEqual(await durableProfile(), persisted);
    await page.locator('#warning').waitFor({ state: 'hidden' });
    if (operation === 'save') assert.equal(await page.locator('#save').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    check('reopening the UI persists the intended action and clears the warning when writes recover');
    await capture(page, 'recovered');
    record.faultsAfterRecovery = await worker.evaluate(() => globalThis.__kalimatE2EFault);
    assert.ok(record.faultsAfterRecovery.successfulProfileWrites >= 1);
    await context.close(); context = null;
    await start();
    assert.equal(await worker.evaluate(() => typeof globalThis.__kalimatE2EFault), 'undefined');
    page = await open('popup');
    await page.locator('#assigned').waitFor({ state: 'visible' });
    const restarted = await exportProfile(page);
    assert.equal(restarted.kind, 'export');
    assert.equal(restarted.storageWarning, undefined);
    assert.deepEqual(JSON.parse(restarted.text), persisted);
    assert.deepEqual(await durableProfile(), persisted);
    if (operation === 'save') assert.equal(await page.locator('#save').getAttribute('aria-pressed'), 'true');
    await page.locator('#warning').waitFor({ state: 'hidden' });
    check('full Chromium restart retains the exact successfully persisted profile without injection');
    await capture(page, 'restarted');
    record.status = 'passed';
  } catch (error) {
    record.status = 'failed';
    record.error = error.stack;
    console.error('FAIL', name, error.stack);
    process.exitCode = 1;
    if (context) for (const [index, page] of context.pages().entries()) {
      await page.screenshot({ path: path.join(output, `${name}-failure-${index}.png`), fullPage: true }).catch(() => {});
    }
  } finally {
    if (context) await context.close();
  }
}

(async () => {
  for (const operation of ['save', 'clear']) for (const showEnglish of [false, true]) await runCase(operation, showEnglish);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.externalRequests, []);
})().catch(error => { report.error = error.stack; console.error(error); process.exitCode = 1; }).finally(() => {
  fs.rmSync(temporary, { recursive: true, force: true });
  report.profilesRemoved = !fs.existsSync(temporary);
  report.status = process.exitCode ? 'failed' : 'passed';
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('OUTPUT', output);
});
