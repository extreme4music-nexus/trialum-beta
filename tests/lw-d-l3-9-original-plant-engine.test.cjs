"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const E=require("../js/engine.js");
require("../js/evolution.js");
require("../js/progression.js");
require("../js/longplay.js");
const Agro=require("../js/plant-lifecycle.js");
const UI=require("../js/plant-lifecycle-ui.js");
const FIXED=1700000000000;
function world(){
 const s=E.newGame("real",FIXED);
 s.stage=7;s.insight=1400;s.compounds=1400;s.labActions=6;
 s.research.level=7;
 for(const atom of Object.keys(s.elements))s.elements[atom]=500;
 s.habitats=[{id:"garden-home-qa",name:"Живеалиште",biome:"garden",capacity:12,
  minerals:{macro:80,micro:85},chem:{ph:7.1,temp:24,oxygen:89,toxins:2},
  cleanliness:90,flora:[],dayActions:4,floraSlots:8,bornDay:1},
  {id:"lagoon-home-qa",name:"Лагуна",biome:"lagoon",capacity:10,
   minerals:{macro:80,micro:80},chem:{ph:7.1,temp:24,oxygen:90,toxins:2},
   cleanliness:90,flora:[],dayActions:4,floraSlots:8,bornDay:1}];
 s.activeHabitat="garden-home-qa";
 E.ensureLongplay(s);
 E.ensureAgro(s);
 assert.equal(E.validate(s),true);
 return s;
}
function grow(s,days,id){
 for(let i=0;i<days;i++){s.mode="demo";s.demoDay=s.lastDay;const ok=E.demoNext(s);
   assert.equal(ok.ok,true,ok.message);}
 return Agro.findPlant(s,id)?.plant;
}
test("canonical original-game engine and Classic UI are really integrated into Android/PWA offline, not standalone 3D mock",()=>{
 const html=read("index.html");
 assert.match(html,/js\/longplay\.js"><\/script><script src="js\/plant-lifecycle\.js"><\/script><script src="js\/plant-lifecycle-ui\.js"/);
 assert.match(read("js/longplay-ui.js"),/plants:s=>root\.TrialumPlantUI\?\.render\(s\)/);
 const app=read("js/app.js");
 for(const op of ["agroSeed","agroPlant","agroWater","agroTransplant","agroCraft","agroTreat","agroRemove"])assert.ok(app.includes("case '"+op+"'"),op);
 assert.match(read("sw.js"),/js\/plant-lifecycle\.js/);
 assert.match(read("sw.js"),/js\/plant-lifecycle-ui\.js/);
 assert.match(read("js/engine.js"),/livingFlora/);
 assert.match(read("js/engine.js"),/s\.agro\?\.schemaVersion!==1/);
 assert.equal(typeof E.plantInGarden,"function");
});
test("unlock only creates blueprint, old direct home planting is gated, and no fake seedling exists",()=>{
 const s=world(),h=s.habitats[0];
 const first=E.inventPlant(s,"glowfern");assert.equal(first.ok,true,first.message);
 assert.ok(s.blueprints.includes("glowfern"));
 assert.equal(s.agro.seedlings.glowfern||0,0);
 const old={...s.elements},actions=h.dayActions;
 const blocked=E.plant(s,"glowfern");
 assert.equal(blocked.ok,false);
 assert.equal(h.flora.length,0);
 assert.deepEqual(s.elements,old);
 assert.equal(h.dayActions,actions);
});
test("real nursery spends original full elemental seed cost only on success; rejected requests are atomic",()=>{
 const s=world();
 assert.equal(E.produceSeedling(s,"glowfern").ok,false);
 assert.equal(E.inventPlant(s,"glowfern").ok,true);
 const before={...s.elements},lab=s.labActions;
 assert.equal(E.produceSeedling(s,"glowfern").ok,true);
 for(const [atom,n] of Object.entries(E.agroSeedlingCost))assert.equal(s.elements[atom],before[atom]-n,atom);
 assert.equal(s.labActions,lab-1);assert.equal(s.agro.seedlings.glowfern,1);
 s.elements.C=0;const snapshot=JSON.stringify(s.elements),a=s.labActions;
 assert.equal(E.produceSeedling(s,"glowfern").ok,false);
 assert.equal(JSON.stringify(s.elements),snapshot);assert.equal(s.labActions,a);
 assert.equal(s.agro.seedlings.glowfern,1);
});
test("greenhouse beds use exact seedling stock, no double plant, bounded capacity and media",()=>{
 const s=world();assert.equal(E.inventPlant(s,"glowfern").ok,true);
 assert.equal(E.plantInGarden(s,"glowfern","bed-1").ok,false);
 assert.equal(E.produceSeedling(s,"glowfern").ok,true);
 assert.equal(E.plantInGarden(s,"glowfern","aquarium").ok,false);
 const r=E.plantInGarden(s,"glowfern","bed-1");assert.equal(r.ok,true,r.message);
 assert.equal(s.agro.seedlings.glowfern,0);
 assert.equal(s.agro.gardenPlants.length,1);
 assert.equal(s.agro.gardenPlants[0].id,r.plantId);
 assert.equal(E.plantInGarden(s,"glowfern","bed-1").ok,false,"cannot reuse already spent seedling");
 const second=E.plantInGarden(s,"glowfern","no-such-bed");assert.equal(second.ok,false);
 assert.equal(s.agro.gardenPlants.length,1);
});
test("real aquatic species only grows in separate in-ground pool; greenhouse-to-habitat transfer requires matching lagoon",()=>{
 const s=world();
 const r=E.inventPlant(s,"aquaglow");assert.equal(r.ok,true,r.message);
 assert.equal(E.produceSeedling(s,"aquaglow").ok,true);
 assert.equal(E.plantInGarden(s,"aquaglow","bed-2").ok,false);
 const plant=E.plantInGarden(s,"aquaglow","aquarium");
 assert.equal(plant.ok,true,plant.message);
 const p=Agro.findPlant(s,plant.plantId).plant;p.growth=95;p.health=90;
 assert.equal(E.transplantPlant(s,p.id,"garden-home-qa").ok,false);
 const transfer=E.transplantPlant(s,p.id,"lagoon-home-qa");
 assert.equal(transfer.ok,true,transfer.message);
 assert.ok(s.habitats[1].flora.some(x=>x.id===p.id));
 assert.equal(s.agro.gardenPlants.some(x=>x.id===p.id),false);
 assert.equal(E.transplantPlant(s,p.id,"lagoon-home-qa").ok,false);
});
test("watering and purchased phyto-additives modify only the actual plant and spend canonical shared elements",()=>{
 const s=world();assert.equal(E.inventPlant(s,"lumemoss").ok,true);
 assert.equal(E.produceSeedling(s,"lumemoss").ok,true);
 const id=E.plantInGarden(s,"lumemoss","bed-1").plantId;
 const p=Agro.findPlant(s,id).plant;p.hydration=22;p.health=40;
 const old={...s.elements},actions=s.labActions;
 assert.equal(E.craftAdditive(s,"macro-balance").ok,true);
 for(const [atom,n] of Object.entries({Ca:7,Mg:5,K:6}))assert.equal(s.elements[atom],old[atom]-n);
 assert.equal(s.labActions,actions-1);
 assert.equal(s.agro.additives["macro-balance"],1);
 const before=s.agro.actionsLeft;
 assert.equal(E.applyAdditive(s,id,"macro-balance").ok,true);
 assert.equal(p.health,56);assert.equal(s.agro.additives["macro-balance"],0);
 assert.equal(s.agro.actionsLeft,before-1);
 assert.equal(E.applyAdditive(s,id,"macro-balance").ok,false,"must not spend twice");
 const water=E.waterPlant(s,id);assert.equal(water.ok,true,water.message);
 assert.ok(p.hydration>22);
 assert.equal(E.waterPlant(s,id).ok,false,"same-day double tap denied");
});
test("phyto crafting without full materials never spends partial, no phantom additives, no real money",()=>{
 const s=world();
 s.elements.Ca=0;s.elements.Mg=100;s.elements.K=100;
 const before={...s.elements},a=s.labActions;
 assert.equal(E.craftAdditive(s,"macro-balance").ok,false);
 assert.deepEqual(s.elements,before);
 assert.equal(s.labActions,a);
 assert.equal(s.agro.additives["macro-balance"]||0,0);
 assert.equal(E.craftAdditive(s,"fake").ok,false);
 assert.doesNotMatch(read("js/plant-lifecycle.js"),/fetch\(|localStorage|indexedDB|billing|createPurchase/);
});
test("garden growth, gradual neglect, warnings and genuine death are saved; dead plants never heal/transplant",()=>{
 const s=world();
 assert.equal(E.inventPlant(s,"glowfern").ok,true);
 assert.equal(E.produceSeedling(s,"glowfern").ok,true);
 const id=E.plantInGarden(s,"glowfern","bed-1").plantId;
 const p=Agro.findPlant(s,id).plant,original=p.growth;
 grow(s,1,id);assert.ok(p.growth>original);
 assert.equal(p.dead,false);
 grow(s,6,id);assert.ok(p.hydration<30);
 const warnings=E.alerts(s);
 assert.ok(warnings.some(x=>x.type==="plant-care"&&x.plantId===id));
 grow(s,18,id);
 assert.equal(p.dead,true);
 assert.equal(p.health,0);
 assert.ok(p.deathDay>1);
 const deaths=s.agro.journal.filter(x=>x.kind==="death"&&x.plantId===id);
 assert.equal(deaths.length,1);
 const d=p.deathDay;
 E.advance(s,FIXED);
 assert.equal(p.deathDay,d);
 assert.equal(E.waterPlant(s,id).ok,false);
 assert.equal(E.applyAdditive(s,id,"macro-balance").ok,false);
 assert.equal(E.transplantPlant(s,id,"garden-home-qa").ok,false);
});
test("mature plant transplants exactly once with original ID, in actual home, and keeps plant care",()=>{
 const s=world();assert.equal(E.inventPlant(s,"glowfern").ok,true);
 assert.equal(E.produceSeedling(s,"glowfern").ok,true);
 const id=E.plantInGarden(s,"glowfern","bed-1").plantId;
 const p=Agro.findPlant(s,id).plant;
 assert.equal(E.transplantPlant(s,id,"garden-home-qa").ok,false,"not mature");
 p.growth=90;p.health=90;
 const before=s.habitats[0].flora.length;
 const r=E.transplantPlant(s,id,"garden-home-qa");
 assert.equal(r.ok,true,r.message);
 assert.equal(s.habitats[0].flora.length,before+1);
 assert.equal(s.habitats[0].flora.at(-1),p,"same living object/identity");
 assert.equal(s.agro.gardenPlants.find(x=>x.id===id),undefined);
 assert.equal(E.transplantPlant(s,id,"garden-home-qa").ok,false);
 assert.equal(E.findPlant(s,id).where,"home");
 assert.equal(E.waterPlant(s,id).ok,true,"home plant remains a living care target");
});
test("old saves migrate lazily without changing existing pet, house, growth or plant IDs; backup roundtrip",()=>{
 const s=world();
 delete s.agro;
 const legacy={id:"old-plant-4",species:"lumemoss",growth:67};
 s.habitats[0].flora.push(legacy);
 const pet={id:"legacy-pet",name:"Нови",habitatId:"garden-home-qa",species:0,
  growth:55,ageDays:3,joy:55};
 s.pets.push(pet);
 const snapshot={id:legacy.id,growth:legacy.growth,petId:pet.id,count:s.habitats[0].flora.length};
 assert.equal(E.validate(s),true);
 E.ensureAgro(s);
 assert.equal(legacy.id,snapshot.id);assert.equal(legacy.growth,snapshot.growth);
 assert.equal(s.pets[0].id,snapshot.petId);
 assert.equal(s.habitats[0].flora.length,snapshot.count);
 assert.equal(legacy.dead,false);assert.ok(legacy.health>0);assert.ok(legacy.hydration>0);
 assert.equal(s.agro.gardenPlants.length,0);assert.deepEqual(s.agro.seedlings,{});
 const restored=JSON.parse(JSON.stringify(s));
 assert.equal(E.validate(restored),true);
 E.ensureAgro(restored);
 assert.equal(restored.habitats[0].flora[0].id,snapshot.id);
 assert.equal(restored.habitats[0].flora[0].growth,snapshot.growth);
});
test("original Research-discovered dynamic flora retain real seedling stock on save/restore",()=>{
 const s=world();
 const id="qa-dynamic-flora-bloom";
 s.longplay.invented.push({kind:"flora",id,name:"QA динамична флора",tier:3});
 s.blueprints.push(id);
 s.agro.seedlings[id]=2;
 const copy=JSON.parse(JSON.stringify(s));
 const a=E.ensureAgro(copy);
 assert.equal(a.seedlings[id],2,"newly restored dynamic species must not be discarded");
 assert.ok(E.PLANTS.some(p=>p.id===id));
 assert.equal(E.produceSeedling(copy,id).ok,true);
 assert.equal(copy.agro.seedlings[id],3);
});
test("migration skips all retroactive plant-health damage even if old backup resumes after 60 offline days",()=>{
 const s=world();delete s.agro;
 const old={id:"legacy-saved-fern",species:"glowfern",growth:67};
 s.habitats[0].flora.push(old);
 const originalDay=s.lastDay;
 const progressed=E.advance(s,FIXED+60*E.DAY_MS);
 assert.ok(progressed>0);
 assert.equal(s.lastDay,originalDay+60);
 assert.equal(old.id,"legacy-saved-fern");
 assert.equal(old.growth,67);
 assert.equal(old.dead,false);
 assert.equal(old.health,82);
 assert.equal(old.hydration,78);
 assert.equal(s.agro.migrationPending,false);
 const same={health:old.health,hydration:old.hydration};
 E.advance(s,FIXED+60*E.DAY_MS);
 assert.equal(old.health,same.health);
 assert.equal(old.hydration,same.hydration);
 E.advance(s,FIXED+61*E.DAY_MS);
 assert.notEqual(old.hydration,same.hydration,"only future days may apply new care rules");
});
test("Classic plant HUD shows genuine greenhouse, aquarium, inventory, per-plant health and real actions",()=>{
 const s=world();
 assert.equal(E.inventPlant(s,"glowfern").ok,true);
 assert.equal(E.produceSeedling(s,"glowfern").ok,true);
 const id=E.plantInGarden(s,"glowfern","bed-1").plantId;
 // One real additional produced seedling makes the Garden 'Plant' control
 // available; already consumed seedlings are intentionally not offered.
 assert.equal(E.produceSeedling(s,"glowfern").ok,true);
 const html=UI.render(s);
 for(const item of ["agroSeed","agroPlant","agroCraft","agroWater","agroTreat","agroTransplant","Градина","Фитолаб"])
  assert.ok(html.includes(item),item);
 assert.ok(html.includes(id));
 assert.doesNotMatch(read("js/plant-lifecycle-ui.js"),/localStorage|indexedDB|fetch\(/);
 const original=JSON.stringify(s.agro);
 UI.render(s);assert.equal(JSON.stringify(s.agro),original,"read-only render must not mint a plant/additive");
});
test("offline catch-up runs only once per new game day and never creates duplicate plant events",()=>{
 const s=world();assert.equal(E.inventPlant(s,"glowfern").ok,true);
 assert.equal(E.produceSeedling(s,"glowfern").ok,true);
 const id=E.plantInGarden(s,"glowfern","bed-1").plantId;
 s.mode="demo";s.demoDay=s.lastDay+1;
 E.advance(s,Date.now());
 const p=E.findPlant(s,id).plant,saved={growth:p.growth,health:p.health,day:s.lastDay,journal:s.agro.journal.length};
 E.advance(s,Date.now());
 assert.equal(s.lastDay,saved.day);
 assert.equal(p.growth,saved.growth);assert.equal(p.health,saved.health);
 assert.equal(s.agro.journal.length,saved.journal);
});
