# Kalimat privacy

Kalimat keeps your profile in browser local extension storage (`storage.local`). Learning data stays in the browser's local extension storage: selection preferences, assignments, feedback, saved words, recall records and reminder settings. These records do not establish proficiency or learning outcomes.

There is no account, backend or sync. There is no analytics or tracking. The extension does not read the pages you visit. Dictionary and speech requests described below are separate from profile storage.

## Pronunciation

By default, the extension uses only an Arabic voice reported as local by the browser. Voice availability and that locality report depend on the browser/OS; a missing local voice is reported rather than silently using a remote voice. You can opt in to remote browser speech in Atlas settings after the disclosure. On Chrome or Firefox, remote speech may send the spoken text to the browser's speech provider. The extension does not control that provider's handling of requests. Website speech retains its separate browser/OS-dependent behavior.

## Dictionary lookup

Online Arabic dictionary lookup is optional on Chrome, after explicit search submission and the optional Wiktionary host permission. Only the normalized query is transmitted directly to Wikimedia servers (`ar.wiktionary.org`). Wikimedia may process standard network connection metadata. No profile data, visited pages or cookies are sent; manual dictionary lookup makes no background requests and retains no lookup history in your profile. Opt-in daily discovery has its separate requests described below.

Manually queried online lookup results are visibly unreviewed and cannot be saved or used for feedback, history, daily selection or export. Firefox dictionary lookup is local; opt-in remote browser speech remains available separately.

## Daily pilot and optional discovery

The 0.5.0 pilot selects from 14 bundled, approved entries using the local calendar date. Reading a daily entry makes no network request. The extension stores encountered dates, dismissal and recall-completion dates locally. These records are included in JSON backups. Saving a pilot entry does not automatically enroll it in scheduled review. The store package does not replace your browser's new-tab page.

Optional source discovery remains separate from the daily pilot. It stays off until you enable it and grant access to `ar.wikipedia.org` and `ar.wiktionary.org`. When invoked, it requests public Arabic articles and dictionary entries directly from Wikimedia. No account, paid API key, proxy or Kalimat backend is used. Automatically sourced definitions and quotations are unreviewed. You can disable sources in Atlas settings; existing assignments and saved words stay intact. Archived source cards remain available offline. Optional sources do not choose the pilot's daily entry.

These requests disclose your IP address and ordinary connection metadata, together with public article or dictionary titles and topic search terms. Wikimedia handles these requests under its own policies. Kalimat does not transmit your entered text, reading history, saved words, known-word exclusions, profile or API keys. Requests omit browser credentials and cookies. The extension does not read your browsing tabs or visited pages.

Selected topics and already-known word keys stay in local extension storage. Bundled catalogs of definitions and sense-specific examples from Arabic Wiktionary and the LMF Contemporary Arabic dictionary support local selection without uploading passages or word history. The LMF supplement is part of the extension package. Reading it makes no network request to LINDAT or the dictionary publisher. Its [source attribution and CC BY-NC 4.0 terms](data/lmf-NOTICE.md) are separate from Wikimedia's request policies. Kalimat uses it as a non-commercial project. Bundled wordfreq corpus measurements also screen words locally without network requests or a paid service.

Automated source checks screen candidates for incomplete meanings, unsuitable examples and identified faulty source records. They do not establish that a definition or example is correct. Automatically sourced cards are marked as unreviewed and include links and attribution for the exact dictionary sense and its example, or for the article quotation. Accepted card snapshots, including their source details, can be saved locally and remain available after a restart or while offline. Snapshots, discovery preferences and known-word exclusions are included in extension JSON export/import and removed by extension clear-data. They do not sync. An exported backup contains these records, so keep it private if you need to protect your reading interests.

## Controls and separate website data

Daily reminders are optional and use alarms/notifications permissions after you enable them. Atlas provides JSON export and extension-only JSON import. Website state is separate browser `localStorage`; its JSON format is distinct and no automatic migration is provided.

Atlas clear-data attempts to delete the profile and disable reminders independently. Profile deletion can succeed while reminder disabling fails or the reminder state is unreadable. The interface reports partial or unknown outcomes and asks you to check reminder settings; a temporary, unpersisted clear is also reported. Export before deletion if you need a backup.

The [public policy](https://assem130.github.io/Kalimat-365/privacy.html) describes both the extension and the separate legacy website. Store updates must link to the current policy.
