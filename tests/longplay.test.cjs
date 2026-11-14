/* TRIALUM 1.4 long-play regression tests: local simulation only. */
'use strict';
const assert=require('node:assert/strict');
const E=require('../js/engine.js');
require('../js/evolution.js');
require('../js/progression.js');
require('../js/longplay.js');
require('../js/fauna-lab.js');
require('../js/storage.js');
let n=0;
function test(name,fn){try{fn();n++;console.log('✓ '+name)}catch(e){console.error('✗ '+name);throw e}}
function fixture(){
 const now=Date.now(),s=E.newGame('real',now-400*E.DAY_MS);
 s.stage=7;s.lastDay=400;s.insight=100000;s.compounds=100000;s.biomass=100000;s.energy=100;s.cells=10000;
 for(const k in s.elements)s.elements[k]=100000;
 for(const f of E.researchFields)s.research.fields[f.id]=10000;
 s.research.knowledge=100000;s.research.level=40;s.labActions=20;
 for(const [i,biome] of ['lagoon','crystal','garden'].entries())
 s.habitats.push({id:'hab-'+i,name:'Биосвет '+biome,biome,capacity:100,minerals:{macro:60,micro:55},chem:{ph:7.1,temp:24,oxygen:93,toxins:2},cleanliness:95,flora:[],dayActions:20,bornDay:1,floraSlots:6});
 s.activeHabitat='hab-0';return s;
}
function ancestor(s,i){const prior=E.longplayLineages[i];const p={id:'p-'+i,name:E.SPECIES[prior.source].name+' 1',species:prior.source,habitatId:'hab-2',hue:128,seed:452,eyes:2,shape:'leaf',birthDay:1,ageDays:400,growth:90,
 satiety:90,joy:80,energy:85,clean:90,bond:60,actionsLeft:9};
 E.ensureEvolution(p);p.evolution.level=prior.sourceLevel;p.evolution.trained=14;s.pets.push(p);s.selectedPet=p.id;return p;}
