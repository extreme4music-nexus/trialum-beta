/* Trialum v44 — Google Play Age Signals adult gate, non-tester social access. */
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
   socialShowRecoveryKit:()=>{},socialGenerateRecoveryKey:()=> 'N'.repeat(43),
   socialConfirmPreparedRecovery:()=>{},
   requestSocialIntegrityToken:(id,action,version,subject)=>
      ctx.TrialumSocialIntegrityEvent({requestId:id,ok:true,token:'X'.repeat(220)}),
   nearbyStop:()=>{},
  },
  TrialumLegal:{
   socialAccepted:()=>consent,
   grantSocialConsent:()=>{consent=true;return true},
   revokeSocialConsent:()=>{consent=false;return true},
    setSocialConsentVersion:version=>version==='trialum-social-v1'
  },
  TrialumMessages:{deactivate:()=>{}},TrialumShared:{deactivate:()=>{}},
  TrialumPeer:{clear:()=>{}},
  confirm:()=>true,
  fetch:async(url,opts)=>{
   calls.push({url,opts});
   const result=url.endsWith('/v1/social/status')?{ready:true,
      socialAttestationReady:true,socialConsentVersion:'trialum-social-v1',
      accountRecoveryEnabled:true,recoveryVersion:1}:
    url.endsWith('/v1/social/eligibility/status')?{eligible:true,
      profileId:'123e4567-e89b-42d3-a456-426614174000',
      expiresAt:new Date(Date.now()+86400000).toISOString()}:
    url.endsWith('/me')?{id:'123e4567-e89b-42d3-a456-426614174000',nickname:'Nova'}:
    url.endsWith('/friends')?{friends:[]}:{ok:true};
   return {ok:true,status:200,json:async()=>result};
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
test('user can request Play age signal without beta tester permission',async()=>{
 const h=harness({consent:true,adult:false,beta:false,credential:''});
 await h.api.init();
 assert.equal(h.requests(),1,'bootstrapping an opted-in session performs one native check');
 assert.equal(h.api.getState().ageStatus,'checking');
 h.age(true);
 await h.api.setAgeSignal({status:'adult_signal',adultEligible:true});
 assert.equal(h.api.isSocialAllowed(),true);
 assert.equal(h.api.isSocialProfileActive(),false,'profile still requires separate creation');
 assert(h.calls.every(x=>x.url.endsWith('/v1/social/status')),
   'only capability discovery is allowed; never create an account');
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
test('Friends, messages and playground have no beta allowlist hard gate',()=>{
 for(const file of ['js/social.js','js/messages.js','js/shared-playground.js']){
  const s=source(file);
  assert(!s.includes('betaTesterToolsEnabled'),file);
  assert(!s.includes('qaSocialAgeBypass'),file);
  assert(s.includes('isSocialProfileActive')||s.includes('ageSignalsAdultEligible'),file);
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
