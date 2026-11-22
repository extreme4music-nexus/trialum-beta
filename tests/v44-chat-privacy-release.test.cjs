'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
globalThis.TrialumPetAI={unlocked:(_s,_p,t)=>t==='mini'||t==='advanced'};
globalThis.TrialumLocalChat={busy:()=>false};
globalThis.TrialumAndroid={
  modelStatus:()=> 'installed',
  modelStatusTier:t=>t==='mini'?'not-available':'installed',
  startPetVoiceInput:()=>{},
  speakPetChat:()=>{}
};
globalThis.TrialumEngine={};
const Chat=require('../js/pet-chat-ui.js'),Guard=require('../js/privacy-guard.js');
const pet=()=>({id:'pet-42',name:'Luna',species:9,localAiConsent:true,
 chatModelTier:'mini',chatHistory:[{role:'user',text:'Hello Luna'},{role:'pet',text:'Hello my friend!'}],
 cognitiveMemory:{petId:'pet-42',owner:{topics:{music:{count:2}}}}});
test('unified scrollable English chat reads actual native Mini status API',()=>{
 const p=pet(),html=Chat.render({research:{level:30}},p);
 assert.equal(Chat.status('mini'),'installed');
 assert(html.includes('id="petChatModel"'));
 assert(html.includes('id="petChatMessages"'));
 assert(html.includes('class="pet-chat-messages"'));
 assert(html.includes('data-do="petChatMic"'));
 assert(html.includes('data-do="petChatSpeak"'));
 assert(html.includes('data-do="petChatAsk"'));
 assert(!/<button[^>]*data-do="petChatAsk"[^>]*disabled/.test(html));
 assert(!html.includes('id="llmPrompt"'));
 assert(!html.includes('id="mindPrompt"'));
 assert(html.includes('Hello my friend!'));
 assert.equal(Chat.latestReply(p),'Hello my friend!');
});
test('a single model dropdown switches provider without replacing pet memory or history',()=>{
 const p=pet(),memory=p.cognitiveMemory,history=p.chatHistory;
 assert(Chat.choose({},p,'deep'));
 assert.equal(p.chatModelTier,'deep');
 assert.equal(p.mind.tier,'deep');
 assert.strictEqual(p.cognitiveMemory,memory);
 assert.strictEqual(p.chatHistory,history);
 assert(Chat.choose({},p,'compact'));
 assert(!Chat.choose({},p,'unknown'));
});
test('private chat requires English until a direct translator ships',()=>{
 assert(Chat.validEnglish('Hello, can we talk about the stars?'));
 assert(Chat.validEnglish('My name is André.'));
 assert(!Chat.validEnglish('Здраво, милениче!'));
 assert(!Chat.validEnglish('Привет'));
 assert(!Chat.validEnglish('مرحبا'));
 assert(!Chat.validEnglish(''));
});
test('shared AI speech refuses personal details and copies of private owner messages',()=>{
 const p=pet();
 p.chatHistory.push({role:'user',text:'My name is Antonius'});
 assert.equal(Guard.inspectPetSpeech('Antonius is a good composer.',p).blocked,true);
 p.chatHistory.push({role:'user',text:'I live in Gornje Polje'});
 assert.equal(Guard.inspectPetSpeech('Gornje Polje has nice music.',p).blocked,true);
 assert.equal(Guard.inspectPetSpeech('My owner is a music teacher.',p).blocked,true);
 assert.equal(Guard.inspectPetSpeech('My email is example@example.com.',p).blocked,true);
 assert.equal(Guard.inspectPetSpeech('I like exploring stars and flowers.',p).blocked,false);
});
test('offline agreement and privacy versions, bundled links and developer are consistent',()=>{
 const languages=['','mk','es','fr','de','it','pt','tr','sq','ar','zh','ja','ko','ru','hi','id','pl'];
 for(const language of languages){
  const doc=read('assets/user-agreement-v44'+(language?'-'+language:'')+'.html');
  assert(doc.includes('eXtreme4'),language+' developer');
  assert(doc.includes('1.4 v44'),language+' version');
  assert(doc.includes('privacy-policy-v44.html'),language+' active privacy link');
  assert(!/Beta 1\.0|B&#234;ta 1\.0|Bêta 1\.0|бета 1\.0|ベータ 1\.0/i.test(doc),language+' obsolete agreement');
 }
 const privacy=read('assets/privacy-policy-v44.html');
 assert(privacy.includes('eXtreme4'));
 assert(privacy.includes('RECORD_AUDIO'));
 assert(privacy.includes('on-device'));
 assert(privacy.includes('English-only'));
 const legal=read('js/legal-consent.js');
 assert(legal.includes('AGREEMENT_VERSION=44'));
 assert(legal.includes('privacy-policy-v44.html'));
});
test('Android voice intentionally has no network STT or TTS fallback',()=>{
 const voice=read('android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumPetVoice.kt');
 assert(voice.includes('createOnDeviceSpeechRecognizer'));
 assert(voice.includes('RECORD_AUDIO'));
 assert(voice.includes('!it.isNetworkConnectionRequired'));
 assert(!voice.includes('createSpeechRecognizer(activity)'));
 assert(read('android-template/app/src/main/AndroidManifest.xml').includes('android.permission.RECORD_AUDIO'));
});
test('1.4 v44 active version metadata and one conversation view',()=>{
 assert(read('android-template/app/build.gradle.kts').includes('versionName = "1.4 v44"'));
 assert(read('index.html').includes('TRIALUM <span>1.4 v44</span>'));
 assert(read('js/longplay-ui.js').includes('TrialumPetChat?.render'));
 const script=read('js/longplay-ui.js');
 assert(script.includes('petChatAsk'));
 assert(read('sw.js').includes('trialum-1.4-v44-offline'));
 const en=JSON.parse(read('locales/en.json'));
 assert.equal(en.version,'1.4 v44');
});
