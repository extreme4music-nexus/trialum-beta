
import {authenticate,blocked,jsonBody,json,ordered,limit,uuidValid} from './social.mjs';
import {translatorReady} from './speech-translation.mjs';
import {admitShared,admitVisit,release as releasePresence,releaseVisit,
 list as listPresence,assertRoomPet,renew as renewPresence,occupants as roomOccupants,
 removeMember as removeMemberPresence,uuid as validPresenceSession} from './presence.mjs';

// D is a separately disabled, strictly authenticated opt-in social capability.
// Never accept client XP/tokens/level as a shared-currency source.
// 14-item owner-curated community shop. Shared credits are server-earned
// playground effort units, NEVER the player's personal earned credits.
const COST=Object.freeze({
 slide:8,pool:10,obstacle:12,trampoline:14,
 swing:10,carousel:12,tunnel:14,climbing:16,
 ballpit:18,puzzlewall:20,music:22,stargazer:26
});
const TOYS=['sandbox','seesaw',...Object.keys(COST)];
const SHOP=Object.freeze(TOYS.map(id=>({id,cost:COST[id]||0})));
const err=(status,message)=>{throw Object.assign(new Error(message),{status});};
const valid=uuidValid;
async function friend(db,a,b){
  const [x,y]=ordered(a,b);
  const q=await db.query(`SELECT 1 FROM friendships f WHERE player_a=$1 AND player_b=$2 AND blocked_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM friend_blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=$2) OR (b.blocker_id=$2 AND b.blocked_id=$1))`,[x,y]);
  return q.rowCount>0;
}
async function roomFor(db,id,actor,owner=false){
  if(!valid(id))err(400,'invalid_room');
  const q=await db.query(`SELECT p.id,p.title,p.tier,m.role,
  (SELECT installation_id FROM playground_members WHERE playground_id=p.id AND role='owner' LIMIT 1) AS owner_id
  FROM playgrounds p JOIN playground_members m ON m.playground_id=p.id AND m.installation_id=$2
  WHERE p.id=$1 AND p.retired_at IS NULL`,[id,actor]);
  if(!q.rowCount)err(403,'room_access_denied');
  const r=q.rows[0];
  if(owner&&r.role!=='owner')err(403,'owner_required');
  if(r.role!=='owner'&&(!r.owner_id||!await friend(db,r.owner_id,actor)))err(403,'friendship_required');
  return r;
}
async function transaction(pool,fn){
  const c=await pool.connect();
  try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r;}
  catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