test('v1.4 format is accepted and old v1.3 backups stay importable',()=>{
 const s=fixture();assert(E.validate(s));s.version='1.3.0';assert(E.validate(s));E.ensureLongplay(s);assert.equal(s.version,'1.5.5');
});
test('Backup & Restore accepts 1.4.1 JSON and UTF-8 BOM without losing history',()=>{
 const s=fixture();s.version='1.4.1';
 s.logs.push({id:'event-1',kind:'milestone',day:350,text:'Зачувана историја'});
 const data=JSON.stringify({backupFormat:'trialum',exportedAt:new Date().toISOString(),...s});
 const restored=globalThis.TrialumStorage.parseImport('\uFEFF'+data);
 assert.equal(restored.version,'1.4.1');
 assert(restored.logs.some(x=>x.text==='Зачувана историја'),'Journal entry must survive import');
 assert.equal(restored.habitats.length,3);
 assert.throws(()=>globalThis.TrialumStorage.parseImport('not json'),err=>err.code==='INVALID_JSON');
 assert.throws(()=>globalThis.TrialumStorage.parseImport('{"version":"unknown"}'),err=>err.code==='UNSUPPORTED_BACKUP');
});
test('first cells use minutes instead of day-long gates',()=>{
 const s=E.newGame('real',Date.now()-3*60000);s.stage=1;assert(!E.longplayStageGate(s).ready);s.createdAt-=3*60000;assert(E.longplayStageGate(s).ready);
});
test('regular mode hides demo on game creation',()=>{const s=E.newGame('demo');assert.equal(s.mode,'real')});
test('base species are not all open at start',()=>{
 const s=fixture();s.research.level=1;assert(E.createPet(s,0).ok);assert(!E.createPet(s,1).ok);assert(!E.createPet(s,2).ok);assert(!E.createPet(s,3).ok);
});
test('advanced species cannot ever be created from zero',()=>{
 const s=fixture();for(let i=4;i<E.SPECIES.length;i++)assert(!E.createPet(s,i).ok);
});
test('DNA promotion keeps the pet ID, age, learning and personal memory',()=>{
 const s=fixture(),p=ancestor(s,4),id=p.id,trained=p.evolution.trained;
 const req=E.longplayRequirements(s,4);assert(req.ok,JSON.stringify(req.items.filter(x=>!x.ok)));
 const result=E.longplayTransform(s,p.id,4);assert(result.ok,result.message);
 assert.equal(s.pets.length,1);assert.equal(p.id,id);assert.equal(p.species,4);assert.equal(p.ageDays,400);
 assert.equal(p.evolution.trained,trained);assert.deepEqual(p.lineage,[3,4]);assert.equal(p.habitatId,'hab-1');
});
test('DNA requires the exact parent species and level',()=>{
 const s=fixture();ancestor(s,4).evolution.level=5;const r=E.longplayTransform(s,s.selectedPet,4);assert(!r.ok);
});
test('research discovers new formula and creates local food inventory',()=>{
 const s=fixture();const x=E.longplayInvent(s,'food');assert(x.ok,x.message);
 const r=s.longplay.invented[0];assert(r.kind==='food');assert(E.foodRecipes.some(x=>x.id===r.id));
 assert(E.craftFood(s,r.id).ok);assert(s.foodFactory.stock[r.id]>=2);
});
test('invented botanical form is registered into plant catalog',()=>{
 const s=fixture();const r=E.longplayInvent(s,'flora');assert(r.ok,r.message);
 assert(E.PLANTS.some(x=>x.id===s.longplay.invented[0].id));
});
test('new research materials allow increased capacity',()=>{
 const s=fixture();assert(E.longplayInvent(s,'material').ok);const m=E.longplayMaterials[0];
 assert(s.longplay.materials[m.id]>=1);
 const before=s.habitats[0].capacity;
 assert(E.longplayUpgradeHabitat(s,'reinforce').ok);
 assert(s.habitats[0].capacity>before);
});
test('expanded habitat increases number of possible plants',()=>{
 const s=fixture();E.longplayInvent(s,'material');assert(E.longplayUpgradeHabitat(s,'planters').ok);assert(s.habitats[0].floraSlots>6);
});
test('skill training is individual and locked by age and research',()=>{
 const s=fixture();const p=ancestor(s,4),q={...p,id:'p-other',skills:{},evolution:{...p.evolution,level:2,brain:JSON.parse(JSON.stringify(p.evolution.brain))}};
 s.pets.push(q);p.evolution.level=55;
 assert(!E.longplayTrain(s,q.id,'dialogue').ok);
 const a=E.longplayTrain(s,p.id,'wave');assert(a.ok,a.message);assert.equal(p.skills.wave,1);assert.equal(q.skills.wave,undefined);
});
test('earned research credits can refill only missing actions',()=>{
 const s=fixture();s.labActions=E.labActionLimit(s)-1;s.longplay.credits=20;
 assert(E.longplayBoost(s,'lab').ok);assert.equal(s.labActions,E.labActionLimit(s));assert(!E.longplayBoost(s,'lab').ok);
});
test('paid billing and local LLM are not falsely enabled',()=>{
 assert.equal(E.longplayPayments.enabled,false);assert(!E.longplayPayments.canPurchase());assert(!E.longplayLLM.isAvailable());
});
test('research lab levels can extend beyond original level six',()=>{
 const s=fixture(),t=E.longplayTier(40);assert.equal(t.level,40);assert(t.day>365);
});
test('old worlds migrate with achievements and save version intact',()=>{
 const s=fixture();s.version='1.2.0';assert(E.validate(s));E.advance(s,Date.now());assert.equal(s.version,'1.5.5');
});
test('refresh restores one independent action per creature',()=>{
 const s=fixture(),p=ancestor(s,4);p.actionsLeft=0;s.labActions=0;s.longplay.lastTick=Date.now()-14*60000;
 assert(E.longplayTick(s)>=1);assert(p.actionsLeft>=1);assert(s.labActions>=1);
});
test('research unlocks new fauna but demands later evolution',()=>{
 const s=fixture(),p=ancestor(s,8);
 p.evolution.level=110;
 const id=p.id;
 const created=E.longplayInvent(s,'fauna');assert(created.ok,created.message);
 const x=E.longplayFaunaList(s)[0];assert.equal(x.source,7);assert.equal(E.SPECIES[x.speciesIndex].name,x.name);
 assert(!E.createPet(s,x.speciesIndex).ok,'must not permit zero-generation');
 assert(!E.longplayTransform(s,p.id,x.speciesIndex).ok,'must not permit premature conversion');
 s.lastDay=x.day+1;p.evolution.level=x.sourceLevel;
 const g=E.longplayRequirements(s,x.speciesIndex);assert(g.ok,JSON.stringify(g.items.filter(a=>!a.ok)));
 const converted=E.longplayTransform(s,p.id,x.speciesIndex);assert(converted.ok,converted.message);
 assert.equal(p.id,id);assert.equal(p.species,x.speciesIndex);assert.deepEqual(p.lineage.slice(-1),[x.speciesIndex]);
});

