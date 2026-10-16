# Discovery extension E2E

This test loads the packaged extension in a fresh temporary Chromium profile. It never uses your normal browser profile. It requests only Arabic Wikipedia and Arabic Wiktionary host access. It makes real API requests and does not mock permissions, learner storage, or network responses.

Requirements: Chromium, a graphical Linux session, and an existing Playwright installation. No dependency installation is performed by the test.

From the repository root:

```sh
python3 extension/tools/package.py
KALIMAT_PLAYWRIGHT_PATH=/path/to/existing/node_modules/playwright node tests/e2e/discovery.cjs
```

If Playwright is already resolvable by Node, omit `KALIMAT_PLAYWRIGHT_PATH`. `KALIMAT_CHROMIUM` can select another Chromium executable. `KALIMAT_E2E_OUTPUT` can select the evidence directory.

Accept the native permission confirmation in the disposable browser when it appears. Leave other controls alone. The test waits up to 120 seconds for confirmation, then continues headless with the same granted permissions. This native confirmation is the only manual step.


The test first checks that a fresh offline popup creates no daily assignment and offers source consent. Choosing to continue without sources shows an unavailable state, not a bundled word. The main profile enables sources through the visible control and real browser permission prompt. The first daily card must come from live discovery, with a source revision and a sense-matched example. A bundled fallback or empty result fails this positive source check.

The test restarts headless with the granted profile. It checks the same daily word in Atlas and the popup, saving, known-word exclusion, reload persistence, desktop layout at 1280 pixels, and mobile layout at 390 pixels. Marking a source word known must preserve favorites, the current assignment and review state.

Later-day checks change only the service worker's Date clock. They do not inject source results, assignments, permissions or learner state. The result JSON lists actual and simulated dates. The next simulated day must automatically receive a different live source word. Another simulated day starts offline with sources disabled and no new assignment. Enabling sources while offline must not manufacture an assignment or alter favorites and review state.

The test exports a backup through settings, removes a saved flag through the UI, then imports the backup. It checks the complete restored profile after an offline browser restart and reads the original saved source card. The temporary profiles are deleted after success or failure. Screenshots, the disposable backup and a JSON result remain in the evidence directory printed by the test.

Empty results and source outages fail this positive E2E test. Empty/error handling remains covered by the integration tests. The test clock demonstrates assignment behavior across dates. It does not replace a real overnight browser observation.

The repository verification command also runs the deterministic coverage replay. Run it separately with:

```sh
node tests/e2e/coverage.cjs
```

It uses 50 captured Arabic Wikipedia passages and the generated dictionary catalog. It fails unless at least 12 of 50 passages produce lessons, at least 6 distinct words are returned, and at least 4 of 5 daily topic searches produce different eligible lessons. The optional `KALIMAT_COVERAGE_OUTPUT` writes the results, attribution, and separate article/dictionary example counts to JSON. This replay is not a live-network test or proof that every source entry is editorially correct.

## Local daily and overnight regression

Run the sustained supply diagnostic separately with `node tests/e2e/supply.cjs --output=/tmp/kalimat-supply.json`.
It replays both frozen corpora over three seeds and 30 simulated dates per corpus, selecting all interests represented in each corpus together and carrying lexical exclusions across topics.
Each real search query receives its matching frozen topic batch. The report records requested topics and offsets; different offsets reuse that topic's same frozen batch.
Each run must supply at least 27 distinct eligible lessons. Repeated or ineligible cards always fail.
The report includes every exact meaning/example pair, per-day source revisions, empty streaks, and the exhausted reachable pool for each corpus.
Use `--report-only` to capture a failing baseline without failing the process; `passed:false` remains explicit in its JSON.
These replay measurements do not prove live availability or semantic correctness. The diagnostic does not change runtime gates or learner data.
For a fair comparison with an older engine and catalog, set `KALIMAT_SUPPLY_DISCOVERY` to its absolute discovery module path and `KALIMAT_SUPPLY_INDEX` to its absolute catalog path, then run the same command. The current validator checks returned cards in both runs. Neither override changes the fixed success threshold.

Run `tests/e2e/daily.cjs` with `KALIMAT_PLAYWRIGHT_PATH` pointing to an existing Playwright installation. `KALIMAT_EXTENSION_PATH` can point to a verified unpacked Chrome candidate, and `KALIMAT_E2E_OUTPUT` selects the evidence directory. The test uses a disposable offline profile with the basic password store, so it does not access your desktop keyring.

It verifies fresh offline unavailability, then imports a documented disposable prior live-source backup through the UI. It checks cached source assignment, saved-word reopening, Atlas parity, a review across simulated local midnight, source settings, JSON export/clear/import, restart persistence and archived-word warnings. Subsequent learner actions use visible controls. This imported-fixture run does not prove fresh live fetching. Only the page and worker clocks are simulated. The popup is an extension page, and file import uses a file input; physical toolbar and native picker acceptance remain separate.
