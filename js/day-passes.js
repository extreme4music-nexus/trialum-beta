/* TRIALUM v44 skip-day pass economy: bought now, consumed later, simulated in full. */
(function(root,factory){
 const api=factory(root.TrialumEngine);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.TrialumDayPasses=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(E){
'use strict';
const PACKS=Object.freeze([
 Object.freeze({days:1,credits:50}),
 Object.freeze({days:3,credits:140}),
 Object.freeze({days:7,credits:315}),
 Object.freeze({days:14,credits:595}),
 Object.freeze({days:30,credits:1125})
]);
const MAX_BANK=365,MAX_OFFSET=36500;
const fail=(code,message)=>({ok:false,code,message});
function info(s){
 if(!E||!s)return fail('no_world','Start a world first.');
 const l=E.ensureLongplay(s);
 if(!l||!Array.isArray(l.ledger)||!Number.isSafeInteger(l.dayPasses)||
    !Number.isSafeInteger(l.paidDayOffset)||!Number.isSafeInteger(l.credits)||
    l.dayPasses<0||l.paidDayOffset<0||l.credits<0)
  return fail('invalid_save','Day passes or credits are invalid.');
 return {ok:true,credits:l.credits,available:l.dayPasses,used:l.paidDayOffset,
  currentDay:s.lastDay,packages:PACKS};
}
function buy(s,days){
 const pack=PACKS.find(p=>p.days===days);
 if(!pack)return fail('invalid_pack','Select an available day-pass pack.');
 const state=info(s);if(!state.ok)return state;
 if(state.available+pack.days>MAX_BANK)return fail('bank_full','Use some saved day passes before buying more.');
 if(state.used+state.available+pack.days>MAX_OFFSET)
  return fail('lifetime_cap','The simulated day limit has been reached.');
 if(state.credits<pack.credits)return fail('insufficient_credits','Not enough in-game credits for this pack.');
 // Atomic synchronous purchase: whole integer amount, no auto-redemption.
 const l=s.longplay;
 l.credits-=pack.credits;l.dayPasses+=pack.days;
 l.ledger.push({day:s.lastDay,type:'spent',value:-pack.credits,
  reason:'Buy '+pack.days+' day passes'});
 if(l.ledger.length>400)l.ledger.splice(0,l.ledger.length-400);
 return {ok:true,days:pack.days,cost:pack.credits,remaining:l.credits,
  available:l.dayPasses,message:'Purchased '+pack.days+' day passes. Use them whenever you want.'};
}
function redeem(s,days=1,now=Date.now()){
 if(!Number.isSafeInteger(days)||days<1||days>30)return fail('invalid_days','Choose 1 to 30 whole days.');
 const state=info(s);if(!state.ok)return state;
 if(state.available<days)return fail('insufficient_passes','Not enough saved day passes.');
 if(state.used+days>MAX_OFFSET)return fail('lifetime_cap','The simulated day limit has been reached.');
 if(!Number.isFinite(now))return fail('invalid_clock','Time is unavailable.');
 // First reconcile real elapsed time and one-off legacy plant migration without charging a pass.
 E.advance(s,now);
 const l=s.longplay;
 if(l.dayPasses<days||l.paidDayOffset+days>MAX_OFFSET)return fail('state_changed','Day-pass balance changed.');
 let previous;
 try{previous=JSON.stringify(s);}catch(_){return fail('backup_failed','Cannot protect the world before day skip.');}
 const beforeDay=s.lastDay;
 try{
  l.dayPasses-=days;
  l.paidDayOffset+=days;
  E.advance(s,now); // Uses original daily ecosystem, flora, pet, habitat and research rules.
  const actual=s.lastDay-beforeDay;
  if(actual!==days)throw Error('advance_mismatch');
  l.ledger.push({day:s.lastDay,type:'redeemed',value:0,reason:'Used '+days+' day passes'});
  if(l.ledger.length>400)l.ledger.splice(0,l.ledger.length-400);
  E.log(s,'📅 Извршено платено поминување на '+days+' симулирани дена.','system');
  return {ok:true,days:actual,remaining:l.dayPasses,currentDay:s.lastDay,
   message:'Advanced '+actual+' game '+(actual===1?'day':'days')+'. Check plants, pets and habitats.'};
 }catch(error){
  // In-place world restore preserves references already held by the application.
  const original=JSON.parse(previous);
  for(const key of Object.keys(s))delete s[key];
  Object.assign(s,original);
  return fail('simulation_failed','Day skip was rolled back because simulation could not finish.');
 }
}
if(E){E.dayPassPacks=PACKS;E.dayPassInfo=info;E.buyDayPassPack=buy;E.redeemDayPass=redeem;}
return {PACKS,info,buy,redeem,MAX_BANK,MAX_OFFSET};
});
