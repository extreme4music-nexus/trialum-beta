/* New only: Trialum v44 interactive top HUD content and integration tests. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('../js/engine.js');
require('../js/evolution.js');
require('../js/progression.js');
require('../js/longplay.js');
const HUD=require('../js/resource-hud-ui.js');
function world(){
 const s=E.newGame('real');
 s.stage=2;s.insight=44;s.compounds=33;s.biomass=100;
 s.longplay.credits=27;s.longplay.earned=41;
 s.longplay.ledger.push({type:'spent',day:2,value:-5,reason:'Test action'});
 const pet={id:'p1',name:'Nova',species:0,birthDay:1,ageDays:4,seed:45};
 E.ensureEvolution(pet);pet.evolution.level=5;pet.evolution.xp=29;pet.evolution.earned=543;
 s.pets.push(pet);s.selectedPet='p1';
 return s;
}
const run=(label,fn)=>{fn();console.log('PASS',label)};
run('all five resource descriptions have actionable destinations',()=>{
 const s=world();
 for(const key of ['xp','credits','molecules','biomass','insight']){
  const d=HUD.describe(s,key);
  assert(d&&d.title&&d.summary&&d.facts.length&&d.destination&&d.action,key);
 }
 assert.equal(HUD.describe(s,'invalid'),null);
});
run('XP details reflect selected pet level and current XP',()=>{
 const s=world(),d=HUD.describe(s,'xp');
 assert.equal(d.value,543);assert(d.facts.some(x=>x.includes('Nova')&&x.includes('5')));
 s.pets[0].evolution.earned+=60;
 assert.equal(HUD.describe(s,'xp').value,603);
});
run('credits detail reads saved balance and earned counter',()=>{
 const s=world(),d=HUD.describe(s,'credits');
 assert.equal(d.value,27);
 assert(d.facts.some(x=>x.includes('41')));
 s.longplay.credits-=3;
 assert.equal(HUD.describe(s,'credits').value,24);
});
run('molecules and insight show true current evolution requirements',()=>{
 const s=world(),m=HUD.describe(s,'molecules'),i=HUD.describe(s,'insight');
 assert.equal(m.value,33);assert.equal(i.value,44);
 assert(m.facts.some(x=>x.includes(String(E.PHASE_REQ[s.stage].compounds))));
 assert(i.facts.some(x=>x.includes(String(E.PHASE_REQ[s.stage].insight))));
});
run('biomass detail derives daily gain from actual stage',()=>{
 const s=world();
 assert(HUD.describe(s,'biomass').facts.some(x=>x.includes('+1')));
 s.stage=7;assert(HUD.describe(s,'biomass').facts.some(x=>x.includes('+5')));
});
run('empty pet roster still opens a useful XP dialog',()=>{
 const s=world();s.pets=[];s.selectedPet=null;
 const d=HUD.describe(s,'xp');assert(d);assert.equal(d.value,0);
});
run('all six top indicators are touch and keyboard buttons',()=>{
 const index=fs.readFileSync(require.resolve('../index.html'),'utf8');
 const app=fs.readFileSync(require.resolve('../js/app.js'),'utf8');
 for(const key of ['xp','credits','molecules','biomass','insight'])
  assert(index.includes('data-do="hudDetails" data-hud="'+key+'"'));
 assert(index.includes('data-do="dayPassOpen"'));
 assert(index.includes('js/resource-hud-ui.js'));
 assert(app.includes("action==='hudDetails'"));
 assert(app.includes('chooseTab'));
});
console.log('V44 HUD DETAILS TESTS PASSED');
