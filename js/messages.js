/* Friend messages are live-relayed; conversation history stays in app-private IndexedDB. */
(function(root){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const tr=(mk,en)=>root.TrialumI18n?.language?.()==='en'?en:mk;
const uuidRe=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const server=()=>String(root.TrialumAndroid?.socialApiUrl?.()||'').trim().replace(/\/$/,'');
const credential=()=>String(root.TrialumAndroid?.socialCredential?.()||'');
const native=()=>root.TrialumAndroid||{};
const social=()=>root.TrialumSocial?.getState?.()||{};
const local=()=>root.TrialumLocalConversations;
const state={active:false,ready:false,enabled:false,busy:false,error:'',messages:[],events:[],
  friends:[],mutes:[],presets:{},selected:'',pushRegistered:false,pushAvailable:false,
  pushStatus:'unavailable',freeTextEnabled:false,transportOnline:false};
let changed=()=>{},timer=null,loading=false,socket=null,socketReady=false,reconnectTimer=null;
const sending=new Set();
const emit=()=>changed();
const randomId=()=>{
  if(root.crypto?.randomUUID)return root.crypto.randomUUID();
  if(!root.crypto?.getRandomValues)throw Error('secure_random_unavailable');
  const b=new Uint8Array(16);root.crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
  const x=Array.from(b,v=>v.toString(16).padStart(2,'0')).join('');
  return x.slice(0,8)+'-'+x.slice(8,12)+'-'+x.slice(12,16)+'-'+x.slice(16,20)+'-'+x.slice(20);
};
function config(){
 const api=server(),token=credential();
 state.enabled=root.TrialumAndroid?.betaTesterToolsEnabled?.()===true&&root.TrialumSocial?.isSocialProfileActive?.()===true&&
  /^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(api)&&/^[A-Za-z0-9_-]{43}$/.test(token);
 return state.enabled;
}
const errors={
 messages_disabled:'Пораките сè уште не се активирани на серверот.',
 friendship_required:'Можеш да пишуваш само на активни пријатели.',
 rate_limited:'Премногу обиди. Пробај подоцна.',
 friend_message_limit:'Достигнат е лимитот за пораки. Пробај подоцна.',
 recipient_inbox_full:'Пријателот има многу непрочитани пораки.',
 free_text_disabled:'Слободниот текст чека безбедносна ревизија. Користи кратка фраза.',
 contact_details_disallowed:'Не внесувај линкови, телефони или е-пошта во пораките.',
 personal_data_blocked:'Пораката содржи лични или контактни податоци и не е испратена. Отстрани ги тие податоци.',
 personal_data_confirmation_required:'Сомнителното барање за лични податоци беше одбиено од серверот.',
 local_storage_unavailable:'Не може да се зачува локалната историја на овој уред.',
 push_not_configured:'FCM известувањата не се конфигурирани на серверот.',
 invalid_preset:'Неподдржана порака.'
};
async function req(path,method='GET',body=null){
 if(!config())throw Error('messages_disabled');
 const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),8000);
 try{
  const r=await fetch(server()+'/v1/messages/'+path,{
   method,headers:{Authorization:'Bearer '+credential(),...(body?{'Content-Type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{}),signal:ctrl.signal,
   cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(data.error||'network_error');
  return data;
 }finally{clearTimeout(timeout);}
}
async function refresh(){
 if(!state.active||!config()||loading)return;
 loading=true;state.error='';
 try{
  const [status,inbox]=await Promise.all([req('status'),req('inbox')]);
  state.ready=!!status.ready;state.presets=status.presets||{};
  state.freeTextEnabled=status.freeTextEnabled===true;state.pushAvailable=status.pushAvailable===true;
  state.events=Array.isArray(inbox.events)?inbox.events:[];
  state.mutes=Array.isArray(inbox.mutes)?inbox.mutes:[];
  state.pushRegistered=inbox.pushRegistered===true;
  state.friends=social().friends||[];
  if(!state.friends.some(f=>f.id===state.selected))state.selected=state.friends[0]?.id||'';
  const threads=await Promise.all(state.friends.map(async f=>(await local()?.get?.(f.id)||[]).map(m=>({...m,peerRef:f.id}))));
  state.messages=threads.flat().sort((a,b)=>a.at-b.at).slice(-500);
  state.pushStatus=native().pushStatus?.()||'unavailable';
  connect();
 }catch(e){state.ready=false;state.error=errors[e.message]||'Не можам да ги вчитам известувањата. Провери ја врската.';}
 finally{loading=false;emit();}
}
function sendPending(){
 if(!socketReady||!socket||socket.readyState!==1)return;
 const pending=state.messages.filter(m=>m.mine&&m.delivery==='pending'&&!sending.has(m.id));
 for(const item of pending){
  if(!state.friends.some(f=>f.id===item.peerRef))continue;
  try{socket.send(JSON.stringify({type:'friend_message',messageId:item.id,recipientRef:item.peerRef,
   kind:item.kind,text:item.kind==='text'?item.text:undefined,presetId:item.kind==='preset'?item.presetId:undefined}));sending.add(item.id);}
  catch(_){break;}
 }
}
async function receiveLive(m){
 if(m.type==='ready'){socketReady=true;state.transportOnline=true;sendPending();emit();return;}
 if(m.type==='friend_message_ack'){
  const item=state.messages.find(x=>x.id===m.messageId&&x.mine);
  if(item){sending.delete(item.id);item.delivery=m.delivered===true?'sent':'failed';await local()?.update?.(item.peerRef,item.id,{delivery:item.delivery});emit();}
  return;
 }
 if(m.type!=='friend_message')return;
 const peerRef=String(m.senderRef||''),friend=state.friends.find(f=>f.id===peerRef);
 if(!friend||!uuidRe.test(m.messageId)||typeof m.text!=='string'||m.text.length>120)return;
 const finding=root.TrialumPrivacyGuard?.inspect?.(m.text)||{};
 if(finding.blocked){state.error='Примена е порака со забранети контактни или лични податоци. Не е зачувана.';emit();return;}
 await local()?.append?.(peerRef,{id:m.messageId,mine:false,text:m.text,kind:m.kind==='preset'?'preset':'text',
  at:Number(m.sentAt)||Date.now(),peerName:String(m.senderName||friend.nickname),delivery:'sent',read:false});
 await refresh();
}
function connect(){
 if(!state.active||!config()||!root.WebSocket||socket||!server())return;
 try{
  socket=new root.WebSocket(server().replace(/^https:/,'wss:')+'/v1/social/live');
  const current=socket;
  current.addEventListener('open',()=>{if(socket===current)current.send(JSON.stringify({type:'auth',credential:credential()}));});
  current.addEventListener('message',event=>{if(socket!==current)return;let message;try{message=JSON.parse(event.data);}catch(_){return;}receiveLive(message).catch(()=>{});});
  current.addEventListener('close',()=>{if(socket===current){socket=null;socketReady=false;state.transportOnline=false;sending.clear();emit();if(state.active)reconnectTimer=setTimeout(connect,4000);}});
  current.addEventListener('error',()=>{});
 }catch(_){socket=null;state.transportOnline=false;}
}
function activate(){
 if(state.active)return;
 if(!root.TrialumAndroid?.betaTesterToolsEnabled?.()||!root.TrialumSocial?.isSocialProfileActive?.()){state.active=false;state.ready=false;emit();return;}
 state.active=true;
 if(config())refresh();
 timer=setInterval(()=>{if(state.active && !root.document?.hidden)refresh()},25000);
 emit();
}
function deactivate(){state.active=false;clearInterval(timer);timer=null;clearTimeout(reconnectTimer);reconnectTimer=null;if(socket){const old=socket;socket=null;old.close();}socketReady=false;state.transportOnline=false;sending.clear();}
async function run(fn){
 if(state.busy)return null;
 state.busy=true;state.error='';emit();
 try{return await fn();}
 catch(e){state.error=errors[e.message]||'Не успеа акцијата. Пробај повторно.';emit();return null;}
 finally{state.busy=false;emit();}
}
async function send(receiverId,presetId,text=''){
 return run(async()=>{
  const peer=state.friends.find(f=>f.id===receiverId);
  if(!uuidRe.test(receiverId)||!peer)throw Error('invalid_recipient');
  const kind=text?'text':'preset',body=text?{text:String(text).trim().slice(0,120)}:{presetId};
  let privacyConfirmed=false;
  if(kind==='text'){
   if(!state.freeTextEnabled)throw Error('free_text_disabled');
   const finding=root.TrialumPrivacyGuard?.inspect?.(body.text)||{};
   if(finding.blocked)throw Error('personal_data_blocked');
   if(finding.requiresConfirmation){
    const warning=root.TrialumI18n?.t?.('Оваа порака изгледа бара лични податоци. Таа ќе биде пренесена преку Trialum серверот и може да ја види примачот. Не споделувај вистинско име, адреса, училиште, локација, телефон или лозинка. Серверот не треба да ја зачува, но автоматската проверка не е совршена. Продолжи само ако разбираш дека содржината може да биде видена при преносот.')||'This message appears to request personal data. It will be relayed through the Trialum server and may be seen by the recipient. Do not share real names, addresses, school, location, phone numbers, or passwords. The server is designed not to retain it, but automated detection is imperfect. Continue only if you understand the content may be visible during relay.';
    if(!root.confirm?.(warning))return null;
    privacyConfirmed=true;
   }
  }
  const item={id:randomId(),mine:true,text:kind==='text'?body.text:(state.presets[presetId]||''),kind,
   presetId:kind==='preset'?presetId:null,peerName:peer.nickname,at:Date.now(),delivery:'pending',read:true,peerRef:receiverId};
  const stored=await local()?.append?.(receiverId,item);
  if(!stored)throw Error('local_storage_unavailable');
  state.messages.push(item);state.error='';sendPending();emit();return item;
 });
}
async function mark(id,kind='message'){
 return run(async()=>{
  if(!uuidRe.test(id))throw Error('invalid_message');
  if(kind==='event')await req('events/'+id+'/read','POST',{});
  else {const item=state.messages.find(x=>x.id===id);if(item){item.read=true;await local()?.update?.(item.peerRef,id,{read:true});}}
  await refresh();return true;
 });
}
async function remove(id,kind='message'){
 return run(async()=>{
  if(!uuidRe.test(id))throw Error('invalid_message');
  if(kind==='event')await req('events/'+id,'DELETE');
  else {const item=state.messages.find(x=>x.id===id);if(item){await local()?.remove?.(item.peerRef,id);state.messages=state.messages.filter(x=>x.id!==id);}}
  await refresh();return true;
 });
}
async function clearConversation(){
 const peerRef=state.selected;if(!peerRef)return false;
 const ok=await local()?.clear?.(peerRef);if(ok){state.messages=state.messages.filter(x=>x.peerRef!==peerRef);emit();}
 return ok;
}
 async function report(id,reason='spam'){
 state.error='Пораката не е пријавена. Блокирај го профилот во „Пријатели“; пријавување ќе бара посебна согласност за испраќање на содржината.';emit();return false;
}
async function mute(id,enabled){
 return run(async()=>{
  if(!uuidRe.test(id))throw Error('invalid_friend');
  await req('mutes/'+id,enabled?'POST':'DELETE',enabled?{}:null);
  await refresh();return true;
 });
}
function pushToggle(enabled){
 if(!state.pushAvailable || native().pushStatus?.()==='unavailable'){
  state.error='За push прво се конфигурира Firebase и приватниот сервер.';emit();return false;
 }
 if(enabled)native().pushEnable?.();
 else native().pushDisable?.();
 return true;
}
function pushEvent(event){
 if(!event||typeof event!=='object')return;
 state.pushStatus=native().pushStatus?.()||'unavailable';
 if(event.kind==='error'||event.kind==='unavailable'||event.kind==='blocked')state.error=String(event.message||'').slice(0,140);
 if(state.active)refresh();
 emit();
}
const formatDate=t=>{const d=new Date(t);return Number.isFinite(d.getTime())?d.toLocaleString('mk-MK',{dateStyle:'short',timeStyle:'short'}):'';};
function render(){
 if(!state.enabled && !config())return '<div class="tab-main"><h2>💌 Пријателски пораки</h2><p class="notice">🔒 Прво отвори Пријатели и создај социјален профил. Локалната игра останува достапна офлајн.</p><button data-tab="friends">🤝 Пријатели</button></div>';
 if(!state.ready)return '<div class="tab-main message-hub"><h2>💌 Пријателски пораки</h2><p class="notice">'+esc(state.error||'Пораките се вчитуваат…')+'</p><button data-do="msgRefresh">Освежи</button></div>';
 let html='<div class="tab-main message-hub"><div class="message-heading"><div><p class="microcap">ПРИВАТНИ ПОРАКИ · 1.6-LW</p><h2>💌 Пријателски пораки</h2></div><span class="tag">'+(state.transportOnline?'🟢 Поврзано':'⚪ Нема врска')+'</span></div>'+ 
 '<p class="desc">'+esc(tr('Пораките се пренесуваат во живо само меѓу потврдени пријатели. Серверот не треба да чува офлајн пораки или историја. Секој уред ја чува својата локална копија; обичниот JSON и Google Cloud Save ја изоставуваат. Шифрираната архива во Поставки може да ја пренесе локалната историја на нов уред. Ако пријателот е офлајн, пораката чека локално додека не се поврзеш.','Messages are relayed live between confirmed friends. The server should not store offline messages or history. Each device keeps its own local copy; plain JSON and Google Cloud Save exclude it. The encrypted archive in Settings can transfer local history to a new device. If a friend is offline, a message waits locally until you reconnect.'))+'</p>';
 if(state.error)html+='<p class="notice" role="status">'+esc(state.error)+'</p>';
 html+='<div class="card"><h3>✉️ Испрати пријателска фраза</h3>'+
   '<label for="msgFriend">Избери пријател</label><select id="msgFriend" aria-label="Пријател">'+
   (state.friends.length?state.friends.map(f=>'<option value="'+esc(f.id)+'"'+(f.id===state.selected?' selected':'')+'>'+esc(f.nickname)+'</option>').join(''):'<option value="">Нема пријатели</option>')+
   '</select><div class="message-presets">'+Object.entries(state.presets).map(([id,label])=>
    '<button data-do="msgSend" data-preset="'+esc(id)+'"'+(!state.friends.length||state.busy?' disabled':'')+'>'+esc(label)+'</button>').join('')+'</div>'+
   (state.freeTextEnabled?'<label for="msgCustom">Кратка порака (до 120 знаци)</label><textarea id="msgCustom" maxlength="120" rows="2" placeholder="Без вистински имиња или контактни податоци"></textarea><button data-do="msgCustomSend">Испрати кратка порака</button>':'<p class="small subtle">🔒 Слободниот текст е исклучен на серверот. Готовите фрази се достапни.</p>')+
   '</div>';
 html+='<div class="card"><h3>🔔 Android известувања</h3>'+ 
   '<p class="desc">Push известувањата се за покани и настани во играта. Разговорите не се чуваат за офлајн испорака и немаат message push.</p>';
 if(state.pushStatus==='unavailable'||!state.pushAvailable)
  html+='<p class="notice">FCM не е конфигуриран за оваа тестна верзија. Разговорите бараат двата пријатели да бидат поврзани.</p>';
 else if(state.pushStatus==='blocked')
  html+='<p class="notice" role="status">⚠ Каналот „ТРИАЛУМ пријатели“ е исклучен во Android Settings. Известувањата за грижа се посебен канал.</p>'+
   '<p class="small subtle">'+(state.pushRegistered?'Регистриран уред':'Не е регистриран уред')+'</p>'+
   '<button data-do="msgPushOff">🔕 Исклучи известувања</button>';
 else html+='<div class="btn-line"><button data-do="'+(state.pushStatus==='enabled'?'msgPushOff':'msgPushOn')+'">'+
  (state.pushStatus==='enabled'?'🔕 Исклучи известувања':'🔔 Вклучи известувања')+'</button><span class="small subtle">'+
  (state.pushRegistered?'Регистриран уред':'Не е регистриран уред')+'</span></div>';
 if(state.pushStatus==='enabled'&&state.pushRegistered&&native().pushTestLocalNotification)
  html+='<p class="small subtle">Ако пораките пристигнуваат, но Android не известува, тестирај го каналот директно. Тестот не испраќа порака и не го користи серверот.</p>'+
   '<button data-do="msgPushTest">🧪 Тестирај Android известување</button>';
 const conversation=state.messages.filter(m=>m.peerRef===state.selected);
 html+='</div><div class="card"><div class="message-heading"><h3>💬 Разговор со пријател</h3><button data-do="msgClearConversation"'+(!conversation.length?' disabled':'')+'>Избриши локална историја</button></div>';
 html+=conversation.length?conversation.map(m=>
   '<div class="message-card"><div><strong>'+(m.mine?'➡️ Ти':'📥 '+esc(m.peerName||'Пријател'))+'</strong><span class="small subtle"> · '+esc(formatDate(m.at))+(m.mine&&m.delivery==='pending'?' · чека испраќање':m.mine&&m.delivery==='failed'?' · не е испратена':'')+'</span></div>'+ 
   '<p class="message-content">'+esc(m.text)+'</p>'+
   '<div class="btn-line">'+(!m.mine&&!m.read?'<button data-do="msgRead" data-id="'+esc(m.id)+'">✓ Прочитано</button>':'')+ 
   '<button data-do="msgDelete" data-id="'+esc(m.id)+'">Избриши од мојот уред</button></div></div>').join('')
   :'<p class="subtle">Нема локална историја со овој пријател. Избери кратка фраза или испрати порака.</p>';
 html+='</div><div class="card"><h3>🌿 Известувања од играта</h3>';
 html+=state.events.length?state.events.map(e=>
  '<div class="message-card"><strong>'+esc(e.label)+'</strong><p class="small">'+esc(e.actorName)+' · '+esc(formatDate(e.createdAt))+'</p>'+
  '<div class="btn-line">'+(!e.readAt?'<button data-do="msgEventRead" data-id="'+esc(e.id)+'">✓ Прочитано</button>':'')+
  '<button data-do="msgEventDelete" data-id="'+esc(e.id)+'">Избриши</button></div></div>').join('')
  :'<p class="subtle">Нема нови покани или настани.</p>';
 html+='</div><div class="card"><h3>🔕 Исклучи звучни/Push известувања од пријател</h3>'+
  '<p class="small subtle">Мутирањето ги исклучува известувањата за настани од пријател. За целосна забрана користи Блокирај во Пријатели.</p>';
 html+=state.friends.map(f=>'<div class="message-mute"><span>'+esc(f.nickname)+'</span><button data-do="msgMute" data-id="'+esc(f.id)+'">'+
  (state.mutes.includes(f.id)?'🔔 Вклучи Push':'🔕 Исклучи Push')+'</button></div>').join('')||'<p class="small subtle">Нема потврдени пријатели.</p>';
 return html+'</div></div>';
}
root.TrialumMessages={activate,deactivate,refresh,render,send,mark,remove,report,mute,pushToggle,pushEvent,
 onChange(fn){changed=fn},getState(){return {...state}},select(id){state.selected=id;emit();},clearConversation};
if(typeof module==='object'&&module.exports)module.exports={};
})(typeof globalThis!=='undefined'?globalThis:this);
