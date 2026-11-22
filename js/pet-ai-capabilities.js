/* V44: pet cognition is unconditional; AI communication unlocks per species descriptor.
 * The model is a replaceable voice, never the owner of memory.
 */
(function(root){
'use strict';
const E=()=>root.TrialumEngine;
const kinds=new Set(['mini','advanced']);
const valid=req=>!!req&&typeof req==='object'&&
 Number.isSafeInteger(req.petLevel)&&req.petLevel>=1&&
 Number.isSafeInteger(req.labLevel)&&req.labLevel>=0;
function capability(s,p,kind){
 if(!kinds.has(kind)||!p||!s||!Number.isInteger(Number(p.species)))return null;
 const species=E()?.SPECIES?.[Number(p.species)];
 if(!species)return null;
 const visited=new Set();
 function lookup(sp){
  if(!sp||visited.has(sp))return null;
  visited.add(sp);
  // Explicit opt-out is authoritative; absence allows researched descendants to inherit.
  if(Object.hasOwn(sp,'aiAbilities')){
   const req=sp.aiAbilities?.[kind];
   return valid(req)?{petLevel:req.petLevel,labLevel:req.labLevel}:null;
  }
  const parent=Number.isInteger(sp.parentSpecies)?sp.parentSpecies:
   (s.longplay?.invented||[]).find(x=>x.kind==='fauna'&&
     x.speciesIndex===Number(p.species))?.source;
  return Number.isInteger(parent)?lookup(E()?.SPECIES?.[parent]):null;
 }
 return lookup(species);
}
function unlocked(s,p,kind){
 const rule=capability(s,p,kind);
 if(!rule)return false;
 const level=E()?.evolutionProgress?.(p)?.level;
 return Number.isFinite(level)&&level>=rule.petLevel&&
  Number(s?.research?.level||0)>=rule.labLevel;
}
function memory(p){
 // No species, model, subscription, level or consent condition is consulted.
 return root.TrialumCognitiveMemory?.ensure?.(p)||null;
}
const api=Object.freeze({capability,unlocked,memory});
root.TrialumPetAI=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
