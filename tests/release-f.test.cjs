/* 1.5.6-F release-candidate invariants; never substitute for physical QA. */
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const E=require('../js/engine.js');
globalThis.TrialumEngine=E;
require('../js/storage.js');
const S=globalThis.TrialumStorage;
test('current and legacy worlds import without losing pets or history',()=>{
 const s=E.newGame('demo',1730000000000);
 s.logs.push({id:'evt-important',kind:'milestone',text:'Историски запис',day:11,at:new Date().toISOString()});
 s.pets.push({id:'pet-important',name:'Лумира',growth:87,hue:181,actionsLeft:4,
  skills:{wave:2,leap:1,symbols:1},xp:1102,energy:70});
 s.habitats.push({id:'hab-important',name:'Морска градина',capacity:8,flora:[]});
 s.selectedPet='pet-important';s.activeHabitat='hab-important';
 s.longplay={credits:101,ledger:[{day:8,value:7,reason:'Игра'}]};
 s.playground={version:1,unlocked:['sandbox','seesaw','slide'],space:2,practice:{}};
 assert(E.validate(s));
 const restored=S.parseImport(JSON.stringify(s));
 assert.deepEqual(restored,s,'import must preserve local game state exactly');
 assert.equal(restored.pets[0].xp,1102);
 assert.equal(restored.playground.unlocked.length,3);
 assert(restored.logs.some(x=>x.text==='Историски запис'));
 const old={version:1,mode:'demo',createdAt:1730000000000,
  atoms:{C:200,H:200,O:200,N:200,P:100,S:50},pets:[{name:'Стара Искра',shape:0,eyes:2}],
  stage:6,logs:[{day:3,text:'Оригинална историја',type:'milestone',at:1730000000000}]};
 const migrated=S.parseImport(JSON.stringify(old));
 assert(E.validate(migrated));assert.equal(migrated.pets[0].name,'Стара Искра');
 assert(migrated.logs.some(x=>x.text==='Оригинална историја'));
});
test('malformed or oversized backup is rejected, never silently treated as empty',()=>{
 assert.throws(()=>S.parseImport('{not json'));
 assert.throws(()=>S.parseImport(JSON.stringify({version:'unknown'})));
 const big=E.newGame('demo');big.logs=Array.from({length:500001},(_,i)=>({id:'e'+i,text:'x'}));
 assert.throws(()=>S.parseImport(JSON.stringify(big)),e=>e.code==='BACKUP_TOO_LARGE');
});
test('backend database must remain internal and all social feature switches default off',()=>{
 const c=read('server/compose.yaml');
 assert.match(c,/127\.0\.0\.1:\$\{TRIALUM_HOST_PORT:-8787\}:8787/);
 assert.match(c,/trialum_backend:\s*\n\s*internal:\s*true/);
 assert.doesNotMatch(c,/["']?5432:5432/);
 for(const gate of ['SOCIAL','SHARED','MESSAGES','PUSH','FREE_TEXT']){
  if(gate==='FREE_TEXT')assert.match(c,/TRIALUM_FREE_TEXT_ENABLED:-false/);
  else assert.match(c,new RegExp('TRIALUM_'+gate+'_ENABLED:-false'));
 }
 assert.doesNotMatch(c,/0\.0\.0\.0:\$\{TRIALUM_HOST_PORT/);
});
test('Android keeps cleartext HTTP off and social credentials out of OS restore',()=>{
 const m=read('android-template/app/src/main/AndroidManifest.xml');
 assert.match(m,/android:usesCleartextTraffic="false"/);
 assert.match(m,/android:allowBackup="true"/);
 assert.match(m,/android:fullBackupContent="@xml\/trialum_backup_rules"/);
 assert.match(m,/android:dataExtractionRules="@xml\/trialum_data_extraction_rules"/);
 assert.match(m,/firebase_messaging_auto_init_enabled" android:value="false"/);
 assert.match(m,/firebase_analytics_collection_enabled" android:value="false"/);
 const policies=[
  'android-template/app/src/main/res/xml/trialum_backup_rules.xml',
  'android-template/app/src/main/res/xml/trialum_data_extraction_rules.xml'
 ].map(read);
 for(const x of policies){
  assert.match(x,/trialum_social_v1\.xml/);
  assert.match(x,/trialum_push_v1\.xml/);
 }
 assert.match(read('android-template/app/src/main/java/com/trialum/ziivaiskra/SocialCredentialVault.kt'),/noBackupFilesDir/);
});
test('social server in Android build accepts only HTTPS origin, never unencrypted host port',()=>{
 const k=read('android-template/app/build.gradle.kts');
 assert.match(k,/trialumSocialApiUrl/);
 assert.match(k,/https:\/\//);
 assert.match(k,/Social API must use a configured HTTPS hostname/);
 assert.doesNotMatch(k,/http:\/\/dedopero/);
});
test('staging Caddy handles only the game API and proxies to private loopback',()=>{
 const s=read('deploy/https/Caddyfile');
 assert.match(s,/dedopero\.servegame\.com/);
 assert.match(s,/reverse_proxy 127\.0\.0\.1:8687/);
 assert.match(s,/path \/v1\/\* \/healthz \/invite/);
 assert.doesNotMatch(s,/Webmin\s*\d|reverse_proxy\s+0\.0\.0\.0|reverse_proxy\s+.*:10000/i);
});
test('message cards remain friend-only with bounded sender and opt-in FCM',()=>{
 const m=read('server/src/messaging.mjs'),p=read('server/src/push.mjs');
 assert.match(m,/friendship_required/);
 assert.match(m,/friend_message_limit/);
 assert.match(m,/recipient_inbox_full/);
 assert.match(m,/free_text_disabled/);
 assert.match(m,/message_reports/);
 assert.match(m,/DELETE FROM push_registrations/);
 assert.match(p,/kind:'trialum_event'/);
  assert.match(p,/notification:/,'Android background delivery requires an FCM notification envelope');
  assert.match(p,/Имаш ново известување во играта/,'notification title/body must be generic');
  assert.doesNotMatch(p,/senderName|messageText/,'no private sender/message data in FCM payload');
});
test('1.6-LW is clearly marked development-only and preserves historical 1.5.6-F evidence',()=>{
 const g=read('android-template/app/build.gradle.kts');
 assert.match(g,/versionName = "1\.6-LW-dev\.12"/);
 assert.match(g,/versionCode = 35/);
 assert.match(read('PROJECT_ROADMAP.md'),/1\.5\.6-F/);
});
