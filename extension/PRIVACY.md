# Kalimat privacy

Kalimat keeps your profile in browser local extension storage (`storage.local`). Learning data stays in the browser's local extension storage: selection preferences, assignments, feedback, saved words, recall records and reminder settings. These records do not establish proficiency or learning outcomes.

There is no account, backend or sync. There is no analytics or tracking. The extension does not read the pages you visit. Dictionary and speech requests described below are separate from profile storage.

## Pronunciation

By default, the extension uses only an Arabic voice reported as local by the browser. Voice availability and that locality report depend on the browser/OS; a missing local voice is reported rather than silently using a remote voice. You can opt in to remote browser speech in Atlas settings after the disclosure. On Chrome or Firefox, remote speech may send the spoken text to the browser's speech provider. The extension does not control that provider's handling of requests. Website speech retains its separate browser/OS-dependent behavior.

## Dictionary lookup

Online Arabic dictionary lookup is optional on Chrome, after explicit search submission and the optional Wiktionary host permission. Only the normalized query is transmitted directly to Wikimedia servers (`ar.wiktionary.org`). Wikimedia may process standard network connection metadata. No profile data, visited pages or cookies are sent; there are no background dictionary requests and no lookup history is retained in your profile.

Online results are visibly unreviewed and cannot be saved or used for feedback, history, daily selection or export. Firefox dictionary lookup is local; opt-in remote browser speech remains available separately.

## Controls and separate website data

Daily reminders are optional and use alarms/notifications permissions after you enable them. Atlas provides JSON export and extension-only JSON import. Website state is separate browser `localStorage`; its JSON format is distinct and no automatic migration is provided.

Atlas clear-data attempts to delete the profile and disable reminders independently. Profile deletion can succeed while reminder disabling fails or the reminder state is unreadable. The interface reports partial or unknown outcomes and asks you to check reminder settings; a temporary, unpersisted clear is also reported. Export before deletion if you need a backup.

The [public policy](https://assem130.github.io/Kalimat-365/privacy.html) describes both the extension and the separate legacy website. Store updates must link to the current policy.
