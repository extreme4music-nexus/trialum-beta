'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const dbRows=new Map();
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
// Tiny IndexedDB request/transaction simulator, intentionally persistent across reloads.
const fakeDb={
 objectStoreNames:{contains:x=>x==='worlds'},
 createObjectStore:()=>{},
 transaction(){
  const tx={oncomplete:null,onerror:null,onabort:null};
  tx.objectStore=()=>({
   get(key){const req={onsuccess:null,onerror:null,result:null};
    queueMicrotask(()=>{req.result=clone(dbRows.get(key));req.onsuccess?.()});
    return req;},
   put(value,key){dbRows.set(key,clone(value));queueMicrotask(()=>tx.oncomplete?.());},
   delete(key){dbRows.delete(key);queueMicrotask(()=>tx.oncomplete?.());}
  });
  return tx;
 }
};
globalThis.indexedDB={
 open:()=>{const req={result:fakeDb,onsuccess:null,onerror:null,onupgradeneeded:null};
  queueMicrotask(()=>{req.onupgradeneeded?.();req.onsuccess?.()});return req;}
};
const local=new Map();
globalThis.localStorage={
 getItem:k=>local.get(k)||null,
 setItem:(k,v)=>local.set(k,v),
 removeItem:k=>local.delete(k),
 key:i=>[...local.keys()][i]||null,
 get length(){return local.size;}
};
const E=require('../js/engine.js');
globalThis.TrialumEngine=E;
require('../js/cognitive-memory.js');
require('../js/cognitive-context.js');
require('../js/memory-integrity.js');
const Restore=require('../js/private-restore.js');
const friends={rows:[{peerRef:'11111111-1111-4111-8111-111111111111',items:[]}],fail:false};
globalThis.TrialumLocalConversations={
 validateArchive:rows=>{
  if(!Array.isArray(rows)||rows.some(x=>typeof x.peerRef!=='string'||!Array.isArray(x.items)))
   throw Error('invalid_conversation_archive');
  return clone(rows);
 },
 exportAll:async()=>clone(friends.rows),
 replaceAll:async rows=>{
  if(friends.fail)return false;
  friends.rows=clone(rows);return true;
 }
};
require('../js/storage.js');
const S=globalThis.TrialumStorage,JOURNAL='private_restore_journal_v1';
const world=kind=>{const w=E.newGame('demo',12345);w.testRestoreMarker=kind;return w;};
function reset(){dbRows.clear();local.clear();friends.fail=false;friends.rows=[{peerRef:'11111111-1111-4111-8111-111111111111',items:[]}];}
test('boot detects journal after simulated crash between two separate store writes',async()=>{
 reset();
 const initial=world('BEFORE');
 assert.equal((await S.save(initial)).ok,true);
 const originalFriends=await globalThis.TrialumLocalConversations.exportAll();
 assert.equal(await S.beginPrivateRestore(initial,originalFriends),true);
 assert.equal(local.get('trialum_private_restore_pending_v1'),'1');
 assert.equal((await S.save(world('AFTER_CRASH'))).ok,true);
 friends.rows=[{peerRef:'22222222-2222-4222-8222-222222222222',items:[]}];
 assert.equal(dbRows.has(JOURNAL),true);
 // No catch/rollback was called. Model the next app launch directly.
 const loaded=await S.load();
 assert.equal(loaded.testRestoreMarker,'BEFORE');
 assert.deepEqual(friends.rows,originalFriends);
 assert.equal(dbRows.has(JOURNAL),false);
 assert.equal(local.has('trialum_private_restore_pending_v1'),false);
 assert.deepEqual(await S.recoverPrivateRestore(),{recovered:false});
});
test('boot fails closed if conversation store unavailable, and retries after recovery',async()=>{
 reset();
 const initial=world('ORIGINAL');
 await S.save(initial);
 await S.beginPrivateRestore(initial,await globalThis.TrialumLocalConversations.exportAll());
 await S.save(world('INCOMPLETE'));
 friends.fail=true;
 await assert.rejects(S.load(),/restore_recovery_incomplete/);
 assert.equal(dbRows.has(JOURNAL),true,'journal must persist after failed recovery');
 friends.fail=false;
 const restored=await S.load();
 assert.equal(restored.testRestoreMarker,'ORIGINAL');
 assert.equal(dbRows.has(JOURNAL),false);
});
test('invalid write-ahead journal is never trusted and must not overwrite live world',async()=>{
 reset();await S.save(world('SAFE'));
 dbRows.set(JOURNAL,{version:1,world:world('MALICIOUS'),
  friendConversations:[{peerRef:'bad',items:'not-an-array'}]});
 await assert.rejects(S.load(),/restore_recovery_corrupt/);
 assert.equal(dbRows.get('main').testRestoreMarker,'SAFE');
 dbRows.delete(JOURNAL);
 assert.equal((await S.load()).testRestoreMarker,'SAFE');
});
test('private restore refuses to start without durable journal; nothing is changed',async()=>{
 reset();
 let writes=0;
 await assert.rejects(Restore.run({
  world:world('INCOMING'),prepare:w=>({world:w,report:{}}),
  snapshotWorld:async()=>world('BEFORE'),
  snapshotConversations:async()=>[],
  beginJournal:async()=>false,clearJournal:async()=>true,
  applyWorld:async()=>{writes++;return true;},
  applyConversations:async()=>{writes++;return true;},
  rollbackWorld:async()=>true,rollbackConversations:async()=>true
 }),/restore_journal_unavailable/);
 assert.equal(writes,0);
});
test('journal is removed on complete restore and retained on incomplete rollback',async()=>{
 reset();let saved=world('BEFORE'),history=['old'],journal=null;
 const opts={
  world:world('AFTER'),prepare:w=>({world:w,report:{pets:0}}),
  snapshotWorld:async()=>clone(saved),snapshotConversations:async()=>clone(history),
  beginJournal:async(w,h)=>{journal={world:clone(w),friendConversations:clone(h)};return true;},
  clearJournal:async()=>{journal=null;return true;},
  applyWorld:async w=>{saved=w;return true;},
  applyConversations:async()=>{history=['new'];return true;},
  rollbackWorld:async w=>{saved=w;return true;},
  rollbackConversations:async h=>{history=h;return true;}
 };
 assert.equal((await Restore.run(opts)).ok,true);
 assert.equal(saved.testRestoreMarker,'AFTER');assert.equal(journal,null);
 // Inject failed conversation write and failed rollback. Journal must remain.
 await assert.rejects(Restore.run({...opts,
  applyConversations:async()=>false,rollbackWorld:async()=>false
 }),/restore_rollback_failed/);
 assert(journal,'recovery journal must survive failed compensating rollback');
});
 
test('temporary loss of IndexedDB during pending restore blocks all local fallback writes',async()=>{
 reset();const original=world('BEFORE');await S.save(original);
 await S.beginPrivateRestore(original,await globalThis.TrialumLocalConversations.exportAll());
 await S.save(world('AFTER_CRASH'));
 const existing=globalThis.indexedDB;
 delete globalThis.indexedDB;
 try{await assert.rejects(S.load(),/restore_recovery_incomplete/);}
 finally{globalThis.indexedDB=existing;}
 assert.equal(dbRows.has(JOURNAL),true);
 assert.equal((await S.load()).testRestoreMarker,'BEFORE');
 assert.equal(local.has('trialum_private_restore_pending_v1'),false);
});
