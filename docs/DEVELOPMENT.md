# Development

[Documentation index](README.md) · [Project overview](../README.md) · [Contributing](../CONTRIBUTING.md)

Kalimat uses vanilla HTML, CSS, and JavaScript with no package dependencies. Use Python 3 to serve the website; verification also requires Node 22 and Git. No dependencies are installed by the verification or packaging tools.

## Run the website

From the repository root:

```sh
python3 server.py
```

Open <http://localhost:8000/>. On Windows, use `python` instead of `python3` for all Python commands in this guide.

## Verification

Run the same fail-fast runner used by Linux and Windows CI:

```sh
python3 verify.py
```

It runs the root and combined tests, including package safety and deterministic rebuilds; checks tracked JavaScript syntax and Python compilation; checks generated vocabulary; builds both archives; and checks whitespace. It stops on any failed command. The workflow is [Verify Kalimat](../.github/workflows/verify.yml).

For UI changes, also inspect the affected website or extension flow in its intended browser. Check relevant layout, keyboard behavior, loading and error states, and local data after reload. Automated checks alone do not establish browser behavior.

## Extension installation and packaging

For the current source, run verification first. To package separately:

```sh
python3 extension/tools/package.py
```

Outputs are `extension/dist/kalimat-chrome-0.3.0.zip`, `extension/dist/kalimat-firefox-0.3.0.zip`, and unpacked `extension/dist/chrome` and `extension/dist/firefox` folders. These names reflect the existing manifest version; they do not identify the source commit or establish a new release. Keep generated packages out of Git.

- **Chrome:** open `chrome://extensions`, enable Developer mode, select **Load unpacked**, and choose `extension/dist/chrome`.
- **Firefox:** open `about:debugging#/runtime/this-firefox`, select **Load Temporary Add-on**, and choose `extension/dist/firefox/manifest.json`.

To inspect a historical snapshot, download `kalimat-chrome-0.3.0.zip` or `kalimat-firefox-0.3.0.zip` from [beta.2](https://github.com/Assem130/Kalimat-365/releases/tag/v0.3.0-beta.2), extract it, and load the folder containing `manifest.json` with the browser steps above. Those archives are historical and do not include subsequent `main` changes. The [Chrome Web Store](https://chromewebstore.google.com/detail/dlfllbncnbfpnocdaeddejjjldohmefe) is the public Chrome installation channel; Firefox store submission is postponed.

## Corpus maintenance

[`words.js`](../words.js) is the canonical 365-word corpus. Reviewed extension metadata stays in [`extension/data/vocabulary-metadata.json`](../extension/data/vocabulary-metadata.json); the converter retains five deliberate example overrides for IDs 24, 25, 32, 41, and 46.

```sh
node extension/tools/convert-vocabulary.js --check
```

This compares every generated field and its serialized output without writing the corpus. After an intentional, reviewed corpus or metadata edit, regenerate with `node extension/tools/convert-vocabulary.js`, review the diff, then run `python3 verify.py`. Preserve stable word IDs and the reviewed metadata boundary.

## Product boundaries

See [product context](../CONTEXT.md) for the current contracts. Website learning data stays in `localStorage`; extension data stays separately in `storage.local`. Do not introduce sync, telemetry, or corpus expansion as part of routine maintenance.

Website clear-data removes learning state, onboarding, and reminder settings while retaining `kalimat_theme`. The website reminder fires only while a Kalimat tab is open; the extension has its own MV3 `alarms`/`notifications` setting. Chrome's optional dictionary search sends only the submitted normalized term to Arabic Wiktionary. Firefox remains local-only.

## Project map

| Path | Responsibility |
| --- | --- |
| [`index.html`](../index.html) | Editorial home, lexicon, and website review entry point |
| [`word.html`](../word.html) | Daily-word permalink, history, export/import, and review |
| [`words.js`](../words.js) | Canonical 365-word website corpus |
| [`app-core.js`](../app-core.js) | Date selection, local state, and review policy adapters |
| [`app.js`](../app.js) | Word-page controller and browser-speech UI |
| [`revamp.js`](../revamp.js) | Home-page controller and lexicon/review UI |
| [`web-ui.js`](../web-ui.js) | Shared website UI helpers |
| [`sw.js`](../sw.js) | Offline app-shell service worker |
| [`extension/`](../extension/) | Chrome/Firefox MV3 companion and Atlas |
| [`server.py`](../server.py) | Local UTF-8 development server |
| [`verify.py`](../verify.py) | Shared repository verification runner |
