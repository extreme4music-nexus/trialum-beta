'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const E={
 currentPet:s=>s.pets.find(p=>p.id===s.selectedPet)||null,
 evolutionProgress:p=>({level:p.level}),
 ensureLongplay:s=>s.longplay||(s.longplay={credits:0,ledger:[]}),
 evolutionGain:(s,p,n)=>{p.earned=(p.earned||0)+n;},
 log:(s,txt,kind)=>s.logs.push({txt,kind})
};
globalThis.TrialumEngine=E;
const P=require('../js/presence.js');globalThis.TrialumPresence=P;
const PG=require('../js/playground.js');
require('../js/shared-scene.js');
const SharedScene=globalThis.TrialumSharedScene;
const START=1800000000000,ONE_DAY=86400000;
function pet(id='pet-1'){return {id,name:id==='pet-1'?'Лумира':'Синапсо',
 level:35,energy:100,hue:140,skills:{wave:2,spin:1,leap:1,symbols:0,logic:0,dialogue:0},earned:0};}
function world(){const p=pet();return {lastDay:90,research:{level:9},selectedPet:p.id,pets:[p],
 logs:[],longplay:{credits:500,ledger:[]}};}
const session=(s,p=s.pets[0])=>PG.ensure(s).autonomy[p.id];
const award=s=>s.pets.reduce((n,p)=>n+(p.earned||0),0);
function make(s=world(),now=START){
 assert(PG.send(s,now).ok);
 const a=session(s);assert(a&&a.version===2);
 assert.equal(a.durationMs,P.LOCAL_SESSION_MS);
 assert.equal(a.nextAt,now+4000,'first real play starts 4s after admission');
 assert.equal(a.activityCount,0);
 return s;
}
function finish(s,now=START){
 const a=session(s);return PG.reconcile(s,now+a.durationMs+100);
}
test('owner finding: first real activity at 4s, NOT 6–22 minutes',()=>{
 const s=make(),a=session(s);
 assert.equal(PG.reconcile(s,START+3999).changed,false);
 assert.equal(a.events.length,0);
 const r=PG.reconcile(s,START+4000);
 assert.equal(r.changed,true);
 assert.equal(a.events.length,1);
 assert.equal(a.events[0].kind,'practice');
 assert.equal(a.events[0].xp,4);
 assert.equal(award(s),4);
 assert.equal(a.activityCount,1);
 assert.equal(PG.nextCheckpoint(s,s.pets[0],START+4000).seconds,12);
 assert.match(PG.render(s),/Самостојна игра во реално време/);
 assert.equal(PG.reconcile(s,START+4000).changed,false,'repeat same timestamp cannot award twice');
 assert.equal(award(s),4);
});
test('quick autonomous actions continue after four reward slots without more XP',()=>{
 const s=make(),a=session(s);
 for(let t=START+4000;t<=START+5*60000;t+=12000)PG.reconcile(s,t);
 assert(a.activityCount>=20,'pet must keep playing for five minutes, not stay at 0/4');
 assert(a.activityLog.length<=16,'bounded persistent activity journal');
 assert.equal(a.events.length,4,'only four XP-eligible events per session');
 assert(award(s)>0&&award(s)<=16);
 const prev=award(s),count=a.activityCount;
 PG.reconcile(s,START+5*60000+12000);
 assert(a.activityCount>count,'non-rewarding activity continues after XP cap');
 assert.equal(award(s),prev);
 assert.equal(P.atHome(s,'pet-1'),false,'pet should keep playing until owner returns');
});
test('one full session ends safely, summarizes earned events and never double-rewards',()=>{
 const s=make(),a=session(s);
 const ended=finish(s);
 assert(ended.changed);assert.equal(ended.summaries.length,1);
 assert.equal(a.finished,true);assert.equal(a.events.length,4);
 assert(a.events.every((e,i)=>e.ordinal===i+1));
 assert(a.events.every(e=>a.toys.includes(e.toyId)&&[0,4].includes(e.xp)));
 assert(award(s)<=16);
 assert.equal(ended.summaries[0].xpEarned,a.events.reduce((n,e)=>n+e.xp,0));
 assert.equal(P.atHome(s,'pet-1'),true);
 const total=award(s);
 assert.equal(PG.reconcile(s,START+P.LOCAL_SESSION_MS*2).changed,false);
 assert.equal(award(s),total);
 assert.equal(PG.ensure(s).autonomyHistory.length,1);
});
test('idempotent state survives JSON restore, repeated ticks and backward clock',()=>{
 const s=make(),a=session(s);
 PG.reconcile(s,START+4000+2*12000);
 const restored=JSON.parse(JSON.stringify(s));
 assert.equal(award(s),award(restored));
 const rollback=PG.reconcile(restored,START+2000);
 assert.equal(rollback.changed,false);
 assert.equal(PG.reconcile(restored,START+4000+2*12000).changed,false);
 const future=START+4000+5*12000;
 PG.reconcile(s,future);PG.reconcile(restored,future);
 assert.deepEqual(session(s).events,session(restored).events);
 assert.deepEqual(session(s).activityLog,session(restored).activityLog);
 assert.equal(award(s),award(restored));
});
test('manual and autonomous XP obey ONE shared four-actions-per-day cap',()=>{
 const s=make(),a=session(s);
 for(let i=0;i<4;i++)assert.equal(PG.start(s,'seesaw').ok,true);
 assert.equal(award(s),16);
 PG.reconcile(s,START+4000+8*12000);
 assert.equal(award(s),16,'automatic play must never stack XP beyond manual cap');
 assert.equal(PG.ensure(s).practice['pet-1'].count,4);
 assert(a.activityCount>4,'the creature still plays after earning cap');
});
test('early return home ends visit with only elapsed actions and no repeated grant',()=>{
 const s=make(),a=session(s);
 const r=PG.returnPet(s,START+28000);
 assert(r.ok);assert.equal(r.summary.reason,'returned');
 assert.equal(r.summary.elapsedMs,28000);
 assert.equal(P.atHome(s,'pet-1'),true);
 assert.equal(r.summary.xpEarned,award(s));
 assert(a.activityCount>=2&&a.activityCount<=3);
 const total=award(s);
 assert.equal(PG.returnPet(s,START+29000).ok,false);
 assert.equal(PG.reconcile(s,START+100000).changed,false);
 assert.equal(award(s),total);
});
test('two pets on the same local playground speak, answer and play independently',()=>{
 const s=world();s.pets.push(pet('pet-2'));
 make(s,START);s.selectedPet='pet-2';assert(PG.send(s,START+100).ok);
 const q=PG.localDialogue(s,s.pets[0],START+3000);
 const answer=PG.localDialogue(s,s.pets[0],START+5000);
 assert(q&&answer&&q.partner==='pet-2');
 assert.equal(q.speaker,s.pets[0].name);
 assert.equal(answer.speaker,s.pets[1].name);
 assert.notEqual(q.text,answer.text,'other pet must reply, not mirror question');
 PG.reconcile(s,START+5000);
 assert(award(s)>=8,'both independent local pets begin real rewarded play quickly');
 assert.equal(P.atHome(s,'pet-1'),false);
 assert.equal(P.atHome(s,'pet-2'),false);
});
test('single pet chirps in real time without requiring prelearned dialogue skill',()=>{
 const s=make(),p=s.pets[0],a=session(s),state=JSON.stringify(s);
 const a1=PG.localDialogue(s,p,START+1000),a2=PG.localDialogue(s,p,START+5000);
 assert(a1&&a2&&a1.text!==a2.text);
 assert.equal(PG.spectator(s,p,START+1000).toyId!==undefined,true);
 assert.deepEqual(PG.spectator(s,p,START+1000),PG.spectator(s,p,START+1000));
 assert.equal(a.activityCount,0);
 assert.equal(JSON.stringify(s),state,'watching/communication must not mutate saved progress');
});
test('legacy v1 sessions upgrade without retroactive rewards or lost prior events',()=>{
 const s=make(),a=session(s);
 PG.reconcile(s,START+4000);
 const oldXP=award(s),oldCount=a.events.length;
 a.version=1;a.durationMs=40*60000;a.endAt=START+a.durationMs;
 delete a.activityCount;delete a.activityLog;delete a.nextAt;
 PG.reconcile(s,START+10*60000);
 assert.equal(a.version,2);
 assert.equal(a.events.length,oldCount);
 assert.equal(award(s),oldXP);
 assert.equal(a.nextAt,START+10*60000+4000);
 PG.reconcile(s,START+10*60000+4000);
 assert(a.activityCount>oldCount);
 assert(award(s)<=16,'upgrading cannot repeat prior XP beyond daily limit');
});
test('older LW-A sessions without autonomous record never get retroactive XP',()=>{
 const s=world();assert(P.enter(s,'pet-1',P.LOCAL,null,START).ok);
 assert.equal(PG.reconcile(s,START+P.LOCAL_SESSION_MS+1).changed,false);
 assert.equal(award(s),0);
 assert.equal(P.expireLocal(s,START+P.LOCAL_SESSION_MS+1).changed,true);
 assert.equal(award(s),0);
});
test('wrong clock/secret toy/invalid reward ledgers cannot mint local XP',()=>{
 const s=make(),a=session(s);
 a.toys=['__proto__'];assert.equal(PG.reconcile(s,START+4000).changed,false);
 assert.equal(award(s),0);
 const x=make(),b=session(x);
 b.events.push({ordinal:42,at:START,toyId:'seesaw',xp:999});
 assert.equal(PG.reconcile(x,START+4000).changed,false);
 assert.equal(award(x),0);
});
test('one, ten and 100 sessions keep daily XP capped, 20 history records and safe locations',()=>{
 for(const count of [1,10,100]){
  const s=world();
  let now=START;
  for(let i=0;i<count;i++){
   s.lastDay++;s.pets[0].energy=100;
   make(s,now);
   assert.equal(finish(s,now).summaries.length,1);
   assert.equal(P.atHome(s,'pet-1'),true);
   const last=award(s);
   assert.equal(PG.reconcile(s,now+P.LOCAL_SESSION_MS+1).changed,false);
   assert.equal(award(s),last);
   now+=ONE_DAY;
  }
  assert(award(s)<=16*count);
  assert.equal(PG.ensure(s).autonomyHistory.length,Math.min(count,20));
 }
});
test('shared room pets exchange immediate coherent simulated dialogue, no fake local XP',()=>{
 const s=world(),a=P.enter(s,'pet-1',P.SHARED,'room-test',START);
 assert(a.ok);assert.equal(PG.reconcile(s,START+5*60000).changed,false);
 assert.equal(award(s),0);
 const snap={room:{id:'room-verified'},presenceEnabled:true,
  occupants:[{pet:{id:'a',name:'Еко'}},{pet:{id:'b',name:'Лумира'}}]};
 const q=SharedScene.dialogue(snap,START),reply=SharedScene.dialogue(snap,START+3500);
 assert(q&&reply);
 assert.notEqual(q.speaker,reply.speaker);
 assert.notEqual(q.text,reply.text);
 assert.deepEqual(SharedScene.dialogue(snap,START),q);
 assert.equal(SharedScene.dialogue({...snap,occupants:[]},START),null);
 assert.equal(SharedScene.dialogue({...snap,presenceEnabled:false},START),null);
 assert.equal(SharedScene.dialogue({...snap,room:null},START),null);
 const shared=fs.readFileSync(require('node:path').join(__dirname,'../js/shared-playground.js'),'utf8');
 assert(shared.includes('Групни поени се доделуваат само за потврдени активности'),
  'real-time shared conversation must not fake server-authoritative points');
});
test('HTML display and replay cannot create rewards or new timeline events',()=>{
 const s=make(),a=session(s),before=award(s);
 PG.replay(s,'seesaw');
 assert.match(PG.render(s),/Самостојна игра во реално време/);
 assert.equal(award(s),before);assert.equal(a.activityCount,0);
 PG.reconcile(s,START+4000);
 const total=award(s);
 const html=PG.render(s);
 assert.match(html,/интеракции/);
 assert.equal(award(s),total);
});
