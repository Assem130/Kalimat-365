(function () {
  "use strict";
  const api = globalThis.browser ?? globalThis.chrome;
  KalimatTheme.initThemeController({ storageArea: api.storage.local, targetDoc: document });
  const byId = id => document.getElementById(id);
  let current = null;
  let busy = false;
  let expanded = false;
  let reveal = false;
  let refreshPending = false;
  function status(text, retry = false) { byId("status").textContent = text; byId("retry").hidden = !retry; }
  function render() {
    const { word, dateKey, dismissed, recall } = current;
    byId("word").textContent = word.word;
    byId("meaning").textContent = word.meaningAr;
    byId("example").textContent = word.exampleAr;
    byId("date").dateTime = dateKey;
    byId("date").textContent = new Intl.DateTimeFormat("ar", { weekday: "long", day: "numeric", month: "long" }).format(new Date(dateKey + "T12:00:00"));
    const compact = dismissed && !expanded;
    byId("encounter").classList.toggle("compact", compact);
    byId("full").hidden = compact;
    byId("reopen").hidden = !compact;
    byId("save").textContent = current.saved ? "أزل من المحفوظات" : "حفظ الكلمة";
    byId("save").setAttribute("aria-pressed", String(!!current.saved));
    byId("source").href = word.source.url;
    byId("source").textContent = word.source.title;
    byId("encounter").hidden = false;
    byId("recall").hidden = !recall || compact;
    if (recall) {
      byId("recall-word").textContent = recall.word;
      byId("recall-meaning").textContent = recall.meaningAr;
      byId("recall-example").textContent = recall.exampleAr;
      byId("recall-answer").hidden = !reveal;
      byId("reveal").hidden = reveal;
      byId("reveal").setAttribute("aria-expanded", String(reveal));
    }
  }
  async function load() {
    if (busy) { refreshPending = true; return; }
    busy = true;
    document.querySelector("main").setAttribute("aria-busy", "true");
    try {
      const result = await api.runtime.sendMessage({ type: "assignment.get" });
      if (result?.kind === "recovery") throw new Error("تحتاج بياناتك إلى استعادة. افتح إعدادات الأطلس لتصديرها أو استيراد نسخة صالحة.");
      if (result?.kind !== "assigned" || !result.word?.source) throw new Error("تعذّر تحميل الكلمة. حاول مجددًا أو افتح الأطلس.");
      if (current?.dateKey !== result.dateKey) { expanded = false; reveal = false; }
      current = result;
      render();
      status(result.storageWarning ? "تعذّر حفظ بياناتك على الجهاز. أعد المحاولة قبل إغلاق الصفحة." : "", result.storageWarning);
    } catch (error) { status(error.message || "تعذّر تحميل الكلمة. حاول مجددًا.", true); }
    finally {
      busy = false;
      document.querySelector("main").setAttribute("aria-busy", "false");
      if (refreshPending) { refreshPending = false; load(); }
    }
  }
  async function mutate(message, apply, focusId) {
    if (busy || !current) return;
    busy = true;
    const controls = [...document.querySelectorAll("button")];
    controls.forEach(button => { button.disabled = true; });
    let focusAfter = false;
    try {
      const result = await api.runtime.sendMessage(message);
      if (result?.kind === "stale") { refreshPending = true; return; }
      if (result?.kind !== "ok" || result.storageWarning) throw new Error("تعذّر حفظ التغيير. حاول مجددًا قبل إغلاق الصفحة.");
      apply(result); render(); status("");
      focusAfter = true;
    } catch (error) { status(error.message, true); }
    finally {
      busy = false;
      controls.forEach(button => { button.disabled = false; });
      if (focusAfter && focusId) byId(focusId).focus();
      if (refreshPending) { refreshPending = false; load(); }
    }
  }
  byId("dismiss").addEventListener("click", () => mutate({ type: "pilot.dismiss", dateKey: current.dateKey }, () => { current.dismissed = true; expanded = false; }, "reopen"));
  byId("reopen").addEventListener("click", () => { expanded = true; render(); byId("dismiss").focus(); });
  byId("save").addEventListener("click", () => mutate({ type: "word.save", wordId: current.wordId, saved: !current.saved }, result => { current.saved = result.saved; }));
  const finishRecall = () => mutate({ type: "pilot.recall.skip", dateKey: current.dateKey }, () => { current.recall = null; }, "dismiss");
  byId("skip").addEventListener("click", finishRecall);
  byId("recall-done").addEventListener("click", finishRecall);
  byId("reveal").addEventListener("click", () => { reveal = true; render(); byId("recall-done").focus(); });
  byId("retry").addEventListener("click", load);
  api.storage.onChanged?.addListener((changes, area) => { if (area === "local" && changes["kalimat.profile"]) load(); });
  window.addEventListener("focus", load);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
  setInterval(() => { if (!document.hidden && current?.dateKey !== KalimatDate.todayDateKey()) load(); }, 15000);
  load();
})();
