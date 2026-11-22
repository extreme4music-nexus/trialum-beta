'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const Shop=require('../js/shared-shop.js'),UI=require('../js/shared-store-ui.js');
const Art=require('../js/shared-playground-art.js');
const room='bbaaa1fa-10d5-4331-a1bf-8cfc5eeb0001';
const t=(en,mk)=>globalThis.TrialumI18n.language()==='mk'?mk:en;
globalThis.TrialumI18n={language:()=> 'en',t:x=>x};
test('fourteen catalog toys, fixed public server prices and no personal credit conversion',()=>{
 assert.equal(Shop.ITEMS.length,14);
 assert.equal(Shop.BY_ID.slide.cost,8);
 assert.equal(Shop.BY_ID.music.cost,22);
 assert.equal(Shop.BY_ID.stargazer.cost,26);
 assert.equal(Shop.BY_ID.sandbox.cost,0);
 const w={room:{tier:4},sharedCredits:13,points:13,toys:['sandbox','seesaw'],ownedToys:['sandbox','seesaw','music']};
 const view=Shop.inventory(w);
 assert.equal(view.credits,13);
 assert.equal(view.capacity,6);
 assert(view.ownedSet.has('music')&&!view.activeSet.has('music'));
 const personal={longplay:{credits:99999}};
 assert.equal(Shop.inventory({...w,...personal}).credits,13);
});
test('shop only renders server-authorized owner purchases, stored inventory and accessibility',()=>{
 const snap={room:{tier:1},sharedCredits:21,toys:['sandbox'],ownedToys:['sandbox','slide','swing']};
 const catalog=Shop.ITEMS.map(x=>({id:x.id,cost:x.cost}));
 const owner=UI.render(snap,{owner:true,enabled:true,catalog,open:true});
 assert.match(owner,/Shared credits/);
 assert.match(owner,/Playground store/);
 assert.match(owner,/data-do="shToyPlace" data-toy="slide"/);
 assert.match(owner,/data-do="shShopBuy" data-toy="music"/);
 assert.match(owner,/data-do="shToyRemove"/);
 const guest=UI.render(snap,{owner:false,enabled:true,catalog,open:true});
 assert.match(guest,/data-do="shShopBuy".*disabled/);
 const offline=UI.render(snap,{owner:true,enabled:false,catalog,open:true});
 assert.match(offline,/private server/);
 assert(!offline.includes('data-do="shShopBuy"'));
});
test('canvas layout supports all fourteen props with at most 6 placed and accurate touch hit testing',()=>{
 const ids=Shop.ITEMS.map(x=>x.id);
 for(const id of ids){
  assert(Art.TOYS[id],id);
  const spot=Art.slot(id,[id]);
  assert(spot&&spot.x>0&&spot.x<1000&&spot.y>250&&spot.y<520,id);
  assert.equal(Art.hitTest(spot.x,spot.y-42,[id]),id);
 }
 const six=ids.slice(6,12),spots=Art.layout(six);
 assert.equal(Object.keys(spots).length,6);
 assert.equal(Art.layout(ids).length,undefined,'layout is keyed by active IDs');
 assert.equal(Object.keys(Art.layout(ids)).length,6,'never crowd more than six objects');
 const canvas=new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},
  {get(t,k){return k in t?t[k]:()=>{};},set(t,k,v){t[k]=v;return true;}});
 for(const id of ids)assert.doesNotThrow(()=>Art.paint(canvas,{toys:[id],sharedCredits:55,points:0},3),id);
});
test('server patch locks spend and placement to real room owner, authorizes stored/placed activity',()=>{
 const src=read('server-patch/v44/src/shared.mjs'),sql=read('server-patch/v44/sql/007_v44_shared_store.sh');
 assert(src.includes("if(action==='placement'&&req.method==='POST')"));
 assert(src.includes("await roomFor(c,id,me.id,true)"));
 assert(src.includes('SELECT points,version FROM shared_playground_state WHERE playground_id=$1 FOR UPDATE'));
 assert(src.includes("AND placed=true',[id,toyId]"));
 assert(src.includes('sharedShopEnabled:true'));
 assert(src.includes("ownedToys:toys.rows.map(t=>t.toy_id)"));
 assert(src.includes('cost=COST[toyId]'));
 assert(src.includes('VALUES($1,$2,$3)'));
 assert(sql.includes('ADD COLUMN IF NOT EXISTS placed boolean NOT NULL DEFAULT true'));
 assert(sql.includes('playground_activities_toy_id_check'));
 assert(sql.includes('COMMIT;'));
 assert(!src.includes('UPDATE personal_credits'));
});
test('owner can buy and store without touching local game credits, member cannot manage',async()=>{
 let owner=true,shop=true,requestCount=0;
 const own={pets:[],selectedPet:null,longplay:{credits:7777},resources:{biomass:800}};
 let credits=24,placed=['sandbox','seesaw'],owned=['sandbox','seesaw'];
 const roomInfo=()=>({id:room,title:'Community garden',tier:1,role:owner?'owner':'member'});
 const snapshot=()=>({room:roomInfo(),members:[],toys:placed.slice(),ownedToys:owned.slice(),
  sharedCredits:credits,points:credits,events:[],visitors:[],occupants:[],presenceEnabled:true});
 globalThis.TrialumAndroid={socialApiUrl:()=> 'https://test.example',socialCredential:()=> 'a'.repeat(43)};
 globalThis.TrialumSocial={isSocialProfileActive:()=>true,getState:()=>({identity:{id:'user-1'},friends:[]})};
 globalThis.TrialumPlayground={eligible:()=>({ok:false})};
 globalThis.TrialumPresence={get:()=>null};
 globalThis.WebSocket=undefined;
 globalThis.fetch=async(url,init={})=>{
  requestCount++;
  const route=new URL(url).pathname,body=init.body?JSON.parse(init.body):{};
  let data;
  if(route.endsWith('/status'))data={ready:true,presenceEnabled:true,
    sharedShopEnabled:shop,sharedShopVersion:1};
  else if(route.endsWith('/catalog'))data={version:1,currency:'sharedCredits',
    items:Shop.ITEMS.map(({id,cost})=>({id,cost}))};
  else if(route.endsWith('/rooms'))data={rooms:[roomInfo()]};
  else if(route.endsWith('/invitations'))data={invitations:[]};
  else if(route.endsWith('/visits'))data={visits:[]};
  else if(route.endsWith('/presence'))data={presence:[]};
  else if(route.endsWith('/snapshot'))data=snapshot();
  else if(route.endsWith('/upgrade')){
   assert.equal(body.kind,'toy');
   assert(owner);
   assert(!owned.includes(body.toyId));
   const cost=Shop.BY_ID[body.toyId].cost;assert(credits>=cost);
   credits-=cost;owned.push(body.toyId);
   if(placed.length<Shop.capacity(1))placed.push(body.toyId);
   data={cost,sharedCredits:credits,duplicate:false};
  }else if(route.endsWith('/placement')){
   assert(owner);assert(owned.includes(body.toyId));
   if(body.placed){assert(placed.length<Shop.capacity(1));placed.push(body.toyId);}
   else placed=placed.filter(x=>x!==body.toyId);
   data={changed:true,sharedCredits:credits};
  }else throw Error('unexpected test request '+route);
  return {ok:true,json:async()=>data};
 };
 require('../js/shared-playground.js');
 const sh=globalThis.TrialumShared;
 try{
  sh.bindWorld(own);sh.activate();
  for(let i=0;i<60&&!sh.getState().ready;i++)await new Promise(r=>setTimeout(r,5));
  assert(sh.getState().ready,'authenticated refresh');
  assert.equal(sh.getShopState().shopEnabled,true);
  sh.toggleStore();
  assert.match(sh.render(own),/Shared credits/);
  const starting=requestCount;
  assert.equal(await sh.purchaseToy('stargazer'),null,'not enough credits');
  assert.equal(requestCount,starting,'no bogus purchase call');
  const purchase=await sh.purchaseToy('music');
  assert.equal(purchase.cost,22);
  assert.equal(credits,2);
  assert(owned.includes('music')&&!placed.includes('music'),'owned but initially stored when at capacity');
  assert.equal(own.longplay.credits,7777,'personal credits untouched');
  await sh.placement('sandbox',false);
  assert(owned.includes('sandbox')&&!placed.includes('sandbox'),'unplacing preserves purchase');
  await sh.placement('music',true);
  assert(placed.includes('music'));
  assert(sh.selectToy('music'));
  assert.match(sh.render(own),/data-do="shToyRemove"/);
  owner=false;
  await sh.refresh();
  const before=requestCount;
  assert.equal(await sh.purchaseToy('swing'),null);
  assert.equal(await sh.placement('music',false),null);
  assert.equal(requestCount,before,'room member cannot send owner-only actions');
  shop=false;owner=true;await sh.refresh();
  assert.equal(sh.getShopState().shopEnabled,false,'old/unsupported backend disables store');
  assert.equal(own.resources.biomass,800);
 }finally{sh.deactivate();sh.bindWorld(null);}
});
