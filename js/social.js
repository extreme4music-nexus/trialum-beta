/* TRIALUM 1.4 v44 opt-in friends. No tracking, no Google requirement.
 * Account credentials are kept only in native Android Keystore-backed storage,
 * NEVER in local game saves, localStorage, backup JSON or shared URLs. */
(function(root){
'use strict';
const native=()=>root.TrialumAndroid||null;
// Internal-beta builds grant social access for invited tester work after consent.
// Normal Play release builds remain gated by an eligible native Age Signals result.
const betaTestBuild=()=>native()?.betaTesterToolsEnabled?.()===true;
const socialAccessAllowed=()=>((state.ageAllowed&&native()?.ageSignalsAdultEligible?.()===true)||betaTestBuild());
const safe=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const CODE=/^[A-Za-z0-9_-]{43}$/;
const PROFILE_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const state={enabled:false,online:false,ready:false,busy:false,recoveryEnabled:false,identity:null,friends:[],code:'',pending:'',preview:null,nearbyStatus:'',error:'',expiresAt:'',server:'',ageAllowed:false,ageStatus:'unchecked',socialConsented:false};
let credential='',changed=()=>{},pendingRecovery=null;
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
    social_service_disabled:'Серверот за пријатели сè уште не е активиран.',
    personal_data_blocked:'Не користи вистинско име или контактни податоци. Избери измислен прекар.',
    recovery_unavailable:'Враќањето не е овозможено на серверот. Профилот не е променет.',
    recovery_unavailable_or_invalid:'ID-то или recovery-клучот се невалидни, профилот е избришан или привремено е заклучен.',
    recovery_kit_required:'Не може безбедно да се создаде профил без серверска recovery-функција.',
    secure_storage_unavailable:'Android не успеа безбедно да го зачува токенот на уредот.'
  };
  state.error=map[e?.message]||'Не успеа поврзувањето. Провери интернет и сервер.';
  emit();
}
async function request(path,method='GET',body=null,key=credential){
  if(!state.socialConsented)throw Error('social_consent_required');
  if(!socialAccessAllowed())throw Error('age_gate_required');
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
  if(!state.socialConsented){state.error='Прво прочитај и прифати ги условите за социјалните услуги.';emit();return null;}
  if(!state.ageAllowed||native()?.ageSignalsAdultEligible?.()!==true){state.error='Социјалните функции бараат потврден Google Play 18+ сигнал и согласност.';emit();return null;}
  state.busy=true;state.error='';emit();
  try{return await fn();}catch(e){setError(e);return null;}
  finally{state.busy=false;emit();}
}
async function init(){
  state.socialConsented=root.TrialumLegal?.socialAccepted?.()===true;
  state.server=String(native()?.socialApiUrl?.()||'').trim().replace(/\/$/,'');
  state.enabled=/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(state.server);
  state.ageAllowed=native()?.ageSignalsAdultEligible?.()===true;
  state.ageStatus=state.ageAllowed?'adult_signal':(betaTestBuild()?'beta_test_access':'unchecked');
  if(!state.socialConsented){state.online=false;state.ready=false;emit();return;}
  if(!socialAccessAllowed()){state.online=false;emit();return;}
  credential=String(native()?.socialCredential?.()||'');
  if(!CODE.test(credential))credential='';
  const deep=native()?.socialPendingInvite?.();
  if(deep)state.pending=parseCode(deep);
  if(!state.enabled){state.error='Онлајн пријателите ќе се активираат кога серверот ќе добие јавна HTTPS адреса.';emit();return;}
  state.recoveryEnabled=!!(native()?.socialStoreCredential&&native()?.socialShowRecoveryKit&&
    native()?.socialGenerateRecoveryKey&&native()?.socialConfirmPreparedRecovery);
  // Privacy invariant: no connection to the social server until a player opted in.
  if(!credential){emit();return;}
  try{const status=await request('status','GET',null,'');
    state.online=status.ready===true;
    state.recoveryEnabled=status.accountRecoveryEnabled===true&&status.recoveryVersion===1;
  }catch(e){state.online=false;state.recoveryEnabled=false;setError(e);}
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
    if(!socialAccessAllowed())throw Error('age_gate_required');
    if(!state.enabled||!native()?.socialStoreCredential)throw Error('social_service_disabled');
    const nickname=String(name||'').trim();
    const privacy=root.TrialumPrivacyGuard?.inspect?.(nickname)||{};
    if(privacy.blocked)throw Error('personal_data_blocked');
    const source='Користи само измислен прекар. Прекарот и имињата на милениците може да се испратат до социјалниот сервер на Trialum и да им се прикажат на прифатените пријатели. Не внесувај вистинско име, контактни податоци, училиште или локација. Автоматската проверка не може да го препознае секое вистинско име. Продолжи?';
    const warning=root.TrialumI18n?.t?.(source)||source;
    if(!root.confirm?.(warning))return null;
    // Fail closed with older servers: profile registration without recovery
    // would leave users permanently locked out after an uninstall.
    const support=await request('status','GET',null,'');
    if(support.accountRecoveryEnabled!==true||support.recoveryVersion!==1||
       !native()?.socialShowRecoveryKit)throw Error('recovery_kit_required');
    const response=await request('register','POST',{nickname,nicknamePrivacyConfirmed:true});
    const secret=response.credential;
    if(!CODE.test(secret)||!PROFILE_ID.test(response.id)||!CODE.test(response.recoveryKey))
      throw Error('recovery_kit_required');
    if(!native().socialStoreCredential(secret)){
      await request('account','DELETE',null,secret).catch(()=>{});
      throw Error('secure_storage_unavailable');
    }
    credential=secret;state.identity={id:response.id,nickname:response.nickname};
    state.ready=true;state.online=true;state.recoveryEnabled=true;
    // Native Dialog is screenshot-protected, not part of the HTML world.
    // The code is never persisted in the encrypted game archive or web storage.
    native().socialShowRecoveryKit(response.id,response.recoveryKey);
    const list=await request('friends');state.friends=list.friends||[];
    return state.identity;
  });
}
// A currently authenticated owner can rotate/reissue a lost kit. Pre-v44
// accounts must use this on their existing device before uninstalling.
async function issueRecoveryKit(){
 return run(async()=>{
  if(!state.identity||!credential||!state.recoveryEnabled||
     !native()?.socialShowRecoveryKit)throw Error('recovery_unavailable');
  const en=root.TrialumI18n?.language?.()==='en';
  if(!root.confirm?.(en?
   'Generate a NEW recovery key? Your previous recovery key will immediately stop working. Save the new key in the protected screen.':
   'Да создадеме НОВ recovery-клуч? Претходниот веднаш ќе престане да важи. Зачувај го новиот клуч од заштитениот прозорец.'))return null;
  const kit=await request('recovery/issue','POST',{confirm:true});
  if(!PROFILE_ID.test(kit.id)||!CODE.test(kit.recoveryKey)||kit.id!==state.identity.id)
    throw Error('recovery_unavailable');
  native().socialShowRecoveryKit(kit.id,kit.recoveryKey);
  return true;
 });
}
// Phase 1: display a NEW 256-bit key in native secure UI BEFORE changing
// anything on the server. The user confirms that it is saved.
function startRecovery(id,key){
 if(state.busy||!state.socialConsented||!socialAccessAllowed())return false;
 if(!state.recoveryEnabled||!native()?.socialGenerateRecoveryKey||
   !native()?.socialConfirmPreparedRecovery||!native()?.socialStoreCredential){
  state.error='Безбедното враќање не е достапно во оваа верзија на Android.';
  emit();return false;
 }
 if(!PROFILE_ID.test(id)||!CODE.test(key)){
  state.error='Внеси валиден профил ID и целосен таен recovery-клуч.';
  emit();return false;
 }
 if(state.identity){
  state.error='Прво исклучи го постојниот активен профил на овој уред.';
  emit();return false;
 }
 const en=root.TrialumI18n?.language?.()==='en';
 if(!root.confirm?.(en?
  'Restore this server profile? The previous device will be signed out. Your local world will NOT be replaced.':
  'Да го вратиш овој серверски профил? Претходниот уред ќе биде одјавен. Локалниот свет НЕ се заменува.'))return false;
 const next=String(native().socialGenerateRecoveryKey()||'');
 if(!CODE.test(next)||next===key)return false;
 pendingRecovery={id,oldKey:key,nextKey:next,expires:Date.now()+300000};
 state.error='';emit();
 native().socialConfirmPreparedRecovery(id,next);
 return true;
}
// Called ONLY after the user acknowledges the newly displayed kit. This is
// an additional safety step, not a claim of independent server-side MFA.
async function acceptPreparedRecovery(id,newKey){
 const pending=pendingRecovery;
 pendingRecovery=null;
 if(!pending||Date.now()>pending.expires||pending.id!==id||
   pending.nextKey!==newKey)return null;
 return run(async()=>{
  const restored=await request('recovery/restore','POST',{
   id:pending.id,recoveryKey:pending.oldKey,nextRecoveryKey:pending.nextKey
  },'');
  if(restored.id!==pending.id||!CODE.test(restored.credential)||!restored.recoveryKitRotated)
    throw Error('recovery_unavailable');
  if(!native().socialStoreCredential(restored.credential)){
   // Old and new recovery keys were already shown before the transaction;
   // the user can retry. Never pretend credentials were saved.
   throw Error('secure_storage_unavailable');
  }
  credential=restored.credential;
  state.identity={id:restored.id,nickname:restored.nickname};
  state.online=true;state.ready=true;
  const friends=await request('friends');state.friends=friends.friends||[];
  return state.identity;
 });
}
root.TrialumRecoveryKitAccepted=(id,key)=>{acceptPreparedRecovery(id,key);};

