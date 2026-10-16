# wordfreq Arabic frequency data

The catalog includes a generated subset of wordfreq Arabic frequency measurements. Credit: Robyn Speer, wordfreq.

Source: [wordfreq v3.2](https://github.com/rspeer/wordfreq/tree/v3.2), commit `42233e6c36ce792031bcccfa17cdd0cec9af5fa7`. The upstream data file is [large_ar.msgpack.gz](https://raw.githubusercontent.com/rspeer/wordfreq/42233e6c36ce792031bcccfa17cdd0cec9af5fa7/wordfreq/data/large_ar.msgpack.gz). Its size is 3,063,585 bytes. Its SHA-256 is `aa12410764f1946f21d986a920c289c22accb069d9b287d71b61657005516eec`.

The frequency data and this generated subset use [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The upstream code uses Apache 2.0. These licenses do not change the license of unrelated application code.

Transformation: the builder selects measured surface forms for catalog entries. It stores the higher score for the normalized title and its definite-article form. It omits unmatched words and phrases. The generated values retain the source precision of 0.01 Zipf units. This selection and form aggregation are modifications of the source data.

Frequency reflects estimated written usage, not a learner's proficiency or the value of a lesson. The data represents usage through about 2021. Arabic source domains include Wikipedia, subtitles, news, web text, and Twitter. Scores do not distinguish meanings or validate definitions.

The following upstream notice and code license are reproduced without changes.

## Upstream NOTICE.md

wordfreq
Copyright 2022 Robyn Speer

# Attribution notes

Robyn Speer must be credited as Robyn Speer, which is her maiden name, used on academic work.
Crediting her as Elia Robyn Lake (her married name) will make the credit less effective, as it will
not line up with other work.

Crediting Robyn Speer by a different name than one of the above is a serious violation of the license,
in which case you do not have permission to use, copy, or redistribute wordfreq.

If you use wordfreq in academic work, you must cite it. See "Citing wordfreq" in README.md.

# Included licenses

`wordfreq` is freely redistributable under the Apache license (see
`LICENSE.txt`), and it includes data files that may be
redistributed under a Creative Commons Attribution-ShareAlike 4.0
license (<https://creativecommons.org/licenses/by-sa/4.0/>).

`wordfreq` contains data extracted from Google Books Ngrams
(<http://books.google.com/ngrams>) and Google Books Syntactic Ngrams
(<http://commondatastorage.googleapis.com/books/syntactic-ngrams/index.html>).
The terms of use of this data are:

    Ngram Viewer graphs and data may be freely used for any purpose, although
    acknowledgement of Google Books Ngram Viewer as the source, and inclusion
    of a link to http://books.google.com/ngrams, would be appreciated.

`wordfreq` also contains data derived from the following Creative Commons-licensed
sources:

- The Leeds Internet Corpus, from the University of Leeds Centre for Translation
  Studies (<http://corpus.leeds.ac.uk/list.html>)

- Wikipedia, the free encyclopedia (<http://www.wikipedia.org>)

- ParaCrawl, a multilingual Web crawl (<https://paracrawl.eu>)

It contains data from OPUS OpenSubtitles 2018
(<http://opus.nlpl.eu/OpenSubtitles.php>), whose data originates from the
OpenSubtitles project (<http://www.opensubtitles.org/>) and may be used with
attribution to OpenSubtitles.

It contains data from various SUBTLEX word lists: SUBTLEX-US, SUBTLEX-UK,
SUBTLEX-CH, SUBTLEX-DE, and SUBTLEX-NL, created by Marc Brysbaert et al.
(see citations below) and available at
<http://crr.ugent.be/programs-data/subtitle-frequencies>.

I (Robyn Speer) have obtained permission by e-mail from Marc Brysbaert to
distribute these wordlists in wordfreq, to be used for any purpose, not just
for academic use, under these conditions:

- Wordfreq and code derived from it must credit the SUBTLEX authors.
- It must remain clear that SUBTLEX is freely available data.

These terms are similar to the Creative Commons Attribution-ShareAlike license.

Some additional data was collected by a custom application that watched the
streaming Twitter API, in accordance with Twitter's Developer Agreement &
Policy. This software gives statistics about words that were commonly used on
Twitter; it does not display or republish any Twitter content, and does not
contain any content from after Twitter's sale.


## Upstream LICENSE.txt

```text
Copyright 2022 Robyn Speer

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

This license applies to the code only. See NOTICE.md for particular details
about the licensing of the code and the data.
```
