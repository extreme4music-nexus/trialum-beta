/* TRIALUM: bounded personal playground memories, not transcripts.
 * Only coarse themes + dates + voluntarily shared pet display names are saved.
 * No other owner's text, account, room ID or credentials enter JSON backups.
 */
(function(root){
'use strict';
const MAX_DAYS=45,MAX_ENTRIES=60,MAX_TOPICS=6,MAX_COMPANIONS=3;
const lexicon=[
 ['slide',/лизгал|slide/i],['seesaw',/клацкал|seesaw/i],
 ['sandbox',/песок|песоч|sandbox|sand/i],['water',/базен|плива|вода|pool|swim|water/i],
 ['jump',/трамбол|скок|jump|bounce|trampoline/i],['obstacle',/пречк|патек|obstacle|path/i],
 ['explore',/истраж|откр|explor|discover|mystery/i],
 ['music',/музик|песна|пее|пеење|sing|song|music/i],
 ['nature',/цвеќ|цвет|трева|дрв|градин|flower|tree|garden|grass/i],
 ['riddle',/загат|прашањ|riddle|question|puzzle/i],
 ['stars',/светка|ѕвезд|сјај|star|spark|glow/i],
 ['food',/храна|јад|глад|food|snack|eat|hungry/i],
 ['rest',/одмор|умор|спие|rest|sleep|tired/i],
 ['emotion',/радос|среќ|таж|смеш|happy|laugh|joy|sad/i],
 ['toys',/играчк|игротек|игра|toy|playground|play/i],
 ['friendship',/другар|пријател|заедно|friend|together/i]
];
const labels={
 slide:['лизгалка','slide'],seesaw:['клацкалка','seesaw'],
 sandbox:['песочник','sandbox'],water:['вода и пливање','water and swimming'],
 jump:['скокање','jumping'],obstacle:['патека со пречки','obstacle course'],
 explore:['истражување','exploring'],music:['музика','music'],
 nature:['природа','nature'],riddle:['прашања и загатки','questions and riddles'],
 stars:['светкави откритија','sparkling discoveries'],food:['храна','food'],
 rest:['одмор','rest'],emotion:['расположенија','feelings'],
 toys:['игри и играчки','games and toys'],friendship:['дружење','friendship']
};
const topicSet=new Set(Object.keys(labels));
const mk=()=>root.TrialumI18n?.language?.()==='mk';
function dayKey(at=Date.now()){
 const d=new Date(at);
 if(!Number.isFinite(d.getTime()))return '';
 return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function yesterdayKey(at=Date.now()){
 const d=new Date(at);d.setHours(12,0,0,0);d.setDate(d.getDate()-1);
 return dayKey(d.getTime());
}
function topicsFrom(...phrases){
 const combined=phrases.filter(x=>typeof x==='string').map(x=>x.slice(0,180)).join(' ');
 // Specific topics take priority over generic playground/friendship words.
 const hits=lexicon.filter(([id,re])=>re.test(combined)).map(([id])=>id);
 return (hits.filter(id=>id!=='toys'&&id!=='friendship')
  .concat(hits.filter(id=>id==='toys'||id==='friendship'))).slice(0,MAX_TOPICS);
}
function cleanName(value){
 const name=String(value??'').trim().replace(/[\u0000-\u001f\u007f<>]/g,'').slice(0,24);
 if(!name||/https?:\/\/|www\.|\S+@\S+|\+?\d[\d ().-]{7,}\d/i.test(name))return '';
 return name;
}
function safeEntry(value){
 if(!value||typeof value!=='object'||! /^\d{4}-\d\d-\d\d$/.test(value.day||''))return null;
 const place=value.place==='shared'?'shared':value.place==='local'?'local':null;
 if(!place)return null;
 return {day:value.day,place,topics:[...new Set((Array.isArray(value.topics)?value.topics:[])
  .filter(x=>topicSet.has(x)))].slice(0,MAX_TOPICS),
  companions:[...new Set((Array.isArray(value.companions)?value.companions:[])
   .map(cleanName).filter(Boolean))].slice(0,MAX_COMPANIONS),
  moments:Math.max(1,Math.min(99,Math.trunc(Number(value.moments)||1)))};
}
function read(p,now=Date.now()){
 const cutoff=new Date(now);cutoff.setHours(12,0,0,0);cutoff.setDate(cutoff.getDate()-MAX_DAYS);
 const minDay=dayKey(cutoff.getTime()),maxDay=dayKey(now);
 const records=Array.isArray(p?.playgroundAiMemories)?p.playgroundAiMemories:[];
 return records.slice(-MAX_ENTRIES).map(safeEntry).filter(x=>x&&x.day>=minDay&&x.day<=maxDay);
}
function remember(p,{place,companion,said,heard,now=Date.now()}={}){
 if(!p||(place!=='local'&&place!=='shared'))return false;
 const day=dayKey(now);if(!day)return false;
 const memories=read(p,now);
 const key=day+'|'+place;
 let item=memories.find(x=>x.day+'|'+x.place===key);
 if(!item){item={day,place,topics:[],companions:[],moments:0};memories.push(item);}
 const themes=topicsFrom(said,heard);
 if(!themes.length&&item.topics.length===0)themes.push('friendship');
 item.topics=[...new Set(item.topics.concat(themes))].slice(0,MAX_TOPICS);
 const who=cleanName(companion);
 if(who&&!item.companions.includes(who))item.companions.push(who);
 item.companions=item.companions.slice(0,MAX_COMPANIONS);
 item.moments=Math.min(99,item.moments+1);
 p.playgroundAiMemories=memories.sort((a,b)=>a.day.localeCompare(b.day)).slice(-MAX_ENTRIES);
 return true;
}
function recall(p,question='',now=Date.now()){
 const ask=String(question||'').slice(0,360);
 const yesterday=/вчера|вчераш|yesterday/i.test(ask);
 const today=/денес|today/i.test(ask);
 const all=read(p,now),target=yesterday?yesterdayKey(now):today?dayKey(now):null;
 const records=(target?all.filter(x=>x.day===target):all.slice(-3))
  .map(x=>({day:x.day,place:x.place,with:x.companions,
   themes:x.topics,moments:x.moments}));
 return {requested:yesterday?'yesterday':today?'today':'recent',
  found:records.length>0,records};
}
function context(p,question='',now=Date.now(),budget=340){
 const data=recall(p,question,now);
 // Stable JSON values, no literal phrases from other users.
 let s=JSON.stringify({playground_memory:data});
 while(s.length>budget&&data.records.length){
  if(data.records.some(x=>x.with.length))data.records.forEach(x=>x.with=[]);
  else if(data.records.some(x=>x.themes.length>2))data.records.forEach(x=>x.themes=x.themes.slice(0,2));
  else data.records.pop();
  s=JSON.stringify({playground_memory:data});
 }
 return s;
}
function overview(p,question='',now=Date.now()){
 const mem=recall(p,question,now);
 if(!mem.found)return mk()?'Немам зачувано сеќавање за тој период.':'I do not have a saved memory for that time.';
 return mem.records.map(v=>{
  const words=v.themes.map(x=>labels[x]?.[mk()?0:1]).filter(Boolean).slice(0,3).join(', ');
  const withNames=v.with.slice(0,2).join(', ');
  return mk()?
   v.day+': '+(v.place==='shared'?'со другарчињата':'во мојата игротека')+
    (withNames?' ('+withNames+')':'')+' — '+(words||'дружење')+'.':
   v.day+': '+(v.place==='shared'?'with friends':'in my playground')+
    (withNames?' ('+withNames+')':'')+' — '+(words||'playing together')+'.';
 }).join(' ');
}
function clear(p){if(p)p.playgroundAiMemories=[];}

/** Idempotent import of the native background service's coarse daily counters.
 * A device reinstall creates a new stream ID. Already imported moments may not
 * be double-counted after returning to the WebView, exporting or restoring. */
function ingestBackground(p,payload,now=Date.now()){
 if(!p||!payload||typeof payload!=='object'||payload.petId!==p.id||
   !/^[0-9a-f-]{36}$/i.test(payload.streamId||'')||
   !Number.isSafeInteger(payload.revision)||payload.revision<0||
   !Array.isArray(payload.entries)||payload.entries.length>MAX_ENTRIES)return false;
 const same=p.playgroundAiBackgroundStreamId===payload.streamId;
 const last=same?Math.max(0,Number(p.playgroundAiBackgroundRevision)||0):0;
 if(same&&payload.revision<=last)return false;
 const previous=same&&p.playgroundAiBackgroundSeen&&
    typeof p.playgroundAiBackgroundSeen==='object'?p.playgroundAiBackgroundSeen:{};
 const seen={...previous},records=read(p,now);
 let changed=false;
 const incoming=payload.entries.map(safeEntry).filter(x=>x&&x.place==='shared');
 for(const entry of incoming){
  const seenCount=Math.max(0,Math.min(99,Number(seen[entry.day])||0));
  const delta=same?Math.max(0,entry.moments-seenCount):entry.moments;
  let item=records.find(x=>x.day===entry.day&&x.place==='shared');
  if(!item){item={day:entry.day,place:'shared',topics:[],companions:[],moments:0};records.push(item);}
  item.topics=[...new Set(item.topics.concat(entry.topics))].slice(0,MAX_TOPICS);
  item.companions=[...new Set(item.companions.concat(entry.companions))].slice(0,MAX_COMPANIONS);
  item.moments=Math.min(99,item.moments+delta);
  seen[entry.day]=entry.moments;
  if(delta||entry.topics.some(x=>!item.topics.includes(x)))changed=true;
 }
 p.playgroundAiMemories=records.sort((a,b)=>a.day.localeCompare(b.day)).slice(-MAX_ENTRIES);
 p.playgroundAiBackgroundSeen=Object.fromEntries(
  Object.entries(seen).filter(([day])=>/^\d{4}-\d\d-\d\d$/.test(day)&&
     day>=dayKey(new Date(now).setDate(new Date(now).getDate()-MAX_DAYS)))
    .slice(-MAX_ENTRIES));
 p.playgroundAiBackgroundStreamId=payload.streamId;
 p.playgroundAiBackgroundRevision=payload.revision;
 return changed||!same||payload.revision>last;
}

const api={dayKey,yesterdayKey,topicsFrom,read,remember,recall,context,overview,clear,ingestBackground};
root.TrialumPlaygroundMemory=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
