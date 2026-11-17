/* TRIALUM 1.4.1: explicit local debug tools for developer testing only.
   No real-money payment and no automatic test mode in normal play. */
(function(root){
'use strict';
const E=root.TrialumEngine;
if(!E||E.debugAdvanceDays)return;
function enabled(s){return !!s?.settings?.debugEnabled}
function unlock(s){if(!s?.settings)return{ok:false,message:'Нема зачуван свет.'};s.settings.debugEnabled=!s.settings.debugEnabled;s.settings.debugEverUsed=s.settings.debugEverUsed||s.settings.debugEnabled;return{ok:true,message:s.settings.debugEnabled?'Режимот за дебагирање е активен само во Поставки.':'Дебагирањето е исклучено.'};}
function advance(s,count=1){
 if(!enabled(s))return{ok:false,message:'🔒 Вклучи дебагирање од Поставки.'};
 const n=Number(count);if(!Number.isInteger(n)||![1,7,30].includes(n))return{ok:false,message:'Дозволени се +1, +7 или +30 дена.'};
 const before=s.lastDay;
 s.createdAt-=n*E.DAY_MS;
 if(s.longplay){s.longplay.lastTick-=n*12*60000;s.longplay.earlyBonusMs=s.longplay.earlyBonusMs||0;}
 const actual=E.advance(s,Date.now());
 if(s.longplay?.ledger)s.longplay.ledger.push({day:s.lastDay,type:'debug',value:0,reason:'Тест скок +'+n+' дена'});
 E.log(s,'🧪 [ДЕБАГИРАЊЕ] Симулирано поминување на '+n+' дена.','debug');
 return{ok:true,message:'Дебагирање: поминати '+(s.lastDay-before)+' дена. Тековен ден '+s.lastDay+' · дневните акции се обновени.'};
}
function resources(s){
 if(!enabled(s))return{ok:false,message:'🔒 Вклучи дебагирање од Поставки.'};
 for(const k of E.ELEMENTS)s.elements[k]=Math.max(s.elements[k]||0,1500);
 s.insight=Math.max(s.insight,2500);s.compounds=Math.max(s.compounds,2500);
 s.biomass=Math.max(s.biomass,2500);s.energy=Math.max(s.energy,90);s.cells=Math.max(s.cells,1000);
 const fields=E.ensureResearch(s).fields;for(const k of Object.keys(fields))fields[k]=Math.max(fields[k],400);
 s.research.knowledge=Math.max(s.research.knowledge,2500);
 E.log(s,'🧪 [ДЕБАГИРАЊЕ] Дополнети тестни ресурси за испитување на лабораториите.','debug');
 return{ok:true,message:'Тестните ресурси се дополнети. Ова не се вистински заработени ресурси.'};
}
function petLevels(s,amount=5){
 if(!enabled(s))return{ok:false,message:'🔒 Вклучи дебагирање од Поставки.'};
 const p=E.currentPet(s);if(!p)return{ok:false,message:'Избери миленик во аквариумот.'};
 const n=Number(amount);if(![5,20].includes(n))return{ok:false,message:'Невалиден тест скок.'};
 const evo=E.ensureEvolution(p);evo.level=Math.min(2000,evo.level+n);p.ageDays=Math.max(p.ageDays,61+(evo.level-22)*4);
 p.growth=Math.min(100,Math.max(p.growth,15+evo.level*.3));
 E.log(s,'🧪 [ДЕБАГИРАЊЕ] '+p.name+' доби +'+n+' тестни еволутивни нивоа.','debug');
 return{ok:true,message:p.name+' достигна ниво '+evo.level+' (тестни поени).'};
}
E.debugToggle=unlock;E.debugAdvanceDays=advance;E.debugGrantResources=resources;E.debugPetLevels=petLevels;
if(typeof module==='object'&&module.exports)module.exports={enabled,unlock,advance,resources,petLevels};
})(typeof globalThis!=='undefined'?globalThis:this);
