# Extension verification

## Main merge and store submission, 22 October 2026

The finished experience changes were merged into `main` and pushed at `135a6d01c94d52208a53ee1c00dc90c12b527dea`. GitHub's Ubuntu and Windows verification and Pages deployment passed. The user authorized updating the existing Chrome Web Store submission.

Native KDE dashboard interaction canceled the earlier pending review and uploaded the verified normal Chrome 0.5.1 ZIP. Both reader screenshots and the reviewer instructions were updated. The dashboard confirmed successful submission with automatic publication after approval enabled. The package page showed **0.5.1 pending review** and **0.3.0 published**. No store approval or installed store upgrade is claimed.

The uploaded ZIP SHA256 is `26108df6063cdcc95c292601cb6d101c2bed0c0556cd45642d9a1ba7d6125903`, matching the tested experience candidate below. Native submission screenshots, the ZIP, screenshot hashes and instructions are preserved in `agent-docs/codex-maturity-2026-10-22/store-0.5.1/`. This distribution record supersedes the earlier submission statuses below.

## Experience refinement of 0.5.1, 22 October 2026

This local candidate builds on `84866e2`. It fixes reader history routing, Explore detail navigation, and keyboard focus after saving. It aligns Arabic typography and themes across surfaces, exposes the daily example and reference in Atlas, and prioritizes reading and personal-data settings. The support website now describes the pilot and uses a current screenshot. No publication occurred.

The baseline reproduced three defects: the reader's My words link opened Today, the selected Explore heading appeared 19,360 pixels below the top, and a delayed Save lost keyboard focus. Three new Atlas integration regressions failed against the baseline and pass against the candidate. Packaged browser tests cover the reader focus defect. Approved pilot text, scheduling, archive data, storage/export formats, background logic, permissions and extension identity have no changes.

| Verification | Result and scope |
| --- | --- |
| `python3 verify.py` | 487 JavaScript tests and 11 Python tests pass, plus syntax, vocabulary parity, source replay, supply gates and deterministic packaging. |
| Packaged Chromium 155.0.8059.84 | All 11 pilot checks pass in each mode: normal popup-to-reader and separate optional new-tab build. Includes legacy state, recall, export/clear/import and browser restart. |
| `experience.cjs` | All 10 journey groups pass. Covers delayed Save focus, navigation, settings, invalid import retention, themes, reduced motion, 320/390px layouts, actual 200% browser zoom, simulated DST, forced MV3 worker stop/resume and full browser restart. |
| `storage-recovery.cjs` | All four save/clear cases pass with English on and off. Controlled failed writes preserve pending actions, recover, and survive restart after persistence. |
| Packaged Firefox 158.0.1 | All 20 checks pass using real Firefox and a temporary addon. Includes saving, dismissal, navigation, themes, runtime backup/clear/import and addon reload. |
| Native KDE desktop | Installed Linux integration operated the disposable Chromium window. Pinning, actual toolbar popup, Save, popup-to-reader and My words navigation were observed. Final popup width and initial actions fit correctly. |
| Supporting website | Rendered at 1280, 390 and 320px, with no horizontal overflow or page errors. Navigation, theme toggle, current screenshot and legacy links were checked locally. |

Positive Chromium journey reports record zero page errors and external requests. Every test uses disposable profiles. Firefox uses headless Marionette and document controls, not desktop pointer input. Its backup check uses the runtime API. Native toolbar observation is separate from popup-document automation. Screenshots were inspected across popup, reader, Atlas, themes, narrow layouts, zoom and storage failure states.

Remaining checks: audible Arabic speech, real screen-reader output, native Firefox toolbar and permission/file-picker interactions, reminder delivery, store-installed upgrades, and actual disk/quota exhaustion. AT-SPI returned no Chromium accessibility nodes on this host. Dates are controlled rather than observed overnight. Worker termination is real and forced through CDP, not timed idle suspension. These results do not certify all legacy editorial content.

