const assert=require('node:assert/strict');const e=require('../js/engine.js');
function success(r){assert.equal(r.ok,true,r.message);}
let tests=0;function check(label,fn){fn();tests++;console.log('PASS',label)}
const s=e.newGame('demo',Date.now());
check('Starts without cells, pets or built habitat',()=>{assert.equal(s.cells,0);assert.equal(s.pets.length,0);assert.equal(s.habitats.length,0);assert.equal(e.validate(s),true)});
check('Chemical actions respect daily cap and atom consumption',()=>{const prev=s.elements.C;success(e.basicResearch(s,'synthesize'));assert.equal(s.elements.C,prev-3);for(let i=1;i<e.LAB_ACTIONS;i++)success(e.basicResearch(s,'analyze'));assert.equal(s.labActions,0);assert.equal(e.basicResearch(s,'analyze').ok,false);});
check('Evolution is date gated',()=>{s.insight=999;s.compounds=999;s.cells=999;success(e.evolve(s));assert.equal(e.evolve(s).ok,false)});
check('Days increment with independent reset',()=>{success(e.demoNext(s));assert.equal(s.lastDay,2);assert.equal(s.labActions,e.LAB_ACTIONS)});
check('Evolution reaches animal stage only after enough day progression',()=>{while(s.stage<6){const r=e.PHASE_REQ[s.stage];while(s.lastDay<r.day)success(e.demoNext(s));s.insight=999;s.compounds=999;s.cells=999;success(e.evolve(s));}assert.equal(s.stage,6)});
check('Construction requires materials and five distinct days',()=>{success(e.startBuilding(s,'lagoon'));success(e.buildStep(s));assert.equal(e.buildStep(s).ok,false);for(let i=1;i<5;i++){success(e.demoNext(s));success(e.buildStep(s))}assert.equal(s.habitats.length,1);assert.equal(s.construction,null)});
check('New pet created in active habitat with four independent actions',()=>{s.biomass=500;s.compounds=500;success(e.createPet(s,0));success(e.createPet(s,1));assert.equal(s.pets.length,2);assert.equal(s.pets[0].actionsLeft,4);success(e.petCare(s,s.pets[0].id,'feed'));assert.equal(s.pets[0].actionsLeft,3);assert.equal(s.pets[1].actionsLeft,4);});
check('Pet actions depleted independently',()=>{for(let i=0;i<3;i++)success(e.petCare(s,s.pets[0].id,'talk'));assert.equal(e.petCare(s,s.pets[0].id,'play').ok,false);assert.equal(s.pets[1].actionsLeft,4)});
check('Capacity changes with growth and limits new pets',()=>{s.pets[0].growth=95;s.pets[1].growth=95;assert.equal(e.occupancy(s,s.activeHabitat),12);assert.equal(e.createPet(s,0).ok,false)});
check('Second habitat and transfers subject to occupancy',()=>{s.elements=Object.fromEntries(e.ELEMENTS.map(k=>[k,999]));success(e.startBuilding(s,'garden'));for(let i=0;i<5;i++){success(e.demoNext(s));success(e.buildStep(s))}const nextId=s.activeHabitat;const firstId=s.habitats[0].id;success(e.transfer(s,s.pets[0].id,nextId));assert.equal(e.occupancy(s,firstId),e.loadOf(s.pets[1]));assert.equal(s.pets[0].habitatId,nextId)});
check('Plant research precedes planting and habitat limits',()=>{assert.equal(e.plant(s,'glowfern').ok,false);s.insight=99;s.compounds=99;success(e.inventPlant(s,'glowfern'));success(e.plant(s,'glowfern'));assert.equal(s.habitats[1].flora.length,2)});
check('Environment changes with days and signals low quality',()=>{const h=e.currentHabitat(s);h.chem.oxygen=4;h.chem.toxins=94;assert(e.alerts(s).some(x=>x.type==='habitat'));const before=h.minerals.macro;success(e.demoNext(s));assert(h.minerals.macro<before);});
check('New day restores each pet and each habitat own action budget',()=>{for(const p of s.pets)assert.equal(p.actionsLeft,e.PET_ACTIONS);for(const h of s.habitats)assert.equal(h.dayActions,e.HAB_ACTIONS)});
check('Save state fully JSON serializable',()=>{const copy=JSON.parse(JSON.stringify(s));assert(e.validate(copy));assert.equal(copy.logs.length,s.logs.length)});
console.log(`${tests} core tests passed`);
check('Threshold alerts are per pet, not globally shared',()=>{
 const [a,b]=s.pets;
 a.satiety=34;a.joy=34;a.clean=29;
 b.satiety=70;b.joy=70;b.clean=70;
 const alerts=e.alerts(s);
 assert(alerts.some(x=>x.type==='hunger'&&x.petId===a.id));
 assert(alerts.some(x=>x.type==='play'&&x.petId===a.id));
 assert(alerts.some(x=>x.type==='clean'&&x.petId===a.id));
 assert(!alerts.some(x=>x.petId===b.id));
});
check('Habitat chemistry actions are independent per habitat',()=>{
 const [a,b]=s.habitats;
 s.activeHabitat=a.id;
 const aBefore=a.dayActions,bBefore=b.dayActions;
 success(e.habitatCare(s,'clean'));
 assert.equal(a.dayActions,aBefore-1);
 assert.equal(b.dayActions,bBefore);
});
check('Legacy version 1 save migrates cells, pets and history',()=>{
 global.TrialumEngine=e;
 require('../js/storage.js');
 const old={version:1,mode:'demo',createdAt:Date.now(),atoms:{C:2000,H:2200,O:2000,N:600,P:400,S:200},mol:{F:100,L:90},stage:6,energy:80,research:90,cells:100,demoDays:20,pets:[{name:'Луми',shape:0,eyes:2,joy:65,hunger:71,stamina:80,clean:76,bond:50,growth:12,birthday:14}],logs:[{day:12,text:'Создадена клетка',type:'milestone',at:Date.now()},{day:13,text:'Нова популација',type:'info',at:Date.now()}]};
 const imported=global.TrialumStorage.legacyConvert(old);
 assert(e.validate(imported));assert.equal(imported.pets.length,1);
 assert.equal(imported.pets[0].actionsLeft,e.PET_ACTIONS);
 assert(imported.logs.some(x=>x.text==='Создадена клетка'));
 assert.equal(imported.habitats.length,1);
});
check('Corrupt backup JSON is rejected',()=>{
 assert.throws(()=>global.TrialumStorage.parseImport('{"version":"0"}'));
 assert.throws(()=>global.TrialumStorage.parseImport('{invalid'));
});
console.log('TOTAL: '+tests+' regression checks passed');
