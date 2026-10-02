# Kalimat store listing kit

Prepared copy for the **0.4.0** update. Product: **Kalimat / كَلِمات**. Audience: people who already speak Arabic and want enrichment. Store submission is separate from GitHub publication; this file does not claim approval or a live store update.

## Purpose and descriptions

**Arabic purpose:** يقدّم كَلِمات لقاءً يومياً مع كلمة عربية ومعناها وسياقها لمن يتحدث العربية ويحب اكتشافها.

**English purpose:** One daily Arabic encounter with meaning and context for people who already speak Arabic.

**Arabic short description:** كلمة عربية كل يوم، بمعناها وسياقها، مع نطق اختياري وأطلس للاستكشاف.

**English short description:** One daily Arabic word, meaning and context, with optional speech and Atlas exploration.

### العربية

كَلِمات امتداد لإثراء علاقتك بالعربية: لقاء يومي مع كلمة ومعناها ومثالها. العربية هي الأساس، والترجمة الإنجليزية مساعدة اختيارية. للكلمات الأدبية وغير المألوفة مكان حين يكون معناها وسياقها جديرين بالاكتشاف.

يوفّر الأطلس استكشافاً أعمق وتدريب تذكّر اختياري وإعدادات وتصديراً وحذفاً للبيانات. لا حسابات أو مزامنة أو تحليلات أو خادم خلفي. تبقى بيانات الموقع والامتداد منفصلة. لا نستنتج مستوى لغوياً أو نتائج تعلّم من الاستخدام.

### English

Kalimat enriches your relationship with Arabic through one daily word, meaning and context. Arabic comes first; English is optional support. Literary and uncommon words belong on editorial merit.

Atlas offers deeper exploration, voluntary recall, settings, export and deletion. Website and extension data are separate. No accounts, sync, analytics, telemetry or backend are provided, and usage does not establish proficiency or learning outcomes.

## Permissions and disclosures

| Browser | Permission | Purpose |
| --- | --- | --- |
| Both | `storage` | Local extension profile and settings |
| Both | `contextMenus` | Explicit word lookup action |
| Both | Optional `alarms`, `notifications` | Daily reminders after opt-in |
| Chrome | Optional `https://ar.wiktionary.org/*` | Explicit dictionary submission with permission; only the normalized term is sent |

Firefox has no dictionary host permission; dictionary lookup is local. Its current manifest declares `browser_specific_settings.gecko.data_collection_permissions.required: ['none']`. This is a manifest fact, not certification of a future store submission: review disclosures against opt-in remote browser speech before submission.

Speech uses a browser-reported local Arabic voice by default. Atlas can enable remote browser speech after disclosure; spoken text may then reach the browser speech provider on Chrome or Firefox. Website speech retains browser/OS-dependent behavior. Dictionary results from Wiktionary are visibly unreviewed, cannot be saved and are not retained in profile history. Network providers may process connection metadata.

Website state uses `localStorage`; extension state uses `storage.local`, with distinct JSON formats and no automatic migration. Atlas clear-data attempts profile deletion and reminder disabling independently and reports partial or unknown outcomes. See [extension privacy](../../extension/PRIVACY.md) and [policy source](../../privacy.html). Confirm that the public policy reflects this disclosure before submission.

## Distribution and historical material

- [Existing Chrome Web Store channel](https://chromewebstore.google.com/detail/dlfllbncnbfpnocdaeddejjjldohmefe): current contents unverified because the read-only lookup was inaccessible. Prior Chrome `0.3.0` publication statements are historical repository records.
- [beta.2 snapshot](https://github.com/Assem130/Kalimat-365/releases/tag/v0.3.0-beta.2): historical `kalimat-chrome-0.3.0.zip` and `kalimat-firefox-0.3.0.zip`, not version 0.4.0.
- Firefox submission postponement is an earlier repository record, not verified current store status.
- [Published privacy](https://assem130.github.io/Kalimat-365/privacy.html) and [support](https://github.com/Assem130/Kalimat-365/issues).

Existing screenshots are historical assets. They do not demonstrate the current daily popup and are not a ready candidate submission set:

| File | Recorded surface |
| --- | --- |
| [01-daily-word.png](screenshots/01-daily-word.png) | Website word page |
| [02-review.png](screenshots/02-review.png) | Website recall dialog |
| [03-atlas.png](screenshots/03-atlas.png) | Earlier extension Atlas |

The recent installed Chrome popup/Atlas evidence is recorded in [verification](../VERIFICATION.md). Keep the historical screenshots separate and use actual extension screenshots for this update. Retain font licenses. See [development](../DEVELOPMENT.md) for installation and [product context](../../CONTEXT.md) for the binding direction.

## Submit the 0.4.0 update

Update existing item `dlfllbncnbfpnocdaeddejjjldohmefe`; do not create a duplicate listing. Upload `kalimat-chrome-0.4.0.zip` from the matching GitHub release or verified local build. Confirm that the dashboard's current version is lower than 0.4.0.

Use the Arabic purpose and description above as the main listing. Set the privacy URL to `https://assem130.github.io/Kalimat-365/privacy.html` and support URL to `https://github.com/Assem130/Kalimat-365/issues`. Keep existing distribution unchanged. Review the privacy declarations against the explicit dictionary query and opt-in remote speech described above; no new extension permissions are requested.

Replace screenshots that show the old parallel learning website with actual daily-popup and Atlas screenshots. Google requires at least one 1280 by 800 screenshot and permits up to five. Submit the update for review after package, listing and privacy fields are complete. Record submission status separately from approval and publication. [Google's update instructions](https://developer.chrome.com/docs/webstore/update/) and [listing requirements](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) describe these steps.
