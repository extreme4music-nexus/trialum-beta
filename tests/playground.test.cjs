const test=require('node:test'),assert=require('node:assert/strict');
const E={
 currentPet:s=>s.pets.find(p=>p.id===s.selectedPet)||null,
 evolutionProgress:p=>({level:p.level}),
 ensureLongplay:s=>{if(!s.longplay)s.longplay={credits:0,ledger:[]};return s.longplay;},
 evolutionGain:(s,p,n)=>{p.earned=(p.earned||0)+n;},
 log:(s,txt,kind)=>s.logs.push({txt,kind})
};
globalThis.TrialumEngine=E;
globalThis.TrialumPresence=require('../js/presence.js');
const PG=require('../js/playground.js');
function game(level=15,lab=4,credits=200,admitted=true){
 const p={id:'pet-1',name:'Миленко',level,energy:100,skills:{wave:1,spin:1,leap:1,symbols:0,logic:0,dialogue:0},earned:0};
 const s={lastDay:15,research:{level:lab},selectedPet:p.id,pets:[p],logs:[],longplay:{credits,ledger:[]}};
 if(admitted&&level>=15&&lab>=4)assert.equal(PG.send(s).ok,true);
 return s;
}
test('unlock is retroactive: requires pet level15 plus lab4',()=>{
 const s=game(14,4);assert.equal(PG.eligible(s).ok,false);
 s.pets[0].level=15;assert.equal(PG.eligible(s).ok,true);
 s.research.level=3;assert.equal(PG.eligible(s).ok,false);
});
test('initial toys start free and stay free on load/migration',()=>{
 const s=game();const q=PG.ensure(s);
 assert(q.unlocked.includes('sandbox'));assert(q.unlocked.includes('seesaw'));
 assert.equal(q.space,1);assert.equal(s.longplay.credits,200);
 q.unlocked=['slide'];PG.ensure(s);assert(q.unlocked.includes('sandbox'));assert(q.unlocked.includes('seesaw'));
});
test('new toys cost earned credits and require unlocked level, lab and space',()=>{
 const s=game(20,4,40);
 assert.equal(PG.unlock(s,'pool').ok,false,'pool requires level25');
 assert.equal(PG.unlock(s,'slide').ok,true);
 assert.equal(s.longplay.credits,24);
 assert.equal(PG.unlock(s,'slide').ok,false,'cannot unlock duplicate');
 s.pets[0].level=25;s.research.level=5;
 assert.equal(PG.unlock(s,'pool').ok,false,'space full');
 assert.equal(PG.expand(s).ok,false,'insufficient earned credits');
 s.longplay.credits=100;
 assert.equal(PG.expand(s).ok,true);assert.equal(PG.unlock(s,'pool').ok,true);
 assert.equal(PG.ensure(s).unlocked.length,4);
});
test('practice grants capped game XP; free replay never modifies world state',()=>{
 const s=game(25,5);
 const before=JSON.stringify(s);
 const r=PG.replay(s,'seesaw');assert.equal(r.ok,true);
 // First time view may migrate playground metadata but must never award coins/XP.
 assert.equal(s.pets[0].earned,0);assert.equal(s.longplay.credits,200);
 for(let n=0;n<PG.maxActions;n++)assert.equal(PG.start(s,'seesaw').ok,true);
 assert.equal(s.pets[0].earned,16);
 assert.equal(s.pets[0].skills.wave,2,'mastery advanced by bounded play');
 assert.equal(PG.start(s,'seesaw').ok,false);
 assert.equal(s.pets[0].earned,16,'no infinite XP');
 assert.equal(PG.replay(s,'seesaw').ok,true);
 assert.equal(s.pets[0].earned,16,'watch mode is free, has no rewards');
 s.lastDay++;assert.equal(PG.start(s,'seesaw').ok,true,'daily play resets');
});
test('cannot learn locked symbol/logic/dialogue skills by unauthorized toy activity',()=>{
 const s=game(45,9);s.pets[0].skills.symbols=0;s.pets[0].skills.logic=0;
 PG.start(s,'sandbox');assert.equal(s.pets[0].skills.symbols,0);
 s.pets[0].skills.symbols=1;s.lastDay++;
 assert.equal(PG.start(s,'sandbox').challenge,true);
 assert.equal(PG.answer(s,'wrong').ok,false);
 assert.equal(s.pets[0].earned,4,'wrong answer has no XP'); // first sandbox practice granted +4 XP
 const expected=PG.questions(PG.TOYS[0],s.pets[0]).answer;
 const actual=PG.answer(s,expected);
 assert.equal(actual.ok,true,'expected '+expected+' but got '+JSON.stringify(actual));
 assert.equal(s.pets[0].earned,8);
});
test('energy floor, no cheating and toy unlock ledger is auditable',()=>{
 const s=game(20,4,50);
 s.pets[0].energy=1;
 assert.equal(PG.start(s,'sandbox').ok,false);
 assert.equal(s.pets[0].earned,0);
 assert.equal(PG.unlock(s,'slide').ok,true);
 assert(s.longplay.ledger.some(x=>x.type==='spent'&&x.value===-16));
 assert.equal(PG.unlock(s,'trampoline').ok,false,'cannot bypass progression');
});
test('data stays local, no social requirement, upgrade caps',()=>{
 const s=game(250,40,9999);
 for(let i=0;i<4;i++)assert.equal(PG.expand(s).ok,true);
 assert.equal(PG.expand(s).ok,false);
 assert.equal(PG.ensure(s).space,5);
 assert.equal(typeof s.socialCredential,'undefined');
 assert.equal(typeof s.playground,'object');
});

