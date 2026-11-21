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
const api={VERSION,ensure,record,topic,encounter,awareness};root.TrialumCognitiveMemory=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
