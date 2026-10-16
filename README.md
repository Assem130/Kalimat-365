# كَلِمات · Kalimat

كلمة عربية واحدة كل يوم، بمعناها وسياقها، لمن يتحدث العربية ويحب اكتشافها.

Kalimat is Arabic-first enrichment for people who already speak Arabic. The extension offers one daily encounter. Atlas supports deeper exploration, voluntary recall and settings. English is optional. Literary and uncommon words are welcome on editorial merit.

On first use, enable daily sources and grant access to Arabic Wikipedia and Wiktionary. Discovery then supplies the main daily word in both the popup and Atlas. Bundled reference data from Arabic Wiktionary and the LMF Contemporary Arabic dictionary support local selection. Reading the LMF data makes no request to its publisher. Meanings and examples retain source links and are not human-certified. If no suitable result is available, Kalimat explains that instead of substituting a word from a fixed list. Previously discovered cards and saved history remain available offline.

A daily word stays the same after reload, restart or a settings change. Later days can receive new source words automatically. Source settings and interests are in Atlas settings. Marking a sourced word as known excludes it from future discoveries and preserves its saved state and review schedule.

## Install and test the extension

The **[v0.4.1-beta.1 GitHub beta](https://github.com/Assem130/Kalimat-365/releases/tag/v0.4.1-beta.1)** uses extension version **0.4.1**. New daily words come from discovery, not a curated rotation. The earlier 365-word collection remains an archive so existing saved words and history keep working. See [release notes](docs/store/release-notes-v0.4.1-beta.1.md) and [local Chrome/Firefox installation](docs/DEVELOPMENT.md#extension-installation-and-packaging). To build from source, run `python3 verify.py`. The [Chrome Web Store](https://chromewebstore.google.com/detail/dlfllbncnbfpnocdaeddejjjldohmefe) remains a separate distribution channel; the GitHub beta does not update the store or establish store approval.

`Kalimat-365` is the repository slug, not a 365-day course promise. The packaged Chromium candidate passes 13 interaction and persistence checks, including restart, backup import/export and simulated midnight. Native Firefox, native toolbar interaction, audible speech, screen readers and actual worker suspension remain unverified. [Verification evidence](docs/VERIFICATION.md) records these boundaries. Arabic speech availability depends on your browser and installed voices.

The source expansion adds 44 LMF source senses with exact meaning/example provenance. All six 30-date frozen-corpus runs meet the fixed target of at least 27 successful days, and five live API-backed discoveries on simulated dates returned five cards. These checks do not establish reliable year-round supply or certify source meanings. See the [source investigation and limits](docs/DISCOVERY-SUPPLY.md).

## Privacy and help

Profile data stays in browser `storage.local`; no accounts, telemetry, analytics, sync or backend are provided. Pronunciation uses a browser-reported local Arabic voice by default; optional remote speech may send text to the browser's speech provider. Source mode requests optional access to Arabic Wikipedia and Wiktionary. An explicit dictionary lookup can separately request Wiktionary access. Firefox dictionary lookup stays local. Clear-data attempts profile deletion and reminder disabling independently and reports partial or unknown outcomes.

- [Extension privacy](extension/PRIVACY.md), [policy source](privacy.html) and [published policy](https://assem130.github.io/Kalimat-365/privacy.html). The policy explains local speech, optional remote speech and dictionary requests separately.
- [Report a bug](https://github.com/Assem130/Kalimat-365/issues/new?template=bug-report.yml) or [get help](https://github.com/Assem130/Kalimat-365/issues).
- [Product context](CONTEXT.md), [documentation](docs/README.md) and [contributing](CONTRIBUTING.md).

## Supporting website

The support website in this release introduces the browser extension and provides installation, privacy and help links. Its product preview represents the extension beta. The [public website](https://assem130.github.io/Kalimat-365/) and Chrome Web Store are separate publication surfaces. The GitHub beta includes source discovery; older downloads and store versions can show an earlier experience.

Run `python3 server.py` and open <http://localhost:8000/> (`python` on Windows). The previous website is retained at `legacy.html`; `word.html` links and existing browser data still work. Use `word.html?action=history` for the history and JSON export controls. Website and extension JSON formats remain distinct, with no automatic migration. See [transition details](docs/WEBSITE-TRANSITION.md).

## License status

Kalimat is maintained as a non-commercial project. The bundled LMF dictionary text retains [CC BY-NC 4.0, attribution and source details](extension/data/lmf-NOTICE.md). Arabic Wiktionary and wordfreq data retain their [Wiktionary](extension/data/discovery-index-notice.md) and [wordfreq](extension/data/wordfreq-NOTICE.md) terms. These data licenses do not grant a source-code license for this repository. Bundled fonts have their own [website](assets/fonts/OFL.txt) and [extension](extension/assets/fonts/OFL.txt) licenses, which cover the fonts.
