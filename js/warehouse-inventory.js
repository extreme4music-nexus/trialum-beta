/* Trialum single-source food supply chain.
 * foodFactory.stock is the ONE canonical aggregate; warehouseBins (rack, cold,
 * packing, hand) and petReserves (petId -> recipeId) are LOCATION ALLOCATIONS.
 * All locations reconcile to the canonical total; no duplicate inventory.
 * JSON-serializable in the existing original state/backup; no new storage.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 root.TrialumWarehouseInventory=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
 "use strict";
 const ZONES=Object.freeze(["rack","cold","packing","hand"]);
 const WAREHOUSE=Object.freeze(["rack","cold","packing"]);
 const MAX=100000000;
 const cap=n=>Number.isSafeInteger(n)&&n>=0&&n<=MAX?n:0;
 const safeId=id=>typeof id==="string"&&id.length<=100&&/^[a-z0-9][a-z0-9_-]*$/i.test(id);
 const safeRecipe=id=>safeId(id)&&id.length<=32;
 const empty=()=>({rack:0,cold:0,packing:0,hand:0});
 const count=(o,k)=>cap(Number(o?.[k]));
 const truth=(s,id)=>count(s?.foodFactory?.stock,id);
 const pets=s=>Array.isArray(s?.pets)?s.pets.filter(p=>safeId(p?.id)):[];
 const totalBins=b=>ZONES.reduce((n,k)=>n+b[k],0);
 const totalPet=p=>Object.values(p).reduce((n,v)=>n+v,0);
 const validRecipe=(recipes,id)=>safeRecipe(id)&&Array.isArray(recipes)&&recipes.some(r=>r.id===id);
 function ledger(s,id){
  const total=truth(s,id),existing=new Set(pets(s).map(p=>p.id));
  const reserves={};
  const rawPet=s?.foodFactory?.petReserves;
  for(const petId of [...existing].sort())reserves[petId]=count(rawPet?.[petId],id);
  const reserved=totalPet(reserves);
  const raw=s?.foodFactory?.warehouseBins?.[id];
  // Older saves have neither split-bin placements nor pet reserves.
  // If only pet reserves exist, their already-owned portions CANNOT be minted
  // a second time on the warehouse shelf.
  const bins=raw&&typeof raw==="object"?
   Object.fromEntries(ZONES.map(k=>[k,count(raw,k)])):
   {...empty(),rack:Math.max(0,total-reserved)};
  let sum=totalBins(bins)+reserved;
  if(sum>total){
   let excess=sum-total;
   for(const zone of ["rack","packing","cold","hand"]){
    const remove=Math.min(excess,bins[zone]);bins[zone]-=remove;excess-=remove;
   }
   for(const petId of Object.keys(reserves).sort()){
    if(!excess)break;
    const remove=Math.min(excess,reserves[petId]);
    reserves[petId]-=remove;excess-=remove;
   }
  }else if(sum<total){
   bins.rack+=total-sum; // genuine new production enters warehouse
  }
  return {bins,reserves,stock:total,warehouse:totalBins(bins)};
 }
 function write(s,id,data){
  const f=s.foodFactory;
  if(!f.warehouseBins||typeof f.warehouseBins!=="object"||Array.isArray(f.warehouseBins))
    f.warehouseBins={};
  if(!f.petReserves||typeof f.petReserves!=="object"||Array.isArray(f.petReserves))
    f.petReserves={};
  f.warehouseBins[id]={...data.bins};
  const valid=new Set(pets(s).map(p=>p.id));
  for(const existingId of Object.keys(f.petReserves)){
   if(!valid.has(existingId)){delete f.petReserves[existingId];continue;}
   if(!f.petReserves[existingId]||typeof f.petReserves[existingId]!=="object")
    f.petReserves[existingId]={};
   f.petReserves[existingId][id]=cap(data.reserves[existingId]);
  }
  for(const petId of valid){
   if(!f.petReserves[petId])f.petReserves[petId]={};
   f.petReserves[petId][id]=cap(data.reserves[petId]);
  }
 }
 function reconcileOne(s,id,mutate=false){
  const a=ledger(s,id);if(mutate)write(s,id,a);
  return {...a.bins};
 }
 function project(s,recipes,petId){
  return (Array.isArray(recipes)?recipes:[]).filter(r=>safeRecipe(r.id)).map(r=>{
   const a=ledger(s,r.id);
   return {id:r.id,name:String(r.name||r.id).slice(0,68),
    stock:a.stock,warehouse:a.warehouse,petReserve:petId?cap(a.reserves[petId]):0,
    ...a.bins};
  });
 }
 function petView(s,recipes,petId){
  if(!pets(s).some(p=>p.id===petId))return [];
  return project(s,recipes,petId);
 }
 function action(s,recipes,{op,recipe,from,to}={}){
  if(!s?.foodFactory?.stock||!validRecipe(recipes,recipe))return {ok:false,message:"Непозната храна или невалиден свет."};
  if(!["take","put"].includes(op))return {ok:false,message:"Недозволена операција."};
  if(op==="take"&&(!WAREHOUSE.includes(from)||to!=="hand"))return {ok:false,message:"Избери полица, ладилник или пакување."};
  if(op==="put"&&(from!=="hand"||!WAREHOUSE.includes(to)))return {ok:false,message:"Избери место каде ќе ја оставиш порцијата."};
  const a=ledger(s,recipe);
  if(a.bins[from]<1)return {ok:false,message:"Нема порција на избраното место."};
  a.bins[from]--;a.bins[to]++;
  write(s,recipe,a);
  return {ok:true,message:op==="take"?"Земена е една вистинска порција.":"Порцијата е оставена во избраната просторија."};
 }
 function transferPet(s,recipes,{op,recipe,petId,zone="rack",amount=1}={},compatible){
  const pet=pets(s).find(p=>p.id===petId);
  if(!s?.foodFactory?.stock||!pet||!validRecipe(recipes,recipe))
   return {ok:false,message:"Непознат миленик или храна."};
  if(!["supply","return"].includes(op)||!WAREHOUSE.includes(zone)||
   !Number.isSafeInteger(amount)||amount<1||amount>5)
   return {ok:false,message:"Дозволени се 1–5 порции и валидна магацинска зона."};
  const formula=recipes.find(r=>r.id===recipe);
  if(op==="supply"&&(typeof compatible!=="function"||compatible(pet,formula)!==true))
   return {ok:false,message:"Оваа храна не одговара на избраниот миленик."};
  if(!s.habitats?.some(h=>h.id===pet.habitatId))
   return {ok:false,message:"Миленикот нема активен дом за резерви."};
  const a=ledger(s,recipe);
  const n=cap(a.reserves[petId]);
  if(op==="supply"){
   if(a.bins[zone]<amount)return {ok:false,message:"Нема доволно порции во магацинот."};
   a.bins[zone]-=amount;a.reserves[petId]=n+amount;
  }else{
   if(n<amount)return {ok:false,message:"Нема толку порции во резервата на миленикот."};
   a.reserves[petId]=n-amount;a.bins[zone]+=amount;
  }
  write(s,recipe,a);
  return {ok:true,message:op==="supply"?
   "Доставени се "+amount+" порции од магацинот во домот на миленикот.":
   "Вратени се "+amount+" порции во магацинот."};
 }
 function hasPetPortion(s,recipe,petId){
  if(!safeRecipe(recipe)||!safeId(petId))return false;
  return ledger(s,recipe).reserves[petId]>=1&&truth(s,recipe)>=1;
 }
 // CALL ONLY AFTER the original E.feedPrepared/E.petCare succeeds and has
 // decreased foodFactory.stock by exactly one. Preserve the pre-action
 // allocation so reconciling an already-decremented total cannot discard a
 // different pet's food.
 function consumePetPortion(s,recipe,petId,preActionAllocation){
  if(!s?.foodFactory||!preActionAllocation||
   !Number.isSafeInteger(preActionAllocation.stock)||
   preActionAllocation.stock-truth(s,recipe)!==1||
   cap(preActionAllocation.reserves?.[petId])<1)return false;
  const a={
   stock:truth(s,recipe),bins:{...preActionAllocation.bins},
   reserves:{...preActionAllocation.reserves}
  };
  a.reserves[petId]--;
  write(s,recipe,a);
  return true;
 }
 function allocation(s,recipe){return ledger(s,recipe);}
 function snapshotFromProjection(food){
  const rs=Array.isArray(food?.recipes)?food.recipes:[];
  return rs.map(r=>({id:r.id,name:r.name,stock:cap(r.stock),warehouse:cap(r.warehouse),
   rack:cap(r.rack),cold:cap(r.cold),packing:cap(r.packing),hand:cap(r.hand),
   petReserve:cap(r.petReserve)}));
 }
 return Object.freeze({ZONES,WAREHOUSE,project,petView,action,transferPet,
  reconcileOne,allocation,hasPetPortion,consumePetPortion,snapshotFromProjection});
});
