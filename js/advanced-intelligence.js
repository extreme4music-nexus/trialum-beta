/* TRIALUM 1.5.5: game-simulated personality/emotions and opt-in local
   multilingual GGUF for an already evolved Mnemos (species 9, level 165+).
   No remote generation, no automatic download, no model bundled in APK. */
(function(root){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tr=(mk,en)=>{if(root.TrialumI18n?.language?.()==='mk')return mk;const translated=root.TrialumI18n?.t(mk);return translated&&translated!==mk?translated:en;};
const MODELS={
  compact:{key:'compact',name:'Qwen2.5 0.5B · Q4_K_M',size:'491 MB',ram:'4 GB',tokens:150},
  deep:{key:'deep',name:'Qwen2.5 1.5B · Q4_K_M',size:'1.12 GB',ram:'6 GB',tokens:200}
};
const E=()=>root.TrialumEngine;
const downloadState={compact:'',deep:''};
// Local GGUF chat is free; only ONE inference at a time on this device.
let pendingChatPet=null;
const localChat={
 busy(){
  if(pendingChatPet!==null)return true;
  try{return root.TrialumAndroid?.modelGenerationBusy?.()===true;}catch(_){return false;}
 },
 begin(petId){
  if(this.busy())return false;
  pendingChatPet=String(petId);return true;
 },
 finish(petId){if(pendingChatPet===String(petId))pendingChatPet=null;},
 reset(){pendingChatPet=null;}
};
root.TrialumLocalChat=localChat;
root.document?.addEventListener?.('visibilitychange',()=>{
 if(root.document?.visibilityState==='hidden')localChat.reset();
});
function eligible(s,p){
 if(!s||!p)return false;
 // Mnemos and subsequent evolved/researched species (not early creatures).
 const species=Number(p.species);
 return Number.isInteger(species)&&species>=9&&!!E()?.SPECIES?.[species]&&
  E()?.evolutionProgress?.(p)?.level>=165&&(s.research?.level||0)>=20;
}
function downloadEvent(kind,key,message){
 if(!MODELS[key])return false;
 if(kind==='status'||kind==='error'||kind==='progress'){
  downloadState[key]=String(message||'').slice(0,240);
  return true;
 }
 return false;
}
function persona(p){
 const seed=(Math.floor(Number(p?.seed)||0)>>>0);
 const trait=(shift)=>20+((Math.imul(seed^shift,2654435761)>>>16)&63);
 return {curiosity:trait(23),warmth:trait(97),bravery:trait(113),playfulness:trait(337)};
}
function mood(p){
 const joy=Number(p?.joy)||0,energy=Number(p?.energy)||0,food=Number(p?.satiety)||0,bond=Number(p?.bond)||0;
 if(food<25)return {id:'hungry',label:tr('Гладен','Hungry'),emoji:'🍽️'};
 if(energy<25)return {id:'tired',label:tr('Уморен','Tired'),emoji:'😴'};
 if(joy<30)return {id:'sad',label:tr('Тажен','Sad'),emoji:'😔'};
 if(joy>75&&bond>60)return {id:'joyful',label:tr('Радосен','Joyful'),emoji:'🥰'};
 return {id:'curious',label:tr('Љубопитен','Curious'),emoji:'🤔'};
}
function mind(p){
 if(!p.mind||typeof p.mind!=='object')p.mind={enabled:false,tier:'compact',memories:[],turns:0};
 if(!Array.isArray(p.mind.memories))p.mind.memories=[];
 p.mind.memories=p.mind.memories.slice(-8);
 if(!MODELS[p.mind.tier])p.mind.tier='compact';
 return p.mind;
}
function status(key){
 try{return root.TrialumAndroid?.modelStatusTier?.(key)||'not-available'}catch(_){return 'not-available'}
}
function button(label,act,attrs='',disabled=false){
 return '<button data-do="'+act+'" '+attrs+(disabled?' disabled':'')+'>'+label+'</button>';
}
function render(s,p){
 if(!p)return '';
 const ok=eligible(s,p),traits=persona(p),emotion=mood(p);
 const intro='<section class="intelligence-panel"><h3>🧠 '+tr('Напредна интелигенција на Мнемос','Mnemos advanced intelligence')+'</h3>'+
 '<p class="small">'+tr('Личност и емоции се симулирани игровни состојби, не вистински чувства.','Personality and emotions are simulated game states, not real feelings.')+'</p>';
 if(!ok)return intro+'<p class="lock-hint">🔒 '+tr('Се отклучува и за веќе развиен Мнемос: вид Мнемос, ниво 165 и лабораторија 20.','Also unlocks for existing evolved Mnemos: species Mnemos, level 165, laboratory 20.')+'</p></section>';
 const m=p.mind&&typeof p.mind==='object'?p.mind:{enabled:false,tier:'compact',memories:[]};
 const tier=MODELS[m.tier]||MODELS.compact;
 let html=intro+'<div class="emotion-meter"><span>💫 '+tr('Расположение','Mood')+': '+emotion.emoji+' '+esc(emotion.label)+'</span>'+
 '<span>✨ '+tr('Љубопитност','Curiosity')+' '+traits.curiosity+'</span>'+
 '<span>💞 '+tr('Топлина','Warmth')+' '+traits.warmth+'</span>'+
 '<span>🦁 '+tr('Храброст','Bravery')+' '+traits.bravery+'</span></div>';
 html+='<p class="privacy-note">'+tr('Разговорите, меморијата и личноста остануваат во локалниот свет и во неговиот JSON бекап. Никогаш не се праќаат на наш сервер.','Chats, memories and personality stay in the local world and its JSON backup. No game server receives them.')+'</p>';
 html+=button(m.enabled?'🔐 '+tr('Исклучи AI меморија','Disable AI memory'):'✅ '+tr('Се согласувам за локален AI','Allow local AI'),'mindToggle');
 if(!m.enabled)return html+'<p class="small">'+tr('Модел не се презема пред согласност. Не е потребен за играње.','No model is downloaded without consent. It is never required for gameplay.')+'</p></section>';
 html+='<div class="llm-choices">'+Object.values(MODELS).map(model=>
 button((m.tier===model.key?'✓ ':'')+esc(model.name)+' · '+model.size,'mindTier','data-tier="'+model.key+'"'+(m.tier===model.key?' class="primary"':''))).join('')+'</div>';
 const st=status(tier.key),installed=st==='installed';
 const readable={installed:tr('Инсталиран','Installed'),'not-installed':tr('Не е преземен','Not downloaded'),
 'resume-available':tr('Делумно преземен · продолжи','Partially downloaded · resume'),
 downloading:tr('Преземање','Downloading'),generating:tr('Генерирање','Generating'),
 'not-available':tr('Само Android','Android only')}[st]||st;
 html+='<p class="small">'+esc(tier.name)+' · '+tier.size+' · RAM ≥ '+tier.ram+' · '+esc(readable)+'</p>';
 if(st==='not-installed'||st==='resume-available')html+=button('⬇ '+
 (st==='resume-available'?tr('Продолжи преземање','Resume download'):tr('Преземи модел','Download model')),
 'mindDownload','data-tier="'+tier.key+'" class="primary"');
 if(st!=='installed'&&root.TrialumAndroid?.chooseModelTier){
  html+=button('📂 '+tr('Избери преземен GGUF','Import downloaded GGUF'),
   'mindImport','data-tier="'+tier.key+'"');
 }
 if(downloadState[tier.key])html+='<p class="small" id="mindDownloadStatus" role="status">'+
 esc(downloadState[tier.key])+'</p>';
 html+='<p class="privacy-note">'+tr('Потребни се Wi-Fi, слободен простор и доволно RAM. Google и облак не се потребни. Моделот се вчитува само по порака.','Requires network, free storage and sufficient RAM. Google/cloud is not required. The model loads only when you send a message.')+'</p>';
 const notes=Array.isArray(m.memories)?m.memories.slice(-4):[];
 if(notes.length)html+='<details><summary>🧠 '+tr('Меморија','Memory')+' ('+notes.length+')</summary><ul>'+notes.map(x=>'<li>'+esc(x).slice(0,180)+'</li>').join('')+'</ul></details>';
 html+='<label for="mindPrompt">'+tr('Порака до Мнемос','Message to Mnemos')+'</label><textarea id="mindPrompt" maxlength="340" rows="2" placeholder="'+tr('Напиши кратка порака…','Write a short message…')+'"></textarea>';
 html+=button('💬 '+tr('Разговарај локално','Chat locally'),'mindAsk','class="primary"',!installed||localChat.busy());
  html+='<p class="small subtle">'+tr(
    'Локалните AI разговори се бесплатни и не трошат дневни акции или кредити. Нема дневен лимит; еден одговор во исто време.',
    'On-device AI chats are free and use no daily actions or credits. No daily limit; one reply at a time.')+'</p>';
 html+='</section>';
 return html;
}
function handle(action,button,s,ctx){
 if(!['mindToggle','mindTier','mindDownload','mindImport','mindAsk'].includes(action))return false;
 const p=E()?.currentPet?.(s);
 if(!eligible(s,p)){ctx.toast(tr('Прво развиј Мнемос.','Evolve Mnemos first.'));return true}
 const m=mind(p);
 if(action==='mindToggle'){
  if(!m.enabled){
   const accepted=root.confirm?.(tr('Да овозможам локална AI меморија за овој Мнемос? Пораките ќе се зачуваат во светот и JSON бекапот. Моделот е изборен и се презема одделно.','Enable on-device AI memory for Mnemos? Messages are saved in the world and JSON backup. Model download is separate and optional.'));
   if(!accepted)return true;
  }
  m.enabled=!m.enabled;ctx.scheduleSave();ctx.render();return true;
 }
 if(!m.enabled){ctx.toast(tr('Прво дај согласност.','Consent is required first.'));return true;}
 const tier=MODELS[button?.dataset?.tier]||MODELS[m.tier]||MODELS.compact;
 if(action==='mindTier'){m.tier=tier.key;ctx.scheduleSave();ctx.render();return true;}
 if(action==='mindDownload'){
  if(!root.TrialumAndroid?.downloadModelTier){ctx.toast(tr('Напредните модели се само за Android.','Advanced models are only on Android.'));return true;}
  const accepted=root.confirm?.(tr('Да преземам '+tier.size+' модел од Hugging Face со SHA-256 проверка? Потребни се слободен простор и околу '+tier.ram+' RAM.','Download the '+tier.size+' model from Hugging Face with SHA-256 verification? Free disk space and about '+tier.ram+' RAM are needed.'));
  if(accepted){downloadState[tier.key]='';root.TrialumAndroid.downloadModelTier(tier.key);}
  return true;
 }
 if(action==='mindImport'){
  if(!root.TrialumAndroid?.chooseModelTier){
   ctx.toast(tr('Увоз на моделот е достапен само на Android.','Model import is available only on Android.'));
   return true;
  }
  if(root.confirm?.(tr('Избери ја веќе преземената официјална GGUF Q4_K_M датотека за '+tier.key+'. Ќе се провери целосен SHA-256 пред да биде активирана.',
   'Select a previously downloaded official Q4_K_M GGUF for '+tier.key+'. Full SHA-256 verification is required.'))){
   downloadState[tier.key]='';
   root.TrialumAndroid.chooseModelTier(tier.key);
  }
  return true;
 }
 if(action==='mindAsk'){
  const prompt=(root.document?.getElementById('mindPrompt')?.value||'').trim().slice(0,340);
  if(!prompt)return true;
  if(localChat.busy()){ctx.toast(tr('AI веќе размислува. Пробај по одговорот.','AI is already thinking. Try after the reply.'));return true;}
  if(status(m.tier)!=='installed'||!root.TrialumAndroid?.askPetAdvanced){ctx.toast(tr('Прво преземи го моделот.','Download the model first.'));return true}
  const history=Array.isArray(p.chatHistory)?p.chatHistory.slice(-6):[];
  const context=JSON.stringify({language:root.TrialumI18n?.language?.()||'mk',species:'Mnemos',
   traits:persona(p),emotion:mood(p).id,memories:m.memories,
   playground_memory:root.TrialumPlaygroundMemory?.recall?.(p,prompt)||null,
   history:history.map(x=>({role:x.role,text:String(x.text||'').slice(0,190)}))}).slice(0,2200);
  if(!localChat.begin(p.id)){ctx.toast(tr('AI веќе размислува.','AI is already thinking.'));return true;}
  p.chatHistory=Array.isArray(p.chatHistory)?p.chatHistory:[];
  p.chatHistory.push({role:'user',text:prompt});p.chatHistory=p.chatHistory.slice(-12);
  m.memories.push('Player: '+prompt.slice(0,140));m.memories=m.memories.slice(-8);m.turns=(m.turns||0)+1;
  try{root.TrialumAndroid.askPetAdvanced(p.id,p.name,prompt,tier.key,context);}
   catch(_){localChat.finish(p.id);ctx.toast(tr('Неуспешен старт на локалниот AI.','Could not start local AI.'));return true;}
  ctx.scheduleSave();ctx.render();ctx.toast(tr('Мнемос размислува локално…','Mnemos is thinking locally…'));return true;
 }
 return true;
}
function onReply(s,p,text){
 if(!eligible(s,p)||!p?.mind?.enabled)return;
 const m=mind(p);m.memories.push('Mnemos: '+String(text).slice(0,140));m.memories=m.memories.slice(-8);
 const emotion=mood(p).id;
 p.reactionAt=Date.now();p.reaction=emotion==='joyful'?'spin':'wave';
 root.TrialumWorld?.reactEmotion?.(p.id,emotion);
}
root.TrialumMind={MODELS,eligible,persona,mood,mind,render,handle,onReply,downloadEvent};
})(typeof globalThis!=='undefined'?globalThis:this);
