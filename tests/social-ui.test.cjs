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
