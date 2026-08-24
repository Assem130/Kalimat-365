# Day 21 facilitator form

Complete every required Day-21 field. A missing value must be `null` in JSON and makes the result `insufficient`.

- Participant code:
- Final days used from the local summarizer:
- Context usefulness (1–5):
- Difficulty fit (1–5):
- Parallel unseen-sentence comprehension (0–100):
- Intention to keep using Kalimat (1–5):
- Optional flagged word IDs:

Generate the final `daysUsed` scalar with `node tools/summarize-beta-export.js <their-export.json> <study-start> <study-end>`, using the exact 21-day inclusive window. Copy that number and the survey scalars into the strict response format, then run:

```powershell
node tools/analyze-beta.js docs/beta/private/responses.json
```

Commit only the resulting aggregate Markdown, never the response JSON or a Kalimat export.
