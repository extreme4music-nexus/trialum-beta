/* Integration test for the staged v44 shared store. Runs ONLY against a
 * disposable PostgreSQL-backed social service with a known test DB URL.
 * Never run this against production.
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
const root=process.env.TRIALUM_SHARED_BASE||'http://127.0.0.1:8787';
const database=process.env.TRIALUM_TEST_DATABASE_URL||'';
if(!/^(postgres|postgresql):\/\//.test(database)||!root.startsWith('http://127.0.0.1:'))
 throw Error('Test requires disposable local DB and local server');
const db=new Pool({connectionString:database});
async function http(path,method='GET',body,credential){
 const response=await fetch(root+path,{
  method,headers:{...(body?{'content-type':'application/json'}:{}),
    ...(credential?{authorization:'Bearer '+credential}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 return {status:response.status,data:await response.json().catch(()=>({}))};
}
const api=(path,method='GET',body,token)=>http('/v1/shared/'+path,method,body,token);
const social=(path,method='GET',body,token)=>http('/v1/social/'+path,method,body,token);
const roomPath=id=>'rooms/'+id;
function requireStatus(actual,status,label){
 assert.equal(actual.status,status,label+' -> '+JSON.stringify(actual));
}
async function register(nick){
 const r=await social('register','POST',{nickname:nick});requireStatus(r,201,'register');
 return r.data;
}
const roomId=randomUUID(),batch=randomUUID();
try{
 const owner=await register('Owner-'+batch.slice(0,6)),guest=await register('Guest-'+batch.slice(0,6)),
  outsider=await register('Outside-'+batch.slice(0,6));
 requireStatus(await api('status','GET',null,owner.credential),200,'shared status');
 const status=(await api('status','GET',null,owner.credential)).data;
 assert.equal(status.sharedShopEnabled,true);
 const catalog=(await api('catalog','GET',null,owner.credential)).data;
 assert.equal(catalog.currency,'sharedCredits');
 assert.equal(catalog.items.length,14);
 assert.equal(catalog.items.find(x=>x.id==='music').cost,22);
 requireStatus(await api('catalog','GET',null,null),401,'catalog anonymous');
 const invited=await social('invites','POST',{},owner.credential);
 requireStatus(invited,201,'friend invite');
 requireStatus(await social('invites/accept','POST',{code:invited.data.code},guest.credential),200,'friendship');
 const roomResponse=await api('rooms','POST',{title:'Store QA '+batch.slice(0,5)},owner.credential);
 requireStatus(roomResponse,201,'create');
 const id=roomResponse.data.room.id;
 const ask=await api(roomPath(id)+'/invite','POST',{inviteeId:guest.id},owner.credential);
 requireStatus(ask,201,'invite to room');
 const accept=await api('invitations/'+ask.data.invitation.id+'/accept','POST',{},guest.credential);
 requireStatus(accept,200,'room accepted');
 const initial=await api(roomPath(id)+'/snapshot','GET',null,owner.credential);
 requireStatus(initial,200,'initial room');
 assert.equal(initial.data.sharedCredits,initial.data.points);
 assert.deepEqual(new Set(initial.data.ownedToys),new Set(['sandbox','seesaw']));
 assert.deepEqual(new Set(initial.data.toys),new Set(['sandbox','seesaw']));
 requireStatus(await api(roomPath(id)+'/snapshot','GET',null,outsider.credential),403,'outsider denied');
 requireStatus(await api(roomPath(id)+'/placement','POST',{toyId:'sandbox',placed:false},guest.credential),403,'member cannot remove');
 requireStatus(await api(roomPath(id)+'/upgrade','POST',{eventKey:randomUUID(),kind:'toy',toyId:'music'},guest.credential),403,'member cannot buy');
 // Direct DB credit seeding is TEST-ONLY: no HTTP endpoint is allowed to mint currency.
 await db.query('UPDATE shared_playground_state SET points=90 WHERE playground_id=$1',[id]);
 const before=(await api(roomPath(id)+'/snapshot','GET',null,owner.credential)).data;
 assert.equal(before.sharedCredits,90);
 const purchaseKey=randomUUID();
 const buy=await api(roomPath(id)+'/upgrade','POST',{eventKey:purchaseKey,kind:'toy',toyId:'music'},owner.credential);
 requireStatus(buy,200,'buy music');
 assert.equal(buy.data.cost,22);
 assert.equal(buy.data.sharedCredits,68);
 const replay=await api(roomPath(id)+'/upgrade','POST',{eventKey:purchaseKey,kind:'toy',toyId:'music'},owner.credential);
 requireStatus(replay,200,'replay');
 assert.equal(replay.data.duplicate,true);
 assert.equal(replay.data.sharedCredits,68,'idempotent balance');
 const duplicated=await api(roomPath(id)+'/upgrade','POST',{eventKey:randomUUID(),kind:'toy',toyId:'music'},owner.credential);
 requireStatus(duplicated,409,'double buy');
 let snap=(await api(roomPath(id)+'/snapshot','GET',null,owner.credential)).data;
 assert(snap.ownedToys.includes('music')&&snap.toys.includes('music'),'first free slot auto-places');
 const buyStored=await api(roomPath(id)+'/upgrade','POST',{eventKey:randomUUID(),kind:'toy',toyId:'stargazer'},owner.credential);
 requireStatus(buyStored,200,'buy with full scene');
 snap=(await api(roomPath(id)+'/snapshot','GET',null,owner.credential)).data;
 assert(snap.ownedToys.includes('stargazer'),'stored toy remains bought');
 assert(!snap.toys.includes('stargazer'),'no extra visible slot created');
 const refused=await api(roomPath(id)+'/activity','POST',
   {eventKey:randomUUID(),toyId:'stargazer',
    pet:{id:'testpet',name:'Pet',species:1,hue:175,eyes:2,shape:'jelly',growth:40,seed:5}},owner.credential);
 requireStatus(refused,403,'stored toys never mint credits');
 requireStatus(await api(roomPath(id)+'/placement','POST',{toyId:'stargazer',placed:true},owner.credential),
   409,'overfilled scene denied');
 const removed=await api(roomPath(id)+'/placement','POST',{toyId:'seesaw',placed:false},owner.credential);
 requireStatus(removed,200,'remove installed');
 assert.equal(removed.data.changed,true);
 const creditAfterPurchase=42; // 90 - 22 - 26
 assert.equal(removed.data.sharedCredits,creditAfterPurchase,'remove never refunds');
 const removeAgain=await api(roomPath(id)+'/placement','POST',{toyId:'seesaw',placed:false},owner.credential);
 requireStatus(removeAgain,200,'idempotent removal');
 assert.equal(removeAgain.data.changed,false);
 const placedNew=await api(roomPath(id)+'/placement','POST',{toyId:'stargazer',placed:true},owner.credential);
 requireStatus(placedNew,200,'place stored');
 assert.equal(placedNew.data.sharedCredits,creditAfterPurchase,'place costs nothing');
 snap=(await api(roomPath(id)+'/snapshot','GET',null,guest.credential)).data;
 assert(!snap.toys.includes('seesaw')&&snap.ownedToys.includes('seesaw'));
 assert(snap.toys.includes('stargazer')&&snap.ownedToys.includes('stargazer'));
 requireStatus(await api(roomPath(id)+'/placement','POST',{toyId:'unknown',placed:false},owner.credential),
   400,'unknown apparatus');
 requireStatus(await api(roomPath(id)+'/placement','POST',{toyId:'music',placed:false},guest.credential),
   403,'member still not owner');
 requireStatus(await api(roomPath(id)+'/placement','POST',{toyId:'seesaw',placed:true},owner.credential),
   409,'cannot restore when at capacity');
 // Existing legacy points remain identical to new credits, never a second balance.
 assert.equal(snap.points,snap.sharedCredits);
 console.log('PASS V44 server: 14-item catalog, credits, replay, owner ACL, owned-vs-placed, activity, capacity, refund and legacy points');
}finally{await db.end();}
