const test = require("node:test");
const assert = require("node:assert/strict");
const d = require("../shared/discovery.js");

// Verbatim compact source snapshots from the read-only free-source trial.
const fixture = {
  phrase: {title:"على غرار",pageid:10,revision:1119191,text:"== {{اللغة|عربية}} ==\n=== المعاني ===\n'''عَلَى غِرَار''' جملة\n# [[مِثْل]]َه، عَلَى نَهْجِه، بنفس طريقته.\n"},
  germany: {title:"ألمانيا",pageid:11,revision:1077502,text:"== {{اللغة|عربية}} ==\n=== المعاني ===\n# دولة أوروبية في وسط أوروبا.\n"},
  particle: {title:"جُسيْم",pageid:12,revision:1119009,text:"=== أصل الكلمة ===\n\nأداة تصغير [[جِسْم]].\n\n"},
  redirect: {title:"جسيم",pageid:13,revision:1131912,text:"{{أيضا|جُسيْم}}\n\n[[تصنيف:عربية]]"},
  drain: {title:"استنزاف",pageid:14,revision:1140943,text:"== {{اللغة|عربية}} ==\n=== المعاني ===\n'''استنزاف''' مصدر الفعل '''استنزف'''.\n# [[إفراغ]] أو [[استهلاك]] الشيء حتى نفاده. {{متعد}}\n#: ''استنزاف الموارد الطبيعية يهدد مستقبل البشرية''.\n# [[استنفاد]] القوة أو الطاقة بشكل تدريجي. {{متعد}}\n#: ''استنزاف طاقة العمال يجعل الإنتاج أقل كفاءة''.\n\n"},
};
const sentence = "اعتمد الباحثون على غرار التجارب السابقة طريقة واضحة في إعداد الدراسة وجمع المعلومات وتحليلها.";
const passage = {title:"البحث",pageid:100,revisionId:900,text:sentence};
const index = [["على غرار",["على غرار"],[d.parseEntry(fixture.phrase)]]];
function response(data, headers = {}) {return {ok:true,headers:{get:key => headers[key] ?? (key === "content-type" ? "application/json; charset=utf-8" : null)},text:async () => JSON.stringify(data)};}
function apiPage(entry) {return {title:entry.title,pageid:entry.pageid,revisions:[{revid:entry.revision,slots:{main:{content:entry.text}}}]};}
function mockFetch(calls, entry = fixture.phrase) {return async (url,options) => {calls.push({url,options});return url.startsWith(d.ORIGINS[0]) ? response({query:{pages:[{...passage,lastrevid:900,extract:sentence + " وتساعد هذه الخطوات على تطوير النتائج العلمية."}]}}) : response({query:{pages:[apiPage(entry)]}});};}

