'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));

test('beta Android builds cannot silently drop HTTPS Friends or FCM client configuration',()=>{
 const workflow=read('.github/workflows/lw-c-beta.yml');
 const gradle=read('android-template/app/build.gradle.kts');
 const vars=[
  'TRIALUM_SOCIAL_API_URL','TRIALUM_FIREBASE_API_KEY','TRIALUM_FIREBASE_APP_ID',
  'TRIALUM_FIREBASE_APP_ID_SIGNQA','TRIALUM_FIREBASE_APP_ID_SIGNDEBUG',
  'TRIALUM_FIREBASE_PROJECT_ID','TRIALUM_FIREBASE_SENDER_ID'
 ];
 for(const name of vars){
  assert(workflow.includes(`vars.${name}`),'Actions variable was unhooked: '+name);
  assert(workflow.includes('${'+name+':?'),'Build must fail closed when '+name+' is missing');
 }
 for(const property of [
  'trialumSocialApiUrl','trialumFirebaseApiKey','trialumFirebaseAppId',
  'trialumFirebaseAppIdSignqa','trialumFirebaseAppIdSigndebug',
  'trialumFirebaseProjectId','trialumFirebaseSenderId'
 ]) assert(workflow.includes(`-P${property}=`),'Gradle property is not passed: '+property);
 assert(workflow.includes('dump --values resources'),'Built APK resources must be checked');
 for(const resource of ['trialum_social_api_url','trialum_firebase_app_id','trialum_firebase_project_id','trialum_firebase_sender_id'])
  assert(workflow.includes('require_resource_value '+resource),'APK verification must identify missing configured resource: '+resource);
 assert(gradle.includes('trialumFirebaseAppIdSigndebug')&&gradle.includes('trialumFirebaseAppIdSignqa'));
 const gp01Variant=gradle.slice(gradle.indexOf('create("gp01test")'));
 assert(gp01Variant.includes('resValue("string", "game_services_project_id", "0")'),
  'The one-time random-signed GP-01 package must not claim the official Play Games identity');
 assert(gp01Variant.includes('resValue("string", "trialum_firebase_app_id", "")'),
  'The unregistered test package must not claim the production Firebase identity');
 assert(!/TRIALUM_FCM_SERVICE_ACCOUNT|GOOGLE_APPLICATION_CREDENTIALS|TRIALUM_(?:RELEASE|QA)_KEYSTORE|TRIALUM_(?:RELEASE|QA)_KEYSTORE_B64|TRIALUM_(?:RELEASE|QA)_STORE_PASSWORD|TRIALUM_(?:RELEASE|QA)_KEY_PASSWORD/i.test(workflow),
  'The public build workflow must not receive server credentials or official signing material');
 const isolatedSigning=workflow.slice(workflow.indexOf('Sign isolated GP-01 test APK with a one-time runner key'));
 assert(isolatedSigning.includes('mktemp -d')&&isolatedSigning.includes('openssl rand -hex'));
 assert(isolatedSigning.includes('com.trialum.ziivaiskra.gp01test'));
 assert(isolatedSigning.includes('rm -f "$signer_file"')&&isolatedSigning.includes('rmdir "$signer_dir"'),
  'The disposable signing key must be runner-only and deleted after signing');
});

test('Friends and messaging stay opt-in, isolated and present in the beta export',()=>{
 for(const p of [
  'js/social.js','js/messages.js','js/shared-playground.js','js/presence.js',
  'android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumPush.kt',
  'android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumFirebaseService.kt'
 ]) assert(exists(p),'Required beta feature source disappeared: '+p);
 const social=read('js/social.js');
 assert(social.includes("if(!credential){emit();return;}")&&social.includes('credentials:\'omit\''),
  'Social service startup must remain opt-in and must not use browser credentials');
 const manifest=read('android-template/app/src/main/AndroidManifest.xml');
 assert(manifest.includes('firebase_messaging_auto_init_enabled')&&manifest.includes('android:value="false"'),
  'FCM must remain disabled until explicit player consent');
 const push=read('android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumPush.kt');
 assert(push.includes('explicit_consent'),'FCM registration must be consent-gated');
});