test('trained dialogue has three local replies, capped progression and no online chat',()=>{
 const s=game(60,12);s.pets[0].skills.dialogue=1;
 assert.equal(PG.talk(s,'greeting').ok,true);
 assert.match(s.pets[0].lastSpeech,/Здраво/);
 assert.equal(s.pets[0].earned,4);
 assert.equal(PG.talk(s,'unknown').ok,false);
 assert.equal(PG.talk(s,'curious').ok,true);
 assert.equal(PG.talk(s,'playing').ok,true);
 assert.equal(PG.talk(s,'greeting').ok,true);
 assert.equal(PG.talk(s,'greeting').ok,false);
 assert.equal(s.pets[0].earned,16);
 assert.equal(typeof s.messages,'undefined');
});
test('symbols question is valid only for the pet who started it and that day',()=>{
 const s=game(50,10);const extra={...s.pets[0],id:'pet-2',name:'Другар',energy:100,skills:{symbols:1}};
 s.pets[0].skills.symbols=1;s.pets.push(extra);
 assert.equal(PG.start(s,'sandbox').challenge,true);
 s.selectedPet='pet-2';
 assert.equal(PG.answer(s,'△').ok,false);
 assert.equal(extra.earned,0);
 s.selectedPet='pet-1';
 assert.equal(PG.start(s,'sandbox').challenge,true);
 s.lastDay++;
 assert.equal(PG.answer(s,'△').ok,false);
 assert.equal(s.pets[0].earned,0);
});

test('LW-A explicit local send/return locks practice and survives save roundtrip',()=>{
 const s=game(20,4,200,false);
 assert.equal(PG.start(s,'seesaw').ok,false);
 const r=PG.send(s);assert.equal(r.ok,true);
 assert.equal(PG.send(s).ok,false,'no double admission');
 assert.equal(PG.start(s,'seesaw').ok,true);
 assert.equal(globalThis.TrialumPresence.atHome(s,'pet-1'),false);
 const resumed=JSON.parse(JSON.stringify(s));
 assert.equal(globalThis.TrialumPresence.isAt(resumed,'pet-1',globalThis.TrialumPresence.LOCAL),true);
 assert.equal(PG.returnPet(resumed).ok,true);
 assert.equal(PG.start(resumed,'seesaw').ok,false);
 assert.equal(globalThis.TrialumPresence.atHome(resumed,'pet-1'),true);
});