Evidence and the before/after gallery are in the ignored local folder `agent-docs/codex-maturity-2026-10-22/`. Accepted reports are `pilot-accepted/`, `optional/pilot-accepted/`, `experience-release/`, `firefox/release/`, `recovery-final/`, and `website/`. Earlier diagnostic failures remain separate. Reproduction instructions are in [the E2E guide](../tests/e2e/README.md).

The final normal manifests have no new-tab override. Normal archive SHA256 values:

- Chrome: `26108df6063cdcc95c292601cb6d101c2bed0c0556cd45642d9a1ba7d6125903`
- Firefox: `cd3bca1bd56ecfff2116ce723ea7f62a035ba58639e32c0e85765f27c0ec543e`

The source version remains 0.5.1. This refinement does not change the separately submitted 0.5.0 package or establish store approval.

## Integrated pilot candidate 0.5.1, 22 October 2026

Integrated the pilot on top of GitHub commits `8e884cb` (legacy storage recovery and cleanup) and `e743da2` (privacy publication). The upstream fix remains intact. Verification also found and fixed Firefox's missing pilot startup script and an Atlas error that hid settings when a new pilot snapshot could not yet be saved.

`python3 verify.py` passes 484 JavaScript tests, 11 Python tests, source replay, the existing supply gate, syntax checks for 48 tracked JavaScript files, vocabulary parity and deterministic Chrome/Firefox packaging. The Firefox manifest-driven API test reproduces the missing-catalog failure before the fix and serves a pilot assignment after it. Native Firefox remains untested.

The final packaged Chromium extension passes all 11 pilot workflow checks in each mode: normal popup-to-reader and optional native new-tab replacement. Both preserve saved words, overlapping legacy/pilot history, dismissal and recall state through browser restart and backup export/clear/import. The final normal package has no new-tab override. Both tested extension folders match their respective packager outputs byte for byte. Representative desktop, narrow and recovery screenshots were inspected.

The storage-recovery browser test passes all four save/clear cases with English explanations on and off. It rejects profile writes in disposable profiles, checks three repeated failed retries, restores writes, then checks exact durable state after a full Chromium restart. Atlas settings remain accessible during the failure. The same test with the submitted 0.5.0 background fails all four cases, including lost pending clear state. That negative baseline verifies the regression is detectable. It does not modify the submitted ZIP.

Positive browser runs report no page errors or external requests and remove their disposable profiles. Dates and storage failures are controlled. Physical toolbar placement, actual disk/quota exhaustion, actual MV3 suspension, audible speech, assistive technology and independent linguistic certification remain outside this evidence.

Local archives, logs, screenshots and reports are in the ignored folder `agent-docs/codex-2026-10-22/github-sync-0.5.1/`. Normal archive SHA256 values:

- Chrome: `7b5f770d27d4fb4214f388b39033654bc84296fd8c5a4d7159d49a9129382485`
- Firefox: `79ceffe39df8e5a16069e40795403729d871ba98493eed454cf9ca06fa8c8d96`

Version 0.5.1 is a separate source candidate. The submitted 0.5.0 package and its pending review remain unchanged. See [distribution status](store/release-notes-v0.5.1.md).

## Submitted store package 0.5.0, 22 October 2026

Prepared without new-tab or search-provider overrides, as requested. Required permissions remain `storage` and `contextMenus`. The Chrome ZIP was checked against the runtime source bytes. `python3 verify.py` passes 473 JavaScript tests and 11 Python tests plus the existing replay, supply and packaging checks. The pilot browser script also passes all 11 workflow checks with `KALIMAT_E2E_STORE=1`, opening the reader from the popup instead of replacing new tabs. Imported saved words and overlapping legacy/pilot history survive restart and backup round-trip. No page errors or external requests occurred; disposable profiles were removed.

