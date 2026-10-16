# Separate Arabic reading corpus

These 47 Arabic Wikipedia article introductions were fetched on October 16, 2026, through the public MediaWiki API. Arabic Wikipedia contributors provide them under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Each record preserves its article title, page ID, revision ID, source timestamp, revision URL, search rank, query and unmodified plain-text extract.

The six queries were selected before retrieval: التنوع الحيوي، الشعر العربي، التعليم العالي، الطاقة المتجددة، سوق العمل، الترجمة الأدبية. Each request asked for eight search results. Existing corpus page IDs and disambiguation pages were excluded. The resulting corpus has 47 records. No word or expected lesson was used to select an article. The API converted source markup to plain text. Runtime passage length and markup controls still apply during replay.

The request log is `agent-docs/codex-2026-10-16/discovery-heldout-fetch.json`. All six requests returned HTTP 200. Requests contained only the public queries and API controls, without browsing history, saved cards or other profile data.

This corpus measures coverage on a separate source sample. It does not certify factual correctness, difficulty or topic relevance. No extraction or quality threshold was fitted to its named results. Run `node tests/e2e/heldout-coverage.cjs` to reproduce the report without network access.
