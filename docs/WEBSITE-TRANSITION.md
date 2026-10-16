# Extension support website

The user approved the website transition on 16 October 2026 and later authorized GitHub shipping. The root page now introduces the extension and provides installation, privacy and help. The transition is included with the v0.4.1-beta.1 GitHub beta. GitHub, website deployment and browser-store publication have separate status.

## Preserved access

- `legacy.html` retains the previous home and lexicon, on the same origin and deployment subpath.
- `word.html`, `?id=` and `?date=` links retain their reading and storage behavior. `word.html?action=history` opens history and JSON export controls.
- Existing root `#lexicon-explorer` links forward to the preserved lexicon. The root page does not load the vocabulary or learning runtime.
- Existing learning, reminder and appearance storage keys remain untouched. The support page has a separate appearance preference.
- The updated service worker caches both the support site and preserved pages. Cache versioning updates assets without deleting localStorage.

The recoverable source baseline is `/tmp/kalimat-pre-support-site-20261016.tar.gz`; the pre-existing diff is `/tmp/kalimat-pre-support-site.patch`.

## Release boundaries

The [v0.4.1-beta.1 GitHub prerelease](https://github.com/Assem130/Kalimat-365/releases/tag/v0.4.1-beta.1) uses extension manifest version 0.4.1 and includes source discovery in the daily popup and Atlas. It adds 44 source senses from the LMF Contemporary Arabic dictionary under CC BY-NC 4.0 for Kalimat's non-commercial use. It retains the older vocabulary as an archive and uses no hardcoded fallback for a new daily word. See the [release notes](store/release-notes-v0.4.1-beta.1.md).

The support-site screenshot is an extension preview, not proof of the store's appearance. It was captured from the actual popup at 380 × 600 in a disposable offline Chromium profile, after importing test data assigning bundled word ID 3 (الدِّيمَة). No screenshot DOM was fabricated. The GitHub beta does not update the Chrome Web Store or establish Chrome/Firefox store approval. Firefox's beta uses temporary installation and is removed on browser restart.

## No data migration

Website and extension data remain separate. Atlas accepts extension JSON only. Do not import a website export into Atlas. A future converter requires separate authorization, backup, validation, conflict preview and additive import with restoration checks. This transition does not implement one.

## Publication

GitHub shipping is authorized. Record the GitHub release and website deployment outcomes separately, including whether the public privacy page matches this source. Store submission remains separate. Existing website data and reading links must remain accessible after deployment.
