# LMF Contemporary Arabic dictionary supplement

This supplement imports source definitions and same-sense examples from the **LMF Contemporary Arabic dictionary**. It is a reference-source supplement, not a fixed list of teaching words. Automated acceptance does not certify factual accuracy or Arabic teaching quality.

Source attribution: **Namly, Driss, 2015, LMF Contemporary Arabic dictionary**, published by the Ibtikarat team. The XML credits Driss Namly and Mohammed Karim Bouzoubaa for its development. The dictionary is based on *معجم اللغة العربية المعاصرة* by Ahmed Mukhtar Abdul Hamid Omar and a working group.

The primary publisher record is the [LINDAT/CLARIAH-CZ digital library record](https://lindat.mff.cuni.cz/repository/items/d4d8ef1a-0e51-42d1-9a94-113cb81afa76), at Charles University, Institute of Formal and Applied Linguistics, Faculty of Mathematics and Physics. Its persistent handle is [11372/LRT-1944](https://hdl.handle.net/11372/LRT-1944). The record identifies the resource as publicly available under [Creative Commons Attribution-NonCommercial 4.0 International](https://creativecommons.org/licenses/by-nc/4.0/). **The imported LMF text retains CC BY-NC 4.0.** Keep this attribution, license link and description of modifications with redistribution.

The local build uses the original `LMF-Cont.xml`, not a third-party CSV conversion. The publisher file has 54,015,676 bytes and MD5 `f73b253412b8df72ec08d046ba49a519`. Its pinned SHA-256 is:

`776b902ade101446ef1c6f9f37a62791942d6bd30d19b3df8989e997955da9eb`

The file contains 44,442 XML lexical entries and 113,069 senses. There are 24,904 distinct entry IDs. Repeated entry IDs alone cannot identify a unique source record.

## Transformation and source boundaries

The builder scans the whole source. It does not use an accepted-word allowlist. It retains Arabic-script titles of 3 to 40 normalized characters and at most three words. It uses the source `WordForm` representation, or the source lemma when no representation exists. It preserves the source part of speech.

Frequency uses the same pinned [wordfreq Arabic measurements](wordfreq-NOTICE.md) as the Wiktionary catalog. A title needs a measured Zipf value from 1.5 to 3.5. The measurement can come from its exact unvowelled form or its definite-article form. A phrase does not receive a guessed score from its component words. Frequency values retain their separate CC BY-SA 4.0 attribution and license. They do not establish a correct sense or learner level.

Each imported entry represents one exact source sense. Its definition and examples come from that sense. The builder uses the existing shared definition, usefulness and example rules. It rejects source noun senses whose `Context` names more than the lemma or its definite-article form. For example, a definition of `السعة التخزينية` cannot become a definition of `تخزينية`. It also rejects domain-labeled senses, because the current lesson model presents general Arabic without a specialized-domain label.

An example needs complete source punctuation and must pass the current target-word and sentence checks. The builder rejects slash alternatives, colon glosses, bracketed content and unsupported markup. It does not add punctuation or generate wording. Where the source XML ends an example with a stray closing quotation mark followed by a full stop, the builder removes that quotation framing and retains the existing full stop. It retains the exact raw framing for accepted examples in the catalog provenance.

Examples with an explicit third-party `source` label are excluded. These include Quran, hadith and poetry quotations. Excluded quotations are not retained as hidden text in the bundled catalog. Named entities are screened separately. The [source QA ledger](lmf-source-holds.json) holds six reviewed source senses for incorrect or unsupported factual framing or mismatched or uncertain examples. It identifies the pinned source file and exact source IDs. It does not select teaching vocabulary or silently rewrite source text.

Each entry retains `source.kind`, `sha256`, `entryId`, `senseId` and a 32-hex-character `recordId`. The record ID derives from SHA-256 over canonical source lemma, word form, part of speech, definition, contexts, domains and original example records. The digest can include rejected example records, but their text is not redistributed. Identical content is deduplicated. Different content with a repeated XML ID gets a different record ID. Accepted entries also retain source context, original representations and exact raw accepted examples. No synthetic Wiktionary page or revision IDs are emitted.

## Generation and current output

Python 3 and Node.js must already be available. The builder uses no additional packages and performs no network requests. It validates the exact LMF and frequency input hashes before writing output.

```sh
python3 extension/tools/build-lmf-index.py --input /path/to/LMF-Cont.xml --frequency /path/to/large_ar.msgpack.gz --output extension/data/lmf-index.json
```

The compact JSON uses `[normalizedKey, [originalTitles], [senseEntries]]` rows. Sorting is deterministic. Generation reports input and output hashes, output size, and source-filter counts. Reproduce the source-boundary regressions with:

```sh
python3 extension/tests/lmf-importer.test.py
```

Current output: **44 keys, 44 sense entries and 41,288 bytes**. SHA-256:

`1e43090934625e639c487f1b27bb41a9097f545e20b2dfe8e46f4cd0fb234d21`

The whole-source build processed 18,800 frequency-eligible entries and 42,759 corresponding senses. It screened out 3,763 domain-labeled senses, 1,144 dependent noun contexts, eight named-entity records, seven records matching the six source QA holds and 2,034 explicitly attributed example records. These counts describe the build stages and are not all-source totals or unique-word counts. It deduplicated 2,162 candidate sense records before shared quality checks. The 44 accepted records provide additional source capacity, not evidence of reliable year-round daily supply.
