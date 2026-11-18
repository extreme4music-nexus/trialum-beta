const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {parseCode}=require('../js/social.js');
const code=crypto.randomBytes(32).toString('base64url');
test('paste exact invite token',()=>assert.equal(parseCode(code),code));
test('paste scheme link with or without trailing slash',()=>{
 assert.equal(parseCode('trialum://invite/'+code),code);
 assert.equal(parseCode('trialum://invite/'+code+'/'),code);
});
test('paste complete Macedonian message',()=>{
 const text='🐾 ТРИАЛУМ — покана\nОтвори во играта: trialum://invite/'+code+'\nАко линкот не се отвори, внеси го кодот:\n'+code;
 assert.equal(parseCode(text),code);
});
test('reject other origins and malformed links',()=>{
 assert.equal(parseCode('https://evil.example/?invite='+code),'');
 assert.equal(parseCode('trialum://evil/'+code),'');
 assert.equal(parseCode('trialum://invite/'+code+'oversized'),'');
 assert.equal(parseCode('x'.repeat(1025)),'');
});

test('share HTTPS invite from configured host with URL fragment',()=>{
 assert.equal(parseCode('https://friends.ts.net/invite#'+code,'https://friends.ts.net'),code);
 assert.equal(parseCode('Open https://friends.ts.net/invite#'+code+' and play','https://friends.ts.net'),code);
 assert.equal(parseCode('https://evil.ts.net/invite#'+code,'https://friends.ts.net'),'');
});

test('privacy: unregistered player causes no social network request on startup',async()=>{
 const oldNative=globalThis.TrialumAndroid,oldFetch=globalThis.fetch;
 let calls=0;
 globalThis.TrialumAndroid={
   socialApiUrl:()=> 'https://friends.example',
   socialCredential:()=> ''
 };
 globalThis.fetch=()=>{calls++;throw Error('unauthorized network call')};
 try{await globalThis.TrialumSocial.init();assert.equal(calls,0);}
 finally{globalThis.TrialumAndroid=oldNative;globalThis.fetch=oldFetch;}
});

test('age signal is required even when an existing social credential is stored',async()=>{
 const oldNative=globalThis.TrialumAndroid,oldFetch=globalThis.fetch;
 let calls=0;
 globalThis.TrialumAndroid={betaTesterToolsEnabled:()=>true,ageSignalsAdultEligible:()=>false,
   socialApiUrl:()=> 'https://friends.example',socialCredential:()=> 'X'.repeat(43)};
 globalThis.fetch=()=>{calls++;throw Error('age-locked account made a request')};
 try{
  await globalThis.TrialumSocial.init();
  assert.equal(calls,0,'saved social credentials must not bypass the age gate');
  assert.equal(globalThis.TrialumSocial.isAdultAllowed(),false);
 }finally{globalThis.TrialumAndroid=oldNative;globalThis.fetch=oldFetch;}
});

test('social server is not contacted until the separate local opt-in is accepted',async()=>{
 const oldNative=globalThis.TrialumAndroid,oldLegal=globalThis.TrialumLegal,oldFetch=globalThis.fetch;
 const oldStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map();let calls=0;
 Object.defineProperty(globalThis,'localStorage',{configurable:true,writable:true,value:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}});
 globalThis.TrialumLegal={socialAccepted:()=>values.get('trialum.social.consent.v39')==='accepted',grantSocialConsent:()=>{values.set('trialum.social.consent.v39','accepted');return true;},revokeSocialConsent:()=>{values.delete('trialum.social.consent.v39');return true;}};
 globalThis.TrialumAndroid={betaTesterToolsEnabled:()=>true,qaSocialAgeBypass:()=>false,ageSignalsAdultEligible:()=>true,
   socialApiUrl:()=> 'https://friends.example',socialCredential:()=> ''};
 globalThis.fetch=async()=>{calls++;return{ok:true,status:200,json:async()=>({ready:true})};};
 try{
  await globalThis.TrialumSocial.init();
  assert.equal(calls,0,'no social request before opt-in');
  assert.equal(globalThis.TrialumSocial.isSocialAllowed(),false);
  assert.equal(await globalThis.TrialumSocial.setSocialConsent(true),true);
  assert.equal(calls,0,'an accepted choice alone does not create a profile or trigger network');
  assert.equal(globalThis.TrialumSocial.isSocialAllowed(),true);
  assert.equal(globalThis.TrialumSocial.isSocialProfileActive(),false,'messages/shared-play still need a profile');
  await globalThis.TrialumSocial.setSocialConsent(false);
  assert.equal(globalThis.TrialumSocial.isSocialAllowed(),false);
 }finally{globalThis.TrialumAndroid=oldNative;globalThis.TrialumLegal=oldLegal;globalThis.fetch=oldFetch;if(oldStorage)Object.defineProperty(globalThis,'localStorage',oldStorage);else delete globalThis.localStorage;}
});
