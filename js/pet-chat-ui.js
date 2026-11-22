/* TRIALUM 1.4 v44: one on-device English chat for every unlocked pet AI tier.
 * A model is a replaceable voice; pet cognitive memory exists without it.
 */
(function(root){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const E=()=>root.TrialumEngine,models={
 mini:{name:'SmolLM2 · 135M · Q3',size:'94 MB',ram:'2 GB'},
 compact:{name:'Qwen2.5 · 0.5B · Q4',size:'491 MB',ram:'4 GB'},
 deep:{name:'Qwen2.5 · 1.5B · Q4',size:'1.12 GB',ram:'6 GB'}
};
const eligible=(s,p,t)=>root.TrialumPetAI?.unlocked?.(s,p,t==='mini'?'mini':'advanced')===true;
function tier(p){
 const value=p?.chatModelTier;
 if(value==='mini'||value==='compact'||value==='deep')return value;
 return 'mini';
}
function status(t){
 try{return t==='mini'?(root.TrialumAndroid?.modelStatusTier?.('mini')||root.TrialumAndroid?.modelStatus?.()||'not-available'):
  (root.TrialumAndroid?.modelStatusTier?.(t)||'not-available')}
 catch(_){return 'not-available';}
}
function consent(p,t){return t==='mini'?p?.localAiConsent===true:p?.mind?.enabled===true;}
function choices(s,p){
 return Object.keys(models).filter(t=>eligible(s,p,t));
}
function choose(s,p,value){
 if(!p||!models[value]||!eligible(s,p,value))return false;
 p.chatModelTier=value;
 if(value!=='mini'){
  if(!p.mind||typeof p.mind!=='object')p.mind={enabled:false,tier:value,memories:[],turns:0};
  p.mind.tier=value;
 }
 return true;
}
function render(s,p){
 if(!p)return '';
 const available=choices(s,p);
 const t=available.includes(tier(p))?tier(p):available[0]||null;
 const can=!!t,st=t?status(t):'not-available',agreed=t?consent(p,t):false;
 const busy=!!root.TrialumLocalChat?.busy?.();
 const messages=(Array.isArray(p.chatHistory)?p.chatHistory:[]).slice(-12);
 const history=messages.map((m,i)=>'<div class="pet-chat-bubble '+(m.role==='user'?'outgoing':'incoming')+
  '" data-chat-index="'+i+'"><span class="pet-chat-sender">'+(m.role==='user'?'You':esc(p.name))+
  '</span><p>'+esc(m.text||'')+'</p></div>').join('');
 const options=available.map(k=>'<option value="'+k+'"'+(k===t?' selected':'')+'>'+
  esc(models[k].name)+' · '+models[k].size+'</option>').join('');
 const label=({
  installed:'Installed · on-device',downloading:'Downloading…',generating:'Thinking…',
  'resume-available':'Download paused', 'not-installed':'Not downloaded',
  'not-available':'Android only'
 }[st]||st);
 const text='<section class="pet-chat" aria-label="On-device English pet chat" data-pet-id="'+esc(p.id)+'">'+
  '<header class="pet-chat-head"><div><span class="pet-chat-kicker">PRIVATE · ENGLISH · ON-DEVICE</span>'+
  '<h3>💬 Chat with '+esc(p.name)+'</h3><small>Lifetime memories stay with your pet, not the model.</small></div>'+
  '<span class="pet-chat-state">'+esc(label)+'</span></header>';
 if(!can)return text+'<div class="lock-hint">🔒 AI conversation unlocks through evolution and research. Memory is already active.</div></section>';
 let body='<div class="pet-chat-config"><label for="petChatModel">Language model</label>'+
  '<select id="petChatModel" aria-label="Choose local language model">'+options+'</select>'+
  '<span class="small subtle">One model at a time · '+esc(models[t].ram)+' RAM recommended</span></div>';
 body+='<div class="pet-chat-consent"><button data-do="petChatConsent" class="'+(agreed?'':'primary')+
  '" type="button">'+(agreed?'Disable AI conversations':'Enable AI conversations')+'</button>'+
  '<small>Memory continues even if AI is disabled.</small></div>';
 if(!agreed)return text+body+'<p class="privacy-note">AI requires your permission. Models are downloaded only when requested. Your text chat and cognitive memories stay inside the app.</p></section>';
 if(st==='not-installed'||st==='resume-available')body+='<div class="pet-chat-download">'+
   '<button class="primary" data-do="petChatDownload">⬇ '+(st==='resume-available'?'Resume download':'Download selected model')+'</button></div>';
 if(st!=='installed'&&t!=='mini'&&root.TrialumAndroid?.chooseModelTier)body+='<button data-do="petChatImport">📂 Import verified GGUF</button>';
 body+='<div id="petChatMessages" class="pet-chat-messages" role="log" aria-live="polite" aria-label="Conversation with '+esc(p.name)+'">'+
  (history||'<p class="pet-chat-empty">Say hello. Your pet can remember its experiences even when AI is unavailable.</p>')+
  '</div><div class="pet-chat-compose"><textarea id="petChatPrompt" rows="2" maxlength="340" placeholder="Write in English…" aria-label="Message in English"></textarea>'+
  '<div class="pet-chat-controls">'+
  '<button type="button" data-do="petChatMic" aria-label="Dictate in English using on-device Android recognition" title="Dictate in English"'+(!root.TrialumAndroid?.startPetVoiceInput?' disabled':'')+'>🎙️</button>'+
  '<button type="button" data-do="petChatSpeak" aria-label="Read latest pet reply using Android text to speech" title="Read reply aloud"'+(!root.TrialumAndroid?.speakPetChat?' disabled':'')+'>🔊</button>'+
  '<button class="primary" data-do="petChatAsk"'+(st!=='installed'||busy?' disabled':'')+'>Send</button>'+
  '</div></div><p class="small subtle" id="petChatVoiceStatus" role="status" aria-live="polite">'+
  'Voice input requires an installed English on-device recognizer; voice output uses Android TTS.</p>';
 return text+body+'</section>';
}
function latestReply(p){
 return (p?.chatHistory||[]).slice().reverse().find(x=>x.role==='pet'&&x.text)?.text||'';
}
function handle(action,s,p,ctx){
 if(!['petChatConsent','petChatDownload','petChatImport','petChatMic','petChatSpeak'].includes(action))return false;
 if(!p||!eligible(s,p,tier(p)))return true;
 const t=tier(p);
 if(action==='petChatConsent'){
  if(t!=='mini')return root.TrialumMind?.handle?.('mindToggle',{dataset:{tier:t}},s,ctx)===true;
  if(!p.localAiConsent){
   if(!root.confirm?.('Enable private on-device AI conversation? Lifetime memory exists independently. No model will download without your request.'))return true;
  }
  p.localAiConsent=!p.localAiConsent;ctx.scheduleSave();ctx.render();return true;
 }
 if(!consent(p,t)){ctx.toast('Enable AI conversations first.');return true;}
 if(action==='petChatDownload'){
  if(t!=='mini')return root.TrialumMind?.handle?.('mindDownload',{dataset:{tier:t}},s,ctx)===true;
  if(root.confirm?.('Download the verified 94 MB Mini model to this device?')&&root.TrialumAndroid?.downloadModel)
   root.TrialumAndroid.downloadModel();
  return true;
 }
 if(action==='petChatImport')return t!=='mini'&&root.TrialumMind?.handle?.('mindImport',{dataset:{tier:t}},s,ctx)===true;
 if(action==='petChatMic'){
  if(!root.TrialumAndroid?.startPetVoiceInput){ctx.toast('On-device Android speech recognition unavailable.');return true;}
  root.TrialumAndroid.startPetVoiceInput(p.id);return true;
 }
 if(action==='petChatSpeak'){
  const reply=latestReply(p);
  if(reply&&root.TrialumAndroid?.speakPetChat)root.TrialumAndroid.speakPetChat(p.id,reply);
  else ctx.toast('There is no reply to read yet.');
  return true;
 }
 return true;
}
function voiceEvent(event,s){
 const p=s?.pets?.find(x=>x.id===event?.petId);
 if(!p||!root.document?.querySelector?.('.pet-chat[data-pet-id="'+p.id+'"]'))return;
 const field=root.document.getElementById('petChatPrompt'),note=root.document.getElementById('petChatVoiceStatus');
 if(event.kind==='transcript'&&field){
  field.value=String(event.text||'').slice(0,340);field.focus();
 }
 if(note)note.textContent=event.kind==='transcript'?'English speech recognized. Review and press Send.':
  String(event.message||'Voice service unavailable.').slice(0,180);
}
function scroll(){
 const box=root.document?.getElementById?.('petChatMessages');
 if(box)box.scrollTop=box.scrollHeight;
}
root.TrialumPetChat={render,tier,choose,consent,handle,voiceEvent,scroll,latestReply,models,status};
if(typeof module==='object'&&module.exports)module.exports=root.TrialumPetChat;
})(globalThis);
