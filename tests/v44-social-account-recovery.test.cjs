/* v44 social profile recovery: no local JSON secrets, required age gate,
 * native one-time kit UI, old ID restored and new credential stored first.
 */
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const UUID='11111111-2222-4333-8444-555555555555';
const KEY='R'.repeat(43),NEXT='N'.repeat(43),TOKEN='T'.repeat(43);
function scenario({adult=true,consent=true,oldCredential='',serverRecovery=true}={}){
 let stored=oldCredential,profile=oldCredential?{id:UUID,nickname:'Cris'}:null;
 const requests=[],shown=[],confirmed=[],writes=[];
 const native={
  socialApiUrl:()=> 'https://friends.example',
  socialCredential:()=>stored,
  socialStoreCredential:code=>{writes.push(code);stored=code;return true;},
  socialClearCredential:()=>{stored='';},
  socialShowRecoveryKit:(id,key)=>shown.push({id,key}),
  socialGenerateRecoveryKey:()=>NEXT,
  socialConfirmPreparedRecovery:(id,key)=>confirmed.push({id,key}),
  ageSignalsAdultEligible:()=>adult,
  requestSocialIntegrityToken:(id,action,version,subject)=>context.TrialumSocialIntegrityEvent({
    requestId:id,ok:true,token:'I'.repeat(220)
  })
 };
 const context={
  console,URL,AbortController,setTimeout,clearTimeout,
  crypto:require('node:crypto').webcrypto,
  TrialumAndroid:native,TrialumLegal:{socialAccepted:()=>consent,grantSocialConsent:()=>true,
   revokeSocialConsent:()=>true,setSocialConsentVersion:version=>version==='trialum-social-v1'},
  TrialumI18n:{language:()=> 'en',t:v=>v},
  TrialumPrivacyGuard:{inspect:()=>({blocked:false})},
  TrialumMessages:{deactivate(){}},TrialumShared:{deactivate(){}},
  TrialumPeer:{clear(){}},confirm:()=>true,
  fetch:async(url,options)=>{
   const route=url.split('/v1/social/')[1],body=options.body?JSON.parse(options.body):null;
   requests.push({route,method:options.method,body,authorization:options.headers.Authorization||''});
   let data={};
   if(route==='status')data={ready:true,accountRecoveryEnabled:serverRecovery,recoveryVersion:1,
      socialAttestationReady:true,socialConsentVersion:'trialum-social-v1',socialEligibilityRequired:false,
      registrationIntegrityRequired:false};
   else if(route==='eligibility/status')data={eligible:true,profileId:UUID,
      expiresAt:new Date(Date.now()+86400000).toISOString()};
   else if(route==='register'){
    if(!serverRecovery)return {ok:false,json:async()=>({error:'recovery_unavailable'})};
    profile={id:UUID,nickname:'Cris'};
    data={...profile,credential:TOKEN,recoveryKey:KEY,recoveryKitVersion:1};
   }else if(route==='friends')data={friends:[{id:'friend-2',nickname:'Mika'}]};
   else if(route==='me')data=profile||{id:UUID,nickname:'Cris'};
   else if(route==='recovery/restore')data={id:UUID,nickname:'Cris',credential:TOKEN,
     recoveryKitRotated:true};
   else if(route==='recovery/issue')data={id:UUID,recoveryKey:KEY,recoveryKitVersion:1};
   return {ok:true,status:200,json:async()=>data};
  }
 };
 context.globalThis=context;
 vm.createContext(context);vm.runInContext(src('js/social.js'),context);
 return {api:context.TrialumSocial,context,native,requests,shown,confirmed,writes,getCredential:()=>stored};
}
test('new profile displays one-time 256-bit recovery kit in native UI, never world JSON',async()=>{
 const s=scenario();
 await s.api.init();
 assert.deepEqual(s.requests.map(v=>v.route),['status'],
   'only the consented capability discovery may run before profile creation');
 const profile=await s.api.register('Cris');
 assert.equal(profile.id,UUID);
 assert.equal(s.shown.length,1);
 assert.deepEqual(s.shown[0],{id:UUID,key:KEY});
 assert.equal(s.getCredential(),TOKEN);
 assert.equal(s.api.getState().identity.id,UUID);
 assert(!JSON.stringify(s.api.getState()).includes(KEY));
 const reg=s.requests.find(x=>x.route==='register');
 assert.equal(reg.authorization,'');
 assert.equal(reg.body.nickname,'Cris');
 assert(!JSON.stringify(reg.body).includes(KEY));
});
test('same-ID recovery makes no request until NEW key was shown and acknowledged',async()=>{
 const s=scenario();await s.api.init();
 assert.equal(s.api.startRecovery(UUID,KEY),true);
 assert.deepEqual(s.confirmed,[{id:UUID,key:NEXT}]);
 assert.equal(s.requests.some(v=>v.route==='recovery/restore'),false,
   'no rotation of server credentials until native confirmation');
 s.context.TrialumRecoveryKitAccepted(UUID,NEXT);
 await new Promise(r=>setImmediate(r));
 const restore=s.requests.find(x=>x.route==='recovery/restore');
 assert(restore);
 assert.equal(restore.authorization,'');
 assert.equal(restore.body.id,UUID);
 assert.equal(restore.body.recoveryKey,KEY);
 assert.equal(restore.body.nextRecoveryKey,NEXT);
 assert.equal(s.api.getState().identity.id,UUID);
 assert.equal(s.getCredential(),TOKEN);
 assert.deepEqual(s.api.getState().friends.map(f=>f.nickname),['Mika']);
 assert(!JSON.stringify(s.api.getState()).includes(KEY));
 assert(!JSON.stringify(s.api.getState()).includes(NEXT));
});
test('unknown age or missing consent denies recovery and makes no network request',async()=>{
 for(const options of [{adult:false},{consent:false}]){
  const s=scenario(options);await s.api.init();
  assert.equal(s.api.startRecovery(UUID,KEY),false);
  assert.equal(s.requests.length,0);
 }
});
test('old server cannot create unrecoverable new profile',async()=>{
 const s=scenario({serverRecovery:false});await s.api.init();
 assert.equal(await s.api.register('Cris'),null);
 assert(s.requests.some(x=>x.route==='status'));
 assert(!s.requests.some(x=>x.route==='register'));
 assert.equal(s.shown.length,0);
});
test('existing authenticated account reissues one-time kit without resetting profile',async()=>{
 const s=scenario({oldCredential:TOKEN});await s.api.init();
 assert.equal(s.api.getState().identity.id,UUID);
 assert.equal(await s.api.issueRecoveryKit(),true);
 assert.deepEqual(s.shown,[{id:UUID,key:KEY}]);
 assert.equal(s.getCredential(),TOKEN);
 assert(s.requests.some(x=>x.route==='recovery/issue'));
});
test('native implementation uses OS randomness and screenshot-protected recovery dialogs',()=>{
 const android=src('android-template/app/src/main/java/com/trialum/ziivaiskra/MainActivity.kt');
 assert(android.includes('SecureRandom().nextBytes(bytes)'));
 assert(android.includes('socialConfirmPreparedRecovery'));
 assert(android.includes('WindowManager.LayoutParams.FLAG_SECURE'));
 assert(android.includes('dialog.window?.addFlags'));
 assert(android.includes('socialShowRecoveryKit'));
 const ui=src('js/social.js');
 assert(ui.includes('type="password"'));
 assert(ui.includes("cache:'no-store'"));
 assert(!ui.includes('localStorage.setItem(KEY'));
 assert(!src('js/encrypted-archive.js').includes('socialCredential'));
});
test('staged server always rotates credential and kit and invalidates old WSS',()=>{
 const recovery=src('server-patch/v44/src/account-recovery.mjs');
 const social=src('server-patch/v44/src/social.mjs');
 const live=src('server-patch/v44/src/live.mjs');
 assert(recovery.includes("createHmac('sha256'"));
 assert(recovery.includes('timingSafeEqual'));
 assert(recovery.includes('UPDATE installations SET credential_hash'));
 assert(recovery.includes('UPDATE social_account_recovery SET secret_verifier'));
 assert(recovery.includes('DELETE FROM push_registrations'));
 assert(social.includes("limit('recover-ip:'"));
 assert(social.includes("limit('recover-id:'"));
 assert(social.includes('accountRecoveryEnabled'));
 assert(live.includes("event.type==='account_recovered'"));
 assert(live.includes("p.ws.close(1008,'session_revoked')"));
});
