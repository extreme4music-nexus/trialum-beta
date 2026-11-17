/* Offline-first persistence. IndexedDB primary, localStorage mirrored fallback.
   Full chronological log remains part of the saved state and export. */
(function(root){
'use strict';
const E=()=>root.TrialumEngine, DB='trialum-world-v11',KEY='trialum_state_v1_1', LEGACY='trialum_ziva_iskra_v1';let dbPromise,writeTail=Promise.resolve();
function openDb(){if(dbPromise)return dbPromise;dbPromise=new Promise((resolve,reject)=>{if(!('indexedDB'in root))return reject(Error('IndexedDB unavailable'));const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('worlds'))r.result.createObjectStore('worlds');};r.onerror=()=>reject(r.error||Error('IDB'));r.onsuccess=()=>resolve(r.result);});return dbPromise;}
async function dbRead(){const db=await openDb();return new Promise((resolve,reject)=>{const t=db.transaction('worlds','readonly');const r=t.objectStore('worlds').get('main');r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}
async function dbWrite(s){const db=await openDb();return new Promise((resolve,reject)=>{const t=db.transaction('worlds','readwrite');t.objectStore('worlds').put(s,'main');t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);});}
function legacyConvert(old){if(!old||old.version!==1||!old.atoms||!Array.isArray(old.pets))return null;const e=E(),s=e.newGame(old.mode,old.createdAt||Date.now());s.stage=Math.min(7,Math.max(0,old.stage||0));s.insight=Math.max(8,old.research||0);s.compounds= Math.max(18,Math.round(((old.mol||{}).F||0)+((old.mol||{}).L||0)*2));s.biomass=35;s.energy=Math.min(100,old.energy||70);s.cells=old.cells|| (s.stage>2?12:0);for(const el of Object.keys(s.elements))s.elements[el]=Math.max(s.elements[el],Number(old.atoms[el])||0);s.demoDay=old.mode==='demo'?Math.max(1,1+(old.demoDays||0)):1;s.lastDay=old.mode==='demo'?s.demoDay:Math.max(1,Math.floor((Date.now()-(old.createdAt||Date.now()))/e.DAY_MS)+1);s.labActions=5;
 if(s.stage>=6){const h={id:'hab-legacy',name:'Луминозен залив · наследство',biome:'lagoon',capacity:14,minerals:{macro:65,micro:60},chem:{ph:7.1,temp:24,oxygen:83,toxins:6},cleanliness:85,flora:[],dayActions:4,bornDay:s.lastDay};s.habitats.push(h);s.activeHabitat=h.id;for(let i=0;i<old.pets.length;i++){const p=old.pets[i],species=Math.min(3,Math.max(0,Number(p.shape)||0));s.pets.push({id:'pet-legacy-'+i,species,name:String(p.name||'Лумира'),habitatId:h.id,hue:Number(p.hue)||E().SPECIES[species].hue,seed:i*133+42,eyes:Number(p.eyes)||2,shape:E().SPECIES[species].shape,birthDay:Number(p.birthday)||s.lastDay,ageDays:0,growth:Math.min(100,Number(p.growth)||5),satiety:Number(p.hunger)||65,joy:Number(p.joy)||65,energy:Number(p.stamina)||70,clean:Number(p.clean)||75,bond:Number(p.bond)||30,actionsLeft:4,mood:'Мирно',language:'лу-ми'});}s.selectedPet=s.pets[0]?.id||null;}
 // retain full earlier event history in chronological order
 s.logs=[];s.sequence=9999;for(const entry of [...(old.logs||[])].reverse()){s.logs.push({id:'legacy-log-'+(++s.sequence),day:entry.day||1,at:typeof entry.at==='number'?new Date(entry.at).toISOString():new Date().toISOString(),kind:entry.type||'legacy',text:String(entry.text||'')});}E().log(s,'🔄 Светот е пренесен од ТРИАЛУМ 1.0.');return s;}
async function load(){let state=null;try{state=await dbRead()}catch(_){}if(E().validate(state))return state;
 try{state=JSON.parse(localStorage.getItem(KEY)||'null');if(E().validate(state))return state;}catch(_){}
 try{const old=JSON.parse(localStorage.getItem(LEGACY)||'null');const s=legacyConvert(old);if(s){await save(s);return s;}}catch(_){}
 return null;}
// Capture each world at the moment a save is requested, then serialize writes.
// Without this queue a pending IndexedDB write could resurrect an older world
// after a confirmed backup restore or New Game operation.
function orderedWrite(work){
 const pending=writeTail.then(work);
 writeTail=pending.then(()=>{},()=>{});
 return pending;
}
async function save(s){
 if(!E().validate(s))return {ok:false,backend:'invalid_world'};
 // JSON snapshot matches export format; never let a later UI mutation alter an
 // already scheduled IndexedDB transaction.
 let snapshot;
 try{snapshot=JSON.parse(JSON.stringify(s));}
 catch(_){return {ok:false,backend:'invalid_world'};}
 return orderedWrite(async()=>{
  let idb=false,local=false;
  try{await dbWrite(snapshot);idb=true;}catch(_){}
  try{localStorage.setItem(KEY,JSON.stringify(snapshot));local=true;}catch(_){}
  return {ok:idb||local,backend:idb?'IndexedDB':local?'localStorage':'none'};
 });
}
async function clear(){
 return orderedWrite(async()=>{
  let idb=false,local=false;
  try{
   const db=await openDb();
   await new Promise((resolve,reject)=>{
    const tx=db.transaction('worlds','readwrite');
    tx.objectStore('worlds').delete('main');
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
   });idb=true;
  }catch(_){}
  try{localStorage.removeItem(KEY);localStorage.removeItem(LEGACY);local=true;}catch(_){}
  return {ok:idb||local,backend:idb?'IndexedDB':local?'localStorage':'none'};
 });
}
function parseImport(text){
 let raw;
 try { raw=JSON.parse(String(text).replace(/^\uFEFF/,'')); }
 catch (cause) {const error=Error('Невалидна JSON датотека.');error.code='INVALID_JSON';throw error;}
 if(E().validate(raw)){
  if(raw.pets.length>1000||raw.habitats.length>100||raw.logs.length>500000){
   const error=Error('Неподдржана големина на светот.');error.code='BACKUP_TOO_LARGE';throw error;
  }
  return raw;
 }
 const migrated=legacyConvert(raw);
 if(migrated)return migrated;
 const error=Error('Ова не е валиден ТРИАЛУМ бекап (1.0 – 1.5.1).');
 error.code='UNSUPPORTED_BACKUP';throw error;
}
root.TrialumStorage={load,save,clear,parseImport,legacyConvert};
})(globalThis);
