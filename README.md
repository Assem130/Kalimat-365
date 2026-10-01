# كَلِمات · Kalimat

كلمة عربية واحدة كل يوم، بمعناها وسياقها، لمن يتحدث العربية ويحب اكتشافها.

Kalimat is Arabic-first enrichment for people who already speak Arabic. The extension offers one daily encounter; Atlas supports deeper exploration, voluntary recall and settings. English is optional. Literary and uncommon words are welcome on editorial merit.

## Install and test the extension

The first milestone is a **source candidate**. Run `python3 verify.py`, then follow [local Chrome/Firefox installation and packaging](docs/DEVELOPMENT.md#extension-installation-and-packaging). The [Chrome Web Store](https://chromewebstore.google.com/detail/dlfllbncnbfpnocdaeddejjjldohmefe) is an existing public channel; its current version and contents are unverified. Prior `0.3.0` publication statements are historical repository records. [beta.2 archives](https://github.com/Assem130/Kalimat-365/releases/tag/v0.3.0-beta.2) describe that snapshot only.

Manifest version `0.3.0` does not establish a new release. `Kalimat-365` is the repository slug, not a 365-day course promise. Actual popup/Atlas layout, keyboard and audio acceptance remain unverified because available automation blocks `chrome://extensions`. No current popup screenshots are claimed.

## Privacy and help

Profile data stays in browser `storage.local`; no accounts, telemetry, analytics, sync or backend are provided. Pronunciation uses a browser-reported local Arabic voice by default; optional remote speech may send text to the browser's speech provider. Chrome's explicit dictionary lookup separately requests Wiktionary permission; Firefox dictionary lookup stays local. Clear-data attempts profile deletion and reminder disabling independently and reports partial or unknown outcomes.

- [Extension privacy](extension/PRIVACY.md), [candidate policy source](privacy.html) and [published policy](https://assem130.github.io/Kalimat-365/privacy.html). The local policy correction must be published alongside any approved release; deployment has not changed here.
- [Report a bug](https://github.com/Assem130/Kalimat-365/issues/new?template=bug-report.yml) or [get help](https://github.com/Assem130/Kalimat-365/issues).
- [Product context](CONTEXT.md), [documentation](docs/README.md) and [contributing](CONTRIBUTING.md).

## Existing website

The [website](https://assem130.github.io/Kalimat-365/) retains its word, home, permalink and offline experience. To run locally, use `python3 server.py` and open <http://localhost:8000/> (`python` on Windows). Website data uses separate `localStorage`; website and extension JSON formats do not automatically migrate. The [website transition proposal](docs/WEBSITE-TRANSITION.md) describes a future support site and preservation plan; it is not implemented.

## License status

This repository has no source-code license. Bundled fonts have their own [website](assets/fonts/OFL.txt) and [extension](extension/assets/fonts/OFL.txt) licenses, which cover the fonts.
