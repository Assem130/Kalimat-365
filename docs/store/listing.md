# Kalimat store listing kit

Prepared store copy for the **v0.4.1-beta.1 GitHub beta**, using extension manifest version **0.4.1**. Product: **Kalimat / كَلِمات**. Audience: people who already speak Arabic and want enrichment. The [GitHub prerelease](https://github.com/Assem130/Kalimat-365/releases/tag/v0.4.1-beta.1) and its [release notes](release-notes-v0.4.1-beta.1.md) are separate from store submission. This file does not claim store approval or a live store update.

## Purpose and descriptions

**Arabic purpose:** يقدّم كَلِمات لقاءً يومياً مع كلمة عربية ومعناها وسياقها لمن يتحدث العربية ويحب اكتشافها.

**English purpose:** One daily Arabic encounter with meaning and context for people who already speak Arabic.

**Arabic short description:** كلمة عربية كل يوم، بمعناها وسياقها، مع نطق اختياري وأطلس للاستكشاف.

**English short description:** One daily Arabic word, meaning and context, with optional speech and Atlas exploration.

### العربية

كلمة عربية كل يوم، بمعناها وسياقها، لمن يتحدث العربية ويحب اكتشافها.

افتح كَلِمات من شريط المتصفح لتقرأ كلمة اليوم ومعناها بالعربية ومثالاً على استخدامها. استمع إلى نطقها إذا توفر صوت عربي، واحفظ الكلمات التي تريد العودة إليها. العربية هي الأساس، والترجمة الإنجليزية مساعدة اختيارية. للكلمات الأدبية وغير المألوفة مكان في هذا اللقاء اليومي.

افتح أطلس الكلمات للاستكشاف، والعودة إلى كلماتك المحفوظة، وتدريب التذكّر الاختياري. يمكنك أيضاً تعديل الإعدادات وتصدير بيانات الامتداد واستيراد نسخة احتياطية منها واستخدام خيارات حذفها. التذكير اليومي اختياري.

بعد تفعيل المصادر ومنح الإذن، يبحث كَلِمات في ويكيبيديا وويكاموس العربية عن كلمات جديدة. ويستخدم كذلك مادة مضمّنة من معجم اللغة العربية المعاصرة بصيغة LMF، بترخيص CC BY-NC 4.0 ضمن الاستخدام غير التجاري للمشروع. لا ترسل قراءة هذه المادة طلبات إلى ناشر المعجم. لا نختار كلمة بديلة من قائمة ثابتة. المعاني والشواهد مستخرجة تلقائيًا وغير مراجعة وقد تحتوي على أخطاء. قد يجلب كلمات عبر الإنترنت في الخلفية لتحضير كلمة اليوم. يمكنك تعطيل المصادر من الإعدادات مع الاحتفاظ بالكلمات المحفوظة.

لا تحتاج إلى حساب. لا تحليلات أو تتبّع أو مزامنة؛ يبقى ملفك المحلي في متصفحك. يستخدم النطق صوتاً عربياً يصفه المتصفح بأنه محلي افتراضياً. إذا سمحت بالنطق عن بُعد من إعدادات الأطلس، فقد يُرسل النص المنطوق إلى مزوّد النطق. البحث الخارجي في القاموس اختياري في Chrome، ويرسل مصطلح البحث إلى Wiktionary العربية بعد طلبك ومنح الإذن. تبقى بيانات الموقع والامتداد منفصلة.

### English

Discover one Arabic word each day, with its meaning and context, for people who already speak Arabic.

Open Kalimat from your browser toolbar to read today's word, its Arabic meaning and an example of its use. Listen when an Arabic voice is available, and save words you want to revisit. Arabic comes first, with optional English support. The earlier bundled vocabulary remains an archive for existing saved words and exploration.

Open Atlas to explore words, revisit your saved collection and try optional recall practice. Atlas also offers settings, extension data export, backup import and deletion controls. Daily reminders are optional.

After you enable sources and grant permission, Kalimat searches Arabic Wikipedia and Wiktionary for new words. Bundled material from the LMF Contemporary Arabic dictionary also supports selection, under CC BY-NC 4.0 for this non-commercial project. Reading that material makes no request to its publisher. There is no fixed-list fallback. When sources yield no suitable word and no unseen cached source card is available, the extension reports that a new word is unavailable. Its definitions and quotations are automatically sourced, unreviewed and may contain errors. Once enabled with host permission, it can fetch words online in the background to prepare a daily card. You can disable sources in settings and retain saved words.

No account is needed. There are no analytics, tracking or sync services; your local profile stays in your browser. Pronunciation uses a voice reported as local by the browser by default. If you enable remote speech in Atlas, spoken text may reach the browser's speech provider. Optional online dictionary lookup on Chrome sends your search term to Arabic Wiktionary only after you request it and grant permission. Website and extension data stay separate.

## Permissions and disclosures

| Browser | Permission | Purpose |
| --- | --- | --- |
| Both | `storage` | Local extension profile and settings |
| Both | `contextMenus` | Explicit word lookup action |
| Both | Optional `alarms`, `notifications` | Daily reminders after opt-in |
| Both | Optional `https://ar.wikipedia.org/*`, `https://ar.wiktionary.org/*` | Experimental discovery after opt-in, including background article and dictionary requests. Chrome also uses Wiktionary for explicit dictionary submissions |

Both manifests declare optional Wikipedia and Wiktionary host permissions for discovery. Manual dictionary lookup remains local on Firefox. The Firefox manifest declares `browser_specific_settings.gecko.data_collection_permissions.required: ['none']`. This is a manifest fact, not certification of a future store submission: review disclosures against discovery requests and opt-in remote browser speech before submission.

Speech uses a browser-reported local Arabic voice by default. Atlas can enable remote browser speech after disclosure; spoken text may then reach the browser speech provider on Chrome or Firefox. Website speech retains browser/OS-dependent behavior. Dictionary results from Wiktionary are visibly unreviewed, cannot be saved and are not retained in profile history. Experimental discovery can save accepted card snapshots with source attribution in local storage and JSON backups. Discovery requests send public titles and topic search terms to Wikimedia, together with IP addresses and ordinary connection metadata. They omit credentials and cookies. Profile data, saved words and known-word exclusions are not uploaded.

The LMF supplement is bundled data, not a new network service or host permission. Attribution: Driss Namly, 2015, Ibtikarat team, [LMF Contemporary Arabic dictionary at LINDAT](https://lindat.mff.cuni.cz/repository/items/d4d8ef1a-0e51-42d1-9a94-113cb81afa76), CC BY-NC 4.0. The [packaged source notice](../../extension/data/lmf-NOTICE.md) records the original file hash, transformation rules and license. Cards retain exact source sense IDs and examples. The 44-entry supplement does not establish year-round supply or human semantic certification. All six frozen 30-date runs meet the separate 27-success target; details and live-check limits are in the [release notes](release-notes-v0.4.1-beta.1.md).

Website state uses `localStorage`; extension state uses `storage.local`, with distinct JSON formats and no automatic migration. Atlas clear-data attempts profile deletion and reminder disabling independently and reports partial or unknown outcomes. See [extension privacy](../../extension/PRIVACY.md) and [policy source](../../privacy.html). Confirm that the public policy reflects this disclosure before submission.

## Distribution and historical material

- [v0.4.1-beta.1 GitHub prerelease](https://github.com/Assem130/Kalimat-365/releases/tag/v0.4.1-beta.1): Chrome and Firefox extension ZIPs with manifest version 0.4.1. This is a beta download, not a store update.
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

## Future submission of the 0.4.1 update

Update existing item `dlfllbncnbfpnocdaeddejjjldohmefe`; do not create a duplicate listing. Upload `kalimat-chrome-0.4.1.zip` from the matching GitHub release or verified local build. Confirm that the dashboard's current version is lower than 0.4.1.

Use the Arabic purpose and description above as the main listing. Set the privacy URL to `https://assem130.github.io/Kalimat-365/privacy.html` and support URL to `https://github.com/Assem130/Kalimat-365/issues`. Keep existing distribution unchanged. Review the privacy declarations against explicit dictionary queries, background discovery requests and opt-in remote speech. Both current manifests include optional Wikipedia and Wiktionary hosts. Compare these with the previously published package before describing permission changes.

Replace screenshots that show the old parallel learning website with actual daily-popup and Atlas screenshots. Google requires at least one 1280 by 800 screenshot and permits up to five. Submit the update for review after package, listing and privacy fields are complete. Record submission status separately from approval and publication. [Google's update instructions](https://developer.chrome.com/docs/webstore/update/) and [listing requirements](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) describe these steps.
