/* TRIALUM 1.5.6-B opt-in friends. No tracking, no Google requirement.
 * Account credentials are kept only in native Android Keystore-backed storage,
 * NEVER in local game saves, localStorage, backup JSON or shared URLs. */
(function(root){
'use strict';
const native=()=>root.TrialumAndroid||null;
const safe=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const CODE=/^[A-Za-z0-9_-]{43}$/;
const state={enabled:false,online:false,ready:false,busy:false,identity:null,friends:[],code:'',pending:'',preview:null,nearbyStatus:'',error:'',expiresAt:'',server:''};
let credential='',changed=()=>{};
const emit=()=>changed();
function parseCode(text, base=state.server){
  if(typeof text!=='string'||text.length>1024)return '';
  const x=text.trim();
  if(CODE.test(x))return x;
  const rootUrl=String(base||'').trim().replace(/\/$/,'');
  if(rootUrl && /^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(rootUrl)){
    const urls=x.match(/https:\/\/[^\s<>"']+\/invite#[A-Za-z0-9_-]{43}/ig)||[];
    for(const url of urls){try{const u=new URL(url);if(u.origin===rootUrl && u.pathname==='/invite' && CODE.test(u.hash.slice(1)))return u.hash.slice(1);}catch(_){}}
  }
  // Accept only own explicitly registered deep-link scheme; never follow arbitrary URLs.
  const match=/trialum:\/\/invite\/([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/i.exec(x);
  if(match)return match[1];
  const labeled=/(?:^|\n)(?:Код|Code):?\s*([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/i.exec(x);
  return labeled?labeled[1]:'';
}
function setError(e){
  const map={
    invite_invalid_or_expired:'Поканата истекла или веќе е искористена.',
    blocked:'Пријателството не е дозволено.',
    self_invitation:'Ова е твојата сопствена покана.',
    authentication_required:'Профилот не е активен. Потребно е повторно поврзување.',
    rate_limited:'Премногу обиди. Пробај подоцна.',
    social_service_disabled:'Серверот за пријатели сè уште не е активиран.'
  };
  state.error=map[e?.message]||'Не успеа поврзувањето. Провери интернет и сервер.';
  emit();
}
async function request(path,method='GET',body=null,key=credential){
  if(!state.server)throw Error('social_service_disabled');
  const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),7000);
  try{
    const res=await fetch(state.server+'/v1/social/'+path,{
      method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(key?{Authorization:'Bearer '+key}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),signal:ctrl.signal,cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'
    });
    const payload=await res.json().catch(()=>({}));
    if(!res.ok)throw Error(payload.error||'server_unavailable');
    return payload;
  }finally{clearTimeout(timeout);}
}
async function run(fn){
  if(state.busy)return null;
  state.busy=true;state.error='';emit();
  try{return await fn();}catch(e){setError(e);return null;}
  finally{state.busy=false;emit();}
}
async function init(){
  state.server=String(native()?.socialApiUrl?.()||'').trim().replace(/\/$/,'');
  state.enabled=/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(state.server);
  credential=String(native()?.socialCredential?.()||'');
  if(!CODE.test(credential))credential='';
  const deep=native()?.socialPendingInvite?.();
  if(deep)state.pending=parseCode(deep);
  if(!state.enabled){state.error='Онлајн пријателите ќе се активираат кога серверот ќе добие јавна HTTPS адреса.';emit();return;}
  // Privacy invariant: no connection to the social server until a player opted in.
  if(!credential){emit();return;}
  try{const status=await request('status','GET',null,'');state.online=status.ready===true;}catch(e){state.online=false;setError(e);}
  if(state.online)await refresh();
  emit();
}
async function refresh(){
  return run(async()=>{
    if(!credential){state.identity=null;state.friends=[];state.ready=false;return;}
    const me=await request('me');
    const list=await request('friends');
    state.identity=me;state.friends=list.friends||[];state.ready=true;state.online=true;
  });
}
async function register(name){
  return run(async()=>{
    if(!state.enabled||!native()?.socialStoreCredential)throw Error('social_service_disabled');
    const response=await request('register','POST',{nickname:String(name||'').trim()});
    const secret=response.credential;
    if(!CODE.test(secret))throw Error('invalid_credential');
    if(!native().socialStoreCredential(secret)){
      await request('account','DELETE',null,secret).catch(()=>{});
      throw Error('secure_storage_unavailable');
    }
    credential=secret;state.identity={id:response.id,nickname:response.nickname};state.ready=true;state.online=true;
    const list=await request('friends');state.friends=list.friends||[];
    return state.identity;
  });
}
async function invite(){
  return run(async()=>{
    if(!credential)throw Error('authentication_required');
    const data=await request('invites','POST');
    state.code=data.code;state.expiresAt=data.expiresAt;
    return data.code;
  });
}
async function revokeInvite(){
  return run(async()=>{await request('invites','DELETE');state.code='';state.expiresAt='';return true;});
}
async function preview(raw=state.pending){
  return run(async()=>{
    const code=parseCode(raw);
    if(!code)throw Error('invalid_invite');
    if(!credential)throw Error('authentication_required');
    state.pending=code;
    const v=await request('invites/preview','POST',{code});
    state.preview=v.inviter;
    return v;
  });
}
async function accept(){
  return run(async()=>{
    if(!state.preview||!CODE.test(state.pending))throw Error('invalid_invite');
    const reply=await request('invites/accept','POST',{code:state.pending});
    state.pending='';state.preview=null;state.code='';
    const list=await request('friends');state.friends=list.friends||[];
    return reply;
  });
}
async function remove(id,block=false){
  return run(async()=>{
    if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('invalid_friend');
    await request('friends/'+id+(block?'/block':''),block?'POST':'DELETE');
    const list=await request('friends');state.friends=list.friends||[];
    return true;
  });
}
async function deleteAccount(){
  return run(async()=>{
    await request('account','DELETE');
    native()?.pushDisable?.();
    native()?.socialClearCredential?.();
    credential='';state.identity=null;state.ready=false;state.friends=[];state.code='';state.preview=null;state.pending='';
    return true;
  });
}
function receive(raw){const code=parseCode(raw);if(!code)return false;state.pending=code;state.preview=null;emit();return true;}
// Share sheets / Android intents are OUTSIDE the WebView DOM translator.
// Explicitly translate these messages in the selected UI language instead
// of sending fixed Macedonian text to an English-speaking friend.
function inviteMessage(code=state.code,server=state.server){
  if(!CODE.test(code))return '';
  const translate=value=>root.TrialumI18n?.t?.(value)||value;
  const link=String(server).replace(/\/$/,'')+'/invite#'+code;
  return '🐾 '+translate('ТРИАЛУМ — покана за пријателство')+'\n'+
    translate('Отвори ја поканата:')+' '+link+
    '\n'+translate('Ако линкот не се отвори, внеси го кодот:')+'\n'+code+
    '\n'+translate('Поканата важи 15 минути.');
}
function share(){
  if(!CODE.test(state.code))return false;
  const message=inviteMessage();
  if(native()?.shareText){native().shareText(message);return true;}
  if(navigator.share){navigator.share({title:root.TrialumI18n?.t?.('ТРИАЛУМ покана')||'ТРИАЛУМ покана',text:message}).catch(()=>{});return true;}
  return false;
}
function inviteLink(){return CODE.test(state.code)?state.server+'/invite#'+state.code:'';}
function nearbyEvent(event){
  if(!event || typeof event!=='object')return;
  state.nearbyStatus=String(event.message||'').slice(0,120);
  if(event.kind==='invite' && receive(String(event.message||''))){
    preview().catch(()=>{});
  }
  emit();
}
function render(){
  const label=state.online?'Поврзано со серверот за пријатели':(state.enabled?(state.identity?'Серверот моментално е недостапен':'Поврзи се доброволно со серверот за пријатели'):'Онлајн серверот не е конфигуриран за оваа верзија');
  let html='<section class="social-hub"><div class="social-header"><span class="social-icon">🤝</span><div><h2>Пријатели</h2><p class="small subtle">'+safe(label)+'</p></div></div>';
  html+='<p class="desc">Покани пријател со еден линк. Нема задолжителен Google профил, реклами или споделување лични податоци. Сопствениот свет работи и офлајн.</p>';
  if(state.error)html+='<div class="notice social-warning" role="status">'+safe(state.error)+'</div>';
  if(!state.enabled){html+='<div class="notice">🔒 Заедничките пријателства ќе бидат достапни кога ќе се поврзе безбедната HTTPS адреса. Дотогаш твоите миленици остануваат локално зачувани.</div>';}
  else if(!state.identity){
    html+='<div class="card social-hero"><h3>✨ Создај приватен профил за дружба</h3>'+
      '<p class="desc">Потребно е само име во играта. Таен клуч се чува во Android Keystore, не во светот или JSON бекап.</p>'+
      '<label for="socialNick">Име во играта</label><input id="socialNick" maxlength="32" autocomplete="off" placeholder="Чувар на искра">'+
      '<div class="btn-line"><button class="primary" data-do="socialRegister"'+(state.busy?' disabled':'')+'>Создај профил</button></div></div>';
  }else{
    html+='<div class="social-identity"><span>👤 '+safe(state.identity.nickname)+'</span><span class="tag">Приватен профил</span></div>'+
      '<div class="cards"><div class="card social-hero"><h3>📤 Покани пријател</h3><p class="desc">Прати покана преку Android споделување. Важи 15 минути.</p>'+
      '<button class="primary" data-do="socialInvite"'+(state.busy?' disabled':'')+'>Создај покана</button>'+
      (state.code?'<div class="social-code"><span>'+safe(state.code.slice(0,7))+'…</span><button data-do="socialShare">Сподели</button><button data-do="socialCopy">Копирај</button><button data-do="socialRevoke">Поништи</button></div>':'')+'</div>'+
      '<div class="card"><h3>📥 Прифати покана</h3><p class="desc">Допрете линк или залепете го краткиот код.</p>'+
      '<label for="socialCode">Код или TRIALUM линк</label><textarea id="socialCode" class="signal-box" rows="2" maxlength="1024" placeholder="Внеси код">'+safe(state.pending)+'</textarea>'+
      '<button data-do="socialPreview"'+(state.busy?' disabled':'')+'>Провери покана</button>'+
      (state.preview?'<div class="social-confirm">👋 Покана од <b>'+safe(state.preview.nickname)+'</b><div class="btn-line"><button class="primary" data-do="socialAccept">✓ Прифати</button><button data-do="socialDecline">Откажи</button></div></div>':'')+'</div></div>';
    html+='<div class="card social-nearby"><h3>📡 Пријател во близина</h3>'+
      '<p class="desc">Само ако двајцата доброволно ја активирате опцијата. Android ќе побара дозволи за Bluetooth/блиски уреди. Споредете го кодот на двата телефона пред да прифатите. Не се собира локација.</p>'+
      '<div class="btn-line"><button data-do="socialNearbyHost"'+(state.busy?' disabled':'')+'>📡 Испрати во близина</button>'+
      '<button data-do="socialNearbyScan"'+(state.busy?' disabled':'')+'>🔎 Пронајди близок</button>'+
      '<button data-do="socialNearbyStop">✕ Запри пребарување</button></div>'+
      (state.nearbyStatus?'<p class="small" role="status">'+safe(state.nearbyStatus)+'</p>':'')+
      '</div>';
    html+='<div class="card"><div class="social-header"><h3>🐾 Мои пријатели ('+state.friends.length+')</h3><button data-do="socialRefresh">Освежи</button></div>'+
      (state.friends.length?state.friends.map(f=>'<div class="friend-item social-friend"><b>👋 '+safe(f.nickname)+'</b><div class="btn-line">'+
       '<button data-do="socialRemove" data-id="'+safe(f.id)+'">Отстрани</button><button data-do="socialBlock" data-id="'+safe(f.id)+'">Блокирај</button></div></div>').join(''):'<p class="subtle">Сè уште немаш пријатели. Испрати ја првата покана!</p>')+'</div>'+
      '<p class="small subtle">Посетите во домот, заедничката игротека и пораките се дел од 1.6-LW. Известувањата за пораки ќе се проверат по LW.</p>'+
      '<div class="btn-line"><button data-do="socialDelete">Избриши социјален профил</button></div>';
  }
  return html+'</section>';
}
root.TrialumSocial={init,refresh,register,invite,revokeInvite,preview,accept,remove,deleteAccount,receive,share,inviteLink,nearbyEvent,render,parseCode,
 setPending(value){state.pending=parseCode(value);state.preview=null;emit();},clearPreview(){state.preview=null;state.pending='';emit();},
 onChange(fn){changed=fn},getState(){return {...state,friends:state.friends.slice()}}};
if(typeof module==='object'&&module.exports)module.exports={parseCode,inviteMessage};
})(typeof globalThis!=='undefined'?globalThis:this);
