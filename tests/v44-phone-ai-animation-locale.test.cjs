/* Trialum v44 phone QA defects: silent Mini drop, mixed locale and synchronized creatures. */
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const room='11111111-2222-4333-8444-555555555555';
let language='en';
globalThis.TrialumI18n={language:()=>language,t:x=>x};
const pet={id:'pet-A',name:'My Pet',species:8,playgroundAiShared:true,playgroundAiLocal:true};
const world={pets:[pet],selectedPet:pet.id,research:{level:100}};
const presence={kind:'shared_playground',status:'active',ref:room,sessionId:'one-session'};
const state={active:true,online:true,aiRelayEnabled:true,speechReady:true,
 speechTranslationEnabled:false,selected:room,presenceEnabled:true,
 snapshot:{presenceEnabled:true,room:{id:room},occupants:[
  {pet:{id:pet.id,name:pet.name}},{pet:{id:'pet-B',name:'Friend'}}]},
 presences:[{petId:pet.id,sessionId:presence.sessionId,kind:'shared',roomId:room}]};
const generated=[],sent=[];
globalThis.TrialumEngine={SPECIES:Array.from({length:16},(_,i)=>({name:'Pet '+i,aiAbilities:{mini:{petLevel:1,labLevel:1}}})),
 currentPet:s=>s.pets.find(p=>p.id===s.selectedPet),evolutionProgress:()=>({level:200})};
globalThis.TrialumPresence={SHARED:'shared_playground',LOCAL:'local_playground',get:()=>presence,isAt:()=>true};
globalThis.TrialumPetAI={unlocked:()=>true};
globalThis.TrialumAndroid={modelStatus:()=> 'installed',
 askPlaygroundAi:(id,name,text,ctx)=>generated.push({id,name,text,ctx}),
 cancelPlaygroundAi(){}};
let busy=false;
globalThis.TrialumLocalChat={begin:()=>{if(busy)return false;busy=true;return true;},busy:()=>busy,finish:()=>{busy=false;}};
globalThis.TrialumShared={getWorld:()=>world,getState:()=>state,
 sendPetSpeech:(s,p,text,lang)=>{sent.push({s,p,text,lang});return true;}};
globalThis.TrialumGameKnowledge={search:()=>[]};
globalThis.TrialumAIContext={assemble:()=>JSON.stringify({language:'en',llmLanguage:'en',
 gameplay:'a'.repeat(850),memoryScope:'public',roomTurns:[]})};
globalThis.TrialumPlaygroundMemory={read:()=>[],remember:()=>false};
globalThis.TrialumDialogueSessions={ensure(){},count:()=>0,first:()=>null,
 next:()=>null,context:()=>[],receive:()=>true,start(){},answered(){}};
globalThis.document={visibilityState:'visible',hidden:false,addEventListener(){}};
globalThis.TrialumSharedScene={dialogue:()=>({text:'Пример',englishText:'Example',
 ids:['pet-A','pet-B'],turn:0}),refreshCaption(){}};
