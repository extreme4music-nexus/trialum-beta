/* v44 new work only: one-credit action-refill engine and HUD smoke tests. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('../js/engine.js');
require('../js/evolution.js');
require('../js/progression.js');
require('../js/longplay.js');
require('../js/action-economy.js');
require('../js/plant-lifecycle.js');
const topup=require('../js/action-economy.js');
function fixture(){
 const s=E.newGame('real',Date.now()-5*86400000);
 s.stage=7;s.lastDay=6;s.research.level=12;s.longplay.credits=50;s.longplay.earned=90;
 s.labActions=0;
 const h=(id,name)=>({id,name,biome:'lagoon',capacity:24,minerals:{macro:70,micro:70},
  chem:{ph:7.1,temp:24,oxygen:90,toxins:1},cleanliness:92,flora:[],dayActions:0,bornDay:1});
 s.habitats=[h('h1','Lagoon'),h('h2','Cave')];s.activeHabitat='h1';
 const p=(id,name)=>({id,name,species:0,habitatId:'h1',birthDay:1,ageDays:6,
  hue:80,seed:12,eyes:2,shape:'jelly',satiety:80,joy:70,energy:70,
  clean:70,bond:50,actionsLeft:0,cognitiveMemory:{owner:{topics:{music:{count:2}}}}});
 s.pets=[p('p1','Crystal One'),p('p2','Crystal Two')];s.selectedPet='p1';
 E.ensureAgro(s);s.agro.actionsLeft=0;
 return s;
}
function snap(s){return JSON.stringify({balance:s.longplay.credits,earned:s.longplay.earned,
 lab:s.labActions,pets:s.pets.map(p=>p.actionsLeft),
 habitats:s.habitats.map(h=>h.dayActions),garden:s.agro.actionsLeft,
 ledger:s.longplay.ledger});}
function check(name,fn){fn();console.log('PASS',name);}
check('one lab action costs exactly one credit',()=>{
 const s=fixture(),prev=s.longplay.ledger.length;
 const r=topup.buy(s,'lab',null,1);
 assert(r.ok,r.message);assert.equal(r.cost,1);assert.equal(s.labActions,1);
 assert.equal(s.longplay.credits,49);assert.equal(s.longplay.earned,90);
 assert.equal(s.longplay.ledger.length,prev+1);
 assert.equal(s.longplay.ledger.at(-1).value,-1);
});
check('lab action pack never discounts below one credit per action',()=>{
 const s=fixture();assert(topup.buy(s,'lab',null,5).ok);
 assert.equal(s.labActions,5);assert.equal(s.longplay.credits,45);
});
check('pet refills are strictly per-pet, not per selected pet',()=>{
 const s=fixture();const privateBefore=JSON.stringify(s.pets[0].cognitiveMemory);
 assert(topup.buy(s,'pet','p2',3).ok);
 assert.equal(s.pets[0].actionsLeft,0);assert.equal(s.pets[1].actionsLeft,3);
 assert.equal(JSON.stringify(s.pets[0].cognitiveMemory),privateBefore);
});
check('habitat refills are per-habitat even when another is active',()=>{
 const s=fixture();assert(topup.buy(s,'habitat','h2',4).ok);
 assert.equal(s.habitats[0].dayActions,0);assert.equal(s.habitats[1].dayActions,4);
});
check('greenhouse action pool supports one-credit topups',()=>{
 const s=fixture();assert(topup.buy(s,'garden',null,2).ok);
 assert.equal(s.agro.actionsLeft,2);assert.equal(s.longplay.credits,48);
});
check('insufficient credits cannot change any pool or ledger',()=>{
 const s=fixture();s.longplay.credits=1;const before=snap(s);
 const r=topup.buy(s,'lab',null,2);
 assert(!r.ok);assert.equal(r.code,'insufficient_credits');assert.equal(r.shortfall,1);
 assert.equal(snap(s),before);
});
check('over-cap packs and repeated taps do not partially spend',()=>{
 const s=fixture();const cap=E.petActionLimit(s);
 assert(topup.buy(s,'pet','p1',cap).ok);
 const before=snap(s);const r=topup.buy(s,'pet','p1',1);
 assert(!r.ok);assert.equal(r.code,'action_capacity');assert.equal(snap(s),before);
});
check('invalid quantities and targets fail without spending',()=>{
 const s=fixture();const before=snap(s);
 for(const n of [-2,0,1.5,31,NaN,Infinity,'1',null])
  assert(!topup.buy(s,'lab',null,n).ok,'invalid '+String(n));
 assert(!topup.buy(s,'pet','missing',1).ok);
 assert(!topup.buy(s,'habitat','missing',1).ok);
 assert(!topup.buy(s,'fake',null,1).ok);
 assert.equal(snap(s),before);
});
check('world JSON roundtrip preserves earned balance, action pools and purchases',()=>{
 const s=fixture();assert(topup.buy(s,'lab',null,2).ok);
 assert(topup.buy(s,'pet','p1',1).ok);
 const copy=JSON.parse(JSON.stringify(s));E.ensureLongplay(copy);E.ensureAgro(copy);
 assert.equal(copy.labActions,2);assert.equal(copy.pets[0].actionsLeft,1);
 assert.equal(copy.longplay.credits,47);
 assert.equal(copy.longplay.ledger.at(-1).type,'spent');
});
check('legacy Free Credits UI and old pricing remain untouched',()=>{
 const ui=fs.readFileSync(require.resolve('../js/longplay-ui.js'),'utf8');
 assert(ui.includes("Лаб +1 акција · 12"));
 assert(ui.includes("Миленик +1 акција · 8"));
 assert(ui.includes("Биосвет +1 акција · 8"));
});
check('overlay is connected to the existing game save/notice path',()=>{
 const index=fs.readFileSync(require.resolve('../index.html'),'utf8');
 const app=fs.readFileSync(require.resolve('../js/app.js'),'utf8');
 const overlay=fs.readFileSync(require.resolve('../js/action-topup-ui.js'),'utf8');
 assert(index.includes('js/action-economy.js'));
 assert(index.includes('js/action-topup-ui.js'));
 assert(app.includes("action==='actionRefillOpen'"));
 assert(app.includes('TopUp?.decorate?.'));
 assert(overlay.includes("cb.notice?.(result,'select')"));
 assert(overlay.includes('E.buyActionsWithCredits'));
 assert(overlay.includes('Earn'));
});
console.log('V44 ACTION ECONOMY TESTS PASSED');
