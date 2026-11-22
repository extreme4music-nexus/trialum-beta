/* TRIALUM v44: bilingual/offline guide and private AI retrieval targeted tests. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('../js/engine.js');
require('../js/evolution.js');
require('../js/progression.js');
require('../js/longplay.js');
require('../js/plant-lifecycle.js');
require('../js/player-guide.js');
const G=globalThis.TrialumPlayerGuide;
const run=(title,fn)=>{fn();console.log('PASS',title)};
function world(){
 const s=E.newGame('real',Date.now()-4*E.DAY_MS);s.stage=7;s.labActions=0;
 s.research.level=5;s.pets=[];s.habitats=[];
 return s;
}
run('every original v43 guide chapter has EN/MK offline topic',()=>{
 const english=G.all('en'),macedonian=G.all('mk');
 assert.equal(english.length,20);assert.equal(macedonian.length,20);
 for(let i=0;i<english.length;i++){
  assert.equal(english[i].id,macedonian[i].id);
  assert(english[i].summary.length>45);assert(macedonian[i].summary.length>35);
  assert(english[i].steps.length>=3);assert(macedonian[i].steps.length>=3);
  assert.equal(english[i].version,'1.4 v44');
 }
});
run('full offline book documents have exactly 20 topical sections',()=>{
 for(const lang of ['en','mk']){
  const page=fs.readFileSync(require.resolve('../assets/player-guide-v44-'+lang+'.html'),'utf8');
  assert(page.includes('lang="'+lang+'"'));
  assert(page.includes('1.4 v44'));
  for(const item of G.all(lang))assert(page.includes('id="'+item.id+'"'));
  assert.equal((page.match(/<section id="/g)||[]).length,20);
  assert(!page.includes('http://')&&!page.includes('https://'));
 }
});
run('original food flow explained without invented direct feeding',()=>{
 const f=G.entry('food','en');
 assert(f.summary.includes('Nutrition Laboratory'));
 assert(f.summary.includes('Warehouse'));
 assert(f.summary.includes('Home Reserve'));
 const a=G.answer('Where can I get food?',world(),{name:'Crystal',id:'p1'});
 assert(a.includes('Warehouse')&&a.includes('Home Reserve')&&a.includes('Feed'));
});
run('credit advice derives from the new HUD economy',()=>{
 const a=G.answer('I have no credits, what should I do?',world(),{name:'Nova'});
 assert(a.includes('Earn')&&a.includes('one')&&a.includes('disabled'));
});
run('current pet and flora warnings are chosen using live world state',()=>{
 const s=world();
 s.pets.push({id:'p1',name:'Nova',species:0,satiety:20,actionsLeft:0});
 s.selectedPet='p1';
 s.agro.gardenPlants.push({id:'plant1',species:'aquaglow',bedId:'aquarium',
  hydration:14,health:25,dead:false});
 const hints=G.hints(s,'pets','p1','en');
 assert(hints.some(x=>x.id==='hungry'));
 assert(hints.some(x=>x.id==='pet-actions'));
 assert(hints.some(x=>x.id==='plants'));
});
run('basic English-only assistant is deterministic even without any local LLM',()=>{
 const s=world(),p={id:'low-1',name:'Crystal 1'};
 assert(G.answer('what should i do next?',s,p).includes('suggestion'));
 assert(G.answer('продолжи',s,p).includes('English only'));
 const first=G.answer('how do I get food?',s,p);
 assert.equal(first,G.answer('how do I get food?',s,p));
});
run('guide results are searchable with bounded private model snippets',()=>{
 assert(G.match('food warehouse',{limit:3,lang:'en'}).some(x=>x.id==='food'));
 const refs=G.forModel('food',{limit:2});
 assert(refs.length>0&&refs.length<=2);
 assert(refs.every(x=>x.version==='1.4 v44'&&x.summary.length<=190));
});
run('original privacy scopes do not admit owner guide queries as public memory',()=>{
 const source=fs.readFileSync(require.resolve('../js/ai-context.js'),'utf8');
 assert(source.includes('if(priv)for(const ref of root.TrialumPlayerGuide'));
 assert(source.includes('add(result.guide'));
});
run('full reader, guide button and precache wired',()=>{
 const index=fs.readFileSync(require.resolve('../index.html'),'utf8');
 const sw=fs.readFileSync(require.resolve('../sw.js'),'utf8');
 const app=fs.readFileSync(require.resolve('../js/app.js'),'utf8');
 assert(index.includes('data-do="guideOpen"'));
 assert(index.includes('js/player-guide.js')&&index.includes('js/player-guide-ui.js'));
 assert(app.includes("action==='guideOpen'"));
 for(const p of ['js/player-guide.js','js/player-guide-ui.js','assets/player-guide-v44-en.html','assets/player-guide-v44-mk.html'])assert(sw.includes(p));
});
console.log('V44 PLAYER GUIDE TESTS PASSED');
