/* S6: Use exactly one canonical food source across the lab -> warehouse ->
 * personal home stock -> pet feeding. Installed AFTER longplay so the base
 * and dynamic recipe feeding paths both respect the same personal reserves.
 * NO new storage, no alternate production, no online inventory or timers.
 */
(function(root){
 "use strict";
 const E=root.TrialumEngine,I=root.TrialumWarehouseInventory;
 if(!E||!I||E.TRIALUM_FOOD_SUPPLY_CHAIN)return;
 E.TRIALUM_FOOD_SUPPLY_CHAIN=true;
 const originalFeed=E.feedPrepared,originalCare=E.petCare;
 const fail=message=>({ok:false,message});
 let preparedDepth=0;
 function compatible(s,p,f){return !!(p&&f&&E.feedCompatible(E.SPECIES[p.species],f,p));}
 E.feedPrepared=function(s,petId,recipeId){
  const p=s?.pets?.find(x=>x.id===petId);
  const f=E.foodRecipes?.find(x=>x.id===recipeId);
  if(!p||!f)return fail("Прво избери миленик и валиден рецепт.");
  if(!compatible(s,p,f))return fail("Храната не одговара на видот на миленикот.");
  if(!I.hasPetPortion(s,recipeId,petId))
   return fail("Резервата на миленикот е празна. Снабди го домот од Стовариштето за храна.");
  const before=I.allocation(s,recipeId);
  let result;
  preparedDepth++;
  try{result=originalFeed(s,petId,recipeId);}
  finally{preparedDepth--;}
  if(result?.ok&& !I.consumePetPortion(s,recipeId,petId,before))
   throw Error("Invariant: original prepared-food consumption did not match personal reserve");
  return result;
 };
 E.petCare=function(s,petId,kind){
  if(kind!=="feed"||preparedDepth>0)return originalCare(s,petId,kind);
  const p=s?.pets?.find(x=>x.id===petId);
  if(!p)return originalCare(s,petId,kind);
  const recipe=E.foodRecipes.find(f=>compatible(s,p,f)&&I.hasPetPortion(s,f.id,petId));
  if(!recipe)return fail("Нема храна во личната резерва. Наполни ја од Стовариштето за храна.");
  if(!Number.isFinite(s.biomass))return fail("Невалидна биомаса.");
  const before=I.allocation(s,recipe.id);
  // Basic classic care previously required 3 biomass for freshly synthesizing
  // food on demand. Now food is ALREADY PRODUCED by the food laboratory.
  s.biomass+=3;
  let result;
  try{result=originalCare(s,petId,kind);}
  finally{
   // Original care spends precisely the temporary +3 biomass on success.
   // On failure it spends nothing. Restore the caller's real balance.
   if(!result?.ok)s.biomass-=3;
  }
  if(!result?.ok)return result;
  s.foodFactory.stock[recipe.id]--;
  if(!I.consumePetPortion(s,recipe.id,petId,before))
   throw Error("Invariant: personal basic feeding must consume one original portion");
  E.log(s,"🍽️ "+p.name+" изеде една своја резервна порција "+recipe.name+".","food");
  return result;
 };
})(globalThis);
