const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../js/cognitive-memory.js');
const E=require('../js/engine.js');
globalThis.TrialumEngine=E;
require('../js/evolution.js');
require('../js/storage.js');

function world(){
 const s=E.newGame('demo',123456);
 s.stage=6;s.biomass=1000;s.compounds=1000;
 const h={id:'hab-1',capacity:100,minerals:{macro:60,micro:60},chem:{ph:7.1,temp:24,oxygen:90,toxins:5},cleanliness:90,flora:[],dayActions:4};
 s.habitats.push(h);s.activeHabitat=h.id;
 return s;
}

test('game engine produces per-pet care and every evolution milestone without AI',()=>{
 const s=world();
 assert.equal(E.createPet(s,0).ok,true);
 const p=s.pets[0];
 assert.equal(p.cognitiveMemory.version,2);
 assert.equal(p.cognitiveMemory.eventLedger[0].kind,'birth');
 assert.equal(E.petCare(s,p.id,'feed').ok,true);
 assert.equal(C.awareness(p).lastMeal.food,'biomass');
 assert.equal(C.awareness(p).lastMeal.quantity,3);
 p.ageDays=5000;
 const leveled=E.evolutionGain(s,p,1000,'test milestone');
 assert.ok(leveled>0);
 const events=C.ensure(p).eventLedger.filter(x=>x.kind==='evolution');
 assert.equal(events.length,leveled);
 assert.equal(events.at(-1).level,E.evolutionProgress(p).level);
 assert.ok(events.every(x=>x.source==='game'&&x.eventId));
});

test('offline local storage retains private cognitive ledger; portable snapshot strips it',async()=>{
 const s=world();
 const kv=new Map();
 globalThis.localStorage={getItem:key=>kv.get(key)||null,setItem:(key,value)=>kv.set(key,value),removeItem:key=>kv.delete(key)};
 assert.equal(E.createPet(s,0).ok,true);
 const p=s.pets[0];
 C.topic(p,'music',100);
 const stored=await globalThis.TrialumStorage.save(s);
 assert.equal(stored.ok,true);
 const copy=await globalThis.TrialumStorage.load();
 assert.equal(C.ensure(copy.pets[0]).eventLedger.length,1);
 assert.equal(C.ensure(copy.pets[0]).owner.topics.music.count,1);
 const plain=globalThis.TrialumStorage.portableSnapshot(copy);
 assert.equal(plain.pets[0].cognitiveMemory,undefined);
 assert.equal(C.ensure(copy.pets[0]).eventLedger.length,1);
});

test('legacy pets get an empty truthful ledger when hydrated before saving',async()=>{
 const s=world();
 s.pets.push({id:'older',species:0,birthDay:3,habitatId:'hab-1',growth:1});
 const kv=new Map();
 globalThis.localStorage={getItem:key=>kv.get(key)||null,setItem:(key,value)=>kv.set(key,value),removeItem:key=>kv.delete(key)};
 const r=await globalThis.TrialumStorage.save(s);
 assert.equal(r.ok,true);
 assert.equal(s.pets[0].cognitiveMemory.migrationMetadata.historicalEventsReconstructed,false);
 assert.equal(s.pets[0].cognitiveMemory.eventLedger.length,0);
 assert.equal((await globalThis.TrialumStorage.load()).pets[0].cognitiveMemory.petId,'older');
});
