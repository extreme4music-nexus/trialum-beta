/* TRIALUM v44 day-pass HUD: package purchase, separate deliberate redemption. */
(function(root){
'use strict';
const E=root.TrialumEngine;
let dialog=null,world=null,ctx=null;
const mk=()=>root.TrialumI18n?.language?.()==='mk';
const t=(en,mkText)=>mk()?mkText:en;
function close(){
 if(dialog){try{dialog.close?.();}catch(_){}dialog.remove();}
 dialog=null;world=null;ctx=null;
}
function render(){
 if(!dialog||!world)return;
 const state=E.dayPassInfo?.(world);
 if(!state?.ok){close();return;}
 const choices=[1,2,3,7,14,30].filter(n=>n<=state.available);
 const rows=state.packages.map(p=>{
  const base=50*p.days,discount=Math.round((1-p.credits/base)*100);
  return '<button type="button" data-day-pack="'+p.days+'"'+
   (state.credits<p.credits||state.available+p.days>365?' disabled':'')+'>'+
   '<strong>'+p.days+' '+t('days','дена')+'</strong><span>💠 '+p.credits+'</span>'+
   (discount?'<small>−'+discount+'%</small>':'<small>'+t('standard price','основна цена')+'</small>')+'</button>';
 }).join('');
 dialog.innerHTML='<div class="day-pass-body">'+
  '<header class="action-refill-head"><h2>📅 '+t('Game day passes','Купони за денови')+'</h2>'+
  '<button type="button" data-day-close aria-label="Close">×</button></header>'+
  '<div class="action-refill-stats"><span>💠 '+t('Credits','Кредити')+' <b>'+state.credits+'</b></span>'+
  '<span>🎟️ '+t('Saved passes','Зачувани купони')+' <b>'+state.available+'</b></span></div>'+
  '<p>'+t('Buy a pack now and skip days whenever you choose. No package is used automatically.','Купи пакет сега и користи ги деновите кога сакаш. Пакетот не се троши автоматски.')+'</p>'+
  '<h3>'+t('Buy day passes','Купи купони за денови')+'</h3><div class="day-pass-pack-grid">'+rows+'</div>'+
  '<h3>'+t('Use saved day passes','Искористи зачувани купони')+'</h3>'+
  '<p class="day-pass-warning">⚠️ '+t(
   'Skipping a day runs the full ecosystem simulation. Plants may lose water or health and die; pets may become hungry or unhappy; habitats can accumulate toxins or lose cleanliness. Review your world before continuing.',
   'Прескокнувањето го извршува целиот дневен екосистем. Растенијата може да дехидрираат, да се разболат или да угинат; миленичињата може да огладнат, а биосветовите да се загадат. Провери ја состојбата пред да продолжиш.')+'</p>'+
  (choices.length?'<div class="day-pass-use-grid">'+choices.map(n=>'<button type="button" data-day-use="'+n+'">'+t('Skip','Прескокни')+' '+n+' '+t(n===1?'day':'days',n===1?'ден':'дена')+'</button>').join('')+'</div>':
    '<p class="small">'+t('No day passes owned. Purchase a package first.','Немаш зачувани купони. Прво купи пакет.')+'</p>')+
  (state.credits<50?'<p class="action-refill-help">'+t(
   'Need credits? Earn them through pet training, research, evolution and achievements.',
   'Ти требаат кредити? Заработувај ги преку тренинг, истражување, еволуција и постигнувања.')+'</p>':'')+
  '<p class="small" id="dayPassFeedback" role="status" aria-live="polite"></p>'+
  '<footer><button type="button" data-day-close>'+t('Close','Затвори')+'</button></footer></div>';
}
function open(s,callbacks){
 const info=E.dayPassInfo?.(s);
 if(!info?.ok){callbacks?.toast?.(info?.message||'Day pass unavailable.');return false;}
 close();world=s;ctx=callbacks||{};
 dialog=document.createElement('dialog');dialog.className='action-refill-modal day-pass-modal';
 dialog.setAttribute('aria-label','Day skip purchases and saved passes');
 dialog.addEventListener('click',event=>{
  event.stopPropagation();
  if(event.target===dialog){close();return;}
  if(event.target.closest('[data-day-close]')){close();return;}
  const pack=event.target.closest('[data-day-pack]');
  const use=event.target.closest('[data-day-use]');
  if(pack&&!pack.disabled){
   const result=E.buyDayPassPack(world,Number(pack.dataset.dayPack));
   if(result.ok){ctx.notice?.(result,'select');render();}
   else{render();const f=dialog?.querySelector('#dayPassFeedback');if(f)f.textContent=result.message;}
  }
  if(use&&!use.disabled){
   const days=Number(use.dataset.dayUse);
   const warning=t(
    'Skip '+days+' day(s)? Plants and pets may suffer, plants may die, and habitat resources can decline. All simulated consequences will be applied.',
    'Да прескокнам '+days+' ден(а)? Растенијата и миленичињата може да страдаат, растенија може да угинат, а ресурсите на биосветот да се влошат. Сите последици ќе се применат.');
   if(!root.confirm?.(warning))return;
   const result=E.redeemDayPass(world,days);
   if(result.ok){ctx.notice?.(result,'day');render();}
   else{render();const f=dialog?.querySelector('#dayPassFeedback');if(f)f.textContent=result.message;}
  }
 });
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 document.body.appendChild(dialog);render();
 if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
 dialog.querySelector('[data-day-close]')?.focus();
 return true;
}
root.TrialumDayPassUI={open,close};
})(typeof globalThis!=='undefined'?globalThis:this);
