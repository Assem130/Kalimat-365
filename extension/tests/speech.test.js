const test = require("node:test");
const assert = require("node:assert/strict");
const Speech = require("../shared/speech.js");

test("speech playback selects Arabic, repeats, and cancels stale playback", () => {
  const spoken = [];
  let cancelled = 0;
  class Utterance {
    constructor(text) { this.text = text; }
  }
  const speech = {
    getVoices: () => [{ name: "Arabic Natural", lang: "ar-SA" }],
    cancel: () => { cancelled++; },
    speak: (utterance) => spoken.push(utterance),
  };

  const result = Speech.speak("ـكلمة‎", { speech, Utterance, repeat: 2 });
  assert.equal(result.kind, "ok");
  assert.equal(spoken[0].text, "كلمة");
  spoken[0].onend();
  assert.equal(spoken.length, 2);
  Speech.cancel(speech);
  assert.equal(cancelled, 2);
  spoken[1].onend();
  assert.equal(spoken.length, 2);
});

test("speech playback refuses a required Arabic voice", () => {
  class Utterance { constructor(text) { this.text = text; } }
  const result = Speech.speak("كلمة", { speech: { getVoices: () => [], speak() {} }, Utterance, requireVoice: true });
  assert.equal(result.kind, "no-arabic-voice");
});

test("speech playback handles a throwing voice list without throwing", () => {
  class Utterance { constructor(text) { this.text = text; } }
  const result = Speech.speak("كلمة", {
    speech: {
      getVoices() { throw new Error("voices unavailable"); },
      speak() { throw new Error("speech must not start"); }
    },
    Utterance,
    requireVoice: true
  });
  assert.equal(result.kind, "unavailable");
});


test("explicit speech consent prefers local Arabic and rejects unknown or remote defaults", () => {
  const local = { lang: "ar-SA", name: "Arabic", localService: true };
  const remote = { lang: "ar-SA", name: "Arabic Natural Online", localService: false };
  const unknown = { lang: "ar", name: "Unknown" };
  const spoken = [];
  class Utterance { constructor(text) { this.text = text; } }
  const play = (voices, allowRemote, extra = {}) => Speech.speak("كلمة", {
    speech: { getVoices: () => voices, speak: (item) => spoken.push(item) }, Utterance,
    requireVoice: true, allowRemote, ...extra,
  });
  assert.equal(play([remote, local], false).voice, local);
  assert.equal(play([remote, local], true).voice, local);
  const count = spoken.length;
  assert.equal(play([remote], false).kind, "remote-opt-in");
  assert.equal(play([unknown], false).kind, "remote-opt-in");
  assert.equal(play([], false).kind, "voices-loading");
  assert.equal(play([{ lang: "en", localService: true }], false).kind, "no-local-arabic-voice");
  assert.equal(play([remote], false, { selectVoice: () => remote }).kind, "remote-opt-in");
  assert.equal(spoken.length, count);
  assert.equal(play([remote], true).voice, remote);
  assert.equal(play([unknown], true).voice, unknown);
  assert.equal(play([local], false).kind, "ok", "retry succeeds when voices arrive");
});

test("omitted consent preserves legacy website required and default voice playback", () => {
  class Utterance { constructor(text) { this.text = text; } }
  const remote = { lang: "ar-SA", name: "Arabic Natural Online", localService: false };
  assert.equal(Speech.selectArabicVoice([{ lang: "ar", localService: true }, remote]), remote);
  const speech = { getVoices: () => [remote], speak() {} };
  assert.equal(Speech.speak("كلمة", { speech, Utterance, requireVoice: true }).voice, remote);
  speech.getVoices = () => [];
  assert.equal(Speech.speak("كلمة", { speech, Utterance }).voice, null);
  assert.equal(Speech.speak("كلمة", { speech, Utterance, requireVoice: true }).kind, "no-arabic-voice");
});

test("asynchronous speech errors clear playback and notify once", () => {
  let utterance;
  let errors = 0;
  class Utterance { constructor(text) { this.text = text; } }
  const target = {};
  Speech.speak("كلمة", { target, Utterance, allowRemote: false, requireVoice: true,
    speech: { getVoices: () => [{ lang: "ar", localService: true }], speak: (item) => { utterance = item; } },
    onError: () => { errors++; }, repeat: 3,
  });
  utterance.onerror();
  utterance.onerror();
  utterance.onend();
  assert.equal(errors, 1);
  assert.equal(target._activeUtterance, null);
});
