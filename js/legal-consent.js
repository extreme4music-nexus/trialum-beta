/* Versioned, device-local consent gates. No consent record is sent to Trialum. */
(function(root){
'use strict';
const TERMS_KEY='trialum.terms.accepted.v40';
const SOCIAL_KEY='trialum.social.consent.v39';
const AGREEMENT_VERSION=40;
const accepted=()=>{try{const value=JSON.parse(localStorage.getItem(TERMS_KEY)||'null');return value?.version===AGREEMENT_VERSION&&typeof value?.acceptedAt==='string';}catch(_){return false;}};
const socialAccepted=()=>{try{return localStorage.getItem(SOCIAL_KEY)==='accepted';}catch(_){return false;}};
function save(key,value){try{localStorage.setItem(key,value);return true;}catch(_){return false;}}
function tr(text){return root.TrialumI18n?.t?.(text)??text;}
function agreementAsset(){const language=root.TrialumI18n?.language?.()||'en';return language==='en'?'assets/user-agreement-v40.html':'assets/user-agreement-v40-'+language+'.html';}
function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
async function showTerms(readOnly=false){
 if(!readOnly&&accepted())return true;
 if(!readOnly)await root.TrialumI18n?.change?.('auto');
 return new Promise(resolve=>{
  const overlay=element('div','legal-overlay');overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','legalTitle');
  const card=element('section','legal-card');
  card.append(element('p','microcap','TRIALUM · BETA 1.0 · VERSION 40'));
  const title=element('h2','',tr('Услови за користење'));title.id='legalTitle';card.append(title);
  card.append(element('p','',tr(readOnly?'Целосниот договор за Trialum Beta 1.0, versionCode 40.':'Прочитај го целиот договор. За да продолжиш, мора изречно да се согласиш. Овој избор се чува само на овој уред.')));
  const iframe=element('iframe','legal-document');iframe.title=tr('Целосен User Agreement за Trialum');iframe.src=agreementAsset();card.append(iframe);
  if(readOnly){const row=element('div','btn-line');const close=element('button','primary',tr('Затвори'));close.id='legalClose';close.addEventListener('click',()=>{overlay.remove();resolve(true);});row.append(close);card.append(row);}
  else{
   const label=element('label','legal-check');const check=element('input');check.type='checkbox';check.id='legalAgreeCheck';const labelText=element('span','',tr('Прочитав и се согласувам со целосниот User Agreement за Trialum v40.'));label.append(check,labelText);card.append(label);
   const declined=element('p','notice',tr('Без согласност играта не може да продолжи. Затвори ја апликацијата со системското Back копче или прегледај го договорот и одлучи повторно.'));declined.id='legalDeclined';declined.hidden=true;card.append(declined);
   const row=element('div','btn-line');const refuse=element('button','',tr('Не се согласувам'));refuse.id='legalDecline';const accept=element('button','primary',tr('Се согласувам и продолжувам'));accept.id='legalAccept';accept.disabled=true;row.append(refuse,accept);card.append(row);
   const local=element('p','small subtle',tr('Согласноста се снима локално како верзија и време на прифаќање. Не се испраќа до Trialum серверот или Google.')+' '+tr('Ако не се согласуваш, не користи ја апликацијата.'));card.append(local);
   check.addEventListener('change',()=>{accept.disabled=!check.checked;});
   refuse.addEventListener('click',()=>{declined.hidden=false;check.checked=false;accept.disabled=true;});
   accept.addEventListener('click',()=>{if(!check.checked||!save(TERMS_KEY,JSON.stringify({version:AGREEMENT_VERSION,acceptedAt:new Date().toISOString()}))){declined.textContent=tr('Не можам безбедно да ја зачувам согласноста на овој уред. Провери го просторот за складирање и обиди се повторно.');declined.hidden=false;return;}overlay.remove();resolve(true);});
   check.focus();
  }
  overlay.append(card);document.body.append(overlay);
 });
}
function requireTerms(){return showTerms(false);}
root.TrialumLegal={requireTerms,openTerms:()=>showTerms(true),termsAccepted:accepted,socialAccepted,
 grantSocialConsent(){return save(SOCIAL_KEY,'accepted');},
 revokeSocialConsent(){try{localStorage.removeItem(SOCIAL_KEY);return true;}catch(_){return false;}}
};
})(typeof globalThis!=='undefined'?globalThis:this);
