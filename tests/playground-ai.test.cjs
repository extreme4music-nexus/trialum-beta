'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const ROOM='b6c2fb13-9940-4741-812a-d08c5ec82ac1';
const SESSION='d59a352e-87b2-4cf8-99d7-f7ae924273db';
const pet={id:'pet_1',name:'Синапсо',species:4,playgroundAiLocal:true,playgroundAiShared:true};
const world={selectedPet:pet.id,pets:[pet],research:{level:6}};
const sent=[],generated=[],cancelled=[];
let saves=0;
let modelStatus='installed',sharedEnabled=true,bgOn=false;
const backgroundCalls=[];
const state={active:true,online:true,aiRelayEnabled:true,speechTranslationEnabled:false,
 speechTranslationLanguages:['mk','sq','en'],selected:ROOM,
 snapshot:{presenceEnabled:true,room:{id:ROOM},
 occupants:[{pet:{id:pet.id,name:pet.name}},{pet:{id:'other',name:'Другар'}}]},
 presences:[{petId:pet.id,sessionId:SESSION,kind:'shared',roomId:ROOM}]};
globalThis.document={visibilityState:'visible',hidden:false,addEventListener(){}};
globalThis.TrialumEngine={SPECIES:Array.from({length:16},(_,i)=>({name:'Species '+i})),
 currentPet:s=>s.pets.find(p=>p.id===s.selectedPet),
 evolutionProgress:()=>({level:22})};
globalThis.TrialumPresence={LOCAL:'local_playground',SHARED:'shared_playground',
 isAt:()=>true,get:()=>({kind:'shared_playground',status:'active',ref:ROOM,sessionId:SESSION})};
globalThis.TrialumAndroid={modelStatus:()=>modelStatus,
 askPlaygroundAi:(id,name,text,context)=>generated.push({id,name,text,context}),
 cancelPlaygroundAi:()=>cancelled.push('cancel'),
 backgroundAiStatus:()=>bgOn,
 setPlaygroundBackgroundAi:(enabled,roomId,petId,sessionId,petName)=>{
  backgroundCalls.push({enabled,roomId,petId,sessionId,petName});
  bgOn=enabled;return true;
 }};
let locked=false;
globalThis.TrialumLocalChat={busy:()=>locked,begin:()=>{if(locked)return false;locked=true;return true;},
 finish:()=>{locked=false;}};
globalThis.TrialumPlayground={localDialogue:()=>({speaker:'Другар',text:'Што ќе играме?'})};
globalThis.TrialumShared={getWorld:()=>world,getState:()=>({...state,aiRelayEnabled:sharedEnabled}),
 sendPetSpeech:(s,p,text)=>{sent.push({s,p,text});return true;}};
globalThis.TrialumSharedScene={dialogue:()=>({ids:[pet.id,'other'],turn:0,text:'Сакаш да играме?'}),
 refreshCaption:()=>{}};
globalThis.TrialumPlaygroundMemory=require('../js/playground-memory.js');
globalThis.TrialumDialogueSessions=require('../js/playground-dialogue-session.js');
require('../js/playground-ai.js');
const AI=globalThis.TrialumPlaygroundAI;
AI.setSave(()=>saves++);
test('mini AI has the same earned evolution gate and stays opt-in',()=>{
 assert.equal(AI.gate(world,pet),true);
 world.research.level=5;assert.equal(AI.gate(world,pet),false);
 world.research.level=6;
 modelStatus='not-installed';assert.equal(AI.modelAvailable(),false);
 modelStatus='installed';
});
test('local mini replaces only visible speech, never XP, and stops on tab change',()=>{
 AI.setTab('playground');const before=JSON.stringify({research:world.research,petXP:pet.xp,petActions:pet.actionsLeft});
 AI.tick(world,'playground');
 assert.equal(generated.length,1);
 assert.match(generated[0].text,/Observe one real playground toy/,
  'active AI should speak independently, not inherit scripted dialogue captions');
 assert.equal(AI.onModelEvent({kind:'playgroundReply',petId:pet.id,text:'Ајде на лизгалка! Потоа ќе истражуваме.'}),true);
 assert.equal(AI.speech('playground').text,'Ајде на лизгалка!','only first short sentence is spoken');
 const speechClock=Date.now;Date.now=()=>speechClock()+27000;
 try{assert.equal(AI.speech('playground'),null,'expired captions disappear while session memory remains separate');}
 finally{Date.now=speechClock;}
 assert.equal(JSON.stringify({research:world.research,petXP:pet.xp,petActions:pet.actionsLeft}),before,
  'AI does not mutate XP, actions or gameplay state');
 assert(pet.playgroundAiMemories?.length>0,'the pet preserves only a thematic note');
 assert(saves>0,'the compact memory is sent to ordinary game-state saving');
 assert(!JSON.stringify(pet.playgroundAiMemories).includes('Потоа ќе истражуваме'),
  'no verbatim transcript leaks into JSON backup');
 AI.setTab('pets');
 assert.equal(AI.speech('playground'),null);
 document.visibilityState='hidden';document.hidden=true;
 AI.tick(world,'playground');
 assert.equal(generated.length,1,'no background generation');
 document.visibilityState='visible';document.hidden=false;
});
test('shared mini generation is routed only to current verified room, non-AI fallback remains',()=>{
 AI.setTab('shared');AI.tick(world,'shared');
 assert.equal(generated.length,2);
 assert.equal(AI.onModelEvent({kind:'playgroundReply',petId:pet.id,text:'Здраво, пријателче!'}),true);
 assert.equal(sent.length,1);assert.equal(sent[0].text,'Здраво, пријателче!');
 assert.equal(AI.speech('shared',ROOM).text,'Здраво, пријателче!');
 assert.equal(AI.speech('shared','wrong-room'),null);
 const before=generated.length;AI.stop();
 pet.playgroundAiShared=false;
 AI.tick(world,'shared');
 assert.equal(generated.length,before,'users without AI keep simulated speech');
 assert(sent.length>=2,'a simulated pet can still supply a bounded room line');
 AI.stop();pet.playgroundAiShared=true;
 sharedEnabled=false;AI.tick(world,'shared');
 assert.equal(generated.length,before,'no AI when server has not opted into the relay');
 sharedEnabled=true;
});
test('real room messages are only shown in currently visible authorized room',()=>{
 AI.setTab('shared');
 const yes=AI.onPeerSpeech({type:'pet_speech',roomId:ROOM,petId:'other',speaker:'Другар',text:'Еј, здраво!',turnId:'5b008b36-c329-4a34-9632-bd30a9f6d231'});
 assert.equal(yes,true);assert.equal(AI.speech('shared',ROOM).text,'Еј, здраво!');
 assert.equal(AI.onPeerSpeech({type:'pet_speech',roomId:'forged',petId:'other',text:'No'}),false);
 AI.setTab('lab');
 assert.equal(AI.onPeerSpeech({type:'pet_speech',roomId:ROOM,petId:'other',text:'No'}),false);
});