Upload artifacts, screenshots and evidence are in the ignored local folder `agent-docs/codex-2026-10-22/store-upload-0.5.0/`. The updated privacy page was deployed and verified at its existing URL. Native dashboard screenshots then confirmed the published 0.3.0 package, uploaded 0.5.0 draft, saved listing and privacy fields, updated screenshots and successful submission. The final dashboard state was Pending review on 22 October 2026, with automatic publication after approval enabled. This is not evidence of approval. The submitted ZIP remains unchanged and predates the later storage fix in 0.5.1. The previous runtime limitations below still apply.

## Approved 14-day pilot, 22 October 2026

The current local candidate replaces daily source selection with the approved shared calendar catalog. Older discovery results below are historical. The legacy website is unchanged. No personal browser installation or publication was performed.

`python3 verify.py` passes 473 JavaScript tests, 11 Python tests, source replay, the existing supply gate, syntax/parity checks and Chrome/Firefox packaging. The optional new-tab manifest is tested for both browsers. Background regressions cover preserving all 512 discovery snapshots, retaining legacy data, storage failure, recall and avoiding automatic pilot SRS enrollment.

`tests/e2e/pilot.cjs` passes 11 checks against the actual packaged native Chromium new-tab override, fully offline in disposable profiles. It verifies full and compact states, keyboard dismissal and focus, saving, browser restart, popup/Atlas parity and dictionary links, light/dark appearance, 320px and 390px layouts, recall reveal/skip, the 14-day repeat, same-date legacy/pilot history, export/clear/import and the same calendar entry in a second fresh profile. There were no page errors or external requests. Temporary browser profiles were removed. Rendered desktop, narrow, dark, compact and recall screenshots were inspected.

Evidence is in `agent-docs/codex-2026-10-22/evidence/` (local, ignored by Git). Dates are simulated; this does not establish a real overnight run. Firefox runtime, physical toolbar popup, screen-reader use and independent linguistic certification remain unverified. The previous `tests/e2e/daily.cjs` targets pre-pilot source-discovery packages; use the pilot script for this candidate.

## Discovery supply beta, 17 October 2026

This 0.4.1 candidate supersedes the discovery-core snapshot below. It adds 44 source senses from the LMF Contemporary Arabic dictionary under CC BY-NC 4.0. Kalimat remains non-commercial. New daily assignments use source discovery without a fixed-list fallback. Existing learner data, archive IDs and the midnight fix remain intact.

Final `python verify.py` passes 466 JavaScript tests, 11 Python importer tests, source replay, the sustained-supply gate, syntax/parity checks and deterministic Chrome/Firefox packaging. The isolated checkout is `/tmp/kalimat-lmf-verify-rpz1wl6i/project`. The final log is `/tmp/kalimat-lmf-final-full.log`.

The same frozen multi-interest test measures original-corpus supply at 28, 28 and 27 distinct results over 30 simulated dates. The baseline was 9, 10 and 11. Heldout supply is 30, 27 and 30, compared with 16, 13 and 16. Every final run meets the unchanged 27-of-30 gate. See [source evaluation](DISCOVERY-SUPPLY.md) for methodology and limitations.

Five real public Wikipedia API requests returned five distinct eligible cards, including four LMF cards. These requests used the production module with real HTTP responses and simulated dates. They did not exercise native permission consent. Evidence is `/tmp/kalimat-lmf-live.json`.

The final packaged Chromium candidate passes 13 cached/offline workflow checks. The file input imports a source-backed replay fixture. Popup, Atlas and review preserve the source construction. The check asserts that the Atlas construction appears above its dependent definition. Save/reopen, export/clear/import, browser restart and stale Atlas review across midnight pass. There are no page errors or external requests, and the disposable profile was removed. Root inspected popup and Atlas screenshots. Evidence is `/tmp/kalimat-lmf-final-daily/report.json`.

Chrome archive SHA256 is `10208d0267aaae0744ba7e364f333787f3a4c09245be33052437dd479cfef411`.
Firefox archive SHA256 is `2637686a680241c0d6a550201da2fd6dedb047c9b29fe88b3ac81b7dc24e37c4`.

