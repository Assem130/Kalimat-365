# Extension verification

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
