# Five-entry editorial corrections

This review covers IDs 1 through 5 only. IDs, aliases and the other 360 records are preserved. Existing `reviewed: true` flags are retained for compatibility with the loader; they do not prove a completed linguistic review of all 365 entries. No ranking or register changes are implied by this review.

| ID | Correction | Example provenance |
| --- | --- | --- |
| 1 | Narrowed السَّمَيْدَع to noble, generous chief and brave man; removed rhetorical fearlessness claim. | Original modern Fusha sentence; removed unsafe Khansa attribution. |
| 2 | Focused الخِنْذِيذ on the accomplished poet and associated praise senses; root خ ن ذ follows the consulted entry. Ibn Sidah's derivation is explicitly tentative. | Original modern Fusha sentence; replaced unverified Shuja ibn Wahb attribution. |
| 3 | Corrected الدِّيمَة, pronunciation and vowel explanation; pattern فِعْلَة, root د و م; calm continuing rain without a fixed duration or necessary lightness. | Aisha's short quotation from Sahih al-Bukhari 6466, with metaphorical continuity explained separately. Daily context is original. |
| 4 | Corrected internal vowel explanation and removed invincibility claim; adjective describes abundance and strength. | Original modern Fusha sentence; replaced unverified Mutanabbi attribution. |
| 5 | Distinguished pain, illness and bodily fatigue; removed fatigue as a necessary cause. | Explicit short excerpt from Sahih al-Bukhari 5641–5642. Daily context is original. |

Original examples are newly written editorial usage, not historical quotations or attested corpus examples. Quotation references cover the excerpt displayed, not all text of a hadith. English is secondary editorial translation. Usage and register notes are editorial judgments, not measured contemporary frequency claims.

## Sources and limits

Named primary works were checked through their digital text hosts:

- [Ibn Manzur, Lisan al-Arab, سمدع](https://www.islamweb.net/ar/library/content/122/3973/سمدع): generosity, lordship and bravery.
- [Ibn Manzur, Lisan al-Arab, خنذ](https://www.islamweb.net/ar/library/content/122/2335/خنذ): selected praise senses and Ibn Sidah's qualified derivation. This is not unanimous etymological certainty.
- [Ibn Manzur, Lisan al-Arab, دوم](https://www.islamweb.org/ar/library/index.php?ID=2848&bk_no=122&idfrom=2845&page=bookcontents): rain, varied duration reports, underlying wāw and metaphorical continuity. Pattern analysis is editorial morphology based on that underlying form.
- [Ibn Manzur, Lisan al-Arab, عرم](https://www.islamweb.net/ar/library/content/122/5429/عرم): army abundance and strength.
- [Ibn Manzur, Lisan al-Arab, وصب](https://islamweb.net/ar/library/content/122/9049/وصب): pain, illness, enduring pain and bodily fatigue.
- [Sahih al-Bukhari 6466](https://sunnah.com/bukhari:6466) and [5641–5642](https://sunnah.com/bukhari:5641): directly matching Arabic excerpts and references.

The earlier audit's indexed Khansa discrepancy and unsuccessful exact searches for other poetry warrant removing unsafe attributions, but do not prove that every manuscript or edition lacks those lines. The full Khansa PDF was not available in that audit. This implementation relies on the directly checked dictionary and hadith text, not a completed poetry edition comparison, Academy search shell, or full modern corpus analysis. Preserved existing weights and register buckets beyond the specific correction are not newly certified by these checks.

## Runtime metadata

Only the five entries receive optional `exampleKind` and `usageNote`. Quotation entries carry `exampleSource: {title, url, reference}`. URLs must be HTTPS with no credentials; nested source data is validated and frozen. Older entries remain valid without provenance and receive no invented original or verified labels. Runtime consumers should render text with `textContent` and use validated source URLs for links. Source links do not add network permissions or automatic requests.