Before shipment, a Markdown line break was removed from the wordfreq notice. It changes only that notice in the archives. All executable runtime files match the final Chromium-tested candidate. Both packages contain 36 files. The LMF catalog, attribution notice and QA ledger are included. The combined reference indexes occupy 2,026,168 bytes. Two full LMF builds produce identical data. Package tests check deterministic archives and exact source bytes.

Remaining limits are qualified Arabic review, supply beyond the measured month, native Firefox, the physical toolbar popup, audible Arabic speech, a screen reader and actual MV3 suspension. The GitHub beta does not establish store approval or a stable-release claim. Earlier site workflow verification is recorded below and in [the website transition record](WEBSITE-TRANSITION.md).

## Earlier discovery-core candidate, 16 October 2026

This unpublished 0.4.1 candidate supersedes the fixed-pool snapshot below. It reuses the discovery engine from the Plan project rebuild chat. New daily assignments use eligible source cards only. The bundled 365 records remain for archive compatibility; they are not a daily fallback. Existing data and the midnight fix remain intact.

Final `python3 verify.py` passed 461 tests, syntax checks, vocabulary parity, the unchanged source replay, and deterministic Chrome/Firefox packaging in `/tmp/kalimat-discovery-core-c1adcwmg/project`. Log: `/tmp/kalimat-discovery-core-final-verify.log`. All 32 non-manifest Chrome runtime files match the working source byte-for-byte.

The packaged extension passed 13 cached/offline Chromium checks and 9 live-source Chromium checks. Evidence: `/tmp/kalimat-discovery-core-daily-final/report.json` and `/tmp/kalimat-discovery-core-live-final/result.json`. Real permission consent, live source responses, two distinct simulated daily words, save/reload, complete UI backup restore, offline source retention and browser restart passed. The cached test imports an attributed synthetic backup through the actual file input. It verifies due reviews while Today is unavailable and an open review crossing simulated midnight. Both runs have zero page errors and removed their disposable profiles. No normal browser profile was changed.

Verification found and fixed unavailable-Today storage-refresh and hidden due-review bugs. Focused regressions protect both. Root and Sol low inspected rendered mobile/desktop states. The popup is scrollable at 380 by 600, with no horizontal overflow. These runs open the extension popup page, not the physical toolbar bubble; file inputs do not verify native picker interaction. Dates are simulated.

A separate 47-passage source sample returned 22 cards and 9 distinct words. All used dictionary examples. The catalog has only 23 entries with usable dictionary example pairs under current controls. A fixed-batch 30-iteration depletion probe produced 16 words and 14 empty results. These results do not establish sustained daily supply or semantic topic relevance. Dictionary suggestion copy now states that shared words do not prove relevance to an article. Human Arabic correctness remains unverified.

Before shipping: improve source coverage with attributed meanings and examples, validate usefulness and sense accuracy with an Arabic reviewer, then test sustained discovery without repeats. Final native Firefox, physical toolbar, Arabic speech, screen reader and actual MV3 suspension checks remain open. No publication or submission occurred.

Chrome archive SHA256: `9d265541f48f54dce1db8d734c2ab74ce7fcac3c3d4e7dcc13f8ff1a69462c56`.
Firefox archive SHA256: `ef6a8460724d2ebd2c6ef5b867c5603584b901697427a802c7c2fab54701b079`.

Version 0.4.0 builds on the reviewed daily-encounter branch and the installed Chrome candidate tested on 1 October 2026. This record distinguishes executable regression checks, supplied native browser observations and remaining device checks.

## Installed Chrome evidence

The supplied verifier used a disposable Linux profile, loaded the packaged extension, pinned it and opened its actual toolbar popup. Root compared all 30 supplied runtime files with the candidate and inspected representative screenshots. The report covers:

