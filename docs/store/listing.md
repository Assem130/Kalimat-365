# Kalimat draft store listing kit

Candidate copy for review, not a published listing or release. Product: **Kalimat / كَلِمات**. Audience: people who already speak Arabic and want enrichment. Manifest `0.3.0` is retained for compatibility; matching versions do not prove identical archives or store contents.

## Draft purpose and descriptions

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

Website state uses `localStorage`; extension state uses `storage.local`, with distinct JSON formats and no automatic migration. Atlas clear-data attempts profile deletion and reminder disabling independently and reports partial or unknown outcomes. See [extension privacy](../../extension/PRIVACY.md) and [candidate policy source](../../privacy.html). Publish that correction alongside any approved release; no policy deployment occurs here.

## Distribution and historical material

- [Existing Chrome Web Store channel](https://chromewebstore.google.com/detail/dlfllbncnbfpnocdaeddejjjldohmefe): current contents unverified because the read-only lookup was inaccessible. Prior Chrome `0.3.0` publication statements are historical repository records.
- [beta.2 snapshot](https://github.com/Assem130/Kalimat-365/releases/tag/v0.3.0-beta.2): historical `kalimat-chrome-0.3.0.zip` and `kalimat-firefox-0.3.0.zip`, not this candidate.
- Firefox submission postponement is an earlier repository record, not verified current store status.
- [Published privacy](https://assem130.github.io/Kalimat-365/privacy.html) and [support](https://github.com/Assem130/Kalimat-365/issues).

Existing screenshots are historical assets. They do not demonstrate the current daily popup and are not a ready candidate submission set:

| File | Recorded surface |
| --- | --- |
| [01-daily-word.png](screenshots/01-daily-word.png) | Website word page |
| [02-review.png](screenshots/02-review.png) | Website recall dialog |
| [03-atlas.png](screenshots/03-atlas.png) | Earlier extension Atlas |

Current native popup/Atlas layout, keyboard and audio acceptance are unverified because available automation blocks `chrome://extensions`. Capture actual extension screenshots only after that acceptance. Retain historical assets and font licenses. See [development](../DEVELOPMENT.md) for source installation and [product context](../../CONTEXT.md) for the binding direction.
