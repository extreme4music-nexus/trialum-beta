/* App-private friend conversation history. Network transport is separate from this local archive. */
(function(root){
'use strict';
const DB='trialum-local-conversations-v1',STORE='threads',LIMIT=300,KEY='trialum_local_thread_';
let dbPromise=null;
const validRef=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
function validEntry(x){
 if(!x||typeof x!=='object'||typeof x.id!=='string'||!/^[-0-9a-f]{36}$/i.test(x.id)||typeof x.text!=='string')return null;
 return {id:x.id.slice(0,64),mine:x.mine===true,text:x.text.slice(0,120),kind:x.kind==='preset'?'preset':'text',
  at:Number.isFinite(Number(x.at))?Number(x.at):Date.now(),peerName:String(x.peerName||'Пријател').slice(0,32),
  delivery:['pending','sent','failed'].includes(x.delivery)?x.delivery:'sent',read:x.read===true};
}
function open(){
 if(dbPromise)return dbPromise;
 dbPromise=new Promise((resolve,reject)=>{
  if(!root.indexedDB)return reject(Error('indexeddb_unavailable'));
  const req=root.indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'peerRef'});};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('indexeddb_error'));
 });
 return dbPromise;
}
function fallbackGet(ref){try{const value=JSON.parse(root.localStorage?.getItem(KEY+ref)||'[]');return Array.isArray(value)?value.map(validEntry).filter(Boolean).slice(-LIMIT):[];}catch(_){return [];}}
async function get(peerRef){
 if(!validRef(peerRef))return [];
 try{const db=await open();return await new Promise((resolve,reject)=>{const r=db.transaction(STORE,'readonly').objectStore(STORE).get(peerRef);r.onsuccess=()=>resolve((Array.isArray(r.result?.items)?r.result.items:fallbackGet(peerRef)).map(validEntry).filter(Boolean).slice(-LIMIT));r.onerror=()=>reject(r.error);});}
 catch(_){return fallbackGet(peerRef);}
}
async function put(peerRef,items){
 if(!validRef(peerRef))return false;
 const safe=(Array.isArray(items)?items:[]).map(validEntry).filter(Boolean).slice(-LIMIT);
 try{const db=await open();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({peerRef,items:safe});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});return true;}
 catch(_){try{root.localStorage?.setItem(KEY+peerRef,JSON.stringify(safe));return true;}catch(_){return false;}}
}
async function append(peerRef,item){
 const entry=validEntry(item);if(!entry||!validRef(peerRef))return false;
 const items=await get(peerRef);if(items.some(x=>x.id===entry.id))return true;
 items.push(entry);return put(peerRef,items);
}
async function update(peerRef,id,patch){
 const items=await get(peerRef),index=items.findIndex(x=>x.id===id);if(index<0)return false;
 items[index]=validEntry({...items[index],...patch});return put(peerRef,items);
}
async function remove(peerRef,id){return put(peerRef,(await get(peerRef)).filter(x=>x.id!==id));}
async function clear(peerRef){
 if(!validRef(peerRef))return false;
 try{const db=await open();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(peerRef);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}catch(_){}
 try{root.localStorage?.removeItem(KEY+peerRef);}catch(_){}
 return true;
}
async function exportAll(){
 try{
  const db=await open();
  const rows=await new Promise((resolve,reject)=>{
   const r=db.transaction(STORE,'readonly').objectStore(STORE).getAll();
   r.onsuccess=()=>resolve((r.result||[]).filter(x=>validRef(x?.peerRef)).map(x=>({
    peerRef:x.peerRef,items:(Array.isArray(x.items)?x.items:[]).map(validEntry).filter(Boolean).slice(-LIMIT)
   })));
   r.onerror=()=>reject(r.error);
  });
  const known=new Set(rows.map(x=>x.peerRef));
  for(const row of fallbackRows())if(!known.has(row.peerRef))rows.push(row);
  return rows;
 }catch(_){
  return fallbackRows();
 }
}
function fallbackRows(){
 const out=[];try{for(let i=0;i<root.localStorage.length;i++){
  const key=root.localStorage.key(i);if(!key?.startsWith(KEY))continue;
  const peerRef=key.slice(KEY.length);if(validRef(peerRef))out.push({peerRef,items:fallbackGet(peerRef)});
 }}catch(_){}return out;
}
function validateArchive(input){
 if(!Array.isArray(input)||input.length>5000)throw Error('invalid_conversation_archive');
 const seen=new Set();
 return input.map(row=>{
  if(!validRef(row?.peerRef)||seen.has(row.peerRef)||!Array.isArray(row.items)||row.items.length>LIMIT)throw Error('invalid_conversation_archive');
  seen.add(row.peerRef);const items=row.items.map(validEntry);
  if(items.some(item=>!item))throw Error('invalid_conversation_archive');
  return {peerRef:row.peerRef,items};
 });
}
async function replaceAll(input){
 const archive=validateArchive(input);
 try{
  const db=await open();
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
   store.clear();for(const row of archive)store.put(row);
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('conversation_restore_aborted'));
  });
  try{for(let i=root.localStorage.length-1;i>=0;i--){const key=root.localStorage.key(i);if(key?.startsWith(KEY))root.localStorage.removeItem(key);}}catch(_){}
  return true;
 }catch(_){
  // Do not silently claim success when the primary store is unavailable.
  try{
   for(let i=root.localStorage.length-1;i>=0;i--){const key=root.localStorage.key(i);if(key?.startsWith(KEY))root.localStorage.removeItem(key);}
   for(const row of archive)root.localStorage.setItem(KEY+row.peerRef,JSON.stringify(row.items));
   return true;
  }catch(__){return false;}
 }
}
root.TrialumLocalConversations={validRef,get,put,append,update,remove,clear,exportAll,replaceAll,validateArchive,LIMIT};
if(typeof module==='object'&&module.exports)module.exports=root.TrialumLocalConversations;
})(typeof globalThis!=='undefined'?globalThis:this);
