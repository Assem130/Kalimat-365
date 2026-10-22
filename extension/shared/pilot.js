(function (root, factory) {
  const date = typeof module === "object" && module.exports ? require("./date.js") : root.KalimatDate;
  const api = factory(date);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.KalimatPilot = api;
})(globalThis, function (date) {
  "use strict";
  const anchor = "2026-10-22";
  const cards = [
  {
    "id": "pilot_minwal",
    "contentVersion": 4,
    "word": "مِنْوَال",
    "normalized": "نول",
    "meaningAr": "المنوال خشبة يُنسَج عليها الثوب. في «على هذا المنوال»، نستعمل صورة من النسيج لوصف طريقة تتكرر.",
    "exampleAr": "خصّصتُ عشر دقائق للقراءة قبل النوم، واستمررتُ على هذا المنوال طوال الأسبوع.",
    "exampleKind": "original",
    "reviewed": true,
    "editorialChecked": true,
    "source": {
      "title": "مجمع اللغة العربية بالقاهرة",
      "url": "https://www.arabicacademy.gov.eg/ar/search_engine/roots/نول"
    }
  },
  {
    "id": "pilot_kazm",
    "contentVersion": 4,
    "word": "كَظْم",
    "normalized": "كظم",
    "meaningAr": "«كظم السِّقاء» تعني ملأ وعاء الماء وسدّ فمه. وكظم الغيظ هو حبس الغضب في النفس، وقد يظلّ صاحبه غاضبًا.",
    "exampleAr": "كظمتُ غيظي حين قاطعني، وانتظرتُ حتى ينتهي لأكمل فكرتي.",
    "exampleKind": "original",
    "reviewed": true,
    "editorialChecked": true,
    "source": {
      "title": "مجمع اللغة العربية بالقاهرة",
      "url": "https://www.arabicacademy.gov.eg/ar/search_engine/roots/كظم"
    }
  },
  {
    "id": "pilot_shujun",
    "contentVersion": 4,
    "word": "شُجُون",
    "normalized": "شجن",
    "meaningAr": "في «الحديث ذو شجون»، الشجون شُعَب الحديث التي يقود بعضها إلى بعض. المقصود هنا تشعّب الكلام.",
    "exampleAr": "بدأنا بالحديث عن القهوة، وانتهينا بذكريات الجامعة. الحديث ذو شجون.",
    "exampleKind": "original",
    "reviewed": true,
    "editorialChecked": true,
    "source": {
      "title": "مجمع اللغة العربية بالقاهرة",
      "url": "https://www.arabicacademy.gov.eg/ar/search_engine/roots/شجن"
    }
  },
  {
    "id": "pilot_mihakk",
    "contentVersion": 4,
    "word": "مِحَكّ",
    "normalized": "حكك",
    "meaningAr": "المِحكّ حجر تُحكّ به المعادن لاختبارها. و«وضع الشيء على المحكّ» تعني تجربته للكشف عن حقيقته.",
    "exampleAr": "بدت خطّتنا ممتازة، لكن أول أسبوع مزدحم وضعها على المحكّ.",
    "exampleKind": "original",
    "reviewed": true,
    "editorialChecked": true,
    "source": {
      "title": "مجمع اللغة العربية بالقاهرة",
      "url": "https://www.arabicacademy.gov.eg/ar/search_engine/roots/حكك"
    }
  },
  {
    "id": "pilot_anah",
    "contentVersion": 4,
    "word": "أَنَاة",
    "normalized": "أني",
    "meaningAr": "التمهّل والرفق في التصرّف. كلمة تمنح الهدوء قبل الفعل اسمًا يمكنك استخدامه.",
    "exampleAr": "قرأ الرسالة بأناة، ثم أعاد كتابة ردّه.",
    "exampleKind": "original",
    "reviewed": true,
    "editorialChecked": true,
    "source": {
      "title": "مجمع اللغة العربية بالقاهرة",
      "url": "https://www.arabicacademy.gov.eg/ar/search_engine/roots/أني"
    }
  },
  {
    "id": "pilot_fatil",
    "contentVersion": 4,
    "word": "فَتِيل",
    "normalized": "فتل",
    "meaningAr": "من معاني الفتيل الخيط الرقيق في شقّ نواة التمر. وفي عبارة «لا يغني فتيلًا»، يُضرب به المثل في الشيء الضئيل.",
    "exampleAr": "تغيير لون الجدول لا يغني فتيلًا إذا بقيت المواعيد خاطئة.",
    "exampleKind": "original",
    "reviewed": true,
    "editorialChecked": true,
    "source": {
      "title": "مجمع اللغة العربية بالقاهرة",
      "url": "https://www.arabicacademy.gov.eg/ar/search_engine/roots/فتل"
    }
  },
  {
    "id": "pilot_naqd",
    "contentVersion": 4,
    "word": "نَقْد",
    "normalized": "نقد",
    "meaningAr": "«نقد الدراهم» فحصها ليميّز جيّدها من رديئها. وتقييم الكلام أيضًا يشمل إظهار محاسنه وعيوبه.",
    "exampleAr": "طلبتُ منها نقدَ العرض، فأشارت إلى وضوح الفكرة وإلى مثال يحتاج إلى تبسيط.",
    "exampleKind": "original",
    "reviewed": true,
    "editorialChecked": true,
    "source": {
      "title": "مجمع اللغة العربية بالقاهرة",
      "url": "https://www.arabicacademy.gov.eg/ar/search_engine/roots/نقد"
    }
  },
  {
    "id": "pilot_hadhw",
    "contentVersion": 4,
    "word": "حَذْو",
    "normalized": "حذو",
    "meaningAr": "«حذا النعلَ» تعني قطعها على مقاس ومثال، ويقال «حذا النعل بالنعل». وحين نحذو حذو شخص، نفعل مثلما يفعل.",
    "exampleAr": "بدأت أختي تترك هاتفها خارج غرفة النوم، فحذوتُ حذوها.",
    "exampleKind": "original",
    "reviewed": true,
    "editorialChecked": true,
    "source": {
      "title": "مجمع اللغة العربية بالقاهرة",
      "url": "https://www.arabicacademy.gov.eg/ar/search_engine/roots/حذو"
    }
  },
  {
    "id": "pilot_shaghaf",
    "contentVersion": 4,
    "word": "شَغَف",
    "normalized": "شغف",
    "meaningAr": "«شغفه الحبّ» بلغ شَغاف قلبه، أي غلافه. في كلمة الشغف صورة حبّ يبلغ القلب.",
    "exampleAr": "قادها شغفها بالخطّ إلى تأمّل حروف اللافتات، حتى وهي تنتظر الحافلة.",
    "exampleKind": "original",
    "reviewed": true,
    "editorialChecked": true,
    "source": {
      "title": "مختار الصحاح",
      "url": "https://www.islamweb.net/ar/library/content/125/1619/ش-غ-ف"
    }
  },
  {
    "id": "pilot_sijal",
    "contentVersion": 4,
    "word": "سِجَال",
    "normalized": "سجل",
    "meaningAr": "السَّجْل دلو فيها ماء، وجمعها سِجال. ويربط المعجم بهذا الجمع قولنا إن المنافسة سِجال، أي يتداول أطرافها الفوز.",
    "exampleAr": "كانت مبارياتنا سِجالًا؛ أفوز مرّة، ويفوز أخي مرّة.",
    "exampleKind": "original",
    "reviewed": true,
    "editorialChecked": true,
    "source": {
      "title": "مجمع اللغة العربية بالقاهرة",
      "url": "https://www.arabicacademy.gov.eg/ar/search_engine/roots/سجل"
    }
  },
  {
    "id": "pilot_haraj",
    "contentVersion": 4,
    "word": "حَرَج",
    "normalized": "حرج",
    "meaningAr": "من معاني الحَرَج شجرٌ شديد الالتفاف يصعب النفاذ فيه. وتأتي الكلمة أيضًا للضيق والحيرة.",
    "exampleAr": "وضعني السؤال عن راتبي أمام الجميع في حرج، فغيّرتُ الموضوع.",
    "exampleKind": "original",
    "reviewed": true,
    "editorialChecked": true,
    "source": {
      "title": "مجمع اللغة العربية بالقاهرة",
      "url": "https://www.arabicacademy.gov.eg/ar/search_engine/roots/حرج"
    }
  },
  {
    "id": "pilot_ibram",
    "contentVersion": 4,
    "word": "إِبْرَام",
    "normalized": "برم",
    "meaningAr": "«أبرم الحبل» تعني فتله وإحكامه. و«أبرم الأمر» تعني أحكمه أيضًا.",
    "exampleAr": "أبرمنا الاتفاق بعد أن حدّدنا مسؤولية كلّ واحد منّا.",
    "exampleKind": "original",
    "reviewed": true,
    "editorialChecked": true,
    "source": {
      "title": "مجمع اللغة العربية بالقاهرة",
      "url": "https://www.arabicacademy.gov.eg/ar/search_engine/roots/برم"
    }
  },
  {
    "id": "pilot_istihlal",
    "contentVersion": 4,
    "word": "اسْتِهْلَال",
    "normalized": "هلل",
    "meaningAr": "نعرف استهلال الكلام بمعنى بدايته. ويقال أيضًا «استهلّ المولود» حين يرفع صوته بالبكاء عند الولادة.",
    "exampleAr": "استهلّت حديثها بذكرى مضحكة، فتحوّل صمت القاعة إلى ضحك.",
    "exampleKind": "original",
    "reviewed": true,
    "editorialChecked": true,
    "source": {
      "title": "قبس، جامعة بيرزيت",
      "url": "https://sina.birzeit.edu/qabas/lemma/2020753600"
    }
  },
  {
    "id": "pilot_sabr",
    "contentVersion": 4,
    "word": "سَبْر",
    "normalized": "سبر",
    "meaningAr": "السَّبر اختبارٌ لمعرفة ما وراء الظاهر. ومن استعمالاته المادية قياس عمق الجرح بالمسبار، وهو أداة لقياس العمق.",
    "exampleAr": "حاولتُ سبرَ أغوار المشكلة بأسئلة قليلة قبل اقتراح حلّ.",
    "exampleKind": "original",
    "reviewed": true,
    "editorialChecked": true,
    "source": {
      "title": "مجمع اللغة العربية بالقاهرة",
      "url": "https://www.arabicacademy.gov.eg/ar/search_engine/roots/سبر"
    }
  }
].map(card => Object.freeze({ ...card, source: Object.freeze(card.source) }));
  Object.freeze(cards);
  function dayIndex(dateKey) {
    if (!date.isDateKey(dateKey)) throw new TypeError("Invalid pilot date.");
    return Math.floor((Date.parse(dateKey + "T00:00:00Z") - Date.parse(anchor + "T00:00:00Z")) / 86400000);
  }
  function forDate(dateKey) {
    const day = dayIndex(dateKey);
    return cards[((day % cards.length) + cards.length) % cards.length];
  }
  function recall(profile, dateKey) {
    if (dayIndex(dateKey) % 3 !== 2 || profile.pilot?.recallDate === dateKey) return null;
    const previous = Object.entries(profile.pilot?.encounters || {}).filter(([day]) => day < dateKey)
      .sort(([a], [b]) => b.localeCompare(a)).find(([, id]) => id !== forDate(dateKey).id);
    return previous ? cards.find(card => card.id === previous[1]) ?? null : null;
  }
  return { anchor, cards, forDate, recall };
});
