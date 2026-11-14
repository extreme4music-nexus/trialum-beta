/* TRIALUM 1.3: fictional laboratory progression, nutrition, cognition and cosmetic DNA.
   This is game logic only, NOT real chemistry, DNA editing, or biological protocols. */
(function(root){
'use strict';
const E=root.TrialumEngine;if(!E||E.TRIALUM_RESEARCH_PATCHED)return;
E.TRIALUM_RESEARCH_PATCHED=true;
const prior={newGame:E.newGame,validate:E.validate,advance:E.advance,demoNext:E.demoNext,
 basicResearch:E.basicResearch,evolve:E.evolve,createPet:E.createPet,petCare:E.petCare,
 inventPlant:E.inventPlant,habitatCare:E.habitatCare};
const fields=[
 {id:'molecules',name:'Молекуларни системи',icon:'⚗️'},
 {id:'ecosystem',name:'Екологија',icon:'🌿'},
 {id:'nutrition',name:'Исхрана',icon:'🍎'},
 {id:'cognition',name:'Когниција',icon:'🧠'},
 {id:'genomics',name:'Фантастична генетика',icon:'🧬'}
];
const TIERS=[
 {level:1,name:'Основна лабораторија',day:1,stage:0,knowledge:0,insight:0,field:null,fieldPoints:0,petLevel:0,habitats:0,quality:0,material:0},
 {level:2,name:'Нутритивен центар',day:10,stage:5,knowledge:65,insight:45,field:'molecules',fieldPoints:15,petLevel:0,habitats:0,quality:0,material:8},
 {level:3,name:'Биосинтезен институт',day:20,stage:6,knowledge:145,insight:65,field:'nutrition',fieldPoints:24,petLevel:3,habitats:1,quality:50,material:18},
 {level:4,name:'Когнитивен институт',day:33,stage:6,knowledge:245,insight:95,field:'ecosystem',fieldPoints:30,petLevel:7,habitats:2,quality:60,material:30},
 {level:5,name:'Комуникациски комплекс',day:47,stage:7,knowledge:400,insight:125,field:'cognition',fieldPoints:45,petLevel:14,habitats:2,quality:68,material:45},
 {level:6,name:'ДНК-архитектонски центар',day:65,stage:7,knowledge:640,insight:170,field:'genomics',fieldPoints:70,petLevel:22,habitats:3,quality:72,material:65}
];
const FOOD=[
 {id:'manna',name:'Универзална биомана',icon:'🍚',tier:2,cost:{biomass:8,compounds:3},yield:3,energy:0,joy:2,boost:10,group:'all',desc:'Основна хранлива смеса за секој вид'},
 {id:'lumen',name:'Луменски нектар',icon:'🫐',tier:2,cost:{biomass:12,compounds:6},yield:2,energy:8,joy:5,boost:20,group:'lagoon',desc:'Посебно за лагунски и облачни суштества'},
 {id:'prism',name:'Призматичен концентрат',icon:'💎',tier:3,cost:{biomass:14,compounds:8},yield:2,energy:11,joy:2,boost:24,group:'crystal',desc:'Енергетска храна за кристални форми'},
 {id:'verdant',name:'Ботаничка симбиосмеса',icon:'🥬',tier:3,cost:{biomass:13,compounds:7},yield:2,energy:6,joy:9,boost:22,group:'garden',desc:'За растителни и шумски миленици'},
 {id:'synapse',name:'Синаптичен десерт',icon:'🧠',tier:5,cost:{biomass:20,compounds:12},yield:2,energy:6,joy:16,boost:38,group:'advanced',desc:'Само за развиени комуникативни миленици'},
 {id:'astral',name:'Астрален еликсир',icon:'🌌',tier:6,cost:{biomass:30,compounds:18},yield:1,energy:18,joy:16,boost:58,group:'all',desc:'Скап фантастичен оброк за највисоки епохи'}
];
const NEW_SPECIES=[
 {name:'Синапсо',shape:'crystal',hue:198,eyes:4,weight:2,voice:1,icon:'🧠',habitat:'crystal',labTier:3,description:'Суштество што препознава едноставни обрасци'},
 {name:'Тералин',shape:'leaf',hue:68,eyes:2,weight:2,voice:4,icon:'🦋',habitat:'garden',labTier:4,description:'Многуосетлива градинска форма'},
 {name:'Орбивокс',shape:'cloud',hue:295,eyes:3,weight:2,voice:3,icon:'🗨️',habitat:'lagoon',labTier:5,description:'Фантастичен комуникатор со говорни симболи'},
 {name:'Ноетриум',shape:'jelly',hue:42,eyes:4,weight:2,voice:2,icon:'🌟',habitat:'crystal',labTier:6,description:'Напредно интелигентно суштество со свој мозаик'}
];
const NEW_PLANTS=[
 {id:'nootbloom',name:'Нутрицвет',icon:'🌸',growth:1.2,oxygen:2.6,kind:'Хранлива флора отклучена со нутритивна лабораторија',labTier:2},
 {id:'neuroroot',name:'Неврокорен',icon:'🌳',growth:.85,oxygen:3.2,kind:'Фантастична когнитивна флора',labTier:4},
 {id:'starspore',name:'Ѕвездоспора',icon:'✨',growth:.7,oxygen:4.1,kind:'Светлосна флора од напредна лабораторија',labTier:6}
];
E.SPECIES.push(...NEW_SPECIES);
E.PLANTS.push(...NEW_PLANTS);
const clamp=(x,a=0,b=100)=>Math.max(a,Math.min(b,Number(x)||0));
const success=message=>({ok:true,message});
const fail=message=>({ok:false,message});
function ensure(s){
 if(!s)return null;
 if(!String(s.version||'').startsWith('1.4.'))s.version='1.3.0';
 if(!s.research||typeof s.research!=='object')s.research={level:1,knowledge:0,fields:{molecules:0,ecosystem:0,nutrition:0,cognition:0,genomics:0},history:[],lastActionDay:s.lastDay||1};
 const r=s.research;r.level=Math.min(1000,Math.max(1,Math.floor(Number(r.level)||1)));r.knowledge=clamp(r.knowledge,0,10000000);
 if(!r.fields)r.fields={};for(const f of fields)r.fields[f.id]=clamp(r.fields[f.id],0,10000000);
 if(!Array.isArray(r.history))r.history=[];
 if(!s.foodFactory||typeof s.foodFactory!=='object')s.foodFactory={stock:{},lastDay:s.lastDay||1};
 if(!s.foodFactory.stock)s.foodFactory.stock={};
 for(const f of FOOD)if(!Number.isFinite(s.foodFactory.stock[f.id]))s.foodFactory.stock[f.id]=0;
 if(!Array.isArray(s.achievements))s.achievements=[];
 return r;
}
function knowledge(s,field,points,reason){
 const r=ensure(s),f=fields.find(x=>x.id===field)||fields[0],n=Math.max(0,Math.round(points));
 r.knowledge+=n;r.fields[f.id]+=n;
 if(reason)E.log(s,'📚 '+reason+': +'+n+' истражувачко знаење.','research');
 return n;
}
function maxPet(s){return Math.max(0,...s.pets.map(p=>E.evolutionProgress(p).level));}
function petActions(s){return E.PET_ACTIONS+Math.floor((ensure(s).level-1)/2);}
function labActions(s){return E.LAB_ACTIONS+Math.floor((ensure(s).level-1)/2);}
function quality(s){return s.habitats.length?Math.max(...s.habitats.map(h=>E.envScore(h))):0;}
function requirements(s,level){const t=TIERS.find(x=>x.level===level),r=ensure(s);if(!t)return {ok:false,items:[],message:'Нема наредно ниво.'};
 const checks=[
 ['Поминати денови',s.lastDay>=t.day,s.lastDay+'/'+t.day],
 ['Фаза на светот',s.stage>=t.stage,(s.stage+1)+'/'+(t.stage+1)],
 ['Стекнато знаење',r.knowledge>=t.knowledge,Math.round(r.knowledge)+'/'+t.knowledge],
 ['Сознание',s.insight>=t.insight,Math.round(s.insight)+'/'+t.insight],
 ['Област: '+(fields.find(f=>f.id===t.field)?.name||'основна'),!t.field||r.fields[t.field]>=t.fieldPoints,(t.field?Math.round(r.fields[t.field]):0)+'/'+t.fieldPoints],
 ['Најразвиено милениче',maxPet(s)>=t.petLevel,maxPet(s)+'/'+t.petLevel],
 ['Живеалишта',s.habitats.length>=t.habitats,s.habitats.length+'/'+t.habitats],
 ['Квалитет на живеалиште',quality(s)>=t.quality,quality(s)+'/'+t.quality]
 ];
 if(level>1)checks.push(['Материјали',s.compounds>=t.material,s.compounds+'/'+t.material]);
 return{ok:checks.every(x=>x[1]),items:checks.map(x=>({label:x[0],ok:x[1],value:x[2]})),name:t.name};
}
function upgrade(s){const r=ensure(s),next=r.level+1,req=requirements(s,next);if(!req.ok)return fail('Прво исполни ги условите на наредната лабораторија.');
 if(s.labActions<1)return fail('Нема лабораториски акции.');
 const tier=TIERS[next-1];s.insight-=tier.insight;s.compounds-=tier.material;s.labActions--;
 r.level=next;r.history.push({day:s.lastDay,level:next,name:tier.name});
 s.labActions+=labActions(s)-(E.LAB_ACTIONS+Math.floor((next-2)/2));
 for(const p of s.pets)p.actionsLeft=Math.min(petActions(s),p.actionsLeft+(petActions(s)-(E.PET_ACTIONS+Math.floor((next-2)/2))));
 E.log(s,'🏛️ Надградена лабораторијата на ниво '+next+': '+tier.name+'!','milestone');mark(s,'lab'+next,'Лабораторија '+next, 'Отклучен '+tier.name);
 return success('Отклучено: '+tier.name+' · нови можности, интеракции и форми на живот.');
}
function study(s,field){
 const r=ensure(s),f=fields.find(x=>x.id===field);if(!f)return fail('Непозната истражувачка област.');
 if(s.labActions<1)return fail('Нема лабораториски акции денес.');
 if(field==='cognition'&&r.level<3)return fail('Когницијата бара лабораторија ниво 3.');
 if(field==='genomics'&&r.level<4)return fail('Фантастичната генетика бара лабораторија ниво 4.');
 if(s.compounds<3||s.energy<5)return fail('Потребни се 3 молекули и 5 енергија.');
 s.compounds-=3;s.energy-=5;s.labActions--;
 const earned=12+r.level*4+Math.min(7,Math.floor(maxPet(s)/5));knowledge(s,field,earned,f.name);
 s.insight+=3;
 return success('Ново знаење во '+f.name+': +'+earned+' · +3 сознание.');
}
function foodCompatible(sp,recipe,pet){if(recipe.group==='all')return true;
 if(recipe.group==='advanced')return pet?.evolution?.level>=15;
 return sp?.habitat===recipe.group;
}
function craft(s,id){const r=ensure(s),recipe=FOOD.find(x=>x.id===id);if(!recipe)return fail('Непозната симулирана храна.');
 if(r.level<recipe.tier)return fail('Надгради ја лабораторијата за оваа формула.');
 if(s.labActions<1)return fail('Нема лабораториски акции.');
 if(s.biomass<recipe.cost.biomass||s.compounds<recipe.cost.compounds)return fail('Недостигаат биомаса или молекули за храната.');
 s.labActions--;s.biomass-=recipe.cost.biomass;s.compounds-=recipe.cost.compounds;
 s.foodFactory.stock[id]+=recipe.yield;
 knowledge(s,'nutrition',4+recipe.tier,'Подготвена '+recipe.name);
 E.log(s,'🥣 Производство: '+recipe.yield+' порции '+recipe.name+'.','food');
 return success('Создадени се '+recipe.yield+' порции '+recipe.name+'.');
}
function feed(s,petId,id){ensure(s);const p=s.pets.find(x=>x.id===petId),recipe=FOOD.find(x=>x.id===id);
 if(!p)return fail('Избери миленик.');if(!recipe)return fail('Избери формула за храна.');
 if(s.foodFactory.stock[id]<=0)return fail('Нема подготвени порции.');if(!foodCompatible(E.SPECIES[p.species],recipe,p))return fail('Оваа храна не одговара на видот или развојот на миленикот.');
 if(p.actionsLeft<=0)return fail('Ова милениче ги потроши своите дневни акции.');
 // Existing care logic consumes 3 biomass: temporarily cover it with inventory food.
 s.biomass+=3;const outcome=E.petCare(s,p.id,'feed');if(!outcome.ok){s.biomass-=3;return outcome;}
 s.foodFactory.stock[id]--;
 p.satiety=clamp(p.satiety+recipe.boost);
 p.joy=clamp(p.joy+recipe.joy);p.energy=clamp(p.energy+recipe.energy);
 const extra=recipe.group==='all'?4:recipe.boost;
 E.evolutionGain(s,p,extra,'Специјална нутритивна храна');
 E.log(s,'🍽️ '+p.name+' доби '+recipe.name+' (+XP '+extra+').','food');
 mark(s,'chef','Прва лабораториска храна','Подготвен и употребен оригинален оброк');
 return success('Нахрането со '+recipe.name+' · бонус '+extra+' XP.');
}
function interact(s,petId,action){
 const r=ensure(s),p=s.pets.find(x=>x.id===petId);if(!p)return fail('Прво избери милениче.');
 const lv=E.evolutionProgress(p).level;const req={observe:[2,3],puzzle:[3,6],teach:[4,10],dialogue:[5,16]};
 const x=req[action];if(!x)return fail('Непозната когнитивна активност.');
 if(r.level<x[0]||lv<x[1])return fail('Потребни се лабораторија ниво '+x[0]+' и миленик ниво '+x[1]+'.');
 if(p.actionsLeft<1)return fail('Нема лични дневни акции.');
 if(p.energy<6)return fail('Миленикот е уморен.');p.actionsLeft--;p.energy=clamp(p.energy-6);
 const brain=p.evolution;brain.symbols=brain.symbols||[];
 const vocabulary=['лу','ви','на','три','ор','сиа','еми','ра','ноа','ки','сум','ве'];
 const ix=Math.min(vocabulary.length-1,Math.floor(lv/2)+Math.floor(brain.trained/10))%vocabulary.length;
 const newWord=vocabulary[ix];if(!brain.symbols.includes(newWord))brain.symbols.push(newWord);
 const phrase=action==='dialogue'?'„'+brain.symbols.slice(-4).join(' ')+'“':action==='teach'?'„'+brain.symbols.slice(-2).join(' ')+'“':action==='puzzle'?'✦ '+newWord+' ✦':newWord+'?';
 p.lastSpeech=phrase;p.speechAt=(typeof performance!=='undefined'?performance.now():0);
 p.language=phrase;p.joy=clamp(p.joy+4+(action==='dialogue'?6:0));p.bond=clamp(p.bond+3);
 E.evolutionLearn(p,action==='observe'?'explore':action==='puzzle'?'play':'talk',Math.min(1,.45+lv/70));
 E.evolutionGain(s,p,action==='dialogue'?26:action==='teach'?20:action==='puzzle'?16:9,'Интелектуална активност');
 knowledge(s,'cognition',action==='dialogue'?8:action==='teach'?6:4,null);
 E.log(s,'🗣️ '+p.name+' '+({observe:'набљудуваше',puzzle:'решаваше играчка загатка',teach:'учеше симболи',dialogue:'комуницираше'}[action])+': '+phrase,'care');
 mark(s,'speaker','Прва комуникација','Милениче започна да користи сопствени симболи');
 return success(p.name+' се изрази: '+phrase+'. Речник '+brain.symbols.length+' симболи.');
}
function editGenes(s,petId,design){
 const r=ensure(s),p=s.pets.find(x=>x.id===petId);
 if(!p)return fail('Одбери миленик за фантастична ДНК-архитектура.');
 if(r.level<6||E.evolutionProgress(p).level<22)return fail('Потребни се лабораторија ниво 6 и миленик ниво 22.');
 if(s.labActions<1)return fail('Нема лабораториски акции.');
 if(s.compounds<25||s.insight<15)return fail('Потребни се 25 молекули и 15 сознание.');
 const hue=Number(design.hue),eyes=Number(design.eyes),shape=String(design.shape||'');
 if(!Number.isInteger(hue)||hue<0||hue>359||!Number.isInteger(eyes)||eyes<1||eyes>5||!['jelly','crystal','leaf','cloud'].includes(shape))return fail('Невалиден изглед во ДНК-дизајнерот.');
 s.labActions--;s.compounds-=25;s.insight-=15;
 p.hue=hue;p.eyes=eyes;p.shape=shape;p.genome={hue,eyes,shape,editedAtDay:s.lastDay,signature:((p.seed*73+hue*7+eyes*17)>>>0).toString(36)};
 E.evolutionGain(s,p,55,'Персонализирана фантастична ДНК');
 E.log(s,'🧬 Фантастична ДНК-архитектура: '+p.name+' доби уникатен изглед (ниво 6).','milestone');
 mark(s,'dna','Мој генетски дизајн','Создаден е единствен визуелен геном');
 return success('Уникатната измислена ДНК на '+p.name+' е зачувана!');
}
function mark(s,id,title,description){ensure(s);if(s.achievements.some(a=>a&&typeof a==='object'&&a.id===id))return;
 const a={id,title,description,day:s.lastDay,at:new Date().toISOString()};s.achievements.push(a);E.log(s,'🏆 Постигнување: '+title,'milestone');}
function achievementList(s){ensure(s);const earned=s.achievements.filter(a=>a&&typeof a==='object');
 const milestones=[
 {id:'first-pet',title:'Првиот пријател',description:'Создадено првото милениче'},
 {id:'first-plant',title:'Првиот биосвет',description:'Засадено првото растение'},
 {id:'learned',title:'Мал научник',description:'50 истражувачки поени'},
 {id:'advanced',title:'Развиена интелигенција',description:'Миленик со ниво 15'},
 {id:'ecology',title:'Жив свет',description:'Две живеалишта'},
 {id:'lab6',title:'Генетски архитекти',description:'Лабораторија ниво 6'}
 ];return{earned,milestones};}
function discover(s){ensure(s);
 if(s.pets.length)mark(s,'first-pet','Првиот пријател','Создадено првото милениче');
 if(s.habitats.some(h=>h.flora.length))mark(s,'first-plant','Првиот биосвет','Засадено првото растение');
 if(s.research.knowledge>=50)mark(s,'learned','Мал научник','50 истражувачки поени');
 if(maxPet(s)>=15)mark(s,'advanced','Развиена интелигенција','Миленик со ниво 15');
 if(s.habitats.length>=2)mark(s,'ecology','Жив свет','Две живеалишта');
}
E.newGame=(...args)=>{const s=prior.newGame(...args);ensure(s);s.version='1.3.0';return s;};
E.validate=s=>!!s&&['1.1.0','1.2.0','1.3.0'].includes(s.version)&&prior.validate({...s,version:'1.2.0'});
E.advance=(s,now)=>{ensure(s);const prev=s.lastDay,n=prior.advance(s,now);s.version='1.3.0';
 if(s.lastDay!==prev){s.labActions=labActions(s);for(const p of s.pets)p.actionsLeft=petActions(s);}
 discover(s);return n;};
E.demoNext=s=>{ensure(s);const prev=s.lastDay,n=prior.demoNext(s);s.version='1.3.0';
 if(n.ok&&s.lastDay!==prev){s.labActions=labActions(s);for(const p of s.pets)p.actionsLeft=petActions(s);}discover(s);return n;};
E.basicResearch=(s,type)=>{ensure(s);const r=prior.basicResearch(s,type);if(r.ok){const field=type==='grow'?'ecosystem':'molecules';knowledge(s,field,type==='analyze'?9:type==='synthesize'?6:3,null);discover(s);}return r;};
E.evolve=s=>{const r=prior.evolve(s);if(r.ok){knowledge(s,'ecosystem',12,null);discover(s);}return r;};
E.createPet=(s,i)=>{ensure(s);const sp=E.SPECIES[i];if(!sp)return fail('Непознат вид.');
 if(sp.labTier&&s.research.level<sp.labTier)return fail('Овој вид бара лабораторија ниво '+sp.labTier+'.');
 if(sp.labTier&&(!s.blueprints.includes('species-'+i)))return fail('Прво отклучи го видот преку истражување.');
 if(sp.labTier){const h=E.currentHabitat(s);if(h&&h.biome!==sp.habitat)return fail('За овој вид треба живеалиште од тип '+sp.habitat+'.');if(h&&E.envScore(h)<62)return fail('Овој интелигентен вид бара биохемиски квалитет најмалку 62%.');}
 const result=prior.createPet(s,i);s.version='1.3.0';if(result.ok){const p=E.currentPet(s);p.actionsLeft=petActions(s);discover(s);}return result;};
E.petCare=(s,id,kind)=>{ensure(s);const r=prior.petCare(s,id,kind);s.version='1.3.0';if(r.ok){knowledge(s,kind==='talk'?'cognition':'ecosystem',kind==='talk'?3:1,null);discover(s);}return r;};
E.inventPlant=(s,id)=>{ensure(s);const plant=E.PLANTS.find(p=>p.id===id);if(plant?.labTier&&s.research.level<plant.labTier)return fail('Потребна е ботаничка лабораторија ниво '+plant.labTier+'.');
 const r=prior.inventPlant(s,id);if(r.ok)knowledge(s,'ecosystem',8,null);return r;};
E.habitatCare=(s,kind)=>{ensure(s);const r=prior.habitatCare(s,kind);if(r.ok)knowledge(s,'ecosystem',2,null);return r;};
function unlockSpecies(s,i){const p=E.SPECIES[i],r=ensure(s);if(!p?.labTier)return fail('Основните видови се веќе достапни.');
 if(r.level<p.labTier)return fail('Отклучување на лабораторија ниво '+p.labTier+' е задолжително.');
 const key='species-'+i;if(s.blueprints.includes(key))return fail('Видот е веќе проучен.');
 if(s.insight<18||s.compounds<12)return fail('Потребни се 18 сознание и 12 молекули.');
 if(s.labActions<1)return fail('Нема лабораториски акции.');
 s.insight-=18;s.compounds-=12;s.labActions--;s.blueprints.push(key);
 knowledge(s,'molecules',16,'Каталогизиран нов вид '+p.name);
 E.log(s,'🐾 Отклучен нов фантастичен вид: '+p.name,'milestone');return success('Нов вид '+p.name+' е достапен за создавање.');
}
const earlierSocialize=E.socialize;
E.socialize=(s,petId,friendId)=>{const result=earlierSocialize(s,petId,friendId);if(s)s.version='1.3.0';return result;};
E.VERSION='1.3.0';
E.researchFields=fields;E.researchTiers=TIERS;E.foodRecipes=FOOD;
E.ensureResearch=ensure;E.study=study;E.upgradeLab=upgrade;E.labRequirements=requirements;
E.labActionLimit=labActions;E.petActionLimit=petActions;E.maxPetLevel=maxPet;E.maxHabitatQuality=quality;
E.craftFood=craft;E.feedPrepared=feed;E.feedCompatible=foodCompatible;E.cognitiveAction=interact;
E.editFictionalGenes=editGenes;E.unlockSpecies=unlockSpecies;E.achievementList=achievementList;E.refreshAchievements=discover;
if(typeof module==='object'&&module.exports)module.exports={ensure,knowledge,study,upgrade,requirements,craft,feed,interact,editGenes,unlockSpecies,TIERS,FOOD,NEW_SPECIES,NEW_PLANTS};
})(typeof globalThis!=='undefined'?globalThis:this);
