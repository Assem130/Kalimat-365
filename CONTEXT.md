# Kalimat product context

This is the authoritative direction for the daily-discovery milestone. Kalimat (كَلِمات) is Arabic-first enrichment for people who already speak Arabic: one excellent daily encounter with a word, its meaning and a useful context. English is optional, secondary support. Literary and uncommon words belong when their meaning, context and editorial merit justify the encounter.

## Product boundary

- The Chrome/Firefox MV3 extension is the primary product. Its popup presents the daily encounter, optional pronunciation, saving and a route to Atlas. It does not require an initial setup detour.
- Atlas provides deeper exploration, voluntary recall practice and administration: preferences, reminders, export, import and deletion.
- The legacy level field remains only for stored-schema compatibility and no longer gates or ranks daily selection. Optional Atlas interests still influence selection. Neither is a proficiency measurement. Reading history, saving, feedback and recall are observations, not proof of learning or mastery.
- The existing website remains available with its universal date-based word, lexicon, permalinks, browser speech, local review and reminder. Its runtime is frozen for this milestone. The [supporting website proposal](docs/WEBSITE-TRANSITION.md) requires separate approval.
- No accounts, sync, backend, telemetry, analytics, corpus expansion, points, competitive rewards or new learning machinery. Reading streaks remain only in the frozen legacy website and stored compatibility data; the extension does not display them. No proficiency gates or inferred-learning claims.

## Storage and privacy

Website state is separately stored in `localStorage` under `arabic_words_state`; website clear-data removes that state, onboarding (`kalimat_onboarded`) and reminders (`kalimat_reminder`), retaining `kalimat_theme`. Extension profile and reminder state use browser `storage.local`. They do not sync or automatically migrate. The JSON formats are distinct; Atlas imports extension JSON only.

Both surfaces provide export and deletion controls. Extension clear-data attempts profile deletion and reminder disabling independently. It reports temporary, partial or unknown results when persistence or reminder state cannot be confirmed; profile deletion can succeed while reminders remain enabled or unreadable.

Extension speech selects a browser-reported local Arabic voice by default. Informed remote-speech opt-in in Atlas may send spoken text to the browser's speech provider on either browser. Website speech retains browser/OS-dependent behavior. Chrome dictionary lookup is separately gated by explicit submission and optional Wiktionary permission; Firefox dictionary lookup is local. See [extension privacy](extension/PRIVACY.md) and the [policy source](privacy.html). Verify the public policy deployment before submitting a store update.

## Runtime and distribution facts

The app uses vanilla HTML/CSS/JavaScript. `app-core.js`, `app.js`, `revamp.js`, `web-ui.js` and `sw.js` retain the website runtime. Shared review and speech adapters remain compatible with website callers. `words.js` is the canonical 365-entry set; stable IDs and separate stores are preserved. See [editorial scope and provenance](docs/EDITORIAL.md).

`Kalimat-365` is the repository slug, not a promise of a 365-day course. The daily-discovery milestone uses manifest version `0.4.0`; GitHub packages and Chrome Web Store publication are separate distribution steps. The Chrome Web Store link is an existing channel; historical publication records do not establish its current contents. A read-only store lookup was inaccessible, so deployed version and listing remain unverified. The earlier [beta protocol](docs/beta/2026-08-10-kalimat-21-day-beta.md) is historical and does not govern current direction.

## Verification boundary

Installed Chrome evidence covers the actual toolbar popup, daily encounter, Atlas navigation, Explore saving, export/import/clear, close/reopen and extension reload. It does not prove actual worker termination, audible Arabic quality or assistive-technology announcements. Final executable regressions supplement that evidence. See [verification](docs/VERIFICATION.md) for methods and limits and the [development guide](docs/DEVELOPMENT.md) for local installation.
