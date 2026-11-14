const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/messages.js'),'utf8');
function client(credential='',calls=[]){
 const token=credential,friend='123e4567-e89b-42d3-a456-426614174000',me='223e4567-e89b-42d3-a456-426614174000';
 const w={
  crypto:crypto.webcrypto,AbortController,
  setInterval(){return 1},clearInterval(){},setTimeout(fn){return 1},clearTimeout(){},
  TrialumAndroid:{
   socialApiUrl:()=> 'https://friends.example',
   socialCredential:()=>token,
   pushStatus:()=> 'unavailable',
   pushEnable(){throw Error('FCM must not auto-initialize')},
   pushDisable(){throw Error('FCM must not auto-initialize')}
  },
  TrialumSocial:{getState:()=>({identity:token?{id:me}:null,friends:[{id:friend,nickname:'Ана'}]})},
  document:{hidden:false},
  fetch:async(url,options)=>{
   calls.push({url,options});
   const status=url.endsWith('/status'),send=url.endsWith('/send');
   return {ok:true,status:200,json:async()=>send?{id:friend,duplicate:false}:status?
    {ready:true,freeTextEnabled:false,pushAvailable:false,presets:{hello:'👋 Здраво!'}}:
    {messages:[],events:[],mutes:[],pushRegistered:false}};
  }
 };
 w.globalThis=w;vm.createContext(w);vm.runInContext(source,w,{filename:'messages.js'});
 return {w,api:w.TrialumMessages,calls,friend};
}
test('no account means no network on activation and no FCM registration',()=>{
 const c=client();c.api.activate();assert.equal(c.calls.length,0);
 assert.match(c.api.render(),/Прво отвори Пријатели/);
 c.api.deactivate();
});
test('configured opt-in requests only authenticated inbox, never token in URL',async()=>{
 const c=client('X'.repeat(43));c.api.activate();
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(c.calls.length,2);
 assert(c.calls.every(v=>v.options.headers.Authorization==='Bearer '+'X'.repeat(43)));
 assert(c.calls.every(v=>!v.url.includes('X'.repeat(43))));
 assert.match(c.api.render(),/Готовите фрази/);
 assert.match(c.api.render(),/FCM не е конфигуриран/);
 c.api.deactivate();
});
test('reflected server nicknames and preset text are escaped in UI',async()=>{
 const c=client('Y'.repeat(43));
 c.w.TrialumSocial.getState=()=>({identity:{id:'me'},friends:[{id:c.friend,nickname:'<img src=x onerror=alert(1)>'}]});
 c.api.activate();
 await new Promise(resolve=>setTimeout(resolve,20));
 const html=c.api.render();
 assert(!html.includes('<img src=x'),'nickname must never inject HTML');
 assert(html.includes('&lt;img'));
 c.api.deactivate();
});
test('preset send includes only whitelisted phrase key, idempotency UUID, and no push registration',async()=>{
 const c=client('Z'.repeat(43));c.api.activate();await new Promise(resolve=>setTimeout(resolve,20));
 const result=await c.api.send(c.friend,'hello');
 assert.equal(result.duplicate,false);
 const send=c.calls.find(v=>v.url.endsWith('/send'));
 assert(send,'expected send route');
 const body=JSON.parse(send.options.body);
 assert.equal(body.kind,'preset');assert.equal(body.presetId,'hello');
 assert.match(body.eventKey,/^[0-9a-f-]{36}$/);
 assert(!JSON.stringify(c.calls).includes('/push'),'no FCM without consent');
 c.api.deactivate();
});

test('signed Android QA variants and FCM delivery remain explicitly consent-based',()=>{
 const read=p=>fs.readFileSync(require('node:path').join(__dirname,'..',p),'utf8');
 const gradle=read('android-template/app/build.gradle.kts');
 const workflow=read('.github/workflows/android-signing.yml');
 const push=read('server/src/push.mjs');
 const android=read('android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumPush.kt');
 assert(gradle.includes('trialumFirebaseAppIdSignqa'));
 assert(gradle.includes('qaAppId != releaseAppId'),
  'SignQA must not silently inherit the Release Firebase App ID');
 assert(gradle.includes('friendsDebugAppId != signqaAppId') && gradle.includes('friendsDebugAppId != releaseAppId'),
  'Friends Debug must have a unique Firebase Android App ID');
 assert(gradle.includes('trialumFirebaseAppIdSigndebug'));
 assert(workflow.includes('TRIALUM_FIREBASE_APP_ID_SIGNQA'));
 assert(workflow.includes('TRIALUM_FIREBASE_APP_ID_SIGNDEBUG'));
 assert(workflow.includes('package-specific Firebase Android App ID'));
 assert(workflow.includes('Register Release, Signing QA and Friends Debug as three Android apps'),
  'Owner signing must reject absent per-package Firebase registration');
 assert(push.includes("android:{priority:'HIGH',ttl:'3600s',"),
  'transactional opt-in push should request timely Android background delivery');
 assert(push.includes('trialum_fcm_http_')&&push.includes('trialum_fcm_auth_unavailable'),
  'FCM dispatch failure must be observable without exposing tokens');
 assert(android.includes('REQUEST_CODE=1567')&&android.includes('POST_NOTIFICATIONS'));
 assert(android.includes('explicit_consent')&&android.includes('SocialCredentialVault'));
 assert(android.includes('No registration/network until explicit user action')===false
  || android.includes('FCM is optional'));
});


