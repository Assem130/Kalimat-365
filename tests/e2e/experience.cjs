// Packaged extension journeys complement pilot.cjs and storage-recovery.cjs.
// Real browser/storage APIs; only clocks and explicitly labeled response delays are controlled.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.KALIMAT_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '../..');
const source = path.resolve(process.env.KALIMAT_EXTENSION_PATH || path.join(root, 'extension/dist/chrome'));
const output = path.resolve(process.env.KALIMAT_E2E_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'kalimat-experience-results-')));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'kalimat-experience-'));
const extension = path.join(temporary, 'extension');
const profile = path.join(temporary, 'profile');
fs.mkdirSync(output, { recursive: true });
fs.cpSync(source, extension, { recursive: true });
const result = { checks: [], pageErrors: [], requests: [], limitations: ['Popup is rendered as an extension page, separate from native toolbar evidence.', 'Dates and a slow save response are controlled.', 'Native 200% zoom retains top viewport captures only. Chromium full-page and scrolled zoom captures can clip or offset; scrolled control reachability is checked through real viewport geometry.', 'No screen-reader or audible speech claim.'] };
let context, id, worker;
let now = new Date('2026-10-22T12:00:00+02:00').getTime();
function installClock(timestamp) {
  globalThis.__experienceNow = timestamp;
  const RealDate = globalThis.__experienceDate || Date;
  globalThis.__experienceDate = RealDate;
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [globalThis.__experienceNow])); }
    static now() { return globalThis.__experienceNow; }
  };
}
async function start() {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.KALIMAT_CHROMIUM || '/usr/bin/chromium', headless: true,
    args: ['--password-store=basic', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    viewport: { width: 1280, height: 800 }, timezoneId: 'Europe/Amsterdam', acceptDownloads: true,
  });
  result.browser = context.browser().version();
  context.on('page', page => page.on('pageerror', e => result.pageErrors.push(e.message)));
  context.on('request', r => { if (/^https?:/.test(r.url())) result.requests.push(r.url()); });
  await context.setOffline(true);
  await context.addInitScript(installClock, now);
  worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  id = new URL(worker.url()).host;
  await worker.evaluate(installClock, now);
}
const check = label => { result.checks.push(label); console.log('PASS', label); };
const snapshot = (page, name) => page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
const exportProfile = page => page.evaluate(async () => {
  const reply = await chrome.runtime.sendMessage({ type: 'state.export' });
  if (reply.kind !== 'export' || reply.storageWarning) throw new Error('No durable profile');
  return JSON.parse(reply.text);
});
async function open(route, selector) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/${route}`);
  await page.locator(selector).waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
  return page;
}
async function setDate(iso) {
  now = new Date(iso).getTime();
  await context.addInitScript(installClock, now);
  for (const page of context.pages()) await page.evaluate(installClock, now);
  for (const currentWorker of context.serviceWorkers()) await currentWorker.evaluate(installClock, now);
}
async function noOverflow(page) {
  // Chromium settles viewport units after full-page screenshot restoration.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const overflow = await page.evaluate(() => ({
    width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    elements: [...document.querySelectorAll('body *')].filter(el => {
      const r = el.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1);
    }).slice(0, 12).map(el => ({ tag: el.tagName, id: el.id, width: el.getBoundingClientRect().width, left: el.getBoundingClientRect().left })),
  }));
  assert.ok(overflow.scrollWidth <= overflow.width, `Horizontal overflow: ${page.url()} ${JSON.stringify(overflow)}`);
}
async function palette(page) {
  return page.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, ink: getComputedStyle(document.body).color }));
}
(async () => {
  assert.equal(JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'))).chrome_url_overrides, undefined);
  await start();
  let popup = await open('popup/popup.html', '#assigned');
  await popup.setViewportSize({ width: 380, height: 600 });
  assert.ok(await popup.locator('#explore').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight), 'Atlas entry should be visible in the native popup height');
  assert.equal(await popup.locator('#vocalization-details').isVisible(), false, 'Pilot must not show an empty lexical disclosure');
  await snapshot(popup, 'popup-light');
  let reader = await open('newtab/newtab.html', '#encounter');
  await reader.evaluate(() => {
    const send = chrome.runtime.sendMessage.bind(chrome.runtime);
    chrome.runtime.sendMessage = async message => {
      if (message.type === 'word.save') await new Promise(resolve => setTimeout(resolve, 150));
      return send(message);
    };
  });
  await reader.locator('#save').focus();
  await reader.keyboard.press('Enter');
  await reader.waitForFunction(() => document.querySelector('#save').getAttribute('aria-pressed') === 'true');
  assert.equal(await reader.evaluate(() => document.activeElement.id), 'save');
  await popup.waitForFunction(() => document.querySelector('#save').getAttribute('aria-pressed') === 'true');
  await snapshot(reader, 'reader-light');
  check('compact popup keeps its actions visible; delayed keyboard save retains focus and synchronizes to the popup');

  const historyLink = reader.locator('a[href*="view=history"]');
  await historyLink.click();
  await reader.locator('#history-view').waitFor({ state: 'visible' });
  await reader.locator('#history-filter').selectOption('saved');
  assert.ok(await reader.locator('#history-list button').count());
  check('reader My words link opens saved/history directly');
  let atlas = reader;
  reader = await open('newtab/newtab.html', '#encounter');
  await atlas.locator('#today').click();
  assert.equal(await atlas.locator('#today-card > .context .text').isVisible(), true, 'Pilot example should be visible without opening a disclosure');
  assert.equal(await atlas.locator('#today-card > .source-link').isVisible(), true, 'Pilot dictionary source should be visible without opening a disclosure');
  await snapshot(atlas, 'atlas-today');
  await atlas.locator('#explore').click();
  const first = atlas.locator('#search-results button').first();
  const firstText = await first.innerText();
  await first.focus(); await atlas.keyboard.press('Enter');
  assert.equal(await atlas.locator('#search-results').isVisible(), false);
  assert.equal(await atlas.locator('#explore-card h3').evaluate(el => document.activeElement === el), true);
  assert.ok(await atlas.locator('#explore-card h3').evaluate(el => el.getBoundingClientRect().top < innerHeight));
  await snapshot(atlas, 'atlas-explore-detail');
  await atlas.locator('#explore-back').click();
  assert.equal(await atlas.evaluate(() => document.activeElement.textContent), firstText);
  await atlas.locator('#atlas-search').fill('منوال');
  await atlas.locator('#search-results button').first().click();
  await atlas.locator('#explore-back').click();
  assert.equal(await atlas.locator('#atlas-search').inputValue(), 'منوال');
  await atlas.locator('#atlas-search').fill('كلمةغيرموجودةبتاتاً');
  assert.equal(await atlas.locator('#search-results button').count(), 0);
  await snapshot(atlas, 'atlas-empty-search');
  check('Explore selection is immediately visible; Back restores result focus and query; empty search is recoverable');

  await atlas.locator('#settings').click();
  assert.equal(await atlas.locator('.optional-discovery').getAttribute('open'), null);
  assert.equal(await atlas.locator('#discovery-enable').isVisible(), false);
  await atlas.locator('#settings-english').check();
  await atlas.locator('#settings-speech-rate').fill('0.7');
  await atlas.locator('#settings-save').click();
  await atlas.waitForFunction(async () => JSON.parse((await chrome.runtime.sendMessage({ type: 'state.export' })).text).preferences.speechRate === 0.7);
  await atlas.reload(); await atlas.locator('#settings').click();
  assert.equal(await atlas.locator('#settings-english').isChecked(), true);
  assert.equal(await atlas.locator('#settings-speech-rate').inputValue(), '0.7');
  assert.equal(await atlas.locator('#settings-remote-speech').isChecked(), false);
  const beforeInvalid = await exportProfile(atlas);
  await atlas.locator('#import-file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":999}') });
  await atlas.waitForFunction(() => /تعذّر|غير صالح|غير مدعوم/.test(document.querySelector('#status').textContent));
  assert.deepEqual(await exportProfile(atlas), beforeInvalid);
  await snapshot(atlas, 'atlas-invalid-import');
  check('settings persist after reload; remote speech stays opt-in; incompatible import preserves the complete profile');

  for (const theme of ['paper', 'emerald', 'midnight']) {
    await atlas.locator('#theme-select').selectOption(theme);
    for (const surface of [atlas, reader, popup]) await surface.waitForFunction(value => document.documentElement.dataset.theme === value, theme);
    for (const scheme of theme === 'paper' ? ['light', 'dark'] : ['light']) {
      for (const surface of [atlas, reader, popup]) {
        await surface.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await surface.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      }
      const colors = await Promise.all([atlas, reader, popup].map(palette));
      assert.deepEqual(colors[0], colors[1]); assert.deepEqual(colors[0], colors[2]);
      await snapshot(atlas, `atlas-settings-${theme}-${scheme}`);
      await snapshot(reader, `reader-${theme}-${scheme}`);
      await snapshot(popup, `popup-${theme}-${scheme}`);
    }
  }
  await atlas.locator('#theme-select').selectOption('paper');
  for (const surface of [atlas, reader]) {
    await surface.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    for (const width of [390, 320]) {
      await surface.setViewportSize({ width, height: 844 }); await noOverflow(surface);
      await snapshot(surface, `${surface === atlas ? 'atlas-settings' : surface === reader ? 'reader' : 'popup'}-${width}`);
    }
  }
  for (const surface of [atlas, reader]) await surface.setViewportSize({ width: 1280, height: 800 });
  for (const surface of [atlas, reader]) {
    const zoom = await surface.evaluate(async () => {
      const tab = await chrome.tabs.getCurrent();
      await chrome.tabs.setZoom(tab.id, 2);
      return chrome.tabs.getZoom(tab.id);
    });
    assert.equal(zoom, 2);
    await surface.waitForFunction(width => innerWidth === width / 2, surface.viewportSize().width);
    await noOverflow(surface);
    await surface.evaluate(() => scrollTo(0, 0));
    // Chromium full-page/scrolled capture can use unzoomed clip coordinates.
    // Keep the reliable top viewport capture and verify lower controls below.
    const zoomName = surface === atlas ? 'atlas-settings' : 'reader';
    await surface.screenshot({ path: path.join(output, `${zoomName}-zoom-200.png`), fullPage: false });
    const zoomTargets = surface === atlas
      ? ['#settings-speech-rate', '#settings-save', '#settings-reminder', '#export', '.optional-discovery > summary']
      : ['#save', '#source', 'footer a'];
    for (const selector of zoomTargets) {
      const control = surface.locator(selector);
      await control.scrollIntoViewIfNeeded();
      assert.equal(await control.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1;
      }), true, `${selector} must remain reachable within the zoomed viewport`);
    }
    await noOverflow(surface);
    await surface.evaluate(async () => chrome.tabs.setZoom((await chrome.tabs.getCurrent()).id, 1));
    await surface.waitForFunction(width => innerWidth === width, surface.viewportSize().width);
    await surface.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  await popup.setViewportSize({ width: 380, height: 600 });
  check('all palettes match across surfaces; live system dark mode, reduced motion, 320/390px layouts and 200% browser zoom work');

  await setDate('2026-10-23T12:00:00+02:00'); await reader.reload(); await reader.locator('#encounter').waitFor({ state: 'visible' });
  await setDate('2026-10-24T12:00:00+02:00'); await reader.reload(); await reader.locator('#reveal').waitFor({ state: 'visible' });
  await reader.locator('#reveal').focus(); await reader.keyboard.press('Enter');
  assert.equal(await reader.evaluate(() => document.activeElement.id), 'recall-answer');
  await reader.keyboard.press('Tab'); assert.equal(await reader.evaluate(() => document.activeElement.id), 'recall-done');
  await reader.keyboard.press('Enter'); await reader.locator('#recall').waitFor({ state: 'hidden' });
  assert.equal(await reader.evaluate(() => document.activeElement.id), 'dismiss');
  check('recall reveal focuses its answer, then keyboard completion returns to the encounter');

  const dayWords = [];
  for (const date of ['2026-10-25T01:59:00+02:00', '2026-10-25T02:01:00+01:00', '2026-10-26T00:01:00+01:00']) {
    await setDate(date); await reader.reload();
    await reader.waitForFunction(dateKey => document.querySelector('#date').dateTime === dateKey
      && document.querySelector('main').getAttribute('aria-busy') === 'false'
      && document.documentElement.dataset.themeReady === 'true'
      && getComputedStyle(document.querySelector('#word')).visibility === 'visible'
      && document.querySelector('#word').innerText.trim(), date.split('T')[0]);
    dayWords.push(await reader.locator('#word').innerText());
  }
  assert.equal(dayWords[0], dayWords[1]); assert.notEqual(dayWords[1], dayWords[2]);
  check('Amsterdam DST fallback retains one calendar word; the next local date changes it');

  const durable = await exportProfile(reader);
  const cdp = await context.newCDPSession(reader);
  const versions = [];
  cdp.on('ServiceWorker.workerVersionUpdated', event => versions.push(...event.versions));
  await cdp.send('ServiceWorker.enable');
  await reader.waitForTimeout(150);
  const active = versions.find(version => version.scriptURL === worker.url() && version.runningStatus === 'running');
  assert.ok(active, 'Browser must expose the running extension worker');
  function waitForWorkerState(runningStatus) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { cdp.off('ServiceWorker.workerVersionUpdated', listener); reject(new Error(`Worker did not become ${runningStatus}`)); }, 5000);
      function listener(event) {
        if (!event.versions.some(version => version.versionId === active.versionId && version.runningStatus === runningStatus)) return;
        clearTimeout(timeout); cdp.off('ServiceWorker.workerVersionUpdated', listener); resolve();
      }
      cdp.on('ServiceWorker.workerVersionUpdated', listener);
    });
  }
  // Playwright can retain its Worker wrapper after the native worker stops.
  // Use Chromium lifecycle events and target absence as termination evidence.
  const stopped = waitForWorkerState('stopped');
  await cdp.send('ServiceWorker.stopWorker', { versionId: active.versionId });
  await stopped;
  assert.equal((await cdp.send('Target.getTargets')).targetInfos.some(target => target.url === worker.url()), false);
  const resumed = waitForWorkerState('running');
  assert.deepEqual(await exportProfile(reader), durable);
  await resumed;
  check('actual MV3 worker termination and message-triggered resumption preserve durable profile state');
  await context.close(); context = null;
  await start();
  reader = await open('newtab/newtab.html', '#encounter');
  assert.deepEqual(await exportProfile(reader), durable);
  check('complete profile and preferences survive full browser restart');
  assert.deepEqual(result.pageErrors, []); assert.deepEqual(result.requests, []);
  check('all checks use offline packaged code with zero page errors and zero external requests');
})().catch(async error => {
  result.error = error.stack; console.error(error); process.exitCode = 1;
  if (context) for (const [index, page] of context.pages().entries()) await snapshot(page, `failure-${index}`).catch(() => {});
}).finally(async () => {
  if (context) await context.close();
  fs.rmSync(temporary, { recursive: true, force: true });
  result.profileRemoved = !fs.existsSync(profile);
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(result, null, 2) + '\n');
  console.log('OUTPUT', output);
});
