/* Native bridge contract checks: offline fallback, consent and cloud safety.
   Real OAuth / Saved Games require configured Play Console test users. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../js/play-games.js'),'utf8');
const delay=()=>new Promise(resolve=>setTimeout(resolve,0));
const world=()=>({version:'1.5.4',createdAt:1234,seed:987,lastDay:40,
 pets:[{species:0,evolution:{earned:180}}],habitats:[{}],achievements:[{id:'first-pet'}],logs:[],settings:{debugEnabled:false}});
let passed=0;
function test(name,cb){return Promise.resolve().then(cb).then(()=>{console.log('✓ '+name);passed++;});}
function create(configured=true,authenticated=true,consent=false){
 const calls=[],nativeState={configured,authenticated,cloudConsent:consent,playerName:'Tester',busy:false};
 const native={
  pgsStatus:()=>JSON.stringify(nativeState),
  pgsRefresh:()=>calls.push(['refresh']),
  pgsSignIn:()=>calls.push(['signin']),
  pgsCloudCheck:()=>calls.push(['check']),
  pgsSetCloudConsent:value=>{nativeState.cloudConsent=value;calls.push(['consent',value]);},
  pgsCloudSave:(json,overwrite)=>calls.push(['cloudSave',JSON.parse(json),overwrite]),
  pgsCloudRestore:()=>calls.push(['cloudRestore']),
  pgsConfirmRestored:sha=>calls.push(['ack',sha]),
  pgsAchievement:id=>calls.push(['achievement',id]),
  pgsScore:(key,score)=>calls.push(['score',key,score]),
  pgsShowAchievements:()=>calls.push(['showAchievements']),
  pgsShowLeaderboards:()=>calls.push(['showLeaderboards'])
 };
 const context={TrialumAndroid:native,TrialumI18n:{language:()=> 'mk'},confirm:()=>true,console};
 context.globalThis=context;
 vm.createContext(context);vm.runInContext(source,context);
 return{api:context.TrialumPlayGames,calls,context,nativeState};
}
(async()=>{
 await test('Unconfigured Play Console never sends PGS requests',()=>{
  const x=create(false,false,false);
  x.api.init({getWorld:world});
  x.api.afterLocalSave(world());
  assert.equal(x.calls.filter(a=>a[0]==='cloudSave').length,0);
  assert(x.api.render().includes('Play Console'));
 });
 await test('Connected but not opted-in keeps local saves only',()=>{
  const x=create(true,true,false);
  x.api.init({getWorld:world});
  x.api.afterLocalSave(world());
  assert.equal(x.calls.filter(a=>a[0]==='cloudSave').length,0);
 });
 await test('Explicit opt-in enables guarded autosave',()=>{
  const x=create(true,true,false);
  x.api.init({getWorld:world});
  x.api.action('pgsCloudEnable');
  x.api.onNative({kind:'consent',cloudConsent:true});
  x.api.afterLocalSave(world());
  const save=x.calls.find(a=>a[0]==='cloudSave');
  assert(save);
  assert.equal(save[2],false,'Automated saves must never force overwrite');
 });
 await test('Divergent cloud blocks autosave until user resolves',()=>{
  const x=create(true,true,true);
  x.api.init({getWorld:world});
  x.api.onNative({kind:'cloudDiverged',exists:true,day:70,pets:2,worldId:'other'});
  x.api.afterLocalSave(world());
  assert.equal(x.calls.filter(a=>a[0]==='cloudSave').length,0);
  assert.equal(x.api.status().blocked,true);
 });
 await test('Replacing cloud needs two explicit confirmations',()=>{
  const x=create(true,true,true);
  x.api.init({getWorld:world});
  x.api.onNative({kind:'cloudDiverged',exists:true,day:70});
  let count=0;x.context.confirm=()=>{count++;return count<2;};
  x.api.action('pgsCloudReplace');
  assert.equal(x.calls.filter(a=>a[0]==='cloudSave').length,0);
  x.context.confirm=()=>true;
  x.api.action('pgsCloudReplace');
  assert.equal(x.calls.filter(a=>a[0]==='cloudSave'&&a[2]===true).length,1);
 });
 await test('Restore is candidate only; native baseline ack requires acceptance',async()=>{
  const x=create(true,true,true);let asked=0;
  x.api.init({getWorld:world,restore:async saved=>{asked++;assert.equal(saved.seed,987);return true;}});
  x.api.onNative({kind:'cloudCandidate',world:world(),sha:'f'.repeat(64)});
  await delay();await delay();
  assert.equal(asked,1);assert.equal(x.calls.filter(a=>a[0]==='ack').length,1);
 });
 await test('Canceled restore cannot acknowledge or replace cloud',async()=>{
  const x=create(true,true,true);
  x.api.init({getWorld:world,restore:async()=>false});
  x.api.onNative({kind:'cloudCandidate',world:world(),sha:'a'.repeat(64)});
  await delay();await delay();
  assert.equal(x.calls.filter(a=>a[0]==='ack').length,0);
 });
 await test('Debug worlds do not submit ranked scores or achievements',()=>{
  const x=create(true,true,true);
  x.api.init({getWorld:world});x.api.onNative({kind:'signedIn',playerName:'Tester',cloudConsent:true});
  const w=world();w.settings.debugEverUsed=true;
  x.api.afterLocalSave(w);
  assert.equal(x.calls.filter(a=>a[0]==='score'||a[0]==='achievement').length,0);
 });
 await test('Normal world maps internal achievements to official keys',()=>{
  const x=create(true,true,false);
  x.api.init({getWorld:world});
  x.api.onNative({kind:'signedIn',playerName:'Tester',cloudConsent:false});
  x.api.afterLocalSave(world());
  assert(x.calls.some(a=>a[0]==='achievement'&&a[1]==='first_pet'));
  assert(x.calls.some(a=>a[0]==='score'&&a[1]==='xp'));
 });
 await test('Switching Google profiles clears cached achievements, scores and cloud blocking',()=>{
  const x=create(true,true,true);
  x.api.init({getWorld:world});
  x.api.onNative({kind:'signedIn',playerId:'profile-A',playerName:'A',cloudConsent:true});
  x.api.afterLocalSave(world());
  x.api.onNative({kind:'cloudDiverged',exists:true,day:75});
  assert.equal(x.api.status().blocked,true);
  x.api.onNative({kind:'signedIn',playerId:'profile-B',playerName:'B',cloudConsent:true});
  assert.equal(x.api.status().blocked,false);
  assert.equal(x.api.status().cloud,null);
  assert.equal(x.api.status().playerId,'profile-B');
  x.api.afterLocalSave(world());
  assert.equal(x.calls.filter(a=>a[0]==='achievement'&&a[1]==='first_pet').length,2);
  assert.equal(x.calls.filter(a=>a[0]==='score'&&a[1]==='xp').length,2);
 });
 await test('Unresolved Google snapshot conflicts remain blocked and cannot be force overwritten',()=>{
  const x=create(true,true,true);
  x.api.init({getWorld:world});
  x.api.onNative({kind:'cloudConflict'});
  x.api.onNative({kind:'cloudStatus',exists:false});
  assert.equal(x.api.status().conflict,true);
  assert.equal(x.api.status().blocked,true);
  x.api.action('pgsCloudReplace');
  assert.equal(x.calls.filter(a=>a[0]==='cloudSave').length,0);
  assert(!x.api.render().includes('data-do="pgsCloudReplace"'));
 });
 await test('Google read errors do not pretend the remote save was empty',()=>{
  const x=create(true,true,true);
  x.api.init({getWorld:world});
  x.api.onNative({kind:'cloudDiverged',exists:true,day:72});
  x.api.onNative({kind:'error',message:'network disconnected'});
  assert.equal(x.api.status().blocked,true);
  assert.equal(x.api.status().cloud.day,72);
 });
 console.log('TRIALUM Play Games:',passed,'passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