test("normalization preserves hamza and ya distinctions", () => {
  assert.equal(d.normalizeKey("  إِبْدَاعـ  "),"إبداع");
  assert.notEqual(d.normalizeKey("إلى"),d.normalizeKey("الي"));
  assert.equal(d.lexicalKey("الإبداع"),"إبداع");
});
test("original phrase definition survives a safe wiki-link render", () => {
  const parsed=d.parseEntry(fixture.phrase);
  assert.deepEqual(parsed.definitions,["مِثْلَه، عَلَى نَهْجِه، بنفس طريقته."]);
  assert.equal(parsed.partOfSpeech,"phrase");
});
test("snapshot proper names, missing particle meaning, redirects and inflections are rejected", () => {
  for (const name of ["germany","particle","redirect"]) assert.equal(d.parseEntry(fixture[name]),null);
  assert.equal(d.parseEntry({title:"عاملين",text:"== {{اللغة|عربية}} ==\n=== المعاني ===\n# مثنى عامل في حالة النصب والجر.\n"}),null);
});
test("sense ranking needs strong context and cannot default to the first sense", () => {
  const entry=d.parseEntry(fixture.drain);
  assert.equal(entry.definitions.length,2);
  const ambiguous={key:"استنزاف",passages:[{...passage,text:"ظهر استنزاف شديد في هذا السياق ولم يوضح الكاتب المقصود بهذه الكلمة."}]};
  assert.equal(d.rankEntry(entry,ambiguous),null);
  const specific={key:"استنزاف",passages:[{...passage,text:"يؤدي استنزاف طاقة العمال إلى ضعف العامل وقلة الإنتاج في نهاية اليوم."}]};
  assert.equal(d.rankEntry(entry,specific).meaning,"استنفاد القوة أو الطاقة بشكل تدريجي.");
});
test("known words are excluded before ranking and phrase prepositions stay intact", () => {
  assert.equal(d.extractCandidates([passage],index).at(0).key,"على غرار");
  assert.equal(d.extractCandidates([passage],index,["عَلَى غِرَار"]).length,0);
  const nounIndex=[["استنزاف",["استنزاف"]]];
  assert.equal(d.extractCandidates([{text:"والاستنزاف للموارد"}],nounIndex,["الاستنزاف"]).length,0);
  assert.equal(d.extractCandidates([{text:"والاستنزاف للموارد"}],nounIndex).at(0).key,"استنزاف");
  assert.equal(d.extractCandidates([{text:"والشائعات مستمرة"}],nounIndex).length,0);
});
test("unsupported markup, circular glosses and non-Arabic sections cannot become definitions", () => {
  for (const line of ["{{قالب مجهول|نص عربي طويل بما يكفي}}", "معنى <ref>كتاب</ref> غير مدعوم هنا", "استنزاف استنزاف استنزاف"]) {
    assert.equal(d.parseEntry({title:"استنزاف",text:`== {{اللغة|عربية}} ==\n=== المعاني ===\n# ${line}\n`}),null);
  }
  assert.equal(d.parseEntry({title:"شيء",text:"== {{اللغة|فارسية}} ==\n=== المعاني ===\n# هذا شرح طويل لكنه باللغة غير المطلوبة.\n"}),null);
});
test("disambiguations and weak passages are ignored", () => {
  assert.deepEqual(d.extractPassages([{pageid:1,title:"اسم",pageprops:{disambiguation:""},extract:sentence.repeat(3)},{pageid:2,extract:"نص قصير"}]),[]);
});
test("discovery returns an attributed unreviewed source card with stable identity", async () => {
  const calls=[];
  const catalog = [["استنزاف",["استنزاف"],[{...d.parseEntry(fixture.drain),frequency:{zipf:3.41,form:"استنزاف"}}]]];
  const sourceFetch = async url => { calls.push({url,options:{credentials:"omit",redirect:"error"}}); return response({query:{pages:[{pageid:100,title:"موارد",lastrevid:900,extract:"يؤدي استنزاف الموارد الطبيعية إلى أضرار كبيرة تهدد مستقبل البشرية وحياة الكائنات، ولذلك يجب أن تعمل المؤسسات على حماية الموارد."}]}}); };
  const first=await d.discover({index:catalog,fetchFn:sourceFetch,dateKey:"2026-10-16",seedHex:"abcd"});
  assert.equal(first.kind,"found");
  assert.match(first.word.id,/^wk_14_[0-9a-f]{8}$/);
  assert.equal(first.word.reviewed,false);
  assert.equal(first.word.contentVersion,3);
  assert.equal(first.word.source.license,"CC-BY-SA-4.0");
  assert.match(first.word.exampleSource.url,/oldid=900/);
  assert.equal(first.word.exampleKind,"quotation");
  assert.ok(JSON.stringify(first.word).length<=4096);
  assert.equal(calls.length,1);
  for (const call of calls) {assert.equal(call.options.credentials,"omit");assert.equal(call.options.redirect,"error");assert.ok(d.ORIGINS.includes(new URL(call.url).origin));}
  const revised=await d.discover({index:[["استنزاف",["استنزاف"],[{...catalog[0][2][0],revisionId:1140944}]]],fetchFn:sourceFetch});
  assert.equal(first.word.id,revised.word.id);
  assert.notEqual(first.word.source.revisionId,revised.word.source.revisionId);
});
test("excluded and absent candidates end honestly without dictionary fetches", async () => {
  const calls=[];const result=await d.discover({index,excludeKeys:["على غرار"],topics:["science"],fetchFn:mockFetch(calls)});
  assert.equal(result.kind,"empty");assert.equal(calls.length,1);
});
test("response bounds, failures, and invalid JSON return unavailable", async () => {
  for (const fetchFn of [async () => response({}, {"content-length":String(d.LIMITS.bytes+1)}),async () => ({ok:true,headers:{get:()=>"application/json"},text:async()=>"x".repeat(d.LIMITS.bytes+1)}),async () => {throw Error("offline");},async () => ({ok:true,headers:{get:()=>"application/json"},text:async()=>"bad json"})]) {
    assert.equal((await d.discover({index,fetchFn})).kind,"unavailable");
  }
});
test("article matching cannot select more than 50 titles", async () => {
  const calls=[];const many=Array.from({length:70},(_,i)=>["مفردة"+"ب".repeat(i+1),["مفردة"+"ب".repeat(i+1)],[]]);
  const result = await d.discover({index:many,topics:["science"],fetchFn:async(url,options)=>{calls.push({url,options});return url.startsWith(d.ORIGINS[0])?response({query:{pages:[{pageid:1,title:"قراءة",extract:many.map(x=>x[0]).join(" ")}]}}):response({query:{pages:[]}});}});
  assert.equal(calls.length,1);assert.ok(result.diagnostics.titles<=50);
});
test("a fetch implementation that ignores abort cannot hang discovery", async () => {
  const result=await d.discover({index,fetchFn:()=>new Promise(()=>{})});
  assert.equal(result.kind,"unavailable");
});

