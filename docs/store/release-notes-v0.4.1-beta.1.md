# Kalimat 0.4.1 beta: source-based daily discovery

This GitHub beta makes discovery the daily-word experience in the popup and Atlas. After you enable sources and grant optional Arabic Wikipedia and Wiktionary access, Kalimat searches public material for new words. You can save a word, mark it as known and revisit it through Atlas and optional recall practice.

There is no hardcoded teaching-list fallback. If discovery finds no suitable word and no unseen cached source card is available, Kalimat reports that a new word is unavailable. The earlier 365-word collection remains an archive for existing saved words, history and exploration.

## Sources and non-commercial use

The extension bundles Arabic Wiktionary reference data and a new supplement of **44 LMF Contemporary Arabic dictionary senses**. The LMF data come from Driss Namly, Ibtikarat team, 2015, under **CC BY-NC 4.0**. Kalimat remains a non-commercial project. Reading the bundled LMF data adds no request to its publisher. Online discovery requests go directly to the optional Arabic Wikimedia origins.

The offline importer scans the complete pinned source XML. It retains each definition with examples from the same source sense, original part of speech, source context and content identity. It applies the existing frequency and quality checks, excludes dependent noun glosses and third-party quotations, and holds identified faulty or uncertain source records. It does not generate wording or punctuation. The [source notice](../../extension/data/lmf-NOTICE.md) records attribution, licensing and construction details.

Source attribution does not establish correctness. Automatically sourced definitions and examples remain visibly unreviewed and can contain errors. This beta does not claim human semantic certification.

## Daily behavior and existing data

An assigned daily word stays the same after reload, restart or a settings change. At the next date, a new eligible source word can be assigned. Marking a word as known excludes it from future discovery. Existing saved words, history, preferences, feedback and review schedules remain compatible. Extension backups retain sourced cards and their attribution. Previously stored source cards remain available offline.

The website now introduces the extension and provides installation, privacy and help links. Existing website reading links and the earlier lexicon remain accessible. Website and extension data stay separate, with no automatic migration.

## Verification and limits

- **466 JavaScript checks and 11 Python importer checks pass.**
- Six frozen-corpus runs cover 30 simulated dates each, excluding previously returned words. Original-corpus results improved from **9/10/11** to **28/28/27** successful days. Held-out results improved from **16/13/16** to **30/27/30**. Each run meets the fixed target of at least 27 successful days.
- Five live API-backed discoveries on simulated dates returned five cards, including four from LMF. This is a small live check, not five days of unattended use.
- The packaged Chromium candidate passes 13 interaction and persistence checks, including restart, backup import/export and review across simulated midnight.

These results demonstrate bounded supply improvement. They do not establish reliable year-round supply. Native Firefox behavior, the native browser-toolbar interaction, audible speech, screen-reader use and actual Manifest V3 worker suspension remain unverified. See [verification](../VERIFICATION.md) and the [supply evaluation](../DISCOVERY-SUPPLY.md).

## Downloads and release status

The **v0.4.1-beta.1 GitHub prerelease** uses extension manifest version `0.4.1`. Download `kalimat-chrome-0.4.1.zip` or `kalimat-firefox-0.4.1.zip` from the [GitHub release](https://github.com/Assem130/Kalimat-365/releases/tag/v0.4.1-beta.1). Extract the Chrome archive before loading it unpacked. Firefox uses temporary installation and removes the extension on browser restart. Follow the [installation instructions](../DEVELOPMENT.md#extension-installation-and-packaging).

This GitHub beta does not update or establish approval by the Chrome Web Store or Firefox store. Store submission remains separate. The [listing kit](listing.md) contains prepared copy and the [privacy policy](https://assem130.github.io/Kalimat-365/privacy.html) describes the network and local-data boundaries.
