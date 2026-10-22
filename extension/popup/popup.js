(() => {
  "use strict";
  const ExtApi = globalThis.browser ?? globalThis.chrome;
  const byId = (id) => document.getElementById(id);
  const state = { word: null, dateKey: null, profile: null, storageWarning: false, speakAvailable: false, view: "" };
  let elements;
  let themeController = null;
  let profileRefreshRevision = 0;
  let discovery = null;
  let discoveryBusy = false;
  let assignmentBusy = false;
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
    renderDailySources();
  }
  function renderDailySources() {
    const panel = byId("daily-source-setup");
    if (!panel) return;
    const fresh = discovery?.needsSetup === true || (discoveryBusy && state.view === "setup");
    const revoked = discovery?.enabled && discovery.permissionGranted === false;
    panel.hidden = ["error", "recovery"].includes(state.view) || !discovery
      || discovery.pilot === true || !(fresh || revoked || !discovery.enabled);
    if (panel.hidden) return;
    byId("daily-source-title").textContent = fresh ? "كلمة جديدة من المصادر" : "تفعيل المصادر";
    byId("daily-source-description").textContent = fresh
      ? "نختار كلمة اليوم تلقائيًا من مصادر عربية متاحة. المعاني والشواهد غير مراجعة. بعد إذنك، نتصل بويكيبيديا وويكاموس، بما في ذلك في الخلفية."
      : "فعّل المصادر لجلب كلمات جديدة تلقائيًا. يتطلب ذلك اتصالًا وإذن الوصول إلى ويكيبيديا وويكاموس. تبقى كلماتك السابقة والمحفوظة متاحة.";
    byId("daily-source-enable").textContent = revoked ? "السماح بالمصادر مجددًا" : "تفعيل المصادر";
    byId("daily-source-enable").disabled = discoveryBusy;
    byId("daily-source-offline").disabled = discoveryBusy;
    byId("daily-source-offline").textContent = "الإبقاء على المصادر معطّلة";
    panel.setAttribute("aria-busy", String(discoveryBusy));
  }
  async function configureDailySources(enabled) {
    if (discoveryBusy) return;
    discoveryBusy = true;
    renderDailySources();
    const feedback = byId("daily-source-status");
    feedback.textContent = "";
    try {
      if (enabled) {
        const granted = await ExtApi.permissions.request({ origins: ["https://ar.wikipedia.org/*", "https://ar.wiktionary.org/*"] });
        if (!granted) { feedback.textContent = "لم يُفعّل الاختيار من المصادر. يمكنك السماح بالوصول أو المتابعة دون اتصال."; return; }
      }
      const topics = discovery?.topics?.length ? discovery.topics : ["science", "culture", "society"];
      const result = await ExtApi.runtime.sendMessage({ type: "discovery.configure", enabled, topics });
      if (result?.kind === "recovery") return renderRecovery();
      if (result?.kind !== "ok" || result.storageWarning) throw new Error("Settings unavailable.");
      await loadAssignment();
    } catch (_) { feedback.textContent = "تعذّر حفظ اختيارك. حاول مجددًا."; }
    finally { discoveryBusy = false; renderDailySources(); }
  }
  function updateSpeechLabel() {
    const remote = state.profile?.preferences?.allowRemoteSpeech === true;
    elements.speak.textContent = remote ? "استمع عبر الإنترنت" : "استمع";
    elements.speak.setAttribute("aria-label", remote ? "استمع (قد يستخدم الإنترنت)" : "استمع للنطق المحلي");
    elements.speak.title = elements.speak.getAttribute("aria-label");
  }
  function renderTranslation(showEnglish) {
    elements.translation.hidden = !showEnglish || !(state.word?.meaningEn || state.word?.pronunciation || state.word?.contextEn);
    elements.meaningEn.hidden = !showEnglish || !state.word?.meaningEn;
    elements.contextEn.hidden = !showEnglish || !state.word?.contextEn;
  }
  function renderAssigned(result) {
    elements ??= collectElements();
    const word = result.word;
    state.word = word;
    state.dateKey = formatDateKey(result.dateKey) ? result.dateKey : null;
    elements.word.textContent = word.word;
    const senseContext = byId("sense-context");
    if (senseContext) { senseContext.textContent = word.senseContext ? `في هذا الاستعمال: ${word.senseContext}` : ""; senseContext.hidden = !word.senseContext; }
    elements.meaningAr.textContent = word.meaningAr || "";
    elements.meaningEn.textContent = word.meaningEn || "";
    elements.contextEn.textContent = word.contextEn || "";
    elements.pronunciation.textContent = word.pronunciation || "";
    elements.example.textContent = word.contextAr || (["original", "quotation"].includes(word.exampleKind) ? word.exampleAr : "") || word.usageNote || "";
    renderSources(word);
    elements.vocalization.textContent = word.vocalization || "";
    elements.vocalization.hidden = !word.vocalization || word.vocalization === word.word;
    elements.vocalizationDetails.hidden = elements.vocalization.hidden && !word.register && (word.contentVersion === 4 || !state.dateKey);
    elements.register.textContent = { standard: "فصيح", classical: "أدبي", colloquial: "عامي" }[word.register] || "";
    elements.register.hidden = !elements.register.textContent;
    elements.save.setAttribute("aria-pressed", String(result.saved === true));
    elements.save.textContent = result.saved === true ? "محفوظة" : "حفظ";
    elements.assignmentDate.textContent = formatDateKey(result.dateKey);
    elements.assignmentDate.hidden = !state.dateKey;
    renderTranslation(result.showEnglish !== false);
    show("assigned");
    actionStatus("");
    status(state.speakAvailable ? "" : "النطق غير متاح على هذا الجهاز.");
  }
  function renderSources(word) {
    const target = byId("source-attribution");
    if (!target) return;
    target.replaceChildren();
    target.hidden = ![3, 4].includes(word.contentVersion) && word.editorialChecked !== false;
    if (word.editorialChecked === false) {
      const note = document.createElement("p");
      note.textContent = "من المجموعة السابقة؛ لم تكتمل مراجعة المعنى والشاهد.";
      target.append(note);
      return;
    }
    if (target.hidden) return;
    if (word.contentVersion === 3) {
      const note = document.createElement("p");
      note.textContent = "مقتطفات من مصادر متاحة، لم يراجعها فريق كلمات.";
      target.append(note);
    }
    for (const [source, label] of [[word.source, "التعريف"], [word.exampleSource, "الشاهد"]]) {
      try {
        const url = new URL(source?.url);
        if (url.protocol !== "https:" || url.username || url.password || !["ar.wiktionary.org", "www.wikidata.org", "ar.wikipedia.org", "lindat.mff.cuni.cz", "www.arabicacademy.gov.eg", "www.islamweb.net", "sina.birzeit.edu"].includes(url.hostname)) continue;
        const link = document.createElement("a");
        link.href = url.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = `${label}: ${source.title}${source.license ? ` · ${source.license}` : ""}${source.reference ? ` · ${source.reference}` : ""}`;
        target.append(link);
      } catch (_) { /* Invalid source URLs never become navigation targets. */ }
    }
  }
  function renderRecovery() {
    warning(false);
    show("recovery");
    status("");
    actionStatus("");
  }
  async function loadAssignment(retry = false) {
    if (assignmentBusy) return;
    assignmentBusy = true;
    const retryButtons = [byId("empty-retry"), byId("error-retry")].filter(Boolean);
    for (const button of retryButtons) button.disabled = true;
    status("نحضّر كلمتك…");
    try {
      // The background owns assignment/recovery even when a direct read fails.
      let readWarning = false;
      try {
        const stored = await ExtApi.storage.local.get("kalimat.profile");
        state.profile = stored["kalimat.profile"] ?? null;
      } catch (_) { readWarning = true; }
      const settings = await ExtApi.runtime.sendMessage({ type: "discovery.get" });
      if (settings?.kind === "recovery") return renderRecovery();
      if (settings?.kind === "discovery") discovery = settings;
      if (discovery?.needsSetup) {
        warning(readWarning || settings.storageWarning === true);
        show("setup");
        status("");
        byId("daily-source-title")?.focus();
        return;
      }
      const result = await ExtApi.runtime.sendMessage({ type: "assignment.get", ...(retry === true ? { retry: true } : {}) });
      if (result?.kind === "recovery") return renderRecovery();
      state.storageWarning = readWarning || result?.storageWarning === true;
      warning(state.storageWarning);
      if (result?.kind === "no-new-word") {
        state.word = null;
        state.dateKey = null;
        show("empty");
        status(result.discoveryStatus === "disabled" ? "المصادر معطّلة. فعّلها لجلب كلمة جديدة."
          : result.discoveryStatus === "permission-required" ? "اسمح بالوصول إلى المصادر لجلب كلمة جديدة."
            : "لم نجد كلمة مناسبة الآن. تحقّق من الاتصال ثم أعد المحاولة.");
        return;
      }
      const assignment = await assignedWord(result);
      if (assignment.kind !== "assigned" || !formatDateKey(assignment.dateKey)) throw new Error("Invalid assignment.");
      if (state.storageWarning) {
        const wordState = state.profile?.wordStates?.[String(assignment.word.id)] || state.profile?.wordStates?.[`w${assignment.word.id}`];
        renderAssigned({ ...assignment, saved: wordState?.saved === true, showEnglish: state.profile?.showEnglish === true });
      } else renderAssigned(assignment);
    } catch (_) {
      show("error");
      status("تعذّر تحميل الكلمة. حاول مجددًا.");
    } finally {
      assignmentBusy = false;
      for (const button of retryButtons) button.disabled = false;
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
      const sourceSettings = await ExtApi.runtime.sendMessage({ type: "discovery.get" });
      if (revision !== profileRefreshRevision) return;
      if (sourceSettings?.kind === "discovery") discovery = sourceSettings;
      renderDailySources();
      if (state.view === "setup" && discovery?.configured && !discoveryBusy) return loadAssignment();
      if (state.view === "assigned" && discovery?.needsSetup && !discoveryBusy) {
        state.word = null;
        state.dateKey = null;
        return loadAssignment();
      }
      warning(result.storageWarning === true || state.storageWarning);
      updateSpeechLabel();
      if (state.word) {
        renderTranslation(state.profile.showEnglish !== false);
        const wordState = state.profile.wordStates?.[String(state.word.id)] || state.profile.wordStates?.[`w${state.word.id}`];
        // A pending save owns its indicator until the durable response arrives.
        if (!elements.save.disabled) {
          const saved = wordState?.saved === true || (wordState?.saved === undefined && state.profile.favorites?.[String(state.word.id)] === true);
          elements.save.setAttribute("aria-pressed", String(saved));
          elements.save.textContent = saved ? "محفوظة" : "حفظ";
        }
      }
    } catch (_) { warning(true); }
  }
  function openAtlas(view = "explore") {
    const route = view === "discovery" ? "view=discovery" : view === "settings" ? "view=settings" : `view=explore&id=${encodeURIComponent(state.word?.id ?? "")}&q=${encodeURIComponent(state.word?.word ?? "")}`;
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
    byId("daily-source-enable")?.addEventListener("click", () => configureDailySources(true));
    byId("daily-source-offline")?.addEventListener("click", () => configureDailySources(false));
    byId("open-settings")?.addEventListener("click", () => openAtlas("settings"));
    byId("empty-retry")?.addEventListener("click", () => loadAssignment(true));
    byId("explore-empty").addEventListener("click", () => openAtlas());
    byId("recovery-atlas").addEventListener("click", () => openAtlas("settings"));
    byId("error-atlas").addEventListener("click", () => openAtlas("settings"));
    byId("error-retry").addEventListener("click", () => loadAssignment(true));
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
    for (const [id, card] of Object.entries(state.profile?.wordSnapshots || {})) {
      try {
        const checked = globalThis.KalimatVocabulary.validateDiscoveryCard(card);
        if (checked.id === id) vocab.push(checked);
      } catch (_) { /* Ignore malformed snapshots. */ }
    }
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
      elements.save.textContent = authoritativeSaved ? "محفوظة" : "حفظ";
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