test('mini GGUF conversation survives DNA evolution from Synapso to Mnemos and beyond',()=>{
 const prevExpansion=globalThis.TrialumExpansion,prevAndroid=globalThis.TrialumAndroid;
 const prevDocument=globalThis.document,prevMind=globalThis.TrialumMind;
 const replies=[];
 const ctx={toast:msg=>{if(/LLM бара|Прво преземи|Нема|недостапен/.test(msg))throw Error('Unexpected LLM gate: '+msg)},notice:()=>{},scheduleSave:()=>{},render:()=>{}};
 try{
  globalThis.TrialumExpansion={render:()=>'',can:()=>false,handle:()=>false};
  globalThis.TrialumMind=null;
  globalThis.TrialumAndroid={
   modelStatus:()=> 'installed',
   askPet:(id,name,message)=>replies.push({id,name,message})
  };
  globalThis.document={getElementById:id=>id==='llmPrompt'?{value:'Здраво, еволуиран пријател!'}:null};
  require('../js/longplay-ui.js');
  const s=fixture(),p=ancestor(s,4),id=p.id;
  s.lastDay=2000;p.ageDays=2000;p.evolution.level=250;
  for(let species=4;species<=10;species++){
   const result=E.longplayTransform(s,id,species);
   assert(result.ok,'DNA promotion to '+species+': '+result.message);
   assert.equal(p.id,id,'DNA preserves pet identity');
   assert.equal(p.species,species);
   p.actionsLeft=0;
   const view=globalThis.TrialumExpansion.render('pets',s);
   assert(view.includes('id="llmPrompt"'),'mini LLM field missing for species '+species);
   assert(view.includes('data-do="llmAsk" class="primary"'),'mini action not enabled for species '+species);
   const before=replies.length;
   globalThis.TrialumExpansion.handle('llmAsk',{},s,ctx);
   assert.equal(replies.length,before+1,'mini GGUF call missing for species '+species);
   assert.equal(replies.at(-1).id,id);
   assert.equal(p.actionsLeft,0,'mini chat uses no pet actions');
   for(let turn=0;turn<10;turn++)
    globalThis.TrialumExpansion.handle('llmAsk',{},s,ctx);
   assert.equal(replies.length,before+11,'eleven local mini chats on same day');
   assert.equal(p.actionsLeft,0);
   assert(p.chatHistory.length<=12);
  }
 }finally{
  globalThis.TrialumExpansion=prevExpansion;
  globalThis.TrialumAndroid=prevAndroid;
  globalThis.document=prevDocument;
  globalThis.TrialumMind=prevMind;
 }
});
console.log('TRIALUM 1.4:',n,'checks passed');
