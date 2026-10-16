const test = require('node:test');
const assert = require('node:assert/strict');
const d = require('../shared/discovery');
const index = require('../data/discovery-index.json');
const entry = key => index.find(row=>row[0]===key)?.[2][0];
test('new lessons reject familiar words and source errors without a teaching allowlist',()=>{
  for(const key of ['نظرية','منارة','ثلاجة','تلفاز','قانون','تاريخ','مجموعة']) {
    const e=entry(key);
    if(e) assert.equal(d.isUsefulEntry(e),false,key);
  }
  for(const key of ['استقصاء','استنزاف','تعويق']) assert.equal(d.isUsefulEntry(entry(key)),true,key);
});
test('unknown frequency is not mistaken for desirable rarity',()=>{
  assert.equal(d.isUsefulEntry({...entry('استقصاء'),frequency:undefined}),false);
});
test('a definite verbal noun alone does not demonstrate the source verb',()=>{
  const nounExample='رجل لا يعرف التهاون مطلقا.';
  const verbExample='تهاون الموظف في أداء واجباته اليومية.';
  const e={title:'تهاونَ',partOfSpeech:'verb',senses:[{
    definition:'أهمله، لم يهتمّ به، قصّر فيه ولم يوفّه حقّه',examples:[nounExample]
  }]};
  const candidate={key:'تهاون',passages:[]};
  assert.equal(d.rankDictionaryExample(e,candidate),null);
  e.senses[0].examples.push(verbExample);
  assert.equal(d.rankDictionaryExample(e,candidate)?.example,verbExample);
});
test('dependent glosses and misleading constructions cannot be lessons',()=>{
  for(const definition of ['قد يستخدم أيضًا للإشارة إلى إنتاج أو تربية كائنات صغيرة في بيئة محكومة.','للأشياء: ما يتكون منه أو صفته عامّة.'])
    assert.equal(d.isReliableSense({definition,examples:['هذا مثال تام لكنه لا يصلح لتعويض تعريف ناقص.']}),false);
});
test('a faulty saved card remains readable but is ineligible for a new daily assignment',()=>{
  const card={word:'نَظَرِيَّة',meaningAr:'قضية غير مثبتة ولا مبرهنة لتفسير أمر ما.',source:{revisionId:1086519}};
  assert.equal(d.isEligibleSnapshot(card,index),false);
});
test('cached source examples must pass the same target-word check as fresh lessons',()=>{
  const e=entry('اعتدال');
  const sense=e.senses.find(s=>s.examples.some(x=>x.includes('الطقس معتدل')));
  assert.ok(sense);
  const card={word:e.title,meaningAr:sense.definition,exampleAr:sense.examples.find(x=>x.includes('الطقس معتدل')),source:{revisionId:e.revisionId},exampleSource:{url:'https://ar.wiktionary.org/w/index.php?oldid='+e.revisionId}};
  assert.equal(d.isEligibleSnapshot(card,index),false);
});
test('a title-only inventory fails explicitly without pretending to be a usable catalog',async()=>{
  const result=await d.discover({index:[['استقصاء',['استقصاء']]],fetchFn:()=>{throw Error('unexpected network')}});
  assert.equal(result.kind,'unavailable');
  assert.equal(result.diagnostics.reason,'catalog-required');
});
