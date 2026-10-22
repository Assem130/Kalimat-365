# Kalimat 14-day pilot

## Calendar and content

The common anchor is 22 October 2026. `extension/shared/pilot.js` stores the 14 approved entries with stable `pilot_` IDs, Arabic explanations, original examples and dictionary sources. Day one is منوال. Scheduling uses the local calendar date, with the same entry for everyone on the same date. UTC day arithmetic avoids daylight-saving interval drift. Before the anchor the same cycle extends backwards; after 14 days it repeats approved encounters. New text does not publish automatically. Approve and version any future catalog changes before distribution.

## Reading and recall

The page shows the complete encounter until the user selects اكتفيت لليوم. A compact word reminder then persists across tabs and restarts for that day. اقرأها مجددًا opens the full entry temporarily. The next day restores the full encounter. Saving uses the existing favorites and word-state records.

Every third calendar day can offer one earlier pilot word actually encountered on this profile. It excludes today's word. Reveal is local to the current tab. Skip or Done completes that day's offer across tabs and restarts. There is no recall backlog, score or inferred mastery. Merely opening the page is recorded as an encounter, not proof of reading or learning.

## Build and enable

The submitted 0.5.0 package and current 0.5.1 candidate use the normal package command without `--new-tab`, as requested. It keeps existing browser new-tab pages unchanged. Users open the reading page from the popup link. The override build below is a separate local option.

Run `python3 extension/tools/package.py --new-tab`. The generated `extension/dist/chrome` and `extension/dist/firefox` manifests include `chrome_url_overrides.newtab`. Without the flag they do not override new tabs; the page remains accessible from the popup. The flag never edits source manifests.

Reload the existing unpacked extension from the same path in the browser extension manager. Keep its existing identity and profile. Do not uninstall it or load the update from a different folder if you want to retain its local storage. Browser confirmation may be required to accept a changed new-tab provider. Firefox temporary installations have browser-controlled lifetime limits.

To stop new-tab replacement, build without `--new-tab` and reload the same extension. This retains pilot and legacy data.

## Verify the pilot

Run `python3 verify.py`. With Playwright and Chromium already available, run `KALIMAT_E2E_STORE=1 node tests/e2e/pilot.cjs` to check the normal package through its popup link. To check optional new-tab replacement, build with `--new-tab` and run the same script without `KALIMAT_E2E_STORE`. Rebuild without the flag before preparing a store upload. If needed, set `KALIMAT_PLAYWRIGHT_PATH` to the installed Playwright module and `KALIMAT_CHROMIUM` to the Chromium executable. The script uses disposable profiles and removes them after completion. It writes screenshots and a JSON report to a temporary directory, or to `KALIMAT_E2E_OUTPUT` when specified. See [verification evidence](VERIFICATION.md) for tested behavior and remaining limits.

## Preservation

The existing `kalimat.profile` stores an additive optional `pilot` lane with date-to-ID encounters, dismissal date and completed-recall date. Old assignments, saved words, reviews and history remain. Explicit historical date queries prefer an existing legacy assignment. Atlas history lists both lanes, including overlapping dates, and opens the selected word by ID.

Editorial cards use contentVersion 4 and honest dictionary metadata. They are original examples, not source quotations or automated Wiktionary discoveries. Snapshots reserve 14 extra editorial slots alongside the existing 512 discovery slots. Export/import includes this data with the existing JSON format and size limit. No website storage is migrated.

Storage failures remain visible. Dismissal, saving and recall completion only show success after persistence. The page refreshes on focus, storage changes and local date rollover. Recovery opens through the existing Atlas tools. No accounts, telemetry, backend or source permissions are needed for the pilot.
