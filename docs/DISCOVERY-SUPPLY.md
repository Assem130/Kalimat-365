# Discovery supply investigation, 17 October 2026

## Acceptance

The user requested source expansion without a hardcoded fallback, weaker quality checks, data changes or publication. The baseline uses 23 usable dictionary/example pairs. A larger raw dictionary is not proof of sustained supply.

Before source selection, the acceptance target was fixed at at least 27 successful daily results over 30 simulated dates, for each of three seeds. All runs must exclude previously encountered lexical words, reject invalid cards and preserve the existing quality controls. The test uses frozen, revision-attributed passages. It measures bounded retrieval capacity, not fresh live searches, Arabic factual certification or a year of lessons.

## Sources checked

### Existing Arabic Wiktionary dump

The pinned dump contains 5,966 pages that transclude 5,964 Wikidata lexemes. These counts do not establish usable meanings or examples. Supporting additional example markers, nested senses and headings increased automatic dictionary-pair acceptance from 23 to 26. The three additions had weak context, sense mismatch or unresolved attribution. The probe was not integrated.

### Wikidata lexical data

[Wikidata documents](https://www.wikidata.org/wiki/Wikidata:Lexicographical_data/Documentation) sense-level lexical data. Source examples must remain associated with their exact sense. The CC0 label on a record does not resolve the provenance of quotations copied from another dictionary.

A live Arabic query for sense-level usage examples without a described-by-source statement returned eight rows, mostly short fragments. Referenced records from the earlier source probe quote modern dictionaries or modern annotated editions. No blanket lexeme import was added.

### LMF Contemporary Arabic dictionary

The [original LINDAT publisher record](https://lindat.mff.cuni.cz/repository/items/d4d8ef1a-0e51-42d1-9a94-113cb81afa76) identifies Driss Namly, Ibtikarat team, 2015, and a CC BY-NC 4.0 licence. The user explicitly chose to keep Kalimat non-commercial. The unpublished local candidate now includes a filtered LMF reference supplement under those terms.

The downloaded original XML is 54,015,676 bytes. Its MD5 matches the publisher: `f73b253412b8df72ec08d046ba49a519`. SHA256: `776b902ade101446ef1c6f9f37a62791942d6bd30d19b3df8989e997955da9eb`.

The source contains 44,442 entries, 113,069 senses and 65,154 examples. Entry IDs are not unique: there are only 24,904 distinct IDs. Any importer must retain file hash, sense identity and content identity, rather than trusting entry IDs alone.

The evaluation excluded 9,074 examples with explicit third-party attribution. With existing frequency and quality controls, 215 unique words passed the first automated screen. Additional fragment rejection left 82 candidates. This stage removed only a stray closing quote before an existing full stop; it did not invent sentence text or punctuation.

Source review then found that many definitions depend on the XML Context field. For example, a definition of storage capacity cannot become a standalone definition of the adjective storage-related. Rejecting dependent noun contexts left 55 candidates. Named entities, factual errors, sense mismatches and verb/noun mismatches reduced the exploratory upper bound to 45. This was not a list of certified lessons or an accepted-word allowlist.

Examples of rejected problems include a WWII end-date error, a movement definition paired with an adjective describing a military strike, and a displayed verb whose example contains only the corresponding definite verbal noun. The latter also exposed a general gap in dictionary-example grammar checking.

## Implemented source supplement

The offline [LMF builder](../extension/tools/build-lmf-index.py) scans the complete pinned XML. It applies the existing shared quality rules, measured Zipf interval of 1.5 to 3.5, dependent noun-context rejection, named-entity screening and source-specific QA holds. It excludes specialized-domain senses and explicitly attributed third-party quotations. It never generates wording or punctuation. It can remove the XML's stray closing quotation framing before a source full stop. Full-source ingestion found additional sense records missed by the earlier entry-level probe. Independent source review then held two uncertain pairs, leaving **44 source senses across 44 words**.

The catalog preserves original representations, part of speech, exact sense IDs, source Context and accepted raw examples. A source file hash and content-derived record ID distinguish records despite duplicate XML IDs. Rejected third-party quotations are not redistributed as hidden provenance. The packaged [LMF notice](../extension/data/lmf-NOTICE.md) contains attribution, transformations, generation instructions and the exact input and output hashes. The [six source QA holds](../extension/data/lmf-source-holds.json) identify faulty or uncertain source records, not vocabulary chosen for teaching.

The supplement is bundled with the extension. Reading it adds no requests to LINDAT or the dictionary publisher. Opt-in discovery still makes its public article and dictionary requests only to Arabic Wikimedia origins. It does not upload source interests, known-word exclusions or saved cards. LMF cards retain the exact source sense and its attached example. The older teaching archive is not a fallback for discovery.

The output has 44 entries and 41,288 bytes. SHA-256: `1e43090934625e639c487f1b27bb41a9097f545e20b2dfe8e46f4cd0fb234d21`. Two full builds were byte-identical. All 11 isolated importer regressions pass, including source hash checks, same-sense association, context, domain and named-entity boundaries, duplicate IDs and exclusion of third-party text from bundled provenance.

The user accepted the non-commercial source terms. The merged candidate passes the fixed 27-of-30 acceptance target in the measured runs below. This does not establish reliable year-round supply. No generated examples or relaxed quality checks were used.

Original source files and exploratory probes are in `/tmp`, outside the distributable extension. The recoverable project baseline is `/tmp/kalimat-before-source-expansion-20261016.tar.gz`.

## Baseline verification before the supplement

`tests/e2e/supply.cjs` now tests the fixed 27-of-30 target for three seeds on each frozen corpus. It starts with an empty encountered set and excludes each returned lexical word across subsequent dates and topics. It does not exclude the bundled archive as a whole.

The pre-LMF runtime failed the target: each original-corpus run returned 11 of 30 words; each heldout-corpus run returned 16 of 30. Default mode exits nonzero. Explicit report-only mode saves the same failing verdict without stopping the process. The benchmark is a separate shipping gate. The initial forced-topic reports were superseded by the comparable multi-interest measurement below. These baseline results do not evaluate the integrated supplement.

The dictionary-example grammar fix rejects definite-noun-only examples for verb entries, while retaining examples with an actual matching verb. A focused regression protects this distinction. Before LMF integration, all 462 automated tests passed, along with syntax, vocabulary parity, original source replay and both package builds. The eligible Wiktionary dictionary pool remained 23. Log: `/tmp/kalimat-supply-verify.log`.

The pre-LMF packaged Chromium candidate also passed 13 cached/offline UI checks, including saved-state restart, UI export/import and review across simulated midnight. No page errors or external requests occurred; the disposable profile was removed. Evidence: `/tmp/kalimat-supply-daily/report.json`. This run is not evidence of expanded live supply. Final integration and supply results must be recorded separately after testing the merged catalogs.

## Final integrated verification

The runtime tries up to three selected interests when a search succeeds but yields no eligible word. It retains the 20-second total deadline, response bounds and all source quality rules. It stops after a found lesson or a network failure. The frozen harness routes each actual query to its matching topic batch. It does not change the passages with the search offset, so it measures finite corpus capacity.

Both the archived pre-expansion engine and final engine used this same multi-interest harness, seeds, empty initial encountered set, cumulative exclusions and unchanged 27-of-30 threshold:

| Corpus | Before, three seeds | After, three seeds |
| --- | --- | --- |
| Original | 9, 10, 11 / 30 | 28, 28, 27 / 30 |
| Heldout | 16, 13, 16 / 30 | 30, 27, 30 / 30 |

All six final runs pass. Reachable unique words increase from 11 to 28 in the original corpus and from 16 to 37 in heldout. Reports are `/tmp/kalimat-supply-baseline.json` and `/tmp/kalimat-supply-expanded.json`. The supply gate now runs in `verify.py`.

Five real public Wikipedia API requests returned HTTP 200 and produced five distinct lessons for simulated dates, with cumulative exclusions: four LMF cards and one Wiktionary card. Each passed schema, current eligibility, exact meaning/example and source-construction checks. Report: `/tmp/kalimat-lmf-live.json`. This exercises the production discovery module with real responses, not native browser permission consent. Independent checks of 140 LMF emissions across replay and live reports found exact source constructions retained.

The final packaged Chromium workflow imports a source-backed replay card through the visible file input, then checks popup/Atlas context display, save, midnight review, export/clear/import and browser restart. These are disposable-profile checks, not changes to learner data. See `docs/VERIFICATION.md` for final package evidence.

The supplement is generated from a full source scan, not a handpicked daily list. The eligible reference pool is still finite. Longer-term discovery and qualified Arabic review remain follow-up work before stable release.
