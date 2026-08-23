<p align="center">
  <img src="assets/readme-hero.svg" alt="كَلِمات" width="720">
</p>

<h1 align="center" dir="rtl">كَلِمات</h1>

<p align="center" dir="rtl">كلمة عربية فصيحة واحدة كل يوم: اسمعها، افهم معناها، وراجعها حتى تثبت.</p>

<p align="center">
  <a href="https://assem130.github.io/arabic-word-of-the-day/">الموقع</a>
  ·
  <a href="https://chromewebstore.google.com/detail/dlfllbncnbfpnocdaeddejjjldohmefe">متجر كروم</a>
  ·
  <a href="https://github.com/Assem130/arabic-word-of-the-day/releases/tag/v0.3.0-beta.2">v0.3.0-beta.2</a>
  ·
  <a href="https://assem130.github.io/arabic-word-of-the-day/privacy.html">الخصوصية</a>
</p>

Local-first Arabic learning for intermediate and advanced learners. Public beta `0.3.0`. Chrome is on the [Web Store](https://chromewebstore.google.com/detail/dlfllbncnbfpnocdaeddejjjldohmefe); Firefox store submission is postponed. Support: [issues](https://github.com/Assem130/arabic-word-of-the-day/issues).

<p align="center">
  <img src="docs/store/screenshots/01-daily-word.png" alt="كلمة اليوم" width="260">
  <img src="docs/store/screenshots/02-review.png" alt="المراجعة" width="260">
  <img src="docs/store/screenshots/03-atlas.png" alt="الأطلس" width="260">
</p>

## القناتان

Website and extension are separate local experiences. They do not sync.

- **Website:** one date-based daily word, full lexicon, browser speech, local spaced review. History lives in `localStorage`.
- **Extension:** optional Chrome/Firefox companion with challenge level, interests, reminders, Atlas, and the same review policy. Profile lives in `storage.local`.

No account, backend, telemetry, analytics, gamification, or vocabulary expansion in this beta. Not a beginner product.

## الخصوصية

Learning data stays on-device until you delete it. Both surfaces offer JSON export and deletion.

- Website fonts are local WOFF2. No external font request.
- Website reminder is an opt-in `Notification` and fires only while a Kalimat tab is open. Clear-data removes learning state, onboarding, and reminder settings; `kalimat_theme` stays.
- Extension reminder is its own MV3 `alarms`/`notifications` setting.
- Chrome may make an explicit, read-only Arabic Wiktionary lookup on search, sending only the normalized term. Firefox stays local-only.

Full policy: [privacy.html](https://assem130.github.io/arabic-word-of-the-day/privacy.html).

## الموقع محلياً

Open the [live site](https://assem130.github.io/arabic-word-of-the-day/) or:

```powershell
git clone https://github.com/Assem130/arabic-word-of-the-day.git
cd arabic-word-of-the-day
python server.py
```

Then open <http://localhost:8000/>. Python 3 is the only development runtime required.

## تثبيت الامتداد

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/dlfllbncnbfpnocdaeddejjjldohmefe). Firefox store submission is postponed.

Unpacked / local testing from [`v0.3.0-beta.2`](https://github.com/Assem130/arabic-word-of-the-day/releases/tag/v0.3.0-beta.2):

- Download `kalimat-chrome-0.3.0.zip` or `kalimat-firefox-0.3.0.zip`, then extract.
- **Chrome:** `chrome://extensions` → Developer mode → **Load unpacked** → folder containing `manifest.json`.
- **Firefox:** `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → extracted Firefox `manifest.json`.

Local packaging uses the verification commands below, then load `extension/dist/chrome` or `extension/dist/firefox`.

## Verification

From the repository root:

```powershell
node test.js
node --test tests/*.test.js extension/tests/*.test.js
git ls-files '*.js' | Where-Object { $_ -notlike 'extension/dist/*' } | ForEach-Object { node --check $_ }
powershell -NoProfile -ExecutionPolicy Bypass -File extension/tools/package.ps1
$env:KALIMAT_PACKAGE_ALREADY_BUILT = '1'; node extension/tests/package.test.js; Remove-Item Env:KALIMAT_PACKAGE_ALREADY_BUILT
git diff --check
```

Managed Windows may report `spawn EPERM` for Node child workers; rerun the identical command with permitted process execution. A clean package must emit `extension/dist/kalimat-chrome-0.3.0.zip` and `extension/dist/kalimat-firefox-0.3.0.zip`.

## Project map

```text
index.html       editorial home, lexicon, and website review entry point
word.html        daily-word permalink, history, export/import, and review
words.js         canonical 365-word website corpus
app-core.js      date selection, local state, and review policy adapters
app.js           word-page controller and browser-speech UI
revamp.js        home-page controller and lexicon/review UI
web-ui.js        shared website UI helpers
sw.js            offline app-shell service worker
extension/       optional Chrome/Firefox MV3 companion and Atlas
server.py        local UTF-8 development server
```

Vanilla HTML, CSS, and JavaScript. No package dependencies.
