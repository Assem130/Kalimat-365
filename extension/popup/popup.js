(() => {
  "use strict";
  const ExtApi = globalThis.browser ?? globalThis.chrome;
  const byId = (id) => document.getElementById(id);
  const state = { word: null, dateKey: null, profile: null, storageWarning: false, speakAvailable: false, view: "" };
  let elements;
  let themeController = null;
  let profileRefreshRevision = 0;
  const ARABIC_DATE_OPTIONS = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  function collectElements() {
    return Object.fromEntries(Object.entries({
      assigned: "assigned", empty: "empty", error: "error", recovery: "recovery",
      emptyTitle: "empty-title", errorTitle: "error-title", recoveryTitle: "recovery-title",
      status: "status", warning: "warning", actionStatus: "action-status", word: "word",
      meaningAr: "meaning-ar", meaningEn: "meaning-en", example: "example", contextEn: "example-en",
      pronunciation: "pronunciation", translation: "translation", vocalization: "vocalization", vocalizationDetails: "vocalization-details", register: "register",
      save: "save", speak: "speak", explore: "explore", assignmentDate: "assignment-date",
    }).map(([name, id]) => [name, byId(id)]));
  }
  function show(name) {
    const changed = state.view !== name;
    state.view = name;
    for (const section of ["assigned", "empty", "error", "recovery"]) elements[section].hidden = section !== name;
    for (const control of [elements.save, elements.speak]) control.disabled = name !== "assigned" || (control === elements.speak && !state.speakAvailable);
    if (changed && name !== "assigned") elements[`${name}Title`]?.focus();
    updateSpeechLabel();
  }
  function updateSpeechLabel() {
    elements.speak.textContent = state.profile?.preferences?.allowRemoteSpeech === true ? "استمع (قد يستخدم الإنترنت)" : "استمع للنطق المحلي";
    elements.speak.setAttribute("aria-label", elements.speak.textContent);
  }
  function renderTranslation(showEnglish) {
    elements.translation.hidden = !showEnglish;
    elements.meaningEn.hidden = !showEnglish || !state.word?.meaningEn;
    elements.contextEn.hidden = !showEnglish || !state.word?.contextEn;
  }
  function renderAssigned(result) {
    elements ??= collectElements();
    const word = result.word;
    state.word = word;
    state.dateKey = formatDateKey(result.dateKey) ? result.dateKey : null;
    elements.word.textContent = word.word;
    elements.meaningAr.textContent = word.meaningAr || "";
    elements.meaningEn.textContent = word.meaningEn || "";
    elements.contextEn.textContent = word.contextEn || "";
    elements.pronunciation.textContent = word.pronunciation || "";
    elements.example.textContent = word.contextAr || (word.exampleKind === "original" ? word.exampleAr : "") || word.usageNote || "";
    elements.vocalization.textContent = word.vocalization || "";
    elements.vocalization.hidden = !word.vocalization || word.vocalization === word.word;
    elements.vocalizationDetails.hidden = elements.vocalization.hidden;
    elements.register.textContent = { standard: "فصيح", classical: "أدبي", colloquial: "عامي" }[word.register] || "";
    elements.register.hidden = !elements.register.textContent;
    elements.save.setAttribute("aria-pressed", String(result.saved === true));
    elements.assignmentDate.textContent = formatDateKey(result.dateKey);
    elements.assignmentDate.hidden = !state.dateKey;
    renderTranslation(result.showEnglish !== false);
    show("assigned");
    actionStatus("");
    status(state.speakAvailable ? "كلمتك جاهزة." : "كلمتك جاهزة. النطق غير متاح على هذا الجهاز.");
  }
  function renderRecovery() {
    warning(false);
    show("recovery");
    status("");
    actionStatus("");
  }
  async function loadAssignment() {
    status("نحضّر كلمتك…");
    try {
      // The background owns assignment/recovery even when a direct read fails.
      let readWarning = false;
      try {
        const stored = await ExtApi.storage.local.get("kalimat.profile");
        state.profile = stored["kalimat.profile"] ?? null;
      } catch (_) { readWarning = true; }
      const result = await ExtApi.runtime.sendMessage({ type: "assignment.get" });
      if (result?.kind === "recovery") return renderRecovery();
      state.storageWarning = readWarning || result?.storageWarning === true;
      warning(state.storageWarning);
      if (result?.kind === "no-new-word") { show("empty"); status(""); return; }
      const assignment = await assignedWord(result);
      if (assignment.kind !== "assigned" || !formatDateKey(assignment.dateKey)) throw new Error("Invalid assignment.");
      if (state.storageWarning) {
        const wordState = state.profile?.wordStates?.[String(assignment.word.id)] || state.profile?.wordStates?.[`w${assignment.word.id}`];
        renderAssigned({ ...assignment, saved: wordState?.saved === true, showEnglish: state.profile?.showEnglish === true });
      } else renderAssigned(assignment);
    } catch (_) {
      show("error");
      status("تعذّر تحميل الكلمة. حاول مجددًا.");
    }
  }
  async function refreshProfile() {
    const revision = ++profileRefreshRevision;
    try {
      const result = await ExtApi.runtime.sendMessage({ type: "state.export" });
      if (revision !== profileRefreshRevision) return;
      if (result?.kind === "recovery") return renderRecovery();
      if (result?.kind !== "export") return;
      if (result.storageWarning === true) { warning(true); return; }
      state.profile = JSON.parse(result.text);
      warning(result.storageWarning === true || state.storageWarning);
      updateSpeechLabel();
      if (state.word) {
        renderTranslation(state.profile.showEnglish !== false);
        const wordState = state.profile.wordStates?.[String(state.word.id)] || state.profile.wordStates?.[`w${state.word.id}`];
        // A pending save owns its indicator until the durable response arrives.
        if (!elements.save.disabled) elements.save.setAttribute("aria-pressed", String(wordState?.saved === true || (wordState?.saved === undefined && state.profile.favorites?.[String(state.word.id)] === true)));
      }
    } catch (_) { warning(true); }
  }
  function openAtlas(view = "explore") {
    const route = view === "settings" ? "view=settings" : `view=explore&id=${encodeURIComponent(state.word?.id ?? "")}&q=${encodeURIComponent(state.word?.word ?? "")}`;
    return ExtApi.tabs.create({ url: ExtApi.runtime.getURL(`atlas/atlas.html?${route}`) });
  }
  async function initialize() {
    elements = collectElements();
    elements.assigned.hidden = true;
    elements.assignmentDate.hidden = true;
    if (globalThis.KalimatTheme?.initThemeController) themeController = globalThis.KalimatTheme.initThemeController({ storageArea: ExtApi?.storage?.local, targetDoc: document });
    elements.save.addEventListener("click", toggleSave);
    elements.speak.addEventListener("click", () => speak());
    byId("explore").addEventListener("click", () => openAtlas());
    byId("explore-empty").addEventListener("click", () => openAtlas());
    byId("recovery-atlas").addEventListener("click", () => openAtlas("settings"));
    byId("error-atlas").addEventListener("click", () => openAtlas("settings"));
    byId("error-retry").addEventListener("click", loadAssignment);
    ExtApi.storage?.onChanged?.addListener((changes, areaName) => {
      if ((!areaName || areaName === "local") && changes?.["kalimat.profile"]) refreshProfile();
    });
    state.speakAvailable = !!globalThis.speechSynthesis && typeof globalThis.SpeechSynthesisUtterance === "function";
    await loadAssignment();
  }
  function formatDateKey(dateKey) {
    if (typeof globalThis.KalimatDate?.isDateKey !== "function" || !globalThis.KalimatDate.isDateKey(dateKey)) return "";
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("ar-EG", ARABIC_DATE_OPTIONS);
  }

  function status(message, announce = true) {
    elements.status?.setAttribute("role", announce ? "status" : "none");
    elements.status?.setAttribute("aria-live", announce ? "polite" : "off");
    if (elements.status) elements.status.textContent = message;
  }

  function actionStatus(message, isError = false) {
    elements.status?.setAttribute("role", "none");
    elements.status?.setAttribute("aria-live", "off");
    if (elements.status) elements.status.textContent = "";
    const target = elements.actionStatus;
    if (!target) return;
    target.textContent = message;
    target.setAttribute("role", isError ? "alert" : "status");
    target.setAttribute("aria-live", isError ? "assertive" : "polite");
  }

  function warning(visible) {
    if (elements.warning) elements.warning.hidden = !visible;
  }

  async function assignedWord(result) {
    if (result.word) return result;
    const response = await fetch(ExtApi.runtime.getURL("data/vocabulary.json"));
    if (!response.ok) throw new Error("Vocabulary unavailable.");
    const vocab = await response.json();
    let word = null;
    if (globalThis.KalimatVocabulary?.findWord) {
      word = globalThis.KalimatVocabulary.findWord(vocab, result.wordId);
    } else {
      word = vocab.find((item) => item.id === result.wordId || String(item.id) === String(result.wordId) || `w${item.id}` === String(result.wordId));
    }
    if (!word) throw new Error("Assigned word unavailable.");
    return { ...result, word };
  }

  async function toggleSave() {
    if (!state.word || elements.save.disabled) return;
    let restoreFocus = true;
    const priorSaved = elements.save.getAttribute("aria-pressed");
    const saved = priorSaved !== "true";

    elements.save.setAttribute("aria-busy", "true");
    elements.save.disabled = true;
    actionStatus("جارٍ تحديث الحفظ…");

    try {
      const result = await ExtApi.runtime.sendMessage({
        type: "word.save",
        wordId: state.word.id,
        saved,
      });
      if (result?.kind === "recovery") { restoreFocus = false; return renderRecovery(); }
      if (result?.kind !== "ok") throw new Error("Save unchanged.");
      state.storageWarning = result.storageWarning === true;
      if (state.storageWarning) {
        warning(true);
        actionStatus("التغيير مؤقت ولم يُحفظ. حاول مجددًا.", true);
        return;
      }
      const authoritativeSaved = typeof result.saved === "boolean" ? result.saved : saved;
      warning(result.storageWarning === true);
      elements.save.setAttribute("aria-pressed", String(authoritativeSaved));
      actionStatus(authoritativeSaved ? "حُفظت الكلمة." : "أزيل الحفظ.");
    } catch (_) {
      elements.save.setAttribute("aria-pressed", priorSaved);
      actionStatus("تعذّر تغيير الحفظ.", true);
    } finally {
      elements.save.setAttribute("aria-busy", "false");
      elements.save.disabled = false;
      if (restoreFocus && state.view === "assigned" && (!document.activeElement || document.activeElement === document.body || document.activeElement === elements.save)) elements.save.focus();
    }
  }

  function speechResult(result) {
    if (result?.kind === "voices-loading") actionStatus("قائمة الأصوات لم تجهز بعد. حاول النطق مجددًا بعد قليل.");
    else if (result?.kind === "remote-opt-in") actionStatus("لا يتوفر صوت عربي محلي. يمكنك السماح بالنطق عبر الإنترنت من إعدادات الأطلس.");
    else if (["no-local-arabic-voice", "no-arabic-voice"].includes(result?.kind)) actionStatus("لا يتوفر صوت عربي محلي. أضف حزمة صوت عربية ثم حاول مجددًا.");
    else if (!result || result.kind === "unavailable") actionStatus("تعذّر تشغيل النطق على هذا الجهاز.");
  }

  function speak(customText = null) {
    const targetText = typeof customText === "string" ? customText : (state.word?.word ?? "");
    const result = globalThis.KalimatSpeech?.speak(targetText, {
      rate: state.profile?.preferences?.speechRate ?? 0.85,
      repeat: state.profile?.preferences?.speechRepeat ?? 1,
      allowRemote: state.profile?.preferences?.allowRemoteSpeech === true,
      onStart: () => actionStatus("جارٍ النطق…"),
      onEnd: () => actionStatus("اكتمل النطق."),
      onError: () => actionStatus("تعذّر تشغيل النطق. حاول مجددًا."),
      requireVoice: true,
    });
    speechResult(result);
  }

  globalThis.KalimatPopup = { renderAssigned, toggleSave, openAtlas, speak, refreshProfile, getThemeController: () => themeController, initialize };
  globalThis.addEventListener?.("pagehide", () => globalThis.KalimatSpeech?.cancel());
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
