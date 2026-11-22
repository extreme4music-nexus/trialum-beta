/* V44: lifelong semantic context with deterministic, multiresolution consolidation.
 * Recent days -> calendar months -> years. Retention is unlimited; detail resolution
 * decreases by age, while controlled topics, counts and meaningful facts remain.
 * No shared-room speech or owner chat is stored here.
 */
(function(root){
'use strict';
const C=root.TrialumCognitiveMemory,DAY=86400000,COOLDOWN=7*DAY;
const tags=new Set(['slide','seesaw','sandbox','water','jump','obstacle','explore','music',
 'nature','riddle','stars','food','rest','emotion','toys','friendship']);
const map=()=>Object.create(null);
function context(p){
 const m=C.ensure(p);
 if(!m.contextual)m.contextual={days:map(),months:map(),years:map(),
  legacyImported:false,lastCompactedAt:0,nativeStreams:map()};
 const x=m.contextual;
 x.nativeStreams??=map();
 for(const k of ['days','months','years'])if(!x[k]||typeof x[k]!=='object'||Array.isArray(x[k]))throw Error('invalid contextual archive');
 return x;
}
function dayKey(at){
 const d=new Date(at);if(!Number.isFinite(d.getTime()))return '';
 return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function validDay(value){
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\d$/.test(value))return false;
 const d=new Date(value+'T12:00:00');
 return Number.isFinite(d.getTime())&&dayKey(d.getTime())===value;
}
function cleanName(v){
 const s=String(v??'').trim().replace(/[\u0000-\u001f\u007f<>]/g,'').slice(0,24);
 if(!s||/https?:\/\/|www\.|\S+@\S+|\+?\d[\d ().-]{7,}\d/i.test(s))return '';
 return s;
}
function safeTopics(input){return [...new Set((Array.isArray(input)?input:[]).filter(x=>tags.has(x)))].slice(0,16);}
function safeNames(input){return [...new Set((Array.isArray(input)?input:[]).map(cleanName).filter(Boolean))].slice(0,3);}
function add(store,key,{moments=0,topics=[],companions=[]}){
 const current=Object.hasOwn(store,key)?store[key]:{moments:0,topics:[],companions:[]};
 current.moments+=moments;
 current.topics=[...new Set(current.topics.concat(topics))].slice(0,16);
 current.companions=[...new Set(current.companions.concat(companions))].slice(0,3);
 store[key]=current;return current;
}
function remember(p,{day,place,topics=[],companions=[],moments=1}={}){
 if(!validDay(day)||!['local','shared'].includes(place)||
    !Number.isSafeInteger(moments)||moments<0||moments>99)throw Error('invalid contextual observation');
 const t=safeTopics(topics),names=safeNames(companions);
 if(!moments&&!t.length&&!names.length)return false;
 const x=context(p);
 add(x.days,day+'|'+place,{moments,topics:t,companions:names});
 return true;
}
// Native background streams can outlive the WebView. Count cumulative native
// monthly/yearly archives exactly once by carrying per-stream semantic watermarks.
function nativeStream(p,id){
 if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))throw Error('invalid native stream');
 const x=context(p);
 return Object.hasOwn(x.nativeStreams,id)?x.nativeStreams[id]:
  (x.nativeStreams[id]={months:map(),years:map(),seeded:false});
}
function accountNativeDay(p,id,day,moments){
 if(!validDay(day)||!Number.isSafeInteger(moments)||moments<0)throw Error('invalid native day');
 const n=nativeStream(p,id);
 const month=day.slice(0,7),year=day.slice(0,4);
 n.months[month]=(n.months[month]||0)+moments;
 n.years[year]=(n.years[year]||0)+moments;
}
function seedNativeSeen(p,id,seen){
 const n=nativeStream(p,id);
 if(n.seeded)return;
 for(const [day,value] of Object.entries(seen&&typeof seen==='object'?seen:{})){
  const count=Number(value);
  if(validDay(day)&&Number.isSafeInteger(count)&&count>=0)accountNativeDay(p,id,day,count);
 }
 n.seeded=true;
}
function validateNativePeriods(packet){
 for(const [field,period] of [['months','month'],['years','year']]){
  const items=packet?.[field];
  if(items===undefined)continue;
  if(!Array.isArray(items)||items.length>(field==='months'?36:500))return false;
  for(const value of items){
   const key=value?.[period],count=value?.moments;
   if(typeof key!=='string'||!(period==='year'?/^\d{4}$/.test(key):
      /^\d{4}-(0[1-9]|1[0-2])$/.test(key))||
      !Number.isSafeInteger(count)||count<0||count>1000000000||
      (value.place!==undefined&&value.place!=='shared')||
      (value.topics!==undefined&&!Array.isArray(value.topics))||
      (value.companions!==undefined&&!Array.isArray(value.companions)))return false;
  }
 }
 return true;
}
function ingestNativePeriods(p,packet){
 if(!validateNativePeriods(packet))throw Error('invalid native summaries');
 const n=nativeStream(p,packet.streamId),x=context(p);
 let changed=false;
 for(const entry of packet.months||[]){
  const key=entry.month,seen=n.months[key]||0,delta=Math.max(0,entry.moments-seen);
  if(delta){
   add(x.months,key+'|shared',{moments:delta,topics:safeTopics(entry.topics),companions:safeNames(entry.companions)});
   n.months[key]=seen+delta;
   const year=key.slice(0,4);n.years[year]=(n.years[year]||0)+delta;changed=true;
  }
 }
 for(const entry of packet.years||[]){
  const key=entry.year,seen=n.years[key]||0,delta=Math.max(0,entry.moments-seen);
  if(delta){
   add(x.years,key+'|shared',{moments:delta,topics:safeTopics(entry.topics),companions:safeNames(entry.companions)});
   n.years[key]=seen+delta;changed=true;
  }
 }
 return changed;
}
function migrateLegacy(p){
 if(!p||typeof p.id!=='string'||!p.id)return false;
 const x=context(p);if(x.legacyImported)return false;
 const items=Array.isArray(p.playgroundAiMemories)?p.playgroundAiMemories:[];
 // A legacy rolling cache is partial evidence: never synthesize days it did not hold.
 for(const item of items.slice(-60)){
  if(!item||!validDay(item.day)||!['local','shared'].includes(item.place))continue;
  const moments=Math.max(0,Math.min(99,Math.trunc(Number(item.moments)||0)));
  remember(p,{day:item.day,place:item.place,moments,topics:item.topics,companions:item.companions});
 }
 x.legacyImported=true;
 return items.length>0;
}
function cutoff(now,days){const d=new Date(now);d.setHours(12,0,0,0);d.setDate(d.getDate()-days);return dayKey(d.getTime());}
function mergeBucket(to,from,sourceKey,targetKey){
 const v=from[sourceKey];add(to,targetKey,{moments:v.moments||0,topics:safeTopics(v.topics),companions:safeNames(v.companions)});
}
function rollDays(store,limit,periods){
 for(const key of Object.keys(store)){
  const day=key.slice(0,10),place=key.slice(11);
  if(day>=limit||!['local','shared'].includes(place))continue;
  mergeBucket(periods,store,key,day.slice(0,7)+'|'+place);
  delete store[key];
 }
}
function rollMonths(store,limit,years){
 for(const key of Object.keys(store)){
  const month=key.slice(0,7),place=key.slice(8);
  if(month>=limit||!['local','shared'].includes(place))continue;
  mergeBucket(years,store,key,month.slice(0,4)+'|'+place);
  delete store[key];
 }
}
function mergeCounts(to,from){
 for(const [kind,count] of Object.entries(from||{})){
  if(!Number.isFinite(count)||count<0)continue;
  to[kind]=(to[kind]||0)+count;
 }
}
function rollGameDays(p,gameDay){
 if(!Number.isSafeInteger(gameDay)||gameDay<1)return;
 const m=C.ensure(p),s=m.self;
 s.periods??=map();s.years??=map();
 for(const [day,bucket] of Object.entries(s.days)){
  if(day==='unknown'||!/^\d+$/.test(day)||Number(day)>gameDay-90)continue;
  const month=Math.floor((Number(day)-1)/30),key=String(month);
  const target=Object.hasOwn(s.periods,key)?s.periods[key]:(s.periods[key]={counts:map()});
  mergeCounts(target.counts,bucket.counts);delete s.days[day];
 }
 const currentPeriod=Math.floor((gameDay-1)/30);
 for(const [key,bucket] of Object.entries(s.periods)){
  if(!/^\d+$/.test(key)||Number(key)>currentPeriod-24)continue;
  const year=String(Math.floor(Number(key)/12));
  const target=Object.hasOwn(s.years,year)?s.years[year]:(s.years[year]={counts:map()});
  mergeCounts(target.counts,bucket.counts);delete s.periods[key];
 }
}
function consolidate(p,{now=Date.now(),gameDay=null,force=false}={}){
 if(!Number.isFinite(now)||now<0)throw Error('invalid consolidation time');
 const x=context(p);
 if(!force&&x.lastCompactedAt&&now-x.lastCompactedAt<COOLDOWN)return {ran:false};
 migrateLegacy(p);
 const months=x.months,years=x.years;
 rollDays(x.days,cutoff(now,45),months);
 const d=new Date(now),oldMonth=new Date(d.getFullYear(),d.getMonth()-24,1);
 rollMonths(months,dayKey(oldMonth.getTime()).slice(0,7),years);
 rollGameDays(p,gameDay);
 const archived=C.archiveOld(p,now-45*DAY);
 x.lastCompactedAt=now;
 return {ran:true,archived,days:Object.keys(x.days).length,
  months:Object.keys(x.months).length,years:Object.keys(x.years).length};
}
function recordRows(obj,period){
 const precision=period==='day'?10:period==='month'?7:4;
 return Object.entries(obj).filter(([key])=>['local','shared'].includes(key.slice(precision+1)))
  .map(([key,v])=>({day:key.slice(0,precision),period,place:key.slice(precision+1),
   with:safeNames(v.companions),themes:safeTopics(v.topics),moments:v.moments||0}));
}
function recall(p,question='',now=Date.now(),{publicScope=false}={}){
 migrateLegacy(p);
 const x=context(p),ask=String(question||'').slice(0,360);
 const yesterday=/вчера|вчераш|yesterday/i.test(ask),today=/денес|today/i.test(ask);
 const day=today?dayKey(now):yesterday?cutoff(now,1):null;
 const explicitYear=ask.match(/(?:19|20|21)\d{2}/)?.[0];
 const previous= /минатата година|лани|last year/i.test(ask);
 const yearsAgo=ask.match(/(?:пред\s*(\d+)\s*годин|(?:\b)(\d+)\s*years?\s*ago)/i);
 const when=new Date(now),targetYear=explicitYear||(previous?String(when.getFullYear()-1):
  yearsAgo?String(when.getFullYear()-Number(yearsAgo[1]||yearsAgo[2])):null);
 const rows=[...recordRows(x.days,'day'),...recordRows(x.months,'month'),...recordRows(x.years,'year')]
  .filter(row=>!publicScope||row.place==='shared')
  .sort((a,b)=>b.day.localeCompare(a.day));
 const target=day?rows.filter(x=>x.day===day):
  targetYear?rows.filter(x=>x.day.startsWith(targetYear)):rows.slice(0,3);
 return {requested:day?(today?'today':'yesterday'):targetYear?'year':'recent',
  found:target.length>0,records:target.slice(0,6)};
}
function clear(p){
 if(!p?.id)return;
 const x=context(p);
 x.days=map();x.months=map();x.years=map();x.nativeStreams=map();
 x.legacyImported=true;x.lastCompactedAt=0;
}
const api={context,remember,migrateLegacy,consolidate,recall,clear,
 nativeStream,accountNativeDay,seedNativeSeen,validateNativePeriods,ingestNativePeriods};
root.TrialumCognitiveContext=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