function requestAgeCheck(){
  if(!state.socialConsented){state.error='Прво прочитај и прифати ги условите за социјалните услуги.';emit();return false;}
  if(!native()?.requestAgeSignals){state.ageStatus='unavailable';state.error='За безбедна потврда е потребна официјалната Android апликација од Google Play.';emit();return false;}
  state.ageAllowed=false;state.online=false;state.ready=false;state.identity=null;state.friends=[];
  root.TrialumMessages?.deactivate?.();root.TrialumShared?.deactivate?.();root.TrialumPeer?.clear?.();native()?.nearbyStop?.();
  state.error='';state.ageStatus='checking';emit();native().requestAgeSignals();return true;
}
function setAgeSignal(result){
  if(!state.socialConsented){state.ageAllowed=false;state.ageStatus='social_consent_required';state.online=false;state.ready=false;emit();return;}
  const eligible=result?.status==='adult_signal'&&result?.adultEligible===true&&native()?.ageSignalsAdultEligible?.()===true;
  state.ageAllowed=eligible;state.ageStatus=eligible?'adult_signal':String(result?.status||'unavailable');
  if(!eligible&&betaTestBuild()){
    state.error='Age Signals не даде дозволен одговор; пристапот останува отворен само за интерното бета тестирање.';
    emit();return init();
  }
  if(!eligible){state.online=false;state.ready=false;state.identity=null;state.friends=[];root.TrialumMessages?.deactivate?.();root.TrialumShared?.deactivate?.();root.TrialumPeer?.clear?.();native()?.nearbyStop?.();state.error='Социјалните функции остануваат заклучени: не е споделен сигнал за возрастна група 18+.';emit();return;}
  state.error='';emit();return init();
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
  const english=root.TrialumI18n?.language?.()==='en';
  const betaBuild=betaTestBuild();
  const label=state.online?(english?'Connected to the Friends server':'Поврзано со серверот за пријатели'):(state.enabled?(state.identity?(english?'The server is currently unavailable':'Серверот моментално е недостапен'):(english?'Connect to the Friends server voluntarily':'Поврзи се доброволно со серверот за пријатели')):(english?'The online server is not configured for this version':'Онлајн серверот не е конфигуриран за оваа верзија'));
  let html='<section class="social-hub"><div class="social-header"><span class="social-icon">🤝</span><div><h2>'+(english?'Friends':'Пријатели')+'</h2><p class="small subtle">'+safe(label)+'</p></div></div>';
  html+='<p class="desc">'+(english?'Invite a friend with a link. A Google profile is not required to play offline. Your chosen nickname and selected pet details may be shown to friends you accept; never share real-world personal information. Your own world remains available offline.':'Покани пријател со еден линк. Google профил не е задолжителен за основната игра. Прекарот и избраните детали за миленичето може да им се прикажат на прифатените пријатели; не споделувај вистински лични податоци. Сопствениот свет работи и офлајн.')+'</p>';
  if(!state.socialConsented){
    html+='<article class="card social-consent" aria-labelledby="socialConsentTitle"><h3 id="socialConsentTitle">'+(english?'Before enabling Friends and social services':'Пред да ги вклучиш Пријатели и социјалните услуги')+'</h3>'+
      (english?'<p>Friends is optional. The offline game remains available if you choose “Not now”. '+(betaBuild?'Social features are available after consent in this internal tester build; ordinary Play releases still require an eligible 18+ Age Signal.':'Social features require consent, a social profile and an eligible 18+ Age Signal in the normal Play release.')+'</p><h4>What the service processes</h4><ul><li>Your random social profile ID, chosen nickname, friend links and invitations are sent to the Trialum social server to operate the social profile. Accepted friends may see the nickname and selected pet/profile details; shared-room members can see room activity and pet presence.</li><li>Messages travel over HTTPS, but the Trialum server processes them as readable text; stored records are encrypted at rest. Messages are not end-to-end encrypted. The sender, recipient and service operator can access message content while it is relayed. Message records expire within 7 days. Safety reports may be kept for up to 30 days.</li><li>Google Play may provide an age-range eligibility signal to this device. The app checks it on this device for this client; the signal is not sent to the Trialum server. The app does not send your Google email, date of birth or exact age to the Trialum social server.</li><li>Nearby friend discovery uses Android nearby-device permissions only when you start that action; Trialum does not collect location from it. If you separately enable push, Firebase receives a device push token for generic notifications; message text and friend names are not included in notification payloads. Android asks permission separately.</li><li>Your offline game save and local AI pet memories are not sent to the social server.</li><li>For optional account recovery, Trialum stores a one-way keyed verifier linked to your pseudonymous social ID. Your full recovery key is shown once on your device and is not stored as plaintext by the server or included in any game backup. After recovery, the old key and old device login are revoked. This does not restore the local world.</li></ul><h4>Safety and choices</h4><p>Do not share real names, email, phone, address, school, passwords, verification codes or precise location. Automated filters can miss personal information; other players may see content you send. You can block/report users, delete your social profile, or turn off social access on this device. Turning access off does not itself delete the server profile. Read the full <a href="https://dedopero.servegame.com/privacy-policy">Privacy Policy</a> and <a href="https://dedopero.servegame.com/user-agreement">User Agreement</a>.</p><p>Trialum social messages are not private from the service operator while relayed. Do not use them for sensitive or confidential information.</p>':
      '<p>Пријатели се опционални. Офлајн играта останува достапна ако избереш „Не сега“. '+(betaBuild?'Социјалните функции се достапни по согласност во ова интерно бета издание за тестери; обичните Play изданија и понатаму бараат дозволен 18+ Age Signal.':'Социјалните функции бараат согласност, социјален профил и дозволен 18+ Age Signal во редовното Play издание.')+'</p><h4>Кои податоци ги обработува услугата</h4><ul><li>Твојот случаен социјален ID, избраниот прекар, пријателствата и поканите се испраќаат до Trialum социјалниот сервер за да работи профилот. Прифатените пријатели може да го видат прекарот и избраните детали за миленичето/профилот; членовите на заедничката игротека може да ја видат активноста и присуството на миленичето.</li><li>Пораките се пренесуваат преку HTTPS, но Trialum серверот ги обработува како читлив текст; зачуваните записи се шифрираат во мирување. Пораките не се end-to-end шифрирани. Испраќачот, примачот и операторот на услугата може да ја видат содржината додека се пренесува. Записите истекуваат најдоцна за 7 дена. Безбедносните пријави може да се чуваат до 30 дена.</li><li>Google Play може да му даде на овој уред сигнал за возрасна група. Апликацијата го проверува на уредот за овој клиент; сигналот не се испраќа до Trialum серверот. Апликацијата не ја испраќа твојата Google е-пошта, датум на раѓање или точна возраст до социјалниот сервер.</li><li>Пронаоѓањето близок пријател користи Android дозволи за блиски уреди само кога самиот ќе ја активираш функцијата; Trialum не собира локација од неа. Ако посебно ги вклучиш push известувањата, Firebase добива токен за уредот за испраќање општи известувања; текстот на пораките и имињата на пријателите не се во payload-от. Android бара дозвола посебно.</li><li>Офлајн зачувувањето и локалните AI-мемории на милениците не се испраќаат до социјалниот сервер.</li><li>За опционално враќање на профилот, Trialum чува само криптографски проверувач поврзан со твоето социјално ID. Целиот recovery-клуч се прикажува еднаш на уредот, не се чува како читлив текст на серверот и не влегува во бекапот. По враќање стариот клуч и старата најава се поништуваат. Локалниот свет се враќа од посебен бекап.</li></ul><h4>Безбедност и избор</h4><p>Не споделувај вистинско име, е-пошта, телефон, адреса, училиште, лозинка, код за потврда или точна локација. Автоматските филтри може да пропуштат лични податоци; другите играчи може да ја видат содржината што ја испраќаш. Можеш да блокираш/пријавиш корисници, да го избришеш социјалниот профил или да го исклучиш социјалниот пристап на овој уред. Исклучувањето само по себе не го брише серверскиот профил. Прочитај ги целосните <a href="https://dedopero.servegame.com/privacy-policy">Правила за приватност</a> и <a href="https://dedopero.servegame.com/user-agreement">Услови за користење</a>.</p><p>Пораките на Trialum не се приватни од операторот на услугата додека се пренесуваат. Не користи ги за чувствителни или доверливи информации.</p>')+
      '<label class="legal-check"><input id="socialConsentCheck" type="checkbox"><span>'+(english?'I understand the data and safety information and voluntarily enable Friends, shared play and messages.':'Ги разбирам податоците и безбедносните информации и доброволно ги вклучувам Пријатели, заедничката игротека и пораките.')+'</span></label><div class="btn-line"><button data-do="socialConsentLater">'+(english?'Not now':'Не сега')+'</button><button id="socialConsentEnable" class="primary" data-do="socialConsentAccept" disabled>'+(english?'I agree and enable social services':'Се согласувам и ги вклучувам социјалните услуги')+'</button></div><p class="small subtle">'+(english?'Your choice is stored only on this device and is not sent to Trialum.':'Изборот се чува само на овој уред и не се испраќа до Trialum.')+'</p></article>';
    return html+'</section>';
  }
  if(!socialAccessAllowed()){
    html+='<div class="card"><h3>🔒 Социјалните функции се заклучени</h3><p class="desc">За онлајн социјални функции Google Play мора да сподели возрастна група 18+. Изворот може да е самопријавена возраст; тоа не е независна проверка на идентитет. Не бараме датум на раѓање, Google е-пошта или документ. Детски управуван, помлад, одбиен или непознат профил останува офлајн. Ако сигналот не е достапен, основната игра продолжува офлајн.</p>'+
      '<button class="primary" data-do="socialAgeCheck"'+(state.ageStatus==='checking'?' disabled':'')+'>🛡️ Провери возраст со Google Play</button>'+
      '<p class="small subtle">Статус: '+safe(state.ageStatus==='checking'?'Се проверува…':state.ageStatus==='adult_signal'?'Google Play пријавува возраст 18+':'Возрастниот сигнал не е достапен')+'</p>'+
      (credential?'<p class="small">Постоен социјален профил е сочуван, но не се поврзува додека проверката не дозволи пристап.</p>':'')+'</div>';
    if(state.error)html+='<div class="notice social-warning" role="status">'+safe(state.error)+'</div>';
    html+='<div class="btn-line"><button data-do="socialConsentDisable">Исклучи социјални услуги на овој уред</button></div>';
    return html+'</section>';
  }
  if(state.error)html+='<div class="notice social-warning" role="status">'+safe(state.error)+'</div>';
  if(!state.enabled){html+='<div class="notice">🔒 Заедничките пријателства ќе бидат достапни кога ќе се поврзе безбедната HTTPS адреса. Дотогаш твоите миленици остануваат локално зачувани.</div>';}
  else if(!state.identity){
    html+='<div class="card social-hero"><h3>✨ Создај приватен профил за дружба</h3>'+
      '<p class="desc">Користи измислен прекар, не вистинско име, контакт, училиште или локација. Пријателството се воспоставува само со двострана потврда. Таен клуч се чува во Android Keystore, не во светот или JSON бекап.</p>'+ 
      '<label for="socialNick">Име во играта</label><input id="socialNick" maxlength="32" autocomplete="off" placeholder="Чувар на искра">'+
      '<div class="btn-line"><button class="primary" data-do="socialRegister"'+(state.busy||!state.recoveryEnabled?' disabled':'')+'>'+
        (english?'Create profile':'Создај профил')+'</button></div>'+
      (!state.recoveryEnabled?'<p class="notice">'+(english?
       'Safe account recovery requires the updated private server. Registration is paused until the server upgrade.':
       'За безбедно враќање е потребен новиот приватен сервер. Регистрацијата е привремено паузирана.')+'</p>':'')+
      '</div><div class="card social-recovery" data-no-translate>'+
      '<h3>🔐 '+(english?'Restore existing social profile':'Врати постоен социјален профил')+'</h3>'+
      '<p class="small">'+(english?
       'Use the unique ID and one-time recovery secret saved during your previous installation. Restoring keeps Friends, group credits, purchases and room ownership on the server. It does not restore the local world — use the separate encrypted backup for that.':
       'Внеси го единственото ID и тајниот клуч од претходната инсталација. Се враќаат серверските пријатели, заедничките кредити, справите и сопственоста. Локалниот свет се враќа од посебниот шифриран бекап.')+'</p>'+
      '<label for="socialRestoreId">'+(english?'Profile ID':'ID на профилот')+'</label>'+
      '<input id="socialRestoreId" inputmode="text" maxlength="36" autocomplete="off" spellcheck="false" autocapitalize="off">'+
      '<label for="socialRestoreSecret">'+(english?'Secret recovery key':'Таен recovery-клуч')+'</label>'+
      '<input id="socialRestoreSecret" type="password" maxlength="43" autocomplete="off" spellcheck="false" autocapitalize="off">'+
      '<button class="primary" data-do="socialRestoreStart"'+(state.busy||!state.recoveryEnabled?' disabled':'')+'>'+
       (english?'Restore server profile':'Врати серверски профил')+'</button>'+
      '<p class="small subtle">'+(english?
       'Never share this key. A new key will be shown BEFORE recovery replaces the old one.':
       'Не го споделувај клучот. Пред враќањето ќе се прикаже НОВ клуч што треба да го зачуваш.')+'</p></div>';
  }else{
    html+='<div class="social-identity"><span>👤 '+safe(state.identity.nickname)+'</span><span class="tag">Приватен профил</span></div>'+
      '<div class="card social-account-id"><h3>🔐 '+(english?'Your unique social ID':'Твоето единствено социјално ID')+'</h3>'+
      '<p class="desc">'+(english?'Keep your ID and recovery key separately. Your ID is NOT a password.':'Чувај го ID-то одделно од recovery-клучот. ID-то НЕ е лозинка.')+'</p>'+
      '<code>'+safe(state.identity.id)+'</code><div class="btn-line"><button data-do="socialCopyId">'+(english?'Copy ID':'Копирај ID')+'</button>'+
      '<button data-do="socialRecoveryIssue"'+(!state.recoveryEnabled||state.busy?' disabled':'')+'>'+
       (english?'Generate NEW recovery kit':'Создај НОВ recovery-клуч')+'</button></div>'+
      '<p class="small subtle">'+(english?'This key is shown only when created. Saving another kit invalidates the previous one.':
       'Клучот се прикажува само при создавање. Новиот клуч го поништува стариот.')+'</p></div>'+
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
      '<p class="small subtle">Посетите во домот, заедничката игротека и пораките се дел од 1.4 v44. Известувањата за пораки ќе се проверат по LW.</p>'+
      '<p class="small subtle">Ова ги брише серверскиот профил за Пријатели и неговите поврзани социјални податоци; локалниот свет и зачувувањата остануваат на уредот. Бришењето на апликацијата само по себе не го брише онлајн профилот. Избриши го профилот тука пред деинсталација. Надворешниот веб-тек за бришење се подготвува одделно.</p>'+ 
      '<div class="btn-line"><button data-do="socialDelete">Избриши профил и серверски податоци</button></div>';
  }
  if(betaBuild&&!state.ageAllowed){
    html+='<div class="card beta-age-check"><h3>🧪 '+(english?'Beta tester access':'Бета тестерски пристап')+'</h3><p class="small">'+(english?'Social access is enabled for this internal beta after consent. You can still try the Google Play Age Signals check below; its result does not lock this beta build. Normal Play releases keep the 18+ gate.':'Социјалниот пристап е овозможен за ова интерно бета издание по согласност. Можеш да ја провериш Google Play Age Signals функцијата подолу; нејзиниот резултат нема да го заклучи овој бета-билд. Редовните Play изданија го задржуваат 18+ условот.')+'</p><button data-do="socialAgeCheck"'+(state.ageStatus==='checking'?' disabled':'')+'>'+(english?'Test Age Signals':'Тестирај Age Signals')+'</button><p class="small subtle">'+safe(state.ageStatus==='checking'?'Checking…':state.ageStatus)+'</p></div>';
  }
  html+='<div class="card social-consent-control"><h3>'+(english?'Your consent':'Твоја согласност')+'</h3><p class="small subtle">'+(english?'Social services are enabled only on this device. Turning them off stops further network use here; the server profile remains until you delete it using the delete button.':'Социјалните услуги се вклучени само на овој уред. Исклучувањето ја запира понатамошната мрежна употреба тука; серверскиот профил останува сè додека не го избришеш преку копчето за бришење.')+'</p><button data-do="socialConsentDisable">'+(english?'Turn off social services on this device':'Исклучи социјални услуги на овој уред')+'</button></div>';
  return html+'</section>';
}
async function setSocialConsent(enabled){
  if(enabled){if(!root.TrialumLegal?.grantSocialConsent?.())return false;state.socialConsented=true;state.error='';await init();emit();return true;}
  if(root.TrialumLegal?.revokeSocialConsent?.()!==true)return false;state.socialConsented=false;state.ageAllowed=false;state.ageStatus='social_consent_required';state.online=false;state.ready=false;state.identity=null;state.friends=[];state.code='';state.preview=null;
  root.TrialumMessages?.deactivate?.();root.TrialumShared?.deactivate?.();root.TrialumPeer?.clear?.();native()?.nearbyStop?.();emit();return true;
}
root.TrialumSocial={init,refresh,register,startRecovery,acceptPreparedRecovery,issueRecoveryKit,invite,revokeInvite,preview,accept,remove,deleteAccount,receive,share,inviteLink,nearbyEvent,render,parseCode,requestAgeCheck,setAgeSignal,setSocialConsent,isAdultAllowed:()=>state.ageAllowed,isSocialAllowed:()=>socialAccessAllowed()&&state.socialConsented,isSocialProfileActive:()=>socialAccessAllowed()&&state.socialConsented&&state.ready&&!!state.identity,
 setPending(value){state.pending=parseCode(value);state.preview=null;emit();},clearPreview(){state.preview=null;state.pending='';emit();},
 onChange(fn){changed=fn},getState(){return {...state,friends:state.friends.slice()}}};
if(typeof module==='object'&&module.exports)module.exports={parseCode,inviteMessage};
})(typeof globalThis!=='undefined'?globalThis:this);
