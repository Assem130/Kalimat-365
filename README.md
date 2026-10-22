# كَلِمات · Kalimat

كلمة عربية واحدة كل يوم، بمعناها وسياقها، لمن يتحدث العربية ويحب اكتشافها.

Kalimat is Arabic-first enrichment for people who already speak Arabic. The extension offers one daily encounter. Atlas supports deeper exploration, voluntary recall and settings. English is optional. Literary and uncommon words are welcome on editorial merit.

The current source contains a 14-day pilot of approved Arabic encounters. Everyone receives the same entry for their local calendar date, starting from 22 October 2026. After day 14, approved entries repeat. The pilot works offline and needs no source permissions. It adds its encounters alongside existing history and preserves saved words. The reading page presents the full entry until dismissed, then a compact reminder for the rest of the day. Open it from the popup. Normal packages keep existing new tabs unchanged, with a separate optional new-tab build. Occasional recall uses earlier words you actually encountered. See [pilot operation](docs/PILOT.md).

A daily word stays the same after reload, restart or a settings change. The pilot uses the approved calendar, without automatic publication of new content. Older source cards remain accessible in Atlas with their saved state and review history.

## Install and test the extension

Current source builds **0.5.1**, combining the pilot with the upstream fix for legacy profiles after temporary storage failures. Run `python3 verify.py`, then follow the [local Chrome/Firefox installation guide](docs/DEVELOPMENT.md#extension-installation-and-packaging). See [0.5.1 changes and distribution status](docs/store/release-notes-v0.5.1.md).

The [Chrome Web Store](https://chromewebstore.google.com/detail/dlfllbncnbfpnocdaeddejjjldohmefe) dashboard showed **0.5.0 pending review** on 22 October 2026, with automatic publication after approval. That submitted package does not contain the later storage fix. Committing 0.5.1 to GitHub does not replace the submitted package or change its review.

The [v0.4.1-beta.1 download](https://github.com/Assem130/Kalimat-365/releases/tag/v0.4.1-beta.1) is an older source-discovery build. Its [release notes](docs/store/release-notes-v0.4.1-beta.1.md) and [source investigation](docs/DISCOVERY-SUPPLY.md) remain historical records. The 365-word archive stays available for saved-data compatibility. `Kalimat-365` is the repository slug, not a 365-day course promise.

[Verification evidence](docs/VERIFICATION.md) records the tested flows and limits. Native Firefox, physical toolbar interaction, audible speech, screen readers and actual worker suspension remain unverified for this candidate. Arabic speech availability depends on your browser and installed voices.

## Privacy and help

Profile data stays in browser `storage.local`; no accounts, telemetry, analytics, sync or backend are provided. Pronunciation uses a browser-reported local Arabic voice by default; optional remote speech may send text to the browser's speech provider. Optional additional discovery needs a connection and consent for access to Arabic Wikipedia and Wiktionary. The daily pilot needs neither. An explicit dictionary lookup can separately request Wiktionary access. Firefox dictionary lookup stays local. Clear-data attempts profile deletion and reminder disabling independently and reports partial or unknown outcomes.

- [Extension privacy](extension/PRIVACY.md), [policy source](privacy.html) and [published policy](https://assem130.github.io/Kalimat-365/privacy.html). The policy explains local speech, optional remote speech and dictionary requests separately.
- [Report a bug](https://github.com/Assem130/Kalimat-365/issues/new?template=bug-report.yml) or [get help](https://github.com/Assem130/Kalimat-365/issues).
- [Product context](CONTEXT.md), [documentation](docs/README.md) and [contributing](CONTRIBUTING.md).

## Supporting website

The support website introduces the browser extension and provides installation, privacy and help links. Its source describes the current pilot and distinguishes it from older downloads and the dated store record. The [public website](https://assem130.github.io/Kalimat-365/) and Chrome Web Store are separate publication surfaces. Source changes do not confirm publication on either surface. Older downloads and store versions can show an earlier experience.

Run `python3 server.py` and open <http://localhost:8000/> (`python` on Windows). The previous website is retained at `legacy.html`; `word.html` links and existing browser data still work. Use `word.html?action=history` for the history and JSON export controls. Website and extension JSON formats remain distinct, with no automatic migration. See [transition details](docs/WEBSITE-TRANSITION.md).

## License status

Kalimat is maintained as a non-commercial project. The bundled LMF dictionary text retains [CC BY-NC 4.0, attribution and source details](extension/data/lmf-NOTICE.md). Arabic Wiktionary and wordfreq data retain their [Wiktionary](extension/data/discovery-index-notice.md) and [wordfreq](extension/data/wordfreq-NOTICE.md) terms. These data licenses do not grant a source-code license for this repository. Bundled fonts have their own [website](assets/fonts/OFL.txt) and [extension](extension/assets/fonts/OFL.txt) licenses, which cover the fonts.
