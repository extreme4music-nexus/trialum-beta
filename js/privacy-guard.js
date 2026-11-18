/* Local privacy check for outgoing social text. Heuristic only: it blocks
 * common contact details and explicit real-identity disclosures, and flags
 * personal-data requests for an additional user confirmation. It cannot
 * reliably recognize every real name or every language. */
(function(root){
'use strict';
const contactPatterns=[
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(?:https?:\/\/|www\.)\S+/i,
  /(?:^|\D)(?:\+?\d[\s().-]*){9,}(?=\D|$)/
];
const identityDisclosure=/(?:\bmy\s+(?:real|full)\s+name\s+is\b|\bmy\s+name\s+is\b|\bмоето\s+(?:вистинско\s+)?име\s+е\b|\bјас\s+се\s+викам\b|\bmoeto\s+(?:vistinsko\s+)?ime\s+e\b|\bjas\s+se\s+vikam\b)/iu;
const personalRequest=/(?:\b(?:what(?:'s|\s+is)\s+your\s+(?:real\s+|full\s+)?name|tell\s+me\s+your\s+(?:real\s+|full\s+)?name|where\s+do\s+you\s+live|what(?:'s|\s+is)\s+your\s+(?:address|phone|email|school)|share\s+your\s+location|send\s+me\s+your\s+password)\b|(?:како\s+се\s+викаш|кое\s+е\s+твоето\s+име|каде\s+живееш|која\s+е\s+твојата\s+адреса|твојот\s+телефон|твојата\s+е-пошта|кое\s+училиште|кажи\s+ми\s+ја\s+лозинката|kako\s+se\s+vikash|kade\s+ziveesh|koja\s+e\s+tvojata\s+adresa|tvojot\s+telefon|koe\s+ucilishte))/iu;
function inspect(value){
 const text=String(value??'').trim();
 if(!text)return {blocked:false,requiresConfirmation:false};
 if(contactPatterns.some(pattern=>pattern.test(text))||identityDisclosure.test(text))
  return {blocked:true,reason:'personal_data_blocked'};
 if(personalRequest.test(text))return {blocked:false,requiresConfirmation:true,reason:'personal_data_request'};
 return {blocked:false,requiresConfirmation:false};
}
root.TrialumPrivacyGuard={inspect};
if(typeof module==='object'&&module.exports)module.exports={inspect};
})(typeof globalThis!=='undefined'?globalThis:this);
