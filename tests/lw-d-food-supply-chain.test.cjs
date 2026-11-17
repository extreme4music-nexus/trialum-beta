"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const E=require("../js/engine.js");
require("../js/evolution.js");require("../js/progression.js");require("../js/longplay.js");
const I=require("../js/warehouse-inventory.js");
require("../js/food-supply-chain.js");
const root=path.resolve(__dirname,"..");
function world(){
 const s=E.newGame("demo",1700000000000);
 s.stage=7;s.insight=2000;s.compounds=3000;s.biomass=3000;s.energy=100;s.cells=3000;
 for(const k in s.elements)s.elements[k]=3000;
 s.habitats=[{id:"hab-1",name:"QA home",biome:"lagoon",capacity:150,
  minerals:{macro:70,micro:70},chem:{ph:7.1,temp:24,oxygen:90,toxins:3},
  cleanliness:90,flora:[],dayActions:4,bornDay:1}];
 s.activeHabitat="hab-1";s.lastDay=40;s.demoDay=40;
 s.research.level=3;
 return s;
}
const total=(s,id)=>{
 const a=I.allocation(s,id);
 const reserve=Object.values(a.reserves).reduce((n,v)=>n+v,0);
 return {a,reserve,location:a.warehouse+reserve};
};
const compatible=(pet,f)=>E.feedCompatible(E.SPECIES[pet.species],f,pet);
test("LAB produces into genuine warehouse, not to an imaginary pet inventory",()=>{
 const s=world();E.createPet(s,0);
 assert.equal(E.craftFood(s,"manna").ok,true);
 assert.equal(s.foodFactory.stock.manna,3);
 let r=total(s,"manna");
 assert.equal(r.a.bins.rack,3);assert.equal(r.reserve,0);assert.equal(r.location,3);
 assert.equal(I.hasPetPortion(s,"manna",s.pets[0].id),false);
 assert.equal(E.feedPrepared(s,s.pets[0].id,"manna").ok,false);
 assert.equal(s.foodFactory.stock.manna,3);
});
test("each individual pet home supply owns exclusive stock, feed spends one reserve and ONE canonical portion",()=>{
 const s=world();assert.equal(E.createPet(s,0).ok,true);
 const first=s.pets[0];assert.equal(E.createPet(s,0).ok,true);const second=s.pets[1];
 assert.equal(E.craftFood(s,"manna").ok,true);
 const supply=(pet,qty)=>I.transferPet(s,E.foodRecipes,{op:"supply",recipe:"manna",
  petId:pet.id,zone:"rack",amount:qty},compatible);
 assert.equal(supply(first,2).ok,true);
 assert.equal(supply(second,1).ok,true);
 assert.equal(supply(first,1).ok,false,"no duplicate stock across pets");
 assert.equal(I.petView(s,E.foodRecipes,first.id).find(x=>x.id==="manna").petReserve,2);
 assert.equal(I.petView(s,E.foodRecipes,second.id).find(x=>x.id==="manna").petReserve,1);
 const prior=s.biomass,firstActions=first.actionsLeft;
 assert.equal(E.feedPrepared(s,first.id,"manna").ok,true);
 assert.equal(first.actionsLeft,firstActions-1);
 assert.equal(s.biomass,prior,"already-produced food must not charge biomass twice");
 assert.equal(s.foodFactory.stock.manna,2);
 assert.equal(total(s,"manna").location,2);
 assert.equal(I.petView(s,E.foodRecipes,first.id).find(x=>x.id==="manna").petReserve,1);
 assert.equal(I.petView(s,E.foodRecipes,second.id).find(x=>x.id==="manna").petReserve,1);
 const copy=JSON.parse(JSON.stringify(s));
 assert.deepEqual(I.project(copy,E.foodRecipes,first.id),I.project(s,E.foodRecipes,first.id),
  "per-pet reserves survive existing JSON backup/restore");
});
test("basic Home feed also consumes EXISTING pet reserve, not a fresh biomass purchase",()=>{
 const s=world();assert.equal(E.createPet(s,0).ok,true);
 const pet=s.pets[0];E.craftFood(s,"manna");
 assert.equal(I.transferPet(s,E.foodRecipes,{op:"supply",recipe:"manna",petId:pet.id,zone:"rack",amount:1},compatible).ok,true);
 const biomass=s.biomass,stock=s.foodFactory.stock.manna;
 assert.equal(E.petCare(s,pet.id,"feed").ok,true);
 assert.equal(s.foodFactory.stock.manna,stock-1);
 assert.equal(s.biomass,biomass);
 assert.equal(I.hasPetPortion(s,"manna",pet.id),false);
 assert.equal(E.petCare(s,pet.id,"feed").ok,false,"empty pet reserve cannot spend warehouse stock");
});
test("Cold/Packing allocations are produced by lab and available for pet home transfers",()=>{
 const s=world();E.createPet(s,0);const pet=s.pets[0];
 E.craftFood(s,"manna");
 assert.equal(I.action(s,E.foodRecipes,{op:"take",recipe:"manna",from:"rack",to:"hand"}).ok,true);
 assert.equal(I.action(s,E.foodRecipes,{op:"put",recipe:"manna",from:"hand",to:"cold"}).ok,true);
 assert.equal(I.action(s,E.foodRecipes,{op:"take",recipe:"manna",from:"rack",to:"hand"}).ok,true);
 assert.equal(I.action(s,E.foodRecipes,{op:"put",recipe:"manna",from:"hand",to:"packing"}).ok,true);
 for(const zone of ["cold","packing"])assert.equal(I.transferPet(s,E.foodRecipes,
  {op:"supply",recipe:"manna",petId:pet.id,zone,amount:1},compatible).ok,true);
 const r=I.project(s,E.foodRecipes,pet.id).find(x=>x.id==="manna");
 assert.deepEqual([r.rack,r.cold,r.packing,r.petReserve,r.warehouse],[1,0,0,2,1]);
 assert.equal(r.stock,3);
});
test("rejected invalid pet, incompatible formula, double spend, excessive amount and absent home do not mutate state",()=>{
 const s=world();E.createPet(s,0);const pet=s.pets[0];E.craftFood(s,"manna");
 const good={op:"supply",recipe:"manna",petId:pet.id,zone:"rack",amount:1};
 const bad=[
  {...good,petId:"fake"},{...good,recipe:"wrong"},{...good,zone:"outside"},
  {...good,amount:0},{...good,amount:999},
  {...good,amount:4},{...good,op:"return"}
 ];
 const before=JSON.stringify(s);
 for(const item of bad)assert.equal(I.transferPet(s,E.foodRecipes,item,compatible).ok,false);
 assert.equal(I.transferPet(s,E.foodRecipes,good,()=>false).ok,false);
 assert.equal(JSON.stringify(s),before);
 assert.equal(I.transferPet(s,E.foodRecipes,good,compatible).ok,true);
 assert.equal(I.transferPet(s,E.foodRecipes,{...good,op:"return",amount:1},compatible).ok,true);
 assert.equal(total(s,"manna").location,3);
});
test("legacy save with only stock migrates into rack and deleted pet reserves reconcile safely",()=>{
 const s=world();E.createPet(s,0);const pet=s.pets[0];
 s.foodFactory.stock.manna=8;
 assert.equal(I.project(s,E.foodRecipes).find(r=>r.id==="manna").stock,8);
 assert.equal(I.allocation(s,"manna").bins.rack,8);
 assert.equal(I.transferPet(s,E.foodRecipes,{op:"supply",recipe:"manna",petId:pet.id,zone:"rack",amount:3},compatible).ok,true);
 s.pets=[]; // owner removed pet, reserved food recovers to original warehouse
 const r=I.allocation(s,"manna");
 assert.equal(r.bins.rack,8);assert.equal(Object.values(r.reserves).reduce((n,v)=>n+v,0),0);
});
test("Classic UI and original engine share authoritative food inventory without 3D",()=>{
 const read=p=>fs.readFileSync(path.join(root,p),"utf8");
 const app=read("js/app.js"),classic=read("js/longplay-ui.js");
 const warehouse=read("js/warehouse-inventory.js"),ui=read("js/expansion-ui.js");
 const supply=read("js/food-supply-chain.js"),home=read("js/food-home-ui.js");
 const index=read("index.html");
 for(const name of ["petFoodSupply","petFoodReturn","petFeedPrepared"])
  assert.ok(app.includes(name),"Classic home operation missing "+name);
 assert.ok(classic.includes("Стовариште за храна"));
 assert.ok(ui.includes("function warehouse(s)"));
 assert.ok(ui.includes("warehouseMove")&&ui.includes("warehousePet"));
 assert.ok(home.includes("Лична храна дома"));
 assert.ok(supply.includes("originalFeed"));
 assert.ok(index.indexOf('src="js/warehouse-inventory.js"')<index.indexOf('src="js/food-supply-chain.js"'));
 assert.ok(index.indexOf('src="js/food-supply-chain.js"')<index.indexOf('src="js/app.js"'));
 assert.doesNotMatch(warehouse+supply+home,/indexedDB|localStorage|WebSocket|fetch\(/);
 assert.doesNotMatch(app,/TrialumLWBridge/,"Classic branch must not include the 3D bridge");
});
