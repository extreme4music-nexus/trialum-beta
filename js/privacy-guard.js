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
// Model-generated shared speech is untrusted. Block rather than confirm.
const privateDisclosure=/(?:\b(?:my|our|your|their)\s+(?:owner|human|player|user|family|mother|father|parent|teacher|school|address|home|city|town|phone|number|email|password|secret|location|birthday|real\s+name)\b|\b(?:lives?\s+at|go(?:es)?\s+to\s+school|my\s+name\s+is|phone\s+number\s+is|secret\s+is|private\s+conversation|do\s+not\s+tell)\b|\b(?:iban|passport|api.?key|token|credential|pin\s+code)\b)/iu;
function inspectPetSpeech(value,pet){
 const line=String(value||'').trim();
 if(!line||line.length>160||!/[\p{L}]/u.test(line)||/[^\x20-\x7e]/.test(line))
  return {blocked:true,reason:'unsafe_pet_speech'};
 const base=inspect(line);
 if(base.blocked||base.requiresConfirmation||privateDisclosure.test(line)||
   /\b\d{3,}\b/.test(line))
  return {blocked:true,reason:'private_pet_speech'};
 // Identical three-word phrases taken from private user messages cannot be
 // relayed, even if a local model disregarded its scoped context.
 const normalize=t=>String(t||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
 const normalized=normalize(line);
 for(const row of Array.isArray(pet?.chatHistory)?pet.chatHistory:[]){
  if(row?.role!=='user')continue;
  const rawPrivate=String(row.text||'');
  // Single names, hometowns, schools and secrets can be copied into an
  // otherwise innocent-looking model sentence; check them individually.
  const entity=/(?:my (?:real |full )?name is|i(?:'m| am) called|i live in|my (?:address|school|password|secret|birthday) is|i work at)\s+([A-Za-z][A-Za-z'-]{2,}(?:\s+[A-Z][A-Za-z'-]{2,}){0,3})/ig;
  let named;
  while((named=entity.exec(rawPrivate))){
   const value=normalize(named[1]).split(/\s+(?:and|but|because|at|on)\b/)[0].trim();
   if(value.length>=4&&(' '+normalized+' ').includes(' '+value+' '))
    return {blocked:true,reason:'private_named_entity'};
  }
  const words=normalize(row.text).split(' ').filter(x=>x.length>1);
  for(let i=0;i+2<words.length;i++){
   const phrase=words.slice(i,i+3).join(' ');
   if(phrase.length>=9&&normalized.includes(phrase))
    return {blocked:true,reason:'private_chat_overlap'};
  }
 }
 return {blocked:false,requiresConfirmation:false};
}
root.TrialumPrivacyGuard={inspect,inspectPetSpeech};
if(typeof module==='object'&&module.exports)module.exports={inspect,inspectPetSpeech};
})(typeof globalThis!=='undefined'?globalThis:this);
