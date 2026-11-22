/* Versioned, device-local consent gates. No consent record is sent to Trialum. */
(function(root){
'use strict';
const TERMS_KEY='trialum.terms.accepted.v39';
const SOCIAL_KEY='trialum.social.consent.v39';
const termsAccepted=()=>{try{const value=JSON.parse(localStorage.getItem(TERMS_KEY)||'null');return value?.version===39&&typeof value?.acceptedAt==='string';}catch(_){return false;}};
const socialAccepted=()=>{try{return localStorage.getItem(SOCIAL_KEY)==='accepted';}catch(_){return false;}};
function save(key,value){try{localStorage.setItem(key,value);return true;}catch(_){return false;}}
function showTerms(readOnly=false){
 if(!readOnly&&termsAccepted())return Promise.resolve(true);
 return new Promise(resolve=>{
  const overlay=document.createElement('div');overlay.className='legal-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','legalTitle');
  overlay.innerHTML='<section class="legal-card"><p class="microcap">TRIALUM · BETA 1.0 · VERSION 39</p><h2 id="legalTitle">Услови за користење / User Agreement</h2><p>'+(readOnly?'Целосниот договор за Trialum Beta 1.0, versionCode 39.':'Прочитај го целиот договор. За да продолжиш, мора изречно да се согласиш. Овој избор се чува само на овој уред.')+'</p><iframe class="legal-document" title="Целосен User Agreement за Trialum" src="assets/user-agreement-v39.html"></iframe>'+(readOnly?'<div class="btn-line"><button id="legalClose" class="primary">Затвори</button></div>':'<label class="legal-check"><input id="legalAgreeCheck" type="checkbox"><span>Прочитав и се согласувам со целосниот User Agreement за Trialum v39. / I have read and agree to the full Trialum v39 User Agreement.</span></label><p id="legalDeclined" class="notice" hidden>Без согласност играта не може да продолжи. Затвори ја апликацијата со системското Back копче или прегледај го договорот и одлучи повторно.</p><div class="btn-line"><button id="legalDecline">Не се согласувам</button><button id="legalAccept" class="primary" disabled>Се согласувам и продолжувам / I agree and continue</button></div><p class="small subtle">Согласноста се снима локално како верзија и време на прифаќање. Не се испраќа до Trialum серверот или Google. Ако не се согласуваш, не користи ја апликацијата.</p>')+'</section>';
  document.body.appendChild(overlay);
  if(readOnly){overlay.querySelector('#legalClose').addEventListener('click',()=>{overlay.remove();resolve(true);});return;}
  const check=overlay.querySelector('#legalAgreeCheck'),accept=overlay.querySelector('#legalAccept');
  check.addEventListener('change',()=>{accept.disabled=!check.checked;});
  overlay.querySelector('#legalDecline').addEventListener('click',()=>{overlay.querySelector('#legalDeclined').hidden=false;check.checked=false;accept.disabled=true;});
  accept.addEventListener('click',()=>{if(!check.checked||!save(TERMS_KEY,JSON.stringify({version:39,acceptedAt:new Date().toISOString()}))){overlay.querySelector('#legalDeclined').textContent='Не можам безбедно да ја зачувам согласноста на овој уред. Провери го просторот за складирање и обиди се повторно.';overlay.querySelector('#legalDeclined').hidden=false;return;}overlay.remove();resolve(true);});
  check.focus();
 });
}
function requireTerms(){return showTerms(false);}
root.TrialumLegal={requireTerms,openTerms:()=>showTerms(true),termsAccepted,socialAccepted,
 grantSocialConsent(){return save(SOCIAL_KEY,'accepted');},
 revokeSocialConsent(){try{localStorage.removeItem(SOCIAL_KEY);return true;}catch(_){return false;}}
};
})(typeof globalThis!=='undefined'?globalThis:this);
