/* V44 local cognitive foundation. No model or network dependency. */
(function(root){
'use strict';
const VERSION=2, kinds=new Set(['birth','feed','play','wash','rest','talk','transfer','evolution','encounter']);
const dict=()=>Object.create(null);
const eventCache=new WeakMap();
function emptyMemory(p){
 return {version:VERSION,schemaVersion:VERSION,petId:p.id,birthDay:Number.isFinite(p.birthDay)?p.birthDay:null,
  self:{last:dict(),days:dict(),counts:dict()},owner:{topics:dict()},social:{peers:dict()},
  associations:dict(),eventLedger:[],eventSerial:0,
  migrationMetadata:{origin:'created',historicalEventsReconstructed:false}};
}
function ensure(p){
 if(!p||typeof p.id!=='string'||!p.id||p.id.length>128)throw Error('invalid pet');
 if(!p.cognitiveMemory)p.cognitiveMemory=emptyMemory(p);
 const m=p.cognitiveMemory;
 if(!m||typeof m!=='object'||m.petId!==p.id)throw Error('invalid cognitive identity');
 if(m.version===1){
  // Keep every V1 fact intact. There is no trustworthy old event stream to reconstruct.
  m.version=VERSION;m.schemaVersion=VERSION;m.eventLedger=[];m.eventSerial=0;
  m.migrationMetadata={origin:'v1',historicalEventsReconstructed:false};
 }
 if(m.version!==VERSION||m.schemaVersion!==VERSION||!Array.isArray(m.eventLedger)||
    !Number.isSafeInteger(m.eventSerial)||m.eventSerial<0)throw Error('unsupported cognitive schema');
 if(!m.self||typeof m.self!=='object'||!m.self.last||!m.self.days||!m.self.counts||
    !m.owner||!m.owner.topics||!m.social||!m.social.peers)throw Error('invalid cognitive data');
 return m;
}
function eventIds(m){
 let ids=eventCache.get(m);
 if(ids)return ids;
 ids=new Set();
 for(const event of m.eventLedger){
  if(!event||typeof event.eventId!=='string'||event.petId!==m.petId||
   !/^[A-Za-z0-9:_./-]{1,160}$/.test(event.eventId)||ids.has(event.eventId))
   throw Error('corrupt cognitive event ledger');
  ids.add(event.eventId);
 }
 eventCache.set(m,ids);
 return ids;
}
function ingest(p,input){
 if(!input||typeof input!=='object'||!kinds.has(input.kind))throw Error('invalid cognitive event');
 const at=input.at===undefined?Date.now():input.at;
 if(!Number.isFinite(at)||at<0)throw Error('invalid cognitive timestamp');
 const day=input.day===undefined||input.day===null?null:input.day;
 if(day!==null&&(!Number.isSafeInteger(day)||day<0))throw Error('invalid cognitive day');
 const source=input.source===undefined?'game':input.source;
 if(typeof source!=='string'||!/^[a-z][a-z0-9_-]{0,47}$/.test(source))throw Error('invalid cognitive source');
 const food=typeof input.food==='string'?input.food.slice(0,160):null;
 const location=typeof input.location==='string'?input.location.slice(0,160):null;
 if(location&&['birth','transfer','encounter'].includes(input.kind))safeKey(location);
 const supplied=input.eventId;
 if(supplied!==undefined&&(typeof supplied!=='string'||!/^[A-Za-z0-9:_./-]{1,160}$/.test(supplied)||
    ['__proto__','constructor','prototype'].includes(supplied)))throw Error('invalid cognitive event id');
 const m=ensure(p),ids=eventIds(m);
 if(supplied&&ids.has(supplied)){
  const prior=m.eventLedger.find(e=>e.eventId===supplied);
  if(prior.kind!==input.kind||prior.at!==at||prior.day!==day||prior.source!==source||
     prior.food!==food||prior.location!==location)throw Error('cognitive event id collision');
  return {event:prior,inserted:false,duplicate:true};
 }
 let eventId=supplied;
 if(!eventId){do{m.eventSerial++;eventId=p.id+':event:'+m.eventSerial;}while(ids.has(eventId));}
 else m.eventSerial++;
 const event={schemaVersion:VERSION,eventId,petId:p.id,kind:input.kind,source,at,day,food,location};
 const key=day===null?'unknown':String(day),state=m.self;
 const bucket=Object.hasOwn(state.days,key)?state.days[key]:(state.days[key]={counts:dict()});
 // Validation above ensures replay/collision cannot affect graph, last values or counts.
 m.eventLedger.push(event);ids.add(eventId);
 bucket.counts[input.kind]=(bucket.counts[input.kind]||0)+1;
 state.counts[input.kind]=(state.counts[input.kind]||0)+1;
 if(!state.last[input.kind]||state.last[input.kind].at<=at)state.last[input.kind]=event;
 observeExperience(p,'activity',input.kind,input.kind,'experienced',at);
 if(location&&['birth','transfer','encounter'].includes(input.kind))visit(p,location,at);
 return {event,inserted:true,duplicate:false};
}
function record(p,kind,options={}){return ingest(p,{...options,kind}).event;}
function ensureWorld(world){
 if(!world||!Array.isArray(world.pets))throw Error('invalid cognitive world');
 for(const pet of world.pets)ensure(pet);
 return world;
}
function safeKey(value){const k=String(value).trim().slice(0,160);if(!k||['__proto__','constructor','prototype'].includes(k))throw Error('invalid key');return k;}
function topic(p,value,at=Date.now()){if(!Number.isFinite(at))throw Error('invalid timestamp');const key=safeKey(value),m=ensure(p),t=Object.hasOwn(m.owner.topics,key)?m.owner.topics[key]:{count:0,firstAt:at,lastAt:at};t.count++;t.firstAt=Math.min(t.firstAt,at);t.lastAt=Math.max(t.lastAt,at);m.owner.topics[key]=t;observeExperience(p,'topic',key,key,'discussed-with-owner',at);return t;}
function encounter(p,peer,{at=Date.now(),location=null}={}){if(!Number.isFinite(at))throw Error('invalid timestamp');const key=safeKey(peer.id);if(key===p.id)return null;const m=ensure(p),r=Object.hasOwn(m.social.peers,key)?m.social.peers[key]:{count:0,firstAt:at,lastAt:at,name:null,location:null};r.count++;r.firstAt=Math.min(r.firstAt,at);if(at>=r.lastAt){r.lastAt=at;r.name=String(peer.name||'').slice(0,80);r.location=typeof location==='string'?location.slice(0,160):null;}m.social.peers[key]=r;observeExperience(p,'peer',key,r.name,'encountered',at);return r;}
function awareness(p){const m=ensure(p);return {petId:p.id,name:p.name,ageDays:p.ageDays,birthDay:m.birthDay,satiety:p.satiety,joy:p.joy,energy:p.energy,clean:p.clean,bond:p.bond,habitatId:p.habitatId,lastMeal:m.self.last.feed||null,lastBath:m.self.last.wash||null,lastPlay:m.self.last.play||null};}
// Controlled semantic labels: never retain another player's literal speech.
const taxonomy={music:/music|song|guitar|музик|песн|гитар/iu,food:/food|hungry|eat|хран|глад|јад/iu,friendship:/friend|together|другар|пријател|заедно/iu,nature:/garden|plant|flower|градин|растен|цвет/iu,science:/science|research|laboratory|наук|истраж|лаборатор/iu,evolution:/evolut|level|еволуц|ниво/iu,play:/play|game|игр/iu,slide:/slide|лизгал/iu,swimming:/swim|pool|плива|базен/iu,jump:/jump|trampoline|скок|трамбол/iu,rest:/sleep|rest|спие|одмор/iu,emotion:/happy|sad|радос|таж/iu,space:/space|star|planet|вселен|ѕвезд|планет/iu,construction:/build|habitat|градб|живеалиш/iu};
function themes(...texts){const input=texts.filter(x=>typeof x==='string').map(x=>x.slice(0,2000)).join(' ');return Object.entries(taxonomy).filter(([,re])=>re.test(input)).map(([id])=>id);}
function summarize(p,user,reply,at=Date.now()){const ids=themes(user,reply);for(const id of ids)topic(p,id,at);associate(p,ids,at);return {topics:ids,kind:'topic-summary',at};}
function socialMoment(p,peer,{at=Date.now(),location=null,heard='',said='',activity=null}={}){if(!peer||typeof peer.id!=='string'||!peer.id)return null;const r=encounter(p,peer,{at,location});if(!r)return null;r.topics??=dict();r.activities??=dict();for(const id of themes(heard,said))r.topics[id]=(r.topics[id]||0)+1;if(activity&&['play','slide','swimming','jump','talk'].includes(activity))r.activities[activity]=(r.activities[activity]||0)+1;r.affinity=Math.min(100,Math.round(100*(1-Math.exp(-r.count/12))));return r;}
function suggestion(p,now=Date.now()){const peers=Object.values(ensure(p).social.peers);return peers.filter(r=>r.count>=3&&r.name&&now-r.lastAt>=86400000).sort((a,b)=>b.affinity-a.affinity||a.lastAt-b.lastAt)[0]||null;}
function worldMap(p,s){const m=ensure(p);m.world??={visited:dict()};const e=root.TrialumEngine||{};return {self:awareness(p),phases:e.PHASES||[],species:(e.SPECIES||[]).map(x=>x.name),plants:(e.PLANTS||[]).map(x=>x.name),biomes:(e.BIOMES||[]).map(x=>x.name),locations:(s?.habitats||[]).map(x=>({id:x.id,name:x.name})),pets:(s?.pets||[]).map(x=>({id:x.id,name:x.name,species:x.species})),visited:m.world.visited};}
function associate(p,ids,at=Date.now()){const m=ensure(p);const unique=[...new Set(ids)].sort();for(let i=0;i<unique.length;i++)for(let j=i+1;j<unique.length;j++){const key=safeKey(unique[i]+'|'+unique[j]);const edge=Object.hasOwn(m.associations,key)?m.associations[key]:{weight:0,lastAt:at};edge.weight++;edge.lastAt=Math.max(at,edge.lastAt);m.associations[key]=edge;}}
function visit(p,location,at=Date.now()){const m=ensure(p);m.world??={visited:dict()};const key=safeKey(location);const v=Object.hasOwn(m.world.visited,key)?m.world.visited[key]:{count:0,firstAt:at,lastAt:at};v.count++;v.firstAt=Math.min(v.firstAt,at);v.lastAt=Math.max(v.lastAt,at);m.world.visited[key]=v;observeExperience(p,'location',key,key,'visited',at);return v;}
function recall(p,prompt,{privateScope=false}={}){const m=ensure(p),ids=themes(prompt),related=new Set(ids);for(const [key,edge] of Object.entries(m.associations).sort((a,b)=>b[1].weight-a[1].weight)){const labels=key.split('|');if(labels.some(x=>ids.includes(x)))labels.forEach(x=>related.add(x));}const topics=privateScope?Object.entries(m.owner.topics).sort((a,b)=>Number(related.has(b[0]))-Number(related.has(a[0]))||b[1].lastAt-a[1].lastAt).slice(0,5).map(([label,v])=>({label,count:v.count,lastAt:v.lastAt})):[];return {self:awareness(p),topics,peers:Object.entries(m.social.peers).sort((a,b)=>b[1].lastAt-a[1].lastAt).slice(0,3).map(([id,v])=>({id,name:v.name,lastAt:v.lastAt,activities:v.activities||{},topics:v.topics||{}})),locations:Object.entries(m.world?.visited||{}).sort((a,b)=>b[1].lastAt-a[1].lastAt).slice(0,3)};}
function graph(p){const m=ensure(p);m.graph??={nodes:dict(),edges:dict()};return m.graph;}
function observe(p,type,id,label,at=Date.now()){if(!['self','location','peer','topic','activity','species'].includes(type)||!Number.isFinite(at))throw Error('invalid graph observation');const g=graph(p),key=safeKey(type+':'+id);const n=Object.hasOwn(g.nodes,key)?g.nodes[key]:{type,id:String(id),count:0,firstAt:at,lastAt:at};n.count++;n.firstAt=Math.min(n.firstAt,at);if(at>=n.lastAt)n.label=String(label||id).slice(0,160);n.lastAt=Math.max(n.lastAt,at);g.nodes[key]=n;return key;}
function connect(p,from,to,relation,at=Date.now()){const g=graph(p);if(!Object.hasOwn(g.nodes,from)||!Object.hasOwn(g.nodes,to)||!Number.isFinite(at))throw Error('invalid graph edge');const key=JSON.stringify([from,relation,to]);const e=Object.hasOwn(g.edges,key)?g.edges[key]:{from,to,relation,count:0,firstAt:at,lastAt:at};e.count++;e.firstAt=Math.min(e.firstAt,at);e.lastAt=Math.max(e.lastAt,at);g.edges[key]=e;}
function observeExperience(p,type,id,label,relation,at){const self=observe(p,'self',p.id,p.name,at),node=observe(p,type,id,label,at);connect(p,self,node,relation,at);return node;}
function cognitiveMap(p,{privateScope=false}={}){const g=graph(p),nodes=Object.entries(g.nodes).filter(([,n])=>privateScope||n.type!=='topic'),allowed=new Set(nodes.map(([k])=>k));return {nodes:nodes.map(([key,n])=>({key,...n})),edges:Object.values(g.edges).filter(e=>allowed.has(e.from)&&allowed.has(e.to)).map(e=>({...e}))};}
const api={graph,observe,connect,cognitiveMap,recall,VERSION,ensure,ensureWorld,ingest,record,topic,encounter,awareness,themes,summarize,socialMoment,suggestion,worldMap,associate,visit};root.TrialumCognitiveMemory=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
