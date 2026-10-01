(() => {
  "use strict";

  const ExtApi = globalThis.browser ?? globalThis.chrome;
  const ReviewSession = globalThis.KalimatReviewSession;
  const byId = (id) => document.getElementById(id);
  const views = ["today", "explore", "history", "settings", "onboarding", "recovery", "empty", "error"];
  const state = {
    vocabulary: [],
    profile: null,
    today: null,
    exploreWord: null,
    reminder: { enabled: false, time: "09:00" },
    reminderWarning: false,
    storageWarning: false,
    settingsBusy: false,
    recoveryRaw: null,
    view: "",
    viewRevision: 0,
  };
  let elements;
  let reminderQueue = Promise.resolve();

  const canonicalSearchKey = globalThis.KalimatVocabulary?.canonicalSearchKey;
  if (typeof canonicalSearchKey !== "function") throw new TypeError("KalimatVocabulary.canonicalSearchKey is required.");
  const normalize = canonicalSearchKey;

  function validTime(value) {
    return typeof value === "string" && /^\d{2}:\d{2}$/.test(value) && Number(value.slice(0, 2)) < 24 && Number(value.slice(3)) < 60;
  }

  function collect() {
    return Object.fromEntries([
      "status", "warning", "today", "explore", "history", "settings",
      "today-view", "explore-view", "history-view", "settings-view",
      "onboarding", "recovery", "empty", "error",
      "today-title", "explore-title", "history-title", "settings-title",
      "onboarding-title", "recovery-title", "empty-title", "error-title",
      "today-card", "today-date", "today-empty", "explore-card",
      "atlas-search", "search-count", "search-results", "return-today",
      "history-filter", "history-list",
      "settings-english", "settings-remote-speech", "settings-speech-rate", "settings-speech-repeat", "settings-save", "settings-time", "settings-reminder",
      "export", "import-file", "clear",
      "recovery-export", "recovery-import", "recovery-clear", "onboarding-settings",
      "today-save", "today-known", "today-difficult", "today-action-status", "explore-lookup",
      "theme-select", "streak-badge", "today-export-card", "history-export-anki", "btn-export-anki",
      "due-review-badge", "practice-dialog", "practice-body", "practice-progress", "practice-close",
      "practice-finished", "practice-finished-message", "practice-error", "practice-error-message", "practice-retry", "practice-finish-btn", "flashcard-card", "card-front-face", "card-back-face", "card-front-flip", "card-front-word",
      "card-front-vocalization", "card-front-weight", "card-front-root", "card-front-speak",
      "card-back-meaning-ar", "card-back-meaning-en", "card-back-example-ar", "card-back-context",
      "practice-ratings", "rate-again", "rate-hard", "rate-good", "rate-easy",
    ].map((id) => [id, byId(id)]));
  }

  function status(message, announce = true) {
    elements.status?.setAttribute("role", announce ? "status" : "none");
    elements.status?.setAttribute("aria-live", announce ? "polite" : "off");
    if (elements.status) elements.status.textContent = message;
  }

  function actionStatus(message, isError = false) {
    elements.status?.setAttribute("role", "none");
    elements.status?.setAttribute("aria-live", "off");
    const target = elements["today-action-status"];
    if (!target) return;
    target.textContent = message;
    target.setAttribute("role", isError ? "alert" : "status");
    target.setAttribute("aria-live", isError ? "assertive" : "polite");
  }

  function warning(visible) {
    if (elements.warning) elements.warning.hidden = !visible;
  }

  function show(name) {
    state.view = name;
    state.viewRevision += 1;
    for (const view of views) {
      const section = ["onboarding", "recovery", "empty", "error"].includes(view) ? elements[view] : elements[`${view}-view`];
      if (section) section.hidden = view !== name;
    }
    for (const nameButton of ["today", "explore", "history", "settings"]) {
      if (elements[nameButton]) elements[nameButton].setAttribute("aria-pressed", String(nameButton === name));
    }
    const heading = byId(`${name}-title`);
    if (heading) heading.focus();
    if (name !== "today") setTodayActions(false);
  }

  function wordById(id) {
    if (globalThis.KalimatVocabulary?.findWord) {
      const found = globalThis.KalimatVocabulary.findWord(state.vocabulary, id);
      if (found) return found;
    }
    const found = state.vocabulary.find((word) => word.id === id || String(word.id) === String(id) || `w${word.id}` === String(id));
    if (found) return found;
    return null;
  }

  function setTodayActions(enabled) {
    for (const id of ["today-save", "today-known", "today-difficult"]) {
      if (elements[id]) elements[id].disabled = !enabled;
    }
  }

  function addText(parent, tag, value, className, direction) {
    if (!value) return;
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (direction) { node.dir = direction; node.lang = direction === "ltr" ? "en" : "ar"; }
    node.textContent = value;
    parent.append(node);
  }

  function addLabeledText(parent, value, className, label, direction) {
    if (!value) return;
    const node = document.createElement("p");
    node.className = className;
    if (direction) { node.dir = direction; node.lang = direction === "ltr" ? "en" : "ar"; }
    addText(node, "span", label, "label", direction);
    addText(node, "span", value, "text", direction);
    parent.append(node);
  }

  const REGISTER_LABELS = { standard: "فصيح", classical: "أدبي", colloquial: "عامي" };
  const PART_LABELS = { noun: "اسم", verb: "فعل", adjective: "صفة", adverb: "ظرف", phrase: "عبارة", other: "أخرى" };
  const ARABIC_DATE_OPTIONS = { weekday: "long", year: "numeric", month: "long", day: "numeric" };

  function formatDateKey(dateKey) {
    if (typeof globalThis.KalimatDate?.isDateKey !== "function" || !globalThis.KalimatDate.isDateKey(dateKey)) return "";
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("ar-EG", ARABIC_DATE_OPTIONS);
  }

  function speechAvailable() {
    return Boolean(globalThis.speechSynthesis) && typeof globalThis.SpeechSynthesisUtterance === "function";
  }

  function renderWord(container, word) {
    container.replaceChildren();
    if (!word) return;
    const title = document.createElement("h3");
    title.lang = "ar";
    title.textContent = word.word;
    container.append(title);
    const speakButton = document.createElement("button");
    speakButton.className = "word-speak";
    speakButton.type = "button";
    speakButton.setAttribute("aria-label", `استمع لنطق ${word.word}`);
    speakButton.textContent = state.profile?.preferences?.allowRemoteSpeech === true ? "🔊 استمع (قد يستخدم الإنترنت)" : "🔊 استمع للنطق المحلي";
    speakButton.setAttribute("aria-label", `${speakButton.textContent}: ${word.word}`);
    speakButton.disabled = !speechAvailable();
    speakButton.addEventListener("click", () => speak(word.word));
    container.append(speakButton);
    addText(container, "p", word.meaningAr, "meaning", "rtl");
    addText(container, "p", word.vocalization, "vocalization", "rtl");
    if (state.profile?.showEnglish !== false) {
      const translation = document.createElement("details");
      addText(translation, "summary", "شرح بالإنجليزية والنطق اللاتيني");
      addText(translation, "p", word.meaningEn, "english", "ltr");
      addText(translation, "p", word.pronunciation, "pronunciation", "ltr");
      addLabeledText(translation, word.contextEn, "context english", "Usage", "ltr");
      container.append(translation);
    }
    addLabeledText(container, word.contextAr, "context", "في الاستعمال", "rtl");
    addLabeledText(container, word.usageNote, "usage-note", "في الاستعمال", "rtl");
    addLabeledText(container, word.exampleAr, "example", word.exampleKind === "original" ? "مثال من تحرير كلمات" : word.exampleKind === "quotation" && word.exampleSource ? "شاهد" : "مثال", "rtl");
    if (word.exampleKind === "quotation" && word.exampleSource) {
      try {
        const url = new URL(word.exampleSource.url);
        if (url.protocol === "https:" && url.hostname && !url.username && !url.password && !/[\s\\]/.test(word.exampleSource.url)) {
          const link = document.createElement("a");
          link.href = url.href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = `${word.exampleSource.title} · ${word.exampleSource.reference}`;
          container.append(link);
        }
      } catch (_) { /* Invalid links never become navigation targets. */ }
    }
    if (word.root || word.pattern) {
      const details = document.createElement("p");
      details.className = "root metadata";
      if (word.root) addText(details, "span", `الجذر: ${word.root}`);
      if (word.pattern) addText(details, "span", `الوزن: ${word.pattern}`);
      container.append(details);
    }
    if (word.register || word.partOfSpeech) {
      const details = document.createElement("p");
      details.className = "metadata";
      if (word.register) addText(details, "span", `السجل: ${REGISTER_LABELS[word.register] ?? word.register}`);
      if (word.partOfSpeech) addText(details, "span", `نوع الكلمة: ${PART_LABELS[word.partOfSpeech] ?? word.partOfSpeech}`);
      container.append(details);
    }
    if (Array.isArray(word.relatedIds)) {
      const related = document.createElement("div");
      for (const id of word.relatedIds) {
        const other = wordById(id);
        if (!other) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = other.word;
        button.addEventListener("click", () => { viewWord(other); show("explore"); });
        related.append(button);
      }
      if (related.childElementCount) container.append(related);
    }
    if (container === elements?.["explore-card"]) {
      const cardExportBtn = document.createElement("button");
      cardExportBtn.id = "explore-export-card";
      cardExportBtn.type = "button";
      cardExportBtn.textContent = "بطاقة للمشاركة";
      cardExportBtn.addEventListener("click", () => exportSocialCard(word, cardExportBtn));
      container.append(cardExportBtn);
    }
  }

  function renderToday() {
    const word = state.today?.word;
    actionStatus("");
    const dateText = formatDateKey(state.today?.dateKey);
    if (elements["today-date"]) {
      elements["today-date"].textContent = dateText;
      elements["today-date"].hidden = !dateText;
    }
    renderWord(elements["today-card"], word);
    elements["today-card"].hidden = !word;
    elements["today-empty"].hidden = !!word;
    setTodayActions(!!word);
    const wordState = word && (state.profile?.wordStates?.[String(word.id)] || state.profile?.wordStates?.[`w${word.id}`]);
    elements["today-save"].setAttribute("aria-pressed", String(wordState?.saved === true));
    elements["today-known"].setAttribute("aria-pressed", String(wordState?.status === "known"));
    elements["today-difficult"].setAttribute("aria-pressed", String(wordState?.status === "difficult"));
  }

  function viewWord(word) {
    state.exploreWord = word;
    renderWord(elements["explore-card"], word);
    elements["explore-card"].hidden = false;
    elements["return-today"].hidden = word.id === state.today?.word?.id;
  }

  function mergeAssignment(result) {
    if (result.storageWarning === true || state.storageWarning) return;
    state.profile.assignments ??= {};
    state.profile.assignments[result.dateKey] = { ...state.profile.assignments[result.dateKey], wordId: result.wordId, ...(result.status ? { status: result.status } : {}) };
    if (result.status || result.saved !== undefined) {
      state.profile.wordStates ??= {};
      state.profile.wordStates[result.wordId] = {
        ...state.profile.wordStates[result.wordId],
        ...(result.status ? { status: result.status, dateKey: result.dateKey } : {}),
        ...(result.saved !== undefined ? { saved: result.saved === true } : {}),
      };
    }
  }

  // ponytail: cap rendered results; refine the query if the corpus grows large.
  const MAX_SEARCH_RESULTS = 100;

  function search() {
    const rawQuery = elements["atlas-search"].value;
    elements["explore-card"].replaceChildren();
    elements["explore-card"].hidden = true;
    let matches;
    if (globalThis.KalimatVocabulary && typeof globalThis.KalimatVocabulary.rankVocabulary === "function") {
      matches = globalThis.KalimatVocabulary.rankVocabulary(state.vocabulary, rawQuery);
    } else {
      const query = normalize(rawQuery);
      if (!query) {
        matches = [...state.vocabulary];
      } else {
        matches = state.vocabulary.filter((word) => {
          const headword = normalize(word.word);
          const norm = normalize(word.normalized);
          if (headword.includes(query) || norm.includes(query)) return true;
          return [
            word.meaningAr,
            word.meaningEn,
            word.contextAr,
            word.contextEn,
            word.exampleAr,
            word.root,
            word.pattern,
            word.register,
            word.partOfSpeech,
            word.pronunciation,
            ...(Array.isArray(word.topics) ? word.topics : []),
          ].some((field) => normalize(field).includes(query));
        });
      }
    }

    const queryClean = (rawQuery || "").trim();
    if (!queryClean) {
      elements["search-count"].textContent = `${matches.length} كلمة`;
    } else if (matches.length === 0) {
      elements["search-count"].textContent = "لا توجد نتائج محلية. جرّب تهجئة أخرى.";
    } else {
      elements["search-count"].textContent = `${matches.length} نتيجة`;
    }

    const shown = queryClean ? matches.slice(0, MAX_SEARCH_RESULTS) : matches;
    elements["search-results"].replaceChildren();
    for (const word of shown) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${word.word} — ${word.meaningAr}`;
      button.addEventListener("click", () => viewWord(word));
      elements["search-results"].append(button);
    }
  }

  function renderOnlineResult(result) {
    const container = elements["explore-card"];
    container.replaceChildren();
    container.hidden = false;

    const badge = document.createElement("span");
    badge.className = "unreviewed-badge";
    badge.textContent = "قاموس خارجي (غير مراجعة)";
    container.append(badge);

    const targetTerm = result.headword || result.query || "";
    const title = document.createElement("h3");
    title.lang = "ar";
    title.textContent = targetTerm;
    container.append(title);

    const definition = document.createElement("p");
    definition.className = "meaning";
    definition.lang = "ar";
    definition.dir = "rtl";
    definition.textContent = result.definitionAr || "";
    container.append(definition);

    const link = document.createElement("a");
    link.className = "online-source-link";
    let sourceUrl = "";
    try {
      const parsed = new URL(result.sourceUrl || "");
      if (parsed.protocol === "https:" && parsed.hostname === "ar.wiktionary.org") sourceUrl = parsed.href;
    } catch (_) {}
    link.href = sourceUrl || `https://ar.wiktionary.org/wiki/${encodeURIComponent(targetTerm)}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "عرض في ويكاموس العربي";
    container.append(link);

    const attribution = document.createElement("p");
    attribution.className = "online-attribution";
    attribution.textContent = "المصدر: ويكاموس العربي — CC BY-SA 4.0 / GFDL";
    container.append(attribution);

    const retrieved = document.createElement("p");
    retrieved.className = "online-retrieved";
    retrieved.textContent = `وقت الاسترجاع: ${result.retrievedAt}`;
    container.append(retrieved);

    show("explore");
  }

  async function lookupOnline(queryOverride, triggeringButton) {
    const btn = triggeringButton || elements["explore-lookup"];
    const query = (typeof queryOverride === "string" && queryOverride.trim())
      ? queryOverride.trim()
      : (elements["atlas-search"]?.value?.trim() || state.today?.word?.word);
    if (!query) {
      return status("أدخل كلمة للبحث عنها.");
    }

    if (btn) {
      btn.setAttribute("aria-busy", "true");
      btn.disabled = true;
    }
    status("جاري البحث في القاموس…");

    try {
      // Chrome-only permission request
      const isChrome = typeof globalThis.chrome !== "undefined" && typeof globalThis.browser === "undefined";
      if (isChrome && globalThis.chrome.permissions?.request) {
        let granted = false;
        try {
          granted = await globalThis.chrome.permissions.request({ origins: ["https://ar.wiktionary.org/*"] });
        } catch (_) {}
        if (granted !== true) {
          status("يلزم إذن للبحث في القاموس عبر الإنترنت.");
          return;
        }
      }

      const result = await ExtApi.runtime.sendMessage({ type: "online.lookup", query });
      if (result?.kind === "online-result") {
        renderOnlineResult(result);
        status("تم العثور على المعنى في القاموس.");
      } else if (result?.kind === "permission-needed") {
        status("يلزم إذن للبحث في القاموس عبر الإنترنت.");
      } else if (result?.kind === "unsupported") {
        status("البحث عبر الإنترنت غير مدعوم في هذا المتصفح.");
      } else if (result?.kind === "not-found") {
        status("لم نجد الكلمة في القاموس عبر الإنترنت.");
      } else {
        status("تعذّر الاتصال بالقاموس عبر الإنترنت.");
      }
    } catch (_) {
      status("تعذّر الاتصال بالقاموس عبر الإنترنت.");
    } finally {
      if (btn) {
        btn.setAttribute("aria-busy", "false");
        btn.disabled = false;
        btn.focus();
      }
    }
  }

  function renderHistory() {
    const filter = elements["history-filter"].value;
    const wordStates = state.profile?.wordStates ?? {};
    const entries = Object.entries(state.profile?.assignments ?? {})
      .sort(([left], [right]) => right.localeCompare(left))
      .filter(([, assignment]) => filter !== "difficult" || (assignment.status ?? wordStates[assignment.wordId]?.status) === "difficult")
      .filter(([, assignment]) => filter !== "saved" || wordStates[assignment.wordId]?.saved === true);

    elements["history-list"].replaceChildren();
    for (const [dateKey, assignment] of entries) {
      const word = wordById(assignment.wordId);
      if (!word) continue;
      const responseStatus = assignment.status ?? wordStates[assignment.wordId]?.status;
      const label = responseStatus === "known" ? "معروف" : responseStatus === "difficult" ? "صعب" : "غير مقيّمة";
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${dateKey} — ${word.word} — ${label}`;
      button.addEventListener("click", () => loadAssignment(dateKey));
      elements["history-list"].append(button);
    }
    if (filter !== "difficult") {
      const assignedIds = new Set(entries.map(([, assignment]) => String(wordById(assignment.wordId)?.id)));
      for (const word of state.vocabulary) {
        const wordState = wordStates[String(word.id)] || wordStates[`w${word.id}`];
        if (wordState?.saved !== true || assignedIds.has(String(word.id))) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `${word.word} · محفوظة`;
        button.addEventListener("click", () => { viewWord(word); show("explore"); });
        elements["history-list"].append(button);
      }
    }
    if (!elements["history-list"].childElementCount) {
      elements["history-list"].textContent = "لا توجد كلمات في هذا العرض.";
    }
  }

  function selectedInterests() {
    return [...document.querySelectorAll('input[name="atlas-interest"]:checked')].map((input) => input.value);
  }

  function hydrateSettings() {
    const profile = state.profile ?? {};
    for (const input of document.querySelectorAll('input[name="atlas-interest"]')) {
      input.checked = profile.interests?.includes(input.value) === true;
    }
    elements["settings-english"].checked = profile.showEnglish !== false;
    elements["settings-remote-speech"].checked = profile.preferences?.allowRemoteSpeech === true;
    elements["settings-speech-rate"].value = String(profile.preferences?.speechRate ?? 0.85);
    elements["settings-speech-repeat"].value = String(profile.preferences?.speechRepeat ?? 1);
    elements["settings-time"].value = state.reminder.time;
    elements["settings-reminder"].setAttribute("aria-checked", String(state.reminder.enabled));
    elements["settings-reminder"].textContent = state.reminder.enabled ? "إيقاف التذكير اليومي" : "تفعيل التذكير اليومي";
  }

  async function saveSettings() {
    if (state.settingsBusy) return;
    const readDraft = () => ({
      level: state.profile?.level ?? 1,
      interests: selectedInterests(),
      showEnglish: elements["settings-english"].checked,
      allowRemoteSpeech: elements["settings-remote-speech"].checked,
      speechRate: Number(elements["settings-speech-rate"].value),
      speechRepeat: Number(elements["settings-speech-repeat"].value),
    });
    const submitted = readDraft();
    if (submitted.interests.length > 3) return status("اختر حتى ثلاثة اهتمامات.");
    const controls = [
      ...document.querySelectorAll('input[name="atlas-interest"]'),
      ...["settings-english", "settings-remote-speech", "settings-speech-rate", "settings-speech-repeat", "settings-save"].map((id) => elements[id]),
    ];
    const disabled = controls.map((control) => control.disabled);
    const wasOnboarding = state.profile === null;
    const focusedControl = controls.includes(document.activeElement) ? document.activeElement : null;
    const viewRevision = state.viewRevision;
    state.settingsBusy = true;
    controls.forEach((control) => { control.disabled = true; });
    try {
      const result = await ExtApi.runtime.sendMessage({ type: "settings.update", ...submitted });
      if (result?.kind === "recovery") return renderRecovery(result.recoveryRaw);
      if (result?.kind !== "ok") throw new Error("Settings unchanged.");
      state.storageWarning = result.storageWarning === true;
      warning(state.storageWarning || state.reminderWarning);
      if (state.storageWarning) return status("الإعدادات مؤقتة ولم تُحفظ. حاول الحفظ مجددًا.");
      state.profile = {
        ...(state.profile ?? {}),
        level: submitted.level,
        interests: submitted.interests,
        showEnglish: submitted.showEnglish,
        preferences: {
          ...(state.profile?.preferences ?? {}),
          showEnglish: submitted.showEnglish,
          allowRemoteSpeech: submitted.allowRemoteSpeech,
          speechRate: submitted.speechRate,
          speechRepeat: submitted.speechRepeat,
        },
      };
      const hasLaterDraft = JSON.stringify(readDraft()) !== JSON.stringify(submitted);
      if (wasOnboarding) await loadAssignment();
      else {
        renderToday();
        if (state.exploreWord) renderWord(elements["explore-card"], state.exploreWord);
      }
      status(hasLaterDraft ? "حُفظت الإعدادات المرسلة. توجد تعديلات لاحقة لم تُحفظ؛ احفظها للمتابعة." : "حُفظت الإعدادات.");
    } finally {
      controls.forEach((control, index) => { control.disabled = disabled[index]; });
      state.settingsBusy = false;
      if (focusedControl && state.view === "settings" && state.viewRevision === viewRevision && !focusedControl.disabled && (!document.activeElement || document.activeElement === document.body)) focusedControl.focus();
    }
  }

  function enqueueReminder(work) {
    const next = reminderQueue.catch(() => undefined).then(work);
    reminderQueue = next.catch(() => undefined);
    return next;
  }

  function configureReminder() {
    return enqueueReminder(async () => {
      const enabled = !state.reminder.enabled;
      const time = elements["settings-time"].value;
      if (!validTime(time)) return status("اختر وقتًا صالحًا.");
      if (enabled && !(await ExtApi.permissions.request({ permissions: ["alarms", "notifications"] }))) return status("لم تُمنح أذونات التذكير.");
      const reminder = await ExtApi.runtime.sendMessage({ type: "reminder.configure", enabled, time });
      if (!reminder || typeof reminder.enabled !== "boolean" || !validTime(reminder.time)) throw new Error("Invalid reminder.");
      state.reminder = { enabled: reminder.enabled, time: reminder.time };
      state.reminderWarning = reminder.storageWarning === true;
      warning(state.reminderWarning || state.storageWarning);
      hydrateSettings();
      return state.reminder;
    });
  }

  function saveReminderTime() {
    const time = elements["settings-time"].value;
    return enqueueReminder(async () => {
      if (!validTime(time)) return status("اختر وقتًا صالحًا.");
      const reminder = await ExtApi.runtime.sendMessage({ type: "reminder.configure", enabled: state.reminder.enabled, time });
      if (!reminder || typeof reminder.enabled !== "boolean" || !validTime(reminder.time)) throw new Error("Invalid reminder.");
      state.reminder = { enabled: reminder.enabled, time: reminder.time };
      state.reminderWarning = reminder.storageWarning === true;
      warning(state.reminderWarning || state.storageWarning);
      hydrateSettings();
      return state.reminder;
    });
  }

  function updateStreakBadge(optionalTodayKey) {
    const badge = elements?.["streak-badge"];
    if (!badge) return;
    const assignments = state.profile?.assignments ?? state.profile;
    const todayKey = optionalTodayKey || state.today?.dateKey || (globalThis.KalimatDate?.todayDateKey ? globalThis.KalimatDate.todayDateKey() : new Date().toISOString().slice(0, 10));
    const streak = globalThis.KalimatStreak?.calculateStreak
      ? globalThis.KalimatStreak.calculateStreak(assignments, todayKey)
      : { currentStreak: 0 };
    const text = globalThis.KalimatStreak?.formatStreakText
      ? globalThis.KalimatStreak.formatStreakText(streak.currentStreak)
      : (streak.currentStreak === 1 ? "يوم واحد" : `${streak.currentStreak} أيام`);
    const digits = globalThis.KalimatStreak?.toArabicDigits
      ? globalThis.KalimatStreak.toArabicDigits(text)
      : text;
    badge.textContent = `🔥 ${digits}`;
  }

  function download(text, name, mimeType = "application/json") {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportAnkiCSV() {
    status("جارٍ تصدير بطاقات Anki…");
    try {
      const words = state.vocabulary && state.vocabulary.length > 0 ? state.vocabulary : (state.today?.word ? [state.today.word] : []);
      const history = state.profile || (state.today?.word ? [state.today.word] : []);
      const csv = globalThis.KalimatExport?.serializeAnkiCSV
        ? globalThis.KalimatExport.serializeAnkiCSV(history, words)
        : null;
      if (!csv) throw new Error("CSV export failed.");
      download(csv, "kalimat-anki-deck.csv", "text/csv;charset=utf-8;");
      status("تم تصدير بطاقات Anki بنجاح.");
    } catch (_) {
      status("تعذّر تصدير بطاقات Anki.");
    }
  }

  async function exportSocialCard(wordToExport, triggeringButton) {
    const word = wordToExport || state.today?.word;
    if (!word) return status("لا توجد كلمة لتوليد البطاقة.");
    const btn = triggeringButton;
    if (btn) {
      btn.setAttribute("aria-busy", "true");
      btn.disabled = true;
    }
    status("جارٍ توليد بطاقة المشاركة…");
    try {
      if (globalThis.KalimatExport?.renderSocialCard) {
        await globalThis.KalimatExport.renderSocialCard(word, { download: true });
        status("تم توليد بطاقة المشاركة.");
      } else {
        throw new Error("Export unavailable");
      }
    } catch (_) {
      status("تعذّر توليد بطاقة المشاركة.");
    } finally {
      if (btn) {
        btn.setAttribute("aria-busy", "false");
        btn.disabled = false;
        btn.focus();
      }
    }
  }

  async function exportState() {
    const result = await ExtApi.runtime.sendMessage({ type: "state.export" });
    if (result?.kind === "recovery") return download(JSON.stringify(result.recoveryRaw, null, 2), "kalimat-recovery.json");
    if (result?.kind !== "export") throw new Error("Invalid export.");
    download(result.text, "kalimat-data.json");
  }

  async function importState(input) {
    const file = input.files?.[0];
    if (!file) return;
    let committed = false;
    try {
      if (file.size > 2 * 1024 * 1024) return status("ملف الاستيراد كبير جدًا.");
      const text = await file.text();
      const result = await ExtApi.runtime.sendMessage({ type: "state.import", text });
      if (result?.kind !== "ok") throw new Error("Import failed.");
      if (result.storageWarning === true) {
        warning(true);
        status("الاستيراد مؤقت ولم يُحفظ. أعد اختيار الملف للمحاولة مجددًا.");
        return;
      }
      committed = true;
      state.recoveryRaw = null;
      warning(result.storageWarning === true || state.reminderWarning);
      await load();
    } catch (_) {
      status(committed ? "استوردنا الملف، لكن تعذّر تحديث العرض. افتح الأطلس مجددًا." : "تعذّر استيراد الملف. لم نغيّر بياناتك.");
    } finally {
      input.value = "";
    }
  }

  async function clearState() {
    if (!globalThis.confirm("هل تريد مسح بيانات كلمات؟ لا يمكن التراجع عن ذلك.")) return;
    const result = await ExtApi.runtime.sendMessage({ type: "state.clear" });
    if (result?.kind !== "ok") throw new Error("Clear failed.");
    state.reminderWarning = result.reminderWarning === true;
    state.storageWarning = result.storageWarning === true;
    if (result.reminder !== null) state.reminder = result.reminder ?? { ...state.reminder, enabled: false };
    warning(result.storageWarning === true || state.reminderWarning);
    hydrateSettings();
    if (result.profilePersisted === false) {
      return status("المسح مؤقت ولم يُحفظ. حاول مجددًا." + (state.reminder.enabled ? " التذكير ما زال مفعّلًا." : ""));
    }
    state.profile = null;
    state.today = null;
    state.exploreWord = null;
    state.recoveryRaw = null;
    show("onboarding");
    status(state.reminderWarning ? "مُسحت البيانات. تعذّر تأكيد إيقاف التذكير؛ تحقق من إعداداته." : "مُسحت البيانات.");
  }

  async function feedback(statusName) {
    if (!state.today?.word) return;
    const btn = elements[statusName === "known" ? "today-known" : "today-difficult"];
    const feedbackButtons = [elements["today-known"], elements["today-difficult"]];
    if (feedbackButtons.some((feedbackButton) => feedbackButton.disabled)) return;
    let restoreFocus = true;
    feedbackButtons.forEach((feedbackButton) => { feedbackButton.setAttribute("aria-busy", "true"); feedbackButton.disabled = true; });
    actionStatus("جارٍ حفظ تقييمك…");
    try {
      const result = await ExtApi.runtime.sendMessage({
        type: "word.feedback",
        dateKey: state.today.dateKey,
        wordId: state.today.word.id,
        status: statusName,
      });
      if (result?.kind === "recovery") { restoreFocus = false; return renderRecovery(result.recoveryRaw); }
      if (result?.kind !== "ok") throw new Error("Feedback unchanged.");
      state.storageWarning = result.storageWarning === true;
      if (state.storageWarning) {
        warning(true);
        status("التغيير مؤقت ولم يُحفظ. حاول مجددًا.", false);
        actionStatus("التغيير مؤقت ولم يُحفظ. حاول مجددًا.", true);
        return;
      }
      warning(result.storageWarning === true || state.reminderWarning);
      const authoritativeStatus = result.status ?? statusName;
      const dateKey = result.dateKey ?? state.today.dateKey;
      const wordId = result.wordId ?? state.today.word.id;
      state.profile.wordStates ??= {};
      state.profile.wordStates[wordId] = { ...state.profile.wordStates[wordId], status: authoritativeStatus, dateKey };
      state.profile.assignments ??= {};
      state.profile.assignments[dateKey] = { ...state.profile.assignments[dateKey], wordId, status: authoritativeStatus };
      renderToday();
      updateStreakBadge();
      status("تم حفظ تقييمك.", false);
      actionStatus("تم حفظ تقييمك.");
      await refreshProfile();
      await loadDueReviews({ force: true });
    } catch (_) {
      status("تعذّر حفظ التقييم.", false);
      actionStatus("تعذّر حفظ التقييم.", true);
    } finally {
      feedbackButtons.forEach((feedbackButton) => { feedbackButton.setAttribute("aria-busy", "false"); feedbackButton.disabled = false; });
      if (restoreFocus) btn.focus();
    }
  }

  async function toggleSave() {
    if (!state.today?.word) return;
    const currentState = state.profile?.wordStates?.[String(state.today.word.id)] || state.profile?.wordStates?.[`w${state.today.word.id}`];
    const current = currentState?.saved === true;
    const btn = elements["today-save"];
    let restoreFocus = true;
    if (btn?.disabled) return;
    if (btn) {
      btn.setAttribute("aria-busy", "true");
      btn.disabled = true;
    }
    actionStatus("جارٍ تحديث الحفظ…");
    try {
      const result = await ExtApi.runtime.sendMessage({
        type: "word.save",
        wordId: state.today.word.id,
        saved: !current,
      });
      if (result?.kind === "recovery") { restoreFocus = false; return renderRecovery(result.recoveryRaw); }
      if (result?.kind !== "ok") throw new Error("Save unchanged.");
      state.storageWarning = result.storageWarning === true;
      if (state.storageWarning) {
        warning(true);
        status("التغيير مؤقت ولم يُحفظ. حاول مجددًا.", false);
        actionStatus("التغيير مؤقت ولم يُحفظ. حاول مجددًا.", true);
        return;
      }
      warning(result.storageWarning === true || state.reminderWarning);
      const saved = typeof result.saved === "boolean" ? result.saved : !current;
      const wordId = result.wordId ?? state.today.word.id;
      state.profile.wordStates ??= {};
      state.profile.wordStates[wordId] = { ...state.profile.wordStates[wordId], saved };
      renderToday();
      updateStreakBadge();
      status(saved ? "حُفظت الكلمة." : "أزيل الحفظ.", false);
      actionStatus(saved ? "حُفظت الكلمة." : "أزيل الحفظ.");
    } catch (_) {
      status("تعذّر الحفظ.", false);
      actionStatus("تعذّر الحفظ.", true);
    } finally {
      if (btn) {
        btn.setAttribute("aria-busy", "false");
        btn.disabled = false;
        if (restoreFocus) btn.focus();
      }
    }
  }

  async function loadAssignment(dateKey) {
    const result = await ExtApi.runtime.sendMessage({ type: "assignment.get", dateKey });
    if (result?.kind === "recovery") return renderRecovery(result.recoveryRaw);
    if (result?.kind !== "assigned") {
      show("empty");
      return status("لا توجد كلمة محفوظة لهذا التاريخ.");
    }
    const word = wordById(result.wordId);
    if (!word) {
      show("error");
      return status("الكلمة غير متاحة.");
    }
    let profileWarning = false;
    if (!dateKey && !state.profile) {
      // Clear intentionally drops the old profile. Rehydrate from authority,
      // without depending on a later storage event or a settings submission.
      const exported = await ExtApi.runtime.sendMessage({ type: "state.export" });
      if (exported?.kind === "recovery") return renderRecovery(exported.recoveryRaw);
      if (exported?.kind !== "export") throw new Error("Profile unavailable.");
      profileWarning = exported.storageWarning === true;
      if (profileWarning) {
        let confirmed;
        try { confirmed = (await ExtApi.storage.local.get("kalimat.profile"))["kalimat.profile"]; } catch (_) { /* Keep remote speech off if unreadable. */ }
        state.profile = confirmed ?? { level: 1, interests: [], showEnglish: false, preferences: { allowRemoteSpeech: false }, assignments: {}, wordStates: {} };
      } else state.profile = JSON.parse(exported.text);
      if (!state.profile || typeof state.profile !== "object") throw new Error("Profile unavailable.");
    }
    state.storageWarning = result.storageWarning === true || profileWarning;
    warning(state.storageWarning || state.reminderWarning);
    if (!dateKey) {
      mergeAssignment(result);
      state.today = { ...result, word };
      renderToday();
      show("today");
      return;
    }
    viewWord(word);
    show("explore");
  }

  function renderRecovery(raw) {
    state.recoveryRaw = raw;
    show("recovery");
    status("");
  }

  function renderError(message = "تعذّر تحميل الأطلس.") {
    show("error");
    status(message);
  }

  function returnToToday() {
    if (!state.today?.word) return loadAssignment().catch(() => renderError("تعذّر تحميل كلمة اليوم."));
    elements["return-today"].hidden = true;
    elements["explore-card"].hidden = true;
    show("today");
    renderToday();
  }

  async function load() {
    const response = await fetch(ExtApi.runtime.getURL("data/vocabulary.json"));
    if (!response.ok) throw new Error("Vocabulary unavailable.");
    state.vocabulary = await response.json();
    const params = new URLSearchParams(globalThis.location.search);
    const query = params.get("date");
    const dateKey = globalThis.KalimatDate.isDateKey(query) ? query : undefined;
    const requestedView = params.get("view");
    const requestedQuery = params.get("q") ?? "";
    const requestedId = params.get("id");
    const directWord = requestedId && requestedId.length <= 64 && !/[\u0000-\u001F\u007F]/.test(requestedId)
      ? wordById(requestedId)
      : null;
    if (requestedId && !directWord) return renderError("الكلمة غير متاحة.");
    const exploreRequested = !params.has("date")
      && requestedView === "explore"
      && requestedQuery.length <= 256
      && !/[\u0000-\u001F\u007F]/.test(requestedQuery);
    const assignmentRequest = dateKey ? { type: "assignment.get", dateKey } : { type: "assignment.get" };
    const [assignment, exported, settings] = await Promise.all([
      ExtApi.runtime.sendMessage(assignmentRequest),
      ExtApi.runtime.sendMessage({ type: "state.export" }),
      ExtApi.runtime.sendMessage({ type: "settings.get" }),
    ]);
    if (assignment?.kind === "recovery" || exported?.kind === "recovery") {
      return renderRecovery(assignment?.recoveryRaw ?? exported?.recoveryRaw);
    }
    if (exported?.kind !== "export") throw new Error("Profile unavailable.");
    if (!assignment || !["assigned", "no-new-word"].includes(assignment.kind)) throw new Error("Assignment unavailable.");
    if (settings?.kind !== "settings" || !settings.reminder || typeof settings.reminder.enabled !== "boolean" || !validTime(settings.reminder.time)) throw new Error("Settings unavailable.");
    if (exported.storageWarning === true) {
      // A fallback export is readable, but its mutations/consent are temporary.
      let confirmed;
      try { confirmed = (await ExtApi.storage.local.get("kalimat.profile"))["kalimat.profile"]; } catch (_) { /* Keep conservative defaults if unreadable. */ }
      state.profile = confirmed ?? { level: 1, interests: [], showEnglish: false, preferences: { allowRemoteSpeech: false }, assignments: {}, wordStates: {} };
    } else state.profile = JSON.parse(exported.text);
    if (!state.profile || typeof state.profile !== "object") throw new Error("Profile unavailable.");
    state.reminder = settings.reminder;
    state.reminderWarning = settings?.storageWarning === true;
    state.storageWarning = exported.storageWarning === true || assignment.storageWarning === true;
    state.recoveryRaw = null;
    warning(state.storageWarning || state.reminderWarning);
    hydrateSettings();
    const assignedWord = assignment?.kind === "assigned" ? wordById(assignment.wordId) : null;
    if (assignment?.kind === "assigned" && !assignedWord) return renderError("الكلمة غير متاحة.");
    // Keep the current encounter available before secondary routes return.
    // A dated lookup is historical and must never become the Today anchor.
    if (!dateKey && assignedWord) {
      mergeAssignment(assignment);
      state.today = { ...assignment, word: assignedWord };
      renderToday();
    }
    if (requestedView === "settings" && !dateKey) { show("settings"); return; }
    if (directWord) {
      const reviewResult = await loadDueReviews({ force: true });
      if (reviewResult?.kind === "recovery" || ReviewSession.isRecovery(reviewSession)) return;
      viewWord(directWord);
      show("explore");
      return;
    }
    updateStreakBadge(assignment?.dateKey);
    if (assignment?.kind === "assigned") {
      if (dateKey) {
        viewWord(assignedWord);
        show("explore");
      } else {
        show("today");
        const reviewResult = await loadDueReviews({ force: true });
        if (reviewResult?.kind === "recovery" || ReviewSession.isRecovery(reviewSession)) return;
        if (exploreRequested) {
          elements["atlas-search"].value = requestedQuery;
          search();
          show("explore");
          elements["atlas-search"].focus();
        }
      }
    } else if (exploreRequested) {
      elements["atlas-search"].value = requestedQuery;
      search();
      show("explore");
      elements["atlas-search"].focus();
    } else {
      show("empty");
      status(dateKey ? "لا توجد كلمة محفوظة لهذا التاريخ." : "لا توجد كلمة جديدة اليوم.");
    }
  }

  const reviewSession = ReviewSession.create();
  let reviewQueueLoad = null;
  let reviewQueueRefreshRequested = false;
  let reviewInvoker = null;

  function toArabicDigits(value) {
    if (globalThis.KalimatStreak?.toArabicDigits) return globalThis.KalimatStreak.toArabicDigits(value);
    return String(value ?? "").replace(/[0-9]/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[digit]);
  }

  function formatReviewCount(count) {
    const value = Math.max(0, Number(count) || 0);
    if (value === 1) return "مراجعة واحدة";
    if (value === 2) return "مراجعتين";
    if (value >= 3 && value <= 10) return `${toArabicDigits(value)} مراجعات`;
    return `${toArabicDigits(value)} مراجعة`;
  }

  function speechResult(result) {
    if (result?.kind === "voices-loading") status("قائمة الأصوات لم تجهز بعد. حاول النطق مجددًا بعد قليل.");
    else if (result?.kind === "remote-opt-in") status("لا يتوفر صوت عربي محلي. يمكنك السماح بالنطق عبر الإنترنت من إعدادات الأطلس.");
    else if (["no-local-arabic-voice", "no-arabic-voice"].includes(result?.kind)) status("لا يتوفر صوت عربي محلي. أضف حزمة صوت عربية ثم حاول مجددًا.");
    else if (!result || result.kind === "unavailable") status("تعذّر تشغيل النطق على هذا الجهاز.");
  }

  function speak(text) {
    const result = globalThis.KalimatSpeech?.speak(text, {
      rate: state.profile?.preferences?.speechRate ?? 0.85,
      repeat: state.profile?.preferences?.speechRepeat ?? 1,
      allowRemote: state.profile?.preferences?.allowRemoteSpeech === true,
      onStart: () => status("جارٍ النطق…"),
      onEnd: () => status("اكتمل النطق."),
      onError: () => status("تعذّر تشغيل النطق. حاول مجددًا."),
      requireVoice: true,
    });
    speechResult(result);
  }

  function hideReviewBadge() {
    if (elements["due-review-badge"]) elements["due-review-badge"].hidden = true;
  }

  function reviewButtons() {
    return [elements["rate-again"], elements["rate-hard"], elements["rate-good"], elements["rate-easy"]].filter(Boolean);
  }

  function syncReviewControls() {
    const speechLabel = state.profile?.preferences?.allowRemoteSpeech === true ? "استمع (قد يستخدم الإنترنت)" : "استمع للنطق المحلي";
    if (elements["card-front-speak"]) elements["card-front-speak"].textContent = speechLabel;
    elements["card-front-speak"]?.setAttribute("aria-label", speechLabel);
    const revealed = ReviewSession.isRevealed(reviewSession);
    if (elements["practice-ratings"]) elements["practice-ratings"].hidden = !revealed;
    for (const button of reviewButtons()) button.disabled = !revealed || ReviewSession.isSubmitting(reviewSession);
    if (elements["card-front-speak"]) elements["card-front-speak"].disabled = revealed;
    if (elements["card-front-face"]) elements["card-front-face"].setAttribute("aria-hidden", String(revealed));
    if (elements["card-back-face"]) elements["card-back-face"].setAttribute("aria-hidden", String(!revealed));
    if (elements["flashcard-card"]) elements["flashcard-card"].classList.toggle("flipped", revealed);
    if (elements["card-front-flip"]) {
      elements["card-front-flip"].setAttribute("aria-pressed", String(revealed));
      const label = revealed ? "أخفِ المعنى" : "اقلب البطاقة";
      elements["card-front-flip"].setAttribute("aria-label", label);
      elements["card-front-flip"].textContent = label;
    }
  }

  function clearPracticeCard() {
    ReviewSession.resetCard(reviewSession);
    for (const element of [elements["card-front-word"], elements["card-front-vocalization"], elements["card-front-weight"], elements["card-front-root"], elements["card-back-meaning-ar"], elements["card-back-meaning-en"], elements["card-back-example-ar"], elements["card-back-context"]]) {
      if (element) element.textContent = "";
    }
    if (elements["practice-progress"]) elements["practice-progress"].textContent = "";
    for (const button of reviewButtons()) {
      const interval = button.querySelector?.(".rate-interval");
      if (interval) interval.textContent = "—";
      button.setAttribute("aria-busy", "false");
    }
    syncReviewControls();
  }

  function practiceIsActive() {
    return ReviewSession.isSubmitting(reviewSession) || elements["practice-dialog"]?.open === true || elements["practice-dialog"]?.hasAttribute("open");
  }

  let profileRefreshRevision = 0;
  async function refreshProfile() {
    const revision = ++profileRefreshRevision;
    try {
      const exported = await ExtApi.runtime.sendMessage({ type: "state.export" });
      if (revision !== profileRefreshRevision) return;
      if (exported?.kind === "recovery") return renderRecovery(exported.recoveryRaw);
      if (exported?.kind !== "export") return;
      if (exported.storageWarning === true) { warning(true); return; }
      state.profile = JSON.parse(exported.text);
      const label = state.profile?.preferences?.allowRemoteSpeech === true ? "🔊 استمع (قد يستخدم الإنترنت)" : "🔊 استمع للنطق المحلي";
      for (const button of document.querySelectorAll(".word-speak")) {
        button.textContent = label;
        button.setAttribute("aria-label", label);
      }
      if (elements["card-front-speak"]) {
        elements["card-front-speak"].textContent = label;
        elements["card-front-speak"].setAttribute("aria-label", label);
      }
      warning(exported.storageWarning === true || state.reminderWarning || state.storageWarning);
      if (state.today) {
        const assignment = state.profile.assignments?.[state.today.dateKey];
        state.today.status = assignment?.status;
        const wordState = state.profile.wordStates?.[String(state.today.word.id)] || state.profile.wordStates?.[`w${state.today.word.id}`];
        elements["today-known"].setAttribute("aria-pressed", String(assignment?.status === "known"));
        elements["today-difficult"].setAttribute("aria-pressed", String(assignment?.status === "difficult"));
        elements["today-save"].setAttribute("aria-pressed", String(wordState?.saved === true || (wordState?.saved === undefined && state.profile.favorites?.[String(state.today.word.id)] === true)));
      }
      updateStreakBadge();
    } catch (_) { warning(true); }
  }

  function listenForProfileChanges() {
    ExtApi.storage?.onChanged?.addListener((changes, areaName) => {
      if ((areaName && areaName !== "local") || !changes?.["kalimat.profile"]) return;
      refreshProfile().then(() => {
        if (!practiceIsActive()) return loadDueReviews({ force: true });
      });
    });
  }

  function loadDueReviews({ force = false } = {}) {
    if (ReviewSession.isSubmitting(reviewSession) || (practiceIsActive() && !ReviewSession.hasError(reviewSession))) return Promise.resolve();
    if (!force && ReviewSession.isLoaded(reviewSession)) return Promise.resolve();
    if (reviewQueueLoad) {
      if (force) reviewQueueRefreshRequested = true;
      return reviewQueueLoad;
    }

    hideReviewBadge();
    reviewQueueLoad = (async () => {
      let result;
      do {
        // A mutation may commit while this request is pending. Keep all callers
        // waiting until a later request has observed that authoritative state.
        reviewQueueRefreshRequested = false;
        result = await ReviewSession.load(reviewSession, () => ExtApi.runtime.sendMessage({ type: "review.queue" }));
      } while (reviewQueueRefreshRequested && !practiceIsActive());
      if (result.kind === "recovery") {
          hideReviewBadge();
          renderRecovery(result.recoveryRaw);
          return result;
      }
      if (result.kind === "queue") {
        const queue = result.queue;
        warning(queue.storageWarning || state.storageWarning || state.reminderWarning);
        if (elements["due-review-badge"]) {
          if (queue.dueCount > 0) {
            elements["due-review-badge"].hidden = false;
            elements["due-review-badge"].textContent = `${queue.dueCount} مستحقة`;
            elements["due-review-badge"].setAttribute("aria-label", `المراجعات المستحقة اليوم: ${formatReviewCount(queue.dueCount)}`);
          } else {
            elements["due-review-badge"].hidden = true;
          }
        }
      } else {
        hideReviewBadge();
        clearPracticeCard();
      }
      return result;
    })();
    const pending = reviewQueueLoad;
    pending.then(() => {
      if (reviewQueueLoad === pending) reviewQueueLoad = null;
    }, () => {
      if (reviewQueueLoad === pending) reviewQueueLoad = null;
    });
    return pending;
  }

  function presentPracticeDialog() {
    if (!elements["practice-dialog"]) return;
    if (typeof elements["practice-dialog"].showModal === "function") elements["practice-dialog"].showModal();
    else elements["practice-dialog"].setAttribute("open", "");
  }

  function showPracticeError() {
    if (elements["practice-body"]) elements["practice-body"].hidden = false;
    if (elements["practice-finished"]) elements["practice-finished"].hidden = true;
    if (elements["practice-error"]) elements["practice-error"].hidden = false;
    if (elements["practice-error-message"]) elements["practice-error-message"].textContent = ReviewSession.error(reviewSession) || "تعذّر تحميل المراجعات. حاول مجددًا.";
    clearPracticeCard();
    status(ReviewSession.error(reviewSession) || "تعذّر تحميل المراجعات. حاول مجددًا.");
  }

  function showPracticeContent() {
    if (ReviewSession.isRecovery(reviewSession)) return;
    if (ReviewSession.hasError(reviewSession)) return showPracticeError();
    if (ReviewSession.count(reviewSession) === 0) return showPracticeFinished();
    showPracticeCard(0);
  }

  async function openPracticeModal() {
    if (!elements["practice-dialog"] || practiceIsActive()) return;
    reviewInvoker = document.activeElement && typeof document.activeElement.focus === "function" ? document.activeElement : null;
    await refreshProfile();
    const result = await loadDueReviews({ force: true });
    if (result?.kind === "recovery" || ReviewSession.isRecovery(reviewSession)) return;
    showPracticeContent();
    presentPracticeDialog();
  }

  function restoreReviewFocus() {
    const invoker = reviewInvoker;
    reviewInvoker = null;
    if (invoker && typeof invoker.focus === "function") invoker.focus();
  }

  function closePracticeModal() {
    if (!elements["practice-dialog"]) return;
    if (typeof elements["practice-dialog"].close === "function") elements["practice-dialog"].close();
    else {
      elements["practice-dialog"].removeAttribute("open");
      restoreReviewFocus();
    }
    loadDueReviews({ force: true });
  }

  function handlePracticeDialogClose() {
    if (ReviewSession.isRecovery(reviewSession)) {
      reviewInvoker = null;
      return;
    }
    restoreReviewFocus();
  }

  function dismissPracticeForRecovery() {
    if (elements["practice-dialog"]) {
      if (typeof elements["practice-dialog"].close === "function") elements["practice-dialog"].close();
      else elements["practice-dialog"].removeAttribute("open");
    }
    if (elements["practice-body"]) elements["practice-body"].hidden = true;
    if (elements["practice-finished"]) elements["practice-finished"].hidden = true;
    if (elements["practice-error"]) elements["practice-error"].hidden = true;
    clearPracticeCard();
  }

  function showPracticeCard(index) {
    if (index < 0 || index >= ReviewSession.count(reviewSession)) {
      showPracticeFinished();
      return;
    }
    if (elements["practice-body"]) elements["practice-body"].hidden = false;
    if (elements["practice-finished"]) elements["practice-finished"].hidden = true;

    const item = ReviewSession.showCard(reviewSession, index);
    const word = item.word || item;
    if (elements["practice-error"]) elements["practice-error"].hidden = true;
    const reviewOptions = item.reviewOptions || {};
    for (const [key, button] of [["again", elements["rate-again"]], ["hard", elements["rate-hard"]], ["good", elements["rate-good"]], ["easy", elements["rate-easy"]]]) {
      const label = reviewOptions[key]?.label;
      if (!button || !label) continue;
      const interval = button.querySelector?.(".rate-interval");
      if (interval) interval.textContent = label;
    }
    if (elements["practice-progress"]) {
      elements["practice-progress"].textContent = `${index + 1} / ${ReviewSession.count(reviewSession)}`;
    }
    if (elements["card-front-word"]) elements["card-front-word"].textContent = word.word || "";
    if (elements["card-front-vocalization"]) elements["card-front-vocalization"].textContent = word.vocalization || word.pronunciation || "";
    if (elements["card-front-weight"]) elements["card-front-weight"].textContent = word.sarfWeight || word.weight || "";
    if (elements["card-front-root"]) elements["card-front-root"].textContent = word.root ? `الجذر: ${word.root}` : "";
    if (elements["card-back-meaning-ar"]) elements["card-back-meaning-ar"].textContent = word.meaningAr || word.meaning || "";
    if (elements["card-back-meaning-en"]) {
      elements["card-back-meaning-en"].textContent = word.meaningEn || word.englishMeaning || "";
      elements["card-back-meaning-en"].hidden = state.profile?.showEnglish === false || !elements["card-back-meaning-en"].textContent;
    }
    if (elements["card-back-example-ar"]) elements["card-back-example-ar"].textContent = word.exampleAr || word.example || "";
    if (elements["card-back-context"]) elements["card-back-context"].textContent = word.contextAr || word.context || "";
    syncReviewControls();
  }

  function showPracticeFinished() {
    if (elements["practice-body"]) elements["practice-body"].hidden = true;
    if (elements["practice-finished"]) elements["practice-finished"].hidden = false;
    if (elements["practice-error"]) elements["practice-error"].hidden = true;
    clearPracticeCard();
    const reviewMeta = ReviewSession.meta(reviewSession);
    const remainingCount = Math.max(0, reviewMeta.remainingCount);
    const finishedMessage = elements["practice-finished-message"];
    if (remainingCount > 0) {
      const message = `أتممت ${toArabicDigits(reviewMeta.visibleCount)} من ${toArabicDigits(reviewMeta.dueCount)} مراجعة؛ تبقت ${formatReviewCount(remainingCount)}.`;
      if (finishedMessage) finishedMessage.textContent = message;
      if (elements["due-review-badge"]) {
        elements["due-review-badge"].hidden = false;
        elements["due-review-badge"].textContent = `${remainingCount} مستحقة`;
        elements["due-review-badge"].setAttribute("aria-label", `المراجعات المتبقية بعد الجلسة: ${formatReviewCount(remainingCount)}`);
      }
      status(message);
    } else {
      if (finishedMessage) finishedMessage.textContent = "انتهت جلسة التذكّر الاختيارية.";
      if (elements["due-review-badge"]) elements["due-review-badge"].hidden = true;
    }
  }

  function flipCard() {
    ReviewSession.toggleReveal(reviewSession);
    syncReviewControls();
    status(ReviewSession.isRevealed(reviewSession) ? "كُشف المعنى." : "أُخفي المعنى.");
  }

  async function submitRating(rating) {
    const currentItem = ReviewSession.beginSubmission(reviewSession);
    if (!currentItem) return;
    const wordId = currentItem.word?.id ?? currentItem.wordId ?? currentItem.id;
    const buttons = reviewButtons();
    syncReviewControls();
    buttons.forEach((button) => button.setAttribute("aria-busy", "true"));
    try {
      const result = await ExtApi.runtime.sendMessage({
        type: "word.review",
        wordId,
        rating,
        dateKey: state.today?.dateKey || (globalThis.KalimatDate?.todayDateKey ? globalThis.KalimatDate.todayDateKey() : new Date().toISOString().slice(0, 10)),
      });
      if (result?.kind === "recovery") return renderRecovery(result.recoveryRaw);
      if (result?.kind === "stale") {
        ReviewSession.fail(reviewSession, "تغيّرت بيانات التعلّم. حدّث المراجعات للمتابعة.");
        hideReviewBadge();
        showPracticeError();
        return;
      }
      if (result?.kind !== "ok" || result.storageWarning === true) throw new Error("Review unchanged.");
      const nextIndex = ReviewSession.advance(reviewSession);
      if (nextIndex !== null) {
        showPracticeCard(nextIndex);
        status("تم حفظ المراجعة.");
      } else {
        showPracticeFinished();
        if (ReviewSession.meta(reviewSession).remainingCount === 0) status("تم حفظ المراجعة.");
      }
    } catch (_) {
      ReviewSession.finishSubmission(reviewSession);
      syncReviewControls();
      status("تعذّر حفظ المراجعة. حاول مجددًا.");
    } finally {
      ReviewSession.finishSubmission(reviewSession);
      buttons.forEach((button) => button.setAttribute("aria-busy", "false"));
    }
  }

  function handleKeyDown(event) {
    const isDialogOpen = elements["practice-dialog"] && (elements["practice-dialog"].open || elements["practice-dialog"].hasAttribute("open"));
    if (isDialogOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        closePracticeModal();
        return;
      }
      if (event.key === " " || event.key === "Enter") {
        const targetTag = (event.target?.tagName || "").toLowerCase();
        if (targetTag !== "button") {
          event.preventDefault();
          flipCard();
          return;
        }
      }
      if (event.key === "1" || event.key === "١") {
        if (!ReviewSession.isRevealed(reviewSession)) return;
        event.preventDefault();
        submitRating("again");
        return;
      }
      if (event.key === "2" || event.key === "٢") {
        if (!ReviewSession.isRevealed(reviewSession)) return;
        event.preventDefault();
        submitRating("hard");
        return;
      }
      if (event.key === "3" || event.key === "٣") {
        if (!ReviewSession.isRevealed(reviewSession)) return;
        event.preventDefault();
        submitRating("good");
        return;
      }
      if (event.key === "4" || event.key === "٤") {
        if (!ReviewSession.isRevealed(reviewSession)) return;
        event.preventDefault();
        submitRating("easy");
        return;
      }
    } else {
      const targetTag = (event.target?.tagName || "").toLowerCase();
      if (targetTag !== "input" && targetTag !== "textarea" && targetTag !== "select") {
        if (event.key === "p" || event.key === "P" || event.key === "ح") {
          event.preventDefault();
          openPracticeModal();
        }
      }
    }
  }

  function listen() {
    elements.today.addEventListener("click", returnToToday);
    elements.explore.addEventListener("click", () => { show("explore"); search(); });
    elements.history.addEventListener("click", () => { show("history"); renderHistory(); });
    elements.settings.addEventListener("click", () => { show("settings"); hydrateSettings(); });
    elements["atlas-search"].addEventListener("input", search);
    // ponytail: no debounce here — the packaging contract bans timer APIs in
    // extension pages, and canonical-key memoization keeps keystroke cost low.
    // Add debouncing (and lift the packaging ban) if the corpus grows past a
    // few thousand records.
    if (elements["explore-lookup"]) {
      elements["explore-lookup"].hidden = Boolean(globalThis.browser);
      if (!globalThis.browser) elements["explore-lookup"].addEventListener("click", () => lookupOnline(null, elements["explore-lookup"]));
    }
    document.querySelectorAll("label.file-button").forEach((label) => label.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); label.click(); }
    }));
    elements["return-today"].addEventListener("click", returnToToday);
    elements["history-filter"].addEventListener("change", renderHistory);
    elements["settings-save"].addEventListener("click", () => saveSettings().catch(() => status("تعذّر حفظ الإعدادات.")));
    document.querySelectorAll('input[name="atlas-interest"]').forEach((input) => input.addEventListener("change", () => { if (selectedInterests().length > 3) input.checked = false; }));
    elements["settings-reminder"].addEventListener("click", () => configureReminder().catch(() => status("تعذّر تغيير التذكير.")));
    elements["settings-time"].addEventListener("change", () => saveReminderTime().catch(() => status("تعذّر حفظ الوقت.")));
    elements.export.addEventListener("click", () => exportState().catch(() => status("تعذّر التصدير.")));
    if (elements["history-export-anki"]) elements["history-export-anki"].addEventListener("click", () => exportAnkiCSV());
    if (elements["btn-export-anki"]) elements["btn-export-anki"].addEventListener("click", () => exportAnkiCSV());
    if (elements["today-export-card"]) elements["today-export-card"].addEventListener("click", () => exportSocialCard(state.today?.word, elements["today-export-card"]));
    elements["import-file"].addEventListener("change", () => importState(elements["import-file"]));
    elements.clear.addEventListener("click", () => clearState().catch(() => status("تعذّر مسح البيانات.")));
    elements["recovery-export"].addEventListener("click", () => exportState().catch(() => status("تعذّر التصدير.")));
    elements["recovery-import"].addEventListener("change", () => importState(elements["recovery-import"]));
    elements["recovery-clear"].addEventListener("click", () => clearState().catch(() => status("تعذّر مسح البيانات.")));
    elements["onboarding-settings"].addEventListener("click", () => { show("settings"); hydrateSettings(); });
    elements["today-known"].addEventListener("click", () => feedback("known").catch(() => status("تعذّر حفظ التقييم.")));
    elements["today-difficult"].addEventListener("click", () => feedback("difficult").catch(() => status("تعذّر حفظ التقييم.")));
    elements["today-save"].addEventListener("click", () => toggleSave().catch(() => status("تعذّر الحفظ.")));

    if (elements["due-review-badge"]) elements["due-review-badge"].addEventListener("click", openPracticeModal);
    if (elements["practice-close"]) elements["practice-close"].addEventListener("click", closePracticeModal);
    if (elements["practice-finish-btn"]) elements["practice-finish-btn"].addEventListener("click", closePracticeModal);
    if (elements["practice-retry"]) elements["practice-retry"].addEventListener("click", () => {
      loadDueReviews({ force: true }).then((result) => {
        if (result?.kind === "recovery" || ReviewSession.isRecovery(reviewSession)) {
          dismissPracticeForRecovery();
          return;
        }
        showPracticeContent();
      });
    });
    if (elements["practice-dialog"]) elements["practice-dialog"].addEventListener("close", handlePracticeDialogClose);
    if (elements["card-front-flip"]) elements["card-front-flip"].addEventListener("click", flipCard);
    if (elements["card-front-speak"]) {
      elements["card-front-speak"].addEventListener("click", (e) => {
        e.stopPropagation();
        const currentItem = ReviewSession.current(reviewSession);
        const w = currentItem?.word || currentItem;
        if (w?.word) speak(w.word);
      });
    }
    if (elements["rate-again"]) elements["rate-again"].addEventListener("click", () => submitRating("again"));
    if (elements["rate-hard"]) elements["rate-hard"].addEventListener("click", () => submitRating("hard"));
    if (elements["rate-good"]) elements["rate-good"].addEventListener("click", () => submitRating("good"));
    if (elements["rate-easy"]) elements["rate-easy"].addEventListener("click", () => submitRating("easy"));

    document.addEventListener("keydown", handleKeyDown);
  }

  let themeController = null;

  async function initialize() {
    elements = collect();
    if (globalThis.KalimatTheme?.initThemeController) {
      themeController = globalThis.KalimatTheme.initThemeController({
        storageArea: ExtApi?.storage?.local,
        targetDoc: document,
        selectElement: elements["theme-select"],
      });
    }
    listen();
    listenForProfileChanges();
    try {
      await load();
    } catch (_) { renderError(); }
  }

  globalThis.KalimatAtlas = {
    canonicalSearchKey,
    normalize,
    load,
    initialize,
    loadAssignment,
    renderHistory,
    search,
    viewWord,
    saveSettings,
    clearState,
    importState,
    returnToToday,
    feedback,
    toggleSave,
    configureReminder,
    saveReminderTime,
    lookupOnline,
    exportAnkiCSV,
    exportSocialCard,
    updateStreakBadge,
    loadDueReviews,
    openPracticeModal,
    closePracticeModal,
    flipCard,
    submitRating,
    speak,
    getThemeController: () => themeController,
    getReminder: () => ({ ...state.reminder }),
    getRecoveryRaw: () => state.recoveryRaw,
  };
  globalThis.addEventListener?.("pagehide", () => globalThis.KalimatSpeech?.cancel());
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
