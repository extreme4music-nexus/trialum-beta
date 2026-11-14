/* TRIALUM 1.4 UI: every feature clearly explains its unlock criteria. */
(function(root){
'use strict';
const E=root.TrialumEngine,previous=root.TrialumExpansion;
const esc=x=>String(x??'').replace(/[&<>"']/g,a=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[a]));
const b=(text,act,attr='',disabled=false)=>'<button data-do="'+act+'" '+attr+(disabled?' disabled':'')+'>'+text+'</button>';
const fmt=x=>Math.floor(Number(x)||0).toLocaleString('mk-MK');
const crit=(items)=>'<div class="unlock-checks">'+items.map(k=>'<div class="goal '+(k.ok?'done':'')+'"><span>'+(k.ok?'✓':'🔒')+' '+esc(k.label)+'</span><small>'+esc(k.value)+'</small></div>').join('')+'</div>';
const lock=(conditions)=>'<div class="lock-hint">🔒 '+esc(conditions)+'</div>';
function catalog(s){
 const stage=s.stage,hab=E.currentHabitat(s);
 const animals=E.SPECIES.map((p,i)=>{
 const g=E.longplayRequirements(s,i),isAdvanced=i>=4,ready=g.ok,
 pet=s.pets.find(x=>x.species===g.source?.species&&g.source&&x.id===g.source.id);
 const stats=isAdvanced?'🧬 ДНК-трансформација':'⚗️ Создавање од основни компоненти';
 const requirements=g.items.filter(x=>!x.ok),existing=s.pets.some(x=>x.species===i);
 return '<div class="card species-card '+(ready?'':'locked-card')+'"><div class="mini-row"><h3>'+p.icon+' '+esc(p.name)+'</h3><span class="pill">'+(ready?'✓ УСЛОВИ ИСПОЛНЕТИ':'🔒 ЗАКЛУЧЕНО')+'</span></div>'+
 '<p>'+esc(p.description||g.description)+'</p><p class="price">'+stats+' · Лаб '+g.lab+'</p>'+
 '<p class="small">'+(i>=4?'Израснато претходно милениче го наследува идентитетот, меморијата и искуството.':'Нов вид во соодветно живеалиште.')+'</p>'+
 crit(g.items)+
 (isAdvanced?b('🧬 Преобрази избрано милениче','transformDNA','data-species="'+i+'"',!ready||!g.source):
 b('🐣 Создај '+esc(p.name),'createPet','data-species="'+i+'"',!ready||!hab||hab.biome!==g.items.find(x=>x.label==='Соодветно живеалиште')?.value?.split(' ')[0]))+
 '</div>';
 }).join('');
 const gate=E.longplayStageGate(s),req=E.PHASE_REQ[s.stage],need=req?
 'Наредна фаза: '+esc(E.PHASES[s.stage+1])+'. Време: '+(gate.ready?'✓ поминато':Math.ceil((gate.requiredMs-gate.elapsedMs)/60000)+' мин. преостанати')+
 ' · Сознание '+s.insight+'/'+req.insight+' · Молекули '+s.compounds+'/'+req.compounds+
 (req.cells?' · Клетки '+s.cells+'/'+req.cells:''):'Сите први еволутивни фази се отклучени.';
 return '<div class="tab-main"><h2>⚗️ Жива лабораторија</h2>'+
 '<p class="desc">Стартот до првите клетки трае минути, потоа времето и потребните услови постепено растат. Дневните лабораториски акции се обновуваат и со локално поминување на време.</p>'+
 '<div class="notice">'+need+'</div>'+
 '<div class="btn-line">'+[['synthesize','⚛️ Синтеза'],['analyze','🔬 Анализа'],['harvest','🪨 Суровини'],['grow','🧫 Размножи клетки']].map(([id,label])=>b(label,'lab','data-kind="'+id+'"',s.labActions<1||(id==='grow'&&stage<2))).join('')+
 b('✨ Следна фаза','evolve','class="primary"',s.stage>=7||!gate.ready)+'</div>'+
 '<p class="small">Лабораториски акции: '+s.labActions+'/'+E.labActionLimit(s)+' · Протоклетка по 4-та минута; самоодржувачки клетки по 11-та минута ако се собрани ресурсите.</p>'+
 '<details class="game-accordion"><summary>🐾 Каталог — 11 постепени видови</summary><p class="desc">Секој вид ги покажува сите предуслови. Од Синапсо нагоре миленичиња не се произведуваат од нула; само зрели претходни форми минуваат низ ДНК-трансформација.</p>'+
 '<div class="cards">'+animals+'</div></details></div>';
}
function research(s){
 const r=E.ensureResearch(s),tier=E.longplayTier(r.level+1),req=E.labRequirements(s,tier.level);
 const field=E.researchFields.map(f=>'<div class="card"><h3>'+f.icon+' '+esc(f.name)+'</h3><p>Знаење: '+fmt(r.fields[f.id])+'</p>'+b('🔬 Истражувај','study','data-field="'+f.id+'"',s.labActions<1)+'</div>').join('');
 const general=E.longplayMaterials.map(m=>{
 const yes=!!s.longplay.materials[m.id];
 return '<div class="card '+(yes?'':'locked-card')+'"><h3>🪨 '+esc(m.name)+'</h3><p>Лаб '+m.lab+' · Знаење '+m.knowledge+' · '+esc(m.field)+' '+m.fieldPoints+'</p>'+
 (yes?'<p>Резерва: '+(s.longplay.materials[m.id]||0)+'</p>'+b('⚗️ Произведи +2','longCraftMaterial','data-material="'+m.id+'"',s.labActions<1):
 lock('Откриј преку „Нови материјали“ по исполнување на предусловите.'))+'</div>';
 }).join('');
 return '<div class="tab-main"><h2>🏛️ Истражувања · Лабораторија '+r.level+'</h2>'+
 '<p class="desc">Лабораториите продолжуваат со нови нивоа и по завршувањето на основната кампања. Нема финална победа.</p>'+
 '<div class="notice">Знаење: '+fmt(r.knowledge)+' · '+s.labActions+'/'+E.labActionLimit(s)+' акции · '+s.longplay.credits+' бесплатни истражувачки кредити.</div>'+
 '<h3>Научни области</h3><div class="cards">'+field+'</div>'+
 '<h3>⬆ Нареден технолошки центар</h3><div class="notice">'+esc(tier.name)+' · Ниво '+tier.level+'</div>'+crit(req.items)+b('⬆ Надгради лабораторија','upgradeLab','class="primary"',!req.ok||s.labActions<1)+
 '<h3>✨ Откривај нов жив и нежив свет</h3><p class="desc">Секоја успешна експедиција отвора нова виртуелна формула, ново растение или материјал за биосветови.</p>'+
 '<div class="btn-line">'+b('🥣 Нова храна','longInvent','data-kind="food"',r.level<2)+b('🌿 Нова флора','longInvent','data-kind="flora"',r.level<2)+b('🪨 Нов материјал','longInvent','data-kind="material"',r.level<2)+b('🐉 Нова фауна','longInvent','data-kind="fauna"',r.level<12||!E.currentPet(s)||E.evolutionProgress(E.currentPet(s)).level<75)+'</div>'+
 '<p class="small">🔒 Истражувањето нова фауна бара лабораторија ниво 12 и избран Ноетриум или наследник со ниво најмалку 75. Секоја следна форма се развива само преку ДНК.</p><details class="game-accordion"><summary>🧱 Истражувачки материјали</summary><div class="cards">'+general+'</div></details>'+ 
 '<details class="game-accordion"><summary>✨ Последни откритија ('+s.longplay.invented.length+')</summary>'+
 (s.longplay.invented.length?s.longplay.invented.slice(-12).reverse().map(x=>'<div class="friend-item">✨ '+esc(x.name)+' · '+esc(x.kind)+' · ден '+fmt(x.day)+'</div>').join(''):'<p>Нема регистрирани изуми. Истражувај за да создадеш прва формула.</p>')+'</details></div>';
}
function habitat(s){
 const h=E.currentHabitat(s),build=s.construction,biomes=E.BIOMES||[];
 const selection='<h3>🏝️ Моите биосветови ('+s.habitats.length+')</h3><div class="cards">'+
 (s.habitats.length?s.habitats.map(x=>'<div class="card '+(x.id===s.activeHabitat?'activated':'')+'"><h3>'+esc(x.name)+'</h3>'+
 '<p>🌡 '+esc(biomes.find(z=>z.id===x.biome)?.name||x.biome)+' · Квалитет '+E.envScore(x)+'% · Биотовар '+E.occupancy(s,x.id)+'/'+x.capacity+
 ' · Флора '+x.flora.length+'/'+(x.floraSlots||6)+'</p>'+
 '<div class="progress"><div style="width:'+E.envScore(x)+'%"></div></div>'+
 b(x.id===s.activeHabitat?'✓ Активен биосвет':'🔎 Избери','selectHabitat','data-id="'+esc(x.id)+'"',x.id===s.activeHabitat)+'</div>').join(''):
 '<div class="card"><h3>Уште нема живеалишта</h3><p>Прво достигни еволутивна фаза 7, а потоа започни изградба од основни елементи.</p></div>')+'</div>';
 const care=h?'<section class="hab-care"><h3>🧪 Биохемија: '+esc(h.name)+'</h3><div class="hab-summary"><div>Квалитет <b>'+E.envScore(h)+'%</b></div><div>Акции <b>'+h.dayActions+'/'+(E.HAB_ACTIONS+Math.floor(s.research.level/3))+'</b></div><div>Биотовар <b>'+E.occupancy(s,h.id)+'/'+h.capacity+'</b></div><div>Флора <b>'+h.flora.length+'/'+h.floraSlots+'</b></div></div>'+
 '<div class="hab-metrics"><span>pH: '+esc(h.chem.ph)+'</span><span>Температура: '+esc(h.chem.temp)+'°</span><span>O₂: '+esc(h.chem.oxygen)+'%</span><span>Чистота: '+esc(h.cleanliness)+'%</span><span>Токсини: '+esc(h.chem.toxins)+'%</span><span>Макро: '+esc(h.minerals.macro)+'</span><span>Микро: '+esc(h.minerals.micro)+'</span></div>'+
 '<div class="cards">'+[['macro','🧂 Макроелементи','Ca · Mg · K'],['micro','🔹 Микроелементи','Fe · Zn · Cu'],['oxygen','💨 Оксигенација','Одржувај кислород'],['balance','🌡 pH и температура','Стабилна средина'],['clean','🫧 Чистење','Намали токсини']].map(([kind,title,note])=>'<div class="card"><h3>'+title+'</h3><p>'+note+'</p>'+b('Примени','habCare','data-kind="'+kind+'"',h.dayActions<1)+'</div>').join('')+'</div></section>':
 '<div class="notice">🔒 За биохемиска грижа најпрво изгради и избери биосвет.</div>';
 const construction=build?'<div class="progress-build"><h3>🏗️ Изградба во тек: '+esc(build.biome)+'</h3>'+
 '<p>Чекор '+build.step+'/5 · '+esc(E.BUILD_TASKS[build.step]?.name||'Завршување')+'</p>'+
 '<div class="progress"><div style="width:'+Math.min(100,build.step*20)+'%"></div></div>'+
 b('🔨 Следен градежен чекор','buildStep','class="primary"',build.lastStepDay===s.lastDay)+'</div>':
 '<div class="cards">'+biomes.map(x=>'<div class="card"><h3>🏞 '+esc(x.name)+'</h3><p>Почетен биокапацитет: '+x.capacity+'. Пет градежни чекори, со посебни ресурси и време.</p>'+
 b('🏗️ Започни','startBuild','data-biome="'+x.id+'"',s.stage<6)+'</div>').join('')+'</div>';
 const upgrades=E.longplayTech.map(t=>{
 const m=E.longplayMaterials.find(x=>x.id===t.material),qty=s.longplay.materials[t.material]||0,ready=!!h&&s.research.level>=t.lab&&qty>=t.cost;
 return '<div class="card '+(ready?'':'locked-card')+'"><h3>'+esc(t.title)+'</h3><p>Лабораторија '+t.lab+
 ' · Материјал: '+esc(m?.name||t.material)+' ('+qty+'/'+t.cost+') · 10 сознание · 1 акција на биосветот.</p>'+
 b('⬆ Надгради','longHabUpgrade','data-upgrade="'+t.id+'"',!ready||h.dayActions<1)+'</div>';
 }).join('');
 return '<div class="tab-main"><div class="section-heading"><h2>🏝️ Живеалишта и биохемија</h2><p>Управувај со квалитет, растенија, капацитет и изградба. Секоја промена веднаш го ажурира избраниот биосвет.</p></div>'+
 selection+care+'<h3>🏗️ Изгради нов биосвет</h3><p class="desc">Потребна е еволутивна фаза 7. Изградбата не е моментална.</p>'+construction+
 '<details class="game-accordion"><summary>🧱 Истражувачки проширувања</summary><p class="desc">Новите материјали од Истражувања го зголемуваат капацитетот и бројот растенија.</p><div class="cards">'+upgrades+'</div></details></div>';
}
function food(s){
 const r=E.ensureResearch(s),p=E.currentPet(s),sp=p&&E.SPECIES[p.species];
 return '<div class="tab-main"><h2>🍱 Лабораторија за храна</h2><p class="desc">Формулите и специјализираните хранливи состојки се отклучуваат преку истражување. Фабриката не троши акции на другите миленици.</p><div class="notice">Избран миленик: '+(p?esc(p.name)+' · '+p.actionsLeft+'/'+E.petActionLimit(s):'нема')+'</div><div class="cards">'+E.foodRecipes.map(f=>{
 const unlocked=r.level>=f.tier,stock=s.foodFactory.stock[f.id]||0,good=p&&E.feedCompatible(sp,f,p);
 return '<div class="card '+(unlocked?'':'locked-card')+'"><h3>'+f.icon+' '+esc(f.name)+'</h3>'+
 '<p>'+esc(f.desc)+'</p><p class="price">🔒 Лаб '+f.tier+(f.id.startsWith('research-')?' · прво пронајди преку истражувања':'')+' · '+f.cost.biomass+' биомаса + '+f.cost.compounds+' молекули</p>'+
 '<p>Порции: '+stock+' · '+(good?'✓ Соодветна за избраниот вид':'Специјализирана за друга група')+'</p>'+
 b('⚗️ Произведи','craftFood','data-recipe="'+f.id+'"',!unlocked||s.labActions<1)+
 b('🍽️ Нахрани','feedFood','data-recipe="'+f.id+'"',!good||stock<1||p.actionsLeft<1)+'</div>';
 }).join('')+'</div></div>';
}
function dna(s){
 const p=E.currentPet(s),base=previous.render('dna',s);
 const lineage=[...E.longplayLineages.filter(x=>x.id>=4),...E.longplayFaunaList(s).map(x=>({id:x.speciesIndex,description:'Истражена уникатна фауна, наследство на еден организам.'}))].map(x=>{
 const g=E.longplayRequirements(s,x.id),ready=g.ok&&p?.species===x.source;
 return '<div class="card '+(ready?'':'locked-card')+'"><h3>🧬 '+esc(E.SPECIES[x.id].name)+'</h3><p>'+esc(x.description)+'</p>'+crit(g.items)+
 b('🧬 Преобрази го избраниот миленик','transformDNA','data-species="'+x.id+'"',!ready)+'</div>';
 }).join('');
 return base+'<div class="tab-main"><h3>🧬 Вистински еволутивни линии (само виртуелни)</h3><p class="desc">Овие суштества не се создаваат од нула. Трансформирај го зрелиот претходен вид, со задржување на меморијата, возраста, тренинзите и историјата.</p><div class="cards">'+lineage+'</div></div>';
}
function pets(s){
 const p=E.currentPet(s),skill=[
 ['wave','👋 Мавтање',3,1],['spin','🌀 Вртење',8,3],['leap','🐾 Скокање',15,4],
 ['symbols','🔤 Знаци',22,6],['logic','🧩 Логика',35,8],['dialogue','💬 Дијалог',50,10]];
 const lv=p?E.evolutionProgress(p).level:0,r=s.research.level;
 const training=skill.map(([id,label,level,lab])=>'<div class="card '+(p&&lv>=level&&r>=lab?'':'locked-card')+'"><h3>'+label+'</h3><p>🔒 Миленик ниво '+level+' и лабораторија '+lab+' · научено '+(p?.skills?.[id]||0)+'</p>'+b('🎓 Тренирај','longTrain','data-skill="'+id+'"',!p||lv<level||r<lab||p.actionsLeft<1)+(p?.skills?.[id]?b('▶ Покажи трик','performTrick','data-skill="'+id+'"'):'' )+'</div>').join('');
 const list=s.pets.map(q=>'<button data-do="selectPet" data-id="'+esc(q.id)+'" class="pet-option '+(s.selectedPet===q.id?'active':'')+'"><span class="emoji">'+E.SPECIES[q.species].icon+'</span><span><b>'+esc(q.name)+'</b><small>'+
 esc(E.SPECIES[q.species].name)+' · ниво '+E.evolutionProgress(q).level+' · '+q.actionsLeft+'/'+E.petActionLimit(s)+' акции · '+(q.lineage?.length||1)+' генерации</small></span></button>').join('');
 return '<div class="tab-main"><h2>🐾 Миленици · независна еволуција</h2><p class="desc">Секое милениче има свои акции, меморија, нивоа, трансформации и тренинзи.</p><div class="pet-list">'+(list||'<p>Прво одгледај ќелија и изгради живеалиште.</p>')+'</div><div id="selectedPetMount"></div><details class="game-accordion"><summary>🎓 Обука за избраниот миленик</summary><p class="desc">Вештините се отклучуваат постепено — поради сè потешките епохи, високите тренинзи бараат месеци развој.</p><div class="cards">'+training+'</div></details>'+
 (p?chatPanel(s,p)+(root.TrialumMind?.render(s,p)||''):'')+
 '<h3>🚚 Преселба меѓу биосветови</h3><div class="btn-line">'+s.habitats.map(h=>b('↔ '+esc(h.name),'transfer','data-id="'+esc(h.id)+'"',!p||p.habitatId===h.id)).join('')+'</div>'+
 b('✏️ Преименувај','renamePet','',!p)+'</div>';
}
// The 135M GGUF model is installed once per app, NOT per species.
// Reuse a single gate for the UI and for outgoing messages.
function miniGate(s,p){
 const species=Number(p?.species),lv=p?E.evolutionProgress(p).level:0,lab=Number(s?.research?.level)||0;
 const evolved=Number.isInteger(species)&&species>=4&&!!E.SPECIES[species];
 return {ok:evolved&&lv>=22&&lab>=6,lv,lab,evolved};
}
function chatPanel(s,p){
 const gate=miniGate(s,p),lv=gate.lv,advanced=gate.ok;
 let status='not-available';
 try{status=root.TrialumAndroid?.modelStatus?.()||'not-available'}catch(_){}
 const state={installed:'✓ Инсталиран · ист мини модел за сите еволуирани миленичиња',
 downloading:'⏳ Преземање…',generating:'🧠 Моделот одговара на претходна порака…',
 'resume-available':'⏸ Делумно преземен · продолжи',
 'not-installed':'🔒 Моделот не е преземен','not-available':'Само во Android верзијата'}[status]||status;
 const history=(Array.isArray(p.chatHistory)?p.chatHistory:[]).slice(-12).map(x=>
 '<div class="chat-message '+(x.role==='user'?'human':'creature')+'"><b>'+(x.role==='user'?'Ти':esc(p.name))+'</b><p>'+esc(x.text)+'</p></div>').join('');
 return '<section class="llm-panel"><h3>🧠 Вистински локален LLM разговор</h3>'+
 '<p class="desc">Синапсо и следните видови добиваат мала јазична мрежа (135 милиони параметри). Пакетот е одделен од APK, се презема само по избор и работи само при директен разговор.</p>'+
 (!advanced?'<div class="lock-hint">🔒 Барања: Синапсо или повисок вид, миленик ниво 22 и лабораторија ниво 6. Сега: вид '+esc(E.SPECIES[p.species]?.name)+', ниво '+lv+', лабораторија '+gate.lab+'.</div>':
 '<div class="notice">SmolLM2-135M-Instruct · GGUF ~94 MB · '+esc(state)+'<p class="small">Мини модел, претежно англиски. Разговорите се локални, без сервер и без генерација во заднина.</p></div>'+
 (status!=='installed'&&status!=='generating'&&status!=='downloading'?b(status==='resume-available'?'⬇ Продолжи преземање':'⬇ Преземи вистински LLM пакет','llmDownload','class="primary"',!['not-installed','resume-available'].includes(status)):'')+
 '<div class="chat-log" id="llmTranscript">'+(history||'<p class="subtle small">Започни разговор со својот еволуиран миленик.</p>')+'</div>'+
 '<div class="chat-compose"><textarea id="llmPrompt" rows="2" maxlength="360" placeholder="Кратка порака до миленикот…" aria-label="Порака до миленикот"></textarea>'+
 b('💬 Испрати','llmAsk','class="primary"',status!=='installed'||!!root.TrialumLocalChat?.busy?.())+'</div>'+
  '<p class="small">Локалните AI разговори не трошат дневни акции или кредити.</p>'+
 '<p class="small subtle">Нема дневен лимит за локални AI разговори. Телефонот генерира по еден одговор во исто време.</p>')+'</section>';
}
function settings(s){
 const on=!!s.settings.debugEnabled;
 return '<div class="tab-main"><h2>⚙️ Поставки</h2><p class="desc">Тука се звукот, резервните копии, известувањата и програмерските алатки. Дневникот е во сопственото мени.</p>'+
 '<div class="settings-group"><h3>🌐 Јазик / Language</h3><p class="small subtle">Избери автоматски системски јазик или еден од 17-те достапни јазици. Непреведените постари текстови се прикажуваат на англиски; личните имиња и дневникот не се менуваат.</p>'+
 '<label for="languagePicker">🌍 Избери јазик</label><select id="languagePicker" class="preference-select" aria-label="Избери јазик">'+
 '<option value="auto"'+((s.settings.language||'auto')==='auto'?' selected':'')+'>🌐 Автоматски (системски јазик)</option>'+
 (root.TrialumI18n?.catalog||[{code:'mk',name:'Македонски',flag:'🇲🇰'},{code:'en',name:'English',flag:'🇬🇧'}]).map(l=>'<option value="'+l.code+'"'+(s.settings.language===l.code?' selected':'')+'>'+l.flag+' '+esc(l.name)+'</option>').join('')+'</select></div>'+
 '<div class="settings-group"><h3>🌓 Тема</h3><label for="themePicker">Изглед на играта</label>'+
 '<select id="themePicker" class="preference-select" aria-label="Избери тема">'+
 [['system','Системска тема'],['light','Светла тема'],['dark','Темна тема']].map(([v,label])=>'<option value="'+v+'"'+(root.TrialumTheme?.mode?.()===v?' selected':'')+'>'+label+'</option>').join('')+'</select></div>'+
 '<div class="settings-group"><h3>🎓 Вовед и туторијал</h3><p class="small subtle">Можеш повторно да ги прочиташ упатствата во секое време. Нема промена на напредокот.</p><div class="btn-line">'+
 b('✺ Повтори вовед','onboardingIntro')+b('📖 Повтори туторијал','onboardingTutorial')+'</div></div>'+
 '<div class="settings-group"><h3>🔊 Аудио</h3><div class="btn-line">'+b(s.settings.sound?'🔊 Звук: вклучен':'🔇 Звук: исклучен','toggleSound','id="soundBtn"')+
 b(s.settings.music?'♫ Музика: вклучена':'♫ Музика: исклучена','toggleMusic','id="musicBtn"')+'</div>'+
 '<div class="settingrow"><label for="volume">Јачина на звук</label><input id="volume" type="range" min="0" max="100" value="'+Math.round(s.settings.volume*100)+'"></div></div>'+
 '<div class="settings-group"><h3>🎮 Google Play Games</h3><p class="small subtle">Опционално поврзување и Cloud Save. Без Google профил играта работи локално.</p><div class="btn-line">'+b('🎮 Отвори Google Play Games','pgsOpen')+'</div></div>'+
 '<div class="settings-group"><h3>💾 Бекап и враќање</h3><div class="btn-line">'+b('⬇ Направи бекап','export','class="primary"')+
 b('⬆ Врати од бекап','import')+b('🛟 Спасувачки копии','rescueList')+'</div>'+
 '<div id="backupVaultList" class="backup-vault-list" role="status" aria-live="polite"></div>'+
 '<p class="small subtle">Бекапот го зачувува целиот свет како JSON датотека. Враќањето го заменува сегашниот свет само по потврда. Пред враќање направи бекап на тековниот напредок.</p>'+
 '<p class="small subtle">Android ги зачувува новите JSON датотеки во Downloads/Trialum со уникатно име и SHA-256 проверка. Внатрешните спасувачки копии се бришат при деинсталација — зачувај и надворешен JSON.</p>'+
 '<p id="backupFeedback" class="small" role="status" aria-live="polite"></p>'+
 '<p class="small">Состојба: <span id="saveStatus">Локално автоматско зачувување</span></p></div>'+
 '<div class="settings-group"><h3>🔔 Android известувања</h3>'+
 b('🔔 Управувај со дозволата','notification')+'<p class="small subtle">Звучните сигнали и бројот на иконата зависат од Android и launcher поставките.</p></div>'+
 '<div class="settings-group"><h3>💠 Бесплатни кредити</h3><p>Заработени: '+fmt(s.longplay.earned)+' · Расположиви: '+fmt(s.longplay.credits)+'</p>'+
 '<div class="btn-line">'+b('⚡ Лаб +1 акција · 12','longBoost','data-boost="lab"',s.longplay.credits<12)+
 b('🐾 Миленик +1 акција · 8','longBoost','data-boost="pet"',s.longplay.credits<8)+
 b('🏝️ Биосвет +1 акција · 8','longBoost','data-boost="habitat"',s.longplay.credits<8)+
 b('🧬 Скратување на ран период · 20','longBoost','data-boost="phase"',s.longplay.credits<20||s.stage>=7)+'</div>'+
 '<p class="small subtle">Нема наплата, реклами ниту активна продавница.</p></div>'+
 '<div class="settings-group debug-zone"><h3>🧪 Дебагирање и тестирање</h3>'+
 '<p class="small">Опционална програмерска алатка. Дебаг-деновите се симулираат во овој локален свет. Не се активираат во обична игра.</p>'+
 b(on?'🔓 Исклучи дебагирање':'🔒 Вклучи дебагирање','debugToggle','class="'+(on?'button-gold':'')+'"')+
 (on?'<div class="notice">⚠ Тестни измени во светот! Прво извези JSON ако сакаш да го зачуваш напредокот пред дебагирање.</div>'+
 '<div class="btn-line">'+b('⏭ +1 ден','debugDays','data-days="1"')+b('⏭ +7 дена','debugDays','data-days="7"')+b('⏭ +30 дена','debugDays','data-days="30"')+'</div>'+
 '<div class="btn-line">'+b('⚗️ Тестни ресурси','debugResources')+b('🐾 Миленик +5 нивоа','debugPet','data-levels="5"')+
 b('🐾 Миленик +20 нивоа','debugPet','data-levels="20"')+'</div>':'')+'</div>'+
 '<div class="settings-group"><h3>⚠ Управување со светот</h3>'+b('↻ Нов свет — избриши напредок','newGame','class="danger"')+'</div></div>';
}
function notifications(s){
 const al=E.alerts(s);
 return '<div class="tab-main"><h2>🔔 Известувања</h2><p>Android известувањата работат со системска дозвола, звучен канал и badge број што зависи од поддршката на launcher-от.</p>'+
 b('🔔 Побарај Android дозвола','notification','class="primary"')+
 '<h3>Моментални сигнали ('+al.length+')</h3>'+
 (al.length?al.map(x=>'<div class="alert">⚠ '+esc(x.text)+'</div>').join(''):'<div class="allgood">✓ Нема критични потреби.</div>')+
 '<p class="small">Android периодично ги проверува информациите преку WorkManager. Доцнења се можни поради батеријата.</p></div>';
}
function plants(s){
 const h=E.currentHabitat(s),level=s.research.level,stage=s.stage;
 const cards=E.PLANTS.map(f=>{
 const known=s.blueprints.includes(f.id),ready=stage>=5&&level>=(f.labTier||1);
 const inHab=h?.flora?.filter(x=>x.species===f.id).length||0;
 return '<div class="card '+(ready?'':'locked-card')+'"><h3>'+f.icon+' '+esc(f.name)+'</h3><p>'+esc(f.kind)+'</p>'+
 '<p class="price">'+(known?'✓ Научен модел':'🔒 Неоткриен модел')+' · '+(f.labTier?'Лабораторија '+f.labTier:'Еволутивна фаза 6')+' · 12 сознание + 7 молекули</p>'+
 '<p>Засадени во активниот биосвет: '+inHab+' · флора '+(h?h.flora.length+'/'+h.floraSlots:'нема живеалиште')+'</p>'+
 b(known?'✓ Отклучено':'🧪 Проучи растение','inventPlant','data-plant="'+f.id+'"',known||!ready)+
 b('🌱 Засади','plant','data-plant="'+f.id+'"',!known||!h||h.flora.length>=h.floraSlots||h.dayActions<1)+'</div>';
 }).join('');
 return '<div class="tab-main"><h2>🌿 Ботаничка истражувачка лабораторија</h2>'+
 '<p class="desc">Новата флора се открива преку истражувања и се создава во погоден биосвет. За поголем број растенија надгради го биосветот со откриени минерали и материјали.</p>'+
 '<div class="notice">Активно живеалиште: '+(h?esc(h.name)+' · '+h.flora.length+'/'+h.floraSlots+' растенија':'не е изградено')+'</div>'+
 '<div class="cards">'+cards+'</div></div>';
}
function more(){
 const items=[
 ['🧬','ДНК лабораторија','dna','Еволутивни трансформации'],
 ['🌿','Флора','plants','Растенија и откритија'],
 ['🍱','Храна','food','Рецепти и исхрана'],
 ['🤝','Пријатели','friends','Покани и приватна дружба'],
 ['💌','Пораки','messages','Приватни фрази и известувања, без јавен чет'],
 ['🎠','Игротека','playground','Анимирани игри, вештини и заработени надградби'],
 ['🌳','Заедничка игротека','shared','Приватни групи, посети со дозвола и синхронизација'],
 ['🎮','Google Play Games','playgames','Профил, достигнувања, рангирања и Cloud Save'],
 ['🏆','Галерија','achievements','Слики и постигнувања'],
 ['📖','Дневник','diary','Целата хронологија'],
 ['🔔','Известувања','notifications','Потребите на милениците'],
 ['⚙️','Поставки','settings','Звук, бекап, дебаг']
 ];
 return '<div class="tab-main"><h2>☰ Повеќе можности</h2><p class="desc">Брзо најди го вистинскиот дел од играта. Заклучените функции ги објаснуваат условите.</p>'+
 '<div class="more-grid">'+items.map(([ico,name,id,note])=>'<button class="more-item" data-tab="'+id+'"><span class="more-icon">'+ico+'</span>'+
 '<span><b>'+name+'</b><small>'+note+'</small></span><span aria-hidden="true">›</span></button>').join('')+'</div></div>';
}
const views={more,lab:catalog,research,habitats:habitat,food,dna,pets,plants,settings,notifications,playground:s=>root.TrialumPlayground?.render(s)||'<p>Игротеката не е достапна.</p>',shared:s=>root.TrialumShared?.render(s)||'<p>Заедничката игротека не е достапна.</p>',messages:s=>root.TrialumMessages?.render(s)||'<p>Пораките не се достапни.</p>',playgames:()=>root.TrialumPlayGames?.render()||'<p>Play Games не е достапен.</p>'};
const actions=new Set(['mindToggle','mindTier','mindDownload','mindAsk','performTrick','llmDownload','llmAsk','debugToggle','debugDays','debugResources','debugPet','longInvent','longCraftMaterial','longHabUpgrade','longTrain','transformDNA','longBoost']);
root.TrialumExpansion={
 render(page,s){if(!s)return '';E.ensureLongplay(s);if(views[page])return (['lab','habitats','pets','research','more'].includes(page)?'':'<button class="section-back" data-tab="more">‹ Повеќе</button>')+views[page](s);return previous.render(page,s);},
 can(action){return actions.has(action)||previous.can(action);},
 handle(action,b,s,ctx){
 if(!actions.has(action))return previous.handle(action,b,s,ctx);
 if(root.TrialumMind?.handle(action,b,s,ctx))return;
 let result=null;
 switch(action){
 case 'performTrick':{
  const p=E.currentPet(s);if(!p||!root.TrialumWorld?.playTrick(p.id,b.dataset.skill)){ctx.toast('Прво научи го овој трик.');return;}
  ctx.toast('✨ '+p.name+' го покажува научениот трик!');return;
 }
 case 'llmDownload':{
   if(!root.TrialumAndroid?.downloadModel){ctx.toast('Преземањето е достапно само во Android.');return;}
   root.TrialumAndroid.downloadModel();ctx.toast('Почна преземање на мини моделот.');return;
 }
 case 'llmAsk':{
   const p=E.currentPet(s),prompt=(document.getElementById('llmPrompt')?.value||'').trim().slice(0,360);
   if(!miniGate(s,p).ok){ctx.toast('LLM бара Синапсо или повисок вид, лично ниво 22 и лабораторија 6.');return;}
   if(!root.TrialumAndroid?.askPet){ctx.toast('Локалниот LLM е достапен само во Android апликацијата.');return;}
    const modelState=root.TrialumAndroid?.modelStatus?.();
    if(modelState==='generating'){ctx.toast('Малиот LLM веќе создава одговор. Почекај пред разговор со следното милениче.');return;}
    if(modelState!=='installed'){ctx.toast('Прво преземи или доврши го локалниот мини модел.');return;}
   if(!prompt){ctx.toast('Внеси порака.');return;}
   if(root.TrialumLocalChat?.busy?.()){ctx.toast('Локалниот AI веќе размислува. Пробај по одговорот.');return;}
   const prior=Array.isArray(p.chatHistory)?p.chatHistory.slice(-4):[];
   // The 135M mini model can use a brief on-device history of recent turns.
   // Give yesterday's coarse theme memories priority over old literal turns.
   // Only the own pet's local JSON summary is consulted; no server transcript.
   const memory=root.TrialumPlaygroundMemory?.recall?.(p,prompt)||{requested:'recent',found:false,records:[]};
   const context=JSON.stringify({
    language:root.TrialumI18n?.language?.()||'mk',
    species:E.SPECIES[p.species]?.name||'',
    playground_memory:{requested:memory.requested,found:memory.found,records:memory.records.slice(-2)},
    history:prior.slice(-2).map(x=>({role:x.role==='pet'?'assistant':'user',text:String(x.text||'').slice(0,85)}))
   }).slice(0,700);
   if(root.TrialumLocalChat&&!root.TrialumLocalChat.begin(p.id)){
    ctx.toast('AI веќе создава одговор.');return;
   }
   p.chatHistory=Array.isArray(p.chatHistory)?p.chatHistory:[];
   p.chatHistory.push({role:'user',text:prompt});p.chatHistory=p.chatHistory.slice(-12);
   try{
    if(root.TrialumAndroid.askPetWithContext)
     root.TrialumAndroid.askPetWithContext(p.id,p.name,prompt,context);
    else root.TrialumAndroid.askPet(p.id,p.name,prompt);
   }catch(_){
    root.TrialumLocalChat?.finish?.(p.id);
    ctx.toast('Неуспешно стартување на локалниот LLM.');return;
   }
   ctx.scheduleSave();ctx.render();ctx.toast('Миленикот размислува локално…');return;
 }
 case 'debugToggle':result=E.debugToggle(s);break;
 case 'debugDays':result=E.debugAdvanceDays(s,Number(b.dataset.days));break;
 case 'debugResources':result=E.debugGrantResources(s);break;
 case 'debugPet':result=E.debugPetLevels(s,Number(b.dataset.levels));break;
 case 'longInvent':result=E.longplayInvent(s,b.dataset.kind);break;
 case 'longCraftMaterial':result=E.longplayBuildMaterial(s,b.dataset.material);break;
 case 'longHabUpgrade':result=E.longplayUpgradeHabitat(s,b.dataset.upgrade);break;
 case 'longTrain':{
  result=E.longplayTrain(s,s.selectedPet,b.dataset.skill);
  if(result?.ok){root.TrialumWorld?.playTrick(s.selectedPet,b.dataset.skill);root.TrialumPlayground?.trainingDemo(s,s.selectedPet,b.dataset.skill);}
  break;
 }
 case 'transformDNA':result=E.longplayTransform(s,s.selectedPet,Number(b.dataset.species));break;
 case 'longBoost':result=E.longplayBoost(s,b.dataset.boost,s.selectedPet);break;
 }
 ctx.notice(result,'grow');
 }
};
})(typeof globalThis!=='undefined'?globalThis:this);
