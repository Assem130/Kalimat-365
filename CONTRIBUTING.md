# Contributing

Read the authoritative [product context](CONTEXT.md) before changing behavior: Arabic-first enrichment, one daily extension encounter, optional English and voluntary recall in Atlas. Keep changes focused and preserve the canonical 365 words, stable word IDs, and separate local website and extension stores.

## Report a bug

Use the [bug report form](https://github.com/Assem130/Kalimat-365/issues/new?template=bug-report.yml). Include the affected surface, browser and operating system, exact steps, expected behavior, and what happened. For an extension, say whether it came from the store, a historical release archive, or a local build; include the version or commit when known.

Screenshots or error messages help when relevant. Remove personal information. Do not attach profile exports or browser storage data.

## Submit a pull request

Explain the problem and resulting behavior. Keep unrelated changes out of the diff, describe how you checked the affected flow, and include screenshots for visible changes.

Follow the [development guide](docs/DEVELOPMENT.md#verification) and run `python3 verify.py` for code or corpus changes (`python verify.py` on Windows). For documentation-only changes, check links and `git diff --check`. Report checks you could not run and why. Keep generated packages and agent artifacts out of Git.

Changes to profile data, privacy, the corpus, or product scope need a clear rationale and review. Avoid adding dependencies for routine fixes.
