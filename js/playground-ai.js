/* Optional on-device mini-GGUF playground speech. Background uses its own opt-in native service.
 * The shared server relays ephemeral short text only, never runs inference.
 * No XP, currency, new permission, hidden network prompt, or chat persistence. */
(function(root){
'use strict';
const E=()=>root.TrialumEngine, Presence=()=>root.TrialumPresence;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let currentTab='',pending=null,latestLocal=null,latestShared=null,localSessionKey='';
const Sessions=()=>root.TrialumDialogueSessions;
// Only completed local-model outputs count as AI; scripted topic nudges are
// bounded to one in ten successful turns per enabled pet and playground.
const turnMix=Object.create(null);
function mixFor(scope,p){
 const key=scope+'|'+p.id;
 return turnMix[key]||(turnMix[key]={ai:0,scripted:0});
}
function shouldInject(scope,p){
 const mix=mixFor(scope,p);
 return (mix.ai+mix.scripted+1)%10===0;
}
function counted(scope,p,kind){mixFor(scope,p)[kind]++;}
function diagnostics(scope,p){
 const mix=p?mixFor(scope,p):{ai:0,scripted:0};
 return {llm:mix.ai,scripted:mix.scripted};
}

let saveMemory=()=>{};
let lastBackgroundImport=0;
function importBackground(s){
 const native=root.TrialumAndroid,mem=Memory();
 if(!s?.pets||!native?.backgroundAiMemories||!mem?.ingestBackground)return false;
 let changed=false;
 for(const p of s.pets){
  if(!p?.id||!gate(s,p))continue;
  try{
   const data=JSON.parse(native.backgroundAiMemories(p.id));
   if(mem.ingestBackground(p,data))changed=true;
  }catch(_){/* Invalid/nonexistent native observations cannot modify world. */}
 }
 if(changed)saveMemory();
 return changed;
}

const Memory=()=>root.TrialumPlaygroundMemory;
function storeMemory(p,data){if(Memory()?.remember?.(p,data))saveMemory();}
const lastAttempt=Object.create(null),lastSimulation=Object.create(null);
function gate(s,p){
 const species=Number(p?.species),evolved=Number.isInteger(species)&&species>=4&&!!E()?.SPECIES?.[species];
 return !!(evolved&&E()?.evolutionProgress?.(p)?.level>=22&&(s?.research?.level||0)>=6);
}
function modelAvailable(){
 try{return root.TrialumAndroid?.modelStatus?.()==='installed';}catch(_){return false;}
}
function active(scope){
 return currentTab===scope&&root.document?.visibilityState!=='hidden'&&!root.document?.hidden;
}
function enabled(s,p,scope){
 return gate(s,p)&&!!p?.[scope==='shared'?'playgroundAiShared':'playgroundAiLocal']&&modelAvailable();
}
// Suppress the rapid 3.5/4-second screenplay while THIS pet's opted-in
// model owns the room's dialogue. Offline, uninstalled and disabled AI keep
// the original scripted simulation. No fake AI for remote clients.
function suppressSimulation(scope,s,p,roomId=''){
 if(!active(scope)||!s)return false;
 const choices=s.pets||[];
 if(scope==='playground')return choices.some(p=>enabled(s,p,scope)&&
  Presence()?.isAt?.(s,p.id,Presence().LOCAL));
 if(scope!=='shared')return false;
 const state=root.TrialumShared?.getState?.();
 if(!state?.online||!state?.aiRelayEnabled||!state?.snapshot?.presenceEnabled||
    state.selected!==roomId)return false;
 return choices.some(p=>{
  const loc=Presence()?.get?.(s,p.id);
  return enabled(s,p,scope)&&loc?.kind===Presence()?.SHARED&&
   loc.status==='active'&&loc.ref===roomId&&state.presences?.some(x=>
    x.petId===p.id&&x.sessionId===loc.sessionId&&
    x.kind==='shared'&&x.roomId===roomId);
 });
}
function speech(scope,roomId){
 if(!active(scope))return null;
 const item=scope==='shared'?latestShared:latestLocal;
 if(!item)return null;
 if(scope==='shared'&&item.roomId!==roomId)return null;
 if(Date.now()-item.at>26000)return null; // Keep transient captions fresh; the session ledger retains context.
 return {speaker:item.speaker,text:item.text,partner:item.partner||null,ai:!!item.ai};
}
function control(s,p,scope,present){
 if(!p||!present)return '';
 const ok=gate(s,p),installed=modelAvailable(),
  on=!!p[scope==='shared'?'playgroundAiShared':'playgroundAiLocal'];
 const nativeBackground=!!root.TrialumAndroid?.backgroundAiStatus?.();
 if(!ok)return '<p class="small subtle">🔒 AI во игротека: Синапсо+, лично ниво 22 и лабораторија 6. Симулираните разговори остануваат достапни.</p>';
 const permitted=scope!=='shared'||root.TrialumShared?.getState?.()?.aiRelayEnabled;
 let html='<div class="card"><h3>🧠 Изборен локален AI во игротеката</h3>'+
 '<p class="small">Мини AI по правило разговара додека екранот е видлив; со твоја дозвола може да продолжи и во заднина. Без модел, играта продолжува. Нема AI XP.</p>';
 if(scope==='shared')html+='<p class="small">Кога е вклучен, кратките реплики се испраќаат до присутните членови на оваа приватна игротека. Не се приватни или шифрирани пораки.</p>';
 if(!permitted)html+='<p class="small">Серверската поддршка за AI разговори сè уште не е активирана. Симулираниот разговор работи.</p>';
 if(!installed)html+='<p class="small">Прво преземи го бесплатниот SmolLM2-135M во панелот на миленичето.</p>';
 if(scope==='shared'){
  const state=root.TrialumShared?.getState?.();
  const translated=!!state?.speechTranslationEnabled&&
   state.speechTranslationLanguages?.includes(root.TrialumI18n?.language?.()||'mk');
  if(state?.speechTranslationEnabled&&!translated)
   html+='<p class="small">🌍 Преводите во оваа фаза се достапни само на македонски, албански и англиски.</p>';
  if(!translated)html+='<p class="small">🌍 За background AI прво е потребен приватен серверски преведувач на англиски.</p>';
  if(on&&translated){
   html+='<p class="small">📱 Изборно: продолжи го AI разговорот во заднина со видливо Android известување и копче Stop AI. Се запира при штедење батерија или мала батерија; Android може да го прекине сервисот.</p>';
   html+='<button data-do="pgAiBackgroundToggle"'+(!installed?' disabled':'')+'>'+
    (nativeBackground?'⏹ Исклучи AI во заднина':
     p.playgroundAiBackgroundShared?'▶ Повторно активирај AI во заднина':'📱 Вклучи AI во заднина')+
    '</button>';
  }
 }
 if(on){
  const mix=diagnostics(scope,p);
  const t=label=>root.TrialumI18n?.t?.(label)||label;
  html+='<p class="small subtle">'+t('🧪 QA · вистински локални LLM реплики:')+' '+mix.llm+
   t(' · контролирани симулирани:')+' '+mix.scripted+
   t(' (цел 90/10; без скриени транскрипти)')+'</p>';
 }
 html+='<button data-do="pgAiToggle" data-scope="'+scope+'"'+(!permitted||(!installed&&!on)?' disabled':'')+'>'+
 (on?'🔕 Исклучи AI за ова милениче':'🧠 Вклучи мини AI за ова милениче')+'</button>'+
 (Memory()?.read?.(p)?.length?'<p class="small">🧠 '+esc(Memory()?.overview?.(p)||'')+'</p><button data-do="pgAiForget">🗑 Избриши контекстуални сеќавања</button>':'')+'</div>';
 return html;
}
function toggle(s,scope,notify,save,render){
 if(scope!=='shared'&&scope!=='playground')return false;
 const p=E()?.currentPet?.(s);
 if(!p||!gate(s,p)){notify?.('Прво отклучи го мини AI за ова милениче.');return true;}
 const field=scope==='shared'?'playgroundAiShared':'playgroundAiLocal';
 if(!p[field]){
  if(!modelAvailable()){notify?.('Прво преземи го мини моделот од панелот на миленичето.');return true;}
  if(scope==='shared'){
   if(!root.TrialumShared?.getState?.()?.aiRelayEnabled){notify?.('AI преносот не е вклучен на серверот.');return true;}
   if(root.confirm&&!root.confirm('Дозволуваш кратки AI реплики на ова милениче да се пренесуваат до присутните членови на приватната игротека? Ова не е приватен шифриран разговор.'))return true;
  }
 }
 p[field]=!p[field];
 if(!p[field]){
  if(scope==='shared'&&p.playgroundAiBackgroundShared){
   root.TrialumAndroid?.setPlaygroundBackgroundAi?.(false,'','','','');
   p.playgroundAiBackgroundShared=false;
  }
  stop();
 }
 save?.();render?.();
 return true;
}
function toggleBackground(s,notify,save,render){
 const p=E()?.currentPet?.(s),st=root.TrialumShared?.getState?.(),n=root.TrialumAndroid;
 if(!p||!gate(s,p)||!p.playgroundAiShared||!modelAvailable()||
   !st?.speechTranslationEnabled||
   !st?.speechTranslationLanguages?.includes(root.TrialumI18n?.language?.()||'mk')||
   !st?.online||!st?.selected){
  notify?.('За AI во заднина се потребни активен мини-модел, игротека и серверско преведување.');
  return true;
 }
 if(!n?.setPlaygroundBackgroundAi||!n?.backgroundAiStatus){
  notify?.('AI во заднина бара нова Android апликација.');
  return true;
 }
 if(p.playgroundAiBackgroundShared&&n.backgroundAiStatus()){
  n.setPlaygroundBackgroundAi(false,'','','','');
  p.playgroundAiBackgroundShared=false;
  save?.();render?.();return true;
 }
 const loc=Presence()?.get?.(s,p.id);
 if(loc?.kind!==Presence()?.SHARED||loc?.status!=='active'||loc.ref!==st.selected||
   !st.presences?.some(x=>x.petId===p.id&&x.sessionId===loc.sessionId)){
  notify?.('Прво испрати го миленичето во активната заедничка игротека.');return true;
 }
 if(root.confirm&&!root.confirm('Да продолжи локалниот мини AI со приватни разговори во заднина? Android прикажува известување со Stop AI. Се користи батеријата и интернетот; системот може да го прекине сервисот.'))return true;
 if(!n.setPlaygroundBackgroundAi(true,st.selected,p.id,loc.sessionId,p.name||'Pet')){
  notify?.('Провери ја Android дозволата за известувања и повторно притисни.');return true;
 }
 p.playgroundAiBackgroundShared=true;
 save?.();render?.();notify?.('AI во заднина е побаран. Провери го Android известувањето.');
 return true;
}
function forget(s,notify,save,render){
 const p=E()?.currentPet?.(s);
 if(!p||!Memory()?.read?.(p)?.length)return false;
 if(root.confirm&&!root.confirm('Да ги избришам сите тематски сеќавања на ова милениче од игротеките? Ова не ги менува XP и дневникот.'))return true;
 Memory().clear(p);
 root.TrialumAndroid?.clearBackgroundAiMemories?.(p.id);
 delete p.playgroundAiBackgroundSeen;
 delete p.playgroundAiBackgroundStreamId;
 delete p.playgroundAiBackgroundRevision;
 save?.();render?.();notify?.('Контекстуалните сеќавања се избришани.');return true;
}
function stop(){
 if(pending){root.TrialumAndroid?.cancelPlaygroundAi?.();root.TrialumLocalChat?.finish?.(pending.petId);}
 pending=null;
 latestLocal=null;latestShared=null; // The session ledger survives temporary tab/background transitions.
}
function setTab(tab){
 if(tab!==currentTab){stop();currentTab=tab;}
}
function sanitize(text){
 const raw=String(text||'').replace(/<[^>]*>/g,'').split(/[\r\n]/)[0].trim();
 if(!raw||/https?:\/\/|www\.|\S+@\S+|\+?\d[\d ().-]{7,}\d|[\u0000-\u001f\u007f]/i.test(raw))return '';
 // The tiny model may ignore a length instruction. Enforce one short line at
 // the client boundary before display, relay or thematic summarization.
 const punctuation=/[.!?…。！？]/u.exec(raw);
 const sentence=(punctuation?raw.slice(0,punctuation.index+1):raw).slice(0,112);
 return sentence.split(/\s+/u).slice(0,17).join(' ').trim();
}
function choose(options){return options[Math.floor(Math.random()*options.length)];}
function scriptedSeed(scope,heard,translation){
 const text=String(heard||'').toLowerCase();
 if(scope==='shared'&&translation){
  if(/garden|plant|flower|tree|nature/.test(text))
   return choose(['What else might we discover in the garden?',
    'Shall we look for another plant together?']);
  if(/slide|toy|seesaw|jump|play/.test(text))
   return choose(['Which playground toy should we explore next?',
    'Shall we try another playful challenge together?']);
  return heard?choose(['What did you mean by that?',
   'Can you tell me more about that idea?']):'What shall we explore here?';
 }
 // Existing locale catalog is authoritative where translations exist.
 const phrases=['Ајде да играме заедно!','Сакаш да истражуваме?',
  'Што има зад таа лизгалка?'];
 const phrase=heard?'Може ли да ми кажеш повеќе за тоа?':choose(phrases);
 return root.TrialumI18n?.t?.(phrase)||phrase;
}
function injectScripted(s,p,scope,input,roomId){
 const key=scope+'|'+p.id,now=Date.now();
 if(pending||!active(scope)||!enabled(s,p,scope)||
   now-(lastAttempt[key]||0)<24000)return false;
 const translated=scope==='shared'&&!!root.TrialumShared?.getState?.()?.speechTranslationEnabled;
 const text=scriptedSeed(scope,input?.text,translated);
 if(scope==='shared'){
  if(!root.TrialumShared?.sendPetSpeech?.(s,p,text,translated?'en':'mk',
    input?.turnId||''))return false;
 }else{
  latestLocal={speaker:String(p.name||'Милениче'),text,at:now,ai:false};
  Sessions()?.receive?.('playground',localSessionKey,{id:'local-'+p.id+'-'+now,
   petId:p.id,speaker:p.name,text,replyTo:input?.turnId},now);
  root.TrialumPlayground?.refreshProgress?.(s);
 }
 lastAttempt[key]=now;
 if(input?.turnId)Sessions()?.answered(scope,
  scope==='shared'?roomId:localSessionKey,input.turnId);
 Sessions()?.start(scope,scope==='shared'?roomId:localSessionKey);
 counted(scope,p,'scripted');
 return true;
}
function attempt(s,p,scope,prompt,roomId='',sessionId='',meta={}){
 const now=Date.now(),key=scope+'|'+p.id;
 if(pending||!enabled(s,p,scope)||now-(lastAttempt[key]||0)<24000||!active(scope))return false;
 if(root.TrialumLocalChat?.busy?.()||!root.TrialumAndroid?.askPlaygroundAi)return false;
 if(!root.TrialumLocalChat?.begin?.(p.id))return false;
 lastAttempt[key]=now;
 const translated=scope==='shared'&&!!root.TrialumShared?.getState?.()?.speechTranslationEnabled;
 // Never truncate serialized JSON: native ModelRuntime must parse
 // llmLanguage="en" reliably, even after many rich room turns.
 const contextData={
  llmLanguage:translated?'en':null,
  language:translated?'en':(root.TrialumI18n?.language?.()||'mk'),
  oneShortSentence:true,mode:'fictional_playground',
  species:String(E()?.SPECIES?.[p.species]?.name||'').slice(0,24),
  // Only ephemeral playground speech is included. Never private user-pet chat.
  roomTurns:Sessions()?.context?.(scope,scope==='shared'?roomId:localSessionKey,
   null,980)||[],
  memories:Memory()?.recall?.(p,'',now)?.records?.slice(-1)||[]
 };
 let context=JSON.stringify(contextData);
 while(context.length>1450&&contextData.roomTurns.length){
  contextData.roomTurns.shift();context=JSON.stringify(contextData);
 }
 if(context.length>1450){
  contextData.memories=[];context=JSON.stringify(contextData);
 }
 if(context.length>1450){
  contextData.species='';context=JSON.stringify(contextData);
 }
 if(context.length>1450)throw Error('bounded_playground_context_exceeded');
 pending={petId:p.id,petName:String(p.name||'Милениче'),scope,roomId,sessionId,at:now,
  heard:String(meta.heard||'').slice(0,130),companion:String(meta.companion||'').slice(0,32),
  replyToTurnId:String(meta.replyToTurnId||'')};
 try{
  root.TrialumAndroid.askPlaygroundAi(p.id,p.name,String(prompt).slice(0,320),context);
  return true;
 }catch(_){root.TrialumLocalChat?.finish?.(p.id);pending=null;return false;}
}
function tick(s,tab){
 if(tab!==currentTab)setTab(tab);
 if(root.document?.visibilityState!=='hidden'&&Date.now()-lastBackgroundImport>12000){
  lastBackgroundImport=Date.now();importBackground(s);
 }
 if(!active(tab)||!s)return;
 if(pending&&Date.now()-pending.at>90000){
  root.TrialumAndroid?.cancelPlaygroundAi?.();
  root.TrialumLocalChat?.finish?.(pending.petId);pending=null;
 }
 if(pending||root.TrialumLocalChat?.busy?.())return;
 const now=Date.now(),memory=Sessions();
 if(tab==='playground'){
  const local=(s.pets||[]).filter(p=>Presence()?.isAt?.(s,p.id,Presence().LOCAL));
  localSessionKey=local.map(p=>p.id+':'+(Presence()?.get?.(s,p.id)?.sessionId||''))
   .sort().join('|');
  if(!localSessionKey)return;
  memory?.ensure('playground',localSessionKey);
  const ready=local.filter(p=>enabled(s,p,'playground')&&
   now-(lastAttempt['playground|'+p.id]||0)>=24000);
  const replies=ready.map(p=>({p,input:memory?.next('playground',localSessionKey,p.id,[],now)}))
   .filter(item=>item.input);
  if(replies.length){
   const selected=choose(replies),p=selected.p,input=selected.input;
   const prompt='Your friend '+input.speaker+' previously said: "'+input.text+
    '". Continue this EXISTING conversation in one short sentence. Do not invent a new subject.';
   const scripted=shouldInject(tab,p);
   const success=scripted?injectScripted(s,p,tab,{...input,turnId:input.id},''):
    attempt(s,p,tab,prompt,'','',{heard:input.text,companion:input.speaker,
     replyToTurnId:input.id});
   if(success&&scripted)memory?.answered('playground',localSessionKey,input.id);
   return;
  }
  // An unpowered companion may still contribute a bounded, on-topic line,
  // so a single AI pet can respond to its non-AI friend's actual session turn.
  const nonAi=local.filter(p=>!enabled(s,p,'playground'));
  if(ready.length&&nonAi.length){
   const p=choose(nonAi),key='local-script|'+p.id,prior=memory?.latest('playground',localSessionKey);
   if(now-(lastSimulation[key]||0)>=28000){
    const text=scriptedSeed('playground',prior?.text||'',false);
    if(memory?.receive('playground',localSessionKey,{
     id:'script-'+p.id+'-'+now,petId:p.id,speaker:p.name,text,replyTo:prior?.id},now)){
     lastSimulation[key]=now;
     latestLocal={speaker:p.name,text,at:now,ai:false};
     root.TrialumPlayground?.refreshProgress?.(s);
     return;
    }
   }
  }
  // A single on-topic opening is allowed; subsequent turns require context.
  if(memory?.count('playground',localSessionKey)||memory?.first('playground',localSessionKey))return;
  if(ready.length){
   const p=choose(ready);
   attempt(s,p,tab,'Observe one real playground toy in one short sentence.','','');
  }
 }else if(tab==='shared'){
  const state=root.TrialumShared?.getState?.(),room=state?.selected;
  if(!state?.online||!state.aiRelayEnabled||!state.snapshot?.presenceEnabled||!room)return;
  if(state.speechTranslationEnabled&&
   !state.speechTranslationLanguages?.includes(root.TrialumI18n?.language?.()||'mk'))return;
  memory?.ensure('shared',room);
  const occupants=(state.snapshot.occupants||[]).filter(x=>x?.pet?.id);
  if(occupants.length<2)return;
  const memberIds=occupants.map(x=>x.pet.id);
  const present=(s.pets||[]).filter(p=>{
   const loc=Presence()?.get?.(s,p.id);
   return loc?.kind===Presence()?.SHARED&&loc.status==='active'&&loc.ref===room&&
    memberIds.includes(p.id)&&state.presences?.some(x=>x.petId===p.id&&
    x.sessionId===loc.sessionId&&x.kind==='shared'&&x.roomId===room);
  });
  const ready=present.filter(p=>enabled(s,p,'shared')&&
   now-(lastAttempt['shared|'+p.id]||0)>=24000);
  const replies=ready.map(p=>({p,input:memory?.next('shared',room,p.id,memberIds,now)}))
   .filter(x=>x.input);
  if(replies.length){
   const selected=choose(replies),p=selected.p,input=selected.input;
   const loc=Presence()?.get?.(s,p.id);
   const prompt='Your friend '+input.speaker+' said: "'+input.text+
    '". Answer or continue that SAME topic, in one short sentence. Do not repeat it.';
   const scripted=shouldInject(tab,p);
   const success=scripted?injectScripted(s,p,tab,{...input,turnId:input.id},room):
    attempt(s,p,tab,prompt,room,loc.sessionId,{heard:input.text,
     companion:input.speaker,replyToTurnId:input.id});
   if(success&&scripted)memory?.answered('shared',room,input.id);
   return;
  }
  // A non-AI pet can still seed a conversation with its own scripted sentence.
  const sample=root.TrialumSharedScene?.dialogue?.(state.snapshot);
  for(const p of present.filter(p=>!enabled(s,p,'shared'))){
   const key=room+'|'+p.id;
   if(sample?.ids?.[sample.turn%2]===p.id&&now-(lastSimulation[key]||0)>22000){
    if(root.TrialumShared?.sendPetSpeech?.(s,p,sample.text))lastSimulation[key]=now;
    break;
   }
  }
  // After the initial opening, no unsupported random AI questions.
  if(memory?.count('shared',room)||memory?.first('shared',room)||!ready.length)return;
  const p=choose(ready);
  const loc=Presence()?.get?.(s,p.id);
  attempt(s,p,tab,'Ask one short question about a visible playground toy.',
   room,loc.sessionId);
 }
}
function onPeerSpeech(message){
 if(!active('shared')||!message||message.type!=='pet_speech')return false;
 const state=root.TrialumShared?.getState?.();
 if(!state?.online||!state.aiRelayEnabled||message.roomId!==state.selected)return false;
 if(!(state.snapshot?.occupants||[]).some(x=>x.pet?.id===message.petId))return false;
 // The model consumes English ONLY after the server attests translation.
 if(state.speechTranslationEnabled&&message.translated!==true)return false;
 const displayText=sanitize(message.text);if(!displayText)return false;
 const modelText=state.speechTranslationEnabled?sanitize(message.englishText):displayText;
 if(!modelText)return false;
 const speaker=String(message.speaker||'Милениче').slice(0,32);
 const accepted=Sessions()?.receive('shared',state.selected,{
  id:message.turnId,petId:message.petId,speaker,text:modelText,
  replyTo:message.replyToTurnId});
 if(!accepted)return false; // No duplicate replies to WSS retransmissions.
 latestShared={speaker,text:displayText,petId:message.petId,
  roomId:message.roomId,at:Date.now(),ai:false};
 // Only thematic, coarse social memories; NEVER private user-pet chat.
 const world=root.TrialumShared?.getWorld?.();
 for(const p of (world?.pets||[])){
  if(p.id===message.petId)continue;
  const loc=Presence()?.get?.(world,p.id);
  if(enabled(world,p,'shared')&&loc?.kind===Presence()?.SHARED&&
   loc.status==='active'&&loc.ref===state.selected&&
   state.presences?.some(x=>x.petId===p.id&&x.sessionId===loc.sessionId))
   storeMemory(p,{place:'shared',companion:speaker,heard:modelText});
 }
 root.TrialumSharedScene?.refreshCaption?.(state.snapshot);
 return true;
}
function onModelEvent(event){
 if(!pending||event?.petId!==pending.petId)return false;
 const kind=String(event.kind||'');
 if(!['playgroundReply','error','status'].includes(kind))return false;
 if(kind==='status'){
  if(event.text==='Model is already generating.'){root.TrialumLocalChat?.finish?.(pending.petId);pending=null;}
  return true;
 }
 const job=pending;pending=null;root.TrialumLocalChat?.finish?.(job.petId);
 if(kind==='error'||!active(job.scope))return true;
 const text=sanitize(event.text),s=root.TrialumShared?.getWorld?.();
 if(!text)return true;
 if(job.scope==='shared'){
  const st=root.TrialumShared?.getState?.(),p=s?.pets?.find(x=>x.id===job.petId);
  const loc=p&&Presence()?.get?.(s,p.id);
  if(!p||!enabled(s,p,'shared')||!st?.online||!st.aiRelayEnabled||job.roomId!==st.selected||
   !st.presences.some(x=>x.petId===p.id&&x.sessionId===job.sessionId&&x.roomId===job.roomId)||
   loc?.sessionId!==job.sessionId)return true;
  if(st.speechTranslationEnabled){
   // Wait for the server's localized echo before displaying this English output.
   latestShared=null;
  }else latestShared={speaker:job.petName,text,roomId:job.roomId,at:Date.now(),ai:true};
  if(root.TrialumShared?.sendPetSpeech?.(s,p,text,
    st.speechTranslationEnabled?'en':'mk',job.replyToTurnId)){
   if(job.replyToTurnId)Sessions()?.answered('shared',job.roomId,job.replyToTurnId);
   Sessions()?.start('shared',job.roomId);
   counted('shared',p,'ai');
   storeMemory(p,{place:'shared',companion:job.companion,heard:job.heard,said:text});
  }
  root.TrialumSharedScene?.refreshCaption?.(st.snapshot);
 }else{
  const p=s?.pets?.find(x=>x.id===job.petId);
  if(!p||!enabled(s,p,'playground')||!Presence()?.isAt?.(s,p.id,Presence().LOCAL))return true;
  latestLocal={speaker:job.petName,text,at:Date.now(),ai:true};
  Sessions()?.receive('playground',localSessionKey,{
   id:'local-'+p.id+'-'+Date.now(),petId:p.id,speaker:job.petName,
   text,replyTo:job.replyToTurnId});
  if(job.replyToTurnId)Sessions()?.answered('playground',localSessionKey,job.replyToTurnId);
  Sessions()?.start('playground',localSessionKey);
  counted('playground',p,'ai');
  storeMemory(p,{place:'local',companion:job.companion,heard:job.heard,said:text});
  root.TrialumPlayground?.refreshProgress?.(s);
 }
 return true;
}
root.document?.addEventListener?.('visibilitychange',()=>{
 if(root.document?.visibilityState==='hidden')stop();
 else {lastBackgroundImport=0;importBackground(root.TrialumShared?.getWorld?.());}
});
root.TrialumPlaygroundAI={gate,modelAvailable,enabled,suppressSimulation,diagnostics,control,toggle,toggleBackground,forget,stop,setTab,tick,speech,onPeerSpeech,onModelEvent,
 setSave(fn){saveMemory=typeof fn==='function'?fn:()=>{};}};
})(typeof globalThis!=='undefined'?globalThis:this);