test('explicit background AI opt-in requires the translator and room lease',()=>{
 sharedEnabled=true;state.speechTranslationEnabled=true;
 modelStatus='installed';pet.playgroundAiShared=true;
 assert.equal(AI.toggleBackground(world,()=>{},()=>saves++,()=>{}),true);
 assert.equal(pet.playgroundAiBackgroundShared,true);
 assert.equal(bgOn,true);
 assert.deepEqual(backgroundCalls.at(-1),
  {enabled:true,roomId:ROOM,petId:pet.id,sessionId:SESSION,petName:pet.name});
 assert.equal(AI.toggleBackground(world,()=>{},()=>saves++,()=>{}),true);
 assert.equal(pet.playgroundAiBackgroundShared,false);
 assert.equal(bgOn,false);
 state.speechTranslationEnabled=false;
 AI.toggleBackground(world,()=>{},()=>saves++,()=>{});
 assert.equal(bgOn,false,'no background AI when server English pivot is not enabled');
 state.speechTranslationEnabled=false;
});

test('translated room captions use local language, but AI hears only canonical English',()=>{
 state.speechTranslationEnabled=true;
 AI.setTab('shared');
 AI.stop();
 assert.equal(AI.onPeerSpeech({type:'pet_speech',roomId:ROOM,petId:'other',speaker:'Другар',
  text:'Непреведена порака',turnId:'1dde773b-5bb4-42ca-9ded-1f18d607de13'}),false,
  'untranslated payload must never be passed to the English-only mini LLM');
 assert.equal(AI.onPeerSpeech({type:'pet_speech',roomId:ROOM,petId:'other',speaker:'Другар',
  text:'Здраво, другарче!',englishText:'Hello, friend!',language:'mk',translated:true,
  turnId:'0a7b1b26-3547-43a2-bae6-1ff1a7be7b61'}),true);
 assert.equal(AI.speech('shared',ROOM).text,'Здраво, другарче!',
  'player sees only the chosen display language');
 state.speechTranslationEnabled=false;
 AI.stop();
});


test('English-pivot context uses bounded ten-turn history without private chat',()=>{
 const originalSelected=world.selectedPet,oldTranslation=state.speechTranslationEnabled;
 const candidate={id:'pet_context',name:'Explorer',species:4,playgroundAiShared:true};
 world.pets.push(candidate);world.selectedPet=candidate.id;
 state.presences.push({petId:candidate.id,sessionId:SESSION,kind:'shared',roomId:ROOM});
 state.snapshot.occupants.push({pet:{id:candidate.id,name:candidate.name}});
 state.speechTranslationEnabled=true;
 AI.stop();AI.setTab('shared');globalThis.TrialumDialogueSessions.clear('shared');
 for(let i=0;i<14;i++){
  assert.equal(AI.onPeerSpeech({type:'pet_speech',roomId:ROOM,petId:'other',
   speaker:'Другар',turnId:'0a7b1b26-3547-43a2-bae6-'+(0x1ff1a7be7b61+i).toString(16).padStart(12,'0'),
   text:'Здраво!',englishText:'Let us explore and discover fantastic plants in the garden together now.',
   language:'mk',translated:true}),true);
 }
 assert.equal(globalThis.TrialumDialogueSessions.count('shared',ROOM),14);
 const before=generated.length;
 // Either local AI can be the nominated responder. Try after the fallback
 // deadline to ensure a local candidate can receive this turn.
 AI.tick(world,'shared');
 if(generated.length===before){
  const original=Date.now;
  Date.now=()=>original()+60000;
  try{AI.tick(world,'shared');}finally{Date.now=original;}
 }
 assert(generated.length>=before+1);
 const context=JSON.parse(generated.at(-1).context);
 assert.equal(context.llmLanguage,'en');
 assert.equal(context.language,'en');
 assert.equal(context.oneShortSentence,true);
 assert(context.roomTurns.length>=3);
 assert(generated.at(-1).context.length<=1450);
 AI.stop();world.pets.pop();world.selectedPet=originalSelected;
 state.presences.pop();state.snapshot.occupants.pop();
 state.speechTranslationEnabled=oldTranslation;
});
