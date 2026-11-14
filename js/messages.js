/* TRIALUM 1.5.6-E: private, consent-based short message cards.
 * No public chat, tracking, push tokens or messages in save/backup JSON. */
(function(root){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const uuidRe=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const server=()=>String(root.TrialumAndroid?.socialApiUrl?.()||'').trim().replace(/\/$/,'');
const credential=()=>String(root.TrialumAndroid?.socialCredential?.()||'');
const native=()=>root.TrialumAndroid||{};
const social=()=>root.TrialumSocial?.getState?.()||{};
const state={active:false,ready:false,enabled:false,busy:false,error:'',messages:[],events:[],
  friends:[],mutes:[],presets:{},selected:'',pushRegistered:false,pushAvailable:false,
  pushStatus:'unavailable',freeTextEnabled:false,retentionDays:7};
let changed=()=>{},timer=null,loading=false;
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
 state.enabled=/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(api)&&/^[A-Za-z0-9_-]{43}$/.test(token);
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
  state.messages=Array.isArray(inbox.messages)?inbox.messages:[];
  state.events=Array.isArray(inbox.events)?inbox.events:[];
  state.mutes=Array.isArray(inbox.mutes)?inbox.mutes:[];
  state.pushRegistered=inbox.pushRegistered===true;
  state.friends=social().friends||[];
  if(!state.friends.some(f=>f.id===state.selected))state.selected=state.friends[0]?.id||'';
  state.pushStatus=native().pushStatus?.()||'unavailable';
 }catch(e){state.ready=false;state.error=errors[e.message]||'Не можам да ги вчитам пораките. Провери ја врската.';}
 finally{loading=false;emit();}
}
function activate(){
 if(state.active)return;
 state.active=true;
 if(config())refresh();
 timer=setInterval(()=>{if(state.active && !root.document?.hidden)refresh()},25000);
 emit();
}
function deactivate(){state.active=false;clearInterval(timer);timer=null;}
async function run(fn){
 if(state.busy)return null;
 state.busy=true;state.error='';emit();
 try{return await fn();}
 catch(e){state.error=errors[e.message]||'Не успеа акцијата. Пробај повторно.';emit();return null;}
 finally{state.busy=false;emit();}
}
async function send(receiverId,presetId,text=''){
 return run(async()=>{
  if(!uuidRe.test(receiverId))throw Error('invalid_recipient');
  const kind=text?'text':'preset',body=text?{text:String(text).slice(0,120)}:{presetId};
  const result=await req('send','POST',{receiverId,eventKey:randomId(),kind,...body});
  await refresh();return result;
 });
}
async function mark(id,kind='message'){
 return run(async()=>{
  if(!uuidRe.test(id))throw Error('invalid_message');
  await req((kind==='event'?'events/':'cards/')+id+'/read','POST',{});
  await refresh();return true;
 });
}
async function remove(id,kind='message'){
 return run(async()=>{
  if(!uuidRe.test(id))throw Error('invalid_message');
  await req((kind==='event'?'events/':'cards/')+id,'DELETE');
  await refresh();return true;
 });
}
async function report(id,reason='spam'){
 return run(async()=>{
  if(!uuidRe.test(id)||!['spam','bullying','unsafe','other'].includes(reason))throw Error('invalid_message');
  await req('cards/'+id+'/report','POST',{reason});
  return true;
 });
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
 const me=social().identity?.id;
 let html='<div class="tab-main message-hub"><div class="message-heading"><div><p class="microcap">ПРИВАТНИ КАРТИЧКИ · 1.6-LW</p><h2>💌 Пријателски пораки</h2></div><span class="tag">Без јавен чет</span></div>'+
 '<p class="desc">Кратки пораки само меѓу потврдени пријатели. Зачувување најмногу 7 дена; без реклами, следење или пораки во JSON бекап.</p>';
 if(state.error)html+='<p class="notice" role="status">'+esc(state.error)+'</p>';
 html+='<div class="card"><h3>✉️ Испрати пријателска фраза</h3>'+
   '<label for="msgFriend">Избери пријател</label><select id="msgFriend" aria-label="Пријател">'+
   (state.friends.length?state.friends.map(f=>'<option value="'+esc(f.id)+'"'+(f.id===state.selected?' selected':'')+'>'+esc(f.nickname)+'</option>').join(''):'<option value="">Нема пријатели</option>')+
   '</select><div class="message-presets">'+Object.entries(state.presets).map(([id,label])=>
    '<button data-do="msgSend" data-preset="'+esc(id)+'"'+(!state.friends.length||state.busy?' disabled':'')+'>'+esc(label)+'</button>').join('')+'</div>'+
   (state.freeTextEnabled?'<label for="msgCustom">Кратка порака (до 120 знаци)</label><textarea id="msgCustom" maxlength="120" rows="2" placeholder="Без линкови или лични контакти"></textarea><button data-do="msgCustomSend">Испрати кратка порака</button>':'<p class="small subtle">🔒 Слободниот текст е исклучен додека не заврши безбедносната ревизија. Готовите фрази се достапни.</p>')+
   '</div>';
 html+='<div class="card"><h3>🔔 Android известувања</h3>'+
   '<p class="desc">Доброволно вклучување. На заклучен екран се прикажува само „Имаш ново известување“, без текстот на пораката или детали за миленичето.</p>';
 if(state.pushStatus==='unavailable'||!state.pushAvailable)
  html+='<p class="notice">FCM не е конфигуриран за оваа тестна верзија. Сандачето работи со рачно освежување.</p>';
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
 html+='</div><div class="card"><div class="message-heading"><h3>📨 Моето сандаче</h3><button data-do="msgRefresh">Освежи</button></div>';
 html+=state.messages.length?state.messages.map(m=>
   '<div class="message-card"><div><strong>'+(m.mine?'➡️ До '+esc(m.receiverName):'📥 Од '+esc(m.senderName))+'</strong><span class="small subtle"> · '+esc(formatDate(m.sentAt))+'</span></div>'+
   '<p class="message-content">'+esc(m.text)+'</p>'+
   '<div class="btn-line">'+(!m.mine&&!m.readAt?'<button data-do="msgRead" data-id="'+esc(m.id)+'">✓ Прочитано</button>':'')+
   '<button data-do="msgDelete" data-id="'+esc(m.id)+'">Избриши</button>'+
   (!m.mine?'<button data-do="msgReport" data-id="'+esc(m.id)+'">Пријави</button>':'')+'</div></div>').join('')
   :'<p class="subtle">Сандачето е празно. Испрати ја првата пријателска порака!</p>';
 html+='</div><div class="card"><h3>🌿 Известувања од играта</h3>';
 html+=state.events.length?state.events.map(e=>
  '<div class="message-card"><strong>'+esc(e.label)+'</strong><p class="small">'+esc(e.actorName)+' · '+esc(formatDate(e.createdAt))+'</p>'+
  '<div class="btn-line">'+(!e.readAt?'<button data-do="msgEventRead" data-id="'+esc(e.id)+'">✓ Прочитано</button>':'')+
  '<button data-do="msgEventDelete" data-id="'+esc(e.id)+'">Избриши</button></div></div>').join('')
  :'<p class="subtle">Нема нови покани или настани.</p>';
 html+='</div><div class="card"><h3>🔕 Исклучи звучни/Push известувања од пријател</h3>'+
  '<p class="small subtle">Мутирањето го исклучува Push од тој пријател, но пораките остануваат во сандачето. За целосна забрана користи Блокирај во Пријатели.</p>';
 html+=state.friends.map(f=>'<div class="message-mute"><span>'+esc(f.nickname)+'</span><button data-do="msgMute" data-id="'+esc(f.id)+'">'+
  (state.mutes.includes(f.id)?'🔔 Вклучи Push':'🔕 Исклучи Push')+'</button></div>').join('')||'<p class="small subtle">Нема потврдени пријатели.</p>';
 return html+'</div></div>';
}
root.TrialumMessages={activate,deactivate,refresh,render,send,mark,remove,report,mute,pushToggle,pushEvent,
 onChange(fn){changed=fn},getState(){return {...state}},select(id){state.selected=id;}};
if(typeof module==='object'&&module.exports)module.exports={};
})(typeof globalThis!=='undefined'?globalThis:this);
