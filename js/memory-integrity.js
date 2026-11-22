/* V44 private world preflight and memory-size report.
 * Run on a detached JSON clone, never mutate the original on failed restore.
 */
(function(root){
'use strict';
const MAX_PETS=1000,MAX_EVENTS_PER_PET=150000,MAX_RECEIPTS_PER_PET=750000;
const MAX_CONTEXT_BUCKETS=12000,MAX_FRIENDS_PER_PET=10000,MAX_WORLD_BYTES=64*1024*1024;
const bytes=v=>new TextEncoder().encode(JSON.stringify(v)).length;
const invalid=reason=>{const e=Error(reason);e.code='INVALID_PRIVATE_MEMORY';throw e;};
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
const safeId=s=>typeof s==='string'&&s.length>=1&&s.length<=160&&
 /^[A-Za-z0-9:_./-]+$/.test(s)&&!['__proto__','constructor','prototype'].includes(s);
const safeBucket=s=>typeof s==='string'&&
 /^\d{4}(-\d{2}){0,2}\|(local|shared)$/.test(s);
function validatePet(p){
 if(!plain(p)||typeof p.id!=='string'||!p.id||p.id.length>128)invalid('invalid pet id');
 const m=p.cognitiveMemory;
 if(!plain(m)||m.petId!==p.id||m.version!==2||m.schemaVersion!==2)invalid('invalid pet cognitive schema or id');
 if(!Array.isArray(m.eventLedger)||m.eventLedger.length>MAX_EVENTS_PER_PET||!plain(m.archivedReceipts))
  invalid('invalid per-pet event indexes');
 if(Object.keys(m.archivedReceipts).length>MAX_RECEIPTS_PER_PET)invalid('too many archived event receipts');
 if(!Array.isArray(m.receiptRuns)||m.receiptRuns.length>MAX_RECEIPTS_PER_PET)invalid('invalid packed receipt index');
 let previousEnd=0,packed=0;
 for(const run of [...m.receiptRuns].sort((a,b)=>a.start-b.start)){
  if(!plain(run)||!Number.isSafeInteger(run.start)||run.start<=previousEnd||
    typeof run.hashes!=='string'||run.hashes.length===0||run.hashes.length%16||
    run.hashes.length>32768||!/^[a-f0-9]+$/.test(run.hashes))
   invalid('overlapping or corrupt packed replay receipts');
  packed+=run.hashes.length/16;
  previousEnd=run.start+run.hashes.length/16-1;
 }
 if(packed+Object.keys(m.archivedReceipts).length>MAX_RECEIPTS_PER_PET)
  invalid('too many lifetime event receipts');
 for(const [id,hash] of Object.entries(m.archivedReceipts))
  if(!safeId(id)||typeof hash!=='string'||!/^[a-f0-9]{16}$/.test(hash))invalid('invalid archived receipt');
 const ctx=m.contextual;
 if(ctx!==undefined){
  if(!plain(ctx))invalid('invalid contextual data');
  for(const bucket of ['days','months','years']){
   const rows=ctx[bucket];
   if(!plain(rows)||Object.keys(rows).length>MAX_CONTEXT_BUCKETS)invalid('invalid context buckets');
   for(const [key,entry] of Object.entries(rows)){
    if(!safeBucket(key)||!plain(entry)||!Number.isSafeInteger(entry.moments)||
      entry.moments<0||!Array.isArray(entry.topics)||!Array.isArray(entry.companions)||
      entry.topics.length>16||entry.companions.length>3)invalid('invalid contextual record');
   }
  }
  if(!plain(ctx.nativeStreams)||Object.keys(ctx.nativeStreams).length>MAX_FRIENDS_PER_PET)
   invalid('invalid native stream watermark');
 }
 if(!plain(m.owner)||!plain(m.owner.topics)||!plain(m.social)||!plain(m.social.peers)||
   Object.keys(m.social.peers).length>MAX_FRIENDS_PER_PET)invalid('invalid social memory');
}
function inspect(world){
 if(!plain(world)||!Array.isArray(world.pets)||world.pets.length>MAX_PETS)invalid('invalid private world');
 const ids=new Set();let events=0,receipts=0;
 for(const pet of world.pets){
  validatePet(pet);
  if(ids.has(pet.id))invalid('duplicate pet identity');ids.add(pet.id);
  events+=pet.cognitiveMemory.eventLedger.length;
  receipts+=Object.keys(pet.cognitiveMemory.archivedReceipts).length+
   pet.cognitiveMemory.receiptRuns.reduce((n,run)=>n+run.hashes.length/16,0);
 }
 return {schema:2,pets:world.pets.length,events,receipts,
  bytes:bytes(world)};
}
function prepare(world){
 if(!root.TrialumEngine?.validate?.(world))invalid('invalid world data');
 let json;try{json=JSON.stringify(world);}catch(_){invalid('world is not serializable');}
 if(new TextEncoder().encode(json).length>MAX_WORLD_BYTES)invalid('private world too large');
 const copy=JSON.parse(json);
 try{root.TrialumCognitiveMemory?.ensureWorld?.(copy);}catch(_){invalid('corrupt cognitive source');}
 const report=inspect(copy);
 if(report.bytes>MAX_WORLD_BYTES)invalid('private world too large after migration');
 return {world:copy,report};
}
const api={prepare,inspect,MAX_WORLD_BYTES};
root.TrialumMemoryIntegrity=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
