/* Account recovery test against EXCLUSIVELY ephemeral localhost PostgreSQL.
 * Reuses server identity; verifies friends, room ownership, balance persistence,
 * access revocation, one-time key rotation and permanent deletion.
 */
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {Pool} from 'pg';
import WebSocket from 'ws';
const host=process.env.TRIALUM_SHARED_BASE||'';
const url=process.env.TRIALUM_TEST_DATABASE_URL||'';
if(!host.startsWith('http://127.0.0.1:')||!/^(postgres|postgresql):\/\//.test(url))
 throw Error('recovery test must use disposable localhost DB and API only');
const db=new Pool({connectionString:url});
const secret=()=>randomBytes(32).toString('base64url');
async function request(path,method='GET',body,token){
 const response=await fetch(host+'/v1/social/'+path,{
  method,headers:{...(body?{'content-type':'application/json'}:{}),
   ...(token?{authorization:'Bearer '+token}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 return {status:response.status,data:await response.json().catch(()=>({}))};
}
const expected=(r,status,name)=>assert.equal(r.status,status,name+': '+JSON.stringify(
 {status:r.status,error:r.data.error}));
const digest=x=>createHash('sha256').update(x).digest();
try{
 const state=await request('status');expected(state,200,'status');
 assert.equal(state.data.accountRecoveryEnabled,true);
 const a=await request('register','POST',{nickname:'RecoveryOwner'});expected(a,201,'register owner');
 const owner=a.data;
 assert.match(owner.id,/^[0-9a-f-]{36}$/);
 assert.match(owner.recoveryKey,/^[A-Za-z0-9_-]{43}$/);
 assert.match(owner.credential,/^[A-Za-z0-9_-]{43}$/);
 const b=await request('register','POST',{nickname:'RecoveryFriend'});expected(b,201,'register friend');
 const friend=b.data;
 const dbRecovery=await db.query('SELECT secret_verifier FROM social_account_recovery WHERE installation_id=$1',[owner.id]);
 assert.equal(dbRecovery.rowCount,1);
 assert.equal(dbRecovery.rows[0].secret_verifier.length,32);
 assert(!dbRecovery.rows[0].secret_verifier.equals(digest(owner.recoveryKey)),
  'HMAC pepper prevents plain SHA-of-key verifier theft');
 const invite=await request('invites','POST',{},owner.credential);expected(invite,201,'invite');
 expected(await request('invites/accept','POST',{code:invite.data.code},friend.credential),200,'friendship');
 const friendsBefore=await request('friends','GET',null,owner.credential);
 expected(friendsBefore,200,'friends before');
 assert(friendsBefore.data.friends.some(f=>f.id===friend.id));
 const created=await fetch(host+'/v1/shared/rooms',{
  method:'POST',headers:{authorization:'Bearer '+owner.credential,'content-type':'application/json'},
  body:JSON.stringify({title:'Recovery test room'})});
 assert.equal(created.status,201);
 const room=(await created.json()).room.id;
 await db.query('UPDATE shared_playground_state SET points=77 WHERE playground_id=$1',[room]);
 // Same error is returned for unknown and bad keys: no account enumeration.
 const wrong=await request('recovery/restore','POST',{
  id:owner.id,recoveryKey:secret(),nextRecoveryKey:secret()
 });expected(wrong,401,'wrong secret');
 const missing=await request('recovery/restore','POST',{
  id:'00000000-0000-4000-8000-000000000099',recoveryKey:secret(),nextRecoveryKey:secret()
 });expected(missing,401,'unknown account');
 assert.equal(wrong.data.error,missing.data.error);
 // New key is generated and saved by user BEFORE server rotation.
 // An authenticated old device's WS must be explicitly terminated when the
 // identity rotates, not merely denied the next HTTP API request.
 const ws=new WebSocket(host.replace(/^http:/,'ws:')+'/v1/social/live',{
   headers:{Origin:'https://appassets.androidplatform.net'}
 });
 const opened=new Promise((resolve,reject)=>{
   ws.once('open',resolve);ws.once('error',reject);
   setTimeout(()=>reject(Error('old socket connect timed out')),4000);
 });
 await opened;
 const ready=new Promise((resolve,reject)=>{
   ws.on('message',bytes=>{
    const v=JSON.parse(bytes.toString('utf8'));
    if(v.type==='ready')resolve(v);
    if(v.type==='error')reject(Error(v.error));
   });
   setTimeout(()=>reject(Error('old socket auth timed out')),4000);
 });
 ws.send(JSON.stringify({type:'auth',credential:owner.credential}));
 await ready;
 const closed=new Promise((resolve,reject)=>{
   ws.once('close',(code,reason)=>resolve({code,reason:String(reason)}));
   setTimeout(()=>reject(Error('stale authenticated WSS was NOT revoked')),4000);
 });
 const next=secret(),recover=await request('recovery/restore','POST',{
  id:owner.id,recoveryKey:owner.recoveryKey,nextRecoveryKey:next
 });
 expected(recover,200,'recovery');
 const close=await closed;
 assert.equal(close.code,1008,'old socket invalidated after recovery');
 assert.equal(close.reason,'session_revoked');
 assert.equal(recover.data.id,owner.id,'stable social ID');
 assert.notEqual(recover.data.credential,owner.credential,'rotated bearer');
 assert.equal(recover.data.recoveryKitRotated,true);
 expected(await request('me','GET',null,owner.credential),401,'old session revoked');
 const who=await request('me','GET',null,recover.data.credential);
 expected(who,200,'new session');
 assert.equal(who.data.id,owner.id);
 const restoredFriends=await request('friends','GET',null,recover.data.credential);
 expected(restoredFriends,200,'restored friends');
 assert(restoredFriends.data.friends.some(f=>f.id===friend.id));
 const roomResponse=await fetch(host+'/v1/shared/rooms/'+room+'/snapshot',{
  headers:{authorization:'Bearer '+recover.data.credential}});
 assert.equal(roomResponse.status,200,'shared room owner persisted');
 const snap=await roomResponse.json();
 assert.equal(snap.room.role,'owner');
 assert.equal(snap.sharedCredits,77,'original room balance');
 const replay=await request('recovery/restore','POST',{
  id:owner.id,recoveryKey:owner.recoveryKey,nextRecoveryKey:secret()
 });expected(replay,401,'old recovery key revoked');
 const currentKey=secret(),second=await request('recovery/restore','POST',{
  id:owner.id,recoveryKey:next,nextRecoveryKey:currentKey
 });expected(second,200,'new kit supports later recovery');
 expected(await request('me','GET',null,recover.data.credential),401,'first recovered bearer revoked');
 // Existing accounts with a valid credential can rotate lost recovery kits.
 const issued=await request('recovery/issue','POST',{confirm:true},second.data.credential);
 expected(issued,200,'issue new kit');
 assert.equal(issued.data.id,owner.id);
 assert.notEqual(issued.data.recoveryKey,currentKey);
 const invalidated=await request('recovery/restore','POST',{
  id:owner.id,recoveryKey:currentKey,nextRecoveryKey:secret()
 });expected(invalidated,401,'reissued kit invalidates prior');
 expected(await request('me','GET',null,second.data.credential),200,'kit issue preserves current login');
 // Deletion purges recovery verifier and makes previous secrets useless forever.
 expected(await request('account','DELETE',null,second.data.credential),200,'delete');
 const gone=await db.query('SELECT 1 FROM social_account_recovery WHERE installation_id=$1',[owner.id]);
 assert.equal(gone.rowCount,0,'cascading deletion of verifier');
 expected(await request('recovery/restore','POST',{
  id:owner.id,recoveryKey:issued.data.recoveryKey,nextRecoveryKey:secret()
 }),401,'cannot recover deleted account');
 console.log('PASS V44 RECOVERY: server-owned ID, one-time 256-bit kit, atomic bearer and key rotation, friends, room credits, deletion and non-enumeration');
}finally{await db.end();}