test("voweled headings and original adjective or verb metadata are understood", () => {
  const parsed=d.parseEntry({...fixture.phrase,text:fixture.phrase.text.replace("المعاني","المَعَانِي").replace("{{اللغة|عربية}}","[[عَرَبِيَّة]]")});
  assert.deepEqual(parsed.definitions,d.parseEntry(fixture.phrase).definitions);
});
test("live false positives: language labels, weak circular glosses, and particle homographs", () => {
  const entry=(title,line)=>({title,text:`== {{اللغة|عربية}} ==\n=== المعاني ===\n# ${line}\n`});
  assert.equal(d.parseEntry(entry("إنجليزية","اَللُّغَةُ الإنجليزية: وهي اللغة الأكثر استعمالا في هذا العصر.")),null);
  assert.equal(d.parseEntry(entry("تَغَيَّرَ","صَارَ غير ما كان.")),null);
  assert.equal(d.extractCandidates([{text:"ومن بين أمور أخرى كانت الظواهر واضحة في المجتمع."}],[["بين",["بَيَنَ"]]]).length,0);
});
test("an unrelated neighboring sentence cannot resolve a quoted word's sense", () => {
  const entry=d.parseEntry(fixture.drain);
  const candidate={key:"استنزاف",passages:[{...passage,text:"ظهر استنزاف شديد في هذا السياق ولم يوضح الكاتب المقصود بهذه الكلمة. استنفاد القوة أو الطاقة بشكل تدريجي أمر مختلف وله أثر آخر."}]};
  assert.equal(d.rankEntry(entry,candidate),null);
});


test("long protection-environment quotation cannot become a truncated phrase lesson", () => {
  const quote="الحفاظ على البيئة هي كل الإجراءات التي تتخذ من قبل هيئات عمومية تابعة للدولة أو الهيئات أو منظمات مستقلة للحد من التأثير السلبي للإنسان على البيئة، على غرار العمل المباشر للحفاظ على البيئة هناك الدراسات التي تقوم بها الهيئات البحثية لفهم النظام البيئي وكذلك الكامل في الكوكب وتحديد المؤثرات البشرية لدرجة الإخلال بالتوازن وتهديد الأجيال الحاضرة والقادمة، ووضع إجراءات تصحيحية.";
  const source={title:"حماية بيئية",pageid:1,revisionId:75730906,text:quote};
  const candidate=d.extractCandidates([source],index)[0];
  const ranked=d.rankEntry(d.parseEntry(fixture.phrase),candidate);
  assert.equal(ranked,null, "A comma-ended fragment is not a complete example");
});

test("sense-specific source examples recover resource depletion without guessing a sense", () => {
  const entry = d.parseEntry(fixture.drain);
  const candidate = {key:"استنزاف",passages:[{...passage,text:"يشمل التأثير البشري على البيئة استنزاف الموارد وتدهور البيئة وتلوثها، مما يؤثر في حياة الكائنات الحية."}]};
  assert.equal(d.rankEntry(entry,candidate)?.meaning,"إفراغ أو استهلاك الشيء حتى نفاده.");
});

