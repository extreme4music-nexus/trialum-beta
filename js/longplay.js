/* TRIALUM 1.4 — open-ended fictional evolution. No real synthesis, DNA protocols, or payments. */
(function(root){
'use strict';
const E=root.TrialumEngine;if(!E||E.TRIALUM_LONGPLAY)return;E.TRIALUM_LONGPLAY=true;
const old={newGame:E.newGame,validate:E.validate,advance:E.advance,demoNext:E.demoNext,evolve:E.evolve,
 createPet:E.createPet,unlockSpecies:E.unlockSpecies,upgradeLab:E.upgradeLab,study:E.study,
 petCare:E.petCare,plant:E.plant,inventPlant:E.inventPlant,craftFood:E.craftFood,feedPrepared:E.feedPrepared};
// Stable research epochs layered onto the existing personal evolution model.
const MORE_EPOCHS=[
 {level:35,label:'Мемориско суштество',description:'Развиено паметење и тренинг',limbs:6,feelers:5,tail:2},
 {level:50,label:'Симболички комуникатор',description:'Сложени симболи и разговори',limbs:6,feelers:6,tail:2},
 {level:75,label:'Висока когниција',description:'Крилја, групни обрасци и напредно учење',limbs:8,feelers:6,tail:3},
 {level:100,label:'Преобразено суштество',description:'Нова форма на телото и специјализирана моторика',limbs:8,feelers:7,tail:3},
 {level:150,label:'Архитект на биосвет',description:'Долгорочна меморија и научни способности',limbs:10,feelers:8,tail:4},
 {level:250,label:'Етерна интелигенција',description:'Високи еволутивни линии',limbs:10,feelers:9,tail:4},
 {level:500,label:'Постбиолошка епоха',description:'Многугодишен експериментален организам',limbs:12,feelers:10,tail:5},
 {level:1000,label:'Космички синтетик',description:'Нова генерација на фантастично постоење',limbs:12,feelers:12,tail:6}
];
for(const ep of MORE_EPOCHS)if(!E.EVOLUTION_EPOCHS.some(x=>x.level===ep.level))E.EVOLUTION_EPOCHS.push(ep);
const DAY=86400000;
const FAMILIES=[
 {id:0,lab:1,source:null,sourceLevel:0,field:'molecules',points:0,day:0,biome:'lagoon',description:'Почетен вид · создади живеалиште и стигни до еволутивна фаза 7.'},
 {id:1,lab:2,source:0,sourceLevel:3,field:'ecosystem',points:20,day:10,biome:'crystal',description:'Напредувај со Лумира и отклучи Кристална лабораторија.'},
 {id:2,lab:3,source:1,sourceLevel:6,field:'nutrition',points:30,day:24,biome:'lagoon',description:'Кристел мора да достигне ниво 6.'},
 {id:3,lab:4,source:2,sourceLevel:10,field:'ecosystem',points:60,day:43,biome:'garden',description:'Нубела мора да достигне ниво 10. Највисока основна форма.'},
 {id:4,lab:6,source:3,sourceLevel:22,field:'genomics',points:70,day:65,biome:'crystal',description:'ДНК-трансформација на зрел Флорикс; НЕ создавање од нула.'},
 {id:5,lab:7,source:4,sourceLevel:35,field:'genomics',points:95,day:105,biome:'garden',description:'ДНК-трансформација на Синапсо ниво 35.'},
 {id:6,lab:9,source:5,sourceLevel:50,field:'cognition',points:155,day:177,biome:'lagoon',description:'ДНК-трансформација на Тералин ниво 50.'},
 {id:7,lab:12,source:6,sourceLevel:75,field:'cognition',points:255,day:278,biome:'crystal',description:'ДНК-трансформација на Орбивокс ниво 75.'},
 {id:8,lab:16,source:7,sourceLevel:100,field:'genomics',points:350,day:370,biome:'garden',description:'Специјализирана DNA линија од Ноетриум ниво 100.'},
 {id:9,lab:20,source:8,sourceLevel:130,field:'cognition',points:520,day:520,biome:'lagoon',description:'Напредна форма со долгогодишна еволуција.'},
 {id:10,lab:25,source:9,sourceLevel:165,field:'genomics',points:800,day:710,biome:'crystal',description:'Долгогодишна специјализирана генетска форма.'}
];
const CUSTOM=[
 {name:'Астралис',shape:'leaf',hue:202,eyes:4,weight:3,voice:2,icon:'🌠',habitat:'garden',labTier:16,description:'Висока групна интелигенција и адаптивни способности'},
 {name:'Мнемос',shape:'jelly',hue:32,eyes:5,weight:3,voice:1,icon:'🔮',habitat:'lagoon',labTier:20,description:'Напредна индивидуална меморија'},
 {name:'Етерон',shape:'crystal',hue:286,eyes:5,weight:4,voice:3,icon:'✨',habitat:'crystal',labTier:25,description:'Долгогодишна синтетичка фантастична цивилизација'}
];
while(E.SPECIES.length<11)E.SPECIES.push(CUSTOM[E.SPECIES.length-8]);
const STARTERS=['Лумира','Кристел','Нубела','Флорикс'];
const MATERIALS=[
 {id:'aerogel',name:'Аерогел од светлински влакна',lab:2,knowledge:70,field:'molecules',fieldPoints:30},
 {id:'prismsteel',name:'Призмочелик',lab:4,knowledge:215,field:'ecosystem',fieldPoints:55},
 {id:'biosilica',name:'Жив силикат',lab:6,knowledge:450,field:'genomics',fieldPoints:70},
 {id:'staralloy',name:'Ѕвездена легура',lab:10,knowledge:1150,field:'molecules',fieldPoints:220}
];
const TECH=[
 {id:'reinforce',title:'🏗️ Надгради капацитет',material:'aerogel',lab:2,cost:1,inc:4},
 {id:'planters',title:'🌾 Прошири градина',material:'aerogel',lab:2,cost:1,inc:2},
 {id:'crystal',title:'💠 Кристална надградба',material:'prismsteel',lab:4,cost:1,inc:8},
 {id:'biodome',title:'🧬 Биокупола',material:'biosilica',lab:6,cost:1,inc:12},
 {id:'cosmos',title:'🌌 Ѕвезден биосвет',material:'staralloy',lab:10,cost:1,inc:20}
];
const BASE_FOOD_COUNT=E.foodRecipes.length;
const uniq=(xs)=>[...new Set(xs)];
const num=(n,min=0,max=1e9)=>Math.max(min,Math.min(max,Number(n)||0));
const err=message=>({ok:false,message}),ok=message=>({ok:true,message});
function tier(level){
 if(!Number.isInteger(level)||level<1)return null;
 if(level<=E.researchTiers.length)return E.researchTiers[level-1];
 for(let n=E.researchTiers.length+1;n<=level&&n<=1000;n++){
 const day=65+Math.floor(Math.pow(n-6,1.58)*16);
 E.researchTiers.push({level:n,name:n%5===0?'Центар за долгорочна еволуција '+n:'Научен институт '+n,
 day,stage:7,knowledge:Math.round(640+95*Math.pow(n-6,1.45)),insight:Math.round(170+22*Math.pow(n-6,1.35)),
 field:['molecules','ecosystem','nutrition','cognition','genomics'][n%5],
 fieldPoints:Math.round(70+13*Math.pow(n-6,1.25)),petLevel:Math.min(900,22+Math.floor((n-6)*4)),
 habitats:Math.min(25,3+Math.floor((n-6)/4)),quality:Math.min(86,72+Math.floor((n-6)/3)),
 material:Math.round(65+9*Math.pow(n-6,1.18))});
 }
 return E.researchTiers[level-1]||null;
}
function ensure(s){
 if(!s)return null;
 E.ensureResearch(s);s.version='1.5.5';if(!s.longplay||typeof s.longplay!=='object'){
 s.longplay={createdAt:s.createdAt||Date.now(),credits:0,earned:0,ledger:[],lastTick:Date.now(),invented:[],materials:{},habitatUpgrades:{},traits:{},training:{},storeEnabled:false,purchasesEnabled:false,modelInstalled:false};}
 const l=s.longplay;
 l.credits=num(l.credits,0,10000000);l.earned=num(l.earned,0,100000000);
 l.ledger=Array.isArray(l.ledger)?l.ledger:[];
 l.invented=Array.isArray(l.invented)?l.invented:[];l.materials=l.materials||{};
 l.habitatUpgrades=l.habitatUpgrades||{};l.training=l.training||{};
 l.lastTick=Number(l.lastTick)||Date.now();
 l.storeEnabled=false;l.purchasesEnabled=false;l.earlyBonusMs=Math.max(0,Number(l.earlyBonusMs)||0);
 for(const h of s.habitats){h.floraSlots=Math.max(6,Number(h.floraSlots)||6);}
 for(const record of l.invented)register(s,record);
 for(const p of s.pets){E.ensureEvolution(p);if(!p.skills)p.skills={};if(!p.lineage)p.lineage=[p.species];}
 return l;
}
function credits(s,value,reason){
 const l=ensure(s),v=Math.min(5000,Math.max(0,Math.floor(value)));
 if(v){l.credits+=v;l.earned+=v;l.ledger.push({day:s.lastDay,value:v,reason:String(reason).slice(0,60),type:'earned'});
 if(l.ledger.length>400)l.ledger.shift();}
 return v;
}
function useCredits(s,value,reason){
 const l=ensure(s),v=Math.max(1,Math.floor(value));
 if(l.credits<v)return err('Потребни се '+v+' бесплатни истражувачки кредити.');
 l.credits-=v;l.ledger.push({day:s.lastDay,value:-v,reason,type:'spent'});return ok('Потрошени се '+v+' стекнати кредити.');
}
function firstPhase(s){
 if(s.stage>=3)return null;
 const waited=Math.max(0,Date.now()-(s.createdAt||Date.now()));
 const mins=[0,4,11];
 return{ready:waited>=mins[s.stage]*60000,requiredMs:mins[s.stage]*60000,elapsedMs:waited,
 message:'Следната фаза е достапна по '+mins[s.stage]+' минути од почетокот; поминале '+Math.floor(waited/60000)+' мин.'};
}
function stageGate(s){
 const mins=[0,4,11,32,120,420,900];
 const elapsed=Math.max(0,Date.now()-(s.createdAt||Date.now()))+(s.longplay?.earlyBonusMs||0);
 if(s.stage>=7)return{ready:false,requiredMs:0,elapsedMs:elapsed,message:'Достигнат е живиот екосистем.'};
 return{ready:elapsed>=mins[s.stage]*60000,requiredMs:mins[s.stage]*60000,elapsedMs:elapsed,
 message:'Наредна фаза за '+Math.ceil(Math.max(0,mins[s.stage]*60000-elapsed)/60000)+' минути, покрај потребните ресурси.'};
}
function generations(s,target){
 const req=FAMILIES[target];if(!req)return err('Непознат вид.');
 const l=ensure(s),r=s.research,anc=s.pets.filter(p=>p.species===req.source).sort((a,b)=>E.evolutionProgress(b).level-E.evolutionProgress(a).level)[0];
 const items=[
 ['Лабораторија',r.level>=req.lab,r.level+'/'+req.lab],
 ['Еволутивна фаза',s.stage>=6,(s.stage+1)+'/7'],
 ['Истражувања '+req.field,r.fields[req.field]>=req.points,Math.floor(r.fields[req.field])+'/'+req.points],
 ['Период на развој',s.lastDay>=req.day,s.lastDay+'/'+req.day],
 ...(req.source!==null?[['Претходен вид: '+E.SPECIES[req.source].name,!!anc,anc?'Постои':'Нема'],
 ['Еволуција на претходниот вид',!!anc&&E.evolutionProgress(anc).level>=req.sourceLevel,(anc?E.evolutionProgress(anc).level:0)+'/'+req.sourceLevel]]:[]),
 ['Соодветно живеалиште',s.habitats.some(h=>h.biome===req.biome&&E.envScore(h)>=58),req.biome+' · ≥58%'],
 ...(target>=4?[['ДНК центар',r.level>=6,r.level+'/6']]:[])
 ];
 return{target,mode:target<4?'creation':'DNA',description:req.description,items:items.map(([label,yes,value])=>({label,ok:yes,value})),ok:items.every(x=>x[1]),source:anc,lab:req.lab};
}
function nextGenome(s,index){const k=FAMILIES[index];if(!k)return err('Непозната генетска линија.');return generations(s,index);}
function transform(s,sourceId,target){
 const req=FAMILIES[target];if(!req||target<4)return err('Овој вид се создава низ основната лабораторија, не преку ДНК.');
 const p=s.pets.find(x=>x.id===sourceId);if(!p)return err('Прво избери миленик.');
 if(p.species!==req.source)return err('Потребно е развиено милениче од видот '+E.SPECIES[req.source].name+'.');
 const g=generations(s,target);if(!g.ok)return err('🔒 '+g.items.filter(x=>!x.ok).map(x=>x.label+' ('+x.value+')').join('; '));
 const lab=s.habitats.find(h=>h.biome===req.biome&&E.envScore(h)>=58&&E.occupancy(s,h.id)+E.SPECIES[target].weight*2-(p.habitatId===h.id?E.loadOf(p):0)<=h.capacity);
 if(!lab)return err('Потребно е соодветно живеалиште '+req.biome+' со доволен биокапацитет и квалитет ≥58%.');
 const cost=25+target*12,ins=12+target*7;if(s.compounds<cost||s.insight<ins||s.labActions<1)return err('ДНК чини '+cost+' молекули, '+ins+' сознание и 1 лабораториска акција.');
 s.compounds-=cost;s.insight-=ins;s.labActions--;
 p.species=target;p.hue=E.SPECIES[target].hue;p.eyes=E.SPECIES[target].eyes;p.shape=E.SPECIES[target].shape;
 p.lineage=Array.isArray(p.lineage)?p.lineage:[req.source];p.lineage.push(target);
 p.name=E.SPECIES[target].name+' '+p.name.replace(/^[^\s]+\s*/, '').slice(0,24);
 p.genome={...p.genome,stage:target,source:req.source,day:s.lastDay};
 const oldHab=s.habitats.find(h=>h.id===p.habitatId);if(oldHab?.biome!==req.biome){p.habitatId=lab.id;s.activeHabitat=lab.id;}
 credits(s,20+target*5,'Нов еволутивен вид');E.log(s,'🧬 '+p.name+' се трансформираше преку ДНК од претходен жив вид.','milestone');
 return ok('Отклучен е '+E.SPECIES[target].name+' — истиот миленик продолжува со својата возраст, меморија и историја.');
}
function register(s,record){
 if(!record||typeof record.id!=='string'||record.id.length>50)return;
 if(record.kind==='flora'&&!E.PLANTS.some(p=>p.id===record.id)){
 E.PLANTS.push({id:record.id,name:String(record.name).slice(0,40),icon:'🌾',growth:.7,oxygen:1.2+Math.min(4,record.tier/8),kind:'Истражувачки создадена виртуелна флора',labTier:record.tier});
 }
 if(record.kind==='food'&&!E.foodRecipes.some(p=>p.id===record.id)){
 E.foodRecipes.push({id:record.id,name:String(record.name).slice(0,40),icon:'🥣',tier:record.tier,
 cost:{biomass:12+record.tier*2,compounds:4+record.tier},yield:2,energy:8,joy:7,boost:12+record.tier*3,group:record.group||'all',desc:'Проучена фантастична нутритивна формула'});
 if(!s.foodFactory.stock[record.id])s.foodFactory.stock[record.id]=0;
 }
}
function invent(s,kind){
 const l=ensure(s),r=s.research;if(!['food','flora','material'].includes(kind))return err('Непозната насока за откривање.');
 const level=r.level;if(level<2)return err('За истражувачки откритија треба лабораторија ниво 2.');
 if(s.labActions<1||s.insight<8||s.compounds<12)return err('Потребни се 1 акција, 8 сознание и 12 молекули.');
 if(kind==='material'){
 const next=MATERIALS.find(x=>!l.materials[x.id]&&level>=x.lab&&r.knowledge>=x.knowledge&&r.fields[x.field]>=x.fieldPoints);
 if(!next)return err('Нема достапен нов материјал. Продолжи со истражување на молекули и екологија.');
 s.labActions--;s.insight-=8;s.compounds-=12;l.materials[next.id]=1;
 E.log(s,'🪨 Откриен материјал: '+next.name+'.','milestone');credits(s,10,'Нов материјал');return ok('Откриен '+next.name+'! Може да се произведува за живеалишта.');
 }
 const id='research-'+kind+'-'+(l.invented.length+1),ix=l.invented.length;
 const adjectives=['Кристален','Светлосен','Адаптивен','Ѕвезден','Орбитален','Пулсаторен','Луминисцентен','Ритмички'];
 const nouns=kind==='food'?['нектар','биосерум','гранулат','концентрат']:['мов','корен','пупка','спора'];
 const name=adjectives[ix%adjectives.length]+' '+nouns[Math.floor(ix/3)%nouns.length]+' '+(ix+1);
 if(l.invented.length>=180)return err('Достигнат е лимитот на локално зачувани изуми за оваа верзија.');
 const record={kind,id,name,tier:Math.max(2,Math.min(level,30)),group:kind==='food'?['all','lagoon','garden','crystal'][ix%4]:null,day:s.lastDay};
 s.labActions--;s.insight-=8;s.compounds-=12;l.invented.push(record);register(s,record);
 E.log(s,'✨ Истражувачко откритие: '+name+' ('+kind+').','milestone');credits(s,5,'Истражувачко откритие');
 return ok('Откриено: '+name+'! Внесено е во каталогот.');
}
function craftMaterial(s,id){const l=ensure(s),m=MATERIALS.find(x=>x.id===id);if(!m||!l.materials[id])return err('Прво отклучи го материјалот преку истражување.');
 if(s.labActions<1||s.compounds<12||s.biomass<10)return err('Потребни се 1 акција, 12 молекули и 10 биомаса.');
 s.labActions--;s.compounds-=12;s.biomass-=10;l.materials[id]+=2;
 return ok('Произведени се 2 единици '+m.name+'. Состојба: '+l.materials[id]+'.');
}
function upgradeHab(s,id){
 const l=ensure(s),h=E.currentHabitat(s),tech=TECH.find(x=>x.id===id);
 if(!h)return err('Избери живеалиште.');if(!tech)return err('Непозната надградба.');
 if(s.research.level<tech.lab||!l.materials[tech.material])return err('🔒 Лабораторија '+tech.lab+' и материјал '+MATERIALS.find(x=>x.id===tech.material).name+'.');
 if(h.dayActions<1)return err('Живеалиштето ги потрошило акциите.');
 if(l.materials[tech.material]<tech.cost)return err('Недоволно материјали.');
 if(s.insight<10)return err('Потребни се 10 сознание.');
 l.materials[tech.material]-=tech.cost;s.insight-=10;h.dayActions--;
 const k=h.id+':'+id;l.habitatUpgrades[k]=(l.habitatUpgrades[k]||0)+1;
 if(id==='planters')h.floraSlots=Math.min(150,h.floraSlots+tech.inc);
 else h.capacity=Math.min(500,h.capacity+tech.inc);
 E.log(s,'🏗️ '+h.name+': '+tech.title+' · капацитет '+h.capacity+' · флора '+h.floraSlots+'.','habitat');
 credits(s,4,'Успешна надградба');return ok('Надградено живеалиште: '+h.capacity+' биокапацитет, '+h.floraSlots+' растенија.');
}
function craftDynamic(s,id){
 const l=ensure(s),rec=l.invented.find(x=>x.id===id&&x.kind==='food');
 if(!rec)return old.craftFood(s,id);
 if(s.research.level<rec.tier||s.labActions<1)return err('Рецептот бара лабораторија ниво '+rec.tier+' и лабораториска акција.');
 const f=E.foodRecipes.find(x=>x.id===id);
 if(s.biomass<f.cost.biomass||s.compounds<f.cost.compounds)return err('Недостигаат ресурси за храната.');
 s.labActions--;s.biomass-=f.cost.biomass;s.compounds-=f.cost.compounds;s.foodFactory.stock[id]=(s.foodFactory.stock[id]||0)+f.yield;
 E.log(s,'🍱 Произведено '+f.name+'.','food');return ok('Додадени се '+f.yield+' порции '+f.name+'.');
}
function feedDynamic(s,petId,id){
 const l=ensure(s),rec=l.invented.find(x=>x.id===id&&x.kind==='food');
 if(!rec)return old.feedPrepared(s,petId,id);
 const p=s.pets.find(x=>x.id===petId),f=E.foodRecipes.find(x=>x.id===id);
 if(!p)return err('Избери миленик.');
 if(!f||!E.feedCompatible(E.SPECIES[p.species],f,p))return err('Оваа храна е за друга група.');
 if((s.foodFactory.stock[id]||0)<1||p.actionsLeft<1)return err('Недостига порција или лична акција.');
 s.biomass+=3;const result=E.petCare(s,p.id,'feed');if(!result.ok){s.biomass-=3;return result;}
 p.satiety=num(p.satiety+f.boost,0,100);p.joy=num(p.joy+f.joy,0,100);p.energy=num(p.energy+f.energy,0,100);
 s.foodFactory.stock[id]--;E.evolutionGain(s,p,f.boost,'Нутритивен напредок');
 return ok('Нахрането со '+f.name+'.');
}
function plantDynamic(s,id){
 const l=ensure(s),h=E.currentHabitat(s);
 if(!h)return err('Избери живеалиште.');if(h.flora.length<h.floraSlots&&h.flora.length<6)return old.plant(s,id);
 if(h.flora.length>=h.floraSlots)return err('Нема простор за флора: '+h.flora.length+'/'+h.floraSlots+'. Надгради живеалиште.');
 if(!s.blueprints.includes(id))return err('Растението не е отклучено.');
 if(h.dayActions<1)return err('Нема слободни дневни акции.');
 const cost={C:8,N:5,P:3,O:6};
 for(const k in cost)if((s.elements[k]||0)<cost[k])return err('Недостига '+k+'.');
 for(const k in cost)s.elements[k]-=cost[k];h.dayActions--;
 h.flora.push({id:'flora-long-'+s.sequence++,species:id,growth:3});
 E.log(s,'🌿 Засадена нова флора во проширеното живеалиште.','habitat');
 return ok('Нова флора: '+h.flora.length+'/'+h.floraSlots+'.');
}
function training(s,petId,skill){
 const l=ensure(s),p=s.pets.find(x=>x.id===petId);
 const config={wave:{level:3,lab:1,max:3,caption:'мавта'},spin:{level:8,lab:3,max:5,caption:'се врти'},leap:{level:15,lab:4,max:6,caption:'скока'},symbols:{level:22,lab:6,max:10,caption:'учи знаци'},logic:{level:35,lab:8,max:14,caption:'решава логика'},dialogue:{level:50,lab:10,max:20,caption:'зборува'}};
 const k=config[skill];if(!p||!k)return err('Непознат тренинг.');
 const level=E.evolutionProgress(p).level;
 if(level<k.level||s.research.level<k.lab)return err('🔒 Треба ниво '+k.level+' на миленикот и лабораторија '+k.lab+'.');
 if(p.actionsLeft<1)return err('Нема лични акции.');
 const value=p.skills[skill]||0;if(value>=k.max)return err('Вештината е максимално научена во оваа генерација.');
 p.actionsLeft--;p.energy=num(p.energy-4,0,100);p.skills[skill]=value+1;
 p.reaction=skill;p.reactionAt=Date.now();E.evolutionLearn(p,skill==='logic'?'explore':'play',.6);
 E.evolutionGain(s,p,7+k.level/3,'Тренинг');E.log(s,'🎓 '+p.name+' '+k.caption+' · вештина '+p.skills[skill]+'/'+k.max+'.','care');
 credits(s,1,'Тренинг');return ok('Научено: '+k.caption+' ('+p.skills[skill]+'/'+k.max+').');
}
function boost(s,type,targetId){
 const l=ensure(s),prices={lab:12,pet:8,habitat:8,phase:20};if(!(type in prices))return err('Непознато забрзување.');
 if(type==='pet'&&!s.pets.some(x=>x.id===targetId))return err('Избери миленик.');
 if(type==='habitat'&&!E.currentHabitat(s))return err('Избери живеалиште.');
 if(type==='lab'&&s.labActions>=E.labActionLimit(s))return err('Лабораториските акции се веќе максимални.');
 if(type==='pet'&&s.pets.find(x=>x.id===targetId).actionsLeft>=E.petActionLimit(s))return err('Миленичето има максимални акции.');
 if(type==='habitat'&&E.currentHabitat(s).dayActions>=E.HAB_ACTIONS+Math.floor(s.research.level/3))return err('Живеалиштето има максимални акции.');
 if(type==='phase'&&s.stage>=7)return err('Основните еволутивни фази се завршени. За понатамошен напредок истражувај и тренирај.');
 const paid=useCredits(s,prices[type],'Забрзано освежување '+type);if(!paid.ok)return paid;
 if(type==='phase'){l.earlyBonusMs+=s.stage<3?180000:s.stage<5?1200000:3600000;return ok('Заработените поени го скратија времето до наредната основна фаза. Ресурсите и истражувањата и понатаму се задолжителни.');}
 if(type==='lab')s.labActions=Math.min(E.labActionLimit(s),s.labActions+1);
 if(type==='pet'){const p=s.pets.find(x=>x.id===targetId);if(!p){l.credits+=prices[type];return err('Избери миленик.');}p.actionsLeft=Math.min(E.petActionLimit(s),p.actionsLeft+1);}
 if(type==='habitat'){const h=E.currentHabitat(s);if(!h){l.credits+=prices[type];return err('Избери живеалиште.');}h.dayActions=Math.min(E.HAB_ACTIONS+Math.floor(s.research.level/3),h.dayActions+1);}
 return ok('Освежена е една акција со кредити заработени во играта.');
}
function sync(s,now=Date.now()){
 const l=ensure(s),age=now-l.lastTick;
 if(!Number.isFinite(age)||age<0){l.lastTick=now;return 0;}
 const fast=s.stage<3?2:s.stage<6?6:12;
 const ms=fast*60000;
 const count=Math.min(100,Math.floor(age/ms));
 if(count<=0)return 0;
 const lab=E.labActionLimit(s);s.labActions=Math.min(lab,s.labActions+count);
 for(const p of s.pets)p.actionsLeft=Math.min(E.petActionLimit(s),p.actionsLeft+count);
 for(const h of s.habitats)h.dayActions=Math.min(E.HAB_ACTIONS+Math.floor(s.research.level/3),h.dayActions+count);
 l.lastTick+=count*ms;return count;
}
function achievementGift(s){
 const l=ensure(s),a=s.achievements.filter(x=>x?.id),marked=l.rewarded||(l.rewarded={});let count=0;
 for(const m of a){if(!marked[m.id]){marked[m.id]=true;credits(s,6,'Постигнување '+m.title);count++;}}
 return count;
}
const legacy=old.newGame;
E.newGame=(mode,t)=>{const s=legacy(mode==='demo'?'real':mode,t);ensure(s);s.version='1.5.5';return s;};
E.validate=s=>!!s&&['1.1.0','1.2.0','1.3.0','1.4.0','1.4.1','1.5.0','1.5.1','1.5.2','1.5.3','1.5.4','1.5.5'].includes(s.version)&&old.validate({...s,version:'1.3.0'});
E.evolve=s=>{ensure(s);const g=stageGate(s);if(!g.ready)return err(g.message);
 const req=E.PHASE_REQ[s.stage];if(!req)return err('Нема дополнителна основна фаза.');
 const saved=req.day;req.day=1;let result;try{result=old.evolve(s);}finally{req.day=saved;}
 if(result.ok){credits(s,3+s.stage*2,'Еволутивна фаза');E.log(s,'⏱️ Рано отклучување според вистински поминати минути/часови.','milestone');}return result;};
E.createPet=(s,id)=>{ensure(s);const req=FAMILIES[id];if(!req)return err('Непознат вид.');if(id>=4)return err('🔒 '+E.SPECIES[id].name+' не може да се создаде од нула. Отклучи ДНК-трансформација на претходниот вид.');
 const g=generations(s,id);if(!g.ok)return err('🔒 '+g.items.filter(x=>!x.ok).map(x=>x.label+' ('+x.value+')').join('; '));
 const h=E.currentHabitat(s);if(!h||h.biome!==req.biome)return err('Потребен е соодветен биом: '+req.biome+'.');
 const r=old.createPet(s,id);if(r.ok){const p=E.currentPet(s);p.lineage=[id];credits(s,3,'Ново милениче');}return r;};
E.unlockSpecies=(s,id)=>id>=4?err('Напредните видови се отклучуваат само во ДНК лабораторијата.'):old.unlockSpecies(s,id);
E.upgradeLab=s=>{ensure(s);const level=s.research.level+1;if(level<=6){const r=old.upgradeLab(s);if(r.ok)credits(s,10,'Надградена лабораторија');return r;}
 const t=tier(level),r=s.research,checks=[s.lastDay>=t.day,s.stage>=t.stage,r.knowledge>=t.knowledge,s.insight>=t.insight,r.fields[t.field]>=t.fieldPoints,
 Math.max(0,...s.pets.map(p=>E.evolutionProgress(p).level))>=t.petLevel,
 s.habitats.length>=t.habitats,Math.max(0,...s.habitats.map(h=>E.envScore(h)))>=t.quality,s.compounds>=t.material,s.labActions>=1];
 if(!checks.every(Boolean))return err('🔒 Види ги потребните услови за лабораторија ниво '+level+'.');
 s.compounds-=t.material;s.insight-=t.insight;s.labActions--;r.level=level;r.history.push({day:s.lastDay,level,name:t.name});credits(s,10+level,'Ново лабораториско ниво');
 E.log(s,'🏛️ Нов научен центар '+level+': '+t.name,'milestone');return ok('Лабораторијата достигна ниво '+level+'.');
};
E.labRequirements=(s,level)=>{if(level<=6)return (function(){
 const t=E.researchTiers[level-1],r=E.ensureResearch(s);
 if(!t)return{ok:false,items:[],name:'Максимум'};
 const list=[['Денови',s.lastDay>=t.day,s.lastDay+'/'+t.day],['Знаење',r.knowledge>=t.knowledge,Math.floor(r.knowledge)+'/'+t.knowledge],
 ['Сознание',s.insight>=t.insight,s.insight+'/'+t.insight],['Област '+t.field,r.fields[t.field||'molecules']>=t.fieldPoints,(r.fields[t.field||'molecules']||0)+'/'+t.fieldPoints],
 ['Миленик',E.maxPetLevel(s)>=t.petLevel,E.maxPetLevel(s)+'/'+t.petLevel],['Живеалишта',s.habitats.length>=t.habitats,s.habitats.length+'/'+t.habitats],
 ['Квалитет',E.maxHabitatQuality(s)>=t.quality,E.maxHabitatQuality(s)+'/'+t.quality],['Молекули',s.compounds>=t.material,s.compounds+'/'+t.material]];
 return{name:t.name,ok:list.every(x=>x[1]),items:list.map(x=>({label:x[0],ok:x[1],value:x[2]}))};
 })();
 const t=tier(level),r=E.ensureResearch(s).fields,checks=[
 ['Денови',s.lastDay>=t.day,s.lastDay+'/'+t.day],['Знаење',s.research.knowledge>=t.knowledge,s.research.knowledge+'/'+t.knowledge],
 ['Сознание',s.insight>=t.insight,s.insight+'/'+t.insight],['Област '+t.field,r[t.field]>=t.fieldPoints,r[t.field]+'/'+t.fieldPoints],
 ['Миленик',E.maxPetLevel(s)>=t.petLevel,E.maxPetLevel(s)+'/'+t.petLevel],['Живеалишта',s.habitats.length>=t.habitats,s.habitats.length+'/'+t.habitats],
 ['Квалитет',E.maxHabitatQuality(s)>=t.quality,E.maxHabitatQuality(s)+'/'+t.quality],['Молекули',s.compounds>=t.material,s.compounds+'/'+t.material]];
 return{name:t.name,ok:checks.every(x=>x[1]),items:checks.map(x=>({label:x[0],ok:x[1],value:x[2]}))};
};
E.advance=(s,now)=>{ensure(s);const n=old.advance(s,now);ensure(s);sync(s,now);achievementGift(s);return n;};
E.demoNext=(s)=>{const r=old.demoNext(s);ensure(s);return r;};
E.study=(s,kind)=>{ensure(s);const r=old.study(s,kind);if(r.ok){credits(s,2,'Научно проучување');achievementGift(s);}return r;};
E.petCare=(s,id,kind)=>{ensure(s);const r=old.petCare(s,id,kind);if(r.ok)credits(s,1,'Грижа за миленик');return r;};
E.inventPlant=(s,id)=>{ensure(s);return old.inventPlant(s,id);};
E.plant=plantDynamic;
E.craftFood=craftDynamic;E.feedPrepared=feedDynamic;
const oldGain=E.evolutionGain;
E.evolutionGain=(s,p,amount,reason)=>{
 const before=E.evolutionProgress(p).level,r=oldGain(s,p,amount,reason);
 if(before>=250||p.evolution.level>=250){
   p.evolution.xp+=Math.max(0,Math.floor(amount));
   while(p.evolution.level<2000&&p.evolution.xp>=Math.ceil(14+p.evolution.level*5+Math.pow(p.evolution.level,1.75)*2.5)&&p.ageDays>=61+(p.evolution.level-21)*4){
     p.evolution.xp-=Math.ceil(14+p.evolution.level*5+Math.pow(p.evolution.level,1.75)*2.5);
     p.evolution.level++;
   }
 }
 return r;
};
E.VERSION='1.5.5';
E.ensureLongplay=ensure;E.longplayTick=sync;E.longplayStageGate=stageGate;
E.longplayLineages=FAMILIES;E.longplayRequirements=generations;E.longplayTransform=transform;
E.longplayInvent=invent;E.longplayMaterials=MATERIALS;E.longplayTech=TECH;E.longplayBuildMaterial=craftMaterial;E.longplayUpgradeHabitat=upgradeHab;
E.longplayTrain=training;E.longplayCredits=credits;E.longplayBoost=boost;E.longplayTier=tier;
E.longplayPayments={enabled:false,billingProvider:null,verificationRequired:true,canPurchase:()=>false,
 purchase:()=>err('Плаќањата не се активни. Потребни се Play Billing и безбедна проверка.')};
E.longplayLLM={installed:false,engine:null,isAvailable:()=>false,generate:async()=>{throw Error('Локален LLM модел не е инсталиран. Одговорите остануваат симулирани.')},description:'On-device LiteRT-LM adapter: not yet integrated'};
if(typeof module==='object'&&module.exports)module.exports={ensure,stageGate,generations,transform,invent,craftMaterial,upgradeHab,training,boost,sync,FAMILIES,MATERIALS,TECH};
})(typeof globalThis!=='undefined'?globalThis:this);
