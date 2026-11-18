/* Trialum Living World: ephemeral, privacy-bounded conversational turn ledger.
 * Never receives private player<->pet dialogue, credentials or durable secrets.
 * Room speech comes exclusively from authenticated WSS events; local speech is
 * generated on this device. No network, storage, timers, scores or world writes. */
(function(root){
'use strict';
const MAX_TURNS=36, MAX_AGE=90*60*1000, MAX_ANSWERED=144;
const sessions={shared:null,playground:null};
function make(key){return {key,turns:[],answered:new Set(),firstStarted:false};}
function ensure(scope,key){
 if(scope!=='shared'&&scope!=='playground')return null;
 key=String(key||'').slice(0,360);
 if(!key)return null;
 if(!sessions[scope]||sessions[scope].key!==key)sessions[scope]=make(key);
 return sessions[scope];
}
function hash(text){let n=2166136261;for(const c of String(text)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
function prune(s,now){
 // Old, timed-out turns expire. Under the bounded turn cap, prefer evicting
 // answered turns so an unanswered question is not lost to later chat bursts.
 s.turns=s.turns.filter(x=>now-x.at<=MAX_AGE);
 while(s.turns.length>MAX_TURNS){
  const answeredIndex=s.turns.findIndex(x=>s.answered.has(x.id));
  s.turns.splice(answeredIndex<0?0:answeredIndex,1);
 }
 if(s.answered.size>MAX_ANSWERED){
  const valid=new Set(s.turns.map(x=>x.id));
  for(const x of s.answered)if(!valid.has(x))s.answered.delete(x);
 }
}
function receive(scope,key,turn,now=Date.now()){
 const s=ensure(scope,key);if(!s||!turn||!turn.petId||!turn.id||
  typeof turn.text!=='string'||!turn.text.trim())return false;
 const id=String(turn.id).slice(0,80);
 if(s.turns.some(x=>x.id===id))return false;
 const item={id,petId:String(turn.petId).slice(0,64),
  speaker:String(turn.speaker||'Милениче').slice(0,32),
  text:turn.text.trim().slice(0,112),at:now,
  replyTo:String(turn.replyTo||'').slice(0,80)};
 s.turns.push(item);
 if(item.replyTo)s.answered.add(item.replyTo);
 prune(s,now);
 return true;
}
function answered(scope,key,id){
 const s=ensure(scope,key);
 if(s&&id)s.answered.add(String(id).slice(0,80));
}
function next(scope,key,petId,occupants=[],now=Date.now(),random=Math.random){
 const s=ensure(scope,key);if(!s)return null;
 prune(s,now);
 const choices=s.turns.filter(x=>x.petId!==petId&&!s.answered.has(x.id));
 if(!choices.length)return null;
 // A 20% opportunity to revive an earlier OPEN utterance, otherwise the latest.
 const last=choices[choices.length-1];
 const revive=choices.length>2&&(scope==='shared'?
  hash(s.key+'|'+last.id)%5===0:random()<0.2);
 const target=revive?(scope==='shared'?
  choices[hash(last.id+'|older')%(choices.length-1)]:
  choices[Math.floor(random()*(choices.length-1))]):last;
 if(scope==='shared'){
  const ids=[...new Set(occupants.filter(x=>typeof x==='string'&&x&&x!==target.petId))];
  if(!ids.length)return null;
  ids.sort((a,b)=>hash(target.id+'|'+a)-hash(target.id+'|'+b)||a.localeCompare(b));
  // Same authenticated room roster yields same turn owner, across clients.
  // 30s fallback if the nominated pet has no enabled model/connection.
  const rank=Math.min(ids.length-1,Math.floor(Math.max(0,now-target.at)/30000));
  if(ids[rank]!==petId)return null;
 }
 return {...target};
}
function context(scope,key,target,limit=1300,random=Math.random){
 const s=ensure(scope,key);if(!s)return [];
 const recent=s.turns.slice(-10);
 const older=s.turns.slice(0,-10);
 if(older.length&&random()<0.25)recent.unshift(older[Math.floor(random()*older.length)]);
 if(target&&!recent.some(x=>x.id===target.id))recent.push(target);
 // Keep the target and latest contextual turns; do not split JSON strings.
 let compact=recent.map(x=>({id:x.petId.slice(0,18),
  speaker:x.speaker.slice(0,24),text:x.text.slice(0,92)}));
 while(compact.length>1&&JSON.stringify(compact).length>limit)compact.shift();
 return compact;
}
function latest(scope,key){const s=ensure(scope,key);return s?.turns.at(-1)||null;}
function count(scope,key){return ensure(scope,key)?.turns.length||0;}
function first(scope,key){return !!ensure(scope,key)?.firstStarted;}
function start(scope,key){const s=ensure(scope,key);if(s)s.firstStarted=true;}
function clear(scope){if(scope==='shared'||scope==='playground')sessions[scope]=null;}
const api={ensure,receive,answered,next,context,latest,count,first,start,clear,MAX_TURNS,MAX_AGE};
root.TrialumDialogueSessions=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
