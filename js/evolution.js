/* TRIALUM 1.2 - independent per-creature evolution and tiny local learning network.
   Fictional gameplay, not a simulation of genuine neurons or real evolution. */
(function (root) {
'use strict';
const E=root.TrialumEngine;
if(!E||E.TRIALUM_EVOLUTION_PATCHED)return;
E.TRIALUM_EVOLUTION_PATCHED=true;
const old={newGame:E.newGame,validate:E.validate,createPet:E.createPet,petCare:E.petCare,advance:E.advance,demoNext:E.demoNext};
const EPOCHS=[
 {level:1,label:'Искра',description:'Меко протосуштество',limbs:0,feelers:0,tail:0},
 {level:3,label:'Пупки',description:'Први израстоци',limbs:2,feelers:0,tail:0},
 {level:6,label:'Истражувач',description:'Стабилни екстремитети',limbs:4,feelers:1,tail:0},
 {level:10,label:'Подвижно суштество',description:'Опашка и подобра подвижност',limbs:4,feelers:2,tail:1},
 {level:15,label:'Сензорно суштество',description:'Сетилни органи и нови реакции',limbs:6,feelers:3,tail:1},
 {level:22,label:'Умно суштество',description:'Подобро адаптивно учење',limbs:6,feelers:4,tail:2}
];
const MOVES=['истражува','одмора','дружи се'];
const clamp=(v,a=0,b=100)=>Math.min(b,Math.max(a,Number.isFinite(v)?v:0));
function xseed(seed){let x=(seed>>>0)||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return ((x>>>0)%10000)/10000;};}
function brain(seed){const rnd=xseed(seed);return {hidden:Array.from({length:6},()=>Array.from({length:6},()=>+(rnd()*.48-.24).toFixed(4))),out:Array.from({length:3},()=>Array.from({length:6},()=>+(rnd()*.48-.24).toFixed(4))),trained:0,lastChoice:0};}
function ensure(p){if(!p)return null;if(!p.evolution||typeof p.evolution!=='object')p.evolution={level:1,xp:0,earned:0,epoch:'Искра',lastDay:p.birthDay||1,memories:[],socialDays:{},brain:brain(Number(p.seed)||1),intent:'истражува',trained:0};
 const v=p.evolution;if(!Number.isFinite(v.level)||v.level<1)v.level=1;
 if(!Number.isFinite(v.xp)||v.xp<0)v.xp=0;
 if(!Number.isFinite(v.earned))v.earned=0;
 if(!v.brain||!Array.isArray(v.brain.hidden)||!Array.isArray(v.brain.out))v.brain=brain(Number(p.seed)||1);
 if(!v.socialDays||typeof v.socialDays!=='object')v.socialDays={};
 if(!Array.isArray(v.memories))v.memories=[];
 if(!Number.isFinite(v.lastDay))v.lastDay=p.birthDay||1;
 return v;
}
function ensureWorld(s){if(!s||!Array.isArray(s.pets))return s;s.version='1.2.0';for(const p of s.pets)ensure(p);if(!Array.isArray(s.friends))s.friends=[];if(!s.peerId){const key=(s.createdAt||Date.now())+'-'+(s.seed||0);s.peerId='world-'+key.toString().replace(/[^a-zA-Z0-9_-]/g,'').slice(0,44);}return s;}
function threshold(level){return Math.ceil(14+level*5+Math.pow(level,1.75)*2.5);}
function minAge(level){if(level<=3)return (level-1)*2;if(level<=6)return 4+(level-3)*3;if(level<=10)return 13+(level-6)*3;if(level<=15)return 25+(level-10)*3;if(level<=22)return 40+(level-15)*3;return 61+(level-22)*4;}
function epoch(p){const v=ensure(p);return [...EPOCHS].reverse().find(x=>v.level>=x.level)||EPOCHS[0];}
function inputs(p,quality=80){return [clamp(p.satiety)/100,clamp(p.joy)/100,clamp(p.energy)/100,clamp(p.bond)/100,clamp(quality)/100,clamp((p.ageDays||0)*1.4)/100];}
function forward(p,quality){const b=ensure(p).brain,iv=inputs(p,quality),hs=b.hidden.map(row=>Math.tanh(row.reduce((a,w,i)=>a+w*iv[i],0))),scores=b.out.map(row=>row.reduce((a,w,i)=>a+w*hs[i],0));return{iv,hs,scores};}
function decide(p,quality=80){const z=forward(p,quality);let k=0;for(let i=1;i<3;i++)if(z.scores[i]>z.scores[k])k=i;ensure(p).intent=MOVES[k];ensure(p).brain.lastChoice=k;return MOVES[k];}
function learn(p,kind,reward,quality=80){const v=ensure(p),b=v.brain,z=forward(p,quality),action={feed:1,rest:1,play:2,talk:2,wash:0,social:2,explore:0}[kind]??0;
 const lr=Math.min(.035,.012+v.level*.0006),scale=clamp(reward,-1,1)*lr;const before=b.out[action].slice();
 for(let i=0;i<6;i++)b.out[action][i]=clamp(b.out[action][i]+scale*z.hs[i],-3,3);
 for(let i=0;i<6;i++){const g=(1-z.hs[i]*z.hs[i])*before[i]*scale*.25;for(let j=0;j<6;j++)b.hidden[i][j]=clamp(b.hidden[i][j]+g*z.iv[j],-3,3);}
 b.trained++;v.trained=b.trained;return decide(p,quality);
}
function gain(s,p,amount,reason){const v=ensure(p);v.xp+=Math.max(0,amount);v.earned+=Math.max(0,amount);let ups=0;
 while(v.level<250&&v.xp>=threshold(v.level)&&p.ageDays>=minAge(v.level+1)){
 v.xp-=threshold(v.level);v.level++;ups++;
 const e=epoch(p);v.epoch=e.label;
 if(EPOCHS.some(k=>k.level===v.level))E.log(s,'🧬 '+p.name+' еволуираше: '+e.label+' (ниво '+v.level+').','milestone');
 }
 if(ups&&v.memories.length<60)v.memories.push({day:s.lastDay,event:'Ниво '+v.level,reason});
 return ups;
}
function progress(p){const v=ensure(p),e=epoch(p);return{level:v.level,xp:Math.round(v.xp),next:threshold(v.level),ageGate:minAge(v.level+1),epoch:e.label,description:e.description,limbs:e.limbs,feelers:e.feelers,tail:e.tail,trained:v.trained,intent:v.intent||'истражува',memories:v.memories.slice(-6)};}
function tick(s){ensureWorld(s);for(const p of s.pets){const v=ensure(p),missing=Math.min(365,Math.max(0,s.lastDay-v.lastDay));if(!missing)continue;const habitat=s.habitats.find(x=>x.id===p.habitatId);
 for(let i=0;i<missing;i++){
 const q=habitat?E.envScore(habitat):60;
 const mood=(clamp(p.satiety)+clamp(p.joy)+clamp(p.clean))/300;
 const intent=decide(p,q);
 const amt=3+Math.round(q/24)+Math.round(mood*4);
 gain(s,p,amt,'Дневен развој');
 if(intent==='истражува')p.joy=clamp(p.joy+.12);
 else if(intent==='одмора')p.energy=clamp(p.energy+.15);
 else p.bond=clamp(p.bond+.11);
 }v.lastDay=s.lastDay;
 }}
function socialize(s,petId,friendId){ensureWorld(s);const p=s.pets.find(x=>x.id===petId);if(!p)return {ok:false,message:'Непознат миленик.'};
 const key=String(friendId||'').slice(0,60);if(!/^[a-zA-Z0-9_-]{1,60}$/.test(key))return {ok:false,message:'Невалиден P2P идентификатор.'};
 const v=ensure(p);if(Object.prototype.hasOwnProperty.call(v.socialDays,key)&&v.socialDays[key]===s.lastDay)return{ok:false,message:'Веќе се дружеа денес.'};
 v.socialDays[key]=s.lastDay;p.joy=clamp(p.joy+8);p.bond=clamp(p.bond+3);
 learn(p,'social',.85);gain(s,p,10,'P2P дружба');
 E.log(s,'🤝 '+p.name+' се дружеше со милениче од пријател.','care');return{ok:true,message:'Успешна P2P дружба · +10 XP и +8 радост.'};}
function addFriend(s,id,name){ensureWorld(s);id=String(id||'').slice(0,60);if(!id||id===s.peerId)return false;name=String(name||'Пријател').slice(0,32);
 let f=s.friends.find(x=>x.id===id);if(f){f.name=name;f.lastSeen=Date.now();return true;}
 if(s.friends.length>=100)return false;s.friends.push({id,name,lastSeen:Date.now()});return true;}
E.VERSION='1.2.0';
E.newGame=(...a)=>ensureWorld(old.newGame(...a));
E.validate=s=>!!s&&['1.1.0','1.2.0'].includes(s.version)&&old.validate({...s,version:'1.1.0'});
E.createPet=(s,i)=>{ensureWorld(s);const r=old.createPet(s,i);if(r.ok){const p=E.currentPet(s);ensure(p);p.evolution.lastDay=s.lastDay;}return r;};
E.petCare=(s,id,kind)=>{ensureWorld(s);const p=s.pets.find(x=>x.id===id);const r=old.petCare(s,id,kind);
 if(r.ok&&p){const h=s.habitats.find(x=>x.id===p.habitatId);learn(p,kind,.6+(p.bond||0)/500,h?E.envScore(h):80);
 gain(s,p,kind==='talk'?11:kind==='play'?10:8,'Грижа: '+kind);
 p.reaction=kind;p.reactionAt=Date.now();
 }return r;};
E.advance=(s,now)=>{ensureWorld(s);const n=old.advance(s,now);tick(s);return n;};
E.demoNext=s=>{ensureWorld(s);const r=old.demoNext(s);if(r.ok)tick(s);return r;};
E.ensureEvolution=ensure;E.evolutionProgress=progress;E.evolutionTick=tick;E.evolutionDecide=decide;E.evolutionLearn=learn;E.evolutionGain=gain;E.socialize=socialize;E.addFriend=addFriend;E.ensureEvolutionWorld=ensureWorld;E.EVOLUTION_EPOCHS=EPOCHS;
if(typeof module==='object'&&module.exports)module.exports={ensure,ensureWorld,progress,tick,learn,decide,socialize,gain,threshold,minAge};
})(typeof globalThis!=='undefined'?globalThis:this);
