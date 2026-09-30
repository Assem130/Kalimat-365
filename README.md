<p align="center">
  <img src="assets/readme-hero.svg" alt="كَلِمات" width="720">
</p>

<h1 align="center" dir="rtl">كَلِمات</h1>

<p align="center" dir="rtl">كلمة عربية فصيحة واحدة كل يوم: اسمعها، افهم معناها، وراجعها حتى تثبت.</p>

<p align="center">
  <a href="https://assem130.github.io/Kalimat-365/">الموقع</a>
  ·
  <a href="https://chromewebstore.google.com/detail/dlfllbncnbfpnocdaeddejjjldohmefe">متجر كروم</a>
  ·
  <a href="https://assem130.github.io/Kalimat-365/privacy.html">الخصوصية</a>
</p>

<p align="center">
  <a href="https://github.com/Assem130/Kalimat-365/actions/workflows/verify.yml?query=branch%3Amain"><img src="https://github.com/Assem130/Kalimat-365/actions/workflows/verify.yml/badge.svg?branch=main" alt="Verify Kalimat on main"></a>
</p>

Kalimat is a local-first Arabic learning experience for intermediate and advanced learners: one daily word, meaning, context, browser speech, and local review from a focused **365-word corpus**.

## Try Kalimat

- **Website:** open [Kalimat](https://assem130.github.io/Kalimat-365/).
- **Chrome companion:** install from the [Chrome Web Store](https://chromewebstore.google.com/detail/dlfllbncnbfpnocdaeddejjjldohmefe).
- **Status:** public beta. Chrome `0.3.0` is published; Firefox store submission is postponed.
- **Source and archives:** `main` contains ongoing work. The [beta.2 release](https://github.com/Assem130/Kalimat-365/releases/tag/v0.3.0-beta.2) contains historical `0.3.0` downloads and does not track current `main` or subsequent store updates. See [local installation and packaging](docs/DEVELOPMENT.md#extension-installation-and-packaging) for testing the current source.

## Website and extension

These are separate local experiences. They do not sync.

| | Website | Chrome / Firefox extension |
| --- | --- | --- |
| Daily word | Universal, date-based selection | Personalized by challenge level and interests |
| Explore and review | Full lexicon and local spaced review | Atlas and the same review policy |
| Reminder | Opt-in notification while a Kalimat tab is open | Separate opt-in browser alarms and notifications |
| Learning data | Browser `localStorage` | Browser `storage.local` |

No account, backend, telemetry, analytics, points, competitive rewards, or vocabulary expansion. Reading streaks remain available. Kalimat is not a beginner course.

## Screenshots

<table>
  <tr>
    <td align="center"><img src="docs/store/screenshots/01-daily-word.png" alt="Website daily word with meaning, context, and speech control" width="260"><br><strong>Daily word</strong><br>Website meaning, context, and pronunciation.</td>
    <td align="center"><img src="docs/store/screenshots/02-review.png" alt="Website review dialog with recall controls" width="260"><br><strong>Local review</strong><br>Website recall and review controls.</td>
    <td align="center"><img src="docs/store/screenshots/03-atlas.png" alt="Extension daily word in Atlas" width="260"><br><strong>Atlas</strong><br>Extension daily word in Atlas.</td>
  </tr>
</table>

## Privacy

Learning data stays on-device until you delete it. Both surfaces offer JSON export and deletion. Website fonts are bundled locally.

Chrome can make an explicit, read-only Arabic Wiktionary lookup when you submit a search, sending only the normalized term. Firefox stays local-only. Read the [website privacy policy](https://assem130.github.io/Kalimat-365/privacy.html) and [extension privacy details](extension/PRIVACY.md).

## Development and documentation

Run the website locally with Python 3:

```sh
git clone https://github.com/Assem130/Kalimat-365.git
cd Kalimat-365
python3 server.py
```

Open <http://localhost:8000/>. On Windows, use `python` instead of `python3`.

- [Development guide](docs/DEVELOPMENT.md): verification, local extension installation, packaging, corpus maintenance, and project map.
- [Documentation index](docs/README.md): product context, privacy, store material, beta study, and historical release notes.
- [Contributing](CONTRIBUTING.md): focused bug reports and pull requests.
- [Report a bug](https://github.com/Assem130/Kalimat-365/issues/new?template=bug-report.yml).

## License status

This repository does not include a source-code license. The bundled Amiri and Outfit fonts have their own [website font license](assets/fonts/OFL.txt) and [extension font license](extension/assets/fonts/OFL.txt); those licenses cover the fonts.
