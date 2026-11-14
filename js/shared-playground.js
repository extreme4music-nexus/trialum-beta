
(function(root){
'use strict';
const P=()=>root.TrialumPresence;
let worldRef=null,presenceChanged=()=>{};
const escape=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const toy={sandbox:['🏖️','Песочник',0],seesaw:['⚖️','Клацкалка',0],slide:['🛝','Лизгалка',8],pool:['🏊','Базенче',10],obstacle:['🧩','Патека',12],trampoline:['✨','Трамболина',14]};
const st={active:false,ready:false,enabled:false,online:false,rooms:[],invitations:[],visits:[],presenceEnabled:false,aiRelayEnabled:false,speechTranslationEnabled:false,speechTranslationLanguages:[],presences:[],selected:'',snapshot:null,roomNoticeUntil:0,roomNoticeName:'',roomNoticeKind:'',error:'',busy:false};
let base='',token='',ws=null,timer=null,scheduled=null,inflight=false,refreshAgain=false,changed=()=>{},wsReady=false,subscribed='',subscribedLanguage='';
const say=()=>changed();
const self=()=>root.TrialumSocial?.getState?.()?.identity||null;
const friends=()=>root.TrialumSocial?.getState?.()?.friends||[];
const current=s=>root.TrialumEngine?.currentPet?.(s)||s?.pets?.[0]||null;
const uuid=()=>{
 if(root.crypto?.randomUUID)return root.crypto.randomUUID();
 const bytes=new Uint8Array(16);root.crypto?.getRandomValues?.(bytes);
 if(!bytes.some(Boolean))throw Error('secure_random_unavailable');
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
 return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
};
function profile(p){
 const sp=root.TrialumEngine?.SPECIES?.[Number(p?.species)||0]||{};
 return{id:String(p?.id||'pet-visitor').replace(/[^A-Za-z0-9_-]/g,'').slice(0,64),
 name:String(p?.name||'Миленик').trim().slice(0,32),species:Math.max(0,Math.min(15,Math.trunc(Number(p?.species)||0))),
 hue:Math.max(0,Math.min(359,Math.round(Number(p?.hue)||175))),
 eyes:Math.max(1,Math.min(5,Math.round(Number(p?.eyes)||2))),
 shape:['jelly','cloud','leaf','crystal','blob','round','star'].includes(p?.shape)?p.shape:(sp.shape||'jelly'),
 growth:Math.max(1,Math.min(100,Math.round(Number(p?.growth)||25))),
 seed:Math.max(0,Math.min(4294967295,Math.round(Number(p?.seed)||1)))};
}
function config(){
 const n=root.TrialumAndroid,url=String(n?.socialApiUrl?.()||'').trim().replace(/\/$/,'');
 const pass=String(n?.socialCredential?.()||'');
 st.enabled=/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(url)&&/^[A-Za-z0-9_-]{43}$/.test(pass);
 base=st.enabled?url:'';token=st.enabled?pass:'';
 return st.enabled;
}
const errors={
 shared_disabled:'Заедничката игротека сè уште не е овозможена на серверот.',pending_visit_limit:'Пријателот веќе има три покани за посета. Почекај одговор.',local_locked:'Прво отклучи ја локалната игротека.',
 friendship_required:'Потребно е активно пријателство.',room_access_denied:'Немаш пристап до овој простор.',
 owner_required:'Само сопственикот одобрува надградби.',room_limit:'Можеш да создадеш две заеднички игротеки.',
 room_full:'Групата има најмногу шест членови.',already_member:'Овој пријател веќе е член.',
 not_enough_shared_points:'Нема доволно заеднички поени.',expand_first:'Прво проширете го просторот.',
 toy_locked:'Оваа играчка сè уште е заклучена.',play_cooldown:'Почекај осум секунди пред нова игра.',
 daily_play_limit:'Денес се искористени шесте заеднички игри.',invitation_expired:'Поканата е истечена.',
 visit_expired:'Посетата истекла.',pet_required:'Прво избери милениче.',
 pet_not_home:'Миленичето е на друго место. Прво врати го.',pet_not_present:'Испрати го миленичето во избраната игротека.',
 presence_unavailable:'Системот за присуство е недостапен.',presence_conflict:'Приемот не беше потврден.',
 presence_not_enabled:'Новиот систем за присуство сè уште не е активиран на серверот.',
 presence_required:'Нема потврдена сесија за миленичето.',
 pet_already_away:'Миленичето веќе е на друга локација.',stale_presence_session:'Оваа сесија е застарена. Освежи.'
};
function problem(e){st.error=errors[e?.message]||'Проблем со врската или дозволата. Пробај повторно.';say();}
async function req(path,method='GET',body=null){
 if(!base||!token)throw Error('shared_disabled');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
 try{
  const r=await fetch(base+'/v1/shared/'+path,{method,
   headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal,
   cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(Error(data.error||'server_error'),{status:r.status});
  return data;
 }finally{clearTimeout(timeout);}
}
function homeGuest(){
 const me=self()?.id;
 const visiting=st.visits.find(v=>v.receiver_id===me&&v.destination==='habitat'&&
  v.status==='accepted'&&v.presence_active!==false&&Date.parse(v.expires_at)>Date.now());
 root.TrialumWorld?.setGuest?.(visiting?{...visiting.pet_public,level:1}:null);
}
async function refresh(){
 if(!st.active||!config())return;
 if(inflight){refreshAgain=true;return;}
 inflight=true;
 try{
  const [status,rooms,invitations,visits]=await Promise.all([req('status'),req('rooms'),req('invitations'),req('visits')]);
  if(!status.ready)throw Error('shared_disabled');
  if(!status.presenceEnabled)throw Error('presence_not_enabled');
  const confirmed=await req('presence');
  st.ready=true;st.online=true;st.error='';
  st.rooms=rooms.rooms||[];st.invitations=invitations.invitations||[];st.visits=visits.visits||[];
  st.presenceEnabled=true;st.aiRelayEnabled=!!status.playgroundAiEnabled;
   st.speechTranslationEnabled=!!status.speechTranslationEnabled;
   st.speechTranslationLanguages=Array.isArray(status.speechTranslationLanguages)?status.speechTranslationLanguages:[];
  st.presences=await flushPendingReturns(confirmed.presence||[]);
  reconcilePresence(st.presences);
  if(!st.rooms.some(r=>r.id===st.selected))st.selected=st.rooms[0]?.id||'';
  if(st.selected){
   const requestedRoom=st.selected;
   try{
    const next=await req('rooms/'+requestedRoom+'/snapshot');
    if(st.selected===requestedRoom){
     // Changed room occupancy can be a return/expiry, not necessarily offline.
     // Do not publish live or historical per-user connectivity surveillance.
     const previous=st.snapshot?.room?.id===requestedRoom?(st.snapshot?.occupants||[]):[];
     const current=new Set((next?.occupants||[]).map(x=>x?.pet?.id).filter(Boolean));
     const missing=previous.find(x=>x?.pet?.id&&!current.has(x.pet.id));
     if(missing){
      st.roomNoticeUntil=Date.now()+45000;
      st.roomNoticeName=String(missing.display||'Играч').slice(0,48);
      st.roomNoticeKind='presence'; // Could be departure, lease expiry or network.
     }
     st.snapshot=next;
    }
    else refreshAgain=true;
   }catch(e){
    if(st.selected===requestedRoom){
     if(e?.status===403||e?.status===404){
      st.snapshot=null;st.selected=''; // authoritative revocation/not found
     }else{
      st.online=false; // transient failure is not proof of departure
      st.error='📡 Нема врска. Прикажана е последната потврдена состојба.';
     }
    }else refreshAgain=true;
   }
  }else st.snapshot=null;
  homeGuest();
  if(st.online)await maybeRenewPresence();
  subscribe();
  }catch(e){st.online=false;problem(e);}finally{
  inflight=false;say();
  if(refreshAgain&&st.active){
   refreshAgain=false;
   setTimeout(()=>{if(st.active)refresh().catch(()=>{});},0);
  }
 }
}
// An offline return is a saved intent until authenticated server confirmation.
async function flushPendingReturns(rows){
 const world=worldRef,api=P();
 if(!world||!api||!Array.isArray(rows))return rows;
 let verified=rows,changed=false;
 for(const pet of world.pets||[]){
  const intent=pet?.pendingRemoteReturn;
  if(!intent||typeof intent!=='object')continue;
  const loc=api.get(world,pet.id);
  if(loc?.kind!==api.SHARED||loc.sessionId!==intent.sessionId||loc.ref!==intent.roomId){
   delete pet.pendingRemoteReturn;changed=true;continue;
  }
  const remote=verified.find(x=>x.petId===pet.id);
  if(!remote||remote.sessionId!==intent.sessionId||
     remote.kind!=='shared'||remote.roomId!==intent.roomId){
   delete pet.pendingRemoteReturn;changed=true;continue;
  }
  try{
   await req('presence/return','POST',{petId:pet.id,sessionId:intent.sessionId});
   verified=(await req('presence')).presence||[];
   if(!verified.some(x=>x.petId===pet.id&&x.sessionId===intent.sessionId)){
    delete pet.pendingRemoteReturn;changed=true;
   }
  }catch(_){
   // Uncertain response: retry idempotently. Never invent HOME or XP.
  }
 }
 if(changed)presenceChanged();
 return verified;
}
// A sleeping/restarted app may be on Home when a remote lease expires.
 // Reconcile remotely only on visible/resumed app and only after user opt-in;
 // never decide remote expiry from the device clock or stale room snapshots.
let awaySyncBusy=false;
async function reconcileAway(){
 const world=worldRef,api=P();
 if(st.active||awaySyncBusy||!world||!api||!self()?.id)return;
 if(!(world.pets||[]).some(p=>{
  const kind=api.get(world,p.id)?.kind;
  return kind===api.SHARED||kind===api.VISIT;
 }))return;
 if(!config())return;
 awaySyncBusy=true;
 try{
  const [presence,visits]=await Promise.all([req('presence'),req('visits')]);
  if(st.active||worldRef!==world)return; // late answer cannot overwrite a new world
  st.presences=await flushPendingReturns(presence.presence||[]);
  st.visits=visits.visits||[];
  st.online=true;
  reconcilePresence(st.presences);
  homeGuest();
 }catch(_){
  st.online=false; // stay away/pending until authenticated online reconciliation
 }finally{awaySyncBusy=false;}
}
function reconcilePresence(rows){
 const world=worldRef,api=P(),me=self()?.id;
 if(!world||!api||!me||!Array.isArray(rows))return;
 let changed=false;
 const byPet=new Map(rows.map(x=>[x.petId,x]));
 for(const pet of world.pets||[]){
  const pending=st.visits.find(v=>v.sender_id===me&&v.pet_public?.id===pet.id&&
    v.status==='pending'&&Date.parse(v.expires_at)>Date.now());
  if(pending&&pet.pendingVisitId!==pending.id){pet.pendingVisitId=pending.id;changed=true;}
  if(!pending&&pet.pendingVisitId){delete pet.pendingVisitId;changed=true;}
  const server=byPet.get(pet.id),old=api.get(world,pet.id);
  if(server){
   const kind=server.kind==='shared'?api.SHARED:server.kind==='visit'?api.VISIT:null;
   const ref=kind===api.SHARED?server.roomId:server.visitId;
   if(!kind||!ref)continue;
   // Server's authenticated ledger outranks a stale/offline local or old room session.
   if(old.kind!==kind||old.ref!==ref||old.sessionId!==server.sessionId||old.status!=='active'){
    if(api.adoptServer(world,pet.id,kind,ref,server.sessionId).ok)changed=true;
   }
  }else if(old.kind===api.SHARED||old.kind===api.VISIT){
   const r=old.status==='pending'?api.rollback(world,pet.id,old.sessionId):
    api.returnHome(world,pet.id,old.sessionId);
   if(r.ok)changed=true;
  }
 }
 if(changed)presenceChanged();
}
// Renew every eligible pet, not just the currently selected one. Server time
// and session ID are authoritative; a lost/rejected renew triggers reconciliation.
const renewAttempt=new Map();
async function maybeRenewPresence(){
 const world=worldRef,api=P();
 if(!st.active||!world||!api)return;
 const now=Date.now(),live=new Map(st.presences.map(p=>[p.petId,p]));
 for(const pet of world.pets||[]){
  const loc=api.get(world,pet.id),server=live.get(pet.id);
  if(loc?.kind!==api.SHARED||loc.status!=='active'||
    server?.kind!=='shared'||server.roomId!==loc.ref||server.sessionId!==loc.sessionId)continue;
  const until=Date.parse(server.expiresAt);
  // Keep two-hour server leases bounded. Renew only shortly before expiry,
  // rather than extending them every 8 seconds or renewing inactive visits.
  if(Number.isFinite(until)&&until-now>30*60*1000)continue;
  if(now-(renewAttempt.get(loc.sessionId)||0)<60*1000)continue;
  renewAttempt.set(loc.sessionId,now);
  try{
   const ack=await req('presence/renew','POST',{petId:pet.id,sessionId:loc.sessionId,roomId:loc.ref});
   if(Date.parse(ack.expiresAt)>now)server.expiresAt=ack.expiresAt;
  }catch(e){
   if(e.status===409||e.status===403){refreshAgain=true;continue;}
   throw e;
  }
 }
 const active=new Set(st.presences.map(p=>p.sessionId));
 for(const id of renewAttempt.keys())if(!active.has(id))renewAttempt.delete(id);
}
function subscribe(){
 if(!ws||!wsReady||ws.readyState!==1)return;
 const language=root.TrialumI18n?.language?.()||'mk';
 if(st.selected===subscribed&&language===subscribedLanguage)return;
 if(subscribed&&st.selected!==subscribed)ws.send(JSON.stringify({type:'unsubscribe',roomId:subscribed}));
 if(st.selected)ws.send(JSON.stringify({type:'subscribe',roomId:st.selected,language}));
 subscribed=st.selected;subscribedLanguage=language;
}
function sendPetSpeech(world,pet,text,language='mk',replyToTurnId=''){
 if(!st.active||!st.online||!st.aiRelayEnabled||root.document?.visibilityState==='hidden'||
     !wsReady||!ws||ws.readyState!==1||subscribed!==st.selected||!pet)return false;
 const loc=P()?.get?.(world,pet.id);
 if(loc?.kind!==P()?.SHARED||loc.status!=='active'||loc.ref!==st.selected)return false;
 if(!st.presences.some(x=>x.petId===pet.id&&x.sessionId===loc.sessionId&&x.kind==='shared'&&x.roomId===st.selected))return false;
 const phrase=String(text||'').trim().slice(0,160);
 if(!phrase||/[\u0000-\u001f\u007f]/.test(phrase))return false;
 const message={type:'pet_speech',roomId:st.selected,petId:pet.id,
    sessionId:loc.sessionId,turnId:uuid(),text:phrase};
 if(st.speechTranslationEnabled){
    if(!['mk','en','sq','es','fr','de','it','pt','tr','ar','zh','ja','ko','ru','hi','id','pl'].includes(language))
      return false;
    message.language=language;
 }
 // Preserve authenticated conversation links independently of translation.
 if(/^[0-9a-f-]{36}$/i.test(replyToTurnId))message.replyToTurnId=replyToTurnId;
 try{ws.send(JSON.stringify(message));return true;}catch(_){return false;}
}
function connect(){
 if(!st.active||!st.enabled||!root.WebSocket||ws)return;
 const socket=new root.WebSocket(base.replace(/^https:/,'wss:')+'/v1/social/live');
 ws=socket;
 socket.addEventListener('open',()=>{if(ws===socket)socket.send(JSON.stringify({type:'auth',credential:token}));});
 socket.addEventListener('message',e=>{
  if(ws!==socket)return;
  let m;try{m=JSON.parse(e.data);}catch(_){return;}
  if(m.type==='ready'){wsReady=true;subscribe();}
  if(m.type==='pet_speech')root.TrialumPlaygroundAI?.onPeerSpeech?.(m);
  // A room-scoped, authenticated server event: no claim about Internet state.
  if(m.type==='room_peer_unavailable'&&m.roomId===st.selected&&st.active&&
     typeof m.display==='string'&&m.display.trim()){
   st.roomNoticeName=m.display.trim().slice(0,48);
   st.roomNoticeKind='connection';
   st.roomNoticeUntil=Date.now()+45000;
   say();
  }
  if(m.type==='sync'&&st.active){
   if(scheduled)clearTimeout(scheduled);
   scheduled=setTimeout(()=>{scheduled=null;refresh().catch(()=>{});},180);
  }
 });
 socket.addEventListener('close',()=>{if(ws===socket){ws=null;wsReady=false;subscribed='';subscribedLanguage='';if(st.active)setTimeout(()=>{if(st.active)connect();},4000);}});
 socket.addEventListener('error',()=>{});
}
function onForeground(){
 if(st.active&&root.document?.visibilityState==='visible'){
  refresh().catch(()=>{});
  connect();
 }
}
function activate(){
 if(st.active)return;
 st.active=true;
 root.document?.addEventListener?.('visibilitychange',onForeground);
 if(!config()){st.error='Поврзи приватен профил преку HTTPS во Пријатели.';say();return;}
 refresh().catch(()=>{});
 connect();
 timer=setInterval(()=>{if(st.active&&root.document?.visibilityState!=='hidden')refresh().catch(()=>{});},8000);
}
function deactivate(){
 root.TrialumPlaygroundAI?.stop?.();
 st.active=false;
 refreshAgain=false;
 root.document?.removeEventListener?.('visibilitychange',onForeground);
 if(timer)clearInterval(timer);timer=null;
 if(scheduled)clearTimeout(scheduled);scheduled=null;
 renewAttempt.clear();
 if(ws){const old=ws;ws=null;old.close();}wsReady=false;subscribed='';subscribedLanguage='';
 root.TrialumSharedScene?.stop?.();
}
function stopNativeBackground(world){
 const pet=current(world);
 if(!pet?.playgroundAiBackgroundShared)return;
 root.TrialumAndroid?.setPlaygroundBackgroundAi?.(false,'','','','');
 pet.playgroundAiBackgroundShared=false;
 presenceChanged();
}
function select(id){
 if(!st.rooms.some(r=>r.id===id))return false;
 if(st.selected&&st.selected!==id)stopNativeBackground(worldRef);
 root.TrialumPlaygroundAI?.stop?.();
 st.selected=id;st.snapshot=null;st.roomNoticeUntil=0;st.roomNoticeName='';st.roomNoticeKind='';
 say();refresh().catch(()=>{});return true;
}
async function run(fn){
 if(st.busy)return null;
 st.busy=true;st.error='';say();
 try{const value=await fn();await refresh();return value;}
 catch(e){problem(e);return null;}
 finally{st.busy=false;say();}
}
function create(title,world){
 if(!root.TrialumPlayground?.eligible(world)?.ok){problem(Error('local_locked'));return Promise.resolve(null);}
 return run(async()=>{const x=await req('rooms','POST',{title});st.selected=x.room.id;return x;});
}
const invite=friendId=>run(()=>req('rooms/'+st.selected+'/invite','POST',{inviteeId:friendId}));
const decision=(id,accept)=>run(async()=>{
 const result=await req('invitations/'+id+'/'+(accept?'accept':'decline'),'POST',{});
 // After accepting an invitation, use the friend's room rather than
 // staying in the invitee's previously selected private room.
 if(accept&&result?.status==='accepted'&&typeof result.roomId==='string'){
  st.selected=result.roomId;st.snapshot=null;
 }
 return result;
});
const remove=id=>run(()=>req('rooms/'+st.selected+'/members/'+id,'DELETE'));
const drop=()=>run(async()=>{const v=await req('rooms/'+st.selected,'DELETE');st.selected='';return v;});
const upgrade=(kind,toyId)=>run(()=>req('rooms/'+st.selected+'/upgrade','POST',{eventKey:uuid(),kind,toyId}));
function enterRoom(world){
 worldRef=world;
 return run(async()=>{
  const pet=current(world),roomId=st.selected,api=P();
  if(!pet)throw Error('pet_required');
  if(!roomId)throw Error('room_access_denied');
  if(!api)throw Error('presence_unavailable');
  const sessionId=uuid();
  const admit=api.enter(world,pet.id,api.SHARED,roomId,Date.now(),sessionId);
  if(!admit.ok)throw Error('pet_not_home');
  presenceChanged(); // persist pending before the network call; never invent confirmation
  try{
   const verified=await req('presence/enter','POST',{roomId,sessionId,pet:profile(pet)});
   if(verified.sessionId!==sessionId||verified.roomId!==roomId)throw Error('presence_conflict');
   if(!api.confirm(world,pet.id,sessionId).ok)throw Error('presence_conflict');
   presenceChanged();
   return {admitted:true,petId:pet.id,sessionId};
  }catch(e){
   // A timeout may occur AFTER server commit. Keep pending until an authenticated
   // GET /presence confirms whether the lease actually exists.
   if(e.status&&e.status<500){api.rollback(world,pet.id,sessionId);}
   presenceChanged();
   throw e;
  }
 });
}
function leaveRoom(world){
 worldRef=world;
 return run(async()=>{
  const pet=current(world),api=P();
  if(!pet||!api)throw Error('pet_required');
  const loc=api.get(world,pet.id);
  if(loc.kind!==api.SHARED)throw Error('pet_not_present');
  // The owner explicitly withdrew this pet from the room: stop the native
  // foreground-service conversation before any asynchronous return/retry.
  stopNativeBackground(world);
  // Never return locally before server confirmation; failed offline requests
  // leave the remote location intact and can be retried safely.
  try{
   await req('presence/return','POST',{petId:pet.id,sessionId:loc.sessionId});
  }catch(e){
   if(!e?.status||e.status>=500){
    pet.pendingRemoteReturn={sessionId:loc.sessionId,roomId:loc.ref,requestedAt:Date.now()};
    presenceChanged(); // persist the intention; pet stays away until confirmation
    return {queued:true,message:'📡 Враќањето е побарано. Се чека серверска потврда.'};
   }
   throw e;
  }
  delete pet.pendingRemoteReturn;
  const changed=loc.status==='pending'?api.rollback(world,pet.id,loc.sessionId):
   api.returnHome(world,pet.id,loc.sessionId);
  if(!changed.ok)throw Error('presence_conflict');
  presenceChanged();
  return {ok:true,message:'Миленичето е безбедно вратено дома.'};
 });
}
const play=(toyId,world)=>run(()=>{
 const pet=current(world),api=P();
 if(!pet)throw Error('pet_required');
 if(!api?.isAt(world,pet.id,api.SHARED,st.selected))throw Error('pet_not_present');
 const loc=api.get(world,pet.id);
 return req('rooms/'+st.selected+'/activity','POST',
  {eventKey:uuid(),toyId,pet:profile(pet),sessionId:loc.sessionId});
});
const sendVisit=(receiverId,destination,world)=>run(async()=>{
 worldRef=world;
 const p=current(world);if(!p)throw Error('pet_required');
 if(!P()?.atHome(world,p.id)||p.pendingVisitId)throw Error('pet_not_home');
 const response=await req('visits','POST',{eventKey:uuid(),receiverId,destination,
  ...(destination==='playground'?{roomId:st.selected}:{}),pet:profile(p)});
 if(response.visitId){p.pendingVisitId=response.visitId;presenceChanged();}
 return response;
});
const changeVisit=(id,kind)=>run(()=>req('visits/'+id+'/'+kind,'POST',{}));
function visitsView(world){
 const me=self()?.id,pet=current(world),fr=friends();
 let out='<div class="card"><h3>🐾 Посети на миленици</h3><p class="small subtle">Посетата е само со дозвола. Не создава XP и не ги префрла зачуваните миленици.</p>';
 if(fr.length&&pet){
  out+='<div class="btn-line"><select id="sharedFriendToVisit" aria-label="Пријател">'+fr.map(f=>'<option value="'+escape(f.id)+'">'+escape(f.nickname)+'</option>').join('')+'</select>'+
   '<select id="sharedDestination" aria-label="Дестинација"><option value="habitat">🏠 Дом</option>'+
   (st.snapshot?'<option value="playground">🌳 Заедничка игротека</option>':'')+
   '</select><button data-do="shVisit">Испрати покана за посета</button></div>';
 }
 for(const v of st.visits.slice(0,20)){
  if(v.sender_id!==me&&v.receiver_id!==me)continue;
  const receive=v.receiver_id===me;
  out+='<div class="friend-item social-friend"><span>🐾 '+escape(v.pet_public?.name||'Миленик')+
   ' · '+(v.destination==='habitat'?'🏠':'🌳')+' · '+escape(v.status)+
   (receive?' · од '+escape(v.sender_name||'пријател'):'')+'</span><div class="btn-line">'+
   (receive&&v.status==='pending'?'<button data-do="shVisitDecision" data-id="'+escape(v.id)+'" data-kind="accept">✓ Прифати</button><button data-do="shVisitDecision" data-id="'+escape(v.id)+'" data-kind="decline">Одбиј</button>':'')+
   (['pending','accepted'].includes(v.status)?'<button data-do="shVisitDecision" data-id="'+escape(v.id)+'" data-kind="return">↩ Врати</button>':'')+
   '</div></div>';
 }
 return out+'</div>';
}
function offlineReturnPanel(world){
 const pet=current(world),loc=pet&&P()?.get(world,pet.id);
 if(!pet||loc?.kind!==P()?.SHARED)return '';
 if(pet.pendingRemoteReturn?.sessionId===loc.sessionId)
  return '<div class="notice" role="status">⏳ Враќањето е побарано. Привремената домашна слика не дозволува акции; се чека серверска потврда.</div>';
 return '<div class="notice" role="status">📡 Нема врска со заедничката игротека. Миленичето може да побара враќање, но конечната промена се потврдува по поврзување. <button data-do="shReturn">↩ Побарај враќање дома</button></div>';
}
function render(world){
 worldRef=world;
 const me=self(),own=root.TrialumPlayground?.eligible(world)?.ok,snap=st.snapshot,room=snap?.room;
 let out='<div class="tab-main shared-hub"><div class="shared-heading"><div><p class="microcap">1.6-LW · ПРИВАТЕН СЕРВЕР</p><h2>🌳 Заедничка игротека</h2><p class="desc">Покани за членство, посети со согласност и вистинска синхронизација. Без реклами и продажба на податоци.</p></div><span class="tag">🔐 Доброволно</span></div>';
 if(st.error)out+='<div class="notice social-warning" role="status">'+escape(st.error)+'</div>';
 if(st.roomNoticeUntil>Date.now()){
  const name=escape(st.roomNoticeName||'Играч');
  const text=st.roomNoticeKind==='connection'?
   'моментално е недостапен во игротеката. Врската со заедничкиот простор е прекината.':
   'повеќе не е во потврдената листа на миленичиња. Можен е прекин на врска, враќање дома или истечена сесија.';
  out+='<p class="notice social-warning" role="status">📡 <b>'+name+'</b> <span>'+text+'</span></p>';
 }
 if(!me||!st.enabled)return out+'<div class="card">🔒 Прво поврзи приватен профил за пријатели. Локалната игротека работи без интернет.<p><button data-tab="friends">🤝 Пријатели</button></p></div></div>';
 if(!st.ready){
  return out+'<div class="card">📡 Нема врска. Локалниот свет е зачуван.</div><button data-do="shRefresh">Провери пак</button>'+offlineReturnPanel(world)+'</div>';
 }
 out+='<div class="btn-line"><button data-do="shRefresh">🔄 Освежи</button><span class="small subtle">WebSocket + проверена серверска состојба</span></div>';
 if(st.invitations.length){
  out+='<h3>📩 Покани</h3><div class="cards">'+st.invitations.map(i=>
   '<div class="card"><h3>🌿 '+escape(i.title)+'</h3><p>Од '+escape(i.inviter_name)+' · 24 часа</p><div class="btn-line"><button data-do="shDecision" data-id="'+escape(i.id)+'" data-accept="yes">✓ Прифати</button><button data-do="shDecision" data-id="'+escape(i.id)+'" data-accept="no">Одбиј</button></div></div>').join('')+'</div>';
 }
 if(own){
  out+='<div class="card"><h3>✨ Нова заедничка полјана</h3><div class="btn-line"><input id="sharedTitle" maxlength="48" placeholder="Име на приватниот простор" aria-label="Име на игротеката"><button data-do="shCreate">Создај</button></div></div>';
 }else out+='<p class="notice">🔒 За да бидеш сопственик треба ниво 15 и лабораторија 4. Можеш да влезеш како поканет гостин и со пониско ниво.</p>';
 if(!st.rooms.length)return out+(!st.online?offlineReturnPanel(world):'')+'<p>Нема заеднички простор. Испрати или прифати покана.</p>'+visitsView(world)+'</div>';
 out+='<div class="shared-tabs">'+st.rooms.map(r=>'<button data-do="shSelect" data-id="'+escape(r.id)+'"'+(r.id===st.selected?' class="primary"':'')+'>🌿 '+escape(r.title)+'</button>').join('')+'</div>';
 if(room){
  out+='<div class="card shared-stage"><div class="shared-heading"><div><h3>'+escape(room.title)+'</h3><p>Простор '+room.tier+'/5 · '+snap.members.length+'/6 членови</p></div><strong>💠 '+snap.points+' поени</strong></div>'+
   '<canvas id="sharedScene" width="1000" height="520" role="img" aria-label="Синхронизиран заеднички простор со миленици и играчки"></canvas>'+
   '<p class="small subtle" id="sharedAutoTalk" aria-live="polite">🐾 Присутните миленичиња сами истражуваат и разменуваат кратки разговори.</p></div>';
  const p=current(world),loc=p&&P()?.get(world,p.id);
  const verified=st.presences.find(x=>x.petId===p?.id&&x.sessionId===loc?.sessionId&&
   x.kind==='shared'&&x.roomId===room.id);
  const inRoom=!!(st.online&&verified&&p&&P()?.isAt(world,p.id,P().SHARED,room.id));
  const expiry=verified&&Number.isFinite(Date.parse(verified.expiresAt))
   ?new Date(verified.expiresAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'';
  const occupants=st.presenceEnabled&&Array.isArray(snap.occupants)?
   snap.occupants.filter(o=>o?.pet?.id):[];
  // A private room is not a global lobby. Both friends must enter the SAME
  // authorized room; showing room ID and occupants makes this verifiable.
  out+=root.TrialumPlaygroundAI?.control?.(world,p,'shared',inRoom)||'';
  out+='<div class="card"><h3>🐾 '+(st.online?'Присутни миленичиња: ':'Последно потврдени, непроверени: ')+occupants.length+'</h3>'+
   '<p class="small subtle">Простор: '+escape(room.title)+' · ID '+escape(room.id.slice(0,8))+
   '. Двајцата пријатели треба да ја изберат истата игротека од копчињата погоре.</p>'+
   (occupants.length?'<div class="friend-item">'+occupants.map(o=>
    '<span>🐾 '+escape(o.pet.name||'Милениче')+' · '+escape(o.display||'Играч')+'</span>').join('')+
    '</div>':'<p class="small subtle">Нема потврдени миленичиња во овој простор. Освежи по испраќањето.</p>')+
   '</div>';
  out+='<div class="notice">'+(p?.pendingRemoteReturn?.sessionId===loc?.sessionId?
   '⏳ Враќањето е побарано; се чека серверска потврда.':
   inRoom?'<button data-do="shReturn">↩ Врати дома</button>'+(expiry?' · ⏱ '+escape(expiry):''):
   loc?.kind===P()?.SHARED&&loc.ref===room.id&&!st.online?
   '<button data-do="shReturn">↩ Побарај враќање дома по поврзување</button>':
   loc?.kind===P()?.HOME?'<button class="primary" data-do="shEnter">🐾 Испрати во оваа игротека</button>':
   loc?.kind===P()?.SHARED&&loc.ref===room.id&&loc.status==='pending'?
   '⏳ Се потврдува заминувањето':!st.online?'📡 Се чека повторно поврзување':
   'Миленичето е на друга локација.')+'</div>';
  out+='<div class="card"><h3>🎠 Групни активности</h3><p>Секое потврдено играње носи 1 групен поен, максимум 6 дневно. Гледањето не носи награди.</p><p class="small subtle">🐾 Во заедничката игротека потврдените миленичиња самостојно играат и разговараат веднаш. Групни поени се доделуваат само за потврдени активности преку копчињата; разговорите сами по себе не создаваат XP.</p><div class="btn-line">'+snap.toys.map(t=>
   '<button data-do="shPlay" data-toy="'+escape(t)+'"'+(!inRoom?' disabled':'')+'>'+(toy[t]?.[0]||'🎠')+' '+escape(toy[t]?.[1]||t)+'</button>').join('')+'</div></div>';
  if(room.role==='owner'){
   const available=friends().filter(f=>!snap.members.some(m=>m.id===f.id));
   out+='<div class="card"><h3>👑 Управување</h3><div class="btn-line"><select id="sharedInviteFriend" aria-label="Покани пријател">'+available.map(f=>'<option value="'+escape(f.id)+'">'+escape(f.nickname)+'</option>').join('')+'</select><button data-do="shInvite"'+(!available.length?' disabled':'')+'>📩 Покани</button></div>'+
   '<div class="btn-line"><button data-do="shUpgrade" data-kind="expand"'+(room.tier>=5||snap.points<10+5*(room.tier-1)?' disabled':'')+'>🌳 Прошири · '+(10+5*(room.tier-1))+'</button>'+
   Object.entries(toy).filter(([id,v])=>v[2]&&!snap.toys.includes(id)).map(([id,v])=>
    '<button data-do="shUpgrade" data-kind="toy" data-toy="'+id+'"'+(snap.points<v[2]||snap.toys.length>=Math.min(6,2+room.tier)?' disabled':'')+'>'+v[0]+' '+v[1]+' · '+v[2]+'</button>').join('')+
   '</div><p class="small subtle">Само сопственикот ги одобрува трошоците; сите членови придонесуваат.</p><button data-do="shDelete">Избриши простор</button></div>';
  }
  out+='<div class="card"><h3>👥 Членови</h3>'+snap.members.map(m=>'<div class="friend-item social-friend"><b>'+escape(m.nickname)+(m.role==='owner'?' 👑':'')+'</b>'+
   (((room.role==='owner'&&m.id!==room.ownerId)||(m.id===me.id&&room.role!=='owner'))?'<button data-do="shRemove" data-id="'+escape(m.id)+'">'+(m.id===me.id?'Напушти':'Отстрани')+'</button>':'')+'</div>').join('')+'</div>';
  out+='<div class="card"><h3>✨ Настани</h3>'+snap.events.slice(-8).reverse().map(e=>
   '<div class="shared-event"><b>'+escape(e.actor)+'</b> · '+escape(e.kind==='played'?'игра со '+(toy[e.payload.toyId]?.[1]||'справа'):e.kind==='upgraded'?'надградба':e.kind==='joined'?'се придружи':'настан')+'</div>').join('')+'</div>';
 }
 if(!room&&!st.online)out+=offlineReturnPanel(world);
 return out+visitsView(world)+'</div>';
}
root.TrialumShared={activate,deactivate,refresh,reconcileAway,bindWorld(world){worldRef=world;},select,create,invite,decision,remove,drop,upgrade,enterRoom,leaveRoom,play,sendVisit,changeVisit,
 render,profile,sendPetSpeech,onChange(fn){changed=fn;},onPresenceChange(fn){presenceChanged=fn;},getWorld(){return worldRef;},getState(){return {...st,rooms:st.rooms.slice(),visits:st.visits.slice()}}};
})(typeof globalThis!=='undefined'?globalThis:this);
