# Kalimat 21-Day Public Beta Protocol

## Purpose

Test whether Kalimat’s focused 365-word set helps self-identified intermediate-and-advanced Standard Arabic learners return to a useful word, context, and review flow during normal study. This is a manual, privacy-preserving beta: Kalimat does not collect telemetry, require accounts, or make a beginner-course claim.

## Approved cohort

- Recruit 12–18 learners who self-identify as intermediate or advanced.
- Record each participant’s self-reported Arabic exposure and primary interest at enrollment; never infer proficiency from usage data.
- Explain that Kalimat is a focused mastery set, not an unlimited vocabulary course. Website and extension data remain separate local stores.

## Check-ins

- **Day 0:** record baseline exposure and a short unseen-sentence comprehension check.
- **Days 7 and 14:** ask participants to summarize their existing Kalimat export locally and report only days used, context usefulness, and difficulty fit.
- **Day 21:** repeat the parallel comprehension check, usefulness survey, and installation/retention intention.

Use the Day [0](day-0.md), [7](day-7.md), [14](day-14.md), and [21](day-21.md) facilitator forms. Do not add analytics or background collection to fill gaps between check-ins. Raw responses and Kalimat exports remain local and ignored by Git.

The strict template is [beta-responses.example.json](beta-responses.example.json). Participants can produce only `daysUsed` for the exact 21-day inclusive study window with `node tools/summarize-beta-export.js <kalimat-export.json> <study-start> <study-end>`. The facilitator generates deterministic aggregate Markdown with `node tools/analyze-beta.js <responses.json>`.

## Beta gate

Promote to 1.0 only when all four conditions hold:

1. At least 50% of participants report using Kalimat on 12 or more of 21 days.
2. Each learner band has at least two consistent users.
3. Median practical-context usefulness is at least 4/5.
4. Day-21 unseen-sentence comprehension reaches at least 70%.

If the gate fails, revise content or positioning before adding words, browser surfaces, telemetry, or spaced-review behavior. If it passes, document a separate review lane whose evidence cannot alter adaptive level directly.

Missing any required Day-21 scalar produces `insufficient`; it is never treated as a pass. Commit only the anonymized aggregate Markdown.