test('FCM app/channel contract: generic message push cannot impersonate local pet-care notifications',()=>{
 const read=p=>fs.readFileSync(require('node:path').join(__dirname,'..',p),'utf8');
 const server=read('server/src/push.mjs');
 const android=read('android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumPush.kt');
 const service=read('android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumFirebaseService.kt');
 const care=read('android-template/app/src/main/java/com/trialum/ziivaiskra/CareWorker.kt');
 const app=read('android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumApplication.kt');
 const workflow=read('.github/workflows/android-signing.yml');
 assert(server.includes("notification:{title:'ТРИАЛУМ',body:'Имаш ново известување во играта.'}"),
  'server notification must use a generic private-safe body');
 assert(server.includes("data:{kind:'trialum_event',reference:referenceId}"),
  'event reference must stay separate from the generic notification text');
 assert(server.includes("channel_id:'trialum_friends_optin'"),
  'Android background FCM must target the friends channel, not the care channel');
 assert(android.includes('private const val CHANNEL="trialum_friends_optin"'));
 assert(android.includes('ensureNotificationChannel(activity)'),
  'consented Android client must create its own channel before registration');
 assert(android.includes('notificationChannelEnabled(activity)'),
  'Android opt-in must honor the OS notification-channel switch');
 assert(care.includes('trialum-care-v14')&&!care.includes('trialum_friends_optin'),
  'locally scheduled pet-care notifications must be independent of FCM friends');
 assert(service.includes('TrialumPush.notifyGeneric(applicationContext,reference)'),
  'foreground FCM must still emit a local generic system notification');
 assert(app.includes('TrialumPush.refreshOptedRegistration(this)'),
  'previously consented tokens should be reconciled after an app update');
 assert(workflow.includes('expected_firebase="$TRIALUM_FIREBASE_APP_ID"'),
  'the build must inspect the actual Release Firebase App ID inside APK resources');
 assert(workflow.includes('expected_firebase="$TRIALUM_FIREBASE_APP_ID_SIGNQA"')&&
        workflow.includes('expected_firebase="$TRIALUM_FIREBASE_APP_ID_SIGNDEBUG"'),
  'the build must inspect the actual Firebase App ID of both independently signed QA apps');
 assert(!server.includes('senderName')&&!server.includes('messageText'),
  'FCM payload must never expose names or private content');
});

test('Android-only notification self-test is explicitly gated and distinguishable from real FCM',()=>{
 const read=p=>fs.readFileSync(require('node:path').join(__dirname,'..',p),'utf8');
 const kotlin=read('android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumPush.kt');
 const service=read('android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumFirebaseService.kt');
 const activity=read('android-template/app/src/main/java/com/trialum/ziivaiskra/MainActivity.kt');
 const manifest=read('android-template/app/src/main/AndroidManifest.xml');
 const app=read('js/app.js'), messages=read('js/messages.js');
 assert.match(kotlin,/fun testLocalNotification\(c: Context\): String/);
 assert.match(kotlin,/if \(!opted\(c\)\) return "off"/,'no probe notification without explicit opt-in');
 assert.match(kotlin,/if \(!notificationChannelEnabled\(c\)\) return "blocked"/,
  'respect the Friends notification channel OS setting');
 assert.match(kotlin,/Пробно известување\. Не е примена нова порака\./,
  'local test must never impersonate a real message');
 assert.match(activity,/@JavascriptInterface fun pushTestLocalNotification\(\): String/);
 assert.match(messages,/data-do="msgPushTest"/);
 assert.match(app,/case 'msgPushTest'/,'a user-visible click triggers the real native self-test');
 assert.match(service,/message\.notification!=null/,'foreground FCM notification-only messages are not ignored');
 assert.match(service,/TrialumPush\.notifyGeneric/);
 assert.match(manifest,/com\.google\.firebase\.messaging\.default_notification_channel_id/);
 assert.match(manifest,/trialum_friends_optin/);
 assert.doesNotMatch(kotlin,/Log\.[ediwv]\(/,'never log FCM tokens/private events');
 assert.doesNotMatch(activity,/pushTestLocalNotification\(.*\).*fetch/,'local test must not use server');
});
