/* TRIALUM LW-A: per-pet single-location state machine. No network, XP or UI side effects.
 * Backward-compatible additive data in each pet; no version bump or world reset.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.TrialumPresence=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const HOME='home',LOCAL='local_playground',SHARED='shared_playground',VISIT='visit';
 const KINDS=Object.freeze([HOME,LOCAL,SHARED,VISIT]);
 // LW-A local admission is finite and offline-only; LW-C owns earned-time simulation.
 const LOCAL_SESSION_MS=2*60*60*1000;
 const remote=k=>k===SHARED||k===VISIT;
 const validRef=v=>typeof v==='string'&&v.length>0&&v.length<=128&&/^[A-Za-z0-9_-]+$/.test(v);
 const find=(s,id)=>Array.isArray(s?.pets)?s.pets.find(p=>p.id===id):null;
 const fail=message=>({ok:false,message});
 const home=()=>({version:1,kind:HOME,status:'active',sessionId:null,ref:null,startedAt:null});
 function normalize(p){
  const a=p?.presence;
  if(!a||typeof a!=='object'||Array.isArray(a)){p.presence=home();return p.presence;}
  if(!KINDS.includes(a.kind)){p.presence=home();return p.presence;}
  if(a.kind===HOME){
   if(a.version===1&&a.status==='active'&&a.sessionId===null&&a.ref===null&&a.startedAt===null)return a;
   p.presence=home();return p.presence;
  }
  if(!validRef(a.sessionId)||(remote(a.kind)&&!validRef(a.ref))){
   p.presence=home();return p.presence;
  }
  const since=Number(a.startedAt);
  const stamp=Number.isSafeInteger(since)&&since>0?since:0;
  // An undated local session cannot be bounded safely. Repair it to HOME;
  // authenticated remote leases remain pending server reconciliation instead.
  if(a.kind===LOCAL&&stamp===0){p.presence=home();return p.presence;}
  const status=a.status==='pending'&&remote(a.kind)?'pending':'active';
  const ref=validRef(a.ref)?a.ref:null;
  if(a.version===1&&a.status===status&&a.ref===ref&&a.startedAt===stamp)return a;
  p.presence={version:1,kind:a.kind,status,sessionId:a.sessionId,ref,startedAt:stamp};
  return p.presence;
 }
 function ensure(s){if(!Array.isArray(s?.pets))return s;
  for(const p of s.pets)if(p&&typeof p==='object')normalize(p);
  if(!Number.isSafeInteger(s.presenceSequence)||s.presenceSequence<0)s.presenceSequence=0;
  // Repair partially exported worlds without the counter: never reuse an earlier session ID.
  if(s.presenceSequence===0){
   for(const p of s.pets){
    const hit=/^lw([0-9a-z]+)_/.exec(p?.presence?.sessionId||'');
    if(!hit)continue;
    const n=parseInt(hit[1],36);
    if(Number.isSafeInteger(n))s.presenceSequence=Math.max(s.presenceSequence,n);
   }
  }
  return s;
 }
 function get(s,id){const p=find(s,id);return p?normalize(p):null;}
 function atHome(s,id){return get(s,id)?.kind===HOME;}
 function enter(s,id,kind,ref=null,now=Date.now(),serverSession=null){
  const p=find(s,id);
  if(!p)return fail('Миленичето не постои.');
  if(![LOCAL,SHARED,VISIT].includes(kind))return fail('Непозната дестинација.');
  if(remote(kind)&&!validRef(ref))return fail('Недостига проверена дестинација.');
  if(!atHome(s,id))return fail('Миленичето веќе е на друго место. Прво врати го.');
  if(p.pendingVisitId)return fail('Миленичето има покана за посета што чека одговор.');
  if(!Number.isSafeInteger(now)||now<1)return fail('Невалидно време.');
  if(serverSession!==null&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(serverSession))return fail('Невалидна серверска сесија.');
  ensure(s);s.presenceSequence++;
  const sessionId=serverSession||'lw'+s.presenceSequence.toString(36)+'_'+String(id).replace(/[^A-Za-z0-9_-]/g,'').slice(0,45);
  p.presence={version:1,kind,status:remote(kind)?'pending':'active',sessionId,
   ref:validRef(ref)?ref:null,startedAt:now};
  return {ok:true,kind,status:p.presence.status,sessionId,message:'Миленичето е испратено.'};
 }
 function confirm(s,id,sessionId){
  const p=find(s,id),a=p&&get(s,id);
  if(!a||a.kind===HOME||a.sessionId!==sessionId||!remote(a.kind))return fail('Посетата или приемот не се совпаѓа.');
  if(a.status==='active')return {ok:true,duplicate:true,message:'Приемот е веќе потврден.'};
  p.presence={...a,status:'active'};
  return {ok:true,message:'Присуството е потврдено.'};
 }
 function rollback(s,id,sessionId){
  const p=find(s,id),a=p&&get(s,id);
  if(!a||a.kind===HOME||a.sessionId!==sessionId||a.status!=='pending')return fail('Нема незавршен прием за враќање.');
  p.presence=home();return {ok:true,message:'Приемот е откажан; миленичето останува дома.'};
 }
 function returnHome(s,id,sessionId){
  const p=find(s,id),a=p&&get(s,id);
  if(!a)return fail('Миленичето не постои.');
  if(a.kind===HOME)return {ok:true,duplicate:true,message:'Миленичето веќе е дома.'};
  if(a.sessionId!==sessionId)return fail('Погрешна или застарена сесија.');
  if(a.status==='pending')return fail('Приемот е во тек. Почекај потврда.');
  p.presence=home();return {ok:true,message:'Миленичето е безбедно вратено дома.'};
 }
 function adoptServer(s,id,kind,ref,sessionId){
  const p=find(s,id);
  if(!p||![SHARED,VISIT].includes(kind)||!validRef(ref)||
     !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId))
   return fail('Невалидно потврдено присуство.');
  ensure(s);
  const old=get(s,id);
  if(old.kind===kind&&old.ref===ref&&old.sessionId===sessionId&&old.status==='active')
   return {ok:true,duplicate:true};
  // Call ONLY after an authenticated GET /v1/shared/presence; server is authoritative.
  p.presence={version:1,kind,status:'active',sessionId,ref,startedAt:Date.now()};
  delete p.pendingVisitId;
  return {ok:true,message:'Присуството е усогласено со серверот.'};
 }
 // Called at load, Restore, foreground and periodic ticks. A session expiry never
 // grants XP, rewrites a pet's history or changes any other pet's location.
 // Remote leases are deliberately excluded: only authenticated server state may
 // end a shared room or visit when the device clock/network is unreliable.
 function expireLocal(s,now=Date.now()){
  const expired=[];
  if(!Array.isArray(s?.pets)||!Number.isSafeInteger(now)||now<1)return {changed:false,expired};
  for(const pet of s.pets){
   if(!pet||typeof pet!=='object')continue;
   const loc=normalize(pet);
   if(loc.kind!==LOCAL||loc.status!=='active'||loc.startedAt<1)continue;
   if(now>=loc.startedAt&&now-loc.startedAt>=LOCAL_SESSION_MS){
    expired.push({petId:pet.id,sessionId:loc.sessionId});
    pet.presence=home();
   }
  }
  return {changed:expired.length>0,expired};
 }
 function isAt(s,id,kind,ref){
  const a=get(s,id);
  return !!a&&a.kind===kind&&a.status==='active'&&(ref===undefined||a.ref===ref);
 }
 function availableForCare(s,id){return atHome(s,id);}
 function installHooks(E){
  if(!E||E.__TRIALUM_LW_A_HOOKS)return;
  Object.defineProperty(E,'__TRIALUM_LW_A_HOOKS',{value:true,enumerable:false});
  const guarded={petCare:1,transfer:1,feedPrepared:1,longplayTrain:1,cognitiveAction:1,
   longplayTransform:1,socialize:1};
  for(const name of Object.keys(guarded)){
   const old=E[name];if(typeof old!=='function')continue;
   E[name]=function(s,id,...args){
    if(find(s,id)&&!availableForCare(s,id))
     return fail('Миленичето не е дома. Прво врати го од игротеката или посетата.');
    return old.call(this,s,id,...args);
   };
  }
  if(typeof E.createPet==='function'){
   const old=E.createPet;
   E.createPet=function(s,...args){const result=old.call(this,s,...args);if(result?.ok)ensure(s);return result;};
  }
 }
 installHooks(typeof globalThis!=='undefined'?globalThis.TrialumEngine:null);
 return {HOME,LOCAL,SHARED,VISIT,KINDS,LOCAL_SESSION_MS,ensure,get,atHome,enter,confirm,rollback,returnHome,expireLocal,isAt,availableForCare,adoptServer,installHooks};
});
