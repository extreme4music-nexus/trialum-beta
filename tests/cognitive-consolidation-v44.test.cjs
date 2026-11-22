'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../js/cognitive-memory.js');
const X=require('../js/cognitive-context.js');
const P=require('../js/playground-memory.js');
const noon=(y,m,d)=>new Date(y,m-1,d,12).getTime();

test('lifelong semantic memories consolidate to months and years without TTL',()=>{
 const p={id:'long-life',species:999};
 X.remember(p,{day:'2019-04-12',place:'shared',topics:['music'],companions:['Luna'],moments:7});
 X.remember(p,{day:'2025-07-04',place:'shared',topics:['stars'],moments:2});
 X.remember(p,{day:'2026-11-21',place:'local',topics:['science','food'],moments:1});
 const run=X.consolidate(p,{now:noon(2026,11,22),gameDay:2500,force:true});
 assert.equal(run.ran,true);
 const m=X.context(p);
 assert.equal(Object.keys(m.days).length,1);
 assert.equal(m.months['2025-07|shared'].moments,2);
 assert.equal(m.years['2019|shared'].moments,7);
 assert.equal(m.years['2019|shared'].topics[0],'music');
 assert.equal(X.recall(p,'Што правевме во 2019?',noon(2026,11,22)).records[0].themes[0],'music');
 const copy=JSON.parse(JSON.stringify(p));
 X.consolidate(copy,{now:noon(2040,11,22),gameDay:8000,force:true});
 assert(X.recall(copy,'во 2019',noon(2040,11,22)).found);
 assert.equal(X.context(copy).years['2019|shared'].moments,7);
});

test('public playground memory cannot reveal private playground observations',()=>{
 const p={id:'private',species:42};
 X.remember(p,{day:'2026-11-22',place:'local',topics:['food'],companions:['Owner'],moments:1});
 X.remember(p,{day:'2026-11-22',place:'shared',topics:['stars'],companions:['Luna'],moments:2});
 const pub=X.recall(p,'today',noon(2026,11,22),{publicScope:true});
 assert.equal(pub.records.length,1);
 assert.equal(pub.records[0].place,'shared');
 assert.equal(pub.records[0].themes[0],'stars');
 assert(!JSON.stringify(pub).includes('Owner'));
 assert(X.recall(p,'today',noon(2026,11,22)).records.some(x=>x.place==='local'));
});

test('legacy rolling playground memory migrates once, including older than 45 days',()=>{
 const p={id:'legacy-pet',playgroundAiMemories:[{day:'2018-04-07',place:'shared',topics:['music'],
  companions:['Lumi'],moments:11}]};
 C.ensureWorld({pets:[p],lastDay:3000});
 const x=X.context(p);
 assert.equal(x.years['2018|shared'].moments,11);
 const old=JSON.stringify(p);
 C.ensureWorld({pets:[p],lastDay:3000});
 assert.equal(JSON.stringify(p),old,'save/load hydration is idempotent');
 assert.equal(C.ensure(p).eventLedger.length,0,'migration cannot fabricate event history');
 assert.equal(X.recall(p,'2018').records[0].moments,11);
});

test('native background replay does not duplicate permanent semantic summaries',()=>{
 const now=noon(2026,11,22),p={id:'pet-bg'};
 assert(P.remember(p,{place:'shared',companion:'Luna',said:'slide',now}));
 const first={day:'2026-11-22',place:'shared',topics:['music'],companions:['Star'],moments:3};
 const packet={petId:p.id,streamId:'31ed2e76-25b6-4aba-acdb-6169530f4a28',revision:3,entries:[first]};
 assert.equal(P.ingestBackground(p,packet,now),true);
 assert.equal(X.context(p).days['2026-11-22|shared'].moments,4);
 const frozen=JSON.stringify(p);
 assert.equal(P.ingestBackground(p,packet,now),false);
 assert.equal(JSON.stringify(p),frozen);
 const newer={...packet,revision:4,entries:[{...first,moments:4}]};
 assert.equal(P.ingestBackground(p,newer,now),true);
 const restored=JSON.parse(JSON.stringify(p));
 assert.equal(X.context(restored).days['2026-11-22|shared'].moments,5);
 assert.equal(P.ingestBackground(restored,newer,now),false);
 X.consolidate(restored,{now:noon(2032,11,22),force:true});
 assert.equal(X.recall(restored,'2026',noon(2032,11,22)).records[0].moments,5);
 P.clear(restored);
 assert.equal(X.recall(restored,'2026',noon(2032,11,22)).found,false);
 assert.equal(P.recall(restored,'2026',noon(2032,11,22)).found,false);
 assert.equal(Object.keys(X.context(restored).nativeStreams).length,0);
});

