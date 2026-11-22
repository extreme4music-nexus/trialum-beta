'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const rows=new Map(),cache=new Map();
let failPrimary=false,failFallbackCleanup=false;
const peerA='11111111-1111-4111-8111-111111111111',peerB='22222222-2222-4222-8222-222222222222';
const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
function fakeDatabase(){
 return {
  objectStoreNames:{contains:s=>s==='threads'},
  createObjectStore:()=>{},
  transaction(){
   if(failPrimary)throw Error('idb_failed');
   const tx={oncomplete:null,onerror:null,onabort:null};
   let queued=false;
   const complete=()=>{if(!queued){queued=true;queueMicrotask(()=>tx.oncomplete?.());}};
   tx.objectStore=()=>({
    clear(){rows.clear();complete();},
    put(value){rows.set(value.peerRef,clone(value));complete();},
    get(key){const req={result:null,onsuccess:null,onerror:null};
     queueMicrotask(()=>{req.result=clone(rows.get(key));req.onsuccess?.()});return req;},
    getAll(){const req={result:null,onsuccess:null,onerror:null};
     queueMicrotask(()=>{req.result=clone([...rows.values()]);req.onsuccess?.()});return req;}
   });
   return tx;
  }
 };
}
const db=fakeDatabase();
globalThis.indexedDB={open:()=>{const req={result:db,onupgradeneeded:null,onsuccess:null,onerror:null};
 queueMicrotask(()=>{req.onupgradeneeded?.();req.onsuccess?.()});return req;}};
globalThis.localStorage={
 getItem:k=>cache.get(k)||null,setItem:(k,v)=>cache.set(k,v),
 removeItem:k=>{if(failFallbackCleanup)throw Error('fallback_remove_failed');cache.delete(k);},
 key:i=>[...cache.keys()][i]??null,
 get length(){return cache.size;}
};
const LC=require('../js/local-conversations.js');
function reset(){rows.clear();cache.clear();failPrimary=false;failFallbackCleanup=false;}
test('replacing private friend archive atomically updates primary and removes stale fallback',async()=>{
 reset();
 rows.set(peerA,{peerRef:peerA,items:[]});
 cache.set('trialum_local_thread_'+peerA,'[]');
 const newRows=[{peerRef:peerB,items:[]}];
 assert.equal(await LC.replaceAll(newRows),true);
 assert.equal(rows.has(peerA),false);
 assert.equal(cache.size,0);
 assert.deepEqual(await LC.exportAll(),newRows);
 assert.deepEqual(await LC.get(peerA),[]);
});
test('private restore does not claim success when IndexedDB write failed',async()=>{
 reset();
 const old=[{peerRef:peerA,items:[]}];
 rows.set(peerA,old[0]);failPrimary=true;
 assert.equal(await LC.replaceAll([{peerRef:peerB,items:[]}]),false);
 assert.equal(rows.has(peerA),true);
 assert.equal(rows.has(peerB),false);
});
test('stale fallback cleanup failure causes restore failure instead of resurrecting old data',async()=>{
 reset();
 cache.set('trialum_local_thread_'+peerA,'[]');
 failFallbackCleanup=true;
 assert.equal(await LC.replaceAll([{peerRef:peerB,items:[]}]),false);
 assert.equal(cache.has('trialum_local_thread_'+peerA),true);
 // The caller must invoke the V44 journaled rollback before continuing.
});
