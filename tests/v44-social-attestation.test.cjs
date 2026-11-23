/* Trialum v44 — app-side social attestation regression coverage.
 * Entirely mocked; no Play, server, user identities or device identifiers used. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/social.js'), 'utf8');
const UUID = '123e4567-e89b-42d3-a456-426614174000';
const KEY = 'B'.repeat(43);
const TOKEN = 'T'.repeat(220);

function setup({adult=true, consent=true, credential=KEY, attestationReady=true,
                alreadyEligible=false, errorOnAttest='', failRevoke=false, failRegistrationTransport=false,
                eligibilityStatus428=false, friends428Once=false}={}) {
 let age=adult, agreed=consent, saved=credential, counter=0, friendsFirst428=friends428Once;
 let eligible=alreadyEligible, revokeFails=failRevoke;
 const requests=[], events=[], storage = new Map();
 const native = {
   ageSignalsAdultEligible:()=>age,
   socialApiUrl:()=> 'https://friends.example',
   socialCredential:()=>saved,
   socialPendingInvite:()=> '',
   socialStoreCredential:key=>{saved=key;return true},
   socialClearCredential:()=>{saved='';return true},
   socialShowRecoveryKit:(id,key)=>events.push(['recovery-kit',id,key.length]),
   socialGenerateRecoveryKey:()=> 'N'.repeat(43),
   socialConfirmPreparedRecovery:()=>events.push(['recovery-confirm']),
   nearbyStop:()=>{},
   requestAgeSignals:()=>events.push(['age-check']),
   requestSocialIntegrityToken:(requestId,action,version,subject)=>{
     events.push(['integrity',action,version,subject]);
     ctx.TrialumSocialIntegrityEvent({requestId,ok:true,token:TOKEN});
   }
 };
 const ctx = {
   console, URL, AbortController, setTimeout, clearTimeout,
   crypto:{randomUUID:()=> '123e4567-e89b-42d3-a456-'+String(++counter).padStart(12,'0')},
   document:{visibilityState:'visible'},
   localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
   confirm:()=>true,
   TrialumAndroid:native,
   TrialumLegal:{
     socialAccepted:()=>agreed,
     setSocialConsentVersion:version=>version==='trialum-social-v1',
     grantSocialConsent:()=>{agreed=true;return true},
     revokeSocialConsent:()=>{agreed=false;return true}
   },
   TrialumPrivacyGuard:{inspect:()=>({blocked:false})},
   TrialumMessages:{deactivate:()=>events.push(['messages-stop'])},
   TrialumShared:{deactivate:()=>events.push(['shared-stop'])},
   TrialumPeer:{clear:()=>{}}
 };
 const fetch=async (url,opt={})=>{
   const route=url.split('/v1/social/')[1]||'';
   const body=opt.body?JSON.parse(opt.body):null;
   requests.push({route,method:opt.method,body});
   let status=200, response={ok:true};
   if(route==='status') response={
     ready:true,accountRecoveryEnabled:true,recoveryVersion:1,
     socialAttestationReady:attestationReady,socialEligibilityRequired:false,
     registrationIntegrityRequired:false,socialConsentVersion:'trialum-social-v1',
     eligibilityTtlSeconds:86400
   };
   else if(route==='eligibility/status'){
     if(eligibilityStatus428){status=428;response={error:'eligibility_attestation_required'}}
     else response={eligible,profileId:UUID,
       expiresAt:eligible?new Date(Date.now()+86400000).toISOString():null};
   }
   else if(route==='eligibility/attest') {
     if(errorOnAttest){status=503;response={error:errorOnAttest}}
     else {eligible=true;response={eligible:true};}
   }else if(route==='me') response={id:UUID,nickname:'Nova'};
   else if(route==='friends') {
     if(friendsFirst428){friendsFirst428=false;status=428;response={error:'eligibility_attestation_required'}}
     else response={friends:[]};
   }
   else if(route==='register') {
     if(failRegistrationTransport)throw Error('transport_interrupted');
     response={id:UUID,nickname:body.nickname,credential:'R'.repeat(43),recoveryKey:'K'.repeat(43),recoveryKitVersion:1};
   }
   else if(route==='recovery/restore') response={id:UUID,nickname:'Nova',credential:'S'.repeat(43),recoveryKitRotated:true};
   else if(route==='eligibility/revoke') {
     events.push(['server-revoke']);eligible=false;
     if(revokeFails){status=503;response={error:'integrity_verification_unavailable'}} else response={revoked:true};
   } else if(route==='account') response={deleted:true};
   return {ok:status<400,status,json:async()=>response};
 };
 ctx.fetch=fetch;
 vm.createContext(ctx);
 vm.runInContext(source,ctx,{filename:'social.js'});
 return {
   social:ctx.TrialumSocial,requests,events,storage,
   saved:()=>saved,setAge:value=>age=value,setRevokeFailure:value=>revokeFails=value
 };
}

test('unknown/underage/declined native age remains offline with a stored bearer',async()=>{
 const h=setup({adult:false});
 await h.social.init();
 assert.equal(h.social.isSocialProfileActive(),false);
 assert.equal(h.requests.length,0);
 assert(h.events.some(e=>e[0]==='age-check'));
});
test('consent is mandatory before any network request',async()=>{
 const h=setup({consent:false});
 await h.social.init();
 assert.equal(h.requests.length,0);
 assert.equal(h.social.isSocialAllowed(),false);
});
test('existing profile checks eligibility and renews before profile/friends',async()=>{
 const h=setup();
 await h.social.init();
 assert.equal(h.social.isSocialProfileActive(),true);
 assert.deepEqual(h.requests.map(v=>v.route),['status','eligibility/status','eligibility/attest','me','friends']);
 assert.equal(h.events.find(e=>e[0]==='integrity')[1],'renew');
 const body=h.requests.find(v=>v.route==='eligibility/attest').body;
 assert.deepEqual(Object.keys(body).sort(),['integrityToken','socialConsentAccepted','socialConsentVersion']);
 assert.equal(body.socialConsentVersion,'trialum-social-v1');
});
test('fresh server eligibility skips unnecessary re-attestation',async()=>{
 const h=setup({alreadyEligible:true});
 await h.social.init();
 assert.equal(h.social.isSocialProfileActive(),true);
 assert(!h.events.some(e=>e[0]==='integrity'));
});
test('new registration has fresh request-bound token and one-time recovery display',async()=>{
 const h=setup({credential:''});
 await h.social.init();
 const result=await h.social.register(' Test ');
 assert.equal(result.id,UUID);
 assert.equal(h.social.isSocialProfileActive(),true);
 assert(h.events.some(e=>e[0]==='integrity'&&e[1]==='register'&&e[3]==='Test'));
 assert(h.events.some(e=>e[0]==='recovery-kit'&&e[1]===UUID));
 const body=h.requests.find(v=>v.route==='register').body;
 assert.deepEqual(Object.keys(body).sort(),
  ['integrityToken','nickname','nicknamePrivacyConfirmed','socialConsentAccepted','socialConsentVersion']);
 assert.equal(body.nickname,'Test');
 assert.equal(body.socialConsentAccepted,true);
 assert(!JSON.stringify(body).match(/ageLower|ageUpper|dateOfBirth|googleEmail|deviceId/));
});
test('consent withdrawal stops clients before server revoke and preserves bearer',async()=>{
 const h=setup();
 await h.social.init();
 const old=h.saved();
 const ok=await h.social.setSocialConsent(false);
 assert.equal(ok,true);
 assert.equal(h.social.isSocialProfileActive(),false);
 assert.equal(h.saved(),old);
 const order=h.events.map(e=>e[0]);
 assert(order.lastIndexOf('messages-stop')<order.indexOf('server-revoke'));
 assert(order.lastIndexOf('shared-stop')<order.indexOf('server-revoke'));
 assert(h.requests.some(v=>v.route==='eligibility/revoke'));
});
test('server attestation unavailable leaves existing profile and local gameplay untouched',async()=>{
 const h=setup({errorOnAttest:'integrity_verification_unavailable'});
 await h.social.init();
 assert.equal(h.social.isSocialProfileActive(),false);
 assert.equal(h.saved(),KEY);
 assert(!h.requests.some(v=>v.route==='friends'));
});
test('unavailable capability never falls back to client-only eligibility',async()=>{
 const h=setup({attestationReady:false});
 await h.social.init();
 assert.equal(h.social.isSocialProfileActive(),false);
 assert.deepEqual(h.requests.map(v=>v.route),['status']);
});
test('account deletion is reachable with stale age and consent',async()=>{
 const h=setup({adult:false,consent:false});
 await h.social.init();
 assert.equal(await h.social.deleteAccount(),true);
 assert.equal(h.saved(),'');
 assert(h.requests.some(v=>v.route==='account'&&v.method==='DELETE'));
});
test('profile recovery rotates bearer then verifies renewed eligibility',async()=>{
 const h=setup({credential:''});
 await h.social.init();
 assert.equal(h.social.startRecovery(UUID,'O'.repeat(43)),true);
 const result=await h.social.acceptPreparedRecovery(UUID,'N'.repeat(43));
 assert.equal(result.id,UUID);
 assert.equal(h.saved(),'S'.repeat(43));
 assert.equal(h.social.isSocialProfileActive(),true);
 assert(h.requests.some(v=>v.route==='recovery/restore'));
 assert(h.requests.some(v=>v.route==='eligibility/attest'));
});

test('ambiguous registration network outcome is persisted and must not silently retry',async()=>{
 const h=setup({credential:'',failRegistrationTransport:true});
 await h.social.init();
 const first=await h.social.register('Nova');
 assert.equal(first,null);
 assert.equal(h.storage.get('trialum.social.registration.uncertain.v44'),'yes');
 assert.equal(h.social.getState().registrationOutcomeUnknown,true);
 const registered=h.requests.filter(x=>x.route==='register').length;
 await h.social.init();
 await h.social.register('Nova');
 assert.equal(h.requests.filter(x=>x.route==='register').length,registered,
  'no duplicate registration until user explicitly reviews the outcome');
 assert.equal(h.social.confirmReviewedRegistration(),true);
 assert.equal(h.storage.has('trialum.social.registration.uncertain.v44'),false);
});
test('HTTP 428 eligibility status is a recoverable renew, not account deletion',async()=>{
 const h=setup({eligibilityStatus428:true});
 await h.social.init();
 assert.equal(h.social.isSocialProfileActive(),true);
 assert(h.requests.some(x=>x.route==='eligibility/attest'));
 assert.equal(h.saved(),KEY);
});
test('online HTTP 428 triggers one bounded eligibility recovery without reconnect loop',async()=>{
 const h=setup({friends428Once:true});
 await h.social.init();
 for(let i=0;i<8&&!h.social.isSocialProfileActive();i++)
   await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.social.isSocialProfileActive(),true);
 assert.equal(h.requests.filter(v=>v.route==='friends').length,2);
 assert.equal(h.saved(),KEY);
});
test('failed revoke persists a pending server-revocation marker and keeps offline play',async()=>{
 const h=setup({failRevoke:true});
 await h.social.init();
 assert.equal(await h.social.setSocialConsent(false),true);
 assert.equal(h.social.isSocialProfileActive(),false);
 assert.equal(h.storage.get('trialum.social.revoke.pending.v44'),'yes');
 assert.equal(h.saved(),KEY);
});
test('failed revoke is retried on next launch even when consent remains withdrawn',async()=>{
 const h=setup({failRevoke:true});
 await h.social.init();
 assert.equal(await h.social.setSocialConsent(false),true);
 assert.equal(h.storage.get('trialum.social.revoke.pending.v44'),'yes');
 h.setRevokeFailure(false);
 const before=h.requests.length;
 await h.social.init();
 assert.equal(h.storage.has('trialum.social.revoke.pending.v44'),false);
 assert.equal(h.saved(),KEY);
 assert.deepEqual(h.requests.slice(before).map(v=>v.route),['eligibility/revoke']);
 assert.equal(h.social.isSocialProfileActive(),false);
});
test('WSS 1008 session_revoked suspends social connections without deleting identity',async()=>{
 const h=setup();
 await h.social.init();
 assert.equal(h.social.handleTransportClose({code:1008,reason:'session_revoked'}),true);
 assert.equal(h.social.isSocialProfileActive(),false);
 assert.equal(h.saved(),KEY);
 assert.equal(h.social.handleTransportClose({code:1000,reason:''}),false);
});

test('request hash contract is four newline-delimited fields without trailing newline',()=>{
 const crypto=require('node:crypto');
 const raw='trialum-social-integrity-v1\nregister\ntrialum-social-v1\nTest';
 const computed=crypto.createHash('sha256').update(raw,'utf8').digest('base64url');
 const kotlin=fs.readFileSync(path.join(__dirname,
  '../android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumSocialIntegrity.kt'),'utf8');
 assert(kotlin.includes('trialum-social-integrity-v1\\n'));
 assert(kotlin.includes('MessageDigest.getInstance("SHA-256")'));
 assert(kotlin.includes('Base64.NO_PADDING'));
 assert.equal(computed.length,43);
});
test('social socket clients suppress reconnect on revoked/attestation-required 1008',()=>{
 for(const file of ['messages.js','shared-playground.js']){
   const text=fs.readFileSync(path.join(__dirname,'../js',file),'utf8');
   assert(text.includes('handleTransportClose?.(event)'),file);
 }
});
