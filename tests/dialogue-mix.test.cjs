'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ROOM='b6c2fb13-9940-4741-812a-d08c5ec82ac1';
const SESSION='d59a352e-87b2-4cf8-99d7-f7ae924273db';
const code=fs.readFileSync('js/playground-ai.js','utf8');
const sessions=fs.readFileSync('js/playground-dialogue-session.js','utf8');
const scene=fs.readFileSync('js/shared-scene.js','utf8');

function harness(){
 let now=1000000,locked=false;
 const pet={id:'test_pet',name:'Explorer',species:4,playgroundAiLocal:true,playgroundAiShared:true};
 const world={pets:[pet],selectedPet:pet.id,research:{level:6}};
 const calls=[],sent=[];
 const state={online:true,aiRelayEnabled:true,speechTranslationEnabled:true,
  speechTranslationLanguages:['mk','sq','en'],selected:ROOM,
  snapshot:{presenceEnabled:true,room:{id:ROOM},
   occupants:[{pet:{id:pet.id,name:pet.name}},{pet:{id:'peer',name:'Friend'}}]},
  presences:[{petId:pet.id,sessionId:SESSION,kind:'shared',roomId:ROOM}]};
 const root={
  Date:class extends Date {static now(){return now;}},
  document:{visibilityState:'visible',hidden:false,addEventListener(){}},
  TrialumEngine:{SPECIES:Array.from({length:16},(_,i)=>({name:'Species '+i})),
   currentPet:s=>s.pets.find(p=>p.id===s.selectedPet),
   evolutionProgress:()=>({level:22})},
  TrialumPresence:{LOCAL:'local_playground',SHARED:'shared_playground',
   isAt:()=>true,get:()=>({kind:'shared_playground',status:'active',ref:ROOM,sessionId:SESSION})},
  TrialumAndroid:{modelStatus:()=> 'installed',
   askPlaygroundAi:(id,name,prompt,context)=>calls.push({id,name,prompt,context})},
  TrialumLocalChat:{busy:()=>locked,begin:()=>{if(locked)return false;locked=true;return true;},
   finish:()=>{locked=false;}},
  TrialumPlaygroundMemory:{remember:()=>false,recall:()=>({records:[]})},
  TrialumPlayground:{refreshProgress(){},localDialogue(){return null;}},
  TrialumShared:{getWorld:()=>world,getState:()=>state,
   sendPetSpeech:(s,p,text,lang,reply)=>{sent.push({s,p,text,lang,reply});return true;}},
  TrialumI18n:{language:()=> 'mk',t:text=>text}
 };
 vm.runInNewContext(sessions,root,{filename:'js/playground-dialogue-session.js'});
 vm.runInNewContext(code,root,{filename:'js/playground-ai.js'});
 vm.runInNewContext(scene,root,{filename:'js/shared-scene.js'});
 return {root,AI:root.TrialumPlaygroundAI,pet,world,state,calls,sent,
  advance(ms){now+=ms;},now(){return now;}};
}

test('local AI answers observed creature statements, 9:1 without stray topics',()=>{
 const h=harness(),AI=h.AI;
 AI.setTab('playground');
 assert.equal(AI.suppressSimulation('playground',h.world,h.pet),true);
 h.advance(25000);AI.tick(h.world,'playground');
 assert.equal(AI.onModelEvent({kind:'playgroundReply',petId:h.pet.id,
  text:'I wonder what is behind the colorful slide.'}),true);
 for(let i=1;i<10;i++){
  h.advance(25000);
  h.root.TrialumDialogueSessions.receive('playground','test_pet:'+SESSION,{
   id:'local-peer-'+i,petId:'other_pet',speaker:'Friend',
   text:'What is behind the slide and the blue toy?'},h.now());
  AI.tick(h.world,'playground');
  if(i!==9)assert.equal(AI.onModelEvent({kind:'playgroundReply',petId:h.pet.id,
    text:'Maybe the blue toy is hiding behind the slide.'}),true);
 }
 assert.equal(h.calls.length,9);
 assert.deepEqual(JSON.parse(JSON.stringify(AI.diagnostics('playground',h.pet))),
  {llm:9,scripted:1});
 h.pet.playgroundAiLocal=false;
 assert.equal(AI.suppressSimulation('playground',h.world,h.pet),false);
});

test('shared AI processes uniquely identified peer turns and 90/10 scripted replies',()=>{
 const h=harness(),AI=h.AI;
 AI.setTab('shared');
 assert.equal(AI.suppressSimulation('shared',h.world,h.pet,ROOM),true);
 assert.equal(h.root.TrialumSharedScene.dialogue(h.state.snapshot,h.now()),null);
 for(let i=0;i<10;i++){
  h.advance(25000);
  const turnId='0a7b1b26-3547-43a2-bae6-'+(0x1ff1a7be7b61+i).toString(16).padStart(12,'0');
  assert.equal(AI.onPeerSpeech({type:'pet_speech',petId:'peer',roomId:ROOM,
   speaker:'Friend',text:'Ајде во градината!',englishText:'Let us explore the garden.',
   translated:true,turnId}),true);
  AI.tick(h.world,'shared');
  if(i!==9)AI.onModelEvent({kind:'playgroundReply',petId:h.pet.id,
   text:'There is a beautiful flower near the garden.'});
 }
 assert.equal(h.calls.length,9);
 assert.equal(h.sent.length,10);
 assert.equal(h.sent[9].lang,'en');
 assert.equal(h.sent[9].reply,
   '0a7b1b26-3547-43a2-bae6-'+(0x1ff1a7be7b61+9).toString(16).padStart(12,'0'));
 assert.match(h.sent[9].text,/garden|plant/i);
 assert.deepEqual(JSON.parse(JSON.stringify(AI.diagnostics('shared',h.pet))),
  {llm:9,scripted:1});
 h.pet.playgroundAiShared=false;AI.stop();
 assert.equal(AI.suppressSimulation('shared',h.world,h.pet,ROOM),false);
 assert(h.root.TrialumSharedScene.dialogue(h.state.snapshot,h.now())?.text);
});

test('scripted simulation is preserved without verified local model',()=>{
 const h=harness();h.AI.setTab('shared');
 h.root.TrialumAndroid.modelStatus=()=> 'not-installed';
 assert.equal(h.AI.suppressSimulation('shared',h.world,h.pet,ROOM),false);
 assert(h.root.TrialumSharedScene.dialogue(h.state.snapshot,h.now())?.text);
});

test('native persistent service has the same 9:1 intent, consent and lease guards',()=>{
 const file=fs.readFileSync(
  'android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumBackgroundSpeechService.kt','utf8');
 for(const needle of ['(deliveredModelLines + deliveredScriptLines + 1) % 10 == 0','topicNudge(prompt)','relayLine(topicNudge(prompt), replyTo)',
   'model.ask(pet, petName, prompt.take(320), "mini", context, true)',
   'if (!running || paused || !authorized) return',
   'if (model.status() != "installed"',
   'return socket?.send(event.toString()) == true']){
  assert(file.includes(needle),'Native 9:1 background guard missing: '+needle);
 }
});
