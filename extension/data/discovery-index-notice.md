# Arabic Wiktionary discovery catalog

This catalog contains source definitions from Arabic Wiktionary pages. It supports matching words in public reading passages and selecting examples supplied by the dictionary. It is an imported reference catalog, not a hand-written teaching list. Parser acceptance does not establish that every meaning or example is correct.

Source: the October 1, 2026 [Arabic Wiktionary XML dump](https://dumps.wikimedia.org/arwiktionary/20261001/). Generation uses the local compressed file `arwiktionary.xml.bz2`, downloaded before generation. Its size is 20,929,608 bytes. Its SHA-256 identifies the exact input:

`6310c9c836312b7fd5f4f6bb1e2e0acb8584994e02bb3453b9c713a0589244d8`

Attribution: [Arabic Wiktionary contributors](https://ar.wiktionary.org/wiki/ويكاموس:حقوق_التأليف_والنشر). This transformed catalog retains the [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/) license. Each entry retains its original title, page ID, and revision ID. These identify the source revision for saved cards and attribution. Third-party references within an entry require separate care. Their presence does not establish permission to reuse copied text.

The builder streams main-namespace pages from the compressed XML. It selects Arabic-script titles of 3 to 40 normalized characters and at most three words. It passes the page text to `extension/shared/discovery.js` and retains entries accepted by `parseEntry`. That shared parser controls definition, sense, and example selection. The builder does not translate or generate definitions.

Grouping removes Arabic diacritics and tatweel after NFC normalization. Hamza and ya variants remain distinct. Each group retains the original titles and separate parsed entries. Titles, groups, and entries use deterministic sorting. Identical unvowelled keys do not establish identical meanings.

Generate from an explicit local file without network access. Python 3 and Node.js must already be available. No Python packages are required. XML generation also requires the pinned local wordfreq Arabic file:

```sh
python3 extension/tools/build-discovery-index.py --input /path/to/arwiktionary-pages-articles.xml.bz2 --frequency /path/to/large_ar.msgpack.gz --output extension/data/discovery-index.json
```

Output: compact UTF-8 JSON rows in the form `[normalizedKey, [originalTitles], [parsedEntries]]`. Each parsed entry includes `title`, `pageid`, `revisionId`, `definitions`, `senses`, `partOfSpeech`, and `senseCount`. A sense contains its `definition` and source `examples`. A single-word entry also includes `frequency: {zipf, form}` when a source measurement exists. The builder selects the higher measured score for the normalized key and its definite-article form. It preserves hamza and ya distinctions. It does not infer phrase scores from individual words.

The builder validates the pinned frequency file hash and format before parsing XML. It prints input, output, and frequency hashes, plus sizes and counts after generation. See [wordfreq attribution and provenance](wordfreq-NOTICE.md) for the free source data and its CC BY-SA 4.0 license. Frequency is evidence of commonness and attestation. It does not establish proficiency, lesson value, or a correct meaning.

For compatibility, `.gz` input selects the older title-only mode. That mode reads an all-titles dump and emits `[normalizedKey, [originalTitles]]` rows. It supplies no definitions, examples, or frequency measurements. This inventory-only mode does not require `--frequency`. Runtime enrichment rejects it as unavailable because title lists cannot supply frequency evidence.

Runtime discovery still checks the source context, known-word exclusions, and card validation. Saved definitions and reading quotations retain source attribution. A matching title alone does not establish a usable lesson.

Source QA initially excluded four exact revisions: page 12820 revision 1084156 defines a hypothesis as contrary to fact; page 140115 revision 1079291 gives an incorrect geometric example of a square. Page 199672 revision 1141360 pairs a citizenship definition with a political-dependence example. Page 224746 revision 1141409 has an uncorroborated cooperative sense and is held out pending source review. These exclusions do not select teaching words and do not block future corrected revisions. No source wording is silently rewritten.

Current generated catalog: 2,595 keys, 2,898 source entries, 2,605 measured entries, and 1,984,880 bytes. Output SHA-256: `68fcf332c3f7b463f2b280839183063d6299b5dac2044ffb0187122eab68eb55`. Live article discovery continues between catalog updates.


Enrichment selection uses a conservative Zipf interval of 1.5 to 3.5, where higher values indicate more frequent forms. Unknown measurements fail closed. This interval is a product heuristic, not a validated Arabic proficiency scale. Literal object labels, dependent or grammatical glosses, and incomplete examples are screened separately. Short ambiguous forms need article context instead of dictionary fallback. Source examples stay attached to their exact sense; no meanings or examples are generated. Existing saved cards and assigned days remain unchanged. An unused cached card must pass current checks before a new daily assignment.

Additional source QA holds, identified during Arabic review on October 16, 2026:

| Page:revision | Reason |
| --- | --- |
| 9740:1086519 | Theory presented as conjecture; scientific sense also incorrectly says theories become facts. |
| 134191:1091225 | Receiving is incorrectly restricted to willing receipt. |
| 140652:1091788 | Exception is universally restricted to part-of-whole cases. |
| 225039:1140858 | Suspect shelter gloss and anomalous synonym; held pending source review. |
| 224876:1140921 | Status-elevation meaning paired with rising above trivialities; scope held for review. |
| 14954:1091774 | Settling in a place is restricted to land previously belonging to others. |
| 225040:1141107 | Selected relapse example is a noun fragment; held pending source review. |

These holds identify source revisions, not teaching vocabulary. They do not alter old saved snapshots or prevent a corrected revision from being considered. Automated checks are conservative screening, not factual certification.
