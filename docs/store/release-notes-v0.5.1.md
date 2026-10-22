# Kalimat 0.5.1 source candidate

The approved 14-day pilot replaces source-driven daily selection. It presents one shared daily Arabic entry, with an everyday example and dictionary reference. The popup opens a focused reading page with a compact reminder and optional skippable recall. Normal Chrome and Firefox packages leave existing new tabs unchanged. A separate local `--new-tab` build remains available.

The integration retains the upstream storage-recovery fix from PR #21. A save or clear action remains available after temporary write failures while an older profile is being migrated. Once writes succeed, the intended action persists. Existing saved words, history, reviews and preferences remain compatible with the additive pilot data.

Atlas keeps settings accessible when a new daily card cannot yet be saved. It displays the returned card with the storage warning while keeping preferences tied to confirmed storage.

Firefox now loads the pilot catalog before its background controller. The manifest bootstrap regression exercises a daily assignment through the Firefox browser API model. This is not a native Firefox runtime test.

## Distribution status on 22 October 2026

- Chrome Web Store version 0.5.0 was submitted to the existing listing and showed Pending review, with automatic publication after approval enabled.
- The submitted Chrome ZIP remains unchanged. Its SHA256 is `59e9dcd543094febb6aa8930d792738b6631dab2343dc171295636fbbf15bf97`.
- That ZIP predates the upstream storage fix. Version 0.5.1 distinguishes the integrated source from the submitted artifact.
- Committing or pushing this source does not replace the store submission. A later 0.5.1 upload is required to deliver the storage fix through the store.
- The public privacy URL remains https://assem130.github.io/Kalimat-365/privacy.html. Permissions and extension identity remain unchanged.

See [pilot operation](../PILOT.md), [development](../DEVELOPMENT.md) and [verification evidence](../VERIFICATION.md).
