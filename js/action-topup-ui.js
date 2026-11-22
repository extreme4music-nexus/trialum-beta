/* TRIALUM v44 contextual action top-up UI. Does not replace legacy Settings/Free Credits. */
(function(root){
'use strict';
const E=root.TrialumEngine;
const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lab=new Set(['lab','study','craftFood','longInvent','longCraftMaterial','upgradeLab','unlockSpecies','transformDNA','agroSeed','agroCraft','editGenes']);
const pet=new Set(['petCare','petFeedPrepared','cognitiveAction','longTrain']);
const habitat=new Set(['habCare','plant','longHabUpgrade','agroTransplant']);
const garden=new Set(['agroPlant']);
const plantCare=new Set(['agroWater','agroTreat','agroRemove']);
let dialog=null,openScope=null,openId=null,world=null,callbacks=null;

function targetFor(s,b){
 if(!s||!b?.dataset)return null;
 const action=b.dataset.do;
 let scope=null,id=null;
 if(lab.has(action))scope='lab';
 else if(pet.has(action)){scope='pet';id=b.dataset.id||s.selectedPet;}
 else if(habitat.has(action)){
  scope='habitat';id=b.dataset.hab||s.activeHabitat;
 }else if(garden.has(action))scope='garden';
 else if(plantCare.has(action)){
  const found=E.findPlant?.(s,b.dataset.id);
  if(!found)return null;
  if(found.where==='garden')scope='garden';
  else {scope='habitat';id=found.habitat.id;}
 }
 if(!scope)return null;
 const info=E.actionRefillInfo?.(s,scope,id);
 if(!info?.ok)return null;
 return info;
}
// A disabled button may have other unlock requirements: do not use credits to hide those.
function unlockedFor(s,b){
 const action=b.dataset.do;
 if(action==='lab'&&b.dataset.kind==='grow'&&s.stage<2)return false;
 if(action==='study'&&((b.dataset.field==='cognition'&&s.research.level<3)||
   (b.dataset.field==='genomics'&&s.research.level<4)))return false;
 if(action==='craftFood'){
  const recipe=E.foodRecipes.find(x=>x.id===b.dataset.recipe);
  if(!recipe||s.research.level<recipe.tier)return false;
 }
 if(action==='petFeedPrepared'){
  const p=s.pets.find(p=>p.id===(b.dataset.id||s.selectedPet));
  if(!p)return false; // Existing food reserve and compatibility remain authoritative after refill.
 }
 if(action==='longTrain'){
  const p=E.currentPet(s),lv=p?E.evolutionProgress(p).level:0;
  const rules={wave:[3,1],spin:[8,3],leap:[15,4],symbols:[22,6],logic:[35,8],dialogue:[50,10]};
  const req=rules[b.dataset.skill];if(!p||!req||lv<req[0]||s.research.level<req[1])return false;
 }
 if(action==='cognitiveAction'){
  const p=E.currentPet(s),lv=p?E.evolutionProgress(p).level:0;
  const req={observe:[2,3],puzzle:[3,6],teach:[4,10],dialogue:[5,16]}[b.dataset.kind];
  if(!req||!p||s.research.level<req[0]||lv<req[1])return false;
 }
 if(action==='upgradeLab'&&!E.labRequirements(s,s.research.level+1)?.ok)return false;
 if(action==='plant'||action==='longHabUpgrade'||action==='transformDNA'||action==='unlockSpecies')
  return false; // These can be locked for reasons beyond action count; handled by gameplay checks.
 return true;
}
function depletedFor(s,b){
 const info=targetFor(s,b);
 return info?.ok&&info.current===0&&unlockedFor(s,b)?info:null;
}
function close(){
 if(dialog){try{dialog.close?.();}catch(_){}dialog.remove();}
 dialog=null;openScope=null;openId=null;world=null;callbacks=null;
}
function renderDialog(){
 if(!dialog||!world)return;
 const info=E.actionRefillInfo(world,openScope,openId);
 if(!info.ok){close();return;}
 const title=html(info.label);
 const amounts=[1,2,3,5,10,30].filter(n=>n<=info.room);
 dialog.innerHTML='<div class="action-refill-body">'+
  '<header class="action-refill-head"><h2>⚡ Restore actions</h2><button type="button" data-refill-close aria-label="Close">×</button></header>'+
  '<p class="small">For: <strong>'+title+'</strong></p>'+
  '<div class="action-refill-stats"><span>💠 Credits <b>'+info.credits+'</b></span><span>Actions <b>'+info.current+' / '+info.limit+'</b></span></div>'+
  '<p>One action costs <strong>1 in-game credit</strong>. Buy one or choose a pack; you will then retry your original action.</p>'+
  (amounts.length?'<div class="action-refill-packs">'+amounts.map(n=>
   '<button type="button" data-refill-qty="'+n+'"'+(n>info.credits?' disabled':'')+
   ' aria-label="Restore '+n+' actions for '+n+' credits">'+n+(n===1?' action':' actions')+
   '<small>💠 '+n+'</small></button>').join('')+'</div>':
   '<p class="small">This action allowance is already full.</p>')+
  (info.credits===0||!amounts.some(n=>n<=info.credits)?
   '<p class="action-refill-help">Not enough credits? Earn them by training pets, advancing evolution, discovering research and completing achievements. No cash purchase is required in this beta.</p>':'')+
  '<p id="actionRefillFeedback" class="small" role="status" aria-live="polite"></p>'+
  '<footer><button type="button" data-refill-close>Close</button></footer></div>';
}
function open(s,scope,id,ctx){
 const info=E.actionRefillInfo?.(s,scope,id);
 if(!info?.ok){ctx?.toast?.(info?.message||'Action refill unavailable.');return false;}
 close();world=s;openScope=scope;openId=id||null;callbacks=ctx||{};
 dialog=document.createElement('dialog');dialog.className='action-refill-modal';
 dialog.setAttribute('aria-label','Restore actions with credits');
 dialog.addEventListener('click',e=>{
  e.stopPropagation();
  if(e.target===dialog){close();return;}
  if(e.target.closest('[data-refill-close]')){close();return;}
  const button=e.target.closest('[data-refill-qty]');
  if(!button||button.disabled)return;
  const quantity=Number(button.dataset.refillQty);
  const result=E.buyActionsWithCredits(world,openScope,openId,quantity);
  if(result.ok){
   const cb=callbacks;
   close();
   cb.notice?.(result,'select'); // Commit and repaint use the same app save path as other gameplay.
  }else{
   renderDialog();
   const feedback=document.getElementById('actionRefillFeedback');
   if(feedback)feedback.textContent=result.message+
    (result.code==='insufficient_credits'?' Earn credits through training, research, evolution and achievements.':'');
  }
 });
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 document.body.appendChild(dialog);renderDialog();
 if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
 dialog.querySelector('[data-refill-close]')?.focus();
 return true;
}
function decorate(container,s){
 if(!container||!s)return;
 for(const button of container.querySelectorAll('button[data-do][disabled]')){
  const info=depletedFor(s,button);
  if(!info)continue;
  const parent=button.closest('.btn-line')||button.parentElement;
  if(!parent||parent.querySelector('[data-action-refill-trigger]'))continue;
  const topup=document.createElement('button');
  topup.type='button';topup.className='action-refill-trigger';
  topup.dataset.do='actionRefillOpen';topup.dataset.scope=info.scope;
  if(info.id)topup.dataset.id=info.id;
  topup.dataset.actionRefillTrigger='1';
  topup.textContent='⚡ Restore actions · 1 credit each';
  parent.appendChild(topup);
 }
}
root.TrialumActionTopUp={open,close,decorate,depletedFor,targetFor};
})(typeof globalThis!=='undefined'?globalThis:this);
