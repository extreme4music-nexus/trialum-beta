/* TRIALUM L3.9-A/C/D: canonical, offline plant lifecycle in the ORIGINAL game engine.
 * Runs AFTER engine/evolution/progression/longplay and BEFORE original Classic UI/app.
 * One saved world, one real plant ID, one source of shared elements. 3D is a consumer.
 */
(function(root){
"use strict";
const E=root.TrialumEngine;
if(!E||!E.ensureLongplay)throw Error("Trialum plant engine must load after longplay.js");
const prior={newGame:E.newGame,advance:E.advance,demoNext:E.demoNext,
 plant:E.plant,alerts:E.alerts};
const MAX_STOCK=120,MAX_CATCHUP=365,GARDEN_ACTIONS=4,MAX_GARDEN_PLANTS=24;
const COST=Object.freeze({C:8,N:5,P:3,O:6});
const BEDS=Object.freeze([
 Object.freeze({id:"bed-1",medium:"terrestrial",capacity:5}),
 Object.freeze({id:"bed-2",medium:"terrestrial",capacity:5}),
 Object.freeze({id:"bed-3",medium:"terrestrial",capacity:5}),
 Object.freeze({id:"bed-4",medium:"terrestrial",capacity:5}),
 Object.freeze({id:"aquarium",medium:"aquatic",capacity:4})
]);
const ADDITIVES=Object.freeze([
 Object.freeze({id:"macro-balance",name:"Макро-баланс",medium:"any",level:1,
  cost:Object.freeze({Ca:7,Mg:5,K:6}),yield:1,health:16,hydration:0}),
 Object.freeze({id:"micro-boost",name:"Микро-поттик",medium:"any",level:1,
  cost:Object.freeze({Fe:5,Zn:2,Cu:2}),yield:1,health:12,hydration:0}),
 Object.freeze({id:"hydro-stabilizer",name:"Хидро-стабилизатор",medium:"aquatic",level:3,
  cost:Object.freeze({Na:4,O:8,H:6}),yield:1,health:10,hydration:19}),
 Object.freeze({id:"phyto-regenerator",name:"Фито-регенератор",medium:"any",level:4,
  cost:Object.freeze({C:10,N:6,P:3}),yield:1,health:25,hydration:0})
]);
// Exactly one declared fictional aquatic species; old plant model IDs remain unchanged.
if(!E.PLANTS.some(x=>x.id==="aquaglow"))
 E.PLANTS.push({id:"aquaglow",name:"Аквалум",icon:"🪷",growth:1,oxygen:2.1,
  kind:"Измислена водна флора со светлечки листови",labTier:3,medium:"aquatic"});
const clamp=(n,a=0,b=100)=>Math.min(b,Math.max(a,Number.isFinite(Number(n))?Number(n):a));
const integer=(n,max=MAX_STOCK)=>Math.floor(clamp(n,0,max));
const species=id=>E.PLANTS.find(p=>p.id===id);
const medium=id=>species(id)?.medium==="aquatic"?"aquatic":"terrestrial";
const success=(message,extra)=>({ok:true,message,...extra});
const error=message=>({ok:false,message});
const has=(pool,cost)=>Object.entries(cost).every(([k,n])=>Number.isFinite(Number(pool?.[k]))&&Number(pool[k])>=n);
const spend=(pool,cost)=>{for(const [k,n] of Object.entries(cost))pool[k]-=n;};
const findBed=id=>BEDS.find(b=>b.id===id);
function normalizePlant(p,s,home=false){
 if(!p||typeof p!=="object"||typeof p.id!=="string"||typeof p.species!=="string")return;
 // Migration never changes ID/species/growth of existing plants.
 p.health=clamp(p.health===undefined?82:p.health);
 p.hydration=clamp(p.hydration===undefined?78:p.hydration);
 p.growth=clamp(p.growth);
 p.medium=medium(p.species);
 p.lastWaterDay=Number.isSafeInteger(p.lastWaterDay)?p.lastWaterDay:s.lastDay-1;
 p.lastAdditiveDay=Number.isSafeInteger(p.lastAdditiveDay)?p.lastAdditiveDay:s.lastDay-1;
 p.dead=p.dead===true||p.health===0;
 if(p.dead&&p.deathDay===undefined)p.deathDay=s.lastDay;
 if(home)p.legacyHome=p.legacyHome!==false;
}
function ensure(s){
 if(!s||typeof s!=="object"||!Array.isArray(s.habitats))return null;
 // Dynamic flora species from original Research discoveries are registered by
 // longplay first. Never discard a restored seedling just because its species
 // has not yet been rehydrated after app startup.
 E.ensureLongplay?.(s);
 if(!s.agro||typeof s.agro!=="object"||Array.isArray(s.agro)){
  s.agro={schemaVersion:1,lastProcessedDay:s.lastDay,actionsLeft:GARDEN_ACTIONS,
   seedlings:{},gardenPlants:[],additives:{},journal:[],
   migrationPending:true}; // old saves get one-time no-retroactive-damage grace
 }
 const a=s.agro;
 a.schemaVersion=1;
 if(!Number.isSafeInteger(a.lastProcessedDay))a.lastProcessedDay=s.lastDay;
 if(a.lastProcessedDay>s.lastDay)a.lastProcessedDay=s.lastDay;
 a.actionsLeft=integer(a.actionsLeft,GARDEN_ACTIONS);
 if(!a.seedlings||typeof a.seedlings!=="object"||Array.isArray(a.seedlings))a.seedlings={};
 for(const key of Object.keys(a.seedlings)){
  if(!species(key))delete a.seedlings[key];
  else a.seedlings[key]=integer(a.seedlings[key]);
 }
 if(!a.additives||typeof a.additives!=="object"||Array.isArray(a.additives))a.additives={};
 for(const key of Object.keys(a.additives)){
  if(!ADDITIVES.some(r=>r.id===key))delete a.additives[key];
  else a.additives[key]=integer(a.additives[key]);
 }
 if(!Array.isArray(a.journal))a.journal=[];
 if(a.journal.length>90)a.journal=a.journal.slice(-90);
 if(!Array.isArray(a.gardenPlants))a.gardenPlants=[];
 if(a.gardenPlants.length>MAX_GARDEN_PLANTS)a.gardenPlants=a.gardenPlants.slice(0,MAX_GARDEN_PLANTS);
 const ids=new Set();
 for(const h of s.habitats){
  if(!Array.isArray(h.flora))h.flora=[];
  for(const p of h.flora){normalizePlant(p,s,true);if(p?.id)ids.add(p.id);}
 }
 // Invalid/duplicate greenhouse records never duplicate an existing habitat plant.
 a.gardenPlants=a.gardenPlants.filter(p=>{
  if(!p||typeof p.id!=="string"||!species(p.species)||ids.has(p.id)||!findBed(p.bedId))return false;
  if(findBed(p.bedId).medium!==medium(p.species))return false;
  ids.add(p.id);normalizePlant(p,s);
  return true;
 });
 return a;
}
function findPlant(s,id){
 if(typeof id!=="string"||id.length>100)return null;
 const a=ensure(s);
 if(!a)return null;
 const item=a.gardenPlants.find(x=>x.id===id);
 if(item)return {plant:item,where:"garden",bed:findBed(item.bedId)};
 for(const h of s.habitats){
  const plant=h.flora.find(x=>x.id===id);
  if(plant)return {plant,where:"home",habitat:h};
 }
 return null;
}
function journal(s,kind,plant,textValue){
 const a=s.agro;
 a.journal.push({day:s.lastDay,kind,plantId:String(plant?.id||"").slice(0,100),
  message:String(textValue).slice(0,160)});
 if(a.journal.length>90)a.journal.splice(0,a.journal.length-90);
 E.log(s,textValue,kind==="death"?"habitat":"milestone");
}
function takeAction(s,found){
 const a=s.agro;
 if(found.where==="garden")a.actionsLeft--;
 else found.habitat.dayActions--;
}
function actions(s,found){
 return found.where==="garden"?s.agro.actionsLeft:found.habitat.dayActions;
}
function produceSeedling(s,id){
 const a=ensure(s),model=species(id);
 if(!a||!model)return error("Непознат растителен вид.");
 if(!s.blueprints.includes(id))return error("Прво отклучи го растителниот модел во Флора лабораторијата.");
 if(s.labActions<1)return error("Нема слободни лабораториски акции за расад.");
 if((a.seedlings[id]||0)>=MAX_STOCK)return error("Складиштето за расади е полно.");
 if(!has(s.elements,COST))return error("Недостигаат C8, N5, P3 и O6 за вистински расад.");
 spend(s.elements,COST);s.labActions--;a.seedlings[id]=(a.seedlings[id]||0)+1;
 journal(s,"seedling",null,"🌱 Создаден еден расад: "+model.name+".");
 return success("Создаден е еден расад од "+model.name+".",{species:id,stock:a.seedlings[id]});
}
function plantInGarden(s,id,bedId){
 const a=ensure(s),model=species(id),bed=findBed(bedId);
 if(!a||!model||!bed)return error("Избери вистински вид и леа.");
 if(!s.blueprints.includes(id))return error("Моделот не е отклучен.");
 if(medium(id)!==bed.medium)return error("Овој вид не припаѓа во избраната сува или водна леа.");
 if((a.seedlings[id]||0)<1)return error("Нема произведен расад за ова растение.");
 if(a.actionsLeft<1)return error("Нема градинарски акции за денес.");
 if(a.gardenPlants.filter(x=>x.bedId===bed.id).length>=bed.capacity||
    a.gardenPlants.length>=MAX_GARDEN_PLANTS)return error("Леата е полна.");
 s.sequence=(Number(s.sequence)||0)+1;
 const plant={id:"agro-plant-"+s.sequence,species:id,bedId:bed.id,medium:bed.medium,
  growth:3,health:82,hydration:72,lastWaterDay:s.lastDay-1,
  lastAdditiveDay:s.lastDay-1,plantedDay:s.lastDay,dead:false};
 a.seedlings[id]--;a.actionsLeft--;a.gardenPlants.push(plant);
 journal(s,"garden",plant,"🌱 "+model.name+" е засадено во "+bed.id+".");
 return success("Расадот е засаден во градината.",{plantId:plant.id});
}
function waterPlant(s,id){
 const found=findPlant(s,id);
 if(!found)return error("Непознато растение.");
 const p=found.plant;
 if(p.dead)return error("Угинатото растение не може да се наводнува.");
 if(p.lastWaterDay>=s.lastDay)return error("Растението веќе е наводнето денес.");
 if(actions(s,found)<1)return error("Нема слободни акции за нега.");
 takeAction(s,found);
 p.hydration=clamp(p.hydration+43);
 p.lastWaterDay=s.lastDay;
 journal(s,"water",p,"💧 Наводнето растение: "+species(p.species).name+".");
 return success("Растението е наводнето.",{plantId:id,hydration:p.hydration});
}
function transplantPlant(s,id,habitatId){
 const found=findPlant(s,id);
 if(!found||found.where!=="garden")return error("Избери живо растение од градината.");
 const p=found.plant,h=s.habitats.find(z=>z.id===habitatId);
 if(!h)return error("Целното живеалиште не постои.");
 if(p.dead||p.health<=0)return error("Угинато растение не може да се пресади.");
 if(p.growth<85||p.health<50)return error("Растението сè уште не е доволно зрело и здраво за пресадување.");
 if((h.flora||[]).length>=Math.max(6,Number(h.floraSlots)||6))
  return error("Нема слободно место во избраното живеалиште.");
 if(h.dayActions<1)return error("Нема слободни акции за ова живеалиште.");
 // Species may exist in any fictional habitat; aquatic species require lagoon.
 if(p.medium==="aquatic"&&h.biome!=="lagoon")
  return error("Водните растенија бараат лагунско живеалиште.");
 const a=s.agro,index=a.gardenPlants.findIndex(z=>z.id===id);
 if(index<0)return error("Растението е веќе преместено.");
 a.gardenPlants.splice(index,1);delete p.bedId;p.habitatId=h.id;p.legacyHome=false;
 h.flora.push(p);h.dayActions--;
 journal(s,"transplant",p,"🏡 "+species(p.species).name+" е пресадено во "+h.name+".");
 return success("Зрелото растение е пресадено во "+h.name+".",{plantId:id,habitatId});
}
function craftAdditive(s,id){
 const a=ensure(s),recipe=ADDITIVES.find(r=>r.id===id);
 if(!a||!recipe)return error("Непознат фитолаб адитив.");
 if((s.research?.level||0)<recipe.level)return error("Потребно е Флора истражување ниво "+recipe.level+".");
 if(s.labActions<1)return error("Нема лабораториски акции.");
 if((a.additives[id]||0)+recipe.yield>MAX_STOCK)return error("Складиштето за адитиви е полно.");
 if(!has(s.elements,recipe.cost))return error("Недостигаат вистински заеднички микро/макроелементи.");
 spend(s.elements,recipe.cost);s.labActions--;
 a.additives[id]=(a.additives[id]||0)+recipe.yield;
 journal(s,"additive",null,"🧪 Произведен адитив: "+recipe.name+".");
 return success("Произведен "+recipe.name+".",{recipeId:id,stock:a.additives[id]});
}
function applyAdditive(s,plantId,recipeId){
 const found=findPlant(s,plantId),recipe=ADDITIVES.find(r=>r.id===recipeId);
 if(!found||!recipe)return error("Непознато растение или средство.");
 const p=found.plant,a=s.agro;
 if(p.dead||p.health<=0)return error("Угинатото растение не може да се третира.");
 if(recipe.medium!=="any"&&recipe.medium!==p.medium)return error("Ова средство е само за водни растенија.");
 if((s.research?.level||0)<recipe.level)return error("Средството не е отклучено.");
 if(!Number.isSafeInteger(a.additives[recipeId])||a.additives[recipeId]<1)
  return error("Нема произведен адитив во складиштето.");
 if(p.lastAdditiveDay>=s.lastDay)return error("Растението веќе има добиено адитив денес.");
 if(actions(s,found)<1)return error("Нема слободни акции за нега.");
 takeAction(s,found);a.additives[recipeId]--;
 p.health=clamp(p.health+recipe.health);
 p.hydration=clamp(p.hydration+recipe.hydration);
 p.lastAdditiveDay=s.lastDay;
 journal(s,"treat",p,"🌿 "+species(p.species).name+" е третирано со "+recipe.name+".");
 return success("Растителното здравје е подобрено.",{plantId,health:p.health});
}
function removeDeadPlant(s,id){
 const found=findPlant(s,id);
 if(!found||!found.plant.dead)return error("Може да се отстрани само угинато растение.");
 if(actions(s,found)<1)return error("Нема слободни акции за отстранување.");
 takeAction(s,found);
 const list=found.where==="garden"?s.agro.gardenPlants:found.habitat.flora;
 const index=list.findIndex(z=>z.id===id);if(index<0)return error("Растението не е пронајдено.");
 const [removed]=list.splice(index,1);
 journal(s,"remove",removed,"🍂 Отстранет угинат примерок: "+removed.id+".");
 return success("Угинатото растение е отстрането.",{plantId:id});
}
function tickPlant(s,p,day,homeHabitat){
 if(p.dead)return;
 const model=species(p.species);
 if(!model)return;
 const hydLoss=p.medium==="aquatic"?8:16;
 p.hydration=clamp(p.hydration-hydLoss);
 const lowMinerals=homeHabitat?
   (homeHabitat.minerals?.macro||0)<30||(homeHabitat.minerals?.micro||0)<25:false;
 const lowWater=p.hydration<38,critical=p.hydration<15;
 let damage=(lowWater?(critical?13:8):0)+(lowMinerals?3:0);
 if(homeHabitat&&(homeHabitat.chem?.toxins||0)>65)damage+=3;
 if(damage>0)p.health=clamp(p.health-damage);
 else p.health=clamp(p.health+1);
 if(p.health===0){
  p.dead=true;p.deathDay=day;p.deathCause=lowWater?"neglected_water":
    lowMinerals?"nutrient_deficiency":"habitat_stress";
  journal(s,"death",p,"🍂 Угинато растение: "+model.name+" (ден "+day+").");
  return;
 }
 if(p.health>=35&&p.hydration>=22)
  p.growth=clamp(p.growth+Math.max(.6,Number(model.growth)||1)*2.5*(p.health/100));
}
function processDays(s){
 const a=ensure(s);
 if(!a)return;
 const count=Math.min(MAX_CATCHUP,Math.max(0,s.lastDay-a.lastProcessedDay));
 // Intentional bounded catchup: engine's own offline cap is also 365 days.
 const from=a.lastProcessedDay+1;
 for(let day=from;day<from+count;day++){
  a.actionsLeft=GARDEN_ACTIONS;
  for(const p of a.gardenPlants)tickPlant(s,p,day,null);
  for(const h of s.habitats)for(const p of h.flora)tickPlant(s,p,day,h);
 }
 a.lastProcessedDay=s.lastDay;
 if(count===0)return;
}
E.ensureAgro=ensure;
E.agroBeds=BEDS;E.agroAdditiveRecipes=ADDITIVES;E.agroSeedlingCost=COST;
E.produceSeedling=produceSeedling;
E.plantInGarden=plantInGarden;E.waterPlant=waterPlant;
E.transplantPlant=transplantPlant;
E.craftAdditive=craftAdditive;E.applyAdditive=applyAdditive;
E.removeDeadPlant=removeDeadPlant;E.findPlant=findPlant;
E.plant=(s,id)=>{ensure(s);return error("Прво произведи расад, одгледај го во градината и пресади зрело растение во живеалиштето.");};
E.newGame=(...args)=>{
 const s=prior.newGame(...args);ensure(s);
 s.agro.migrationPending=false; // fresh worlds have no old flora to protect.
 return s;
};
E.advance=(s,now)=>{
 const a=ensure(s),migrated=a?.migrationPending===true;
 const result=prior.advance(s,now);
 if(migrated){
  // Old backup may have weeks/months of offline time. Previously saved plants
  // never suffer instant retroactive death when this schema first appears.
  a.lastProcessedDay=s.lastDay;a.actionsLeft=GARDEN_ACTIONS;
  a.migrationPending=false;
 }else processDays(s);
 return result;
};
E.demoNext=s=>{
 const a=ensure(s),migrated=a?.migrationPending===true;
 const result=prior.demoNext(s);
 if(migrated){a.lastProcessedDay=s.lastDay;a.migrationPending=false;}
 else processDays(s);
 return result;
};
E.alerts=s=>{
 const alerts=prior.alerts(s),a=ensure(s);
 if(!a)return alerts;
 for(const p of [...a.gardenPlants,...s.habitats.flatMap(h=>h.flora)]){
  if(p.dead)continue;
  if(p.health<40||p.hydration<28)alerts.push({
   type:"plant-care",plantId:p.id,level:p.health<24?"high":"medium",
   text:(p.health<24?"🍂 Критично здравје: ":"💧 Потребна растителна нега: ")+
    (species(p.species)?.name||p.species)+" · "+Math.round(p.health)+"% здравје."
  });
 }
 return alerts;
};
root.TrialumPlantLifecycle=Object.freeze({
 ensure,findPlant,produceSeedling,plantInGarden,waterPlant,transplantPlant,
 craftAdditive,applyAdditive,removeDeadPlant,BEDS,ADDITIVES,COST,processDays
});
if(typeof module==="object"&&module.exports)module.exports=root.TrialumPlantLifecycle;
})(typeof globalThis!=="undefined"?globalThis:this);
