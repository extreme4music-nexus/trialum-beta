/* TRIALUM v44 action-refill economy: canonical engine transaction, no network billing. */
(function(root,factory){
 const api=factory(root.TrialumEngine);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.TrialumActionEconomy=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(E){
 'use strict';
 const VALID=new Set(['lab','pet','habitat','garden']);
 const fail=(code,message,extra={})=>({ok:false,code,message,...extra});
 function inspect(s,scope,id){
  if(!E||!s||!VALID.has(scope))return fail('invalid_scope','Unknown action type.');
  E.ensureLongplay(s);
  let target=null,field='',limit=0,label='';
  if(scope==='lab'){
   target=s;field='labActions';limit=E.labActionLimit(s);label='Laboratory';
  }else if(scope==='pet'){
   target=(s.pets||[]).find(p=>p.id===id);
   if(!target)return fail('unknown_pet','Choose an existing pet.');
   field='actionsLeft';limit=E.petActionLimit(s);label=String(target.name||'Pet');
  }else if(scope==='garden'){
   target=E.ensureAgro?.(s);
   if(!target)return fail('unknown_garden','Garden actions are unavailable.');
   field='actionsLeft';limit=4;label='Greenhouse garden';
  }else{
   target=(s.habitats||[]).find(h=>h.id===id);
   if(!target)return fail('unknown_habitat','Choose an existing habitat.');
   field='dayActions';limit=E.HAB_ACTIONS+Math.floor(s.research.level/3);
   label=String(target.name||'Habitat');
  }
  const current=target[field],balance=s.longplay.credits;
  if(!Number.isSafeInteger(current)||current<0||!Number.isSafeInteger(limit)||limit<0||
     !Number.isSafeInteger(balance)||balance<0)
    return fail('corrupt_balance','Cannot safely refill actions: invalid world state.');
  return {ok:true,scope,id:scope==='lab'||scope==='garden'?null:id,label,current,limit,
   room:Math.max(0,limit-current),credits:balance};
 }
 function buy(s,scope,id,quantity){
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity>30)
   return fail('invalid_quantity','Choose between 1 and 30 whole actions.');
  const info=inspect(s,scope,id);
  if(!info.ok)return info;
  if(info.room<quantity)return fail('action_capacity','Not enough room for this action pack.',{...info,ok:false});
  if(info.credits<quantity)
   return fail('insufficient_credits','Not enough credits earned in the game.',{
    ...info,ok:false,needed:quantity,shortfall:quantity-info.credits});
  // Complete validation precedes all spending; JS calls are synchronous on one world instance.
  const target=scope==='lab'?s:scope==='pet'?s.pets.find(p=>p.id===id):scope==='garden'?s.agro:s.habitats.find(h=>h.id===id);
  const field=scope==='lab'?'labActions':scope==='pet'||scope==='garden'?'actionsLeft':'dayActions';
  const ledger=s.longplay.ledger;
  if(!Array.isArray(ledger))return fail('invalid_ledger','Credit history is unavailable.');
  const record={day:s.lastDay,value:-quantity,
   reason:'HUD action refill: '+scope+' '+(scope==='lab'||scope==='garden'?'':String(id).slice(0,64)),
   type:'spent'};
  target[field]+=quantity;
  s.longplay.credits-=quantity;
  ledger.push(record);
  if(ledger.length>400)ledger.splice(0,ledger.length-400);
  return {ok:true,scope,id:info.id,bought:quantity,cost:quantity,credits:s.longplay.credits,
   current:target[field],limit:info.limit,
   message:'Restored '+quantity+' '+(quantity===1?'action':'actions')+' for '+info.label+'.'};
 }
 if(E){E.actionRefillInfo=inspect;E.buyActionsWithCredits=buy;}
 return {inspect,buy,price:quantity=>Number.isSafeInteger(quantity)&&quantity>0?quantity:null,
  earningHelp:'Earn free credits by training pets, advancing evolution, making research discoveries and completing achievements.'};
});
