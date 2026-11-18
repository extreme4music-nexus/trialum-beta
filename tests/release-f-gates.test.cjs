/* 1.5.6-F release-blocking privacy/backup/security static + runtime contracts.
 * Fully offline; no credentials, live NAS, Android handset or external services. */
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
test('Android 36: minimal permissions, explicitly opt-in Firebase, no unsafe backup of consent',()=>{
 const manifest=read('android-template/app/src/main/AndroidManifest.xml');
 const gradle=read('android-template/app/build.gradle.kts');
 const backup=read('android-template/app/src/main/res/xml/trialum_backup_rules.xml');
 const extraction=read('android-template/app/src/main/res/xml/trialum_data_extraction_rules.xml');
 assert.match(gradle,/compileSdk\s*=\s*36/);
 assert.match(gradle,/targetSdk\s*=\s*36/);
 assert.match(manifest,/android:usesCleartextTraffic="false"/);
 assert.match(manifest,/name="firebase_messaging_auto_init_enabled"\s+android:value="false"/);
 assert.match(manifest,/name="firebase_analytics_collection_enabled"\s+android:value="false"/);
 for(const unsafe of ['READ_CONTACTS','READ_PHONE_STATE','READ_SMS','RECORD_AUDIO','CAMERA','ACCESS_BACKGROUND_LOCATION','AD_ID','SYSTEM_ALERT_WINDOW']){
  assert(!manifest.includes('android.permission.'+unsafe),'unexpected permission '+unsafe);
 }
 assert.match(manifest,/android:fullBackupContent="@xml\/trialum_backup_rules"/);
 assert.match(manifest,/android:dataExtractionRules="@xml\/trialum_data_extraction_rules"/);
 for(const source of [backup,extraction]){
  assert.match(source,/trialum_social_v1\.xml/,'social preferences cannot be backed up');
  assert.match(source,/trialum_push_v1\.xml/,'FCM consent cannot be backed up');
 }
 assert.match(manifest,/android:name="\.TrialumFirebaseService"\s+android:exported="false"/);
 assert.match(manifest,/android:name="\.TrialumApplication"/);
 assert.match(gradle,/firebase-messaging/);
 for(const banned of ['firebase-analytics','play-services-ads','firebase-crashlytics','facebook-android-sdk']){
  assert(!gradle.includes('implementation("'+banned),'third party tracker dependency '+banned);
 }
});
test('server does not expose Docker database or public ingress by default',()=>{
 const yaml=read('server/compose.yaml'),env=read('server/.env.example');
 assert.match(yaml,/127\.0\.0\.1:\$\{TRIALUM_HOST_PORT:-8787\}:8787/);
 assert.match(yaml,/trialum_backend:\s*\n\s*internal:\s*true/);
 const dbBlock=yaml.split('  trialum-db:')[1].split('  trialum-api:')[0];
 assert(!/^\s+ports:/m.test(dbBlock),'PostgreSQL must not publish host ports');
 for(const feature of ['SOCIAL','SHARED','MESSAGES','PUSH','FREE_TEXT'])
  assert.match(env,new RegExp('TRIALUM_'+feature+'_ENABLED=false'),'feature unexpectedly live: '+feature);
 assert.match(read('server/compose.push.yaml'),/\/run\/secrets\/trialum-fcm-service-account.json:ro/);
 assert(!yaml.includes('GOOGLE_APPLICATION_CREDENTIALS'),'normal Compose must not mount Firebase secret');
});
test('no FCM token or private message text in generic push payload, and no auto SDK init without consent',()=>{
 const sender=read('server/src/push.mjs');
 const service=read('android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumFirebaseService.kt');
 const app=read('android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumApplication.kt');
 const client=read('android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumPush.kt');
 assert.match(sender,/data:\{kind:'trialum_event',reference:referenceId\}/);
  assert.match(sender,/notification:/,'Android background must receive a visible generic notification envelope');
  assert.match(sender,/channel_id:'trialum_friends_optin'/,'FCM uses the explicit opt-in friends channel');
  assert.match(sender,/Имаш ново известување во играта/,'No private message content in FCM');
 assert(!sender.includes('messageBody'));
 assert(!sender.includes('senderName'));
 assert.match(service,/val kind=message\.data\["kind"\]/,
  'FCM still checks the signed event kind before handling data messages');
 assert.match(service,/kind=="trialum_event"/);
 assert.match(service,/message\.notification!=null/,
  'foreground FCM notification without a data reference must still display a generic notice');
 assert.match(service,/TrialumPush\.notifyGeneric/);
 assert.match(app,/if\(TrialumPush\.opted\(this\)\s*&&/);
 assert.match(client,/if\s*\(!configured\(activity\)\)/);
  assert.match(client,/refreshOptedRegistration/,'explicitly opted token is repaired after server reset');
  assert.match(client,/notificationChannelEnabled/,'friends channel disablement must be respected');
  assert.match(client,/android\.R\.drawable\.ic_dialog_info/,'notification needs a valid small status bar icon');
 assert.match(client,/generation\+\+/,'late opt-out race must be protected');
 assert.match(client,/instanceFollowRedirects=false/,'credentialed requests must not redirect');
 assert.match(client,/GET|POST|DELETE/);
});
test('private message cards have authenticated and irreversible expiry/mute/block routes',()=>{
 const api=read('server/src/messaging.mjs'),sql=read('server/sql/005_messages_push.sh');
 const crypto=read('server/src/data-crypto.mjs'),social=read('server/src/social.mjs');
 assert.match(api,/await authenticate\(req,pool\)/);
 assert.match(api,/if\(!freeText\)err\(403,'free_text_disabled'\)/);
 assert.match(api,/if\(!await permitted\(c,me\.id,data\.receiverId\)\)/);
 assert.match(api,/pg_advisory_xact_lock/);
 assert.match(api,/message_reports/);
 assert.match(api,/friend_mutes/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS message_cards/);
 assert.match(sql,/CHECK\(expires_at>sent_at\)/);
 assert.match(sql,/request_key uuid NOT NULL UNIQUE/);
 assert.match(crypto,/aes-256-gcm/);
 assert.match(crypto,/hkdfSync/);
 assert.match(social,/DELETE FROM message_cards WHERE/,'friendship revocation must purge messages');
 assert(!sql.includes('TO trialum_health'),'health-only role must never access private cards');
});
test('existing 1.1 world survives lazy local playground migration and backup/restore without lost progress',()=>{
 const context={Date,Math,console,Uint8Array,setTimeout,clearTimeout,performance:{now:()=>1000}};
 context.globalThis=context;vm.createContext(context);
 for(const file of ['js/engine.js','js/storage.js','js/playground.js'])
  vm.runInContext(read(file),context,{filename:file});
 const {TrialumEngine:E,TrialumStorage:S,TrialumPlayground:PG}=context;
 const s=E.newGame('real',Date.now());
 s.stage=7;s.lastDay=1432;s.cells=90009;s.insight=2000;s.compounds=1000;
 s.habitats.push({id:'hab-1',name:'Original 1.5.5 habitat',biome:'lagoon',flora:[]});
 s.pets.push({id:'pet-1',name:'Original Lumira',species:0,habitatId:'hab-1',skills:{wave:2},xp:987654,energy:90});
 s.selectedPet='pet-1';s.logs.push({kind:'milestone',text:'Never erase 2026 progress'});
 s.longplay={credits:4242,ledger:[{reason:'earned',value:4242}]};
 const original=JSON.stringify(s),parsed=S.parseImport(original);
 assert.equal(JSON.stringify(parsed),original,'Import changed 1.1 world payload');
 assert.equal(E.validate(parsed),true);
 PG.ensure(parsed);
 assert.deepEqual(JSON.parse(JSON.stringify(parsed.playground.unlocked)),['sandbox','seesaw']);
 delete parsed.playground;
 assert.equal(JSON.stringify(parsed),original,'Lazy playground migration changed original pets, stages, logs or coins');
 const previous=JSON.parse(original);
 assert.equal(previous.longplay.credits,4242);
 assert.equal(previous.pets[0].skills.wave,2);
 assert.equal(previous.logs.at(-1).text,'Never erase 2026 progress');
});
test('legacy 1.0 world can still migrate with pets and history; invalid backup is rejected',()=>{
 const context={Date,Math,console,Uint8Array};context.globalThis=context;
 vm.createContext(context);
 for(const file of ['js/engine.js','js/storage.js'])
  vm.runInContext(read(file),context,{filename:file});
 const E=context.TrialumEngine,S=context.TrialumStorage;
 const old={version:1,mode:'demo',createdAt:Date.now()-86400000,
  stage:6,atoms:{C:42,H:20},pets:[{name:'Стар миленик',shape:0,hunger:70}],logs:[{day:2,text:'Стар дневник'}]};
 const converted=S.parseImport(JSON.stringify(old));
 assert(E.validate(converted));
 assert.equal(converted.pets[0].name,'Стар миленик');
 assert(converted.logs.some(l=>l.text==='Стар дневник'));
 assert.throws(()=>S.parseImport('{"nonsense":true}'));
 assert.throws(()=>S.parseImport('{bad-json'));
});
test('offline shell has exact mobile messaging code and never stores identity in world JSON',()=>{
 const html=read('index.html'),js=read('js/messages.js'),storage=read('js/storage.js');
 assert.match(html,/<script src="js\/messages\.js"><\/script>/);
 assert.match(html,/<script src="js\/social\.js"><\/script>/);
 assert.match(js,/if\(!state\.active\|\|!config\(\)\|\|loading\)return/);
 assert(!storage.includes('socialStoreCredential'),'world save must not store social tokens');
 assert(!storage.includes('firebaseToken'),'world save must not store FCM device tokens');
 assert.match(read('android-template/app/src/main/java/com/trialum/ziivaiskra/SocialCredentialVault.kt'),/noBackupFilesDir/);
 const sw=read('sw.js');
 assert(sw.includes("'js/messages.js'"),'offline shell should bundle message tab without an online dependency');
});

test('old in-flight saves cannot overwrite a restored world or resurrect a deleted one',async()=>{
 const values=new Map();
 const storage={
  getItem:key=>values.get(key)||null,
  setItem:(key,value)=>{values.set(key,String(value));},
  removeItem:key=>{values.delete(key);}
 };
 const context={Date,Math,console,Uint8Array,localStorage:storage};
 context.globalThis=context;vm.createContext(context);
 for(const file of ['js/engine.js','js/storage.js'])
  vm.runInContext(read(file),context,{filename:file});
 const E=context.TrialumEngine,S=context.TrialumStorage;
 const stale=E.newGame('real',Date.now()),restored=E.newGame('real',Date.now());
 stale.profileName='BEFORE_RESTORE';stale.lastDay=16;
 restored.profileName='AFTER_RESTORE';restored.lastDay=288;
 const oldSave=S.save(stale);
 stale.profileName='MUTATED_AFTER_SAVE_CALL';
 const restoreSave=S.save(restored);
 const [r1,r2]=await Promise.all([oldSave,restoreSave]);
 assert(r1.ok&&r2.ok);
 const persisted=JSON.parse(storage.getItem('trialum_state_v1_1'));
 assert.equal(persisted.profileName,'AFTER_RESTORE','older write clobbered restored world');
 assert.equal(persisted.lastDay,288);
 const extra=S.save(stale),cleared=S.clear();
 await Promise.all([extra,cleared]);
 assert.equal(storage.getItem('trialum_state_v1_1'),null,'pending write resurrected deleted world');
 const latest=E.newGame('real',Date.now());
 latest.profileName='NEW_WORLD';
 assert((await S.save(latest)).ok);
 assert.equal(JSON.parse(storage.getItem('trialum_state_v1_1')).profileName,'NEW_WORLD');
});

test('world export creates only fresh verified documents and restores from pinned rescue',()=>{
 const java=read('android-template/app/src/main/java/com/trialum/ziivaiskra/MainActivity.kt');
 const vault=read('android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumBackupVault.kt');
 const app=read('js/app.js'),ui=read('js/longplay-ui.js');
 assert.match(vault,/MediaStore\.Downloads\.EXTERNAL_CONTENT_URI/);
 assert.match(vault,/resolver\.insert\(/);
 assert.match(vault,/MediaStore\.MediaColumns\.IS_PENDING/);
 assert.match(vault,/writeAndVerify\(uri, bytes\)/);
 assert.match(vault,/MessageDigest\.isEqual/);
 assert.match(vault,/FileOutputStream\(pending, false\)/);
 assert.match(vault,/output\.fd\.sync\(\)/);
 assert.match(vault,/pending\.renameTo\(target\)/);
 assert.match(vault,/UUID\.randomUUID/);
 assert.match(vault,/rescue_keep_/);
 const worldSave=java.split('@JavascriptInterface fun saveBackup(')[1]
  .split('@JavascriptInterface fun saveSafetySnapshot(')[0];
 assert.doesNotMatch(worldSave,/Intent\(Intent\.ACTION_CREATE_DOCUMENT\)/,
  'world JSON export must not reuse file picker for existing destination');
 // Photo/image export may still legitimately use ACTION_CREATE_DOCUMENT.
 assert.doesNotMatch(java,/pendingBackup:\s*ByteArray/);
 assert.match(java,/saveSafetySnapshot\(json: String, pinned: Boolean\)/);
 assert.match(java,/restoreRescueBackup/);
 assert.match(app,/rescueSnapshot\(true\)/);
 assert.match(app,/TrialumNativeBackupVaultList/);
 assert.match(ui,/backupVaultList/);
});
