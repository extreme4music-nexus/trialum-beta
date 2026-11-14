/* TRIALUM 1.5.5 — skippable welcome story and replayable guided tutorial.
   No game rewards, progression mutations, or personal data in these dialogs. */
(function(root){
'use strict';
const KEY_INTRO='trialum_intro_seen_v155',KEY_GUIDE='trialum_tutorial_seen_v155';
const story=[
 ['✺','Добредојде во ТРИАЛУМ','Welcome to TRIALUM','Од неживи атоми ќе создаваш свој непознат жив свет. Нема брза победа — играта се развива со тебе.','Build a living universe from lifeless atoms. There is no rush to win: this world evolves with you.'],
 ['🌱','Една искра — многу генерации','One spark, many generations','Твоите организми ќе учат, растат и ќе се преобразуваат. Светот напредува низ денови, месеци и години.','Your creatures learn, grow and transform. The world advances through days, months and years.'],
 ['🛡️','Твојот свет, твоите правила','Your world, your choice','Играј офлајн. Сите AI модели и Google облачни функции се изборни. Извези JSON бекап за да го заштитиш напредокот.','Play offline. AI models and Google cloud features are optional. Export a JSON backup to protect your progress.']
];
const guide=[
 ['🧪','Започни со Лабораторија','Start in the Laboratory','Создавај молекули, собирај сознание и следи ги условите за следната фаза. Првите промени се случуваат по неколку минути.','Make molecules, gather insight and follow the requirements for the next stage. Early evolution takes minutes.'],
 ['🏝️','Изгради го првиот биосвет','Build your first habitat','Следи ги петте градежни чекори, одржувај ги хемиските параметри и засади флора.','Follow the five construction stages, keep the chemistry balanced and grow flora.'],
 ['🐾','Негувај ги милениците','Care for your creatures','Нахрани, играј и тренирај. Секој миленик има своја возраст, вештини, потреби и еволуција.','Feed, play and train. Each pet has its own age, skills, needs and evolution.'],
 ['🔬','Истражувај и отклучувај','Research and unlock','Нови видови и ДНК-преобразби бараат научни сознанија, време и постигнати нивоа. Ништо не мора да се купува.','New species and DNA transformations require research, time and earned levels. Purchases are not required.'],
 ['⚙️','Подеси го својот свет','Make it yours','Во Поставки избери јазик и светла/темна тема, вклучи звук, повтори го туторијалот и направи JSON бекап.','In Settings choose a language and light/dark theme, adjust sound, replay this tutorial and export a JSON backup.']
];
let overlay,active=null,position=0,previous=null;
const i18n=()=>root.TrialumI18n;
function useLang(mk,en){const code=i18n()?.language?.();if(code==='mk')return mk;if(code==='en')return en;const translated=i18n()?.t(mk);return translated&&translated!==mk?translated:en;}
function seen(key){try{return root.localStorage?.getItem(key)==='1'}catch(_){return false}}
function remember(key){try{root.localStorage?.setItem(key,'1')}catch(_){}}
function ensure(){
 if(overlay||!root.document)return;
 overlay=root.document.createElement('div');
 overlay.id='trialumOnboarding';
 overlay.className='onboarding-overlay';
 overlay.hidden=true;
 overlay.innerHTML='<section class="onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboardingTitle" aria-describedby="onboardingText"><div id="onboardingSymbol" class="onboarding-symbol" aria-hidden="true"></div><p id="onboardingCount" class="microcap"></p><h2 id="onboardingTitle"></h2><p id="onboardingText"></p><nav class="onboarding-actions"><button type="button" data-tour="skip" id="onboardingSkip"></button><button type="button" data-tour="back" id="onboardingBack"></button><button type="button" class="primary" data-tour="next" id="onboardingNext"></button></nav></section>';
 root.document.body.appendChild(overlay);
 overlay.addEventListener('click',event=>{
   const action=event.target.closest('[data-tour]')?.dataset.tour;
   if(action==='skip')close();
   else if(action==='back'){position=Math.max(0,position-1);render();}
   else if(action==='next'){if(position>=steps().length-1)close();else{position++;render();}}
 });
 root.document.addEventListener('keydown',event=>{
  if(overlay?.hidden)return;
  if(event.key==='Escape'){event.preventDefault();close();}
  else if(event.key==='ArrowRight'){event.preventDefault();position=Math.min(steps().length-1,position+1);render();}
  else if(event.key==='ArrowLeft'){event.preventDefault();position=Math.max(0,position-1);render();}
 });
}
function steps(){return active==='intro'?story:guide;}
function render(){
 if(!active||!overlay)return;
 const data=steps(),item=data[position];
 overlay.querySelector('#onboardingSymbol').textContent=item[0];
 overlay.querySelector('#onboardingCount').textContent=(active==='intro'?useLang('Вовед','Introduction'):useLang('Туторијал','Tutorial'))+' · '+(position+1)+' / '+data.length;
 overlay.querySelector('#onboardingTitle').textContent=useLang(item[1],item[2]);
 overlay.querySelector('#onboardingText').textContent=useLang(item[3],item[4]);
 overlay.querySelector('#onboardingSkip').textContent=useLang('Прескокни','Skip');
 overlay.querySelector('#onboardingBack').textContent=useLang('Назад','Back');
 overlay.querySelector('#onboardingBack').disabled=position===0;
 overlay.querySelector('#onboardingNext').textContent=position===data.length-1?useLang('Заврши','Finish'):useLang('Следно','Next');
 overlay.querySelector('#onboardingNext').focus();
}
function open(type='intro'){
 if(type!=='intro'&&type!=='tutorial')return false;
 ensure();if(!overlay)return false;
 previous=root.document.activeElement;active=type;position=0;overlay.hidden=false;
 render();return true;
}
function close(){
 if(!active)return;
 remember(active==='intro'?KEY_INTRO:KEY_GUIDE);
 active=null;overlay.hidden=true;
 previous?.focus?.();previous=null;
}
function maybeIntro(){if(!seen(KEY_INTRO))return open('intro');return false;}
function maybeTutorial(){if(!seen(KEY_GUIDE))return open('tutorial');return false;}
root.TrialumOnboarding={open,close,maybeIntro,maybeTutorial,state:()=>({active,position,introSeen:seen(KEY_INTRO),tutorialSeen:seen(KEY_GUIDE)})};
})(typeof globalThis!=='undefined'?globalThis:this);