test('in-game About, developer details, FAQ and tutorial are kept in English',()=>{
 const ui=read('js/longplay-ui.js');
 const locale=JSON.parse(read('locales/en.json')).strings;
 for(const phrase of [
  'Често поставувани прашања','Можам ли да играм офлајн?',
  'Дали ми треба Google сметка?','Како функционираат Пријателите?',
  'Што се push известувања?','Како да го заштитам зачуваниот напредок?',
  'Дали биологијата е вистинска?','Можам ли да купам кредити во Бета 1.0?',
  'За развивачот','Развивач: Trialum. Повратни информации и поддршка: toniadrenalin@gmail.com.'
 ]) assert(typeof locale[phrase]==='string'&&locale[phrase].trim(),
  'Missing exact English translation for in-game Help copy: '+phrase);
 for(const phrase of ['Frequently asked questions','About the developer','Replay tutorial','Developer: Trialum'])
  assert(ui.includes(phrase),'Missing English About & Help copy: '+phrase);
 assert(read('tests/ui.test.cjs').includes("click('about')"),
  'The Android WebView locale audit must render the About & Help page');
});

test('age access is internal-beta-only, privacy-minimal and fails closed',()=>{
 const gradle=read('android-template/app/build.gradle.kts');
 const native=read('android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumAgeSignals.kt');
 const activity=read('android-template/app/src/main/java/com/trialum/ziivaiskra/MainActivity.kt');
 const social=read('js/social.js'),messages=read('js/messages.js'),shared=read('js/shared-playground.js'),app=read('js/app.js');
 assert.match(gradle,/versionCode\s*=\s*41/);
 assert(gradle.includes('com.google.android.play:age-signals:0.0.4'));
 assert(gradle.includes('create("internalBeta")')&&gradle.includes('BETA_TESTER_TOOLS", "true"'));
 assert(native.includes('AgeSignalsStatus.SHARED')&&native.includes('ageLower >= 18')&&native.includes('ageUpper == null'));
 assert(native.includes('AgeRangeSource.TIER_A')&&native.includes('AgeRangeSource.TIER_C')&&native.includes('AgeRangeSource.TIER_D'));
 const eligibilityStart=native.indexOf('val eligibleSource');
 const eligibilityEnd=native.indexOf('// This is restricted',eligibilityStart);
 assert(eligibilityStart>=0&&eligibilityEnd>eligibilityStart);
 assert(!native.slice(eligibilityStart,eligibilityEnd).includes('AgeRangeSource.TIER_B'),
  'Supervised TIER_B signals must not unlock Friends');
 assert(native.includes('AgeRangeSource.TIER_B -> "TIER_B"'),
  'The local diagnostic may identify a supervised source tier without exposing age data');
 assert(native.includes('VERIFICATION_REQUIRED'));
 assert(native.includes('put("status", status).put("adultEligible", eligible)'));
 assert(!/ageLower|ageUpper|ageRangeSource|installId/.test(native.slice(native.indexOf('private fun finish'))),
  'Raw Play age data must not cross the native bridge');
 assert(activity.includes('ageSignalsAdultEligible()')&&activity.includes('BuildConfig.BETA_TESTER_TOOLS'));
 assert.match(activity,/fun requestAgeSignals\(\)\s*\{\s*if \(!BuildConfig\.BETA_TESTER_TOOLS\) return/);
 assert(social.includes('if(!state.ageAllowed||!betaBuild())throw Error'));
  assert(messages.includes('root.TrialumSocial?.isSocialProfileActive?.()===true'));
  assert(shared.includes('root.TrialumSocial?.isSocialProfileActive?.()!==true'));
  assert(app.includes("['messages','shared'].includes(which)&&!Social?.isSocialAllowed?.()"));
  assert(app.includes("['messages','shared'].includes(which)&&!Social?.isSocialProfileActive?.()"));
 assert(app.includes("if(!Social?.isSocialAllowed?.())return Social?.render()"),
  'Friends renderer must require explicit social consent and an eligible age signal');
});
