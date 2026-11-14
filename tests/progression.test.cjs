/* Regression tests for fictional Trialum 1.3 progression; no network or real DNA. */
'use strict';
const assert=require('node:assert/strict');
const E=require('../js/engine.js');
require('../js/evolution.js');
require('../js/progression.js');
let passed=0;
function test(name,fn){try{fn();passed++;console.log('✓ '+name);}catch(e){console.error('✗ '+name);throw e;}}
function world(){
 const s=E.newGame('demo',1700000000000);s.stage=7;s.insight=2000;s.compounds=3000;s.biomass=3000;s.energy=100;s.cells=3000;
 for(const el in s.elements)s.elements[el]=3000;
 s.habitats=[{id:'hab-1',name:'Пробна лагуна',biome:'lagoon',capacity:100,minerals:{macro:64,micro:58},chem:{ph:7.1,temp:24,oxygen:90,toxins:3},cleanliness:94,flora:[],dayActions:4,bornDay:1}];
 s.activeHabitat='hab-1';s.lastDay=40;s.demoDay=40;
 return s;
}
function pet(s,i=0){const r=E.createPet(s,i);assert(r.ok,r.message);return E.currentPet(s);}
test('1.3 world validates and retains old format',()=>{const s=world();assert.equal(s.version,'1.3.0');assert(E.validate(s));s.version='1.2.0';assert(E.validate(s));E.ensureResearch(s);assert.equal(s.research.level,1);});
test('research starts at tier 1 with five fields',()=>{const s=world();const r=E.ensureResearch(s);assert.equal(E.researchFields.length,5);assert.equal(r.fields.cognition,0);});
test('lab study spends daily action and produces persistent knowledge',()=>{const s=world(),prior=s.labActions;const x=E.study(s,'molecules');assert(x.ok,x.message);assert(s.research.knowledge>0);assert(s.research.fields.molecules>0);assert.equal(s.labActions,prior-1);});
test('advanced disciplines cannot be researched too early',()=>{const s=world();assert(!E.study(s,'cognition').ok);assert(!E.study(s,'genomics').ok);});
test('upgrade blocked without prerequisites',()=>{const s=E.newGame('demo');assert(!E.upgradeLab(s).ok);assert.equal(s.research.level,1);});
test('lab 2 unlocks only with knowledge and suitable conditions',()=>{const s=world(),r=E.ensureResearch(s);r.knowledge=120;r.fields.molecules=35;const a=E.upgradeLab(s);assert(a.ok,a.message);assert.equal(r.level,2);assert(s.achievements.some(x=>x.id==='lab2'));});
test('lab level expands actions independently',()=>{const s=world();pet(s);s.research.level=5;assert.equal(E.labActionLimit(s),7);assert.equal(E.petActionLimit(s),6);});
test('food recipes are gated by research tier',()=>{const s=world();assert(!E.craftFood(s,'manna').ok);s.research.level=2;assert(E.craftFood(s,'manna').ok);assert.equal(s.foodFactory.stock.manna,3);});
test('crafted food feeds selected pet without additionally charging raw biomass',()=>{const s=world();const p=pet(s);s.research.level=2;E.craftFood(s,'manna');const before=s.biomass,actions=p.actionsLeft;const x=E.feedPrepared(s,p.id,'manna');assert(x.ok,x.message);assert.equal(s.biomass,before);assert.equal(p.actionsLeft,actions-1);assert.equal(s.foodFactory.stock.manna,2);});
test('special food rejects a pet of incompatible biome',()=>{const s=world();const p=pet(s,1);s.research.level=2;E.craftFood(s,'lumen');assert(!E.feedPrepared(s,p.id,'lumen').ok);assert.equal(s.foodFactory.stock.lumen,2);});
test('unlock advanced creature requires laboratory and blueprint',()=>{const s=world();assert(!E.createPet(s,4).ok);s.research.level=3;assert(!E.createPet(s,4).ok);const x=E.unlockSpecies(s,4);assert(x.ok,x.message);s.habitats[0].biome='crystal';assert(E.createPet(s,4).ok);});
test('higher plants require developed botanical lab',()=>{const s=world();assert(!E.inventPlant(s,'nootbloom').ok);s.research.level=2;assert(E.inventPlant(s,'nootbloom').ok);});
test('cognition requires creature level and lab',()=>{const s=world(),p=pet(s);assert(!E.cognitiveAction(s,p.id,'puzzle').ok);s.research.level=3;p.evolution.level=6;p.energy=80;const x=E.cognitiveAction(s,p.id,'puzzle');assert(x.ok,x.message);assert(p.evolution.symbols.length>0);});
test('cognition builds individual vocabulary rather than shared global vocabulary',()=>{const s=world(),p=pet(s),q=pet(s);s.research.level=4;p.evolution.level=10;q.evolution.level=10;E.cognitiveAction(s,p.id,'teach');assert(p.evolution.symbols?.length===1);assert(!q.evolution.symbols?.length);});
test('DNA designer stays locked until final laboratory and pet level',()=>{const s=world(),p=pet(s),d={hue:123,eyes:4,shape:'cloud'};assert(!E.editFictionalGenes(s,p.id,d).ok);s.research.level=6;assert(!E.editFictionalGenes(s,p.id,d).ok);p.evolution.level=22;assert(E.editFictionalGenes(s,p.id,d).ok);assert.equal(p.shape,'cloud');assert.equal(p.genome.hue,123);});
test('DNA designer rejects malformed cosmetic parameters',()=>{const s=world(),p=pet(s);s.research.level=6;p.evolution.level=22;assert(!E.editFictionalGenes(s,p.id,{hue:900,eyes:20,shape:'virus'}).ok);});
test('v1.3 retains independent actions after new day',()=>{const s=world(),p=pet(s),q=pet(s);s.research.level=5;p.actionsLeft=0;q.actionsLeft=1;const r=E.demoNext(s);assert(r.ok);assert.equal(p.actionsLeft,6);assert.equal(q.actionsLeft,6);});
test('discoveries create shareable achievements with day',()=>{const s=world();pet(s);const found=E.achievementList(s).earned;assert(found.some(x=>x.id==='first-pet'&&x.day===40));});
console.log('Trialum 1.3:',passed,'regression checks passed');
