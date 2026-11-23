import { randomBytes, createHash } from 'node:crypto';
import { validNickname } from './contracts.mjs';
import {registerWithRecovery,issueRecoveryKit,restoreAccount,recoveryReady,isProfile,isSecret}
 from './account-recovery.mjs';

// Private beta: consent-based friends only; no chat, pet data, rewards or billing.
// Public access requires separate HTTPS and edge-rate-limit/security approval.
const TTL_MS = 15 * 60 * 1000;
const RATE_MS = 15 * 60 * 1000;
const buckets = new Map();
const sha256 = text => createHash('sha256').update(text, 'utf8').digest();
const tokenValid = x => typeof x === 'string' && /^[A-Za-z0-9_-]{43}$/.test(x);
const uuidValid = x => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const bodyError = message => Object.assign(new Error(message), { status: 400 });
function limit(key, max) {
  const now = Date.now();
  if (buckets.size > 20000) {
    for (const [k, v] of buckets) if (v.until < now) buckets.delete(k);
  }
  const v = buckets.get(key);
  if (!v || v.until < now) { buckets.set(key, { n: 1, until: now + RATE_MS }); return; }
  v.n++;
  if (v.n > max) throw Object.assign(new Error('rate_limited'), { status: 429 });
}
async function jsonBody(req,maxBytes=1024) {
  const contentType = (req.headers['content-type'] || '').split(';')[0].toLowerCase();
  if (contentType !== 'application/json') throw bodyError('json_required');
  let raw = '';
  for await (const chunk of req) {
    raw += chunk.toString('utf8');
    if (raw.length > maxBytes) throw Object.assign(new Error('too_large'), {status: 413});
  }
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw Error();
    return obj;
  } catch (_) { throw bodyError('invalid_json'); }
}
function json(res, code, value) {
  res.writeHead(code, {
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store', 'x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer', 'x-frame-options':'DENY',
    'content-security-policy':"default-src 'none'"
  });
  res.end(JSON.stringify(value));
}
async function authenticate(req, pool) {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization || '');
  if (!match) throw Object.assign(new Error('authentication_required'), { status: 401 });
  const q = await pool.query('SELECT id,nickname FROM installations WHERE credential_hash=$1 AND revoked_at IS NULL',[sha256(match[1])]);
  if (!q.rowCount) throw Object.assign(new Error('authentication_required'), { status: 401 });
  return q.rows[0];
}
async function blocked(pool, a, b) {
  const q = await pool.query('SELECT 1 FROM friend_blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1) LIMIT 1',[a,b]);
  return q.rowCount > 0;
}
function ordered(a,b) { return a < b ? [a,b] : [b,a]; }
export async function socialRequest(req, res, pool, signal=()=>{}) {
  const path = (req.url || '').split('?')[0];
  if (!path.startsWith('/v1/social/')) return false;
  try {
    // The packaged Android WebView runs at a known origin; never reflect arbitrary Origin.
    const allowed = process.env.SOCIAL_CORS_ORIGIN || 'https://appassets.androidplatform.net';
    const origin = req.headers.origin;
    if (origin && origin !== allowed) { json(res,403,{error:'origin_not_allowed'}); return true; }
    if (origin === allowed) {
      res.setHeader('access-control-allow-origin',allowed);
      res.setHeader('vary','Origin');
      res.setHeader('access-control-allow-methods','GET,POST,DELETE,OPTIONS');
      res.setHeader('access-control-allow-headers','authorization, content-type');
      res.setHeader('access-control-max-age','600');
    }
    if (!pool) { json(res,503,{error:'social_service_disabled'}); return true; }
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return true; }
    if (!['GET','POST','DELETE'].includes(req.method)) { json(res,405,{error:'method_not_allowed'}); return true; }
    if (path === '/v1/social/register' && req.method === 'POST') {
      limit('register:' + req.socket.remoteAddress, 6);
      const data = await jsonBody(req);
      if (!validNickname(data.nickname)) throw bodyError('invalid_nickname');
      const name=data.nickname.trim();
      const created=await registerWithRecovery(pool,name);
      json(res,201,created);
      return true;
    }
    if (path === '/v1/social/status' && req.method==='GET') {
      const present=await pool.query(
        "SELECT to_regclass('public.social_account_recovery') AS table_name");
      json(res,200,{ready:true,mode:'private_beta',
        accountRecoveryEnabled:recoveryReady()&&!!present.rows[0]?.table_name,
        recoveryVersion:1});return true;
    }
    // Unauthenticated restore happens BEFORE bearer-token authentication.
    // Account ID alone is never sufficient. No one can change an ID.
    if(path==='/v1/social/recovery/restore'&&req.method==='POST'){
      limit('recover-ip:'+req.socket.remoteAddress,8);
      const input=await jsonBody(req,1024);
      // Check every public candidate with a bounded rate limiter to prevent
      // distributed guessing. Edge/WAF rate limits are ALSO mandatory.
      const bucket=typeof input.id==='string'&&input.id.length<=40?input.id:'invalid';
      limit('recover-id:'+bucket,20);
      const recovered=await restoreAccount(pool,{
        id:input.id,recoveryKey:input.recoveryKey,nextRecoveryKey:input.nextRecoveryKey
      });
      signal({type:'account_recovered',targetId:recovered.id});
      json(res,200,recovered);return true;
    }
    const me=await authenticate(req,pool);
    limit('actor:'+me.id,120);
    if (path === '/v1/social/me' && req.method==='GET') {json(res,200,{id:me.id,nickname:me.nickname});return true;}
    if(path==='/v1/social/recovery/issue'&&req.method==='POST'){
      // A deliberate action by the already-authenticated profile, never GET.
      limit('recovery-issue:'+me.id,4);
      const input=await jsonBody(req,256);
      if(input.confirm!==true)throw bodyError('confirmation_required');
      const kit=await issueRecoveryKit(pool,me.id);
      json(res,200,kit);return true;
    }
    if (path === '/v1/social/account' && req.method==='DELETE') {
      const conn=await pool.connect();
      try {
        await conn.query('BEGIN');
        const right=await conn.query("SELECT has_table_privilege(current_user,'playgrounds','DELETE') AS allowed");
        if(right.rows[0].allowed) {
          // Remove personal history from shared rooms when identity is erased.
          await conn.query('DELETE FROM playground_events WHERE actor_id=$1',[me.id]);
          // Deletion is an explicit user request. No orphaned owned groups/pets/events.
          await conn.query(`DELETE FROM playgrounds WHERE id IN
            (SELECT playground_id FROM playground_members WHERE installation_id=$1 AND role='owner')`,[me.id]);
        }
        await conn.query('DELETE FROM installations WHERE id=$1',[me.id]);
        await conn.query('COMMIT');
      } catch(e){await conn.query('ROLLBACK').catch(()=>{});throw e;}finally{conn.release();}
      json(res,200,{deleted:true});return true;
    }
    if (path === '/v1/social/invites' && req.method==='DELETE') {
      await pool.query('DELETE FROM invitations WHERE inviter_id=$1 AND consumed_at IS NULL',[me.id]);
      json(res,200,{revoked:true});return true;
    }
    if (path === '/v1/social/invites' && req.method==='POST') {
      limit('invite:'+me.id,12);
      const secret=randomBytes(32).toString('base64url'), expiresAt=new Date(Date.now()+TTL_MS);
      await pool.query('DELETE FROM invitations WHERE inviter_id=$1 AND consumed_at IS NULL',[me.id]);
      await pool.query('INSERT INTO invitations(token_hash,inviter_id,expires_at) VALUES($1,$2,$3)',[sha256(secret),me.id,expiresAt]);
      json(res,201,{code:secret,expiresAt:expiresAt.toISOString(),inviter:{id:me.id,nickname:me.nickname}});
      return true;
    }
    if (path === '/v1/social/invites/preview' && req.method==='POST') {
      limit('preview:'+me.id,25);
      const {code}=await jsonBody(req);
      if (!tokenValid(code)) throw bodyError('invalid_invite');
      const q=await pool.query(
        'SELECT i.inviter_id,i.expires_at,p.nickname FROM invitations i JOIN installations p ON p.id=i.inviter_id WHERE i.token_hash=$1 AND i.consumed_at IS NULL AND i.expires_at>now() AND p.revoked_at IS NULL',[sha256(code)]);
      if (!q.rowCount) {json(res,404,{error:'invite_invalid_or_expired'});return true;}
      const v=q.rows[0];
      if (v.inviter_id===me.id) {json(res,409,{error:'self_invitation'});return true;}
      if (await blocked(pool,me.id,v.inviter_id)) {json(res,403,{error:'blocked'});return true;}
      json(res,200,{inviter:{id:v.inviter_id,nickname:v.nickname},expiresAt:v.expires_at});return true;
    }
    if (path === '/v1/social/invites/accept' && req.method==='POST') {
      limit('accept:'+me.id,20);
      const {code}=await jsonBody(req);
      if (!tokenValid(code)) throw bodyError('invalid_invite');
      const conn=await pool.connect();
      try {
        await conn.query('BEGIN');
        const q=await conn.query('SELECT i.inviter_id,p.nickname FROM invitations i JOIN installations p ON p.id=i.inviter_id WHERE i.token_hash=$1 AND i.consumed_at IS NULL AND i.expires_at>now() AND p.revoked_at IS NULL FOR UPDATE OF i',[sha256(code)]);
        if (!q.rowCount) {await conn.query('ROLLBACK');json(res,404,{error:'invite_invalid_or_expired'});return true;}
        const inviter=q.rows[0];
        if(inviter.inviter_id===me.id) {await conn.query('ROLLBACK');json(res,409,{error:'self_invitation'});return true;}
        const [a,b]=ordered(me.id,inviter.inviter_id);
        await conn.query('SELECT pg_advisory_xact_lock(hashtextextended($1 || $2, 0))',[a,b]);
        const lock=await conn.query('SELECT 1 FROM friend_blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1) LIMIT 1',[me.id,inviter.inviter_id]);
        if(lock.rowCount) {await conn.query('ROLLBACK');json(res,403,{error:'blocked'});return true;}
        await conn.query('INSERT INTO friendships(player_a,player_b,blocked_at) VALUES($1,$2,NULL) ON CONFLICT(player_a,player_b) DO UPDATE SET blocked_at=NULL',[a,b]);
        await conn.query('UPDATE invitations SET consumed_at=now() WHERE token_hash=$1',[sha256(code)]);
        await conn.query('COMMIT');
        signal({type:'friend_joined',targetId:inviter.inviter_id,actorId:me.id});
        json(res,200,{friend:{id:inviter.inviter_id,nickname:inviter.nickname},accepted:true});
        return true;
      }catch(e){await conn.query('ROLLBACK').catch(()=>{});throw e;}finally{conn.release();}
    }
    if (path === '/v1/social/friends' && req.method==='GET') {
      const q=await pool.query(
        'SELECT p.id,p.nickname,f.accepted_at FROM friendships f JOIN installations p ON p.id=CASE WHEN f.player_a=$1 THEN f.player_b ELSE f.player_a END WHERE (f.player_a=$1 OR f.player_b=$1) AND f.blocked_at IS NULL AND p.revoked_at IS NULL AND NOT EXISTS(SELECT 1 FROM friend_blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=p.id) OR (b.blocker_id=p.id AND b.blocked_id=$1)) ORDER BY f.accepted_at DESC LIMIT 100',
        [me.id]);
      json(res,200,{friends:q.rows});return true;
    }
    const match=/^\/v1\/social\/friends\/([0-9a-f-]+)(\/block)?$/i.exec(path);
    if (match && uuidValid(match[1]) && req.method==='DELETE' && !match[2]) {
      const [a,b]=ordered(me.id,match[1]);
      const conn=await pool.connect();
      try {
        await conn.query('BEGIN');
        await conn.query('SELECT pg_advisory_xact_lock(hashtextextended($1 || $2, 0))',[a,b]);
        await conn.query('DELETE FROM friendships WHERE player_a=$1 AND player_b=$2',[a,b]);
        const right=await conn.query("SELECT has_table_privilege(current_user,'playground_members','DELETE') AS allowed");
        if(right.rows[0].allowed){
          if(process.env.PRESENCE_ENABLED==='true'){
            // Same friendship authorization scope as membership/visit revocation.
            await conn.query(`DELETE FROM pet_presence WHERE visit_id IN
              (SELECT id FROM visits WHERE
                ((sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1))
                AND status IN ('pending','accepted'))`,[me.id,match[1]]);
            await conn.query(`DELETE FROM pet_presence WHERE
              (installation_id=$1 AND room_id IN
                (SELECT playground_id FROM playground_members WHERE installation_id=$2 AND role='owner'))
              OR (installation_id=$2 AND room_id IN
                (SELECT playground_id FROM playground_members WHERE installation_id=$1 AND role='owner'))`,[me.id,match[1]]);
          }
          await conn.query(`DELETE FROM playground_activities WHERE
            (installation_id=$1 AND playground_id IN
              (SELECT playground_id FROM playground_members WHERE installation_id=$2 AND role='owner'))
            OR (installation_id=$2 AND playground_id IN
              (SELECT playground_id FROM playground_members WHERE installation_id=$1 AND role='owner'))`,[me.id,match[1]]);
          await conn.query(`DELETE FROM playground_members WHERE
            (installation_id=$1 AND playground_id IN
              (SELECT playground_id FROM playground_members WHERE installation_id=$2 AND role='owner'))
            OR (installation_id=$2 AND playground_id IN
              (SELECT playground_id FROM playground_members WHERE installation_id=$1 AND role='owner'))`,[me.id,match[1]]);
          await conn.query('DELETE FROM playground_events WHERE actor_id=$1 AND playground_id IN (SELECT playground_id FROM playground_members WHERE installation_id=$2)',[match[1],me.id]);
          await conn.query('DELETE FROM playground_events WHERE actor_id=$2 AND playground_id IN (SELECT playground_id FROM playground_members WHERE installation_id=$1)',[match[1],me.id]);
          await conn.query(`UPDATE visits SET status='returned',ended_at=now(),pet_public='{}'::jsonb
            WHERE ((sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1))
             AND status IN ('pending','accepted')`,[me.id,match[1]]);
        }
                const messages=await conn.query("SELECT to_regclass('public.message_cards') AS available");
        if(messages.rows[0].available){
          await conn.query('DELETE FROM message_cards WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)',[me.id,match[1]]);
          await conn.query('DELETE FROM event_cards WHERE (receiver_id=$1 AND actor_id=$2) OR (receiver_id=$2 AND actor_id=$1)',[me.id,match[1]]);
          await conn.query('DELETE FROM friend_mutes WHERE (owner_id=$1 AND other_id=$2) OR (owner_id=$2 AND other_id=$1)',[me.id,match[1]]);
        }
        await conn.query('COMMIT');
      }catch(e){await conn.query('ROLLBACK').catch(()=>{});throw e;}finally{conn.release();}
      json(res,200,{removed:true});return true;
    }
    if (match && uuidValid(match[1]) && req.method==='POST' && match[2]) {
      if(match[1]===me.id) throw bodyError('cannot_block_self');
      const conn=await pool.connect();
      try {
        await conn.query('BEGIN');
        const [a,b]=ordered(me.id,match[1]);
        await conn.query('SELECT pg_advisory_xact_lock(hashtextextended($1 || $2, 0))',[a,b]);
        await conn.query('INSERT INTO friend_blocks(blocker_id,blocked_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[me.id,match[1]]);
        await conn.query('DELETE FROM friendships WHERE player_a=$1 AND player_b=$2',[a,b]);
        const right=await conn.query("SELECT has_table_privilege(current_user,'playground_members','DELETE') AS allowed");
        if(right.rows[0].allowed){
          if(process.env.PRESENCE_ENABLED==='true'){
            // Same friendship authorization scope as membership/visit revocation.
            await conn.query(`DELETE FROM pet_presence WHERE visit_id IN
              (SELECT id FROM visits WHERE
                ((sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1))
                AND status IN ('pending','accepted'))`,[me.id,match[1]]);
            await conn.query(`DELETE FROM pet_presence WHERE
              (installation_id=$1 AND room_id IN
                (SELECT playground_id FROM playground_members WHERE installation_id=$2 AND role='owner'))
              OR (installation_id=$2 AND room_id IN
                (SELECT playground_id FROM playground_members WHERE installation_id=$1 AND role='owner'))`,[me.id,match[1]]);
          }
          await conn.query(`DELETE FROM playground_activities WHERE
            (installation_id=$1 AND playground_id IN
              (SELECT playground_id FROM playground_members WHERE installation_id=$2 AND role='owner'))
            OR (installation_id=$2 AND playground_id IN
              (SELECT playground_id FROM playground_members WHERE installation_id=$1 AND role='owner'))`,[me.id,match[1]]);
          await conn.query(`DELETE FROM playground_members WHERE
            (installation_id=$1 AND playground_id IN
              (SELECT playground_id FROM playground_members WHERE installation_id=$2 AND role='owner'))
            OR (installation_id=$2 AND playground_id IN
              (SELECT playground_id FROM playground_members WHERE installation_id=$1 AND role='owner'))`,[me.id,match[1]]);
          await conn.query('DELETE FROM playground_events WHERE actor_id=$1 AND playground_id IN (SELECT playground_id FROM playground_members WHERE installation_id=$2)',[match[1],me.id]);
          await conn.query('DELETE FROM playground_events WHERE actor_id=$2 AND playground_id IN (SELECT playground_id FROM playground_members WHERE installation_id=$1)',[match[1],me.id]);
          await conn.query(`UPDATE visits SET status='returned',ended_at=now(),pet_public='{}'::jsonb
            WHERE ((sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1))
             AND status IN ('pending','accepted')`,[me.id,match[1]]);
        }
                const messages=await conn.query("SELECT to_regclass('public.message_cards') AS available");
        if(messages.rows[0].available){
          await conn.query('DELETE FROM message_cards WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)',[me.id,match[1]]);
          await conn.query('DELETE FROM event_cards WHERE (receiver_id=$1 AND actor_id=$2) OR (receiver_id=$2 AND actor_id=$1)',[me.id,match[1]]);
          await conn.query('DELETE FROM friend_mutes WHERE (owner_id=$1 AND other_id=$2) OR (owner_id=$2 AND other_id=$1)',[me.id,match[1]]);
        }
        await conn.query('COMMIT');
        json(res,200,{blocked:true});return true;
      }catch(e){await conn.query('ROLLBACK').catch(()=>{});throw e;}finally{conn.release();}
    }
    json(res,404,{error:'not_found'});return true;
  }catch(error){
    if(res.headersSent)return true;
    const code=Number.isInteger(error.status)?error.status:500;
    if(code===500)console.error('social_internal',path,String(error.code||error.name||'error').slice(0,20));
    json(res,code,{error:code===500?'internal_error':error.message});
    return true;
  }
}

export {authenticate,blocked,jsonBody,json,ordered,limit,uuidValid};
