/* V44 local cognitive foundation. No model or network dependency. */
(function(root){
'use strict';
const VERSION=1, kinds=new Set(['birth','feed','play','wash','rest','talk','transfer','evolution','encounter']);
const dict=()=>Object.create(null);
function ensure(p){
 if(!p||typeof p.id!=='string')throw Error('invalid pet');
 if(!p.cognitiveMemory)p.cognitiveMemory={version:VERSION,petId:p.id,birthDay:Number.isFinite(p.birthDay)?p.birthDay:null,self:{last:dict(),days:dict(),counts:dict()},owner:{topics:dict()},social:{peers:dict()},associations:dict()};
 const m=p.cognitiveMemory;
 if(m.version!==VERSION||m.petId!==p.id)throw Error('invalid cognitive identity');
 return m;
}
function record(p,kind,{day=null,at=Date.now(),food=null,location=null}={}){
 if(!kinds.has(kind)||!Number.isFinite(at))throw Error('invalid cognitive event');
 const m=ensure(p),s=m.self,key=String(Number.isFinite(day)?day:'unknown');
 const event={kind,at,day:Number.isFinite(day)?day:null,food:typeof food==='string'?food.slice(0,160):null,location:typeof location==='string'?location.slice(0,160):null};
 if(event.location&&['birth','transfer','encounter'].includes(kind))visit(p,event.location,at);
 const bucket=Object.hasOwn(s.days,key)?s.days[key]:(s.days[key]={counts:dict()});
 bucket.counts[kind]=(bucket.counts[kind]||0)+1;
 s.counts[kind]=(s.counts[kind]||0)+1;
 if(!s.last[kind]||s.last[kind].at<=at)s.last[kind]=event;
 return event;
}
function safeKey(value){const k=String(value).trim().slice(0,160);if(!k||['__proto__','constructor','prototype'].includes(k))throw Error('invalid key');return k;}
function topic(p,value,at=Date.now()){if(!Number.isFinite(at))throw Error('invalid timestamp');const key=safeKey(value),m=ensure(p),t=Object.hasOwn(m.owner.topics,key)?m.owner.topics[key]:{count:0,firstAt:at,lastAt:at};t.count++;t.firstAt=Math.min(t.firstAt,at);t.lastAt=Math.max(t.lastAt,at);m.owner.topics[key]=t;return t;}
function encounter(p,peer,{at=Date.now(),location=null}={}){if(!Number.isFinite(at))throw Error('invalid timestamp');const key=safeKey(peer.id);if(key===p.id)return null;const m=ensure(p),r=Object.hasOwn(m.social.peers,key)?m.social.peers[key]:{count:0,firstAt:at,lastAt:at,name:null,location:null};r.count++;r.firstAt=Math.min(r.firstAt,at);if(at>=r.lastAt){r.lastAt=at;r.name=String(peer.name||'').slice(0,80);r.location=typeof location==='string'?location.slice(0,160):null;}m.social.peers[key]=r;return r;}
function awareness(p){const m=ensure(p);return {petId:p.id,name:p.name,ageDays:p.ageDays,birthDay:m.birthDay,satiety:p.satiety,joy:p.joy,energy:p.energy,clean:p.clean,bond:p.bond,habitatId:p.habitatId,lastMeal:m.self.last.feed||null,lastBath:m.self.last.wash||null,lastPlay:m.self.last.play||null};}
// Controlled semantic labels: never retain another player's literal speech.
const taxonomy={music:/music|song|guitar|музик|песн|гитар/iu,food:/food|hungry|eat|хран|глад|јад/iu,friendship:/friend|together|другар|пријател|заедно/iu,nature:/garden|plant|flower|градин|растен|цвет/iu,science:/science|research|laboratory|наук|истраж|лаборатор/iu,evolution:/evolut|level|еволуц|ниво/iu,play:/play|game|игр/iu,slide:/slide|лизгал/iu,swimming:/swim|pool|плива|базен/iu,jump:/jump|trampoline|скок|трамбол/iu,rest:/sleep|rest|спие|одмор/iu,emotion:/happy|sad|радос|таж/iu,space:/space|star|planet|вселен|ѕвезд|планет/iu,construction:/build|habitat|градб|живеалиш/iu};
function themes(...texts){const input=texts.filter(x=>typeof x==='string').map(x=>x.slice(0,2000)).join(' ');return Object.entries(taxonomy).filter(([,re])=>re.test(input)).map(([id])=>id);}
function summarize(p,user,reply,at=Date.now()){const ids=themes(user,reply);for(const id of ids)topic(p,id,at);associate(p,ids,at);return {topics:ids,kind:'topic-summary',at};}
function socialMoment(p,peer,{at=Date.now(),location=null,heard='',said='',activity=null}={}){if(!peer||typeof peer.id!=='string'||!peer.id)return null;const r=encounter(p,peer,{at,location});if(!r)return null;r.topics??=dict();r.activities??=dict();for(const id of themes(heard,said))r.topics[id]=(r.topics[id]||0)+1;if(activity&&['play','slide','swimming','jump','talk'].includes(activity))r.activities[activity]=(r.activities[activity]||0)+1;r.affinity=Math.min(100,Math.round(100*(1-Math.exp(-r.count/12))));return r;}
function suggestion(p,now=Date.now()){const peers=Object.values(ensure(p).social.peers);return peers.filter(r=>r.count>=3&&r.name&&now-r.lastAt>=86400000).sort((a,b)=>b.affinity-a.affinity||a.lastAt-b.lastAt)[0]||null;}
function worldMap(p,s){const m=ensure(p);m.world??={visited:dict()};const e=root.TrialumEngine||{};return {self:awareness(p),phases:e.PHASES||[],species:(e.SPECIES||[]).map(x=>x.name),plants:(e.PLANTS||[]).map(x=>x.name),biomes:(e.BIOMES||[]).map(x=>x.name),locations:(s?.habitats||[]).map(x=>({id:x.id,name:x.name})),pets:(s?.pets||[]).map(x=>({id:x.id,name:x.name,species:x.species})),visited:m.world.visited};}
function associate(p,ids,at=Date.now()){const m=ensure(p);const unique=[...new Set(ids)].sort();for(let i=0;i<unique.length;i++)for(let j=i+1;j<unique.length;j++){const key=safeKey(unique[i]+'|'+unique[j]);const edge=Object.hasOwn(m.associations,key)?m.associations[key]:{weight:0,lastAt:at};edge.weight++;edge.lastAt=Math.max(at,edge.lastAt);m.associations[key]=edge;}}
function visit(p,location,at=Date.now()){const m=ensure(p);m.world??={visited:dict()};const key=safeKey(location);const v=Object.hasOwn(m.world.visited,key)?m.world.visited[key]:{count:0,firstAt:at,lastAt:at};v.count++;v.firstAt=Math.min(v.firstAt,at);v.lastAt=Math.max(v.lastAt,at);m.world.visited[key]=v;return v;}
function recall(p,prompt,{privateScope=false}={}){const m=ensure(p),ids=themes(prompt),related=new Set(ids);for(const [key,edge] of Object.entries(m.associations).sort((a,b)=>b[1].weight-a[1].weight)){const labels=key.split('|');if(labels.some(x=>ids.includes(x)))labels.forEach(x=>related.add(x));}const topics=privateScope?Object.entries(m.owner.topics).sort((a,b)=>Number(related.has(b[0]))-Number(related.has(a[0]))||b[1].lastAt-a[1].lastAt).slice(0,5).map(([label,v])=>({label,count:v.count,lastAt:v.lastAt})):[];return {self:awareness(p),topics,peers:Object.entries(m.social.peers).sort((a,b)=>b[1].lastAt-a[1].lastAt).slice(0,3).map(([id,v])=>({id,name:v.name,lastAt:v.lastAt,activities:v.activities||{},topics:v.topics||{}})),locations:Object.entries(m.world?.visited||{}).sort((a,b)=>b[1].lastAt-a[1].lastAt).slice(0,3)};}
const api={recall,VERSION,ensure,record,topic,encounter,awareness,themes,summarize,socialMoment,suggestion,worldMap,associate,visit};root.TrialumCognitiveMemory=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
