/* Trialum v45 — internal-beta social access with production Age Signals gate. */
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const vm=require('node:vm'),path=require('node:path');
const source=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function harness({consent=false,adult=false,beta=false,qa=false,credential=''}={}){
 let nativeAdult=adult,requested=0;const calls=[];
 const ctx={
  console,URL,AbortController,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,
  TrialumAndroid:{
   betaTesterToolsEnabled:()=>beta,
   qaSocialAgeBypass:()=>qa,
   ageSignalsAdultEligible:()=>nativeAdult,
   requestAgeSignals:()=>{requested++},
   socialApiUrl:()=> 'https://friends.example',
   socialCredential:()=>credential,
   socialStoreCredential:()=>true,
   nearbyStop:()=>{},
  },
  TrialumLegal:{
   socialAccepted:()=>consent,
   grantSocialConsent:()=>{consent=true;return true},
   revokeSocialConsent:()=>{consent=false;return true}
  },
  TrialumMessages:{deactivate:()=>{}},TrialumShared:{deactivate:()=>{}},
  TrialumPeer:{clear:()=>{}},
  confirm:()=>true,
  fetch:async(url,opts)=>{
   calls.push({url,opts});
   const result=url.endsWith('/status')?{ready:true}:
    url.endsWith('/me')?{id:'owner-1',nickname:'Nova'}:
    url.endsWith('/friends')?{friends:[]}:{ok:true};
   return {ok:true,json:async()=>result};
  }
 };
 ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(source('js/social.js'),ctx);
 return {api:ctx.TrialumSocial,calls,ctx,age:val=>{nativeAdult=val},requests:()=>requested};
}
test('adult consent from official native Play signal works even with beta tools OFF',async()=>{
 const h=harness({consent:true,adult:true,beta:false,credential:'x'.repeat(43)});
 await h.api.init();
 assert.equal(h.api.isSocialAllowed(),true);
 assert.equal(h.api.isSocialProfileActive(),true);
 assert(h.calls.some(x=>x.url.endsWith('/v1/social/status')));
 assert(h.calls.some(x=>x.url.endsWith('/v1/social/me')));
});
test('Google eligibility must not enable social until consent is explicit',async()=>{
 const h=harness({consent:false,adult:true,beta:false,credential:'x'.repeat(43)});
 await h.api.init();
 assert.equal(h.api.isSocialAllowed(),false);
 assert.equal(h.calls.length,0);
 await h.api.setSocialConsent(true);
 assert.equal(h.api.isSocialAllowed(),true);
 assert(h.calls.length>0);
 await h.api.setSocialConsent(false);
 assert.equal(h.api.isSocialAllowed(),false);
});
test('unknown/declined age always offline, including saved bearer and QA bypass',async()=>{
 const h=harness({consent:true,adult:false,beta:false,qa:true,credential:'x'.repeat(43)});
 await h.api.init();
 assert.equal(h.api.isSocialAllowed(),false);
 assert.equal(h.calls.length,0);
 h.api.setAgeSignal({status:'adult_signal',adultEligible:true});
 assert.equal(h.api.isSocialAllowed(),false);
 assert.equal(h.calls.length,0);
 const blocked=await h.api.refresh();
 assert.equal(blocked,null);
 assert.equal(h.calls.length,0);
});
test('release users can request Play Age Signals without beta tester tools',async()=>{
 const h=harness({consent:true,adult:false,beta:false,credential:''});
 await h.api.init();
 assert.equal(h.api.requestAgeCheck(),true);
 assert.equal(h.requests(),1);
 assert.equal(h.api.getState().ageStatus,'checking');
 h.age(true);
 await h.api.setAgeSignal({status:'adult_signal',adultEligible:true});
 assert.equal(h.api.isSocialAllowed(),true);
 assert.equal(h.api.isSocialProfileActive(),false,'profile still requires separate creation');
 assert.equal(h.calls.length,0,'no automatic social profile or transmission');
});
test('reject unsupported status and native revoked eligibility after result',async()=>{
 const h=harness({consent:true,adult:false});
 await h.api.init();
 await h.api.setAgeSignal({status:'not_shared',adultEligible:false});
 assert.equal(h.api.isSocialAllowed(),false);
 h.age(true);
 await h.api.setAgeSignal({status:'not_shared',adultEligible:true});
 assert.equal(h.api.isSocialAllowed(),false,'both status and boolean required');
 await h.api.setAgeSignal({status:'adult_signal',adultEligible:true});
 assert.equal(h.api.isSocialAllowed(),true);
 h.age(false);
 assert.equal(h.api.isSocialAllowed(),false,'native state is checked again on access');
});
test('internal beta tools never bypass Age Signals',async()=>{
 const h=harness({consent:true,adult:false,beta:true,credential:'x'.repeat(43)});
 await h.api.init();
 assert.equal(h.api.isAdultAllowed(),false);
 assert.equal(h.api.getState().ageStatus,'unchecked');
 assert.equal(h.api.isSocialAllowed(),false);
 assert.equal(h.api.isSocialProfileActive(),false);
 assert.equal(h.calls.length,0);
 await h.api.setAgeSignal({status:'not_shared',adultEligible:false});
 assert.equal(h.api.isSocialAllowed(),false);
 assert.equal(h.api.isSocialProfileActive(),false);
 assert.equal(h.calls.length,0);
});
test('internal beta still requires explicit social consent',async()=>{
 const h=harness({consent:false,adult:false,beta:true,credential:'x'.repeat(43)});
 await h.api.init();
 assert.equal(h.api.isSocialAllowed(),false);
 assert.equal(h.api.isSocialProfileActive(),false);
 assert.equal(h.calls.length,0,'no social-server request before consent');
});
test('internal beta tools do not grant social access',()=>{
 const social=source('js/social.js');
 const gradle=source('android-template/app/build.gradle.kts');
 assert(social.includes('betaTestBuild=()=>native()?.betaTesterToolsEnabled?.()===true'));
 assert(social.includes('socialAccessAllowed=()=>state.ageAllowed===true&&native()?.ageSignalsAdultEligible?.()===true'));
 assert(!social.includes('||betaTestBuild()'));
 assert(gradle.includes('buildConfigField("Boolean", "BETA_TESTER_TOOLS", "false")'));
 assert(gradle.includes('create("internalBeta")'));
 for(const file of ['js/messages.js','js/shared-playground.js']){
  const content=source(file);
  assert(!content.includes('betaTesterToolsEnabled'),file);
  assert(!content.includes('qaSocialAgeBypass'),file);
  assert(content.includes('isSocialProfileActive'),file);
 }
});
test('Android uses current Age Signals 0.0.6 and shared 18+ A/C/D sources',()=>{
 const gradle=source('android-template/app/build.gradle.kts');
 const age=source('android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumAgeSignals.kt');
 const activity=source('android-template/app/src/main/java/com/trialum/ziivaiskra/MainActivity.kt');
 assert(gradle.includes('com.google.android.play:age-signals:0.0.6'));
 assert(age.includes('AgeSignalsStatus.SHARED'));
 assert(age.includes('AgeRangeSource.TIER_C')&&age.includes('AgeRangeSource.TIER_D'));
 assert(age.includes('result.ageRangeSource() == AgeRangeSource.TIER_A'));
 assert(!age.includes('result.ageRangeSource() == AgeRangeSource.TIER_B'));
 assert(age.includes('TIER_A is the normal opt-in age-range signal'));
 assert(age.includes('ageLower >= 18 && ageUpper == null'));
 assert(age.includes('deliver(JSONObject().put("status", status).put("adultEligible", eligible))'));
 const bridge=activity.split('@JavascriptInterface fun requestAgeSignals()')[1].split('@JavascriptInterface fun qaSocialAgeBypass()')[0];
 assert(!bridge.includes('BuildConfig.BETA_TESTER_TOOLS'));
 assert(bridge.includes('ageSignals.request(this@MainActivity)'));
 assert(bridge.includes('ageSignals.isAdultEligible()'));
});
