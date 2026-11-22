'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
globalThis.crypto=globalThis.crypto||webcrypto;
const C=require('../js/cognitive-memory.js');
const X=require('../js/cognitive-context.js');
const P=require('../js/playground-memory.js');
const E=require('../js/engine.js');
globalThis.TrialumEngine=E;
const Integrity=require('../js/memory-integrity.js');
const Restore=require('../js/private-restore.js');
const Archive=require('../js/encrypted-archive.js');
const key='ABCD'.repeat(16);
const date=(year,month,day)=>new Date(year,month-1,day,12).getTime();
function world(){
 const s=E.newGame('demo',123456);
 s.stage=6;s.biomass=2000;s.compounds=2000;
 s.habitats.push({id:'hab-1',capacity:100,minerals:{macro:60,micro:60},
  chem:{ph:7.1,temp:24,oxygen:90,toxins:5},cleanliness:90,flora:[],dayActions:4});
 s.activeHabitat='hab-1';
 assert.equal(E.createPet(s,0).ok,true);
 return s;
}
test('V44 V2 encrypted archive can be compressed, recovered, and authenticated',async()=>{
 const w=world(),pet=w.pets[0];
 X.remember(pet,{day:'2019-01-01',place:'local',topics:['music'],moments:800});
 pet.cognitiveMemory.owner.topics.guitar={count:10,firstAt:100,lastAt:200};
 const payload={archiveType:'trialum-private-migration',version:1,world:w,
  friendConversations:[],padding:'Z'.repeat(120000)};
 const text=await Archive.encrypt(payload,key),box=JSON.parse(text);
 assert.equal(box.version,2);assert.equal(box.codec,'gzip');
 assert(text.length<12000,'repetitive lifetime history should compress before encryption');
 const restored=await Archive.decrypt(text,key);
 assert.deepEqual(restored,payload);
 assert.deepEqual(Integrity.prepare(restored.world).world.pets[0].cognitiveMemory.owner.topics.guitar,
  pet.cognitiveMemory.owner.topics.guitar);
 await assert.rejects(Archive.decrypt(text,'FEDC'.repeat(16)),/wrong_key_or_damaged_archive/);
 const tampered={...box,codec:'none'};
 await assert.rejects(Archive.decrypt(JSON.stringify(tampered),key),/wrong_key_or_damaged_archive/);
});
test('AES-GCM V1 encrypted archives remain decryptable with original format',async()=>{
 const body={archiveType:'trialum-private-migration',version:1,world:world(),friendConversations:[]};
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),'PBKDF2',false,['deriveKey']);
 const derived=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:600000},
  material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode('trialum-encrypted-archive:1'),tagLength:128},
  derived,new TextEncoder().encode(JSON.stringify(body)));
 const b64=b=>Buffer.from(b).toString('base64');
 const old={format:'trialum-encrypted-archive',version:1,kdf:'PBKDF2-SHA256',
  iterations:600000,cipher:'AES-256-GCM',salt:b64(salt),iv:b64(iv),ciphertext:b64(new Uint8Array(encrypted))};
 assert.deepEqual(await Archive.decrypt(JSON.stringify(old),key),body);
});
test('preflight rejects corruption, duplicate identity and malformed receipts without mutating original',()=>{
 const w=world(),p=w.pets[0];
 C.record(p,'feed',{at:250,day:1,food:'biomass'});
 const previous=JSON.stringify(w);
 const prepared=Integrity.prepare(w);
 assert.equal(prepared.report.pets,1);
 assert.equal(JSON.stringify(w),previous,'preflight must never mutate source');
 const bad=JSON.parse(previous);bad.pets[0].cognitiveMemory.petId='another-pet';
 assert.throws(()=>Integrity.prepare(bad),e=>e.code==='INVALID_PRIVATE_MEMORY');
 const duplicated=JSON.parse(previous);duplicated.pets.push({...duplicated.pets[0]});
 assert.throws(()=>Integrity.prepare(duplicated),e=>e.code==='INVALID_PRIVATE_MEMORY');
 const hash=JSON.parse(previous);hash.pets[0].cognitiveMemory.archivedReceipts['foreign:1']='bad!';
 assert.throws(()=>Integrity.prepare(hash),e=>e.code==='INVALID_PRIVATE_MEMORY');
 assert.equal(JSON.stringify(w),previous);
});
test('packed event receipts preserve exact replays and stable JSON migration',()=>{
 const p={id:'long-lived'};
 const first={kind:'feed',source:'game',at:250,day:1,food:'biomass',quantity:3};
 for(let i=0;i<5000;i++)C.record(p,'feed',{...first,at:first.at+i});
 const before=JSON.stringify(p).length;
 const originalId=p.cognitiveMemory.eventLedger[0].eventId;
 assert.equal(C.archiveOld(p,10000),5000);
 assert.equal(p.cognitiveMemory.eventLedger.length,0);
 assert(p.cognitiveMemory.receiptRuns.length>=3);
 assert.equal(Object.keys(p.cognitiveMemory.archivedReceipts).length,0);
 assert(JSON.stringify(p).length<before*.6);
 const restored=JSON.parse(JSON.stringify(p));
 assert.equal(C.ingest(restored,{...first,eventId:originalId}).archived,true);
 assert.throws(()=>C.ingest(restored,{...first,eventId:originalId,quantity:99}),/collision/);
 assert.equal(C.ensure(restored).self.counts.feed,5000);
 // Upgrade an old V2 receipt map without dropping a previously recorded fingerprint.
 const legacy=JSON.parse(JSON.stringify(p));
 const digest=legacy.cognitiveMemory.receiptRuns[0].hashes.slice(0,16);
 legacy.cognitiveMemory.receiptRuns[0].start++;
 legacy.cognitiveMemory.receiptRuns[0].hashes=legacy.cognitiveMemory.receiptRuns[0].hashes.slice(16);
 legacy.cognitiveMemory.archivedReceipts[originalId]=digest;
 C.ensure(legacy);
 assert.equal(Object.keys(legacy.cognitiveMemory.archivedReceipts).length,0);
 assert.equal(C.ingest(legacy,{...first,eventId:originalId}).duplicate,true);
});
test('native daily semantic counters exceed 99 without losing historical moments',()=>{
 const p={id:'count-pet'},now=date(2026,11,22);
 const packet={petId:p.id,streamId:'31ed2e76-25b6-4aba-acdb-6169530f4a28',revision:1,
  entries:[{day:'2026-11-22',place:'shared',topics:['stars'],companions:['Luna'],moments:150}]};
 assert(P.ingestBackground(p,packet,now));
 assert.equal(X.context(p).days['2026-11-22|shared'].moments,150);
 assert(P.remember(p,{place:'shared',said:'stars',now}));
 assert.equal(X.context(p).days['2026-11-22|shared'].moments,151);
 assert.equal(P.ingestBackground(p,packet,now),false);
});
test('two-store restore rolls back complete prior world and conversations when second store fails',async()=>{
 const source=world(),previous=JSON.parse(JSON.stringify(source));
 const incoming=JSON.parse(JSON.stringify(source));incoming.pets[0].name='Transferred';
 let stored=JSON.parse(JSON.stringify(source)),friends=[{id:'old'}];
 const result=()=>JSON.stringify(stored)+'|'+JSON.stringify(friends),original=result();
 await assert.rejects(Restore.run({
  world:incoming,prepare:w=>Integrity.prepare(w),
  snapshotWorld:async()=>JSON.parse(JSON.stringify(stored)),
  snapshotConversations:async()=>JSON.parse(JSON.stringify(friends)),
  applyWorld:async w=>{stored=w;return true;},
  applyConversations:async()=>{friends=[{id:'partial'}];return false;},
  rollbackWorld:async old=>{stored=old;return true;},
  rollbackConversations:async old=>{friends=old;return true;}
 }),/restore_failed_rolled_back/);
 assert.equal(result(),original);
 assert.deepEqual(previous,source);
});
test('restore refuses incomplete rollback rather than claiming consistency',async()=>{
 const source=world();
 await assert.rejects(Restore.run({
  world:source,prepare:w=>Integrity.prepare(w),
  snapshotWorld:async()=>source,snapshotConversations:async()=>[],
  applyWorld:async()=>true,applyConversations:async()=>false,
  rollbackWorld:async()=>false,rollbackConversations:async()=>true
 }),/restore_rollback_failed/);
});
