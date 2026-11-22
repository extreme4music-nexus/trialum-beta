/* V44: trusted, versioned, searchable knowledge from live game definitions.
 * No user messages, account data, private AI transcripts or server internals.
 */
(function(root){
'use strict';
const VERSION=1,MAX_ENTRIES=4000;
const E=()=>root.TrialumEngine;
const safe=(v,n=110)=>String(v??'').replace(/[\u0000-\u001f\u007f<>]/g,'').slice(0,n);
function catalog(){
 const e=E()||{},out=[],seen=new Set();
 const add=(type,id,label,description='',extra={})=>{
  const key=type+':'+safe(id,70);if(seen.has(key)||out.length>=MAX_ENTRIES)return;
  seen.add(key);out.push({id:key,type,name:safe(label,80),description:safe(description,160),...extra});
 };
 for(const [i,label] of (e.PHASES||[]).entries())add('phase',i,label,'Еволуциска фаза / evolution phase');
 for(const [i,sp] of (e.SPECIES||[]).entries()){
  if(!sp)continue;
  add('species',i,sp.name,sp.description||'Фантастичен вид во светот', {speciesId:i,habitat:safe(sp.habitat,32)});
 }
 for(const sp of e.PLANTS||[])if(sp?.id)add('plant',sp.id,sp.name,sp.kind||'',{lab:sp.labTier||0});
 for(const bi of e.BIOMES||[])if(bi?.id)add('biome',bi.id,bi.name,'Живеалиште / biome');
 for(const food of e.foodRecipes||[])if(food?.id)add('food',food.id,food.name,food.desc||food.description||'',{lab:food.tier||0});
 for(const t of e.researchFields||[])if(t?.id)add('research',t.id,t.name,'Лабораториска дисциплина / research');
 for(const t of e.longplayTech||[])if(t?.id)add('technology',t.id,t.name,t.description||'Лабораториска технологија');
 for(const t of root.TrialumPlayground?.TOYS||[])if(t?.id)add('toy',t.id,t.name,t.desc||'',{lab:t.lab||0});
 for(const t of e.longplayLineages||[])if(t?.id!==undefined)add('lineage',t.id,e.SPECIES?.[t.id]?.name||String(t.id),t.description||'',{lab:t.lab||0});
 add('rule','pet_memory','Доживотна меморија / lifelong memory',
  'Секое милениче памети независно од AI. Постарите контекстуални сеќавања се консолидираат.');
 add('rule','ai_unlock','AI разговор / AI communication',
  'AI разговорот се отклучува преку развој и лабораторија и бара согласност и достапен локален модел.');
 return out;
}
function search(prompt,{limit=4}={}){
 const items=catalog(),q=safe(prompt,360).toLowerCase();
 const tokens=(q.match(/[\p{L}\p{N}]{3,}/gu)||[]).slice(0,15);
 const types={
  species:/вид|миленич|суштеств|species|creature|pet|dna|днк/i,
  food:/хран|јад|food|eat|feed|meal/i,
  plant:/растени|цвет|plant|flower/i,
  biome:/живеалиш|хабитат|biome|habitat/i,
  research:/лабора|наук|истраж|research|lab/i,
  phase:/еволуц|фаз|evolution|phase/i,
  toy:/игротек|лизгал|базен|играч|playground|toy/i,
  technology:/технол|technolog/i
 };
 const selected=Object.entries(types).filter(([,r])=>r.test(q)).map(([key])=>key);
 const scored=items.map((v,i)=>{
  const name=v.name.toLowerCase(),desc=v.description.toLowerCase(),id=v.id.toLowerCase();
  const matched=tokens.reduce((n,x)=>n+(name.includes(x)?6:0)+(id.includes(x)?4:0)+(desc.includes(x)?1:0),0);
  return {v,i,score:matched+(selected.includes(v.type)?2:0)};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.i-b.i);
 const cap=Math.max(0,Math.min(8,Math.floor(Number(limit)||0)));
 return scored.slice(0,cap).map(({v})=>v);
}
function coverage(){
 const e=E()||{},items=catalog();
 const count=t=>items.filter(x=>x.type===t).length;
 return {version:VERSION,species:count('species'),plants:count('plant'),biomes:count('biome'),
  phases:count('phase'),foods:count('food'),toys:count('toy'),
  expected:{species:(e.SPECIES||[]).filter(Boolean).length,plants:(e.PLANTS||[]).filter(Boolean).length,
   biomes:(e.BIOMES||[]).filter(Boolean).length,phases:(e.PHASES||[]).length}};
}
const api={VERSION,catalog,search,coverage};
root.TrialumGameKnowledge=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
