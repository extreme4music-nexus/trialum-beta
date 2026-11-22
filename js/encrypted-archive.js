/* End-to-end encrypted, user-managed migration archive. No network access. */
(function(root){
'use strict';
const FORMAT='trialum-encrypted-archive',VERSION=1,ITERATIONS=600000,MAX_BYTES=20*1024*1024;
function bytesToB64(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s);}
function b64ToBytes(s){const raw=atob(String(s));const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
function randomRecoveryCode(){
 if(!root.crypto?.getRandomValues||!root.crypto?.subtle)throw Error('secure_crypto_unavailable');
 const raw=new Uint8Array(32);root.crypto.getRandomValues(raw);
 const hex=[...raw].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
 return hex.match(/.{1,4}/g).join('-');
}
function normalizeKey(value){return String(value||'').trim().replace(/-/g,'').toUpperCase();}
async function derive(recoveryCode,salt){
 if(!root.crypto?.subtle)throw Error('secure_crypto_unavailable');
 const key=normalizeKey(recoveryCode);
 if(!/^[A-F0-9]{64}$/.test(key))throw Error('invalid_recovery_code');
 const material=await root.crypto.subtle.importKey('raw',new TextEncoder().encode(key),'PBKDF2',false,['deriveKey']);
 return root.crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
function byteLength(text){return new TextEncoder().encode(text).length;}
async function encrypt(payload,recoveryCode){
 const json=JSON.stringify(payload),length=byteLength(json);
 if(length>MAX_BYTES)throw Error('archive_too_large');
 const salt=root.crypto.getRandomValues(new Uint8Array(16)),iv=root.crypto.getRandomValues(new Uint8Array(12));
 const key=await derive(recoveryCode,salt),additionalData=new TextEncoder().encode(FORMAT+':'+VERSION);
 const cipher=await root.crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData,tagLength:128},key,new TextEncoder().encode(json));
 return JSON.stringify({format:FORMAT,version:VERSION,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,
  cipher:'AES-256-GCM',salt:bytesToB64(salt),iv:bytesToB64(iv),ciphertext:bytesToB64(new Uint8Array(cipher)),
  createdAt:new Date().toISOString()},null,2);
}
async function decrypt(text,recoveryCode){
 if(byteLength(String(text))>MAX_BYTES)throw Error('archive_too_large');
 let box;try{box=JSON.parse(String(text).replace(/^\uFEFF/,''));}catch(_){throw Error('invalid_archive');}
 if(box?.format!==FORMAT||box.version!==VERSION||box.kdf!=='PBKDF2-SHA256'||box.iterations!==ITERATIONS||box.cipher!=='AES-256-GCM')throw Error('unsupported_archive');
 let plain;
 try{
  const salt=b64ToBytes(box.salt),iv=b64ToBytes(box.iv),cipher=b64ToBytes(box.ciphertext);
  if(salt.length!==16||iv.length!==12||cipher.length<16||cipher.length>MAX_BYTES)throw Error('invalid_archive');
  const key=await derive(recoveryCode,salt);
  plain=await root.crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(FORMAT+':'+VERSION),tagLength:128},key,cipher);
 }catch(e){if(e?.message==='invalid_recovery_code')throw e;throw Error('wrong_key_or_damaged_archive');}
 try{return JSON.parse(new TextDecoder().decode(plain));}catch(_){throw Error('invalid_archive');}
}
function isArchive(text){try{return JSON.parse(String(text)).format===FORMAT;}catch(_){return false;}}
root.TrialumEncryptedArchive={FORMAT,VERSION,ITERATIONS,MAX_BYTES,randomRecoveryCode,encrypt,decrypt,isArchive};
if(typeof module==='object'&&module.exports)module.exports=root.TrialumEncryptedArchive;
})(typeof globalThis!=='undefined'?globalThis:this);
