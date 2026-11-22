'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../js/cognitive-memory.js');
const E=require('../js/engine.js');
require('../js/evolution.js');require('../js/progression.js');require('../js/longplay.js');
require('../js/fauna-lab.js');
const Cap=require('../js/pet-ai-capabilities.js');
function pet(species,level){
 const p={id:'pet-'+species,name:'Creature',species,birthDay:1,ageDays:5000,seed:31};
 E.ensureEvolution(p);p.evolution.level=level;return p;
}
function world(lab=25){return {research:{level:lab},longplay:{invented:[]}};}
test('unconditional lifelong memory exists on primitive species without model, consent, account or unlock',()=>{
 const p=pet(0,1),s=world(0);
 assert.equal(Cap.unlocked(s,p,'mini'),false);
 assert.equal(Cap.unlocked(s,p,'advanced'),false);
 assert.equal(p.mind,undefined);
 C.record(p,'feed',{at:100,day:1,food:'biomass'});
 assert.equal(Cap.memory(p).self.last.feed.food,'biomass');
 assert.equal(C.ensure(JSON.parse(JSON.stringify(p))).self.counts.feed,1);
});
test('existing evolved species use declared capabilities; unlocking requires earned levels and research',()=>{
 const s=world(6),mini=pet(4,21);
 assert.equal(E.SPECIES[4].aiAbilities.mini.petLevel,22);
 assert.equal(Cap.unlocked(s,mini,'mini'),false);
 mini.evolution.level=22;assert.equal(Cap.unlocked(s,mini,'mini'),true);
 assert.equal(Cap.unlocked(s,mini,'advanced'),false);
 s.research.level=20;const advanced=pet(9,165);
 assert.equal(Cap.unlocked(s,advanced,'advanced'),true);
 assert.equal(Cap.unlocked(s,advanced,'mini'),true);
 advanced.evolution.level=164;assert.equal(Cap.unlocked(s,advanced,'advanced'),false);
});
test('future procedurally researched children inherit parent communication, not numeric index',()=>{
 const s=world(25);
 E.SPECIES[15]={name:'Future Child',parentSpecies:9,procedural:true};
 E.SPECIES[3].aiAbilities=undefined;
 try{
  const child=pet(15,165);
  assert.equal(Cap.unlocked(s,child,'advanced'),true);
  E.SPECIES[17]={name:'Future Primitive',parentSpecies:1,procedural:true};
  assert.equal(Cap.unlocked(s,pet(17,250),'advanced'),false);
  E.SPECIES[2].aiAbilities={mini:{petLevel:10,labLevel:2},advanced:{petLevel:40,labLevel:8}};
  assert.equal(Cap.unlocked(s,pet(2,40),'advanced'),true,'new abilities can be declared at any species index');
 }finally{E.SPECIES.length=11;delete E.SPECIES[2].aiAbilities;delete E.SPECIES[3].aiAbilities;}
});
test('switching or disabling a model does not reset the memory store',()=>{
 const p=pet(9,170),m=C.ensure(p);
 C.topic(p,'music',100);C.record(p,'play',{at:101,day:1});
 p.mind={enabled:true,tier:'compact'};
 p.mind.tier='deep';p.mind.enabled=false;
 assert.strictEqual(Cap.memory(p),m);
 assert.equal(m.owner.topics.music.count,1);
 assert.equal(m.eventLedger.length,1);
});
