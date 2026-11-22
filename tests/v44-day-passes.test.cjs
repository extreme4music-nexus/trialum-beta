/* Trialum v44 Day Passes — targeted simulation, economy and persistence tests. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('../js/engine.js');
require('../js/evolution.js');
require('../js/progression.js');
require('../js/longplay.js');
require('../js/plant-lifecycle.js');
const D=require('../js/day-passes.js');
const NOW=Date.now();
function world(){
 const s=E.newGame('real',NOW-2*E.DAY_MS);
 E.advance(s,NOW);
 s.stage=7;s.longplay.credits=5000;s.research.level=8;
 s.labActions=0;
 s.habitats.push({id:'h1',name:'Lagoon',biome:'lagoon',capacity:15,
  minerals:{macro:60,micro:60},chem:{ph:7.1,temp:24,oxygen:90,toxins:2},
  cleanliness:90,flora:[],dayActions:0,bornDay:1});
 s.activeHabitat='h1';
 const p={id:'p1',name:'Nova',species:0,habitatId:'h1',hue:123,seed:11,eyes:2,
  shape:'jelly',birthDay:1,ageDays:2,satiety:90,joy:80,energy:80,clean:90,
  bond:30,actionsLeft:0};
 E.ensureEvolution(p);s.pets.push(p);s.selectedPet=p.id;
 E.ensureAgro(s);s.agro.migrationPending=false;
 s.agro.gardenPlants.push({id:'crop1',species:'aquaglow',bedId:'aquarium',medium:'aquatic',
  health:90,hydration:90,growth:20,dead:false,lastWaterDay:s.lastDay-1,
  lastAdditiveDay:s.lastDay-1});
 E.ensureAgro(s);
 return s;
}
const run=(name,fn)=>{fn();console.log('PASS',name)};
run('price schedule gives rising discounts, ending with a 30-day bundle',()=>{
 assert.deepEqual(D.PACKS.map(x=>x.days),[1,3,7,14,30]);
 assert.deepEqual(D.PACKS.map(x=>x.credits),[50,140,315,595,1125]);
 const ratios=D.PACKS.map(x=>x.credits/(50*x.days));
 for(let i=1;i<ratios.length;i++)assert(ratios[i]<ratios[i-1]);
});
run('purchasing 30 day passes changes neither time nor plant state',()=>{
 const s=world(),beforeDay=s.lastDay,createdAt=s.createdAt,plant=JSON.stringify(s.agro.gardenPlants);
 const r=D.buy(s,30);
 assert(r.ok,r.message);assert.equal(s.longplay.credits,3875);
 assert.equal(s.longplay.dayPasses,30);assert.equal(s.lastDay,beforeDay);
 assert.equal(s.createdAt,createdAt);assert.equal(s.longplay.paidDayOffset,0);
 assert.equal(JSON.stringify(s.agro.gardenPlants),plant);
});
run('one redeemed pass runs full daily care and plant lifecycle without changing clock',()=>{
 const s=world(),createdAt=s.createdAt,before=s.lastDay;
 assert(D.buy(s,3).ok);
 const r=D.redeem(s,1,NOW);
 assert(r.ok,r.message);assert.equal(s.lastDay,before+1);
 assert.equal(s.longplay.dayPasses,2);assert.equal(s.longplay.paidDayOffset,1);
 assert.equal(s.createdAt,createdAt);
 assert(s.pets[0].satiety<90,'pet feeding requirements must decay');
 assert(s.agro.gardenPlants[0].hydration<90,'plant must lose water');
 assert.equal(E.dayFor(s,NOW),s.lastDay);
});
run('30-days bought are independently redeemable across app-restart saves',()=>{
 const s=world();assert(D.buy(s,30).ok);assert(D.redeem(s,1,NOW).ok);
 const restored=JSON.parse(JSON.stringify(s));E.ensureLongplay(restored);E.ensureAgro(restored);
 assert.equal(restored.longplay.dayPasses,29);
 assert.equal(restored.longplay.paidDayOffset,1);
 const before=restored.lastDay;assert(D.redeem(restored,1,NOW).ok);
 assert.equal(restored.lastDay,before+1);assert.equal(restored.longplay.dayPasses,28);
});
run('30 consecutive skipped days can cause genuine plant neglect',()=>{
 const s=world();assert(D.buy(s,30).ok);
 const r=D.redeem(s,30,NOW);
 assert(r.ok,r.message);
 assert.equal(s.longplay.dayPasses,0);
 assert.equal(s.longplay.paidDayOffset,30);
 assert(s.agro.gardenPlants[0].hydration<=10);
 assert(s.agro.gardenPlants[0].health<90);
 assert(s.pets[0].satiety<90);
 assert.equal(s.lastDay,E.dayFor(s,NOW));
});
run('insufficient credits or passes never mutate economy',()=>{
 const s=world();s.longplay.credits=49;
 const prior=JSON.stringify({longplay:s.longplay,day:s.lastDay});
 assert.equal(D.buy(s,1).code,'insufficient_credits');
 assert.equal(D.redeem(s,1,NOW).code,'insufficient_passes');
 assert.equal(JSON.stringify({longplay:s.longplay,day:s.lastDay}),prior);
});
run('unlisted/invalid pack and invalid redemption cannot change save',()=>{
 const s=world(),before=JSON.stringify(s);
 for(const count of [0,-1,2,50,'3',1.5,NaN,null]){
  assert(!D.buy(s,count).ok);
  assert(!D.redeem(s,count,NOW).ok);
 }
 assert.equal(JSON.stringify(s),before);
});
run('old save without day offset has natural day; real-time stage gate unaffected',()=>{
 const s=world(),before=E.longplayStageGate(s).elapsedMs,natural=E.dayFor(s,NOW);
 delete s.longplay.paidDayOffset;
 assert.equal(E.dayFor(s,NOW),natural);
 assert(D.buy(s,7).ok);assert(D.redeem(s,1,NOW).ok);
 assert.equal(E.dayFor(s,NOW),natural+1);
 const after=E.longplayStageGate(s).elapsedMs;
 assert(Math.abs(after-before)<60000,'stage gate must still reflect real elapsed time');
});
run('HUD Day button and simulation warnings are wired',()=>{
 const index=fs.readFileSync(require.resolve('../index.html'),'utf8');
 const app=fs.readFileSync(require.resolve('../js/app.js'),'utf8');
 const ui=fs.readFileSync(require.resolve('../js/day-passes-ui.js'),'utf8');
 assert(index.includes('data-do="dayPassOpen"'));
 assert(index.includes('js/day-passes.js'));
 assert(index.includes('js/day-passes-ui.js'));
 assert(app.includes("action==='dayPassOpen'"));
 assert(ui.includes('data-day-pack'));
 assert(ui.includes('data-day-use'));
 assert(ui.includes('plant'));
 assert(ui.includes('confirm'));
});
console.log('V44 DAY PASSES TESTS PASSED');
