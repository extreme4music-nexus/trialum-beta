'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../js/cognitive-memory.js');
const X=require('../js/cognitive-context.js');
const E=require('../js/engine.js');
globalThis.TrialumEngine=E;
const I=require('../js/memory-integrity.js');
const A=require('../js/ai-context.js');
require('../js/storage.js');
const date=(y,m,d)=>new Date(y,m-1,d,12).getTime();
const size=o=>Buffer.byteLength(JSON.stringify(o),'utf8');
const total=rows=>Object.values(rows).reduce((n,v)=>n+v.moments,0);
test('twenty calendar years of individual memories consolidate without expiry or fabricated events',()=>{
 const p={id:'longevity-20yr',name:'Oldest pet',species:777,birthDay:1};
 let count=0;
 for(let at=date(2006,11,22);at<=date(2026,11,22);at+=86400000){
  const day=new Date(at).toISOString().slice(0,10);
  X.remember(p,{day,place:count%5===0?'local':'shared',
   topics:count%2?['stars','friendship']:['music','nature'],moments:1});
  count++;
 }
 const before=size(p),now=date(2026,11,22);
 const result=X.consolidate(p,{now,gameDay:9000,force:true});
 assert.equal(result.ran,true);
 const x=X.context(p);
 assert.equal(total(x.days)+total(x.months)+total(x.years),count);
 assert(Object.keys(x.days).length<=46,'daily detail remains bounded');
 assert(Object.keys(x.months).length<=52,'months stay bounded at two scopes');
 assert(Object.keys(x.years).length>=18,'old years remain available');
 assert(size(p)<before*.35,'yearly semantic consolidation should save most of the JSON');
 assert(X.recall(p,'Во 2008',now).found);
 assert(X.recall(p,'2016',now,{publicScope:true}).records.every(v=>v.place==='shared'));
 const restored=JSON.parse(JSON.stringify(p));
 X.consolidate(restored,{now:date(2045,11,22),force:true});
 assert.equal(total(X.context(restored).days)+total(X.context(restored).months)+
  total(X.context(restored).years),count);
 assert(X.recall(restored,'2008',date(2045,11,22)).found);
 assert.equal(C.ensure(restored).eventLedger.length,0,'no histories were invented');
 console.log('V44 longevity profile',JSON.stringify({years:20,observations:count,
  rawBytes:before,consolidatedBytes:size(p),ratio:Number((size(p)/before).toFixed(3))}));
});
test('1000 pets keep separate lifelong memory identities through JSON save and compression',()=>{
 const pets=[],now=date(2026,11,22);
 for(let i=0;i<1000;i++){
  const p={id:'stress-pet-'+i,name:'Pet '+i,species:i%18,birthDay:1};
  C.record(p,'birth',{at:date(2009,1,1),day:1});
  for(let y=2010;y<2026;y++)X.remember(p,{day:y+'-04-01',
   place:i%2?'shared':'local',topics:[i%3?'music':'stars'],moments:4});
  for(let j=0;j<12;j++)C.record(p,'feed',{day:2+j,
   at:date(2015,1,1)+j*86400000,food:'biomass',quantity:3});
  pets.push(p);
 }
 const world={pets,lastDay:8000};
 C.ensureWorld(world);
 for(const i of [0,101,499,999]){
  assert.equal(C.ensure(pets[i]).self.counts.feed,12);
  assert.equal(C.ensure(pets[i]).self.counts.birth,1);
  assert.equal(X.recall(pets[i],'2012',now).found,true);
  assert.equal(C.ensure(pets[i]).petId,pets[i].id);
 }
 const info=I.inspect(world);
 assert.equal(info.pets,1000);
 assert.equal(info.receipts,12000);
 assert(info.bytes<I.MAX_WORLD_BYTES,'private memory profile must fit preflight safety budget');
 const copy=JSON.parse(JSON.stringify(world));
 assert.equal(I.inspect(copy).pets,1000);
 assert.equal(C.ensure(copy.pets[999]).self.counts.feed,12);
 assert.equal(C.ensure(copy.pets[0]).social.peers['stress-pet-999'],undefined);
 console.log('V44 roster profile',JSON.stringify({pets:1000,moments:1000*16*4,
  replayReceipts:info.receipts,bytes:info.bytes,bytesPerPet:Math.round(info.bytes/1000)}));
});
test('1000-pet private encrypted migration roundtrip preserves individual histories',async()=>{
 const Aes=require('../js/encrypted-archive.js'),S=globalThis.TrialumStorage;
 const w=E.newGame('demo',date(2026,11,22));
 for(let i=0;i<1000;i++){
  const p={id:'archive-pet-'+i,name:'Archive pet '+i,species:i%18,birthDay:1};
  C.record(p,'birth',{day:1,at:date(2009,1,1)});
  C.record(p,'feed',{day:4,at:date(2013,1,1),food:'biomass',quantity:3});
  for(const year of [2010,2012,2014,2016,2018,2020,2022,2024])
   X.remember(p,{day:year+'-07-01',place:i%3?'shared':'local',
    topics:i%2?['stars']:['music'],moments:4});
  w.pets.push(p);
 }
 C.ensureWorld(w);
 const inspected=I.prepare(w);
 assert.equal(inspected.report.pets,1000);
 const payload={archiveType:'trialum-private-migration',version:1,
  world:inspected.world,friendConversations:[]};
 const key='ABCD'.repeat(16),encrypted=await Aes.encrypt(payload,key);
 assert.equal(JSON.parse(encrypted).version,2);
 const decoded=await Aes.decrypt(encrypted,key);
 assert.equal(I.prepare(decoded.world).report.pets,1000);
 for(const i of [0,100,501,999]){
  const pet=decoded.world.pets[i];
  assert.equal(C.ensure(pet).self.counts.feed,1);
  assert(X.recall(pet,'2014',date(2026,11,22)).found);
 }
 const plain=S.portableSnapshot(decoded.world);
 assert(plain.pets.every(p=>p.cognitiveMemory===undefined));
 console.log('V44 encrypted roster profile',JSON.stringify({pets:1000,
  plainBytes:Buffer.byteLength(JSON.stringify(payload)),
  encryptedBytes:Buffer.byteLength(encrypted),codec:JSON.parse(encrypted).codec}));
});
test('30000 local gameplay events archive compactly and remain replay-safe',()=>{
 const p={id:'stress-ledger',species:0},first=date(2012,1,1),n=30000;
 const historical={kind:'feed',source:'game',at:first,day:12,food:'biomass',quantity:3};
 for(let i=0;i<n;i++)C.record(p,'feed',{...historical,at:first+i});
 const before=size(p);
 assert.equal(C.archiveOld(p,date(2040,1,1)),n);
 const after=size(p),m=C.ensure(p);
 assert.equal(m.self.counts.feed,n);
 assert.equal(m.eventLedger.length,0);
 assert.equal(m.receiptRuns.reduce((sum,r)=>sum+r.hashes.length/16,0),n);
 assert(after<before*.56,'packed checksum runs must meaningfully reduce size');
 const restored=JSON.parse(JSON.stringify(p));
 assert.equal(C.ingest(restored,{...historical,eventId:'event:1'}).duplicate,true);
 assert.throws(()=>C.ingest(restored,{...historical,eventId:'event:1',food:'incorrect'}),/collision/);
 assert.equal(C.ensure(restored).self.counts.feed,n);
 console.log('V44 replay profile',JSON.stringify({events:n,rawBytes:before,archivedBytes:after,
  ratio:Number((after/before).toFixed(3))}));
});
test('private memory rejects corrupt dates, native stream data and duplicate identities',()=>{
 const p={id:'strict-pet',name:'Strict',species:0};
 X.remember(p,{day:'2015-01-01',place:'local',topics:['music'],moments:3});
 const w=E.newGame('demo',date(2026,11,22));w.pets.push(p);
 const pristine=JSON.stringify(w),clone=()=>JSON.parse(pristine);
 assert.equal(I.prepare(w).report.pets,1);
 const dateCorruption=clone();
 dateCorruption.pets[0].cognitiveMemory.contextual.days['2026-99-99|local']=
  {moments:1,topics:['food'],companions:[]};
 assert.throws(()=>I.prepare(dateCorruption),/invalid contextual record/);
 const nativeCorruption=clone();
 nativeCorruption.pets[0].cognitiveMemory.contextual.nativeStreams['00'.repeat(18)]=
  {months:{'2026-13':4},years:{},seeded:true};
 assert.throws(()=>I.prepare(nativeCorruption),/invalid native watermark/);
 const duplicate=clone();
 duplicate.pets.push({...duplicate.pets[0]});
 assert.throws(()=>I.prepare(duplicate),/duplicate pet identity/);
 assert.equal(JSON.stringify(w),pristine);
});
test('shared AI never reveals local owner relationships, bond or habitat secrets',()=>{
 const p={id:'scope-pet',name:'Room pet',species:4,bond:100,habitatId:'SECRET_PRIVATE_HABITAT'};
 C.encounter(p,{id:'private-peer',name:'SECRET_PRIVATE_CONTACT'},{at:date(2026,1,1)});
 C.topic(p,'SECRET_OWNER_INTEREST',date(2026,1,1));
 X.remember(p,{day:'2026-01-01',place:'local',topics:['food'],companions:['SECRET_OWNER'],moments:1});
 X.remember(p,{day:'2026-01-01',place:'shared',topics:['stars'],companions:['PublicPet'],moments:1});
 X.consolidate(p,{now:date(2026,11,22),force:true});
 const raw=A.assemble(p,{},'stars',{tier:'mini',scope:'playground-shared',
  now:date(2026,11,22),history:[{role:'user',text:'SECRET_DIRECT_MESSAGE'}]});
 for(const secret of ['SECRET_PRIVATE_CONTACT','SECRET_OWNER_INTEREST','SECRET_OWNER',
  'SECRET_DIRECT_MESSAGE','SECRET_PRIVATE_HABITAT'])assert(!raw.includes(secret),secret);
 assert.equal(JSON.parse(raw).cognitive.peers.length,0);
 assert.equal(JSON.parse(raw).cognitive.self.bond,null);
 assert(JSON.parse(raw).memories.some(x=>x.themes.includes('stars')));
});