test('event payload compression retains milestones, lifetime counters and old replay protection',()=>{
 const p={id:'compress',species:400};
 const at=noon(2017,2,1);
 C.record(p,'birth',{day:1,at});
 C.record(p,'evolution',{day:40,level:4,at:at+DAY()});
 const first={kind:'feed',source:'game',eventId:'historical:0',at:at+2000,day:3,food:'biomass',quantity:3};
 for(let i=0;i<1800;i++){
  const input={...first,eventId:'historical:'+i,at:first.at+i};
  assert.equal(C.ingest(p,input).inserted,true);
 }
 const oldSize=JSON.stringify(p).length;
 const result=X.consolidate(p,{now:noon(2026,11,22),gameDay:1200,force:true});
 assert.equal(result.archived,1800);
 assert.deepEqual(C.ensure(p).eventLedger.map(x=>x.kind),['birth','evolution']);
 assert.equal(C.ensure(p).self.counts.feed,1800);
 assert.equal(C.ensure(p).self.last.feed.quantity,3);
 assert.equal(C.ensure(p).self.years['0'].counts.feed,1800);
 assert(JSON.stringify(p).length<oldSize*.65,'old raw details should shrink substantially');
 const replay=C.ingest(p,first);
 assert.equal(replay.duplicate,true);
 assert.equal(replay.archived,true);
 assert.equal(C.ensure(p).self.counts.feed,1800);
 assert.throws(()=>C.ingest(p,{...first,quantity:99}),/collision/);
 const restored=JSON.parse(JSON.stringify(p));
 assert.equal(C.ingest(restored,first).duplicate,true);
 assert.equal(C.ensure(restored).self.counts.feed,1800);
});
function DAY(){return 86400000;}

test('native daily to monthly to yearly archival is replay-safe and remains lifelong',()=>{
 const p={id:'native-archive'},now=noon(2026,11,22),streamId='31ed2e76-25b6-4aba-acdb-6169530f4a28';
 const base={petId:p.id,streamId,revision:1,
  entries:[{day:'2026-11-22',place:'shared',topics:['music'],companions:['Moon'],moments:3}]};
 assert(P.ingestBackground(p,base,now));
 assert.equal(X.context(p).days['2026-11-22|shared'].moments,3);
 const monthly={...base,revision:2,
  months:[{month:'2026-11',place:'shared',topics:['music'],companions:['Moon'],moments:3}]};
 assert(P.ingestBackground(p,monthly,now));
 assert.equal(X.context(p).nativeStreams[streamId].months['2026-11'],3);
 const more={...monthly,revision:3,entries:[],
  months:[{...monthly.months[0],moments:5}]};
 assert(P.ingestBackground(p,more,now));
 assert.equal(X.context(p).months['2026-11|shared'].moments,2);
 const old={...more,revision:4,months:[],years:[
  {year:'2026',place:'shared',topics:['music'],companions:['Moon'],moments:5},
  {year:'2017',place:'shared',topics:['stars'],companions:['Comet'],moments:20}
 ]};
 assert(P.ingestBackground(p,old,now));
 assert.equal(X.context(p).years['2017|shared'].moments,20);
 assert.equal(X.context(p).nativeStreams[streamId].years['2026'],5);
 const copy=JSON.parse(JSON.stringify(p));
 assert.equal(P.ingestBackground(copy,old,now),false);
 X.consolidate(copy,{now:noon(2037,11,22),force:true});
 assert.equal(X.context(copy).years['2026|shared'].moments,5);
 assert.equal(X.recall(copy,'2017',noon(2037,11,22)).records[0].moments,20);
 const malformed={...old,revision:5,months:[{month:'2026-00',moments:2}]};
 assert.equal(P.ingestBackground(copy,malformed,now),false);
 assert.equal(X.context(copy).years['2017|shared'].moments,20);
});

test('canonical thematic timeline never retains other players literal speech',()=>{
 const p={id:'only-themes'};
 const phrase='We played music and met on www.private.example SECRET_TOKEN_12345';
 assert(P.remember(p,{place:'shared',companion:'Friend <script> / http://bad.example',
  heard:phrase,said:'We sang music together',now:noon(2026,11,22)}));
 const serialized=JSON.stringify(p.cognitiveMemory);
 assert(!serialized.includes('SECRET_TOKEN_12345'));
 assert(!serialized.includes('www.private.example'));
 assert(!serialized.includes('We sang'));
 assert(!serialized.includes('<script>'));
 assert(X.recall(p,'music',noon(2026,11,22),{publicScope:true}).found);
});
