/* v44 owner requirement: universal pet helper without LLM, scoped local history. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('../js/engine.js');
require('../js/evolution.js');
require('../js/progression.js');
require('../js/longplay.js');
require('../js/player-guide.js');
require('../js/pet-ai-capabilities.js');
require('../js/pet-chat-ui.js');
const Chat=globalThis.TrialumPetChat;
const prevDoc=globalThis.document;
const prevAndroid=globalThis.TrialumAndroid;
let prompt='Where do I get food?',saves=0,renders=0;
globalThis.document={getElementById:id=>id==='petChatPrompt'?{value:prompt}:null};
const ctx={toast:m=>{throw Error('Unexpected toast: '+m)},scheduleSave:()=>{saves++},render:()=>{renders++}};
function world(){
 const s=E.newGame('real');s.stage=7;s.research.level=1;
 const p={id:'pet-0',name:'Crystal One',species:0,birthDay:1,ageDays:3,
  satiety:50,energy:50,joy:50,clean:50,bond:50,actionsLeft:0,chatHistory:[]};
 s.pets.push(p);s.selectedPet=p.id;return {s,p};
}
function check(name,fn){fn();console.log('PASS',name)}
try{
check('primitive pet has full scrollable English chat without LLM or consent',()=>{
 const {s,p}=world();globalThis.TrialumAndroid=null;
 const html=Chat.render(s,p);
 assert(html.includes('id="petChatMessages"')&&html.includes('role="log"'));
 assert(html.includes('data-do="petChatAsk"'));
 assert(html.includes('Game assistant')&&html.includes('English only'));
 assert(html.includes('data-do="petChatMic"')&&html.includes('data-do="petChatSpeak"'));
 assert(!html.includes('data-do="petChatConsent"'));
});
check('non-AI chat writes only to selected pet history and uses no actions',()=>{
 const {s,p}=world();
 const q={...p,id:'pet-1',name:'Crystal Two',chatHistory:[]};s.pets.push(q);
 const initial=p.actionsLeft,credits=s.longplay.credits;
 prompt='Where do I get food?';
 assert.equal(Chat.handle('petChatAsk',s,p,ctx),true);
 assert.equal(p.chatHistory.length,2);
 assert.equal(p.chatHistory[0].role,'user');
 assert(p.chatHistory[1].text.includes('Warehouse'));
 assert.equal(q.chatHistory.length,0);
 assert.equal(p.actionsLeft,initial);assert.equal(s.longplay.credits,credits);
 assert(saves>0&&renders>0);
});
check('every current species can use no-LLM helper and preserve identity',()=>{
 const {s,p}=world();for(let species=0;species<E.SPECIES.length;species++){
  p.species=species;p.chatModelTier='helper';
  assert(Chat.render(s,p).includes('data-do="petChatAsk"'),species);
  const n=p.chatHistory.length;
  prompt='How do I earn credits?';
  assert(Chat.handle('petChatAsk',s,p,ctx));
  assert.equal(p.chatHistory.length,n+2);
  assert(p.chatHistory.at(-1).text.includes('Earn'));
 }
});
check('Mini/Advanced model choices remain optional and do not delete memory',()=>{
 const {s,p}=world();p.species=8;p.ageDays=9000;
 E.ensureEvolution(p);p.evolution.level=250;s.research.level=60;s.lastDay=9000;
 const memory=JSON.stringify(p.cognitiveMemory||{});
 const was=Chat.choose(s,p,'helper');assert(was);
 assert.equal(Chat.tier(p),'helper');
 assert.equal(Chat.choose(s,p,'mini'),true);
 assert.equal(Chat.tier(p),'mini');
 assert.equal(JSON.stringify(p.cognitiveMemory||{}),memory);
 assert.equal(Chat.handle('petChatAsk',s,p,ctx),false,'Mini handler must remain independent');
});
check('English-only validation rejects Cyrillic and accepts ordinary gameplay question',()=>{
 assert(Chat.validEnglish('How do I earn credits?'));
 assert(!Chat.validEnglish('Како да заработам кредити?'));
});
check('native Android resources are never queried for helper text responses',()=>{
 const {s,p}=world();
 globalThis.TrialumAndroid={askPet:()=>{throw Error('helper called AI inference')},
  askPetWithContext:()=>{throw Error('helper called AI inference')},startPetVoiceInput:()=>{}};
 prompt='What should I do next?';
 assert(Chat.handle('petChatAsk',s,p,ctx));
 assert(p.chatHistory.at(-1).text.includes('suggestion'));
});
check('existing Mini/Advanced dispatcher checks assistant first',()=>{
 const source=fs.readFileSync(require.resolve('../js/longplay-ui.js'),'utf8');
 assert(source.includes("handle?.('petChatAsk',s,pet,ctx)"));
 assert(source.includes("?'llmAsk':'mindAsk'"));
});
}finally{globalThis.document=prevDoc;globalThis.TrialumAndroid=prevAndroid;}
console.log('V44 PET HELPER TESTS PASSED');
