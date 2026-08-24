# Kalimat v0.3.1

## Stabilization release

This release keeps Kalimat focused and local-first while making exports, offline behavior, recovery, and beta evaluation more reliable.

- Website CSV and PNG exports now use the same shared implementation as the extension.
- Anki CSV is labelled as vocabulary content only; review schedules are not exported.
- Local fonts and the favicon are available offline, while obsolete audio and external-font caching are removed.
- The popup recovery screen can open Atlas without duplicating import/export controls.
- The website reminder explains that it works only while a Kalimat page remains open.
- Dead dialogs, aliases, export rendering, audio caching, styles, and tests were removed.
- Day 0/7/14/21 study forms and dependency-free local analysis tools were added. Missing Day-21 data returns `insufficient`, never a pass.

No account, backend, synchronization, telemetry, gamification, corpus replacement, or review-schedule migration is included. Website and extension learner profiles remain separate.

## Packages

| Archive | Size | SHA-256 |
| --- | ---: | --- |
| `kalimat-chrome-0.3.1.zip` | 499,089 bytes | `7b7ca73250ff3f96d4d844541d2389eea91525964f9088737508cb48e97179a4` |
| `kalimat-firefox-0.3.1.zip` | 499,184 bytes | `be665b23549d43f9e3cef5716a7c0b5e075954ab18385e647feeb193d07a823f` |

Both archives contain the validated 32-file runtime allowlist. Firefox store submission remains postponed.

## Verification

- `node test.js` — pass.
- Website tests — 97/97 pass.
- Extension tests — 259/259 pass.
- Packaging tests — 13/13 pass, including byte-identical clean builds.
- JavaScript syntax checks and `git diff --check` — pass.

Live desktop, 390px, offline-font, legacy-profile, and packaged-Chrome browser smoke tests remain unclaimed because the in-app browser blocked local navigation in this environment. Promotion to 0.4.0 and 1.0 remains behind the documented real 21-day learner study and curriculum-approval gates.