- A daily Arabic word without a questionnaire, consistent close/reopen and popup-to-Atlas navigation.
- Explore save, saved history, removal and reopening.
- Export/import/clear through the native picker, correct import feedback and invalid-file retention.
- Saved state after closing the popup and extension reload.
- Honest feedback when a local Arabic voice is unavailable.
- A usable Atlas at 200 percent zoom, with scrolling.

Separate controlled Atlas observations cover keyboard save activation, focus after navigation, due/empty recall visibility and rendered entries 1 through 5. Those controls were driven by scripts, so they do not establish native file-picker use or screen-reader announcements.

These observations concern the identified 0.3.0 candidate, not a fresh native run of every subsequent 0.4.0 source change. Final save, focus and synchronization fixes use the existing executable regression harness. The final source also changes release metadata and packaging.

## Executable verification

Run `python3 verify.py`. It exercises the website and extension regression suites, JavaScript syntax, Python compilation, canonical/generated 365-entry parity, package safety, deterministic Chrome/Firefox archives and whitespace. Save/import failure, stale review cards, serialized mutations and worker module reconstruction are tested with controlled APIs. These checks do not establish native MV3 suspension or audible speech.

The earlier milestone preserved stable IDs and user stores and corrected five entries. Archive editorial work covers 30 source-checked entries and 335 pending entries. None is used as a new daily fixed-list fallback. See [editorial scope](EDITORIAL.md).

## Remaining native-device checks

On a disposable profile, check the final 0.4.0 toolbar popup and Atlas together, immediate closure during save, actual service-worker stop/restart, cross-surface refresh, keyboard/Escape, all themes, reduced motion and optional English. Test active recall while another surface imports or clears data.

On a host exposing Arabic voices, listen to pronunciation, verify start/stop/end and closure cancellation, and test remote/unknown speech only after durably saved consent. Browser-reported locality is the policy signal; voice names alone do not prove locality. Check Explore save feedback with an actual screen reader. The earlier host exposed no Arabic voices and the current agent browser interface cannot control extension internals.

GitHub beta downloads, source merge, privacy deployment, Chrome Web Store submission and store publication are distinct steps. Do not infer one from another.


## Historical 0.4.1 fixed-pool test snapshot, 16 October 2026

This snapshot was superseded by the user's discovery-core correction. Its results do not validate the subsequent source-only daily flow.

Sol medium implemented the midnight fix and editorial pass. Sol low independently inspected the integration and experimental disclosures. No submission or publication occurred.

`python3 verify.py` passed in a disposable copy: 454 tests, JavaScript syntax, canonical/generated vocabulary parity, deterministic Chrome/Firefox packages and whitespace. The new selection regression covers 90 simulated daily assignments and excludes pending records while preserving existing assignments. Date regressions include stale Atlas state, crossing midnight during asynchronous profile loading, UTC+14 and UTC-10.

The packaged Chromium extension passed 12 checks in `tests/e2e/daily.cjs` in a fresh disposable profile, fully offline. Visible controls verified immediate local daily content without setup or host grants, save/reopen/Atlas parity, difficult-word enrollment, rating through the due-review control across simulated local midnight, experimental settings defaulting off, JSON export/clear/import, restart persistence and archive warnings. There were no page errors or external requests. Evidence is at `/tmp/kalimat-041-daily-e2e/report.json`; full repository output is `/tmp/kalimat-041-verification.log`. Temporary profiles were removed.

The root inspected actual popup and Atlas screenshots. This run renders the real extension popup page rather than opening the physical toolbar bubble. It uses the browser file input rather than a native file picker. It simulates clocks rather than waiting overnight. The complete source-enabled live network flow, native Firefox, actual Arabic audio, screen-reader announcements and a real MV3 worker suspension/resumption remain unverified for this candidate. Discovery remains experimental. The 30-entry pool has source-backed agent review, not human Arabic-editor certification, and does not constitute a full year of reviewed words.
