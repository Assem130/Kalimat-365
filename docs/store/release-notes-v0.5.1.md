# Kalimat 0.5.1

The approved 14-day pilot replaces source-driven daily selection. It presents one shared daily Arabic entry, with an everyday example and dictionary reference. The popup opens a focused reading page with a compact reminder and optional skippable recall. Normal Chrome and Firefox packages leave existing new tabs unchanged. A separate local `--new-tab` build remains available.

The integration retains the upstream storage-recovery fix from PR #21. A save or clear action remains available after temporary write failures while an older profile is being migrated. Once writes succeed, the intended action persists. Existing saved words, history, reviews and preferences remain compatible with the additive pilot data.

Atlas keeps settings accessible when a new daily card cannot yet be saved. It displays the returned card with the storage warning while keeping preferences tied to confirmed storage.

Firefox now loads the pilot catalog before its background controller. The manifest bootstrap regression exercises a daily assignment through the Firefox browser API model. Separate packaged runtime checks now pass in headless Firefox, including saving, backup restore and addon reload.

The experience refinement fixes the reader's My words link and restores keyboard focus after saving. Atlas opens a selected word immediately and returns to the same search result. Its daily example and dictionary link are visible without opening a disclosure. The popup, reader and Atlas share their colors and system dark appearance. Settings prioritize reading, reminders and personal data, with additional source discovery kept optional. Approved content, daily scheduling, storage formats, extension identity and permissions are unchanged.

## Distribution status on 22 October 2026

- The finished changes were merged into `main` and pushed at commit `135a6d01c94d52208a53ee1c00dc90c12b527dea`. GitHub verification and Pages deployment passed.
- The earlier pending review was canceled. The finished normal Chrome 0.5.1 ZIP replaced that draft in the existing listing `dlfllbncnbfpnocdaeddejjjldohmefe`.
- Uploaded ZIP SHA256: `26108df6063cdcc95c292601cb6d101c2bed0c0556cd45642d9a1ba7d6125903`. It includes the storage-recovery fix and the experience refinements above. It does not replace new tabs.
- Both store screenshots were replaced with actual 1280 × 800 light/dark reader captures from that ZIP. Reviewer instructions now use the current «قراءة موسّعة» link label.
- The dashboard confirmed successful submission and **Pending review**, with **automatic publication after approval enabled**. It showed draft 0.5.1 and published 0.3.0. This records submission, not approval or publication of 0.5.1.
- Local upload artifacts and native dashboard evidence are in `agent-docs/codex-maturity-2026-10-22/store-0.5.1/`. Earlier artifacts remain preserved separately.
- The public privacy URL remains https://assem130.github.io/Kalimat-365/privacy.html. Permissions and extension identity remain unchanged.

See [pilot operation](../PILOT.md), [development](../DEVELOPMENT.md) and [verification evidence](../VERIFICATION.md).
