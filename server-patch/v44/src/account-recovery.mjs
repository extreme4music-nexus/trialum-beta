/* Trialum 1.4 v44 account recovery — no raw keys at rest, no account enumeration.
 * Social server and database remain the authority; JSON world backups never
 * contain credentials or identity-recovery secrets.
 * NOTE: ID + recovery key is strong bearer recovery, NOT standalone MFA.
 */
import {createHmac,randomBytes,timingSafeEqual,createHash} from 'node:crypto';

const SECRET_FORMAT=/^[A-Za-z0-9_-]{43}$/;
const PROFILE_FORMAT=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DUMMY=Buffer.from('a727d6b3b827aa60e6355d6f0fcd254015842504cd4535a8e2f224f1f928e96a','hex');
const unauthorized=()=>Object.assign(new Error('recovery_unavailable_or_invalid'),{status:401});
const unavailable=()=>Object.assign(new Error('recovery_unavailable'),{status:503});
export const randomSecret=()=>randomBytes(32).toString('base64url');
export const isSecret=x=>typeof x==='string'&&SECRET_FORMAT.test(x)&&
  Buffer.from(x,'base64url').length===32;
export const isProfile=x=>typeof x==='string'&&PROFILE_FORMAT.test(x);
const sha=x=>createHash('sha256').update(x,'utf8').digest();

function pepper(){
 const raw=process.env.SOCIAL_RECOVERY_PEPPER_B64||'';
 if(!isSecret(raw))throw unavailable();
 return Buffer.from(raw,'base64url');
}
export const recoveryReady=()=>{try{pepper();return true;}catch(_){return false;}};
export function verifier(secret){
 if(!isSecret(secret))throw unauthorized();
 return createHmac('sha256',pepper()).update(secret,'utf8').digest();
}
function verifyGiven(stored,submitted){
 let verified=false;
 const sample=isSecret(submitted)?verifier(submitted):DUMMY;
 if(Buffer.isBuffer(stored)&&stored.length===32)
  verified=timingSafeEqual(stored,sample);
 else timingSafeEqual(DUMMY,sample);
 return verified;
}
export async function registerWithRecovery(pool,nickname){
 if(!recoveryReady())throw unavailable();
 const credential=randomSecret(),recoveryKey=randomSecret();
 const conn=await pool.connect();
 try{
  await conn.query('BEGIN');
  const inserted=await conn.query(
   'INSERT INTO installations(nickname,credential_hash) VALUES($1,$2) RETURNING id',
   [nickname,sha(credential)]);
  const id=inserted.rows[0].id;
  await conn.query(
   'INSERT INTO social_account_recovery(installation_id,secret_verifier) VALUES($1,$2)',
   [id,verifier(recoveryKey)]);
  await conn.query('COMMIT');
  return {id,nickname,credential,recoveryKey,recoveryKitVersion:1};
 }catch(e){await conn.query('ROLLBACK').catch(()=>{});throw e;}
 finally{conn.release();}
}
// For pre-v44 social profiles with a valid old device credential.
// Also lets a current authenticated user regenerate a misplaced recovery key.
export async function issueRecoveryKit(pool,profileId){
 if(!recoveryReady())throw unavailable();
 if(!isProfile(profileId))throw unauthorized();
 const recoveryKey=randomSecret(),hash=verifier(recoveryKey);
 const conn=await pool.connect();
 try{
  await conn.query('BEGIN');
  const alive=await conn.query(
   'SELECT id FROM installations WHERE id=$1 AND revoked_at IS NULL FOR UPDATE',[profileId]);
  if(!alive.rowCount)throw unauthorized();
  await conn.query(`INSERT INTO social_account_recovery
     (installation_id,secret_verifier,failed_attempts,locked_until,rotated_at)
     VALUES($1,$2,0,NULL,now())
     ON CONFLICT (installation_id) DO UPDATE SET secret_verifier=EXCLUDED.secret_verifier,
       failed_attempts=0,locked_until=NULL,rotated_at=now()`,[profileId,hash]);
  await conn.query('COMMIT');
  return {id:profileId,recoveryKey,recoveryKitVersion:1};
 }catch(e){await conn.query('ROLLBACK').catch(()=>{});throw e;}
 finally{conn.release();}
}
// Caller MUST generate and present nextRecoveryKey *before* this endpoint is
// called, so any lost HTTP response does not strand the new owner.
// After success the previous device bearer AND the old recovery key die.
export async function restoreAccount(pool,{id,recoveryKey,nextRecoveryKey}){
 if(!recoveryReady())throw unavailable();
 if(!isProfile(id)||!isSecret(recoveryKey)||!isSecret(nextRecoveryKey)
   ||recoveryKey===nextRecoveryKey)throw unauthorized();
 // Always do the same HMAC operation before DB lookup. Public IDs must not
 // disclose whether an account exists through distinct HTTP error bodies.
 const supplied=verifier(recoveryKey);
 const newVerifier=verifier(nextRecoveryKey);
 const newCredential=randomSecret();
 const conn=await pool.connect();
 let result=null,failed=false;
 try{
  await conn.query('BEGIN');
  const q=await conn.query(`SELECT i.id,i.nickname,r.secret_verifier,r.failed_attempts,r.locked_until
   FROM installations i LEFT JOIN social_account_recovery r ON r.installation_id=i.id
   WHERE i.id=$1 AND i.revoked_at IS NULL FOR UPDATE OF i`,[id]);
  const row=q.rows[0];
  const hash=Buffer.isBuffer(row?.secret_verifier)?row.secret_verifier:DUMMY;
  const equal=timingSafeEqual(hash,supplied);
  const locked=!!(row?.locked_until&&new Date(row.locked_until)>new Date());
  if(!row||!row.secret_verifier||!equal||locked){
   failed=true;
   if(row?.secret_verifier&&!locked){
    await conn.query(`UPDATE social_account_recovery SET
      failed_attempts=LEAST(100,failed_attempts+1),
      locked_until=CASE WHEN failed_attempts+1>=12 THEN now()+interval '15 minutes'
        ELSE locked_until END WHERE installation_id=$1`,[id]);
   }
  }else{
   await conn.query('UPDATE installations SET credential_hash=$2 WHERE id=$1',
     [id,sha(newCredential)]);
   await conn.query(`UPDATE social_account_recovery SET secret_verifier=$2,
      failed_attempts=0,locked_until=NULL,rotated_at=now()
      WHERE installation_id=$1`,[id,newVerifier]);
   // Old device notifications must not continue after ownership moves.
   await conn.query('DELETE FROM push_registrations WHERE installation_id=$1',[id]);
   // Presence can be cleared if the presence migration is installed, and must
   // be disabled at active sockets by a session-revocation event.
   const presence=await conn.query(`SELECT to_regclass('public.pet_presence') AS table_name`);
   if(presence.rows[0]?.table_name)
    await conn.query('DELETE FROM pet_presence WHERE installation_id=$1',[id]);
   result={id:row.id,nickname:row.nickname,credential:newCredential,
     recoveryKitRotated:true};
  }
  await conn.query('COMMIT');
 }catch(e){await conn.query('ROLLBACK').catch(()=>{});throw e;}
 finally{conn.release();}
 if(failed||!result)throw unauthorized();
 return result;
}
