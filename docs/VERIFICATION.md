# Daily-discovery verification

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

The source preserves stable IDs and existing user stores. Only the five documented editorial entries were corrected; the other 360 are preserved, not newly linguistically certified. See [editorial scope](EDITORIAL.md).

## Remaining native-device checks

On a disposable profile, check the final 0.4.0 toolbar popup and Atlas together, immediate closure during save, actual service-worker stop/restart, cross-surface refresh, keyboard/Escape, all themes, reduced motion and optional English. Test active recall while another surface imports or clears data.

On a host exposing Arabic voices, listen to pronunciation, verify start/stop/end and closure cancellation, and test remote/unknown speech only after durably saved consent. Browser-reported locality is the policy signal; voice names alone do not prove locality. Check Explore save feedback with an actual screen reader. The earlier host exposed no Arabic voices and the current agent browser interface cannot control extension internals.

GitHub beta downloads, source merge, privacy deployment, Chrome Web Store submission and store publication are distinct steps. Do not infer one from another.
