const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../js/cognitive-memory.js'),M=require('../js/mnemos-context.js');
test('Mnemos retrieves private pet-scoped semantic memory',()=>{
 const a={id:'a',name:'A',birthDay:1,ageDays:8,satiety:80},b={id:'b',name:'B'};
 C.topic(a,'music',100);C.topic(b,'science',200);
 C.record(a,'feed',{at:100,day:1,food:'biomass'});
 const x=JSON.parse(M.assemble(a,{},'гитара'));
 assert.equal(x.memoryScope,'private');
 assert.equal(x.cognitive.self.lastMeal.food,'biomass');
 assert.ok(x.cognitive.topics.some(t=>t.label==='music'));
 assert.ok(!x.cognitive.topics.some(t=>t.label==='science'));
 assert.equal(JSON.parse(M.assemble(b,{},'science')).cognitive.topics[0].label,'science');
});
test('Mnemos produces valid bounded JSON with oversized inputs',()=>{
 const p={id:'x',name:'X',birthDay:1,ageDays:1};
 for(let i=0;i<30;i++)C.topic(p,'topic-'+i,100+i);
 const history=Array.from({length:50},(_,i)=>({role:i%2?'assistant':'user',text:'abc'.repeat(300)}));
 const s=M.assemble(p,{},'topic',{history,legacy:Array(40).fill('a'.repeat(400))});
 assert.ok(s.length<=M.MAX);assert.ok(JSON.parse(s).cognitive.self);
});
test('serialization retains cognitive memory without model dependency',()=>{
 const p={id:'a'};C.summarize(p,'I play guitar','Music',100);
 const copy=JSON.parse(JSON.stringify(p));
 assert.equal(C.ensure(copy).owner.topics.music.count,1);
});
