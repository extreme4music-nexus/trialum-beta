/* TRIALUM 1.3 additional UI, detached from the main game controller. */
(function(root){
'use strict';
const E=root.TrialumEngine;
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt=n=>Math.floor(Number(n)||0).toLocaleString('mk-MK');
const btn=(text,action,attr='',disabled=false)=>'<button data-do="'+action+'" '+attr+(disabled?' disabled':'')+'>'+text+'</button>';
function research(s){
 const r=E.ensureResearch(s),next=E.researchTiers[r.level],req=next?E.labRequirements(s,next.level):null,p=E.currentPet(s),lv=p?E.evolutionProgress(p).level:0;
 const discipline=E.researchFields.map(f=>'<div class="card"><h3>'+f.icon+' '+esc(f.name)+'</h3><p>Истражувачки поени: <b>'+fmt(r.fields[f.id])+'</b></p>'+btn('🔬 Истражувај','study','data-field="'+f.id+'"',s.labActions<1)+'</div>').join('');
 const needs=req?'<h3>🔓 Наредна лабораторија: '+esc(next.name)+'</h3><div class="lab-requirements">'+req.items.map(a=>'<div class="goal '+(a.ok?'done':'')+'">'+(a.ok?'✓':'○')+' '+esc(a.label)+' <span>'+esc(a.value)+'</span></div>').join('')+'</div>'+btn('⬆ Надгради лабораторија','upgradeLab','class="primary"',!req.ok):'<p class="notice">✨ Отклучено е највисокото лабораториско ниво!</p>';
 const species=E.SPECIES.map((sp,i)=>({sp,i})).filter(x=>x.sp.labTier).map(({sp,i})=>'<div class="card"><h3>'+sp.icon+' '+esc(sp.name)+'</h3><p>'+esc(sp.description)+'</p><p class="price">Ниво '+sp.labTier+' · 18 сознание + 12 молекули</p>'+btn(s.blueprints.includes('species-'+i)?'✓ Отклучено':'🧬 Отклучи вид','unlockSpecies','data-species="'+i+'"',s.blueprints.includes('species-'+i)||r.level<sp.labTier)+'</div>').join('');
 const cognit=[['observe','👁 Набљудувај',2,3],['puzzle','🧩 Загатка',3,6],['teach','📖 Учи симболи',4,10],['dialogue','💬 Разговор',5,16]].map(([id,title,tier,min])=>btn(title,'cognitiveAction','data-kind="'+id+'"',!p||s.research.level<tier||lv<min||p.actionsLeft<1)).join('');
 return '<div class="tab-main"><h2>🏛️ Истражувачки институт · Ниво '+r.level+'/6</h2><p class="desc">Преминување на повисоки нивоа бара стекнати знаења, денови, развиени миленици и контролирана биохемиска средина. Нема прескокнување.</p><div class="notice"><b>'+esc(E.researchTiers[r.level-1].name)+'</b> · Знаење '+fmt(r.knowledge)+' · Акции '+s.labActions+'/'+E.labActionLimit(s)+'</div><h3>Истражувачки области</h3><div class="cards">'+discipline+'</div>'+needs+'<h3>✨ Нови суштества</h3><div class="cards">'+species+'</div><h3>🧠 Комуникација и когниција</h3><p class="desc">Избери суштество во аквариумот. Секоја активност троши една негова лична дневна акција, а учењето гради сопствен симболички речник.</p><div class="btn-line">'+cognit+'</div></div>';
}
function food(s){
 const r=E.ensureResearch(s),p=E.currentPet(s),sp=p&&E.SPECIES[p.species];
 const cards=E.foodRecipes.map(f=>{
 const locked=r.level<f.tier,stock=s.foodFactory.stock[f.id]||0,good=p&&E.feedCompatible(sp,f,p);
 return '<div class="card"><h3>'+f.icon+' '+esc(f.name)+'</h3><p>'+esc(f.desc)+'</p><p class="price">Лабораторија '+f.tier+' · Порции '+stock+' · Цена: '+f.cost.biomass+' биомаса и '+f.cost.compounds+' молекули</p><div class="btn-line">'+btn('⚗️ Создај '+f.yield+' порции','craftFood','data-recipe="'+f.id+'"',locked||s.labActions<1)+btn('🍽️ Нахрани','feedFood','data-recipe="'+f.id+'"',!good||!stock||p.actionsLeft<1)+'</div><p class="small">'+(good?'✅ Оваа формула одговара':'🔒 Специјализирана за друга група')+'</p></div>';
 }).join('');
 return '<div class="tab-main"><h2>🍱 Нутритивна лабораторија</h2><p class="desc">Храната се произведува посебно. Универзалните порции одговараат на сите; специјалните даваат подобра исхрана и еволутивен бонус за точно определени групи.</p><div class="notice">Миленик: '+(p?esc(p.name)+' · '+p.actionsLeft+'/'+E.petActionLimit(s)+' акции':'нема избрано')+' · Лабораториски акции '+s.labActions+'</div><div class="cards">'+cards+'</div></div>';
}
function dna(s){
 const r=E.ensureResearch(s),p=E.currentPet(s),lv=p?E.evolutionProgress(p).level:0,ok=r.level>=6&&lv>=22;
 return '<div class="tab-main"><h2>🧬 ДНК-архитектура</h2><p class="desc">Само фантастични визуелни гени. Нема вистинска ДНК, биолошки процедури или промени на живи организми.</p><p class="notice">'+(ok?'✅ Дизајнерот е отклучен':'🔒 Потребни се лабораторија ниво 6 и избран миленик ниво 22.')+' · Цена: 25 молекули + 15 сознание + една лабораториска акција.</p>'+
 (p?'<h3>'+esc(p.name)+'</h3><div class="dna-form"><label for="dnaHue">Боја на суштеството</label><input type="range" min="0" max="359" id="dnaHue" value="'+Math.round(p.hue)+'"><label for="dnaEyes">Број очи</label><select id="dnaEyes">'+[1,2,3,4,5].map(n=>'<option value="'+n+'"'+(p.eyes===n?' selected':'')+'>'+n+'</option>').join('')+'</select><label for="dnaShape">Форма на тело</label><select id="dnaShape">'+[['jelly','Течна'],['crystal','Кристална'],['leaf','Лисна'],['cloud','Облачна']].map(x=>'<option value="'+x[0]+'"'+(p.shape===x[0]?' selected':'')+'>'+x[1]+'</option>').join('')+'</select>'+btn('🧬 Примени уникатен геном','dnaEdit','class="primary"',!ok||s.labActions<1)+'</div>'+(p.genome?'<p class="small">Генетски потпис: '+esc(p.genome.signature)+'</p>':''):'<p>Избери милениче за дизајн.</p>')+'</div>';
}
function gallery(s){
 const a=E.achievementList(s).earned;
 return '<div class="tab-main"><h2>📸 Галерија и постигнувања</h2><p class="desc">Сликите се создаваат локално во PNG. За споделување на други апликации потребно е да го допреш копчето. Ништо не се испраќа автоматски.</p><div class="btn-line">'+btn('📷 Зачувај PNG','saveScreenshot','class="primary"')+btn('📤 Сподели биосвет','shareScreenshot')+'</div><h3>🏆 Отклучени постигнувања ('+a.length+')</h3><div class="cards">'+(a.length?a.slice().reverse().map(x=>'<div class="card"><h3>🏆 '+esc(x.title)+'</h3><p>'+esc(x.description)+'</p><p class="price">Ден '+fmt(x.day)+'</p>'+btn('📤 Сподели','shareAchievement','data-achievement="'+esc(x.id)+'"')+'</div>').join(''):'<div class="card">Нема постигнувања. Продолжи да истражуваш!</div>')+'</div></div>';
}
const pages={research,food,dna,achievements:gallery};
const actions=new Set(['study','upgradeLab','unlockSpecies','craftFood','feedFood','cognitiveAction','dnaEdit','saveScreenshot','shareScreenshot','shareAchievement']);
function handle(action,b,s,ctx){
 let r=null,sfx='grow';
 switch(action){
 case 'study':r=E.study(s,b.dataset.field);break;
 case 'upgradeLab':r=E.upgradeLab(s);sfx='build';break;
 case 'unlockSpecies':r=E.unlockSpecies(s,Number(b.dataset.species));break;
 case 'craftFood':r=E.craftFood(s,b.dataset.recipe);break;
 case 'feedFood':r=E.feedPrepared(s,s.selectedPet,b.dataset.recipe);sfx='feed';break;
 case 'cognitiveAction':r=E.cognitiveAction(s,s.selectedPet,b.dataset.kind);sfx='select';break;
 case 'dnaEdit':r=E.editFictionalGenes(s,s.selectedPet,{hue:Number(document.getElementById('dnaHue')?.value),eyes:Number(document.getElementById('dnaEyes')?.value),shape:document.getElementById('dnaShape')?.value});break;
 case 'saveScreenshot':root.TrialumMedia.open(s,{defaultAction:'save'});return;
 case 'shareScreenshot':root.TrialumMedia.open(s,{defaultAction:'share'});return;
 case 'shareAchievement':{const a=E.achievementList(s).earned.find(x=>x.id===b.dataset.achievement);root.TrialumMedia.open(s,{achievement:a,defaultAction:'share'});return;}
 }
 ctx.notice(r,sfx);
}
root.TrialumExpansion={render(page,s){const fn=pages[page];return fn?fn(s):null;},can:action=>actions.has(action),handle};
})(typeof globalThis!=='undefined'?globalThis:this);
