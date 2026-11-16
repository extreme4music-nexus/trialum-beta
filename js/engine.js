/* TRIALUM 1.1 — deterministic, fictional chemistry and care simulation.
 * UMD for browser and Node regression tests. No real synthesis instructions. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.TrialumEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='1.1.0', DAY_MS=86400000, PET_ACTIONS=4, HAB_ACTIONS=4, LAB_ACTIONS=5;
const PHASES=['Атомски океан','Органски молекули','Протоклетка','Самоодржувачка клетка','Колонија','Ткива и органели','Нови суштества','Жив екосистем'];
const PHASE_REQ=[{day:1,insight:3,compounds:4},{day:2,insight:8,compounds:9},{day:3,insight:12,compounds:11},{day:5,insight:17,compounds:14,cells:4},{day:7,insight:24,compounds:18,cells:16},{day:11,insight:32,compounds:22,cells:40},{day:30,insight:70,compounds:38,cells:130,pets:2}];
const ELEMENTS=['C','H','O','N','P','S','Si','Fe','Ca','Mg','K','Na','Zn','Cu'];
const START={C:180,H:300,O:260,N:140,P:90,S:65,Si:150,Fe:100,Ca:100,Mg:85,K:90,Na:95,Zn:35,Cu:30};
const SPECIES=[
 {name:'Лумира',shape:'jelly',hue:176,eyes:2,weight:1,voice:1,icon:'✦',habitat:'lagoon'},
 {name:'Кристел',shape:'crystal',hue:257,eyes:3,weight:2,voice:2,icon:'◆',habitat:'crystal'},
 {name:'Нубела',shape:'cloud',hue:331,eyes:1,weight:2,voice:3,icon:'☁',habitat:'lagoon'},
 {name:'Флорикс',shape:'leaf',hue:116,eyes:2,weight:1,voice:4,icon:'❀',habitat:'garden'}
];
const PLANTS=[
 {id:'lumemoss',name:'Лумемов',icon:'🌿',growth:1.4,oxygen:1.4,kind:'Меко фотосинтетичко влакно'},
 {id:'glowfern',name:'Сјајна спира',icon:'🌱',growth:1.0,oxygen:2,kind:'Светлосни ленти'},
 {id:'mineralreed',name:'Кристалостебло',icon:'🪴',growth:.8,oxygen:2.8,kind:'Минерална флора'}
];
const BIOMES=[{id:'lagoon',name:'Тиркизна лагуна',capacity:8,color:'#2e96a3'}, {id:'crystal',name:'Кристална пештера',capacity:10,color:'#836dd8'}, {id:'garden',name:'Биолуминесцентна градина',capacity:12,color:'#477c59'}];
const BUILD_TASKS=[
 {id:'frame',name:'Изгради минерална рамка',label:'Si + Ca + Fe',cost:{Si:24,Ca:14,Fe:6}},
 {id:'shell',name:'Синтетизирај заштитна обвивка',label:'C + H + P',cost:{C:18,H:28,P:9}},
 {id:'water',name:'Стабилизирај биохемиски раствор',label:'O + H + Na',cost:{O:25,H:30,Na:10}},
 {id:'minerals',name:'Внеси микро- и макроелементи',label:'Ca + Mg + K + Zn',cost:{Ca:13,Mg:12,K:12,Zn:3}},
 {id:'microflora',name:'Засади прва симбиотска флора',label:'C + N + P',cost:{C:15,N:12,P:6}}
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
const round=(x)=>Math.round(x*10)/10;
const prng=(seed)=>((seed*1664525+1013904223)>>>0);
function rng(s){s.seed=prng(s.seed);return s.seed/4294967296;}
function id(s,prefix){s.sequence=(s.sequence||0)+1;return prefix+'-'+s.sequence;}
function log(s,text,kind='info',day=s.lastDay){s.logs.push({id:id(s,'evt'),day,at:new Date().toISOString(),kind,text});}
function newGame(mode='real',timestamp=Date.now()){
 const s={version:VERSION,mode:mode==='demo'?'demo':'real',createdAt:timestamp,lastDay:1,demoDay:1,seed:Math.floor((timestamp||1)%4294967295),sequence:0,stage:0,insight:8,compounds:0,biomass:18,energy:90,cells:0,elements:{...START},labActions:LAB_ACTIONS,habitats:[],construction:null,pets:[],activeHabitat:null,selectedPet:null,blueprints:[],unlocks:[],logs:[],settings:{sound:true,music:false,alerts:true,volume:.55},achievements:[]};
 log(s,'Светот започна од неживи виртуелни елементи. Нема клетки, флора или миленици.','milestone');
 return s;
}
function dayFor(s,now=Date.now()){return s.mode==='demo'?s.demoDay:1+Math.max(0,Math.floor((now-s.createdAt)/DAY_MS));}
function canPay(stock,cost){return Object.entries(cost).every(([k,v])=>(stock[k]||0)>=v);}
function pay(stock,cost){if(!canPay(stock,cost))return false;for(const [k,v]of Object.entries(cost))stock[k]-=v;return true;}
function currentPet(s){return s.pets.find(p=>p.id===s.selectedPet)||null;}
function currentHabitat(s){return s.habitats.find(h=>h.id===s.activeHabitat)||null;}
function loadOf(p){return Math.max(1,Math.min(4,Math.ceil(p.growth/25)))*SPECIES[p.species].weight;}
function occupancy(s,habId){return s.pets.filter(p=>p.habitatId===habId).reduce((n,p)=>n+loadOf(p),0);}
function envScore(h){const m=h.minerals,chem=h.chem;return Math.round(clamp(100- Math.abs(chem.ph-7.1)*17-Math.abs(chem.temp-24)*1.7-(100-chem.oxygen)*.45-chem.toxins*.55-Math.abs(m.macro-60)*.18-Math.abs(m.micro-50)*.18-(100-h.cleanliness)*.2,0,100));}
function habitatName(index,biome){return `${biome.name} ${index}`;}
function makeHabitat(s,biome){const h={id:id(s,'hab'),name:habitatName(s.habitats.length+1,biome),biome:biome.id,capacity:biome.capacity,minerals:{macro:65,micro:60},chem:{ph:7.1,temp:24,oxygen:84,toxins:5},cleanliness:90,flora:[],dayActions:HAB_ACTIONS,bornDay:s.lastDay};s.habitats.push(h);s.activeHabitat=h.id;log(s,`🏝 Изградено ново живеалиште „${h.name}“ од почетни елементи.`,'milestone');return h;}
function daily(s,day){
 s.lastDay=day;s.labActions=LAB_ACTIONS;s.energy=clamp(s.energy+24,0,100);s.insight+=2;s.biomass+=s.stage>=4?5:1;
 // Elemental influx represents fictional geology, not chemistry.
 for(const el of ELEMENTS)s.elements[el]+=['Zn','Cu'].includes(el)?1:3;
 if(s.stage>=2){s.cells=Math.max(1,Math.round(s.cells*1.09)+1);s.cells=Math.min(100000,s.cells)}
 for(const h of s.habitats){
 h.dayActions=HAB_ACTIONS;const n=s.pets.filter(p=>p.habitatId===h.id).length;
 h.chem.oxygen=clamp(h.chem.oxygen+ h.flora.length*2.3-n*2.1-1,0,100);
 h.minerals.macro=clamp(h.minerals.macro-.8-h.flora.length*.8,0,100);
 h.minerals.micro=clamp(h.minerals.micro-.6-h.flora.length*.5,0,100);
 h.chem.ph=round(clamp(h.chem.ph+ (rng(s)-.52)*.12+ (n>2?.035:0),5,9));
 h.chem.temp=round(clamp(h.chem.temp+(rng(s)-.5)*.55,12,35));
 h.chem.toxins=clamp(h.chem.toxins+n*1.3-h.flora.length*.8,0,100);
 h.cleanliness=clamp(h.cleanliness-2.5-n*.9,0,100);
 for(const f of h.flora){f.growth=clamp(f.growth+4.7,0,100);if(f.growth>=30)h.chem.oxygen=clamp(h.chem.oxygen+PLANTS.find(x=>x.id===f.species).oxygen,0,100)}
 }
 for(const p of s.pets){
 const h=s.habitats.find(x=>x.id===p.habitatId);const quality=h?envScore(h):50;
 p.actionsLeft=PET_ACTIONS;p.satiety=clamp(p.satiety-7,0,100);p.joy=clamp(p.joy-5.5,0,100);p.energy=clamp(p.energy+11,0,100);p.clean=clamp(p.clean-5.5,0,100);
 p.growth=clamp(p.growth+(.5+quality/110)*(p.satiety>25?1:.4),0,100);
 if(quality<45){p.joy=clamp(p.joy-7,0,100);p.energy=clamp(p.energy-4,0,100)}
 p.ageDays=Math.max(0,day-p.birthDay);p.mood=quality<40?'Вознемирено':p.joy<30?'Тажно':p.satiety<30?'Гладно':p.joy>70?'Весело':'Мирно';
 }
 if(day%7===0)log(s,`📅 Недела ${day/7}: обновени условите во ${s.habitats.length} живеалишта, ${s.pets.length} миленици.`,'summary',day);
}
function advance(s,now=Date.now()){
 const target=dayFor(s,now);let remaining=Math.max(0,target-s.lastDay),done=0;
 // Cap expensive offline catch-up; still show correct day after processing in deterministic chunks.
 while(remaining>0&&done<365){daily(s,s.lastDay+1);remaining--;done++}
 if(remaining>0){s.lastDay=target;log(s,'Скратена симулација на многу долг период без играње.','system')}
 return done;
}
function demoNext(s){if(s.mode!=='demo')return {ok:false,message:'Ова копче работи само во тест-режим.'};s.demoDay+=1;advance(s);return {ok:true,message:'Се смени денот. Дневните акции се обновени.'}}
function basicResearch(s,type){if(s.labActions<1)return fail('Нема лабораториски акции денес.');if(type==='synthesize'){
 const cost={C:3,H:5,O:3,N:2,P:1};if(!pay(s.elements,cost))return fail('Недостигаат суровини за синтеза.');s.compounds+=8;s.insight+=2;s.energy=clamp(s.energy-3,0,100);s.labActions--;log(s,'⚗️ Создадени се 8 измислени органски единици од елементи.');return ok('Синтезирани се молекули и добиено е знаење.');}
 if(type==='analyze'){if(s.energy<5)return fail('Недоволно енергија.');s.insight+=7;s.energy-=5;s.labActions--;log(s,'🔬 Анализа на виртуелни реакции: +7 сознание.');return ok('Нови истражувачки поени.');}
 if(type==='harvest'){s.labActions--;s.elements.C+=14;s.elements.H+=22;s.elements.O+=16;s.elements.N+=11;s.elements.Si+=8;s.elements.Ca+=7;s.elements.Mg+=6;s.elements.K+=6;s.elements.Fe+=5;s.elements.P+=6;s.elements.Na+=5;s.elements.Zn+=2;s.elements.Cu+=2;log(s,'🪨 Собрани нови неживи суровини од геолошката зона.');return ok('Додадени се хемиски резерви.');}
 if(type==='grow'){if(s.stage<2)return fail('Прво создади протоклетка.');if(s.compounds<5)return fail('Потребни се 5 органски единици.');s.labActions--;s.compounds-=5;s.cells+=Math.max(5,Math.round(s.cells*.24));s.biomass+=5;log(s,`🧫 Клетките се размножија. Сега има ${s.cells} клетки.`);return ok('Клеточната популација расте.');}
 return fail('Непозната лабораториска акција.');}
function evolve(s){if(s.stage>=7)return fail('Достигнат е зрел екосистем.');const next=s.stage+1,r=PHASE_REQ[next-1]||PHASE_REQ[0];
 if(s.lastDay<r.day)return fail(`Наредната фаза се отклучува најрано на ${r.day}. ден.`);
 if(s.insight<r.insight)return fail(`Потребни се ${r.insight} сознание. Имаш ${s.insight}.`);
 if(s.compounds<r.compounds)return fail(`Потребни се ${r.compounds} органски единици.`);
 if(r.cells&&s.cells<r.cells)return fail(`Потребни се ${r.cells} клетки.`);
 if(r.pets&&s.pets.length<r.pets)return fail('Потребни се најмалку две фантастични миленици.');
 s.insight-=r.insight;s.compounds-=r.compounds;s.stage=next;
 if(next===2)s.cells=1;if(next===3)s.cells=Math.max(s.cells,4);if(next===4)s.cells=Math.max(s.cells,18);if(next===5)s.cells=Math.max(s.cells,44);
 s.biomass+=next>=5?25:8;
 log(s,`✨ Еволуција: ${PHASES[next]}.`,'milestone');
 if(next===6)log(s,'Сега започни изградба на првото живеалиште. Милениците доаѓаат откако ќе биде готово.','guide');
 return ok('Нова еволутивна фаза: '+PHASES[next]);
}
function startBuilding(s,biomeId){if(s.stage<6)return fail('Достигни ја фазата на суштества.');if(s.construction)return fail('Веќе градиш едно живеалиште.');
 const biome=BIOMES.find(x=>x.id===biomeId);if(!biome)return fail('Непознат биом.');
 s.construction={id:id(s,'build'),biome:biome.id,step:0,lastStepDay:0,startDay:s.lastDay};log(s,`🏗️ Започната изградба на нова ${biome.name.toLowerCase()}.`);return ok('Изградбата започна. Потребни се пет чекори, најмногу еден дневно.');}
function buildStep(s){const b=s.construction;if(!b)return fail('Нема активна изградба.');if(b.lastStepDay===s.lastDay)return fail('Еден градежен чекор дневно. Продолжи следниот ден.');
 const task=BUILD_TASKS[b.step];if(!task)return fail('Погрешна градежна фаза.');
 if(!pay(s.elements,task.cost))return fail('Недостигаат елементи за: '+task.label);
 b.step++;b.lastStepDay=s.lastDay;log(s,`🔧 ${task.name} (${b.step}/${BUILD_TASKS.length}).`);
 if(b.step===BUILD_TASKS.length){const biome=BIOMES.find(x=>x.id===b.biome);const h=makeHabitat(s,biome);s.construction=null;h.flora.push({id:id(s,'flora'),species:'lumemoss',growth:24});return ok('Новото живеалиште е завршено!')}
 return ok(task.name+' е завршено. Продолжи следниот ден.');}
function createPet(s,speciesIndex){if(s.stage<6)return fail('Прво отклучи животински форми.');const h=currentHabitat(s);if(!h)return fail('Прво изгради живеалиште.');
 const sp=SPECIES[speciesIndex];if(!sp)return fail('Непознат вид.');if(s.biomass<22||s.compounds<8)return fail('Потребни се 22 биомаса и 8 органски единици.');
 const minLoad=sp.weight;if(occupancy(s,h.id)+minLoad>h.capacity)return fail('Нема простор во живеалиштето. Изгради ново или префрли миленик.');
 s.biomass-=22;s.compounds-=8;const number=s.pets.length+1;
 const p={id:id(s,'pet'),species:speciesIndex,name:sp.name+' '+number,habitatId:h.id,hue:(sp.hue+Math.round((rng(s)-.5)*36)+360)%360,seed:Math.floor(rng(s)*100000),eyes:sp.eyes,shape:sp.shape,birthDay:s.lastDay,ageDays:0,growth:2,satiety:80,joy:70,energy:78,clean:86,bond:10,actionsLeft:PET_ACTIONS,mood:'Љубопитно',language:['у-ру','квип','лим','проо','буру'][Math.floor(rng(s)*5)]};
 s.pets.push(p);s.selectedPet=p.id;log(s,`🐾 Создаден нов непостоечки вид: ${p.name}, во ${h.name}.`,'milestone');return ok('Се појави '+p.name+'! Допрете го во аквариумот.');}
function selectPet(s,id){const p=s.pets.find(x=>x.id===id);if(!p)return fail('Нема таков миленик.');s.selectedPet=id;s.activeHabitat=p.habitatId;return ok('Избрано: '+p.name)}
function petCare(s,id,type){const p=s.pets.find(x=>x.id===id);if(!p)return fail('Прво одбери миленик.');if(p.actionsLeft<=0)return fail(`${p.name} ги искористи своите 4 дневни акции.`);
 if(type==='feed'){if(s.biomass<3)return fail('Нема доволно биомаса за храна.');s.biomass-=3;p.satiety=clamp(p.satiety+26,0,100);p.bond=clamp(p.bond+3,0,100)}
 else if(type==='play'){p.joy=clamp(p.joy+25,0,100);p.energy=clamp(p.energy-13,0,100);p.bond=clamp(p.bond+6,0,100)}
 else if(type==='wash'){p.clean=clamp(p.clean+30,0,100);p.joy=clamp(p.joy+4,0,100)}
 else if(type==='rest'){p.energy=clamp(p.energy+30,0,100);p.joy=clamp(p.joy+3,0,100)}
 else if(type==='talk'){p.bond=clamp(p.bond+12,0,100);p.joy=clamp(p.joy+6,0,100)}
 else return fail('Непозната грижа.');
 p.actionsLeft--;log(s,`💞 ${p.name}: ${ {feed:'нахрането',play:'игра',wash:'чистење',rest:'одмор',talk:'разговор на измислен јазик'}[type]}. Преостанати акции: ${p.actionsLeft}.`,'care');return ok(`${p.name}: ${p.actionsLeft} лични акции останаа.`)}
function transfer(s,petId,targetHabId){const p=s.pets.find(x=>x.id===petId),h=s.habitats.find(x=>x.id===targetHabId);if(!p||!h)return fail('Одбери миленик и завршено живеалиште.');if(p.habitatId===h.id)return fail('Веќе е во тоа живеалиште.');if(occupancy(s,h.id)+loadOf(p)>h.capacity)return fail('Нема доволно простор за неговата сегашна големина.');p.habitatId=h.id;s.activeHabitat=h.id;s.selectedPet=p.id;log(s,`🚚 ${p.name} е префрлено во ${h.name}.`,'care');return ok('Миленикот е безбедно преселен.');}
function habitatCare(s,kind){const h=currentHabitat(s);if(!h)return fail('Одбери живеалиште.');if(h.dayActions<1)return fail('Нема дневни акции за ова живеалиште.');
 if(kind==='macro'){if(!pay(s.elements,{Ca:7,Mg:5,K:6}))return fail('Потребни се Ca, Mg и K.');h.minerals.macro=clamp(h.minerals.macro+25,0,100);}
 else if(kind==='micro'){if(!pay(s.elements,{Fe:5,Zn:2,Cu:2}))return fail('Потребни се Fe, Zn и Cu.');h.minerals.micro=clamp(h.minerals.micro+22,0,100);}
 else if(kind==='oxygen'){if(!pay(s.elements,{O:9,H:6}))return fail('Потребни се O и H.');h.chem.oxygen=clamp(h.chem.oxygen+25,0,100);}
 else if(kind==='clean'){h.cleanliness=clamp(h.cleanliness+32,0,100);h.chem.toxins=clamp(h.chem.toxins-20,0,100);}
 else if(kind==='balance'){if(!pay(s.elements,{Na:4,Ca:3}))return fail('Потребни се Na и Ca.');h.chem.ph=round(h.chem.ph+(7.1-h.chem.ph)*.65);h.chem.temp=round(h.chem.temp+(24-h.chem.temp)*.7);}
 else return fail('Непозната биохемиска акција.');
 h.dayActions--;log(s,`🧪 ${h.name}: ${ {macro:'макроелементи',micro:'микроелементи',oxygen:'оксигенација',clean:'чистење',balance:'pH и температура'}[kind]}.`,'habitat');return ok('Биохемиската средина е прилагодена.');}
function inventPlant(s,species){if(s.stage<5)return fail('Прво развиј ткива.');if(s.blueprints.includes(species))return fail('Овој растителен модел е веќе отклучен.');if(!PLANTS.find(x=>x.id===species))return fail('Непозната флора.');if(s.insight<12||s.compounds<7)return fail('Потребни се 12 сознание и 7 молекули.');s.insight-=12;s.compounds-=7;s.blueprints.push(species);log(s,`🌱 Создадено генетско-симулациско растение: ${PLANTS.find(x=>x.id===species).name}.`,'milestone');return ok('Отклучена нова растителна форма.');}
function plant(s,species){const h=currentHabitat(s);if(!h)return fail('Нема живеалиште.');if(!s.blueprints.includes(species))return fail('Прво измисли го ова растение во лабораторијата.');if(h.flora.length>=6)return fail('Најмногу 6 растенија по живеалиште.');if(h.dayActions<1)return fail('Нема дневни акции за живеалиштето.');if(!pay(s.elements,{C:8,N:5,P:3,O:6}))return fail('Недостигаат C, N, P и O.');h.flora.push({id:id(s,'flora'),species,growth:3});h.dayActions--;log(s,`🌿 ${PLANTS.find(x=>x.id===species).name} е засадено во ${h.name}.`,'habitat');return ok('Засадена е нова симулирана флора.');}
function rename(s,what,idValue,name){const target=what==='pet'?s.pets.find(p=>p.id===idValue):s.habitats.find(h=>h.id===idValue);if(!target)return fail('Не е пронајдено.');const clean=String(name||'').trim().slice(0,32);if(!clean)return fail('Внеси име.');target.name=clean;log(s,`✏️ Преименувано: ${clean}.`);return ok('Името е зачувано.');}
function alerts(s){const result=[];for(const p of s.pets){if(p.satiety<35)result.push({type:'hunger',petId:p.id,text:`${p.name} е гладно (${Math.round(p.satiety)}%).`,level:p.satiety<18?'high':'medium'});if(p.joy<35)result.push({type:'play',petId:p.id,text:`${p.name} сака да си игра.`,level:'medium'});if(p.clean<30)result.push({type:'clean',petId:p.id,text:`${p.name} има потреба од чистење.`,level:'medium'});}
 for(const h of s.habitats){const score=envScore(h);if(score<58)result.push({type:'habitat',habitatId:h.id,text:`${h.name}: квалитетот на средината е ${score}%.`,level:score<33?'high':'medium'});if(occupancy(s,h.id)>h.capacity)result.push({type:'crowded',habitatId:h.id,text:`${h.name} е пренаселено. Изгради ново живеалиште.`,level:'high'});}
 return result;}
function diagnostics(s){return {petActions:s.pets.map(p=>({id:p.id,actions:p.actionsLeft})),habitats:s.habitats.map(h=>({id:h.id,used:occupancy(s,h.id),capacity:h.capacity,quality:envScore(h)})),logs:s.logs.length,day:s.lastDay};}
function validate(s){if(!s||s.version!==VERSION||!Array.isArray(s.logs)||!Array.isArray(s.pets)||!Array.isArray(s.habitats)||!s.elements||typeof s.lastDay!=='number'||!['real','demo'].includes(s.mode))return false;return true;}
function ok(message){return {ok:true,message};}function fail(message){return {ok:false,message};}
return {VERSION,DAY_MS,PET_ACTIONS,HAB_ACTIONS,LAB_ACTIONS,PHASES,PHASE_REQ,ELEMENTS,SPECIES,PLANTS,BIOMES,BUILD_TASKS,clamp,newGame,dayFor,advance,demoNext,basicResearch,evolve,startBuilding,buildStep,createPet,selectPet,petCare,transfer,habitatCare,inventPlant,plant,rename,alerts,diagnostics,validate,envScore,loadOf,occupancy,currentPet,currentHabitat,log};
});
