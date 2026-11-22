/* TRIALUM v44 — explanatory resource HUD. All values derive from live local game state. */
(function(root,factory){
 const api=factory(root.TrialumEngine);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.TrialumResourceHUD=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(E){
'use strict';
const KEYS=new Set(['xp','credits','molecules','biomass','insight']);
const fmt=n=>Math.floor(Number(n)||0).toLocaleString('en-US');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let dialog=null,world=null,ctx=null;
function mk(){return globalThis.TrialumI18n?.language?.()==='mk';}
const t=(en,m)=>mk()?m:en;
function describe(s,key){
 if(!E||!s||!KEYS.has(key))return null;
 E.ensureLongplay(s);
 const stage=E.PHASE_REQ[s.stage],nextStage=stage?E.PHASES[s.stage+1]:null;
 const pet=E.currentPet(s);
 if(key==='xp'){
  const total=s.pets.reduce((n,p)=>n+(Number(p.evolution?.earned)||0),0);
  const prog=pet?E.evolutionProgress(pet):null;
  return {key,title:t('Experience points','Поени на искуство'),icon:'⭐',
   value:Math.floor(total),unit:'XP',
   summary:t('Your pets earn XP as they grow, train and interact. Each pet also has a separate level.',
    'Миленичињата добиваат XP преку развој, тренинг и интеракции. Секое милениче има сопствено ниво.'),
   facts:[t('Number of pets','Број миленичиња')+': '+s.pets.length,
    prog?t('Selected pet','Избран миленик')+': '+String(pet.name||'Pet')+
      ' · '+t('level','ниво')+' '+prog.level+' · '+prog.xp+'/'+prog.next+' XP':t('No pet selected','Нема избран миленик'),
    prog?t('Next level minimum age','Минимална возраст за следното ниво')+': '+prog.ageGate+' '+t('days','дена'):''],
   destination:'pets',action:t('Open Pets and Training','Отвори Миленичиња и тренинг')};
 }
 if(key==='credits'){
  const l=s.longplay;
  return {key,title:t('Earned game credits','Заработени кредити'),icon:'💠',value:l.credits,
   summary:t('Credits come from gameplay, not purchases in this beta. One action can be restored for one credit in the contextual action popup.',
    'Во оваа бета кредитите се заработуваат со играње. Една акција се дополнува за еден кредит преку контекстуалниот HUD.'),
   facts:[t('Total earned','Вкупно заработени')+': '+fmt(l.earned),
    t('Available to spend','Расположиви')+': '+fmt(l.credits),
    t('Recent credit movements','Последни движења')+': '+
     (Array.isArray(l.ledger)?l.ledger.slice(-3).reverse().map(x=>(x.value>0?'+':'')+x.value+' ('+String(x.reason||'').slice(0,40)+')').join(' · '):'—')],
   destination:'pets',action:t('Train pets to earn credits','Тренирај миленичиња за кредити')};
 }
 if(key==='molecules'){
  return {key,title:t('Molecules','Молекули'),icon:'⚗️',value:s.compounds,
   summary:t('Molecules are synthesized in the Laboratory and used for life creation, research, materials and evolution.',
    'Молекулите се синтетизираат во лабораторијата и се користат за создавање живот, истражување, материјали и еволуција.'),
   facts:[t('Laboratory actions','Лабораториски акции')+': '+s.labActions+'/'+E.labActionLimit(s),
    stage?t('Next stage requirement','Потребно за следна фаза')+' ('+String(nextStage)+'): '+stage.compounds:'Сите почетни фази се отклучени.',
    t('Basic synthesis yield','Основна синтеза')+': +8 '+t('molecules per action (requires elements)','молекули по акција (со потребни елементи)')],
   destination:'lab',action:t('Open Laboratory','Отвори Лабораторија')};
 }
 if(key==='biomass'){
  return {key,title:t('Biomass','Биомаса'),icon:'🌿',value:s.biomass,
   summary:t('Biomass is a biological resource used to create pets, produce food and maintain your world. The world replenishes some biomass through daily progression.',
    'Биомасата се користи за создавање миленичиња, производство на храна и одржување на светот. Дел се обновува со дневниот развој.'),
   facts:[t('Basic new pet cost','Основна цена за ново милениче')+': 22',
    t('Daily biomass gain at this stage','Дневен прилив во оваа фаза')+': +'+(s.stage>=4?5:1),
    t('Food production','Производство на храна')+': '+t('see Food and Warehouse','погледни Храна и Стовариште')],
   destination:'food',action:t('Open Food production','Отвори производство на храна')};
 }
 return {key,title:t('Scientific insight','Научни сознанија'),icon:'🧠',value:s.insight,
  summary:t('Insight is gained through analysis and research and is required for evolutionary progress.',
   'Сознанијата се добиваат преку анализа и истражување и се потребни за еволутивен напредок.'),
  facts:[t('Basic laboratory analysis','Основна лабораториска анализа')+': +7',
   stage?t('Next evolutionary stage','Следна еволутивна фаза')+' ('+String(nextStage)+'): '+stage.insight:
    t('All eight initial stages unlocked','Отклучени се сите осум почетни фази'),
   t('Current research centre','Тековно истражувачко ниво')+': '+s.research.level],
  destination:'research',action:t('Open Research','Отвори Истражување')};
}
function close(){
 if(dialog){try{dialog.close?.();}catch(_){}dialog.remove();}
 dialog=null;world=null;ctx=null;
}
function open(s,key,callbacks){
 const d=describe(s,key);
 if(!d){callbacks?.toast?.('Resource information unavailable.');return false;}
 close();world=s;ctx=callbacks||{};
 dialog=document.createElement('dialog');dialog.className='action-refill-modal resource-hud-modal';
 dialog.setAttribute('aria-label','Game resource details');
 const row=d.facts.filter(Boolean).map(v=>'<li>'+esc(v)+'</li>').join('');
 dialog.innerHTML='<section class="resource-hud-details">'+
  '<header class="action-refill-head"><h2>'+esc(d.icon+' '+d.title)+'</h2><button data-resource-close aria-label="Close">×</button></header>'+
  '<p class="resource-hud-value">'+fmt(d.value)+' <span>'+esc(d.unit||'')+'</span></p>'+
  '<p>'+esc(d.summary)+'</p><ul>'+row+'</ul>'+
  '<footer><button type="button" data-resource-close>'+t('Close','Затвори')+'</button>'+
  '<button type="button" class="primary" data-resource-destination="'+esc(d.destination)+'">'+esc(d.action)+'</button></footer>'+
  '</section>';
 dialog.addEventListener('click',event=>{
  event.stopPropagation();
  if(event.target===dialog||event.target.closest('[data-resource-close]')){close();return;}
  const go=event.target.closest('[data-resource-destination]');
  if(go){const dest=go.dataset.resourceDestination,fn=ctx?.chooseTab;close();fn?.(dest);}
 });
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 document.body.appendChild(dialog);
 if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
 dialog.querySelector('[data-resource-close]')?.focus();
 return true;
}
return {describe,open,close,keys:[...KEYS]};
});
