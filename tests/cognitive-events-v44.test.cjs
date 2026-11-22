const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../js/cognitive-memory.js');

test('every future pet receives its own V2 ledger without a model or species allowlist',()=>{
 for(const species of [0,9,13,400]){
  const pet={id:'future-'+species,name:'Future '+species,species,birthDay:5};
  const m=M.ensure(pet);
  assert.equal(m.version,2);
  assert.equal(m.petId,pet.id);
  assert.deepEqual(m.eventLedger,[]);
  assert.equal(pet.mind,undefined);
  M.record(pet,'birth',{day:5,at:1000,location:'hab-1'});
  assert.equal(m.eventLedger[0].petId,pet.id);
  assert.equal(m.eventLedger[0].source,'game');
  assert.equal(m.eventLedger[0].eventId,'event:1');
 }
});

test('event replays are idempotent across JSON process restarts',()=>{
 const a={id:'a'},evt={eventId:'android:stream-1:17',kind:'feed',source:'native-background',at:1700,day:2,food:'biomass',quantity:3};
 assert.equal(M.ingest(a,evt).inserted,true);
 assert.equal(M.ingest(a,evt).duplicate,true);
 assert.equal(M.ensure(a).self.counts.feed,1);
 const restored=JSON.parse(JSON.stringify(a));
 assert.equal(M.ingest(restored,evt).inserted,false);
 assert.equal(M.ensure(restored).self.days['2'].counts.feed,1);
 assert.equal(M.ensure(restored).eventLedger.length,1);
 assert.throws(()=>M.ingest(restored,{...evt,quantity:100}),/collision/);
 assert.equal(M.ensure(restored).eventLedger.length,1);
 assert.equal(M.ensure(restored).self.counts.feed,1);
 const other={id:'b'};
 assert.equal(M.ingest(other,evt).inserted,true);
 assert.equal(M.ensure(other).eventLedger[0].petId,'b');
});

test('V1 cognitive data migrates without fabricated historical events',()=>{
 const p={id:'legacy',birthDay:11};
 M.topic(p,'music',400);
 M.record(p,'wash',{at:500,day:14});
 const historical=JSON.parse(JSON.stringify(p.cognitiveMemory));
 historical.version=1;
 delete historical.schemaVersion;delete historical.eventLedger;delete historical.eventSerial;
 delete historical.migrationMetadata;
 p.cognitiveMemory=historical;
 const oldTopics=historical.owner.topics.music.count;
 const oldWash=historical.self.counts.wash;
 const m=M.ensure(p);
 assert.equal(m.version,2);
 assert.equal(m.migrationMetadata.origin,'v1');
 assert.equal(m.migrationMetadata.historicalEventsReconstructed,false);
 assert.equal(m.birthDay,11);
 assert.equal(m.self.counts.wash,oldWash);
 assert.equal(m.owner.topics.music.count,oldTopics);
 assert.deepEqual(m.eventLedger,[]);
 M.record(p,'play',{day:15,at:600});
 assert.equal(m.eventLedger.length,1);
 assert.equal(m.eventLedger[0].eventId,'event:1');
});

test('world migration preserves unknown histories and does not invent a birth event',()=>{
 const s={pets:[{id:'pet-1',species:0,birthDay:2},{id:'pet-2',species:999,birthDay:3}]};
 M.ensureWorld(s);
 assert.equal(s.pets[1].cognitiveMemory.birthDay,3);
 assert.equal(s.pets[1].cognitiveMemory.migrationMetadata.origin,'legacy-world');
 assert.equal(s.pets[0].cognitiveMemory.eventLedger.length,0);
 assert.notEqual(s.pets[0].cognitiveMemory,s.pets[1].cognitiveMemory);
 assert.throws(()=>M.ensureWorld({pets:[{id:'x',cognitiveMemory:{version:2,petId:'other'}}]}),/identity/);
});

test('invalid observations fail without mutating counters or event indexes',()=>{
 const p={id:'x'};
 M.ensure(p);
 const bad=[
  {kind:'feed',eventId:'__proto__',at:5},
  {kind:'feed',source:'unknown source',at:5},
  {kind:'feed',at:Infinity},
  {kind:'feed',at:5,day:1.5},
  {kind:'feed',at:5,quantity:-3},
  {kind:'transfer',at:5,location:'__proto__'}
 ];
 for(const event of bad)assert.throws(()=>M.ingest(p,event));
 assert.equal(M.ensure(p).eventLedger.length,0);
 assert.equal(Object.keys(M.ensure(p).self.counts).length,0);
 M.record(p,'feed',{day:2,at:10,food:'biomass',quantity:3});
 assert.equal(M.awareness(p).lastMeal.quantity,3);
 assert.equal(M.ensure(p).eventLedger.length,1);
});

test('persisted invalid or duplicated ledger entries fail closed on hydration',()=>{
 const p={id:'pet-a'};
 M.record(p,'feed',{day:1,at:42,quantity:3});
 const cloned=JSON.parse(JSON.stringify(p));
 cloned.cognitiveMemory.eventLedger.push({...cloned.cognitiveMemory.eventLedger[0]});
 assert.throws(()=>M.ensure(cloned),/corrupt cognitive event ledger/);
 const wrong=JSON.parse(JSON.stringify(p));
 wrong.cognitiveMemory.eventLedger[0].petId='another-pet';
 assert.throws(()=>M.ensure(wrong),/corrupt cognitive event ledger/);
 // Original remains valid and can continue recording.
 assert.equal(M.ensure(p).eventLedger.length,1);
});
