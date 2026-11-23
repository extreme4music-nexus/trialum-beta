/* v46 Social Eligibility Controller: native Age Signals, consent, Integrity, server lease and lifecycle. */
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const vm=require('node:vm'),path=require('node:path');
const source=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function harness({consent=true,adult=true,credential='x'.repeat(43),delayIntegrity=false,verifyStatus=200}={}){
 let nativeAdult=adult,ageRequest=0,integrityEvent=null;const calls=[];
 const ctx={console,URL,AbortController,setTimeout,clearTimeout,Date,
  TrialumAndroid:{
   betaTesterToolsEnabled:()=>true,qaSocialAgeBypass:()=>true,
   ageSignalsAdultEligible:()=>nativeAdult,
   requestAgeSignals:()=>++ageRequest,socialForegroundActive:()=>true,
   socialApiUrl:()=> 'https://friends.example',socialCredential:()=>credential,
   socialStoreCredential:()=>true,nearbyStop:()=>{},
   requestSocialIntegrity:(requestId,requestHash)=>{
    assert.equal(requestHash,'request-hash-from-server');
    integrityEvent=()=>ctx.TrialumSocial.setIntegrityResult({requestId,status:'ok',token:'opaque-integrity-token'});
    if(!delayIntegrity)queueMicrotask(integrityEvent);
    return true;
   }
  },
  TrialumLegal:{socialAccepted:()=>consent,grantSocialConsent:()=>{consent=true;return true;},revokeSocialConsent:()=>{consent=false;return true;}},
  TrialumMessages:{deactivate:()=>{}},TrialumShared:{deactivate:()=>{}},TrialumPeer:{clear:()=>{}},confirm:()=>true,
  fetch:async(url,opts)=>{
   calls.push({url,opts});let result={ok:true};
   if(url.endsWith('/eligibility/challenge'))result={challengeId:'challenge-1',nonce:'N'.repeat(43),requestHash:'request-hash-from-server',consentVersion:'trialum-social-v46'};
   else if(url.endsWith('/eligibility/verify')){result=verifyStatus===200?{eligible:true,eligibilityToken:'E'.repeat(43),expiresAt:new Date(Date.now()+600000).toISOString(),consentVersion:'trialum-social-v46'}:{error:'integrity_rejected'};}
   else if(url.endsWith('/status'))result={ready:true,accountRecoveryEnabled:true,recoveryVersion:1};
   else if(url.endsWith('/me'))result={id:'00000000-0000-4000-8000-000000000001',nickname:'Nova'};
   else if(url.endsWith('/friends'))result={friends:[]};
   return {ok:!url.endsWith('/eligibility/verify')||verifyStatus===200,status:verifyStatus,json:async()=>result};
  }
 };
 ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(source('js/social.js'),ctx);
 return {api:ctx.TrialumSocial,calls,ctx,setAdult:v=>{nativeAdult=v;},ageRequest:()=>ageRequest,close:()=>ctx.TrialumSocial.setForeground(false),
  completeIntegrity:()=>integrityEvent?.()};
}
test('all five gates pass in sequence before social profile becomes ready',async t=>{
 const h=harness();await h.api.init();
 t.after(()=>h.close());
 const urls=h.calls.map(x=>x.url);
 assert(urls.indexOf('https://friends.example/v1/social/eligibility/challenge')<urls.indexOf('https://friends.example/v1/social/eligibility/verify'));
 assert(urls.indexOf('https://friends.example/v1/social/eligibility/verify')<urls.indexOf('https://friends.example/v1/social/status'));
 assert.equal(h.api.isSocialAllowed(),true);assert.equal(h.api.isSocialProfileActive(),true);
 const protectedCall=h.calls.find(x=>x.url.endsWith('/me'));
 assert.equal(protectedCall.opts.headers['X-Trialum-Eligibility'],'E'.repeat(43));
 assert.equal(JSON.stringify(h.calls).includes('toniadrenalin'),false);
});
test('no consent, unknown age, rejected Integrity or server failure never unlocks social',async t=>{
 const noConsent=harness({consent:false});await noConsent.api.init();assert.equal(noConsent.calls.length,0);
 const unknown=harness({adult:false});await unknown.api.init();assert.equal(unknown.api.isSocialAllowed(),false);assert.equal(unknown.calls.length,0);
 const rejected=harness({verifyStatus:403});await rejected.api.init();assert.equal(rejected.api.isSocialAllowed(),false);assert.equal(rejected.api.isSocialProfileActive(),false);
 t.after(()=>{noConsent.close();unknown.close();rejected.close();});
});
test('stale Age Signals requests cannot replace a newer result',async t=>{
 const h=harness({adult:false});await h.api.init();
 t.after(()=>h.close());
 assert.equal(h.api.requestAgeCheck(),true);const first=h.ageRequest();
 assert.equal(h.api.requestAgeCheck(),true);const second=h.ageRequest();assert(second>first);
 h.setAdult(true);await h.api.setAgeSignal({requestId:first,status:'adult_signal',adultEligible:true});
 assert.equal(h.api.getState().ageAllowed,false);
 await h.api.setAgeSignal({requestId:second,status:'adult_signal',adultEligible:true});
 assert.equal(h.api.isSocialAllowed(),true);
});
test('background cancels current Integrity result and keeps profile credentials intact',async()=>{
 const h=harness({delayIntegrity:true});const started=h.api.init();
 await new Promise(resolve=>setTimeout(resolve,0));h.api.setForeground(false);h.completeIntegrity();await started;
 assert.equal(h.api.getState().eligibilityStatus,'background');
 assert.equal(h.api.isSocialProfileActive(),false);
 assert.equal(h.ctx.TrialumAndroid.socialCredential(),'x'.repeat(43));
 assert.equal(h.calls.some(x=>x.url.endsWith('/me')),false);
});
test('native Android uses request IDs, active Age Signals and Play Integrity Standard API',()=>{
 const age=source('android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumAgeSignals.kt');
 const integrity=source('android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumPlayIntegrity.kt');
 const activity=source('android-template/app/src/main/java/com/trialum/ziivaiskra/MainActivity.kt');
 const gradle=source('android-template/app/build.gradle.kts');
 assert(age.includes('AtomicLong(0)')&&age.includes('requestId')&&age.includes('ageLower >= 18 && ageUpper == null'));
 assert(age.includes('AgeRangeSource.TIER_C')&&age.includes('AgeRangeSource.TIER_D'));
 assert(integrity.includes('IntegrityManagerFactory.createStandard')&&integrity.includes('setRequestHash(requestHash)'));
 assert(activity.includes('dispatchSocialLifecycle(false)')&&activity.includes('foregroundStarted || requestId <= 0L'));
 assert(gradle.includes('com.google.android.play:integrity:1.6.0')&&gradle.includes('versionCode = 46'));
});
test('messages and shared playground consume the central profile gate and eligibility lease',()=>{
 for(const file of ['js/messages.js','js/shared-playground.js']){
  const content=source(file);assert(content.includes('TrialumSocialEligibilityController?.isReady'),file);
  assert(content.includes('eligibilityHeaders'),file);assert(content.includes('eligibilityToken'),file);
  assert(!content.includes('betaTesterToolsEnabled'),file);
 }
 const workflow=source('.github/workflows/trialum-v45-optional-microphone-aab.yml');
 assert(workflow.includes('feature/v46-social-eligibility-controller-20261123'));
});
