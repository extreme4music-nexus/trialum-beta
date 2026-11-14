'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/playground-dialogue-session.js','utf8');
function fresh(){
 const root={Date,Math};vm.runInNewContext(source,root);
 return root.TrialumDialogueSessions;
}
const ROOM='room-verified';
test('immutable pet IDs separate same-name speakers and discard duplicate turn IDs',()=>{
 const a=fresh();
 assert(a.receive('shared',ROOM,{id:'t1',petId:'one',speaker:'Нубела',text:'Што има зад лизгалката?'}));
 assert(a.receive('shared',ROOM,{id:'t2',petId:'two',speaker:'Нубела',text:'Ајде да истражиме.'}));
 assert(!a.receive('shared',ROOM,{id:'t1',petId:'one',speaker:'Нубела',text:'Реприза'}));
 assert.equal(a.count('shared',ROOM),2);
 const t=a.context('shared',ROOM,null,1200);
 assert.equal(t[0].id,'one');assert.equal(t[1].id,'two');
});
test('only other pets may answer; server-linked reply closes exactly that question',()=>{
 const a=fresh();
 a.receive('shared',ROOM,{id:'turnA',petId:'pet1',speaker:'Мнемос 1',text:'Што ќе истражуваме?'});
 assert.equal(a.next('shared',ROOM,'pet1',['pet1','pet2']),null);
 assert.equal(a.next('shared',ROOM,'pet2',['pet1','pet2'])?.id,'turnA');
 a.receive('shared',ROOM,{id:'turnB',petId:'pet2',speaker:'Мнемос 2',
  text:'Позади лизгалката.',replyTo:'turnA'});
 assert.equal(a.next('shared',ROOM,'pet2',['pet1','pet2']),null);
 assert.equal(a.next('shared',ROOM,'pet1',['pet1','pet2'])?.id,'turnB');
});
test('three/four-pet roster nominates one stable responder at a time',()=>{
 const a=fresh(),b=fresh(),now=1_000_000;
 const roster=['first','second','third','fourth'];
 a.receive('shared',ROOM,{id:'source1',petId:'first',speaker:'Нубела',text:'Ајде на лулашката.'},now);
 b.receive('shared',ROOM,{id:'source1',petId:'first',speaker:'Нубела',text:'Ајде на лулашката.'},now);
 const nominees=roster.filter(p=>a.next('shared',ROOM,p,roster,now));
 assert.equal(nominees.length,1);
 assert.equal(b.next('shared',ROOM,nominees[0],roster,now)?.id,'source1');
 const later=roster.filter(p=>a.next('shared',ROOM,p,roster,now+30001));
 assert.equal(later.length,1);
 assert.notEqual(later[0],nominees[0],'30s fallback for absent/non-AI nominated speaker');
});
test('longer room memory stays bounded, can revive old unhandled context, and never escapes a room',()=>{
 const a=fresh(),now=2_000_000;
 for(let i=0;i<45;i++)a.receive('shared',ROOM,{
  id:'turn'+i,petId:i%2?'pet2':'pet1',speaker:i%2?'Другар':'Мнемос',
  text:'Идеја '+i+' за лизгалката.'},now+i);
 assert.equal(a.count('shared',ROOM),a.MAX_TURNS);
 const older=a.context('shared',ROOM,null,1100,()=>0);
 assert(older.some(x=>x.text.includes('Идеја 9')),'older still-present turn may return');
 assert(JSON.stringify(older).length<=1100);
 assert.equal(a.count('shared','another-room'),0,'different room never inherits transcript');
 assert.equal(a.latest('shared','another-room'),null);
});
test('session text is never persisted, while local speech stays separate from shared',()=>{
 const a=fresh();
 a.receive('playground','local-lease',{id:'local1',petId:'p',speaker:'P',text:'Local-only talk'});
 assert.equal(a.count('shared',ROOM),0);
 assert.equal(a.count('playground','local-lease'),1);
 a.start('playground','local-lease');
 assert.equal(a.first('playground','local-lease'),true);
 a.clear('playground');
 assert.equal(a.count('playground','local-lease'),0);
 assert(!/localStorage|sessionStorage|fetch\(|WebSocket|indexedDB/.test(source));
});

test('unanswered room question survives turn-ring overflow ahead of answered chatter',()=>{
 const a=fresh(),now=3_000_000;
 a.receive('shared',ROOM,{id:'open-question',petId:'pet1',speaker:'Немастри',
  text:'Зошто да играме на лулашката?'},now);
 // The later 36 messages are already handled; they must not erase the
 // earlier still-open question just because the fixed ring fills up.
 for(let i=0;i<36;i++){
  const id='handled-'+i;
  assert(a.receive('shared',ROOM,{id,petId:'pet1',speaker:'Немастри',
   text:'Разговаравме за лулашката.'},now+i+1));
  a.answered('shared',ROOM,id);
 }
 assert.equal(a.count('shared',ROOM),a.MAX_TURNS);
 assert.equal(a.next('shared',ROOM,'pet2',['pet1','pet2'],now+40)?.id,'open-question');
 a.receive('shared',ROOM,{id:'reply',petId:'pet2',speaker:'Другар',
  text:'Затоа што е забавно.',replyTo:'open-question'},now+41);
 assert.equal(a.next('shared',ROOM,'pet2',['pet1','pet2'],now+42),null);
});
