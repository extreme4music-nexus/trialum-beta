"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
test("Classic More menu exposes dedicated warehouse without 3D dependencies",()=>{
 const menu=read("js/longplay-ui.js");
 assert.match(menu,/Стовариште за храна','warehouse'/);
 const ui=read("js/expansion-ui.js");
 assert.match(ui,/function warehouse\(s\)/);
 assert.match(ui,/warehouseMove/);
 assert.match(ui,/warehousePet/);
 assert.doesNotMatch(ui,/postMessage\(|warehouseOperation\(/);
});
test("Classic warehouse renders real stock and uses original inventory for every move",()=>{
 const E={foodRecipes:[{id:"manna",name:"Биомана",icon:"🍚"}],
   currentPet:s=>s.pets[0],SPECIES:[{habitat:"lagoon"}],
   feedCompatible:()=>true,ensureResearch:()=>({level:2})};
 const calls=[];
 const Inventory={
  project:()=>[{id:"manna",name:"Биомана",stock:3,warehouse:2,rack:1,cold:1,packing:0,hand:0}],
  petView:()=>[{petReserve:1}],
  action:(_s,_r,p)=>{calls.push(p);return {ok:true,message:"moved"};},
  transferPet:(_s,_r,p)=>{calls.push(p);return {ok:true,message:"supplied"};}
 };
 const rootObj={TrialumEngine:E,TrialumWarehouseInventory:Inventory,
  TrialumPresence:{HOME:"home",get:()=>({kind:"home"})}};
 const context={globalThis:rootObj,module:{exports:{}},document:{}};
 vm.createContext(context);vm.runInContext(read("js/expansion-ui.js"),context);
 const s={pets:[{id:"pet1",name:"Три",species:0,habitatId:"h1"}],habitats:[{id:"h1"}]};
 const html=rootObj.TrialumExpansion.render("warehouse",s);
 for(const label of ["Стовариште за храна","Полици","Ладилник","Пакување","Биомана","Три"])
  assert.ok(html.includes(label),"missing "+label);
 assert.ok(html.includes("warehouseMove"));assert.ok(html.includes("warehousePet"));
 let notices=0;const ctx={notice:r=>{assert.equal(r.ok,true);notices++;}};
 rootObj.TrialumExpansion.handle("warehouseMove",{dataset:{op:"take",recipe:"manna",from:"rack",to:"hand"}},s,ctx);
 rootObj.TrialumExpansion.handle("warehousePet",{dataset:{op:"supply",recipe:"manna",pet:"pet1",zone:"cold"}},s,ctx);
 assert.equal(calls.length,2);assert.equal(notices,2);
 assert.equal(calls[1].petId,"pet1");assert.equal(calls[1].amount,1);
});
