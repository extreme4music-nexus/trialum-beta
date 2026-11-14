/* TRIALUM 1.5.4 — Optional Play Games Services v2 integration.
   The local game remains authoritative until the player explicitly restores.
   There is no personal account, no game backend, and no billing. */
(function(root) {
'use strict';
const escape = v => String(v??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const T=(mk,en)=>root.TrialumI18n?.language?.()==='en'?en:mk;
const native=()=>root.TrialumAndroid||null;
const state={
  available:false,configured:false,authenticated:false,playerName:'',playerId:'',
  cloudConsent:false,cloud:null,busy:false,blocked:false,conflict:false,
  status:'',lastAutosave:0,lastScoreSend:0,restoring:false
};
let getWorld=()=>null,restoreWorld=null,notify=()=>{},refreshUI=()=>{},checkedAt=0;
let lastAchievements=new Set();
function resetForAccount(playerId=''){
  if(state.playerId===playerId)return;
  state.playerId=playerId;
  state.cloud=null;state.blocked=false;state.conflict=false;
  state.lastAutosave=0;state.lastScoreSend=0;checkedAt=0;
  lastAchievements.clear();
}

function readNative(){
 const a=native();
 if(!a?.pgsStatus)return;
 try {
  const data=JSON.parse(a.pgsStatus());
   resetForAccount(String(data.playerId||''));
  state.available=true;
  state.configured=Boolean(data.configured);
  state.authenticated=Boolean(data.authenticated);
  state.playerName=data.playerName||'';
  state.cloudConsent=Boolean(data.cloudConsent);
  state.busy=Boolean(data.busy);
 }catch(e){state.status=T('Неуспешен Play Games статус.','Play Games status unavailable.');}
}
function init(options={}){
 if(typeof options.getWorld==='function')getWorld=options.getWorld;
 if(typeof options.restore==='function')restoreWorld=options.restore;
 if(typeof options.notify==='function')notify=options.notify;
 if(typeof options.refreshUI==='function')refreshUI=options.refreshUI;
 readNative();
 if(state.configured)native()?.pgsRefresh?.();
 refreshUI();
}
function feedback(message,alert=false){
 state.status=message||'';
 if(alert)notify(message);
 refreshUI();
}
function onNative(event){
 if(!event||typeof event!=='object')return;
 switch(event.kind){
  case 'unconfigured':
   state.available=true;state.configured=false;state.authenticated=false;
   feedback(T('Play Console проектот сè уште не е конфигуриран.','Play Console setup is required.'));break;
  case 'signedOut':
   resetForAccount('');state.authenticated=false;state.playerName='';state.cloudConsent=false;
   feedback(T('Играта продолжува локално без Google профил.','Local game continues without a Google profile.'));break;
  case 'signedIn':
   resetForAccount(String(event.playerId||''));
    state.available=true;state.configured=true;state.authenticated=true;
   state.playerName=String(event.playerName||'').slice(0,75);
   state.cloudConsent=Boolean(event.cloudConsent);
   feedback(T('Поврзан е Google Play Games профил.','Google Play Games profile connected.'));
   if(Date.now()-checkedAt>5000){checkedAt=Date.now();native()?.pgsCloudCheck?.();}
   break;
  case 'consent':
   state.cloudConsent=Boolean(event.cloudConsent);state.blocked=false;
   feedback(state.cloudConsent?T('Cloud Save е вклучен.','Cloud Save enabled.'):T('Cloud Save е исклучен.','Cloud Save disabled.'));
   break;
  case 'cloudStatus':
   state.cloud=event;
   state.blocked=state.conflict||Boolean(event.exists&&!event.matchesBaseline);
   feedback(event.exists?
     T('Пронајден е облачен свет: ден ','Cloud world found: day ')+(Number(event.day)||0)+'.':
     T('Сè уште нема зачуван облачен свет.','There is no cloud save yet.'));
   break;
  case 'cloudDiverged':
   state.cloud=event;state.blocked=true;
   feedback(T('Облачниот свет е различен. Избери враќање или потврди замена.','A different cloud save exists. Choose restore or explicitly replace.'),true);
   break;
  case 'cloudConflict':
   state.conflict=true;state.blocked=true;
   feedback(T('Google откри конфликт меѓу два облачни света. Автоматското запишување е запрено; зачувај JSON и реши го конфликтот.','Google found two conflicting cloud worlds. Uploads are paused; export JSON before resolution.'),true);
   break;
  case 'cloudSaved':
   state.conflict=false;state.blocked=false;state.lastAutosave=Date.now();state.cloud=null;
   feedback(T('Облачната снимка е предадена на Google за синхронизација.','Cloud snapshot was queued for Google synchronization.'));break;
  case 'cloudCandidate':
   if(state.restoring)return;
   state.restoring=true;
   Promise.resolve().then(async()=>{
    if(!restoreWorld || !event.world || typeof event.world!=='object')throw Error('Cloud world unavailable');
    const accepted=await restoreWorld(event.world,event);
    if(accepted){
     native()?.pgsConfirmRestored?.(String(event.sha||''));
     state.cloudConsent=Boolean(JSON.parse(native()?.pgsStatus?.()||'{}').cloudConsent);
     feedback(T('Облачниот свет е успешно вратен.','Cloud world restored successfully.'));
    }else feedback(T('Враќањето е откажано; локалниот свет не е заменет.','Cloud restore was canceled; local world unchanged.'));
   }).catch(e=>feedback((T('Враќањето не успеа: ','Restore failed: '))+(e?.message||'error'),true))
     .finally(()=>{state.restoring=false;refreshUI();});
   break;
  case 'cloudRestored':
   state.conflict=false;state.blocked=false;state.cloud=null;state.lastScoreSend=0;lastAchievements.clear();
   feedback(T('Локалниот свет е усогласен со облачниот бекап.','Local game is now linked to restored cloud save.'));break;
  case 'cloudDisabled':
   state.cloudConsent=false;
   feedback(T('Прво вклучи Cloud Save.','Enable Cloud Save first.'),true);break;
  case 'busy':break;
  case 'error':
   feedback(T('Google Play Games: ','Google Play Games: ')+String(event.message||'error').slice(0,200),true);break;
  default:break;
 }
}
root.TrialumPlayGamesEvent=onNative;

const officialAchievementIds={
 'first-pet':'first_pet','first-plant':'first_plant','learned':'learned',
 'advanced':'advanced','ecology':'ecology','lab6':'lab6','dna':'dna'
};
function unranked(world){
 // Debugger-modified worlds and imported debugging history must never produce
 // ranked scores or unlock Play Games achievements.
 return !!world?.settings?.debugEnabled||!!world?.settings?.debugEverUsed||
   !!world?.logs?.some(x=>x?.kind==='debug');
}
function submitAchievements(world){
 if(!state.configured||!state.authenticated||!world||unranked(world))return;
 const ids=(world.achievements||[]).map(a=>officialAchievementIds[a?.id]).filter(Boolean);
 if(world.research?.level>=6)ids.push('lab6');
 const toSend=[...new Set(ids)].filter(id=>!lastAchievements.has(id));
 for(const id of toSend){try{native()?.pgsAchievement?.(id);lastAchievements.add(id);}catch(_){}}
}
function submitScores(world){
 if(!state.configured||!state.authenticated||!world||unranked(world))return;
 if(Date.now()-state.lastScoreSend<600_000)return;
 state.lastScoreSend=Date.now();
 const xp=(world.pets||[]).reduce((total,p)=>total+Math.max(0,Number(p.evolution?.earned)||0),0);
 const species=new Set((world.pets||[]).map(p=>p.species)).size;
 try{
  native()?.pgsScore?.('xp',Math.min(2_000_000_000,Math.floor(xp)));
  native()?.pgsScore?.('species',species);
 }catch(_){}
}
function afterLocalSave(world){
 if(!world)return;
 submitAchievements(world);submitScores(world);
 if(!state.configured||!state.authenticated||!state.cloudConsent||state.blocked||state.restoring)return;
 const now=Date.now();
 if(now-state.lastAutosave<90_000)return;
 state.lastAutosave=now;
 try { native()?.pgsCloudSave?.(JSON.stringify(world),false); }
 catch(e){ feedback(T('Автоматскиот облачен бекап не успеа.','Cloud autosave was not available.'),true); }
}
function action(kind,element){
 const n=native();
 switch(kind){
  case 'pgsRefresh':readNative();n?.pgsRefresh?.();return true;
  case 'pgsSignIn':n?.pgsSignIn?.();return true;
  case 'pgsAchievements':n?.pgsShowAchievements?.();return true;
  case 'pgsLeaderboards':n?.pgsShowLeaderboards?.();return true;
  case 'pgsCloudEnable':
   if(!state.configured||!state.authenticated){feedback(T('Прво поврзи Google Play Games.','Connect Google Play Games first.'),true);return true;}
   if(root.confirm?.(T('Да го овозможам автоматскиот Google Cloud Save за овој профил? Локалниот JSON бекап останува достапен.','Enable automatic Google Cloud Save for this profile? Local JSON backup remains available.'))){
    n?.pgsSetCloudConsent?.(true);
   }return true;
  case 'pgsCloudDisable':n?.pgsSetCloudConsent?.(false);return true;
  case 'pgsCloudCheck':checkedAt=Date.now();n?.pgsCloudCheck?.();return true;
  case 'pgsCloudRestore':
   if(root.confirm?.(T('Да ја прочитам облачната снимка? Пред враќање ќе има посебна потврда за замена на локалниот свет.','Read cloud save? Restoring it will require another confirmation before replacing local progress.'))){
    n?.pgsCloudRestore?.();
   }return true;
  case 'pgsCloudSave':{
   const world=getWorld();
   if(!world){feedback(T('Прво започни свет.','Start a world first.'),true);return true;}
   n?.pgsCloudSave?.(JSON.stringify(world),false);return true;
  }
  case 'pgsCloudReplace':{
   if(state.conflict){feedback(T('Google откри конфликт на снимки што бара посебно разрешување. Не може безбедно да се презапише од ова мени.','Google reported a snapshot conflict that requires separate resolution; this menu cannot safely overwrite it.'),true);return true;}
    const world=getWorld();if(!world)return true;
   const msg=T('ВНИМАНИЕ: Ова ќе го замени постојниот Google облачен свет со локалниот свет! Направи JSON бекап и потврди уште еднаш.','WARNING: This will replace the existing Google cloud world with your local world. Export JSON first, then confirm again.');
   if(root.confirm?.(msg)&&root.confirm?.(T('Последна потврда: сигурно сакаш да го замениш облачниот свет?','Final confirmation: overwrite the existing cloud save?'))){
    n?.pgsCloudSave?.(JSON.stringify(world),true);
   }return true;
  }
  default:return false;
 }
}
function button(label,doAction,disabled=false){return '<button data-do="'+doAction+'"'+(disabled?' disabled':'')+'>'+label+'</button>';}
function render(){
 readNative();
 const a=state,exists=!!a.cloud?.exists,day=Number(a.cloud?.day)||0;
 if(!a.available)return '<div class="tab-main"><h2>🎮 Google Play Games</h2><p>'+T('Достапно е во Android апликацијата. HTML играта и понатаму работи офлајн.','Available in the Android app. The HTML game remains fully offline.')+'</p></div>';
 let html='<div class="tab-main"><h2>🎮 Google Play Games</h2><p class="desc">'+
 T('Дополнителен Google профил, постигнувања, рангирања и облачна копија. Нема задолжително логирање или наша сметка.','Optional Google profile, achievements, leaderboards and cloud backup. No mandatory login or separate account.')+'</p>';
 if(!a.configured){
  html+='<div class="notice">⚙️ '+T('Потребна е конфигурација во Play Console (Game project ID, OAuth/SHA-1 и тестери). Играта работи нормално локално.','Set up Play Console (Game project ID, OAuth/SHA-1 and testers). Local play is unaffected.')+'</div>';
  html+=button('🔄 '+T('Провери поврзување','Check configuration'),'pgsRefresh')+'</div>';
  return html;
 }
 html+='<div class="settings-group"><h3>👤 '+T('Играчки профил','Player profile')+'</h3><p>'+
  (a.authenticated?'✓ '+escape(a.playerName||T('Поврзан','Connected')):'○ '+T('Не е поврзан','Not connected'))+'</p><div class="btn-line">'+
  button('🔄 '+T('Освежи','Refresh'),'pgsRefresh')+
  (!a.authenticated?button('🔐 '+T('Поврзи со Google Play Games','Connect Google Play Games'),'pgsSignIn'):'')+
  '</div></div>';
 html+='<div class="settings-group"><h3>🏆 '+T('Постигнувања и рангирања','Achievements & leaderboards')+'</h3><div class="btn-line">'+
  button('🏆 '+T('Постигнувања','Achievements'),'pgsAchievements',!a.authenticated)+
  button('🏅 '+T('Светски рангирања','Leaderboards'),'pgsLeaderboards',!a.authenticated)+
  '</div><p class="small subtle">'+T('Дебагираните светови не испраќаат резултати. Google ID-ата се конфигурираат во Play Console.','Debug worlds never submit rankings. Game IDs are configured in Play Console.')+'</p></div>';
 html+='<div class="settings-group"><h3>☁️ Google Cloud Save</h3><p class="small">'+
  (a.cloudConsent?'✓ '+T('Автоматски бекап е вклучен','Automatic backups enabled'):'○ '+T('Автоматски бекап е исклучен','Automatic backups disabled'))+'</p><div class="btn-line">'+
  (a.cloudConsent?button('⏸ '+T('Исклучи Cloud Save','Disable Cloud Save'),'pgsCloudDisable',!a.authenticated):
   button('☁ '+T('Вклучи Cloud Save','Enable Cloud Save'),'pgsCloudEnable',!a.authenticated))+
  button('🔍 '+T('Провери облак','Check cloud'),'pgsCloudCheck',!a.authenticated)+
  '</div>';
 if(exists)html+='<div class="notice">☁ '+T('Облачен свет: ден ','Cloud world: day ')+day+
   ' · '+Number(a.cloud.pets||0)+' '+T('миленици','pets')+' · '+escape(a.cloud.version||'')+
   (a.cloud.matchesBaseline?' ✓':' ⚠')+'</div>';
 else if(a.cloud)html+='<p class="small subtle">'+T('Нема облачна снимка.','No cloud snapshot yet.')+'</p>';
 html+='<div class="btn-line">'+
  button('⬆ '+T('Зачувај во облак','Save to cloud'),'pgsCloudSave',!a.authenticated||!a.cloudConsent)+
  button('⬇ '+T('Врати од облак','Restore from cloud'),'pgsCloudRestore',!a.authenticated)+
  '</div>';
 if(a.blocked||exists&&!a.cloud.matchesBaseline){
  html+='<p class="small">'+T('Заштита од конфликт: автоматско презапишување е запрено. Можеш да го вратиш облачниот свет или изречно да го замениш по JSON бекап.','Conflict protection: automatic overwrites are paused. Restore the cloud save or explicitly replace it after exporting JSON.')+'</p>'+
  (a.conflict?'<p class="small">'+T('Google има нерешен конфликт на облачни снимки. Запиши JSON бекап; презапишувањето е забрането додека не се разреши конфликтот.','Google has an unresolved cloud snapshot conflict. Export JSON; overwriting is disabled until it is resolved.')+'</p>':button('⚠ '+T('Замени облачен свет','Replace cloud save'),'pgsCloudReplace',!a.authenticated||!a.cloudConsent));
 }
 html+='<p class="small subtle">'+T('Cloud Save не е синхронизиран додека немаш Google профил/мрежа. Враќањето секогаш бара потврда. JSON Бекап и враќање останува во Поставки.','Cloud Save requires a Play Games profile and connectivity. Restoring always requires confirmation. JSON Backup & Restore remains in Settings.')+'</p></div>';
 if(a.status)html+='<p role="status" class="notice" id="pgsFeedback">'+escape(a.status)+'</p>';
 return html+'</div>';
}
root.TrialumPlayGames={init,render,action,afterLocalSave,onNative,status:()=>({...state}),unranked};
})(typeof globalThis!=='undefined'?globalThis:this);
