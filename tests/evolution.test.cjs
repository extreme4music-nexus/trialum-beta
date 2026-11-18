/* Regression tests for Trialum 1.2 (Node 18+, no dependencies). */
'use strict';
const assert=require('node:assert/strict');
const E=require('../js/engine.js');
require('../js/evolution.js');
const P=require('../js/peer.js');
let passed=0;
function test(name,fn){try{fn();passed++;console.log('✓',name)}catch(e){console.error('FAIL',name);throw e}}
function world(){const s=E.newGame('demo',1700000000000);s.stage=6;s.biomass=1000;s.compounds=200;s.habitats=[{id:'hab-1',name:'Test lagoon',biome:'lagoon',capacity:50,minerals:{macro:60,micro:60},chem:{ph:7.1,temp:24,oxygen:90,toxins:2},cleanliness:92,flora:[],dayActions:4,bornDay:1}];s.activeHabitat='hab-1';return s}
test('new worlds migrate to v1.2',()=>{const s=E.newGame('demo');assert.equal(s.version,'1.2.0');assert(E.validate(s))});
test('v1.1 worlds remain loadable',()=>{const s=E.newGame('demo');s.version='1.1.0';assert(E.validate(s));E.ensureEvolutionWorld(s);assert.equal(s.version,'1.2.0')});
test('new pet has its own evolution and weights',()=>{const s=world();assert(E.createPet(s,0).ok);assert.equal(E.evolutionProgress(s.pets[0]).level,1);assert.equal(s.pets[0].evolution.brain.hidden.length,6)});
test('4 care actions are independent per pet',()=>{const s=world();E.createPet(s,0);E.createPet(s,1);const [a,b]=s.pets;for(let i=0;i<4;i++)assert(E.petCare(s,a.id,'talk').ok);assert.equal(a.actionsLeft,0);assert.equal(b.actionsLeft,4)});
test('learning updates actual neural network weights',()=>{const s=world();E.createPet(s,0);const p=s.pets[0],before=JSON.stringify(p.evolution.brain.out);assert(E.petCare(s,p.id,'play').ok);assert.notEqual(JSON.stringify(p.evolution.brain.out),before);assert.equal(p.evolution.trained,1)});
test('age gates prevent instant evolutionary levels',()=>{const s=world();E.createPet(s,0);const p=s.pets[0];E.evolutionGain(s,p,99999,'test');assert.equal(E.evolutionProgress(p).level,1)});
test('pet reaches limbs and keeps neurons after enough days',()=>{const s=world();E.createPet(s,0);const p=s.pets[0];for(let i=0;i<14;i++){E.demoNext(s);E.petCare(s,p.id,'play');}E.evolutionGain(s,p,400,'test');assert(E.evolutionProgress(p).level>=3);assert(E.evolutionProgress(p).limbs>=2);assert(p.evolution.brain.trained>=14)});
test('each pet has independent XP',()=>{const s=world();E.createPet(s,0);E.createPet(s,1);const [a,b]=s.pets;E.petCare(s,a.id,'talk');assert(a.evolution.earned>b.evolution.earned)});
test('offline advancement never duplicates evolution XP',()=>{const s=world();E.createPet(s,0);E.demoNext(s);const xp=s.pets[0].evolution.earned;E.advance(s);assert.equal(s.pets[0].evolution.earned,xp)});
test('a friend visit grants XP only once per day',()=>{const s=world();E.createPet(s,0);const id=s.pets[0].id;assert(E.socialize(s,id,'friend-1').ok);assert.equal(E.socialize(s,id,'friend-1').ok,false);assert(E.socialize(s,id,'friend-2').ok)});
test('friend list persists only explicitly added friend',()=>{const s=world();assert.equal(s.friends.length,0);assert(E.addFriend(s,'remote','Friend'));assert.equal(s.friends.length,1);assert(!E.addFriend(s,s.peerId,'Me'))});
test('P2P offer and answer validate shape and size',()=>{const offer=P.code('offer',{type:'offer',sdp:'fake'});assert.equal(P.parse(offer,'offer').sdp,'fake');assert.throws(()=>P.parse(offer,'answer'));assert.throws(()=>P.parse('x'.repeat(64001),'offer'))});
test('remote pet profiles are size and value bounded',()=>{const g=P.safeGuest({id:'peer',name:'A'.repeat(200),pet:{name:'P',species:200,hue:800,growth:700,level:10000}});assert.equal(g.name.length,32);assert.equal(g.pet.species,3);assert.equal(g.pet.level,250)});
console.log('TRIALUM 1.2:',passed,'checks passed');