function petView(p){
  if(!p||typeof p!=='object'||Array.isArray(p))err(400,'invalid_pet');
  if(Object.keys(p).some(k=>!['id','name','species','hue','eyes','shape','growth','seed'].includes(k)))err(400,'cosmetic_only');
  if(typeof p.id!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(p.id))err(400,'invalid_pet');
  if(typeof p.name!=='string'||p.name.trim().length<1||p.name.trim().length>32)err(400,'invalid_pet');
  if(!Number.isInteger(p.species)||p.species<0||p.species>15||
     !Number.isInteger(p.hue)||p.hue<0||p.hue>359||
     !Number.isInteger(p.eyes)||p.eyes<1||p.eyes>5||
     !Number.isInteger(p.growth)||p.growth<1||p.growth>100||
     !Number.isInteger(p.seed)||p.seed<0||p.seed>4294967295||
     !['jelly','cloud','leaf','crystal','blob','round','star'].includes(p.shape))err(400,'invalid_pet');
  return {id:p.id,name:p.name.trim(),species:p.species,hue:p.hue,eyes:p.eyes,shape:p.shape,growth:p.growth,seed:p.seed};
}
async function event(db,room,actor,kind,payload){
  await db.query('INSERT INTO playground_events(playground_id,actor_id,kind,payload) VALUES($1,$2,$3,$4::jsonb)',
   [room,actor,kind,JSON.stringify(payload)]);
}
async function snapshot(db,r,presenceEnabled=false){
  const [state,toys,members,events,visits]=await Promise.all([
    db.query('SELECT points,version FROM shared_playground_state WHERE playground_id=$1',[r.id]),
    db.query('SELECT toy_id,placed FROM playground_toys WHERE playground_id=$1 ORDER BY unlocked_at,toy_id',[r.id]),
    db.query(`SELECT p.id,p.nickname,m.role FROM playground_members m JOIN installations p ON p.id=m.installation_id
      WHERE m.playground_id=$1 AND p.revoked_at IS NULL ORDER BY m.role DESC,m.joined_at LIMIT 6`,[r.id]),
    db.query(`SELECT e.id,e.kind,e.payload,e.occurred_at,p.nickname FROM playground_events e
      LEFT JOIN installations p ON p.id=e.actor_id WHERE e.playground_id=$1 ORDER BY e.id DESC LIMIT 20`,[r.id]),
    db.query(`SELECT v.id,v.pet_public,v.sender_id,v.receiver_id,v.expires_at FROM visits v
      WHERE v.playground_id=$1 AND v.destination='playground' AND v.status='accepted' AND v.expires_at>now()
      AND EXISTS (SELECT 1 FROM playground_members m WHERE m.playground_id=$1 AND m.installation_id=v.sender_id)
      AND EXISTS (SELECT 1 FROM playground_members m WHERE m.playground_id=$1 AND m.installation_id=v.receiver_id)
      AND EXISTS (SELECT 1 FROM friendships f WHERE f.player_a=LEAST(v.sender_id,v.receiver_id)
        AND f.player_b=GREATEST(v.sender_id,v.receiver_id) AND f.blocked_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM friend_blocks b WHERE
        (b.blocker_id=v.sender_id AND b.blocked_id=v.receiver_id) OR
        (b.blocker_id=v.receiver_id AND b.blocked_id=v.sender_id))
      ORDER BY v.accepted_at DESC LIMIT 8`,[r.id])
  ]);
  const live=presenceEnabled?await roomOccupants(db,r.id):[];
  const acceptedLeases=presenceEnabled&&visits.rows.length
   ?await db.query("SELECT visit_id FROM pet_presence WHERE visit_id=ANY($1::uuid[]) AND expires_at>now()",[visits.rows.map(v=>v.id)]):null;
  const acceptedIds=new Set(acceptedLeases?.rows.map(x=>x.visit_id)||[]);
  return {room:{id:r.id,title:r.title,tier:r.tier,role:r.role,ownerId:r.owner_id},presenceEnabled,
   occupants:live,
   // Preserve 'points' for old clients; 'sharedCredits' is the separate
   // server-owned currency. Never transfer it to the private world balance.
   points:state.rows[0]?.points||0,sharedCredits:state.rows[0]?.points||0,
   version:String(state.rows[0]?.version||1),
   toys:toys.rows.filter(t=>t.placed!==false).map(t=>t.toy_id),
   ownedToys:toys.rows.map(t=>t.toy_id),
   members:members.rows,events:events.rows.reverse().map(e=>({id:String(e.id),kind:e.kind,payload:e.payload,actor:e.nickname||'Играч',at:e.occurred_at})),
   visitors:visits.rows.filter(v=>!presenceEnabled||acceptedIds.has(v.id))
    .map(v=>({id:v.id,pet:v.pet_public,senderId:v.sender_id,receiverId:v.receiver_id,until:v.expires_at}))};
}
function cors(req,res){
  const allowed=process.env.SOCIAL_CORS_ORIGIN||'https://appassets.androidplatform.net';
  const origin=req.headers.origin;
  if(origin&&origin!==allowed){json(res,403,{error:'origin_not_allowed'});return false;}
  if(origin===allowed){
    res.setHeader('access-control-allow-origin',allowed);res.setHeader('vary','Origin');
    res.setHeader('access-control-allow-methods','GET,POST,DELETE,OPTIONS');
    res.setHeader('access-control-allow-headers','authorization,content-type');
    res.setHeader('access-control-max-age','600');
  }
  return true;
}
export async function sharedRequest(req,res,pool,signal=()=>{},presenceEnabled=false){
  const path=(req.url||'').split('?')[0];
  if(!path.startsWith('/v1/shared/'))return false;
  try{
    if(!cors(req,res))return true;
    if(!pool){json(res,503,{error:'shared_disabled'});return true;}
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return true;}
    if(!['GET','POST','DELETE'].includes(req.method)){json(res,405,{error:'method_not_allowed'});return true;}
    const me=await authenticate(req,pool);
    // Polling snapshots are read-only; keep stricter per-actor mutation limits.
    limit((req.method==='GET'?'shared-read:':'shared-write:')+me.id,req.method==='GET'?1400:120);
    if(path==='/v1/shared/status'&&req.method==='GET'){
      await pool.query('SELECT 1 FROM shared_playground_state LIMIT 1');
      json(res,200,{ready:true,serverAuthoritative:true,presenceEnabled,playgroundAiEnabled:presenceEnabled&&process.env.PLAYGROUND_AI_ENABLED==='true',speechTranslationEnabled:presenceEnabled&&process.env.PLAYGROUND_AI_ENABLED==='true'&&process.env.TRIALUM_TRANSLATION_ENABLED==='true'&&await translatorReady(),speechTranslationLanguages:['mk','sq','en'],sharedShopEnabled:true,
       sharedShopVersion:1,noPaidCurrency:true});return true;
    }
    if(path==='/v1/shared/catalog'&&req.method==='GET'){
      json(res,200,{version:1,currency:'sharedCredits',items:SHOP,maxPlaced:6});return true;
    }
    if(path==='/v1/shared/rooms'&&req.method==='GET'){
      const q=await pool.query(`SELECT p.id,p.title,p.tier,m.role,
       (SELECT installation_id FROM playground_members WHERE playground_id=p.id AND role='owner' LIMIT 1) owner_id
       FROM playground_members m JOIN playgrounds p ON p.id=m.playground_id
       WHERE m.installation_id=$1 AND p.retired_at IS NULL ORDER BY m.joined_at DESC LIMIT 20`,[me.id]);
      const rooms=[];for(const r of q.rows)if(r.role==='owner'||await friend(pool,r.owner_id,me.id))rooms.push(r);
      json(res,200,{rooms});return true;
    }
    if(path==='/v1/shared/invitations'&&req.method==='GET'){
      const q=await pool.query(`SELECT v.id,v.playground_id,v.inviter_id,v.expires_at,p.title AS title,i.nickname AS inviter_name
       FROM playground_invites v JOIN playgrounds p ON p.id=v.playground_id
       JOIN installations i ON i.id=v.inviter_id
       WHERE v.invitee_id=$1 AND v.status='pending' AND v.expires_at>now()
       AND p.retired_at IS NULL ORDER BY v.created_at DESC LIMIT 20`,[me.id]);
      const invites=[];for(const v of q.rows)if(await friend(pool,me.id,v.inviter_id))invites.push(v);
      json(res,200,{invitations:invites});return true;
    }
    if(path==='/v1/shared/visits'&&req.method==='GET'){
      const q=await pool.query(`SELECT v.id,v.sender_id,v.receiver_id,v.destination,v.playground_id,
       v.status,v.pet_public,v.created_at,v.expires_at,p.nickname AS sender_name
       FROM visits v JOIN installations p ON p.id=v.sender_id
       WHERE (v.sender_id=$1 OR v.receiver_id=$1) AND v.created_at>now()-interval '7 days'
       ORDER BY v.created_at DESC LIMIT 40`,[me.id]);
      const active=presenceEnabled?await pool.query(
        "SELECT visit_id FROM pet_presence WHERE visit_id=ANY($1::uuid[]) AND expires_at>now()",
        [q.rows.map(v=>v.id)]):null;
      const live=new Set(active?.rows.map(v=>v.visit_id)||[]);
      const visits=[];for(const v of q.rows)if(await friend(pool,v.sender_id,v.receiver_id))
        visits.push({...v,presence_active:!presenceEnabled||(v.status==='accepted'&&live.has(v.id))});
      json(res,200,{visits});return true;
    }
    if(path==='/v1/shared/rooms'&&req.method==='POST'){
      limit('roomcreate:'+me.id,4);
      const {title}=await jsonBody(req);
      if(typeof title!=='string'||!title.trim()||title.trim().length>48)err(400,'invalid_title');
      const result=await transaction(pool,async c=>{
        // Serialize creation for this player across simultaneous requests.
        await c.query('SELECT id FROM installations WHERE id=$1 FOR UPDATE',[me.id]);
        const n=await c.query(`SELECT count(*)::int AS n FROM playground_members m
        JOIN playgrounds p ON p.id=m.playground_id WHERE m.installation_id=$1 AND m.role='owner' AND p.retired_at IS NULL`,[me.id]);
        if(n.rows[0].n>=2)err(409,'room_limit');
        const q=await c.query('INSERT INTO playgrounds(title) VALUES($1) RETURNING id,title,tier',[title.trim()]);
        const r=q.rows[0];
        await c.query(`INSERT INTO playground_members(playground_id,installation_id,role) VALUES($1,$2,'owner')`,[r.id,me.id]);
        await c.query(`INSERT INTO playground_toys(playground_id,toy_id) VALUES($1,'sandbox'),($1,'seesaw')`,[r.id]);
        await c.query('INSERT INTO shared_playground_state(playground_id) VALUES($1)',[r.id]);
        await event(c,r.id,me.id,'created',{title:r.title});
        return r;
      });
      json(res,201,{room:result});return true;
    }
    // Explicitly feature-gated: old clients cannot claim social pet presence.
    if(path.startsWith('/v1/shared/presence')){
      if(!presenceEnabled)err(503,'presence_not_enabled');
      if(path==='/v1/shared/presence'&&req.method==='GET'){
        const rows=await listPresence(pool,me.id);
        json(res,200,{presence:rows});return true;
      }
      if(path==='/v1/shared/presence/enter'&&req.method==='POST'){
        const {roomId,sessionId,pet}=await jsonBody(req);
        if(!valid(roomId)||!validPresenceSession(sessionId))err(400,'invalid_presence_session');
        const profile=petView(pet);
        const outcome=await transaction(pool,async c=>{
          await roomFor(c,roomId,me.id);
          return admitShared(c,me.id,roomId,profile,sessionId);
        });
        signal({type:'room_changed',roomId,actorId:me.id});
        json(res,200,outcome);return true;
      }
      if(path==='/v1/shared/presence/return'&&req.method==='POST'){
        const {petId,sessionId}=await jsonBody(req);
        const result=await transaction(pool,c=>releasePresence(c,me.id,petId,sessionId));
        if(result.roomId)signal({type:'room_changed',roomId:result.roomId,actorId:me.id});
        json(res,200,result);return true;
      }
      if(path==='/v1/shared/presence/renew'&&req.method==='POST'){
        const {roomId,petId,sessionId}=await jsonBody(req);
        if(!valid(roomId))err(400,'invalid_room');
        const result=await transaction(pool,async c=>{
          await roomFor(c,roomId,me.id);
          return renewPresence(c,me.id,roomId,petId,sessionId);
        });
        json(res,200,result);return true;
      }
      err(404,'not_found');
    }
    const roomMatch=/^\/v1\/shared\/rooms\/([0-9a-f-]{36})(?:\/(snapshot|invite|activity|upgrade|placement|members\/[0-9a-f-]{36}))?$/i.exec(path);
    if(roomMatch&&valid(roomMatch[1])){
      const id=roomMatch[1],action=roomMatch[2]||'';
      if(action==='snapshot'&&req.method==='GET'){
        const room=await roomFor(pool,id,me.id);
        json(res,200,await snapshot(pool,room,presenceEnabled));return true;
      }
      if(!action&&req.method==='DELETE'){
        await transaction(pool,async c=>{
          await roomFor(c,id,me.id,true);
          await c.query('DELETE FROM playgrounds WHERE id=$1',[id]);
        });
        signal({type:'room_closed',roomId:id,actorId:me.id});
        json(res,200,{deleted:true});return true;
      }
      if(action.startsWith('members/')&&req.method==='DELETE'){
        const target=action.split('/')[1];
        await transaction(pool,async c=>{
          const r=await roomFor(c,id,me.id);
          if(r.role!=='owner'&&target!==me.id)err(403,'owner_required');
          if(target===r.owner_id)err(409,'owner_cannot_leave');
          if(presenceEnabled){
             await removeMemberPresence(c,id,target);
             await c.query(`DELETE FROM pet_presence WHERE visit_id IN
               (SELECT id FROM visits WHERE playground_id=$1 AND status IN ('pending','accepted')
                 AND (sender_id=$2 OR receiver_id=$2))`,[id,target]);
           }
           await c.query('DELETE FROM playground_events WHERE playground_id=$1 AND actor_id=$2',[id,target]);
          await c.query('DELETE FROM playground_activities WHERE playground_id=$1 AND installation_id=$2',[id,target]);
          await c.query('DELETE FROM playground_members WHERE playground_id=$1 AND installation_id=$2',[id,target]);
          await c.query(`UPDATE visits SET status='returned',ended_at=now(),pet_public='{}'::jsonb
            WHERE playground_id=$1 AND status IN ('pending','accepted') AND (sender_id=$2 OR receiver_id=$2)`,[id,target]);
          await c.query('UPDATE shared_playground_state SET version=version+1 WHERE playground_id=$1',[id]);
          await event(c,id,me.id,'member_left',{memberId:target});
        });
        signal({type:'room_changed',roomId:id,targetId:target});json(res,200,{removed:true});return true;
      }
      if(action==='invite'&&req.method==='POST'){
        limit('roominvite:'+me.id,24);
        const {inviteeId}=await jsonBody(req);
        if(!valid(inviteeId)||inviteeId===me.id)err(400,'invalid_invitee');
        const inv=await transaction(pool,async c=>{
          await roomFor(c,id,me.id,true);
          await c.query('SELECT id FROM playgrounds WHERE id=$1 FOR UPDATE',[id]);
          if(!await friend(c,me.id,inviteeId))err(403,'friendship_required');
          const count=await c.query('SELECT count(*)::int n FROM playground_members WHERE playground_id=$1',[id]);
          if(count.rows[0].n>=6)err(409,'room_full');
          const present=await c.query('SELECT 1 FROM playground_members WHERE playground_id=$1 AND installation_id=$2',[id,inviteeId]);
          if(present.rowCount)err(409,'already_member');
          await c.query(`UPDATE playground_invites SET status='expired'
           WHERE playground_id=$1 AND invitee_id=$2 AND status='pending' AND expires_at<=now()`,[id,inviteeId]);
          const q=await c.query(`INSERT INTO playground_invites(playground_id,inviter_id,invitee_id) VALUES($1,$2,$3)
           ON CONFLICT(playground_id,invitee_id) WHERE status='pending'
           DO UPDATE SET expires_at=now()+interval '24 hours' RETURNING id,expires_at`,[id,me.id,inviteeId]);
          return q.rows[0];
        });
        signal({type:'invitation',roomId:id,targetId:inviteeId,actorId:me.id,referenceId:inv.id});
        json(res,201,{invitation:inv});return true;
      }
      if(action==='activity'&&req.method==='POST'){
        limit('play:'+me.id,70);
        const {eventKey,toyId,pet,sessionId}=await jsonBody(req);
        if(!valid(eventKey)||!TOYS.includes(toyId))err(400,'invalid_activity');
        if(presenceEnabled&&!validPresenceSession(sessionId))err(409,'presence_required');
         const profile=petView(pet);
        const value=await transaction(pool,async c=>{
          await roomFor(c,id,me.id);
          const st=await c.query('SELECT points,version FROM shared_playground_state WHERE playground_id=$1 FOR UPDATE',[id]);
          if(!st.rowCount)err(503,'migration_required');
          const prior=await c.query('SELECT playground_id,installation_id FROM playground_activities WHERE event_key=$1',[eventKey]);
          if(prior.rowCount){
            if(prior.rows[0].playground_id!==id||prior.rows[0].installation_id!==me.id)err(409,'event_conflict');
            return {duplicate:true,points:st.rows[0].points,version:String(st.rows[0].version)};
          }
          const available=await c.query('SELECT 1 FROM playground_toys WHERE playground_id=$1 AND toy_id=$2 AND placed=true',[id,toyId]);
          if(!available.rowCount)err(403,'toy_locked');
           if(presenceEnabled)await assertRoomPet(c,me.id,id,profile.id,sessionId);
          const count=await c.query(`SELECT count(*)::int n,max(occurred_at) last FROM playground_activities
            WHERE playground_id=$1 AND installation_id=$2 AND occurred_day=(now() AT TIME ZONE 'UTC')::date`,[id,me.id]);
          if(count.rows[0].n>=6)err(429,'daily_play_limit');
          if(count.rows[0].last&&Date.now()-new Date(count.rows[0].last).getTime()<8000)err(429,'play_cooldown');
          await c.query(`INSERT INTO playground_activities(event_key,playground_id,installation_id,toy_id,pet_public)
            VALUES($1,$2,$3,$4,$5::jsonb)`,[eventKey,id,me.id,toyId,JSON.stringify(profile)]);
          await c.query(`INSERT INTO contributions(playground_id,installation_id,event_key,resource_kind,amount)
            VALUES($1,$2,$3,'effort',1)`,[id,me.id,eventKey]);
          const result=await c.query(`UPDATE shared_playground_state SET points=points+1,version=version+1,updated_at=now()
           WHERE playground_id=$1 RETURNING points,version`,[id]);
          await event(c,id,me.id,'played',{toyId,pet:profile,earned:1});
          return {duplicate:false,earned:1,points:result.rows[0].points,version:String(result.rows[0].version)};
        });
        if(!value.duplicate)signal({type:'room_changed',roomId:id,actorId:me.id});
        json(res,200,value);return true;
      }
      if(action==='placement'&&req.method==='POST'){
        limit('placement:'+me.id,60);
        const {toyId,placed}=await jsonBody(req);
        if(!TOYS.includes(toyId)||typeof placed!=='boolean')err(400,'invalid_placement');
        const outcome=await transaction(pool,async c=>{
          const room=await roomFor(c,id,me.id,true);
          const st=await c.query('SELECT points,version FROM shared_playground_state WHERE playground_id=$1 FOR UPDATE',[id]);
          if(!st.rowCount)err(503,'migration_required');
          const q=await c.query('SELECT placed FROM playground_toys WHERE playground_id=$1 AND toy_id=$2 FOR UPDATE',[id,toyId]);
          if(!q.rowCount)err(409,'toy_not_owned');
          if(q.rows[0].placed===placed)
            return {changed:false,toyId,placed,sharedCredits:st.rows[0].points,version:String(st.rows[0].version)};
          if(placed){
            const count=await c.query('SELECT count(*)::int n FROM playground_toys WHERE playground_id=$1 AND placed=true',[id]);
            if(count.rows[0].n>=Math.min(6,2+room.tier))err(409,'expand_first');
          }
          // Removing only stores the toy. Ownership and spent credits remain.
          await c.query('UPDATE playground_toys SET placed=$3 WHERE playground_id=$1 AND toy_id=$2',[id,toyId,placed]);
          const updated=await c.query('UPDATE shared_playground_state SET version=version+1,updated_at=now() WHERE playground_id=$1 RETURNING points,version',[id]);
          await event(c,id,me.id,'placement',{toyId,placed});
          return {changed:true,toyId,placed,sharedCredits:updated.rows[0].points,version:String(updated.rows[0].version)};
        });
        if(outcome.changed)signal({type:'room_changed',roomId:id,actorId:me.id});
        json(res,200,outcome);return true;
      }
      if(action==='upgrade'&&req.method==='POST'){
        limit('upgrade:'+me.id,24);
        const {eventKey,kind,toyId}=await jsonBody(req);
        if(!valid(eventKey)||!['expand','toy'].includes(kind)||
           (kind==='toy'&&!Object.hasOwn(COST,toyId)))err(400,'invalid_upgrade');
        const value=await transaction(pool,async c=>{
          const room=await roomFor(c,id,me.id,true);
          const state=await c.query('SELECT points,version FROM shared_playground_state WHERE playground_id=$1 FOR UPDATE',[id]);
          if(!state.rowCount)err(503,'migration_required');
          const prior=await c.query('SELECT playground_id,installation_id FROM playground_spends WHERE event_key=$1',[eventKey]);
          if(prior.rowCount){
            if(prior.rows[0].playground_id!==id||prior.rows[0].installation_id!==me.id)err(409,'event_conflict');
            return {duplicate:true,points:state.rows[0].points,sharedCredits:state.rows[0].points,
              version:String(state.rows[0].version)};
          }
          let cost;
          if(kind==='expand'){
            if(room.tier>=5)err(409,'room_max_tier');
            cost=10+5*(room.tier-1);
          }else{
            const owned=await c.query('SELECT 1 FROM playground_toys WHERE playground_id=$1 AND toy_id=$2',[id,toyId]);
            if(owned.rowCount)err(409,'toy_already_unlocked');
            // Buying grants permanent inventory ownership regardless of free
            // scene slots. New purchases are placed when a slot is available.
            cost=COST[toyId];
          }
          if(state.rows[0].points<cost)err(409,'not_enough_shared_points');
          await c.query(`INSERT INTO playground_spends(event_key,playground_id,installation_id,kind,toy_id,amount)
            VALUES($1,$2,$3,$4,$5,$6)`,[eventKey,id,me.id,kind,kind==='toy'?toyId:null,cost]);
          if(kind==='expand')await c.query('UPDATE playgrounds SET tier=tier+1 WHERE id=$1',[id]);
          else {
            const inScene=await c.query('SELECT count(*)::int n FROM playground_toys WHERE playground_id=$1 AND placed=true',[id]);
            const autoPlace=inScene.rows[0].n<Math.min(6,2+room.tier);
            await c.query('INSERT INTO playground_toys(playground_id,toy_id,placed) VALUES($1,$2,$3)',[id,toyId,autoPlace]);
          }
          const v=await c.query('UPDATE shared_playground_state SET points=points-$2,version=version+1 WHERE playground_id=$1 RETURNING points,version',[id,cost]);
          await event(c,id,me.id,'upgraded',{kind,toyId:kind==='toy'?toyId:null,cost});
          return {duplicate:false,cost,points:v.rows[0].points,sharedCredits:v.rows[0].points,
            version:String(v.rows[0].version)};
        });
        if(!value.duplicate){signal({type:'room_changed',roomId:id,actorId:me.id});signal({type:'shared_upgrade',roomId:id,actorId:me.id});}
        json(res,200,value);return true;
      }
    }
    const inv=/^\/v1\/shared\/invitations\/([0-9a-f-]{36})(?:\/(accept|decline))?$/i.exec(path);
    if(inv&&valid(inv[1])&&(req.method==='DELETE'||req.method==='POST')){
      const action=req.method==='DELETE'?'decline':inv[2];
      if(!['accept','decline'].includes(action))err(405,'method_not_allowed');
      const outcome=await transaction(pool,async c=>{
        const initial=await c.query('SELECT inviter_id,invitee_id FROM playground_invites WHERE id=$1',[inv[1]]);
        if(!initial.rowCount)err(404,'invitation_not_found');
        const pair=ordered(initial.rows[0].inviter_id,initial.rows[0].invitee_id);
        await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1 || $2, 0))',pair);
        const q=await c.query('SELECT * FROM playground_invites WHERE id=$1 FOR UPDATE',[inv[1]]);
        if(!q.rowCount)err(404,'invitation_not_found');
        const v=q.rows[0];
        if(v.invitee_id!==me.id&&!(action==='decline'&&v.inviter_id===me.id))err(403,'not_invited');
        if(v.status!=='pending'||new Date(v.expires_at).getTime()<=Date.now())err(409,'invitation_expired');
        if(action==='accept'){
          await c.query('SELECT id FROM playgrounds WHERE id=$1 FOR UPDATE',[v.playground_id]);
          const validRoom=await c.query('SELECT 1 FROM playgrounds WHERE id=$1 AND retired_at IS NULL',[v.playground_id]);
          if(!validRoom.rowCount||!await friend(c,me.id,v.inviter_id))err(403,'friendship_required');
          const count=await c.query('SELECT count(*)::int n FROM playground_members WHERE playground_id=$1',[v.playground_id]);
          if(count.rows[0].n>=6)err(409,'room_full');
          await c.query(`INSERT INTO playground_members(playground_id,installation_id,role)
           VALUES($1,$2,'member') ON CONFLICT DO NOTHING`,[v.playground_id,me.id]);
          await c.query('UPDATE shared_playground_state SET version=version+1 WHERE playground_id=$1',[v.playground_id]);
          await event(c,v.playground_id,me.id,'joined',{memberId:me.id});
        }
        await c.query('UPDATE playground_invites SET status=$2 WHERE id=$1',[v.id,action==='accept'?'accepted':'declined']);
        return {roomId:v.playground_id,otherId:v.inviter_id,status:action==='accept'?'accepted':'declined'};
      });
      signal({type:'room_changed',roomId:outcome.roomId,actorId:me.id,targetId:outcome.otherId});
      if(outcome.status==='accepted')signal({type:'room_joined',roomId:outcome.roomId,actorId:me.id,targetId:outcome.otherId});
      json(res,200,outcome);return true;
    }
    if(path==='/v1/shared/visits'&&req.method==='POST'){
      limit('visit:'+me.id,16);
      const {eventKey,receiverId,destination,roomId,pet}=await jsonBody(req);
      if(!valid(eventKey)||!valid(receiverId)||receiverId===me.id||
         !['habitat','playground'].includes(destination))err(400,'invalid_visit');
      const profile=petView(pet);
      const result=await transaction(pool,async c=>{
        const prior=await c.query('SELECT id,sender_id,receiver_id FROM visits WHERE event_key=$1',[eventKey]);
        if(prior.rowCount){
          if(prior.rows[0].sender_id!==me.id||prior.rows[0].receiver_id!==receiverId)err(409,'event_conflict');
          return {id:prior.rows[0].id,duplicate:true};
        }
        const pair=ordered(me.id,receiverId);
        await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1 || $2, 0))',pair);
        if(!await friend(c,me.id,receiverId))err(403,'friendship_required');
         if(presenceEnabled){
           await c.query('SELECT id FROM installations WHERE id=$1 FOR UPDATE',[me.id]);
           const away=await c.query(`SELECT 1 FROM pet_presence
             WHERE installation_id=$1 AND pet_ref=$2 AND expires_at>now()`,[me.id,profile.id]);
           if(away.rowCount)err(409,'pet_already_away');
           const pending=await c.query(`SELECT 1 FROM visits WHERE sender_id=$1
             AND pet_ref=$2 AND status='pending' AND expires_at>now()`,[me.id,profile.id]);
           if(pending.rowCount)err(409,'pet_visit_pending');
         }
        const outstanding=await c.query(`SELECT count(*)::int n FROM visits
          WHERE sender_id=$1 AND receiver_id=$2 AND status='pending' AND expires_at>now()`,[me.id,receiverId]);
        if(outstanding.rows[0].n>=3)err(429,'pending_visit_limit');
        if(destination==='playground'){
          if(!valid(roomId))err(400,'invalid_room');
          await roomFor(c,roomId,me.id);await roomFor(c,roomId,receiverId);
        }else if(roomId)err(400,'invalid_room');
        const q=await c.query(`INSERT INTO visits(event_key,sender_id,receiver_id,pet_ref,pet_public,destination,playground_id,status,expires_at)
           VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,'pending',now()+interval '15 minutes') RETURNING id`,
          [eventKey,me.id,receiverId,profile.id,JSON.stringify(profile),destination,destination==='playground'?roomId:null]);
        return {id:q.rows[0].id,duplicate:false};
      });
      if(!result.duplicate)signal({type:'visit_request',targetId:receiverId,actorId:me.id,referenceId:result.id,roomId:destination==='playground'?roomId:null});
      json(res,201,{visitId:result.id,status:'pending',duplicate:result.duplicate});return true;
    }
    const visit=/^\/v1\/shared\/visits\/([0-9a-f-]{36})\/(accept|decline|return)$/i.exec(path);
    if(visit&&valid(visit[1])&&req.method==='POST'){
      const action=visit[2];
      const value=await transaction(pool,async c=>{
        // The same advisory lock is acquired by friendship blocking/removal.
        // Lock the pair BEFORE the visit row to prevent accept-after-block races.
        const ref=await c.query('SELECT sender_id,receiver_id FROM visits WHERE id=$1',[visit[1]]);
        if(!ref.rowCount)err(404,'visit_not_found');
        const pair=ordered(ref.rows[0].sender_id,ref.rows[0].receiver_id);
        await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1 || $2, 0))',pair);
        const q=await c.query('SELECT * FROM visits WHERE id=$1 FOR UPDATE',[visit[1]]);
        if(!q.rowCount)err(404,'visit_not_found');
        const v=q.rows[0];
        if(v.sender_id!==me.id&&v.receiver_id!==me.id)err(403,'not_participant');
        if(!await friend(c,v.sender_id,v.receiver_id))err(403,'friendship_required');
        if(action==='accept'){
          if(v.receiver_id!==me.id)err(403,'receiver_required');
          if(v.status!=='pending'||new Date(v.expires_at).getTime()<=Date.now())err(409,'visit_expired');
          if(v.destination==='playground'){await roomFor(c,v.playground_id,v.sender_id);await roomFor(c,v.playground_id,v.receiver_id);}
          if(presenceEnabled)await admitVisit(c,v);
           await c.query(`UPDATE visits SET status='accepted',accepted_at=now(),expires_at=now()+interval '2 hours' WHERE id=$1`,[v.id]);
        }else if(action==='decline'){
          if(v.receiver_id!==me.id||v.status!=='pending')err(409,'visit_not_pending');
          await c.query(`UPDATE visits SET status='declined',ended_at=now() WHERE id=$1`,[v.id]);
        }else{
          if(!['accepted','pending'].includes(v.status))err(409,'visit_not_active');
          if(presenceEnabled)await releaseVisit(c,v.id);
           await c.query(`UPDATE visits SET status='returned',ended_at=now() WHERE id=$1`,[v.id]);
        }
        if(v.playground_id&&action!=='decline'){
          await c.query('UPDATE shared_playground_state SET version=version+1 WHERE playground_id=$1',[v.playground_id]);
          await event(c,v.playground_id,me.id,'visit_'+action,{visitId:v.id});
        }
        return {roomId:v.playground_id,otherId:v.sender_id===me.id?v.receiver_id:v.sender_id,status:action==='return'?'returned':action==='accept'?'accepted':'declined'};
      });
      signal({type:'visit_changed',roomId:value.roomId,targetId:value.otherId,actorId:me.id,referenceId:visit[1],action});
      json(res,200,{status:value.status});return true;
    }
    json(res,404,{error:'not_found'});return true;
  }catch(e){
    if(res.headersSent)return true;
    const status=Number.isInteger(e.status)?e.status:e.code==='23505'?409:500;
    json(res,status,{error:status===500?'internal_error':e.message});return true;
  }
}
export {roomFor,snapshot,friend};
