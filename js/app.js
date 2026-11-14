/* TRIALUM 1.4.1: working navigation, debug days and resource HUD */
(()=>{'use strict';
const E=TrialumEngine,S=TrialumStorage,A=TrialumAudio,W=TrialumWorld,P=globalThis.TrialumPeer,X=globalThis.TrialumExpansion,G=globalThis.TrialumPlayGames,M=globalThis.TrialumMind,O=globalThis.TrialumOnboarding,Theme=globalThis.TrialumTheme,Social=globalThis.TrialumSocial,PG=globalThis.TrialumPlayground,Shared=globalThis.TrialumShared,Messages=globalThis.TrialumMessages,Presence=globalThis.TrialumPresence,el=id=>document.getElementById(id);
let s=null,tab='lab',toastTimer,saveTimer,alertsSeen=new Set(),saving=false,restoring=false,peerOutgoing='',peerIncoming='',peerMode='internet';
// Scroll-intent state belongs to the home scene only, not other screens.
let compact=false,scrollIntent=0,gesturePixels=0,lastFingerY=null;
 let lastBackupFeedback=null,lastAutoRescueAt=0,rescueWarningShown=false;
 function rescueSnapshot(pinned=false){
  if(!s||!globalThis.TrialumAndroid?.saveSafetySnapshot)return true;
  const now=Date.now();
  if(!pinned&&now-lastAutoRescueAt<120000)return true;
  try{
   const payload=JSON.stringify({backupFormat:'trialum',exportedAt:new Date(now).toISOString(),...s});
   const ok=globalThis.TrialumAndroid.saveSafetySnapshot(payload,Boolean(pinned))===true;
   if(ok){lastAutoRescueAt=now;rescueWarningShown=false;}
   else if(!rescueWarningShown){rescueWarningShown=true;toast('⚠ Не може да се направи внатрешна спасувачка копија. Провери слободен простор.');}
   return ok;
  }catch(_){
   if(!rescueWarningShown){rescueWarningShown=true;toast('⚠ Автоматската спасувачка копија не успеа.');}
   return false;
  }
 }
 const en=()=>globalThis.TrialumI18n?.language?.()==='en';
 function restoreError(error){
  if(en()){
   if(error?.code==='INVALID_JSON'||error instanceof SyntaxError)return 'The selected file does not contain valid JSON.';
   if(error?.code==='BACKUP_TOO_LARGE')return 'The backup contains too many entries.';
   if(error?.code==='UNSUPPORTED_BACKUP')return 'This file is not a compatible TRIALUM backup.';
   return error?.message||'Could not restore this backup.';
  }
  return error?.message||'Невалиден бекап.';
 }

 function backupFeedback(message,ok=false){
  lastBackupFeedback={message,ok};
  const node=el('backupFeedback');if(node){node.textContent=(ok?'✓ ':'⚠ ')+message;node.style.color=ok?'#91f7d8':'#ffc2b5';}
  toast(message);
 }

const safe=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const nf=n=>Math.floor(Number(n)||0).toLocaleString('mk-MK');
const short=(v)=>Math.round(Number(v)||0);
function toast(msg){const box=el('toast');box.textContent=globalThis.TrialumI18n?.t(msg)||msg;box.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('show'),3300);}
function notice(result,sound='tap'){if(!result)return;if(result.ok){A.sfx(sound);scheduleSave();render();}else A.sfx('error');toast(result.message);}
function scheduleSave(){if(!s||restoring)return;if(el('saveStatus'))el('saveStatus').textContent='● Зачувување…';clearTimeout(saveTimer);saveTimer=setTimeout(forceSave,150);}
async function forceSave(){if(!s||restoring)return;saving=true;const result=await S.save(s);saving=false;if(el('saveStatus'))el('saveStatus').textContent=result.ok?'● Зачувано · '+result.backend:'⚠ Извези JSON бекап';if(el('saveStatus'))el('saveStatus').style.color=result.ok?'#79efcf':'#ff9eae';sendNative();if(result.ok){rescueSnapshot(false);G?.afterLocalSave(s);}}
function sendNative(){if(!s)return;try{if(globalThis.TrialumAndroid&&typeof globalThis.TrialumAndroid.updateState==='function'){globalThis.TrialumAndroid.updateState(JSON.stringify({version:E.VERSION,day:s.lastDay,updatedAt:Date.now(),alerts:E.alerts(s),pets:s.pets.map(p=>({id:p.id,name:p.name,satiety:p.satiety,joy:p.joy,clean:p.clean,habitatId:p.habitatId})),habitats:s.habitats.map(h=>({id:h.id,name:h.name,quality:E.envScore(h)}))}));}}catch(_){}}
// LW-B: show the full home biome only in Lab (initial home) and Habitats.
 // All other tabs own their screens; the home animation must not run behind them.
 function syncHomeScene(){
  const home=tab==='lab'||tab==='habitats';
  const panel=document.querySelector('.world');
  if(panel){
   // A swipe in a different screen must never collapse the aquarium later.
   const wasHidden=panel.hidden;
   panel.hidden=!home;
   if(wasHidden!==panel.hidden){
    compact=false;scrollIntent=0;gesturePixels=0;lastFingerY=null;
    panel.classList.remove('scene-compact');
   }
  }
  W.setSceneVisible?.(home);
 }
function chooseTab(which){globalThis.TrialumPlaygroundAI?.setTab?.(which);if(which!=='playground')PG?.stop();if(which!=='shared')Shared?.deactivate();if(which!=='messages')Messages?.deactivate();tab=which;if(which==='messages')Messages?.activate();if(which==='shared')Shared?.activate();document.querySelector('.shell')?.setAttribute('data-active-tab',which);const primary=['lab','habitats','pets','research','more'];document.querySelectorAll('[data-tab]').forEach(n=>{
  const target=n.dataset.tab,active=target===which||(target==='more'&&!primary.includes(which));
  n.classList.toggle('active',active);
  if(n.closest('#tabs')){
   if(active)n.setAttribute('aria-current','page');
   else n.removeAttribute('aria-current');
  }
 });syncHomeScene();renderTab();}
const btn=(txt,action,extra='',attr='',disabled=false)=>`<button ${extra} data-do="${action}" ${attr} ${disabled?'disabled':''}>${txt}</button>`;
const fill=(v,color)=>`<div class="progress"><div style="width:${E.clamp(v,0,100)}%;${color?'background:'+color:''}"></div></div>`;
const meter=(title,value)=>`<div class="meter"><span>${title}</span>${fill(value)}<strong>${Math.round(value)}%</strong></div>`;
function goalText(){const stage=s.stage,goals=[];let hint='';if(stage===0){hint='Започни од неживи атоми: синтетизирај молекули и анализирај ги реакциите.';goals.push(['Молекули',s.compounds>=4,`${s.compounds} / 4`]);}
 else if(stage===1){hint='Овозможи да се организираат молекулите во прва протоклетка.';goals.push(['Молекули',s.compounds>=9,`${s.compounds} / 9`]);}
 else if(stage<5){hint='Размножувај клетки, собирај сознание и активирај ја наредната еволутивна фаза.';const target=E.PHASE_REQ[stage].cells||4;goals.push(['Клетки',s.cells>=target,`${nf(s.cells)} / ${target}`]);}
 else if(stage===5){hint='Заврши ја повеќеклеточната организација. Потоа изгради прво вистинско живеалиште.';goals.push(['Клеточна популација',s.cells>=40,nf(s.cells)]);}
 else if(stage===6){hint='Гради живеалишта од атоми, одржувај микро- и макроелементи, создавај флора и миленици.';goals.push(['Изградени живеалишта',s.habitats.length>0,String(s.habitats.length)]);goals.push(['Најмалку две миленици',s.pets.length>=2,`${s.pets.length} / 2`]);}
 else{hint='Негувај самостојни биосветови. Преселувај миленици кога ќе пораснат и одгледувај свои растенија.';goals.push(['Повеќе различни видови',new Set(s.pets.map(p=>p.species)).size>=3,`${new Set(s.pets.map(p=>p.species)).size} / 3`]);goals.push(['60 дена живот',s.lastDay>=60,`${s.lastDay} / 60`]);}
 const r=E.PHASE_REQ[s.stage];if(r){goals.push(['Време до нова фаза',s.lastDay>=r.day,`${s.lastDay} / ${r.day} дена`]);goals.push(['Научни сознанија',s.insight>=r.insight,`${s.insight} / ${r.insight}`]);goals.push(['Органски молекули',s.compounds>=r.compounds,`${s.compounds} / ${r.compounds}`]);}
 return {hint,goals};}
function labTab(){const req=E.PHASE_REQ[s.stage],canEvolution=s.stage<7;
 const needed=req?`Ден ≥ ${req.day} · сознание ${req.insight} · молекули ${req.compounds}${req.cells?' · клетки '+req.cells:''}${req.pets?' · миленици '+req.pets:''}`:'Сите еволутивни етапи се отворени.';
 return `<div class="tab-main"><h2>⚗️ Виртуелна хемиска лабораторија</h2><p class="desc">Молекуларната синтеза, клетките и биосветовите користат намерно измислени правила. Лабораториски акции: <b>${s.labActions}/${E.labActionLimit(s)}</b> денес.</p>
 <div class="cards">
 <div class="card"><h3>⚛️ Синтетизирај молекули</h3><p>Создава 8 молекуларни единици од C, H, O, N и P.</p><div class="price">+8 молекули · +2 сознание · 1 акција</div>${btn('Синтетизирај','lab','class="primary"','data-kind="synthesize"',s.labActions<1)}</div>
 <div class="card"><h3>🔬 Научно набљудување</h3><p>Истражувај како се поврзуваат структурите.</p><div class="price">+7 сознание · 1 акција</div>${btn('Истражувај','lab','','data-kind="analyze"',s.labActions<1)}</div>
 <div class="card"><h3>🪨 Геолошка експедиција</h3><p>Собира нови резерви за клетките и сите живеалишта.</p><div class="price">14 елементи · 1 акција</div>${btn('Собери елементи','lab','','data-kind="harvest"',s.labActions<1)}</div>
 <div class="card"><h3>🧫 Поттикни клеточен раст</h3><p>Од молекуларни компоненти создај дополнителни клетки.</p><div class="price">5 молекули · 1 акција</div>${btn('Размножи клетки','lab','','data-kind="grow"',s.stage<2||s.labActions<1)}</div>
 </div>
 <div class="notice"><b>Следна еволутивна фаза:</b> ${canEvolution?E.PHASES[s.stage+1]:'Зрел екосистем'}<br><span class="subtle">${needed}</span><div style="margin-top:8px">${btn(canEvolution?'✨ Активирај еволуција':'✓ Зрел екосистем','evolve','class="primary"','',!canEvolution)}</div></div>
 <h3>Резерви од хемиски елементи</h3><div class="element-grid">${E.ELEMENTS.map(k=>`<div class="element"><b>${k}</b><span>${nf(s.elements[k])}</span></div>`).join('')}</div>
 <h3 style="margin-top:18px">✨ Создавање фантастични суштества</h3><p class="desc">Секое суштество чини 22 биомаса и 8 молекули. За него мора да имаш слободно место во избраниот биосвет.</p>
 <div class="cards">${E.SPECIES.map((sp,i)=>`<div class="card"><div class="mini-row"><h3>${sp.icon} ${sp.name}</h3><span class="pill">Товар ${sp.weight}</span></div><p>Неисториски животински вид · ${['медузеста','кристална','облачеста','лисната'][i]} морфологија.</p>${btn('Создај '+sp.name,'createPet','','data-species="'+i+'"',s.stage<6||!E.currentHabitat(s))}</div>`).join('')}</div>
 </div>`;}
function petsTab(){const ps=s.pets;return `<div class="tab-main"><h2>🐾 Твои оригинални миленици</h2><p class="desc">Секое животно има <b>сопствени акции и растечки лимити</b>. Акциите на едно не ги трошат акциите на останатите.</p>${ps.length?`<div class="pet-list">${ps.map(p=>{const sp=E.SPECIES[p.species],h=s.habitats.find(x=>x.id===p.habitatId);return `<button data-do="selectPet" data-id="${p.id}" class="pet-option ${s.selectedPet===p.id?'active':''}"><span class="emoji">${sp.icon}</span><span><b>${safe(p.name)}</b><small>${sp.name} · ${h?safe(h.name):'Без дом'} · ниво ${E.evolutionProgress(p).level} · ${p.actionsLeft}/${E.petActionLimit(s)} акции · биотовар ${E.loadOf(p)}</small></span></button>`}).join('')}</div>`:`<div class="notice">Миленичињата стануваат достапни откако ќе создадеш сложен организам и ќе изградиш живеалиште.</div>`}
 ${ps.length?`<h3>Преселба и именување</h3><p class="desc">Избери миленик од списокот или директно во аквариумот.</p>${btn('✏️ Преименувај избрано','renamePet')}<p class="desc">Префрли во друго завршено живеалиште, само ако има слободен биокапацитет:</p><div class="btn-line">${s.habitats.map(h=>`<button data-do="transfer" data-id="${h.id}">🚚 ${safe(h.name)} (${E.occupancy(s,h.id)}/${h.capacity})</button>`).join('')}</div>`:''}</div>`;}
function habitatsTab(){const h=E.currentHabitat(s),b=s.construction;return `<div class="tab-main"><h2>🏝 Биосветови и биохемија</h2><p class="desc">Секое живеалиште има сопствено pH, кислород, температура, микро/макроелементи и ограничен капацитет. Милениците зафаќаат повеќе простор како растат.</p>
 ${s.habitats.length?`<div class="cards">${s.habitats.map(a=>`<div class="card ${a.id===s.activeHabitat?'activated':''}"><div class="mini-row"><h3>${safe(a.name)}</h3><span class="pill">${E.occupancy(s,a.id)}/${a.capacity}</span></div><p>${E.BIOMES.find(b=>b.id===a.biome)?.name} · квалитет ${E.envScore(a)}% · ${a.flora.length} растенија</p>${fill(E.envScore(a))}${btn('Избери биосвет','selectHabitat','','data-id="'+a.id+'"')}</div>`).join('')}</div>`:''}
 ${h?`<div class="hab-card"><h3>${safe(h.name)} · секојдневна хемиска грижа</h3><div class="area-stats"><div><strong>${h.dayActions}/${E.HAB_ACTIONS}</strong><span>Акции</span></div><div><strong>${E.envScore(h)}%</strong><span>Квалитет</span></div><div><strong>${E.occupancy(s,h.id)}/${h.capacity}</strong><span>Биотовар</span></div></div>
 <div class="cards"><div class="card"><div class="hab-meter">pH <strong>${h.chem.ph}</strong></div>${meter('Кислород',h.chem.oxygen)}${meter('Чистота',h.cleanliness)}${meter('Токсини',h.chem.toxins)}<div class="small subtle">Температура ${h.chem.temp}° (симулирана)</div></div><div class="card">${meter('Макро',h.minerals.macro)}${meter('Микро',h.minerals.micro)}<p>Макро: Ca / Mg / K · Микро: Fe / Zn / Cu</p><p>Снабдувањето се троши дневно.</p></div></div>
 <div class="cards">${[['macro','🧂 Додај макроелементи','Ca · Mg · K'],['micro','🔹 Додај микроелементи','Fe · Zn · Cu'],['oxygen','💨 Оксигенирај','O · H'],['balance','🌡 Балансирај pH / температура','Na · Ca'],['clean','🫧 Исчисти биосвет','намали токсини']].map(([id,title,price])=>`<div class="card"><h3>${title}</h3><p>${price}</p>${btn('Примени','habCare','','data-kind="'+id+'"',h.dayActions<1)}</div>`).join('')}</div></div>`:''}
 <h3 style="margin-top:20px">🏗️ Изгради ново живеалиште — од нула</h3><p class="desc">Пет последователни чекори со посебни материјали, најмногу еден дневно. Не можеш да создадеш живеалиште со еден клик.</p>
 ${b?`<div class="progress-build"><b>Изградба ${b.step}/5</b>${fill(b.step*20)}<p class="small">${E.BUILD_TASKS[b.step]?.name||'Завршено'} · ${E.BUILD_TASKS[b.step]?.label||''}</p>${btn('🔨 Следен градежен чекор','buildStep','class="primary"','',b.lastStepDay===s.lastDay)}</div>`:
 `<div class="cards">${E.BIOMES.map(b=>`<div class="card"><h3>🏝 ${b.name}</h3><p>Капацитет ${b.capacity} биотоварни единици. Секој биосвет има независна биохемија.</p>${btn('Започни изградба','startBuild','','data-biome="'+b.id+'"',s.stage<6)}</div>`).join('')}</div>`}
 </div>`;}
function plantsTab(){const h=E.currentHabitat(s);return `<div class="tab-main"><h2>🌿 Ботаничка лабораторија</h2><p class="desc">Растенијата не се готови декорации. Прво треба да го откриеш секој модел, па да го создадеш во посебно живеалиште од C, N, P и O.</p>
 <div class="cards">${E.PLANTS.map(f=>{const known=s.blueprints.includes(f.id);return `<div class="card ${known?'activated':''}"><h3>${f.icon} ${f.name}</h3><p>${f.kind}</p><p>Придонес за кислород: +${f.oxygen} / ден на зрел раст.</p><span class="pill">${known?'✓ Создаден растителен модел':'🔒 Неоткриен модел'}</span>${known?btn('Засади во избраниот биосвет','plant','','data-plant="'+f.id+'"',!h||h.dayActions<1):btn('Измисли растителен вид','inventPlant','','data-plant="'+f.id+'"',s.stage<5)}</div>`}).join('')}</div>
 ${h?`<h3>Растенија во ${safe(h.name)}</h3><div class="cards">${h.flora.map(f=>{const species=E.PLANTS.find(p=>p.id===f.species);return `<div class="card"><h3>${species?.icon||'🌱'} ${species?.name||'Примитивна флора'}</h3>${meter('Раст',f.growth)}</div>`}).join('')||'<div class="notice">Нема растенија во овој биосвет.</div>'}</div>`:''}</div>`;}
function diaryTab(){
 const list=[...s.logs].reverse().slice(0,400);
 const types=[['all','Сите настани'],['milestone','Еволуција и успеси'],['care','Грижа'],['habitat','Живеалишта'],['research','Истражување'],['debug','Дебагирање']];
 return '<div class="tab-main"><h2>📖 Хронолошки дневник</h2><p class="desc">Ова е единственото место со целата хронологија. Прикажани се последните '+list.length+' од '+nf(s.logs.length)+' зачувани настани. Целосната архива е во JSON бекапот.</p>'+
 '<div class="diary-controls"><input id="diarySearch" type="search" placeholder="Пребарај настани…" aria-label="Пребарај дневник">'+
 '<select id="diaryFilter" aria-label="Филтрирај по вид">'+types.map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('')+'</select></div>'+
 '<div class="log-list" id="diaryList">'+(list.length?list.map(e=>'<div class="log-entry" data-kind="'+safe(e.kind||'info')+'" data-search="'+safe(String(e.text||'').toLowerCase())+'"><time>Ден '+(Number(e.day)||1)+'</time><p>'+safe(e.text||'')+'</p></div>').join(''):'<p>Уште нема настани. Започни со синтеза на молекули.</p>')+'</div>'+
 '<p id="diaryEmpty" class="subtle" hidden>Нема резултати за избраниот филтер.</p></div>';
}
function filterDiary(){
 const needle=(el('diarySearch')?.value||'').toLocaleLowerCase('mk-MK').trim(),kind=el('diaryFilter')?.value||'all';let visible=0;
 document.querySelectorAll('#diaryList .log-entry').forEach(row=>{const ok=(kind==='all'||row.dataset.kind===kind||kind==='milestone'&&['milestone','evolution'].includes(row.dataset.kind))&&row.dataset.search.includes(needle);row.hidden=!ok;if(ok)visible++;});
 if(el('diaryEmpty'))el('diaryEmpty').hidden=visible>0;
}
function friendsTab(){const guest=P?.remote(),connected=P?.connected(),ps=s.friends||[],p=E.currentPet(s);
 const oldP2P='<div class="tab-main"><h2>🤝 Стар директен P2P режим</h2>'+
 '<p class="desc">Без регистрација, без наши сервери, реклами или плаќање. Двата телефона мора да имаат отворена апликација. Понекогаш NAT/firewall спречува поврзување без TURN relay.</p>'+
 '<div class="notice"><b>Состојба: '+safe(P?.status()||'Неподдржано')+'</b><br>'+ (guest?'👋 '+safe(guest.name)+' · '+safe(guest.pet.name)+' (ниво '+guest.pet.level+')':'Нема активен гостин.')+'</div>'+
 '<div class="cards"><div class="card"><h3>1 · Испрати покана</h3><p>На твојот телефон притисни „Создај покана“ и испрати го кодот преку порака.</p>'+btn('🪄 Создај покана','p2pOffer','class="primary"')+'</div>'+
 '<div class="card"><h3>2 · Одговори на покана</h3><p>Пријателот го внесува кодот и притиска „Прифати“. Одговорот го праќа назад.</p>'+btn('🧩 Прифати покана','p2pAnswer')+'</div></div>'+
 '<div class="settingrow"><label for="peerMode">Мрежа</label><select id="peerMode"><option value="internet"'+(peerMode==='internet'?' selected':'')+'>Интернет · бесплатен јавен STUN</option><option value="local"'+(peerMode==='local'?' selected':'')+'>Иста Wi-Fi мрежа · без STUN</option></select></div>'+
 '<label class="small" for="peerCodeIn">Примена покана или одговор од пријател</label><textarea class="signal-box" id="peerCodeIn" placeholder="Залепи го добиениот код тука…" spellcheck="false">'+safe(peerIncoming)+'</textarea>'+
 '<div class="btn-line">'+btn('✅ Заврши поврзување','p2pFinish')+btn('✖ Прекини','p2pDisconnect')+'</div>'+
 '<label class="small" for="peerCodeOut">Код што го испраќаш на пријателот</label><textarea class="signal-box" id="peerCodeOut" readonly placeholder="Тука ќе се создаде твојата покана или одговор…">'+safe(peerOutgoing)+'</textarea>'+
 '<div class="btn-line">'+btn('📋 Копирај код','p2pCopy','', '',!peerOutgoing)+btn('📤 Испрати код','p2pShare','', '',!peerOutgoing)+'</div>'+
 '<h3>🐾 Дружба на милениците</h3><p class="desc">Допрете ги милениците во аквариумот; кога сте поврзани, можете да си испратите поздрав. Најмногу едно наградено дружење дневно по пријател и миленик.</p>'+
 '<div class="btn-line">'+btn('💫 Испрати милениче на дружба','p2pVisit','class="primary"','',!connected||!p||!guest)+btn('⭐ Додај во пријатели','p2pAddFriend','','',!connected||!guest)+btn('✏️ Мое P2P име','p2pRename')+'</div>'+
 '<p class="small subtle">Мој профил: '+safe(s.profileName||'Чувар на искра')+' · Не испраќаме лични податоци или целата зачувана игра. Кодот за покана не е лозинка; испраќај го само на лица на кои им веруваш. Дружбата нема проверен идентитет.</p>'+
 '<h3>Мои пријатели ('+ps.length+')</h3>'+(ps.length?ps.map(f=>'<div class="friend-item">💠 '+safe(f.name)+' <span class="small subtle">· последно поврзување '+new Date(f.lastSeen).toLocaleDateString('mk-MK')+'</span></div>').join(''):'<p class="subtle">Сѐ уште немаш зачувани пријатели. Поврзи се и допри „Додај“.</p>')+'</div>';
 return (Social?.render()||'')+'<details class="card"><summary>Напредно: стар рачен P2P режим (непотврден идентитет)</summary><p class="small subtle">Овој режим е само за тестирање; не го користи за приватни информации или заработка на награди.</p>'+oldP2P+'</details>';
}
function renderTab(){
 if(!s)return;
 // Care UI has only one owner: the Pets screen. Move it out before repainting.
 const panel=el('selectedPanel'),aside=document.querySelector('aside.right-col');
 if(panel&&aside&&panel.parentElement!==aside)aside.appendChild(panel);
 try{
  const newer=X?.render(tab,s);
  if(newer!==null&&newer!==undefined)el('tabContent').innerHTML=newer;
  else el('tabContent').innerHTML=tab==='lab'?labTab():tab==='pets'?petsTab():tab==='habitats'?habitatsTab():tab==='plants'?plantsTab():tab==='friends'?friendsTab():diaryTab();
 }catch(error){
  console.error('Trialum tab:',tab,error);
  el('tabContent').innerHTML='<div class="tab-main"><h2>⚠️ Проблем со мени</h2><p>Грешката е пријавена во конзолата. Другите менија остануваат достапни.</p><button data-tab="more">‹ Назад кон мени</button></div>';
 }
 if(tab==='settings'&&lastBackupFeedback){const feedback=el('backupFeedback');if(feedback){feedback.textContent=(lastBackupFeedback.ok?'✓ ':'⚠ ')+lastBackupFeedback.message;feedback.style.color=lastBackupFeedback.ok?'#91f7d8':'#ffc2b5';}}
 const mount=el('selectedPetMount');
 if(tab==='pets'&&mount&&panel)mount.appendChild(panel);
 globalThis.TrialumI18n?.translateDOM?.(el('tabContent'));
 if(tab==='playground')PG?.mount(s,{onSelect:id=>{const r=PG.replay(s,id);if(r.ok)toast(r.message);},onNotice:toast,onRender:renderTab});
 if(tab==='shared')globalThis.TrialumSharedScene?.mount?.();
}
function render(){if(!s)return;Presence?.ensure(s);E.ensureResearch(s);W.setState(s);
 el('dayPill').textContent='📅 Ден '+s.lastDay;if(el('modePill'))el('modePill').textContent='🕰 Долгорочна еволуција';
  const xp=s.pets.reduce((sum,p)=>sum+(Number(p.evolution?.earned)||0),0);if(el('hudXP'))el('hudXP').textContent=nf(xp);if(el('hudTokens'))el('hudTokens').textContent=nf(s.longplay?.credits);if(el('hudMolecules'))el('hudMolecules').textContent=nf(s.compounds);if(el('hudBiomass'))el('hudBiomass').textContent=nf(s.biomass);if(el('hudInsight'))el('hudInsight').textContent=nf(s.insight);if(el('nextDay'))el('nextDay').hidden=true;el('cellsStat').textContent=nf(s.cells);el('molsStat').textContent=nf(s.compounds);el('insightStat').textContent=nf(s.insight);el('biomassStat').textContent=nf(s.biomass);el('phaseFill').style.width=((s.stage+1)/E.PHASES.length*100)+'%';el('phaseCaption').textContent=`Фаза ${s.stage+1}/8 · ${E.PHASES[s.stage]}`;el('sceneStage').textContent=E.PHASES[s.stage].toUpperCase();
 const current=E.currentHabitat(s);el('sceneBottom').textContent=current?`Биосвет ${E.envScore(current)}% квалитет · ${E.occupancy(s,current.id)}/${current.capacity} капацитет`:`Од неживи елементи кон ${E.PHASES[Math.min(7,s.stage+1)].toLowerCase()}`;
 const switcher=el('habitatSwitch');switcher.innerHTML=s.habitats.length?s.habitats.map(h=>`<option value="${h.id}" ${h.id===s.activeHabitat?'selected':''}>${safe(h.name)}</option>`).join(''):'<option value="">Нема живеалишта</option>';switcher.disabled=!s.habitats.length;
 const g=goalText();el('guideText').textContent=g.hint;el('goals').innerHTML=g.goals.map(([name,done,note])=>`<div class="goal ${done?'done':''}"><span class="dot">${done?'✓':'○'}</span><span>${safe(name)}</span><span class="small subtle" style="margin-left:auto">${safe(note)}</span></div>`).join('');
 if(el('soundBtn'))el('soundBtn').textContent=s.settings.sound?'🔊 Звук: вклучен':'🔇 Звук: исклучен';if(el('musicBtn'))el('musicBtn').textContent=s.settings.music?'♫ Музика: вклучена':'♫ Музика: исклучена';if(el('volume'))el('volume').value=Math.round(s.settings.volume*100);
 const p=E.currentPet(s);if(p){const sp=E.SPECIES[p.species],h=s.habitats.find(x=>x.id===p.habitatId);
 const where=Presence?.get(s,p.id),away=where?.kind!==Presence?.HOME;
 const whereText=p.pendingRemoteReturn?.sessionId===where?.sessionId&&where?.kind===Presence?.SHARED?
   '⏳ Привремено прикажано дома · се чека серверска потврда':
   away?(where?.status==='pending'?'⏳ Се потврдува заминувањето':where?.kind===Presence?.LOCAL?'🎠 Во локалната игротека':where?.kind===Presence?.SHARED?'🌳 Во заедничката игротека':'🤝 На посета'):'🏠 Дома';el('careBadge').textContent=`${p.actionsLeft}/${E.petActionLimit(s)} акции`;el('petDetails').innerHTML=`<div class="pet-head"><div class="pet-avatar">${sp.icon}</div><div><h3>${safe(p.name)}</h3><p>${sp.name} · ${safe(h?.name||'')} · ${p.ageDays} дена · раст ${Math.round(p.growth)}%</p><p>🗣 <i>${safe(p.language)}…</i> · ${safe(p.mood)}</p><p>📍 ${whereText}</p></div></div>
 <div class="evo-panel"><div class="mini-row"><b>🧬 ${safe(E.evolutionProgress(p).epoch)} · Ниво ${E.evolutionProgress(p).level}</b><span class="pill">🧠 ${E.evolutionProgress(p).trained} учења</span></div>
 <p class="small subtle">${safe(E.evolutionProgress(p).description)} · ${E.evolutionProgress(p).limbs} екстремитети · ${E.evolutionProgress(p).feelers} сензори</p>
 ${fill(100*E.evolutionProgress(p).xp/E.evolutionProgress(p).next)}<p class="small subtle">XP ${E.evolutionProgress(p).xp}/${E.evolutionProgress(p).next} · наредно ниво најрано на возраст ${E.evolutionProgress(p).ageGate} дена · самостојно: ${safe(E.evolutionProgress(p).intent)}</p></div>
 ${meter('Ситост',p.satiety)}${meter('Радост',p.joy)}${meter('Енергија',p.energy)}${meter('Чистота',p.clean)}${meter('Блискост',p.bond)}<div class="btn-grid">${[['feed','🍽 Нахрани'],['play','🎾 Играј'],['wash','🫧 Измиј'],['rest','🌙 Одмори'],['talk','🗣 Разговарај']].map(([kind,title])=>btn(title,'petCare','','data-kind="'+kind+'"',(p.actionsLeft===0||away))).join('')}</div><button class="smallbtn" data-do="renamePet">✏️ Именувај</button>`;
 }else{el('careBadge').textContent='0/4 акции';el('petDetails').innerHTML='<p class="subtle">Нема избрано суштество во овој биосвет. Создај прво милениче во лабораторијата.</p>'}
 const msgs=E.alerts(s);if(el('alertsCount'))el('alertsCount').textContent=msgs.length;if(el('alerts'))el('alerts').innerHTML=msgs.length?msgs.slice(0,7).map(a=>`<div class="alert ${a.level==='high'?'high':''}">⚠ ${safe(a.text)}</div>`).join(''):'<div class="allgood">✓ Во моментов нема критични потреби.</div>';
 renderTab();globalThis.TrialumI18n?.translateDOM?.(document.querySelector('.shell'));}
function selectHabitat(id){const h=s.habitats.find(x=>x.id===id);if(!h)return;s.activeHabitat=h.id;if(!s.pets.some(p=>p.id===s.selectedPet&&p.habitatId===h.id))s.selectedPet=s.pets.find(p=>p.habitatId===h.id)?.id||null;A.sfx('select');render();scheduleSave();}
function exportBackup(){
 const contents=JSON.stringify({backupFormat:'trialum',exportedAt:new Date().toISOString(),...s},null,2);
 const base='TRIALUM_v'+(E.VERSION||'1.5.1')+'_day_'+s.lastDay;
 if(globalThis.TrialumAndroid?.saveBackup){
  globalThis.TrialumAndroid.saveBackup(contents,base+'.json');
  toast('Се зачувува нов проверен бекап. Резултатот ќе се прикаже по проверката.');
  return;
 }
 const blob=new Blob([contents],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;
 a.download=base+'_'+new Date().toISOString().replace(/[:.]/g,'-')+'_'+Math.random().toString(36).slice(2,10)+'.json';
 a.click();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
 toast('Преземањето е побарано. Провери ја датотеката пред да го избришеш светот.');
}
function activeSignals(){if(!s?.settings.alerts)return;const msgs=E.alerts(s),active=new Set(msgs.map(x=>x.type+'|'+(x.petId||x.habitatId)));
 for(const a of msgs){const id=a.type+'|'+(a.petId||a.habitatId);if(alertsSeen.has(id))continue;alertsSeen.add(id);if('Notification' in window&&Notification.permission==='granted'&&document.visibilityState==='visible'){try{new Notification('ТРИАЛУМ · Потребна грижа',{body:a.text,tag:id,icon:'assets/icon.svg'})}catch(_){}}}
 alertsSeen=new Set([...alertsSeen].filter(x=>active.has(x)));}
function doAction(button){if(restoring)return;const action=button.dataset.do,kind=button.dataset.kind;
 if(action==='onboardingIntro'){O?.open('intro');return;}
 if(action==='onboardingTutorial'){O?.open('tutorial');return;}
 if(action==='pgsOpen'){chooseTab('playgames');return;}if(G?.action(action,button))return;if(!s)return;
 if(action==='pgAiToggle'){globalThis.TrialumPlaygroundAI?.toggle?.(s,button.dataset.scope,toast,scheduleSave,render);return;}
 if(action==='pgAiBackgroundToggle'){globalThis.TrialumPlaygroundAI?.toggleBackground?.(s,toast,scheduleSave,render);return;}
 if(action==='pgAiForget'){globalThis.TrialumPlaygroundAI?.forget?.(s,toast,scheduleSave,render);return;}
 let result=null,sound='tap';
 if(X?.can(action)){
  if(['debugToggle','debugDays','debugResources','debugPet'].includes(action)){
   // Locally modified test worlds can never rank on Google Play Games.
   s.settings.debugEverUsed=true;
  }
  X.handle(action,button,s,{notice,toast,scheduleSave,render});return;
 }
 switch(action){case 'setLanguage':{
   const next=globalThis.TrialumI18n?.languages?.includes(button.dataset.language)?button.dataset.language:'auto';s.settings.language=next;
   globalThis.TrialumI18n?.change(next).then(()=>{render();globalThis.TrialumI18n?.translateDOM?.(document.body);scheduleSave();toast(next==='en'?'Language changed to English.':'Јазикот е поставен на македонски.');});return;
  }
  case 'toggleSound':s.settings.sound=!s.settings.sound;if(!s.settings.sound)s.settings.music=false;A.sync(s.settings);if(s.settings.sound)A.sfx('select');scheduleSave();render();return;
 case 'toggleMusic':s.settings.music=!s.settings.music;if(s.settings.music)s.settings.sound=true;A.sync(s.settings);scheduleSave();render();return;

 case 'shRefresh':Shared?.refresh();return;
 case 'shSelect':Shared?.select(button.dataset.id);return;
 case 'shCreate':Shared?.create(el('sharedTitle')?.value||'',s).then(v=>{if(v)toast('🌳 Заедничкиот простор е создаден.');});return;
 case 'shInvite':{
  const id=el('sharedInviteFriend')?.value;
  if(id)Shared?.invite(id).then(v=>{if(v)toast('📩 Поканата е испратена.');});
  return;
 }
 case 'shDecision':Shared?.decision(button.dataset.id,button.dataset.accept==='yes').then(v=>{if(v)toast('Поканата е обработена.');});return;
 case 'shRemove':{
  if(confirm('Да го отстраниме членот или да ја напуштиме игротеката?'))Shared?.remove(button.dataset.id);
  return;
 }
 case 'shDelete':{
  if(confirm('Трајно да го избришеме овој заеднички простор и групните податоци?'))Shared?.drop();
  return;
 }
 case 'shUpgrade':Shared?.upgrade(button.dataset.kind,button.dataset.toy).then(v=>{if(v)toast('🌳 Надградбата е потврдена од серверот.');});return;
 case 'shEnter':Shared?.enterRoom(s).then(v=>{if(v){render();scheduleSave();toast('🐾 Миленичето е во заедничката игротека.');}});return;
 case 'shReturn':Shared?.leaveRoom(s).then(v=>{if(v?.ok)notice(v,'select');else if(v?.queued){render();scheduleSave();toast(v.message);}});return;
 case 'shPlay':Shared?.play(button.dataset.toy,s).then(v=>{if(v)toast(v.duplicate?'Активноста веќе е регистрирана.':'🐾 +1 групен поен');});return;
 case 'shVisit':{
  const target=el('sharedFriendToVisit')?.value,dest=el('sharedDestination')?.value;
  if(target&&dest)Shared?.sendVisit(target,dest,s).then(v=>{if(v)toast('Посетата е испратена на одобрување.');});
  return;
 }
 case 'shVisitDecision':Shared?.changeVisit(button.dataset.id,button.dataset.kind).then(v=>{if(v)toast('Посетата е обработена.');});return;
 case 'pgSend':notice(PG?.send(s),'select');return;
 case 'pgReturn':notice(PG?.returnPet(s),'select');return;
 case 'pgUnlock':notice(PG?.unlock(s,button.dataset.toy),'build');return;
 case 'pgExpand':notice(PG?.expand(s),'build');return;
 case 'pgPlay':notice(PG?.start(s,button.dataset.toy),'play');return;
 case 'pgAnswer':notice(PG?.answer(s,button.dataset.answer),'play');return;
 case 'pgTalk':notice(PG?.talk(s,button.dataset.topic),'select');return;
 case 'pgReplay':{const r=PG?.replay(s,button.dataset.toy);if(r)toast(r.message);return;}
 case 'msgRefresh':Messages?.refresh();return;
 case 'msgSend':{
  const receiverId=el('msgFriend')?.value||Messages?.getState().selected;
  Messages?.send(receiverId,button.dataset.preset).then(v=>{if(v)toast('Пораката е испратена.');});return;
 }
 case 'msgCustomSend':{
  const receiverId=el('msgFriend')?.value||Messages?.getState().selected;
  const text=el('msgCustom')?.value||'';
  Messages?.send(receiverId,null,text).then(v=>{if(v)toast('Пораката е испратена.');});return;
 }
 case 'msgRead':Messages?.mark(button.dataset.id).then(v=>{if(v)toast('Прочитано.');});return;
 case 'msgDelete':Messages?.remove(button.dataset.id).then(v=>{if(v)toast('Пораката е избришана за тебе.');});return;
 case 'msgReport':{
  if(confirm('Пријави ја пораката како спам?'))Messages?.report(button.dataset.id,'spam').then(v=>{if(v)toast('Пријавата е примена.');});
  return;
 }
 case 'msgEventRead':Messages?.mark(button.dataset.id,'event');return;
 case 'msgEventDelete':Messages?.remove(button.dataset.id,'event');return;
 case 'msgMute':{
  const id=button.dataset.id,mutes=Messages?.getState().mutes||[];
  Messages?.mute(id,!mutes.includes(id));return;
 }
 case 'msgPushOn':Messages?.pushToggle(true);return;
 case 'msgPushOff':Messages?.pushToggle(false);return;
 case 'msgPushTest':{
  const code=globalThis.TrialumAndroid?.pushTestLocalNotification?.();
  const msg={posted:'Android го прифати тестното известување. Провери го панелот со нотификации.',
   blocked:'Android го блокира каналот за пораки. Провери Settings → Apps → Trialum → Notifications → ТРИАЛУМ пријатели.',
   off:'Прво вклучи ги известувањата за пораки.',
   unavailable:'Firebase не е конфигуриран во оваа апликација.',
   error:'Android не успеа да го прикаже тестното известување.'};
  toast(msg[code]||'Тестот е достапен само во Android апликацијата.');return;
 }
 case 'socialRegister':{
  const nickname=el('socialNick')?.value.trim()||s.profileName||'Чувар на искра';
  Social?.register(nickname).then(v=>{if(v)toast('Профилот за пријатели е создаден.');});
  return;
 }
 case 'socialInvite':{
  Social?.invite().then(code=>{if(code){toast('Поканата е подготвена.');Social.share();}});
  return;
 }
 case 'socialShare':Social?.share();return;
 case 'socialNearbyHost':{
  if(!globalThis.TrialumAndroid?.nearbyHost)return toast('Nearby поврзувањето работи само во Android апликацијата.');
  Social?.invite().then(code=>{if(code){globalThis.TrialumAndroid.nearbyHost(code);toast('Потврди го истиот код на двата уреди.');}});
  return;
 }
 case 'socialNearbyScan':{
  if(!globalThis.TrialumAndroid?.nearbyScan)return toast('Nearby поврзувањето работи само во Android апликацијата.');
  globalThis.TrialumAndroid.nearbyScan();return;
 }
 case 'socialNearbyStop':globalThis.TrialumAndroid?.nearbyStop?.();return;
 case 'socialRevoke':Social?.revokeInvite().then(v=>{if(v)toast('Поканата е поништена.');});return;
 case 'socialCopy':{
  const link=Social?.inviteLink();
  if(!link)return;
  if(globalThis.TrialumAndroid?.copyText){globalThis.TrialumAndroid.copyText(link);toast('Линкот е копиран.');return;}
  navigator.clipboard?.writeText(link).then(()=>toast('Линкот е копиран.')).catch(()=>toast('Копирањето не успеа.'));
  return;
 }
 case 'socialPreview':{
  const code=el('socialCode')?.value||'';
  Social?.setPending(code);
  Social?.preview().then(v=>{if(v)toast('Провери го името пред прифаќање.');});
  return;
 }
 case 'socialAccept':Social?.accept().then(v=>{if(v)toast('Пријателството е потврдено!');});return;
 case 'socialDecline':Social?.clearPreview();return;
 case 'socialRefresh':Social?.refresh();return;
 case 'socialRemove':{
  if(confirm('Да го отстраниме овој пријател?'))Social?.remove(button.dataset.id).then(v=>{if(v)toast('Пријателот е отстранет.');});
  return;
 }
 case 'socialBlock':{
  if(confirm('Да го блокираме овој пријател? Нема да може да ти испрати покана.'))Social?.remove(button.dataset.id,true).then(v=>{if(v)toast('Пријателот е блокиран.');});
  return;
 }
 case 'socialDelete':{
  if(confirm('Трајно да го избришеме социјалниот профил и пријателствата? Локалната игра останува зачувана.'))Social?.deleteAccount().then(v=>{if(v)toast('Социјалниот профил е избришан.');});
  return;
 }
 case 'p2pOffer':{if(!P)return toast('WebRTC модулот не е достапен.');P.offer(peerMode==='local').then(code=>{peerOutgoing=code;renderTab();toast('Поканата е подготвена за копирање.');}).catch(e=>toast(e.message));return;}
 case 'p2pAnswer':{if(!P)return;peerIncoming=el('peerCodeIn')?.value||'';P.answer(peerIncoming,peerMode==='local').then(code=>{peerOutgoing=code;renderTab();toast('Испрати го одговорот на пријателот.');}).catch(e=>toast(e.message));return;}
 case 'p2pFinish':{peerIncoming=el('peerCodeIn')?.value||'';P?.finish(peerIncoming).then(()=>toast('Потврден код; се чека директно поврзување.')).catch(e=>toast(e.message));return;}
 case 'p2pCopy':{const t=el('peerCodeOut');if(!t||!peerOutgoing)return;if(globalThis.TrialumAndroid?.copyText){globalThis.TrialumAndroid.copyText(peerOutgoing);toast('Кодот е копиран.');return;}t.select();const promise=navigator.clipboard?.writeText(peerOutgoing);if(promise)promise.then(()=>toast('Кодот е копиран.')).catch(()=>toast('Означи и копирај го кодот рачно.'));else toast('Копирај го означениот код.');return;}
 case 'p2pDisconnect':P?.clear();peerIncoming='';peerOutgoing='';renderTab();return;
 case 'p2pShare':{if(!peerOutgoing)return toast('Прво создај покана или одговор.');if(globalThis.TrialumAndroid?.shareText){globalThis.TrialumAndroid.shareText(peerOutgoing);return;}if(navigator.share){navigator.share({title:'ТРИАЛУМ P2P',text:peerOutgoing}).catch(()=>{});return;}toast('Користи Копирај код.');return;}
 case 'p2pRename':{const value=prompt('Твоето P2P име (до 32 знаци):',s.profileName||'Чувар на искра');if(value===null)return;s.profileName=String(value).trim().slice(0,32)||'Чувар на искра';render();scheduleSave();return;}
 case 'p2pAddFriend':{const guest=P?.remote();if(!guest)return toast('Прво поврзи се со пријател.');if(E.addFriend(s,guest.id,guest.name)){render();scheduleSave();toast('Пријателот е зачуван на овој уред.');}return;}
 case 'p2pVisit':{const guest=P?.remote(),pet=E.currentPet(s);if(!P?.connected()||!pet||!guest)return toast('Избери миленик и поврзи се.');if(P.visit(pet.id)){result=E.socialize(s,pet.id,guest.id);sound='play';}else toast('Нема активна P2P врска.');break;}
 case 'nextDay':result=E.demoNext(s);sound='day';break;
 case 'lab':result=E.basicResearch(s,kind);sound='grow';break;
 case 'evolve':result=E.evolve(s);sound='grow';break;
 case 'startBuild':result=E.startBuilding(s,button.dataset.biome);sound='build';break;
 case 'buildStep':result=E.buildStep(s);sound='build';break;
 case 'createPet':result=E.createPet(s,Number(button.dataset.species));sound='grow';break;
 case 'petCare':result=E.petCare(s,s.selectedPet,kind);sound=kind==='wash'?'wash':kind==='play'?'play':kind==='feed'?'feed':'select';break;
 case 'selectPet':result=E.selectPet(s,button.dataset.id);sound='select';if(result.ok){const p=E.currentPet(s);A.speak(p)}break;
 case 'selectHabitat':selectHabitat(button.dataset.id);return;
 case 'habCare':result=E.habitatCare(s,kind);sound='wash';break;
 case 'inventPlant':result=E.inventPlant(s,button.dataset.plant);sound='grow';break;
 case 'plant':result=E.plant(s,button.dataset.plant);sound='grow';break;
 case 'transfer':result=E.transfer(s,s.selectedPet,button.dataset.id);sound='select';break;
 case 'renamePet':{const p=E.currentPet(s);if(!p)return toast('Прво одбери миленик.');const name=prompt('Ново име на миленикот (до 32 знаци):',p.name);if(name===null)return;result=E.rename(s,'pet',p.id,name);break;}
 case 'inspect':{const current=E.currentHabitat(s);toast(current?`${current.name}: квалитет ${E.envScore(current)}%, простор ${E.occupancy(s,current.id)}/${current.capacity}`:`Фаза ${s.stage+1}: ${E.PHASES[s.stage]}`);return;}
 case 'export':exportBackup();return;
 case 'rescueList':{
  if(globalThis.TrialumAndroid?.listRescueBackups)globalThis.TrialumAndroid.listRescueBackups();
  else toast('Спасувачката архива е достапна само во Android.');
  return;
 }
 case 'rescueRestore':{
  const id=String(button.dataset.id||'');
  if(!/^rescue_(keep_)?[0-9_]+_[a-f0-9]{8}_[a-f0-9]{16}\.json$/.test(id))return;
  globalThis.TrialumAndroid?.restoreRescueBackup?.(id);return;
 }
 case 'import':if(globalThis.TrialumAndroid?.chooseBackup){globalThis.TrialumAndroid.chooseBackup();toast(en()?'Choose the backup file to restore.':'Избери ја датотеката за враќање.');return;}el('importFile').click();return;
 case 'notification':{if(globalThis.TrialumAndroid?.requestNotifications){globalThis.TrialumAndroid.requestNotifications();toast('Провери ја Android дозволата за известувања.');return;}if(!('Notification' in window)){toast('Прелистувачот не поддржува известувања во HTML. Android верзијата ќе има системски сигнали.');return}if(!isSecureContext){toast('За системски нотификации отвори ја играта преку HTTPS или како Android апликација.');return}Notification.requestPermission().then(res=>toast(res==='granted'?'Дозволени се известувања додека играта е активна.':'Известувањата не се дозволени.'));return;}
 case 'newGame':{
  if(!confirm('Со нов свет го губиш тековниот напредок на уредот. Дали направи JSON бекап?'))return;
  if(!confirm('Последна потврда: навистина да започнеме од нула?'))return;
   if(!rescueSnapshot(true)){toast('Новиот свет е блокиран: не успеа спасувачката копија.');return;}
  clearTimeout(saveTimer);
  const prior=s;
  s=null; // Blocks all pending debounce callbacks from re-saving a deleted world.
  S.clear().then(result=>{
    if(!result?.ok){s=prior;render();toast('Не успеа бришењето на светот. Твојот напредок е зачуван.');return;}
    el('welcome').hidden=false;W.setState(null);toast('Локалниот свет е избришан.');
  }).catch(()=>{s=prior;render();toast('Не успеа бришењето. Твојот напредок е зачуван.');});
  return;
 }
 default:return;
 }
 notice(result,sound);if(result?.ok&&action==='petCare'&&(kind==='talk'||kind==='play'||kind==='feed'))A.speak(E.currentPet(s));if(result?.ok)activeSignals();}
async function importBackupState(backup){
 if(restoring)throw Error('Враќањето на бекап е веќе во тек.');
 if(!E.validate(backup))throw Error(en()?'This is not a compatible TRIALUM backup.':'Ова не е компатибилен ТРИАЛУМ бекап.');
 const message=en()?
  'Restore this backup? Your current local world will be replaced. Export a backup of your current progress first.':
  'Да го вратам овој бекап? Тековниот свет ќе биде заменет. Прво направи бекап на сегашниот напредок.';
 if(!confirm(message)){backupFeedback(en()?'Restore canceled. Your world was not changed.':'Враќањето е откажано. Тековниот свет не е изменет.',true);return false;}
 if(!rescueSnapshot(true))throw Error(en()?'Cannot protect the current world. Restore blocked.':'Не успеа заштитната копија од тековниот свет. Враќањето е блокирано.');
 restoring=true;
 clearTimeout(saveTimer);
 try {
  const candidate=backup;
  E.ensureLongplay(candidate);
  Presence?.ensure(candidate);
  // Settle only explicitly recorded LW-C sessions BEFORE LW-A local expiry.
  // Legacy away saves have no autonomy record and never receive retroactive XP.
  PG?.reconcile?.(candidate);
  Presence?.expireLocal?.(candidate); // Old offline sessions cannot resurrect on Restore.
  E.advance(candidate);
  const saved=await S.save(candidate);
  if(!saved?.ok)throw Error(en()?'Could not store the restored world. Your current game remains unchanged.':'Не успеав да го зачувам вратениот свет. Тековната игра останува непроменета.');
  // Switch only AFTER all earlier queued saves and this restore commit.
  globalThis.TrialumPlaygroundAI?.stop?.();s=candidate;Shared?.bindWorld?.(s);el('welcome').hidden=true;
  await globalThis.TrialumI18n?.change(s.settings?.language||'auto');
  // Theme is UI metadata only. Keep the LW-A pinned rescue + safe restore path unchanged.
  if(['system','light','dark'].includes(s.settings?.theme))Theme?.set(s.settings.theme);
  W.setState(s);A.sync(s.settings);render();sendNative();
  backupFeedback(en()?'Backup restored successfully — all pets and game history are available.':'Бекапот е успешно вратен — зачувани се милениците и историјата.',true);
 } finally {
  restoring=false;
 }
 Shared?.reconcileAway?.().catch(()=>{});
 return true;
}
async function start(mode){globalThis.TrialumPlaygroundAI?.stop?.();s=E.newGame('real');Shared?.bindWorld?.(s);s.settings.language=globalThis.TrialumI18n?.preference?.()||'auto';s.settings.theme=Theme?.mode?.()||'system';el('welcome').hidden=true;E.advance(s);A.sync(s.settings);W.setState(s);render();await forceSave();toast('✺ Првата искра започна од неживи елементи!');O?.maybeTutorial();}
globalThis.TrialumLLMEvent=(event)=>{
 if(!s||!event)return;
 if(globalThis.TrialumPlaygroundAI?.onModelEvent?.(event))return;
 const kind=String(event.kind||''),text=String(event.text||'').slice(0,1100);
 if(kind==='reply'||kind==='advancedReply'){
    globalThis.TrialumLocalChat?.finish?.(event.petId);
   const p=s.pets.find(x=>x.id===event.petId);if(!p)return;
   p.chatHistory=Array.isArray(p.chatHistory)?p.chatHistory:[];
   p.chatHistory.push({role:'pet',text:text||'...'});
   p.chatHistory=p.chatHistory.slice(-12);if(kind==='advancedReply')M?.onReply(s,p,text);scheduleSave();if(tab==='pets')renderTab();toast('🧠 '+p.name+' одговори локално.');
 }else if(kind==='error'){
   globalThis.TrialumLocalChat?.finish?.(event.petId);
  M?.downloadEvent?.(kind,event.petId,text);
  if(tab==='pets')renderTab();
  toast('⚠ '+text);
 }else if(kind==='status'){
   if(text==='Model is already generating.')globalThis.TrialumLocalChat?.finish?.(event.petId);
  M?.downloadEvent?.(kind,event.petId,text);
  if(tab==='pets')renderTab();
  toast(text);
 }else if(kind==='progress'){
  M?.downloadEvent?.(kind,event.petId,text);
  const badge=el('llmDownloadStatus');if(badge)badge.textContent=text;
  const advanced=el('mindDownloadStatus');if(advanced)advanced.textContent=text;
 }
};
async function init(){globalThis.TrialumPlaygroundAI?.setSave?.(scheduleSave);try{s=await S.load()}catch(e){console.warn('Save read error',e)}
 const prefer=s?.settings?.language||'auto';await globalThis.TrialumI18n?.change(prefer);
 if(['system','light','dark'].includes(s?.settings?.theme))Theme?.set(s.settings.theme);globalThis.TrialumI18n?.translateDOM(document.body);
 if(s&&E.validate(s)){Shared?.bindWorld?.(s);Presence?.ensure(s);PG?.reconcile?.(s);Presence?.expireLocal?.(s);E.ensureResearch(s);const elapsed=E.advance(s);A.sync(s.settings);W.setState(s);render();await forceSave();if(elapsed)toast(`Поминуваа ${elapsed} дена додека светот беше затворен.`);}else{el('welcome').hidden=false;}
 G?.init({
  getWorld:()=>s,
  restore:async cloudWorld=>{
   const parsed=S.parseImport(JSON.stringify(cloudWorld));
   return await importBackupState(parsed);
  },
  notify:toast,
  refreshUI:()=>{if(tab==='playgames'&&s)renderTab();}
 });
 document.addEventListener('click',ev=>{const startBtn=ev.target.closest('[data-start]');if(startBtn){start(startBtn.dataset.start);return}const tabBtn=ev.target.closest('[data-tab]');if(tabBtn){chooseTab(tabBtn.dataset.tab);return}const btn=ev.target.closest('[data-do]');if(btn)doAction(btn);});
 el('habitatSwitch').addEventListener('change',ev=>selectHabitat(ev.target.value));
 document.addEventListener('change',ev=>{if(ev.target?.id==='msgFriend')Messages?.select(ev.target.value);});
 Social?.onChange(()=>{if(s&&tab==='friends')renderTab();});
 Shared?.onChange(()=>{if(s&&tab==='shared')renderTab();});
 Shared?.onPresenceChange(()=>{if(s){render();scheduleSave();}});
 Messages?.onChange(()=>{if(s&&tab==='messages')renderTab();});
 globalThis.TrialumPushEvent=event=>{Messages?.pushEvent(event);};
 globalThis.TrialumNearbyEvent=event=>{Social?.nearbyEvent(event);if(event?.kind==='invite' && s)chooseTab('friends');};
 globalThis.TrialumSocialInvite=function(code){
  if(Social?.receive(code)){if(s)chooseTab('friends');else toast('Примена е покана за пријателство. Прво започни го светот.');}
 };
 Social?.init().then(()=>{if(s&&tab==='friends')renderTab();if(s)Shared?.reconcileAway?.().catch(()=>{});}).catch(()=>{});
 P?.setProfile(()=>{if(!s)return null;const p=E.currentPet(s)||s.pets[0];return{id:s.peerId,name:s.profileName||'Чувар на искра',pet:p?{id:p.id,name:p.name,species:p.species,hue:p.hue,growth:p.growth,level:E.evolutionProgress(p).level}:{id:'none',name:'Нема миленик',species:0,hue:175,growth:2,level:1}};});
 P?.onChange(info=>{if(!s)return;W.setGuest?.(info.guest?.pet||null);if(tab==='friends')renderTab();});
 P?.onVisit((guest,data)=>{if(!s)return;const p=E.currentPet(s)||s.pets[0];if(p){const r=E.socialize(s,p.id,guest.id);if(r.ok){A.sfx('play');scheduleSave();render();toast('🤝 '+p.name+' се дружеше со '+guest.pet.name);}}});
 document.addEventListener('input',ev=>{if(ev.target?.id==='peerCodeIn')peerIncoming=ev.target.value;if(ev.target?.id==='diarySearch')filterDiary();});
 document.addEventListener('change',ev=>{
  if(ev.target?.id==='languagePicker'){
    const next=ev.target.value,valid=['auto',...(globalThis.TrialumI18n?.languages||[])];
    if(!s||!valid.includes(next))return;
    s.settings.language=next;
    globalThis.TrialumI18n?.change(next).then(()=>{
      render();globalThis.TrialumI18n?.translateDOM?.(document.body);
      scheduleSave();toast('🌍 '+(globalThis.TrialumI18n?.language?.()||next));
    });return;
  }
  if(ev.target?.id==='themePicker'){
    if(!s||!Theme?.set(ev.target.value))return;
    s.settings.theme=Theme.mode();scheduleSave();renderTab();return;
  }
  if(ev.target?.id==='peerMode')peerMode=ev.target.value==='local'?'local':'internet';
  if(ev.target?.id==='diaryFilter')filterDiary();
 });
 document.addEventListener('input',ev=>{if(!s||ev.target?.id!=='volume')return;s.settings.volume=Number(ev.target.value)/100;A.setVolume(s.settings.volume);scheduleSave()});
 el('importFile').addEventListener('change',async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  try{
   if(file.size>20*1024*1024)throw Error(en()?'Backup exceeds 20 MB.':'Бекапот е поголем од 20 MB.');
   const backup=S.parseImport((await file.text()).replace(/^\uFEFF/,''));
   await importBackupState(backup);
  }catch(error){backupFeedback((en()?'Restore failed: ':'Враќањето не успеа: ')+restoreError(error));}
 });
 globalThis.TrialumNativeBackupReceived=async function(json){
  try{const b=S.parseImport(String(json).replace(/^\uFEFF/,''));await importBackupState(b);}
  catch(error){backupFeedback((en()?'Restore failed: ':'Враќањето не успеа: ')+restoreError(error));}
 };
 globalThis.TrialumNativeBackupVaultList=function(entries){
  const mount=el('backupVaultList');
  if(!mount)return;
  const list=Array.isArray(entries)?entries:[];
  mount.innerHTML=list.length?list.map(x=>
   '<div class="settingrow"><span>🛟 '+(x.pinned?'★ ':'')+'Ден '+nf(x.day)+' · '+nf(x.pets)+' миленичиња'+
   ' · '+new Date(Number(x.savedAt)||0).toLocaleString()+'</span>'+
   '<button data-do="rescueRestore" data-id="'+safe(x.id)+'">Врати</button></div>').join(''):
   '<p class="small">Нема исправни спасувачки копии во оваа инсталација.</p>';
 };
 globalThis.TrialumNativeBackupEvent=function(event){
  if(!event)return;
  const translations={
    saved:'Backup saved successfully.',
    tooLarge:'The backup file exceeds 20 MB.',
    invalidJson:'This is not a valid JSON backup.',
    write:'Could not save the backup file.',
    read:'Could not read or validate the selected backup file.',
    pickerSave:'Could not open the backup file picker.',
    pickerRestore:'Could not open the restore file picker.'
  };
  const text=en()?(
    translations[event.code]||(event.ok?'Backup saved.':'Backup operation failed.')
  ):(event.message||(event.ok?'Бекапот е успешно зачуван.':'Грешка при работа со бекап.'));
  backupFeedback(text,Boolean(event.ok));
 };
 // Changing aquarium height changes document height and scrollY. Switching
 // based only on scrollY made the sticky world bounce between expanded/compact.
 // A genuine user scroll gesture (not browser scroll anchoring) must toggle it.
 const scrollHeightOffset=()=>{
  const mast=document.querySelector('.mast');
  if(mast)document.documentElement.style.setProperty('--trialum-header-height',
   Math.ceil(mast.getBoundingClientRect().height+8)+'px');
 };
 const updateSceneScroll=()=>{
  const world=document.querySelector('.world');
  if(!world||world.hidden)return;
  const y=window.scrollY||document.documentElement.scrollTop||0;
  if(!compact&&scrollIntent>0&&gesturePixels>=16&&y>170){
   compact=true;world.classList.add('scene-compact');gesturePixels=0;
  }else if(compact&&scrollIntent<0&&gesturePixels>=52&&y<65){
   compact=false;world.classList.remove('scene-compact');gesturePixels=0;
  }
 };
 const userScrollDelta=delta=>{
  if(!Number.isFinite(delta)||Math.abs(delta)<2)return;
  const next=delta>0?1:-1;
  if(next!==scrollIntent){scrollIntent=next;gesturePixels=0;}
  gesturePixels=Math.min(1200,gesturePixels+Math.abs(delta));
  updateSceneScroll();
 };
 window.addEventListener('wheel',e=>userScrollDelta(e.deltaY),{passive:true});
 window.addEventListener('touchstart',e=>{
  lastFingerY=e.touches?.[0]?.clientY??null;scrollIntent=0;gesturePixels=0;
 },{passive:true});
 window.addEventListener('touchmove',e=>{
  const y=e.touches?.[0]?.clientY;
  if(typeof y!=='number')return;
  if(lastFingerY!==null)userScrollDelta(lastFingerY-y);
  lastFingerY=y;
 },{passive:true});
 window.addEventListener('touchend',()=>{lastFingerY=null;},{passive:true});
 window.addEventListener('touchcancel',()=>{lastFingerY=null;},{passive:true});
 window.addEventListener('keydown',e=>{
  const down=['ArrowDown','PageDown',' '],up=['ArrowUp','PageUp','Home'];
  if(down.includes(e.key))userScrollDelta(85);
  else if(up.includes(e.key))userScrollDelta(-85);
 });
 window.addEventListener('scroll',updateSceneScroll,{passive:true});
 window.addEventListener('resize',()=>{scrollHeightOffset();updateSceneScroll();},{passive:true});
 scrollHeightOffset();updateSceneScroll();
 document.addEventListener('visibilitychange',()=>{if(s&&document.visibilityState==='visible'){const before=s.labActions;const autonomy=PG?.reconcile?.(s)?.changed;const expired=Presence?.expireLocal?.(s)?.changed;const days=E.advance(s);if(autonomy||expired||days||before!==s.labActions){render();scheduleSave();activeSignals()}Shared?.reconcileAway?.().catch(()=>{});}else if(s)forceSave();});
 window.addEventListener('pagehide',()=>{if(s)forceSave()});
 // LW-B: elapsed simulation time is reconciled on foreground/restore above;
 // never run periodic world mutation/DOM repaint while WebView is hidden.
 setInterval(()=>{if(!s||document.hidden||document.visibilityState==='hidden')return;const before=s.labActions;const autonomy=PG?.reconcile?.(s)?.changed;const expired=Presence?.expireLocal?.(s)?.changed;const days=E.advance(s);if(autonomy||expired||days||before!==s.labActions){render();scheduleSave();activeSignals();}else PG?.refreshProgress?.(s);},20000);
 // True real-time local autonomy: the first interaction is at +4 seconds,
 // not after a 20-minute checkpoint. No hidden WebView work or fake server XP.
 setInterval(()=>{
  if(!s||document.hidden||document.visibilityState==='hidden')return;
  const progressed=PG?.reconcile?.(s);
  if(progressed?.changed){render();scheduleSave();activeSignals();}
  else PG?.refreshProgress?.(s);
  globalThis.TrialumPlaygroundAI?.tick?.(s,tab);
  if(tab==='shared')globalThis.TrialumSharedScene?.refreshCaption?.(Shared?.getState?.()?.snapshot);
 },3000);
 // Only opted-in pets away on the server need a lightweight visible-window check.
 setInterval(()=>{if(s&&document.visibilityState!=='hidden')Shared?.reconcileAway?.().catch(()=>{});},120000);
 if('serviceWorker'in navigator&&location.protocol==='https:'){navigator.serviceWorker.register('./sw.js').catch(()=>{})}
 if(!s)O?.maybeIntro();
 W.onPick(id=>{if(!s)return;const result=E.selectPet(s,id);if(result.ok){chooseTab('pets');A.sfx('select');A.speak(E.currentPet(s));render();scheduleSave();toast(`🐾 Избрано ${E.currentPet(s).name} · ${E.currentPet(s).actionsLeft}/${E.petActionLimit(s)} акции`);}});
}
init();
})();
