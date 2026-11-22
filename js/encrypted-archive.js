/* End-to-end encrypted portable migration archive; no network access.
 * V2: optional gzip before AES-GCM, with output-size bounded decompression.
 * V1 remains readable with its original authenticated format/version.
 */
(function(root){
'use strict';
const FORMAT='trialum-encrypted-archive',VERSION=2,ITERATIONS=600000;
const MB=1024*1024,LEGACY_MAX_BYTES=20*MB,MAX_BYTES=64*MB,MAX_ARCHIVE_BYTES=96*MB;
const utf8=s=>new TextEncoder().encode(s);
const byteLength=s=>utf8(s).length;
function bytesToB64(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s);}
function b64ToBytes(s,max){
 if(typeof s!=='string'||s.length>Math.ceil(max/3)*4+8||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))throw Error('invalid_archive');
 const raw=atob(s);
 if(raw.length>max)throw Error('archive_too_large');
 const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;
}
function randomRecoveryCode(){
 if(!root.crypto?.getRandomValues||!root.crypto?.subtle)throw Error('secure_crypto_unavailable');
 const raw=new Uint8Array(32);root.crypto.getRandomValues(raw);
 return [...raw].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase().match(/.{1,4}/g).join('-');
}
const normalizeKey=value=>String(value||'').trim().replace(/-/g,'').toUpperCase();
async function derive(recoveryCode,salt){
 if(!root.crypto?.subtle)throw Error('secure_crypto_unavailable');
 const key=normalizeKey(recoveryCode);
 if(!/^[A-F0-9]{64}$/.test(key))throw Error('invalid_recovery_code');
 const material=await root.crypto.subtle.importKey('raw',utf8(key),'PBKDF2',false,['deriveKey']);
 return root.crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},
  material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function gzip(bytes){
 if(typeof root.CompressionStream!=='function'||typeof root.Blob!=='function'||typeof root.Response!=='function')return null;
 const data=await new root.Response(new root.Blob([bytes]).stream().pipeThrough(new root.CompressionStream('gzip'))).arrayBuffer();
 const packed=new Uint8Array(data);
 return packed.length+128<bytes.length?packed:null;
}
async function gunzip(bytes){
 if(typeof root.DecompressionStream!=='function'||typeof root.Blob!=='function')throw Error('archive_codec_unavailable');
 const reader=new root.Blob([bytes]).stream().pipeThrough(new root.DecompressionStream('gzip')).getReader();
 const chunks=[];let length=0;
 try{
  while(true){
   const {value,done}=await reader.read();if(done)break;
   length+=value.length;
   if(length>MAX_BYTES){await reader.cancel().catch(()=>{});throw Error('archive_too_large');}
   chunks.push(value);
  }
 }catch(e){if(e.message==='archive_too_large')throw e;throw Error('invalid_archive');}
 const result=new Uint8Array(length);let offset=0;
 for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}
 return result;
}
async function encrypt(payload,recoveryCode){
 let json;try{json=JSON.stringify(payload);}catch(_){throw Error('invalid_archive');}
 if(typeof json!=='string')throw Error('invalid_archive');
 const original=utf8(json);
 if(original.length>MAX_BYTES)throw Error('archive_too_large');
 const packed=await gzip(original),codec=packed?'gzip':'none',bytes=packed||original;
 const salt=root.crypto.getRandomValues(new Uint8Array(16)),iv=root.crypto.getRandomValues(new Uint8Array(12));
 const key=await derive(recoveryCode,salt);
 const cipher=await root.crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:utf8(FORMAT+':'+VERSION+':'+codec),tagLength:128},key,bytes);
 const box=JSON.stringify({format:FORMAT,version:VERSION,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,
  cipher:'AES-256-GCM',codec,plainBytes:original.length,salt:bytesToB64(salt),
  iv:bytesToB64(iv),ciphertext:bytesToB64(new Uint8Array(cipher)),createdAt:new Date().toISOString()});
 if(byteLength(box)>MAX_ARCHIVE_BYTES)throw Error('archive_too_large');
 return box;
}
async function decrypt(text,recoveryCode){
 if(typeof text!=='string'||byteLength(text)>MAX_ARCHIVE_BYTES)throw Error('archive_too_large');
 let box;try{box=JSON.parse(text.replace(/^\uFEFF/,''));}catch(_){throw Error('invalid_archive');}
 if(box?.format!==FORMAT||![1,VERSION].includes(box.version)||box.kdf!=='PBKDF2-SHA256'||
    box.iterations!==ITERATIONS||box.cipher!=='AES-256-GCM')throw Error('unsupported_archive');
 const old=box.version===1,codec=old?'none':box.codec;
 if(!['none','gzip'].includes(codec)||(!old&&(!Number.isSafeInteger(box.plainBytes)||
    box.plainBytes<0||box.plainBytes>MAX_BYTES)))throw Error('invalid_archive');
 let bytes;
 try{
  const salt=b64ToBytes(box.salt,16),iv=b64ToBytes(box.iv,12),
   ciphertext=b64ToBytes(box.ciphertext,MAX_BYTES+32);
  if(salt.length!==16||iv.length!==12||ciphertext.length<16)throw Error('invalid_archive');
  const key=await derive(recoveryCode,salt);
  const plain=await root.crypto.subtle.decrypt({name:'AES-GCM',iv,
   additionalData:utf8(FORMAT+':'+box.version+(old?'':':'+codec)),tagLength:128},key,ciphertext);
  bytes=new Uint8Array(plain);
 }catch(e){
  if(e?.message==='invalid_recovery_code'||e?.message==='archive_too_large')throw e;
  throw Error('wrong_key_or_damaged_archive');
 }
 if(old&&bytes.length>LEGACY_MAX_BYTES)throw Error('archive_too_large');
 if(!old){bytes=codec==='gzip'?await gunzip(bytes):bytes;
  if(bytes.length!==box.plainBytes)throw Error('invalid_archive');
 }
 if(bytes.length>MAX_BYTES)throw Error('archive_too_large');
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch(_){throw Error('invalid_archive');}
}
function isArchive(text){try{return JSON.parse(String(text)).format===FORMAT;}catch(_){return false;}}
root.TrialumEncryptedArchive={FORMAT,VERSION,ITERATIONS,MAX_BYTES,MAX_ARCHIVE_BYTES,
 LEGACY_MAX_BYTES,randomRecoveryCode,encrypt,decrypt,isArchive};
if(typeof module==='object'&&module.exports)module.exports=root.TrialumEncryptedArchive;
})(typeof globalThis!=='undefined'?globalThis:this);
