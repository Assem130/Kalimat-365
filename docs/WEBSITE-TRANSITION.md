# Supporting website proposal

Proposal only, requiring separate approval. The extension is the primary daily encounter; a future website could support installation, privacy and help. This milestone does not change the website runtime, publish a cutover, remove pages or implement a converter.

## Preserve access first

Retain the current home, word, permalink and offline experience until an approved transition. Before changing routes or the service-worker shell, back up the deployable source and verify that existing links and offline access still work. Preserve an explicit old-experience and export path during transition. Preview the support site locally, including installation, privacy and help links, before approving publication. Publish the corrected policy alongside any approved extension release.

## Explicit migration, if separately approved

Website JSON and extension JSON are distinct formats. Current Atlas import accepts extension data only; importing a website export is not automatic migration. Do not copy private state in this milestone.

A future user-controlled migration should:

1. Export and keep backups of both stores before any write; record the source versions/schema.
2. Validate schema and stable IDs, and fail without changes on invalid or unsupported data.
3. Preview supported mappings and conflicts. Favorites and history are observations, never inferred learning, proficiency, recall grades or mastery.
4. Obtain the user's choice for conflicts while preserving existing extension records, stable IDs and same-day assignments. Leave unmapped website data available in the original backup and old experience.
5. Export rollback material and record the accepted mapping before applying an additive change. Verify both stores and reload behavior, and prove a rerun makes no further changes.
6. Provide and test restoration from the pre-migration exports. Retain the old website path until this recovery and transition are approved.

These are acceptance requirements for a later proposal, not capabilities shipped in the current candidate. No accounts, sync, backend, telemetry, corpus changes or new learning machinery are proposed.
