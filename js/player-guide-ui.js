/* TRIALUM v44 — context-aware bilingual offline guide UX. */
(function(root){
'use strict';
const G=root.TrialumPlayerGuide,E=root.TrialumEngine;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let dialog=null,world=null,callbacks=null,screen='lab',chosen=null,query='';
const lang=()=>root.TrialumI18n?.language?.()==='mk'?'mk':'en';
const t=(en,mk)=>lang()==='mk'?mk:en;
function close(){if(dialog){try{dialog.close?.();}catch(_){}dialog.remove();}dialog=null;world=null;callbacks=null;chosen=null;query='';}
function render(){
 if(!dialog||!world)return;
 const l=lang(),hints=G.hints(world,screen,world.selectedPet,l);
 const topics=G.all(l),section=G.entry(chosen||'routine',l);
 const results=query?G.match(query,{lang:l,limit:5}):[];
 dialog.innerHTML='<div class="guide-body">'+
  '<header class="action-refill-head"><h2>📖 '+t('Player Guide & What Next?','Водич и што следно?')+'</h2>'+
  '<button type="button" data-guide-close aria-label="Close">×</button></header>'+
  '<p class="guide-version">Trialum '+G.VERSION+' · '+t('Offline; available to every pet assistant','Офлајн; достапно и за секој асистент на миленичињата')+'</p>'+
  '<section class="guide-next"><h3>🎯 '+t('Recommended for your world now','Препорачано за твојот свет сега')+'</h3>'+
  hints.map(x=>'<button type="button" data-guide-go="'+esc(x.route)+'">'+esc(x.text)+' <span>›</span></button>').join('')+'</section>'+
  '<label for="guideSearch">'+t('Find help by topic','Пребарај по тема')+'</label>'+
  '<input id="guideSearch" type="search" autocomplete="off" maxlength="100" placeholder="'+
   t('food, credits, plants, research…','храна, кредити, растенија, истражување…')+
   '" value="'+esc(query)+'">'+
  (query?'<div class="guide-search-results">'+(results.length?results.map(x=>
   '<button type="button" data-guide-topic="'+esc(x.id)+'">'+esc(x.title)+'</button>').join(''):
   '<p class="small">'+t('No matching topic. Try a simpler word.','Нема таква тема. Пробај со пократок збор.')+'</p>')+'</div>':'')+
  '<label for="guideTopic">'+t('Complete guide topics','Целосен водич по теми')+'</label>'+
  '<select id="guideTopic">'+topics.map(x=>'<option value="'+esc(x.id)+'"'+(x.id===section.id?' selected':'')+'>'+esc(x.title)+'</option>').join('')+'</select>'+
  '<article class="guide-detail"><h3>'+esc(section.title)+'</h3><p>'+esc(section.summary)+'</p>'+
  '<ol>'+section.steps.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ol>'+
  '<button type="button" data-guide-go="'+esc(section.route)+'">'+t('Go to this feature','Отвори ја оваа секција')+'</button></article>'+
  '<footer><button type="button" data-guide-full>'+t('Read the full offline guide','Прочитај го целиот офлајн водич')+'</button>'+
  '<button type="button" data-guide-close>'+t('Close','Затвори')+'</button></footer></div>';
}
function open(s,activeScreen,ctx){
 if(!s)return false;
 close();world=s;screen=activeScreen||'lab';callbacks=ctx||{};
 dialog=document.createElement('dialog');dialog.className='action-refill-modal guide-modal';
 dialog.setAttribute('aria-label','Interactive complete player guide');
 dialog.addEventListener('click',e=>{
  e.stopPropagation();
  if(e.target===dialog||e.target.closest('[data-guide-close]')){close();return;}
  const go=e.target.closest('[data-guide-go]');
  if(go){const dest=go.dataset.guideGo,fn=callbacks?.chooseTab;close();fn?.(dest);return;}
  const topic=e.target.closest('[data-guide-topic]');
  if(topic){chosen=topic.dataset.guideTopic;query='';render();return;}
  if(e.target.closest('[data-guide-full]')){
   dialog.innerHTML='<div class="guide-full">'+
    '<header class="action-refill-head"><h2>'+t('Complete Player Guide','Целосен водич')+'</h2><button data-guide-close>×</button></header>'+
    '<iframe title="Offline Trialum Player Guide" src="assets/player-guide-v44-'+lang()+'.html"></iframe>'+
    '<button data-guide-back>'+t('Back to interactive help','Назад кон интерактивна помош')+'</button></div>';
   return;
  }
  if(e.target.closest('[data-guide-back]')){render();return;}
 });
 dialog.addEventListener('change',e=>{if(e.target?.id==='guideTopic'){chosen=e.target.value;render();}});
 dialog.addEventListener('input',e=>{
  if(e.target?.id!=='guideSearch')return;
  query=e.target.value.slice(0,100);
  // Preserve keyboard entry and cursor by refreshing ONLY search result panel.
  const panel=dialog.querySelector('.guide-search-results');
  const matches=G.match(query,{lang:lang(),limit:5});
  const fragment=query?(matches.length?matches.map(x=>
   '<button type="button" data-guide-topic="'+esc(x.id)+'">'+esc(x.title)+'</button>').join(''):
   '<p class="small">'+t('No matching topic.','Нема таква тема.')+'</p>'):'';
  if(panel)panel.innerHTML=fragment;
  else if(fragment){const wrapper=document.createElement('div');wrapper.className='guide-search-results';
   wrapper.innerHTML=fragment;e.target.insertAdjacentElement('afterend',wrapper);}
 });
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 document.body.appendChild(dialog);render();
 if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
 dialog.querySelector('[data-guide-close]')?.focus();return true;
}
root.TrialumGuideUI={open,close};
})(typeof globalThis!=='undefined'?globalThis:this);