require('../js/playground-ai.js');
const AI=globalThis.TrialumPlaygroundAI;
test('Android bridge accepts the JS 1,450-character playground budget and rejects invalid inputs visibly',()=>{
 const activity=read('android-template/app/src/main/java/com/trialum/ziivaiskra/MainActivity.kt');
 const runtime=read('android-template/app/src/main/java/com/trialum/ziivaiskra/ModelRuntime.kt');
 const bridge=activity.split('@JavascriptInterface fun askPlaygroundAi(')[1].split('@JavascriptInterface fun cancelPlaygroundAi()')[0];
 assert(bridge.includes('context.length <= 1450'));
 assert(!bridge.includes('context.length <= 700'));
 assert(bridge.includes('rejectPlaygroundRequest'));
 assert(runtime.includes('fun rejectPlaygroundRequest('));
 assert(runtime.includes('if (playground) 1450'));
});
test('Mini actually dispatches context larger than the former silent 700-char limit',()=>{
 AI.setTab('shared');AI.tick(world,'shared');
 assert.equal(generated.length,1);
 assert(generated[0].ctx.length>700&&generated[0].ctx.length<=1450);
 assert.equal(AI.onModelEvent({kind:'playgroundReply',petId:pet.id,text:'Let us try the slide!'}),true);
 assert.equal(sent.length,1);
 assert.equal(sent[0].text,'Let us try the slide!');
 assert.equal(sent[0].lang,'en');
 AI.stop();
});
test('English UI shows English-only on-device AI control, MK UI shows Macedonian',()=>{
 language='en';const en=AI.control(world,pet,'shared',true);
 assert(en.includes('Optional on-device playground AI'));
 assert(en.includes('while the game is visible'));
 assert(en.includes('Turn off AI for this pet'));
 assert(en.includes('data-no-translate'));
 assert(!en.includes('додека екранот'));
 assert(!en.includes('излез AI'));
 language='mk';const mk=AI.control(world,pet,'shared',true);
 assert(mk.includes('Изборна локална AI'));
 assert(mk.includes('играта е видлива'));
 assert(!mk.includes('Optional on-device playground AI'));
 language='en';
});
test('English canonical turn is not discarded when server translation is not returned',()=>{
 AI.setTab('shared');state.speechTranslationEnabled=true;
 language='mk';
 const turn={type:'pet_speech',roomId:room,petId:'pet-B',speaker:'Friend',text:'Hello!',language:'en',
 turnId:'10101010-1010-4010-8010-101010101010',translated:false};
 assert.equal(AI.onPeerSpeech(turn),true);
 assert.equal(AI.speech('shared',room).text,'Hello!');
 state.speechTranslationEnabled=false;language='en';AI.stop();
});
test('shared room captions use selected locale, scripted network seed stays English',()=>{
 AI.setTab('pets'); // Disable active foreground Mini simulation for visual fallback inspection.
 const rendered=[];
 globalThis.TrialumCreatureArt={draw(ctx,p,at,t,selected,progress,action){
  rendered.push({name:p.name,x:at.x,y:at.y,skill:action?.skill||null,start:action?.start||null,
   duration:action?.duration||null});
 }};
 globalThis.TrialumSharedArt={paint(){},TOYS:{
  sandbox:{x:155,y:420},seesaw:{x:500,y:420},slide:{x:350,y:370},
  pool:{x:730,y:430},obstacle:{x:580,y:370},trampoline:{x:830,y:380}},
 slot(id){return this.TOYS[id]}};
 require('../js/shared-scene.js');
 const scene=globalThis.TrialumSharedScene;
 const s={room:{id:room},presenceEnabled:true,toys:['sandbox','seesaw','slide','pool','obstacle','trampoline'],
 occupants:[
  {display:'Owner A',pet:{id:'same-pet-id',name:'Friend One',seed:5,hue:190}},
  {display:'Owner B',pet:{id:'same-pet-id',name:'Friend Two',seed:5,hue:190}}]};
 const ctx={fillText(){},fillRect(){},beginPath(){},arc(){},fill(){}};
 language='en';
 const english=scene.dialogue(s,0);
 assert(english.text.includes('Hey')||english.text.includes('What')||english.text.includes('Look')||english.text.includes('Can')||english.text.includes('Shall')||english.text.includes('Yes')||english.text.includes('Of'));
 assert(english.englishText);
 language='mk';const macedonian=scene.dialogue(s,0);
 assert.notEqual(macedonian.text,english.text);
 assert.equal(macedonian.englishText,english.englishText);
 language='en';
 scene.draw(ctx,s,123.4);
 assert.equal(rendered.length,2);
 assert.notEqual(rendered[0].x,rendered[1].x,'even identical backup pet IDs have owner-scoped motion');
 const first=rendered.slice();
 rendered.length=0;
 scene.draw(ctx,s,125.4);
 assert.equal(rendered.length,2);
 assert(rendered.some((p,i)=>p.x!==first[i].x||p.y!==first[i].y||p.skill!==first[i].skill));
 assert(!read('js/shared-scene.js').includes('start:t-1.5'));
});