test("dictionary examples keep their own sense and attribution in related discovery", async () => {
  const entry = {...d.parseEntry(fixture.drain),frequency:{zipf:3.41,form:"استنزاف"}};
  const relatedReading = "تعتمد الإدارة على حماية الموارد الطبيعية من الاستهلاك المفرط، وتعمل على تحسين مستقبل البشرية وحفظ هذه الموارد للأجيال القادمة.";
  const result = await d.discover({index:[["استنزاف",[entry.title],[entry]]],fetchFn:async()=>response({query:{pages:[{pageid:8,title:"موارد",lastrevid:91,extract:relatedReading}]}})});
  assert.equal(result.kind,"found");
  assert.equal(result.word.meaningAr,entry.senses[0].definition);
  assert.equal(result.word.exampleAr,entry.senses[0].examples[0]);
  assert.match(result.word.exampleSource.url,/^https:\/\/ar.wiktionary.org\/w\/index.php\?oldid=1140943$/);
  assert.match(result.word.discoveryReason,/اقتراح من ويكاموس/);
  assert.match(result.word.discoveryReason,/لا يثبت تداخل الألفاظ صلته بموضوع القراءة/);
  assert.equal(result.diagnostics.requests,1);
  const excluded = await d.discover({index:[["استنزاف",[entry.title],[entry]]],excludeKeys:["الاستنزاف"],fetchFn:async()=>response({query:{pages:[{pageid:8,title:"موارد",lastrevid:91,extract:relatedReading}]}})});
  assert.equal(excluded.kind,"empty");
});
test("definition-shaped examples and phrase senses cannot become standalone lessons", () => {
  const candidate={key:"مركز",passages:[]};
  const entry={title:"مركز",senses:[{definition:"المركز الاجتماعي: هو موضعه وقيمته بين الناس.",examples:["هذا ذو مركز اجتماعي عال بين أفراد المجتمع."]}]};
  assert.equal(d.rankDictionaryExample(entry,candidate),null);
  assert.equal(d.rankDictionaryExample({title:"الحرية",senses:[{definition:"حق الإنسان في الاختيار والتصرف وفق إرادته.",examples:["الحرية كون الشعب أو الرجل حرا في تصرفاته."]}]},{key:"الحرية",passages:[]}),null);
});
test("source QA holds faulty revisions without blacklisting future corrected entries", () => {
  for (const [pageid,revision] of [[12820,1084156],[140115,1079291],[199672,1141360],[224746,1141409],[9740,1086519],[134191,1091225],[140652,1091788],[225039,1140858],[224876,1140921],[14954,1091774],[225040,1141107]]) {
    assert.equal(d.parseEntry({...fixture.drain,pageid,revision}),null);
    assert.ok(d.parseEntry({...fixture.drain,pageid,revision:revision+1}));
  }
});

 test("empty reading retries another selected interest and stops after success", async () => {
  const queries = [];
  const catalog = [["استنزاف",["استنزاف"],[{...d.parseEntry(fixture.drain),frequency:{zipf:3.41,form:"استنزاف"}}]]];
  const result = await d.discover({index:catalog,topics:["science","culture"], fetchFn:async url => {
    queries.push(new URL(url).searchParams.get("gsrsearch"));
    return response({query:{pages: queries.length === 1 ? [] : [{pageid:100,title:"موارد",lastrevid:900,extract:"يؤدي استنزاف الموارد الطبيعية إلى أضرار كبيرة تهدد مستقبل البشرية وحياة الكائنات، ولذلك يجب أن تعمل المؤسسات على حماية الموارد."}]}});
  }});
  assert.equal(result.kind,"found");
  assert.equal(queries.length,2);
  assert.equal(new Set(queries).size,2);
  assert.ok(queries.every(q => ["البحث العلمي","الفنون والأدب"].includes(q)));
  let requests=0;
  const empty=await d.discover({index:catalog,topics:["science","culture","society","environment"],fetchFn:async()=>{requests++;return response({query:{pages:[]}});}});
  assert.equal(empty.kind,"empty"); assert.equal(requests,3);
});
