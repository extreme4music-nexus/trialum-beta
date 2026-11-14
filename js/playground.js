/* TRIALUM 1.5.6-C local playground.
 * Offline first. No ads, servers, tracking, account, paid rewards or IAP.
 * Shared playground and visits will use independent server-authoritative rules in D. */
(function(root){
'use strict';
const E=()=>root.TrialumEngine;
const P=()=>root.TrialumPresence;
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TOYS=Object.freeze([
 {id:'sandbox',name:'Песочник со симболи',icon:'🏖️',min:15,lab:4,cost:0,skill:'symbols',initial:true,desc:'Ископај знаци и погоди ја шемата'},
 {id:'seesaw',name:'Клацкалка',icon:'⚖️',min:15,lab:4,cost:0,skill:'wave',initial:true,desc:'Баланс, поздрав и заедничка игра'},
 {id:'slide',name:'Шарена лизгалка',icon:'🛝',min:20,lab:4,cost:16,skill:'leap',initial:false,desc:'Скок и меко спуштање'},
 {id:'pool',name:'Базенче',icon:'🏊',min:25,lab:5,cost:25,skill:'leap',initial:false,desc:'Пливање со смешни прскања'},
 {id:'obstacle',name:'Патека со загатки',icon:'🧩',min:35,lab:8,cost:38,skill:'logic',initial:false,desc:'Препреки, логика и точни решенија'},
 {id:'trampoline',name:'Трамболина',icon:'✨',min:45,lab:9,cost:52,skill:'spin',initial:false,desc:'Високи скокови и воздушни вртења'}
]);
const MAX_SKILL={wave:3,spin:5,leap:6,symbols:10,logic:14,dialogue:20};
let active=null,raf=null,canvas=null,world=null,choice='sandbox',challenge=null,notify=()=>{},renderAgain=()=>{};
let viewportObserver=null,inViewport=true;
const maxActions=4;
const num=(v,min,max)=>Math.min(max,Math.max(min,Number.isFinite(Number(v))?Number(v):0));
function ensure(s){
 if(!s||typeof s!=='object')return null;
 if(!s.playground||typeof s.playground!=='object')s.playground={version:1,unlocked:['sandbox','seesaw'],space:1,practice:{}};
 const q=s.playground;
 q.version=1;
 q.unlocked=Array.isArray(q.unlocked)?[...new Set(q.unlocked.filter(id=>TOYS.some(t=>t.id===id)))]:[];
 for(const id of ['sandbox','seesaw'])if(!q.unlocked.includes(id))q.unlocked.unshift(id);
 q.space=Math.floor(num(q.space,1,5));
 q.practice=q.practice&&typeof q.practice==='object'&&!Array.isArray(q.practice)?q.practice:{};
 // Additive LW-C fields; legacy saves never acquire retrospective play XP.
 // Null-prototype map prevents restored arbitrary pet IDs from mutating
 // Object.prototype (e.g. "__proto__"); only own serialized records survive.
 const oldSessions=q.autonomy&&typeof q.autonomy==='object'&&!Array.isArray(q.autonomy)?q.autonomy:{};
 if(Object.getPrototypeOf(oldSessions)!==null)
  q.autonomy=Object.assign(Object.create(null),oldSessions);
 else q.autonomy=oldSessions;
 q.autonomyHistory=Array.isArray(q.autonomyHistory)?q.autonomyHistory.slice(0,20):[];
 return q;
}
function eligible(s){
 const p=E().currentPet(s),lv=p?E().evolutionProgress(p).level:0,lab=s?.research?.level||0;
 return {ok:!!p&&lv>=15&&lab>=4,level:lv,lab,pet:p};
}
function creditBalance(s){E().ensureLongplay?.(s);return Math.max(0,Number(s.longplay?.credits)||0);}
function spendCredits(s,n,reason){
 if(!Number.isInteger(n)||n<0||creditBalance(s)<n)return false;
 const l=s.longplay;
 l.credits-=n;
 if(!Array.isArray(l.ledger))l.ledger=[];
 l.ledger.push({day:s.lastDay,value:-n,reason:String(reason).slice(0,70),type:'spent'});
 if(l.ledger.length>400)l.ledger.shift();
 return true;
}
function slots(q){return 2+q.space;}
function unlock(s,id){
 const q=ensure(s),toy=TOYS.find(t=>t.id===id),g=eligible(s);
 if(!toy||!g.ok)return {ok:false,message:'🔒 Игротеката бара миленик ниво 15 и лабораторија 4.'};
 if(q.unlocked.includes(id))return {ok:false,message:'Оваа играчка е веќе отклучена.'};
 if(g.level<toy.min||g.lab<toy.lab)return {ok:false,message:'🔒 Потребни се миленик ниво '+toy.min+' и лабораторија '+toy.lab+'.'};
 if(q.unlocked.length>=slots(q))return {ok:false,message:'Прво прошири ја игротеката за да има место.'};
 if(!spendCredits(s,toy.cost,'Игротека: '+toy.name))return {ok:false,message:'Потребни се '+toy.cost+' кредити заработени во играта.'};
 q.unlocked.push(id);E().log?.(s,'🎠 Отклучена играчка: '+toy.name,'milestone');
 return {ok:true,message:'🎉 Отклучена е '+toy.name+'!'};
}
function expand(s){
 const q=ensure(s),g=eligible(s);if(!g.ok)return {ok:false,message:'Игротеката е заклучена.'};
 if(q.space>=5)return {ok:false,message:'Просторот е максимално проширен.'};
 const cost=12+q.space*14;
 if(!spendCredits(s,cost,'Проширување на игротеката'))return {ok:false,message:'Потребни се '+cost+' заработени кредити.'};
 q.space++;
 E().log?.(s,'🌳 Игротеката е проширена на простор '+q.space,'milestone');
 return {ok:true,message:'🌳 Доби нов простор за уште една играчка!'};
}
function record(s,pet,toy){
 const q=ensure(s),day=s.lastDay;
 const log=q.practice[pet.id]||{day,count:0,points:{}};
 if(log.day!==day){log.day=day;log.count=0;log.points={};}
 if(log.count>=maxActions)return {ok:false,message:'🐾 Денешните игри завршија. Утре пак!'};
 if((Number(pet.energy)||0)<5)return {ok:false,message:'Миленичето треба прво да одмори.'};
 log.count++;
 log.points=log.points&&typeof log.points==='object'?log.points:{};
 q.practice[pet.id]=log;
 pet.energy=num(pet.energy-3,0,100);
 // No skill can be learned out of thin air by a toy, and no skill cap is bypassed.
 pet.skills=pet.skills||{};
 const skill=toy.skill,already=Number(pet.skills?.[skill]||0);
 let upgraded=false;
 if(already>0&&already<(MAX_SKILL[skill]||0)){
   const next=(Number(log.points[skill])||0)+3;
   const threshold=6+already*4;
   if(next>=threshold){pet.skills[skill]=already+1;log.points[skill]=next-threshold;upgraded=true;}
   else log.points[skill]=next;
 }
 E().evolutionGain?.(s,pet,4,'Игротека');
 E().log?.(s,'🎠 '+pet.name+' игра на '+toy.name,'care');
 return {ok:true,message:upgraded?'⭐ Ново ниво на вештината '+skill+'!':'🎉 '+pet.name+' успешно играше · +4 еволутивен XP',skill,upgraded};
}
function questions(toy,pet){
 if(toy.skill==='symbols'&&(pet.skills?.symbols||0)>0){
  const sets=[
   {question:'Кој симбол следува? ✦ ◇ ✦ ?',options:['◇','✦','☼'],answer:'◇'},
   {question:'Кој симбол следува? ☼ △ △ ☼ ?',options:['☼','△','✦'],answer:'△'}
  ];return sets[(Number(pet.skills.symbols)||0)%sets.length];
 }
 if(toy.skill==='logic'&&(pet.skills?.logic||0)>0){
  return {question:'Пронајди го следниот број: 2 · 4 · 6 · ?',options:['7','8','9'],answer:'8'};
 }
 return null;
}
// LW-C v2: real play starts in seconds, persists bounded decisions, and keeps
// independent rewards capped. The 2h LW-A lease is a safety expiry, NOT an
// activity cooldown or an XP timer.
const AUTONOMY_STEPS=4,MINUTE=60000,FIRST_ACTION_MS=4000,ACTION_INTERVAL_MS=12000,VISUAL_INTERVAL_MS=5000,MAX_LOG=16;
function hashSeed(text){
 let hash=2166136261;
 for(const char of String(text)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
 return hash>>>0;
}
function eligibleToys(s,p,q){
 const level=E().evolutionProgress(p).level,lab=Number(s.research?.level)||0;
 return TOYS.filter(t=>q.unlocked.includes(t.id)&&level>=t.min&&lab>=t.lab)
  .map(t=>t.id).sort();
}
// Legacy function kept for external QA callers; it is the lease safety bound,
// never a promise that play/XP waits for the session to finish.
function durationMs(){return P()?.LOCAL_SESSION_MS||2*60*MINUTE;}
function newAutonomy(s,p,loc){
 const q=ensure(s),toys=eligibleToys(s,p,q),startedAt=loc.startedAt;
 if(!toys.length)return null;
 const duration=durationMs();
 return {version:2,petId:p.id,sessionId:loc.sessionId,startedAt,
  durationMs:duration,endAt:startedAt+duration,seed:hashSeed(loc.sessionId+'|'+p.id+'|'+startedAt),
  energyStart:num(p.energy,0,100),toys,events:[],activityLog:[],activityCount:0,
  nextAt:startedAt+FIRST_ACTION_MS,lastObservedAt:startedAt,finished:false};
}
function migrateExisting(s,p,now){
 const a=ensure(s).autonomy[p.id];
 if(!a||a.version!==1||a.finished)return a;
 const loc=P()?.get(s,p.id);
 if(!loc||loc.kind!==P().LOCAL||loc.sessionId!==a.sessionId||
  !Number.isSafeInteger(now)||now<a.lastObservedAt||
  !Array.isArray(a.events)||a.events.length>AUTONOMY_STEPS||
  !Array.isArray(a.toys)||!a.toys.length||a.toys.some(id=>!TOYS.some(t=>t.id===id)))return a;
 // Preserve all v1 earned events, XP and skills. No retroactive replay of
 // elapsed 6-22 minute checkpoints and no reset of the daily action limit.
 a.version=2;a.durationMs=durationMs();a.endAt=a.startedAt+a.durationMs;
 a.activityCount=a.events.length;a.activityLog=[];
 a.lastObservedAt=now;a.nextAt=now+FIRST_ACTION_MS;
 return a;
}
function sessionFor(s,p){
 const a=ensure(s).autonomy[p.id];
 return a&&a.version===2&&!a.finished&&a.petId===p.id&&
  typeof a.sessionId==='string'&&Array.isArray(a.events)&&
  a.events.length<=AUTONOMY_STEPS&&Number.isSafeInteger(a.endAt)&&
  Number.isSafeInteger(a.startedAt)&&Number.isSafeInteger(a.lastObservedAt)&&
  Number.isSafeInteger(a.nextAt)&&a.nextAt>=a.startedAt+FIRST_ACTION_MS&&
  Number.isSafeInteger(a.durationMs)&&a.durationMs===durationMs()&&
  a.endAt===a.startedAt+a.durationMs&&Array.isArray(a.toys)&&a.toys.length>=1&&
  a.toys.length<=TOYS.length&&
  a.toys.every(id=>TOYS.some(toy=>toy.id===id))&&
  Number.isSafeInteger(a.activityCount)&&a.activityCount>=a.events.length&&a.activityCount<=720&&
  Array.isArray(a.activityLog)&&a.activityLog.length<=MAX_LOG&&
  a.events.every((e,i)=>e&&e.ordinal===i+1&&a.toys.includes(e.toyId)&&
   Number.isSafeInteger(e.at)&&e.at>=a.startedAt&&e.at<=a.endAt&&
   (e.xp===0||e.xp===4))?a:null;
}
const DIALOGUE=Object.freeze([
 ['Ајде да играме заедно!', 'Супер! Каде одиме?'],
 ['Што откри денес?', 'Нова патека низ тревата!'],
 ['Ќе пробаме со клацкалката?', 'Да! Ќе се менуваме.'],
 ['Зошто светка песокот?', 'Можеби крие нова тајна.'],
 ['Здраво, пријателче!', 'Здраво! Убаво е тука.']
]);
function localDialogue(s,p,now=Date.now()){
 const ai=root.TrialumPlaygroundAI?.speech?.('playground');
 if(ai)return ai;
 // Opted-in local LLM is the primary dialogue renderer. The old
 // 4-second scripted captions belong only to disabled/unavailable AI.
 if(root.TrialumPlaygroundAI?.suppressSimulation?.('playground',s,p))return null;
 const a=p&&s?.playground?.autonomy?.[p.id];
 if(!a||a.finished||!Number.isSafeInteger(now)||now<a.startedAt||now>=a.endAt)return null;
 const local=(s?.pets||[]).filter(x=>P()?.isAt(s,x.id,P().LOCAL));
 if(!local.some(x=>x.id===p.id))return null;
 const slot=Math.floor((now-a.startedAt)/4000),pair=DIALOGUE[hashSeed(a.seed+'|dialogue|'+Math.floor(slot/2))%DIALOGUE.length];
 const friends=local.filter(x=>x.id!==p.id).sort((x,y)=>String(x.id).localeCompare(String(y.id)));
 const other=friends[0];
 const phrase=other?pair[slot%2?1:0]:slot%2?'Ми треба малку одмор.':'Да видам што има тука!';
 const text=root.TrialumI18n?.t?.(phrase)||phrase;
 return other?{speaker:slot%2?other.name:p.name,text,partner:other.id}:
  {speaker:p.name,text,partner:null};
}
function spectator(s,p,now=Date.now()){
 const a=p&&s?.playground?.autonomy?.[p.id];
 if(!a||a.finished||!Number.isSafeInteger(now)||!Number.isSafeInteger(a.startedAt)||
  now<a.startedAt||now>=a.endAt||!Array.isArray(a.toys)||!a.toys.length)return null;
 const loc=P()?.get(s,p.id);
 if(!loc||loc.kind!==P().LOCAL||loc.sessionId!==a.sessionId)return null;
 const toys=a.toys.filter(id=>TOYS.some(t=>t.id===id));
 if(!toys.length)return null;
 const slot=Math.floor((now-a.startedAt)/VISUAL_INTERVAL_MS);
 const toyId=toys[hashSeed(a.seed+'|visual|'+slot)%toys.length];
 const roll=hashSeed(a.seed+'|visual-kind|'+slot)%100;
 const kind=roll<16?'rest':roll<34?'observe':roll<45?'hesitate':'explore';
 return {toyId,kind,slot,phase:((now-a.startedAt)%VISUAL_INTERVAL_MS)/VISUAL_INTERVAL_MS};
}
function nextCheckpoint(s,p,now=Date.now()){
 const a=p&&sessionFor(s,p);
 if(!a||!Number.isSafeInteger(now)||now>=a.endAt)return null;
 return {index:a.activityCount+1,due:a.nextAt,seconds:Math.max(0,Math.ceil((a.nextAt-now)/1000))};
}
function refreshProgress(s,now=Date.now()){
 const node=root.document?.getElementById?.('pgAutoNext');
 const talk=root.document?.getElementById?.('pgAutoTalk');
 const p=s?.pets?.find(x=>x.id===s.selectedPet);
 const next=nextCheckpoint(s,p,now);
 const label=root.TrialumI18n?.t?.('Следна интеракција за')||'Следна интеракција за';
 const unit=root.TrialumI18n?.t?.('сек.')||'сек.';
 if(node)node.textContent=next?label+' '+next.seconds+' '+unit:'';
 const speech=localDialogue(s,p,now);
 if(talk)talk.textContent=speech?speech.speaker+': '+speech.text:'';
}
function summarize(s,p,a,now,reason){
 if(a.finished)return null;
 const q=ensure(s),events=a.events;
 const award=events.filter(x=>x.xp>0);
 const summary={sessionId:a.sessionId,petId:p.id,petName:p.name,activityCount:a.activityCount||0,
  elapsedMs:Math.max(0,Math.min(a.durationMs,Math.max(0,now-a.startedAt))),
  toysUsed:[...new Set([...(a.activityLog||[]),...events].map(x=>x.toyId).filter(Boolean))].slice(0,TOYS.length),
  xpEarned:award.reduce((n,x)=>n+x.xp,0),
  practiceCount:award.length,energySpent:award.reduce((n,x)=>n+(x.energySpent||0),0),
  skillChanges:award.filter(x=>x.skillAfter>x.skillBefore)
   .map(x=>({skill:x.skill,before:x.skillBefore,after:x.skillAfter})),
  reason,completedAt:now};
 a.finished=true;a.reason=reason;
 q.lastAutonomySummary=summary;
 q.autonomyHistory.unshift(summary);q.autonomyHistory.length=Math.min(q.autonomyHistory.length,20);
 return summary;
}
function settlePet(s,p,now,autoReturn=true){
 migrateExisting(s,p,now);
 const a=sessionFor(s,p);if(!a)return {changed:false};
 const loc=P()?.get(s,p.id);
 if(!loc||loc.kind!==P().LOCAL||loc.sessionId!==a.sessionId){
  const summary=summarize(s,p,a,now,'presence_lost');
  return {changed:!!summary,summary};
 }
 if(!Number.isSafeInteger(now)||now<a.startedAt||now<a.lastObservedAt)
  return {changed:false,clockRollback:now<a.lastObservedAt};
 const cutoff=Math.min(now,a.endAt);
 let changed=false,processed=0;
 // Never loop hundreds of times after a long offline absence. 8 bounded
 // decisions are sufficient to settle four reward slots, then fast-forward
 // the visual timeline. Observations never yield coins or server currency.
 while(a.nextAt<=cutoff&&processed<8&&a.activityCount<720){
  const due=a.nextAt,ordinal=a.events.length+1,turn=a.activityCount+1;
  const toyId=a.toys[hashSeed(a.seed+'|toy|'+turn)%a.toys.length];
  const toy=TOYS.find(t=>t.id===toyId),other=(s.pets||[]).some(x=>x.id!==p.id&&P()?.isAt(s,x.id,P().LOCAL));
  const roll=hashSeed(a.seed+'|behavior|'+turn)%100;
  let kind=turn===1?'practice':other&&roll<22?'talk':roll<34?'rest':
   roll<43?'hesitate':roll<51?'observe':'practice';
  const before=num(p.skills?.[toy.skill],0,20),energy=num(p.energy,0,100);
  let xp=0,after=before;
  if(kind==='practice'&&a.events.length>=AUTONOMY_STEPS)kind='explore';
  if(kind==='practice'&&a.events.length<AUTONOMY_STEPS){
   if(!eligibleToys(s,p,ensure(s)).includes(toyId))kind='observe';
   else{
    const r=record(s,p,toy);
    if(r.ok){xp=4;after=num(p.skills?.[toy.skill],0,20);}
    else kind='rest';
   }
  }
  if(a.events.length<AUTONOMY_STEPS){
   a.events.push({ordinal,at:due,toyId,kind,xp,skill:toy.skill,
    skillBefore:before,skillAfter:after,
    energySpent:xp?Math.max(0,energy-num(p.energy,0,100)):0});
  }
  a.activityLog.push({at:due,kind,toyId,xp});
  if(a.activityLog.length>MAX_LOG)a.activityLog.shift();
  a.activityCount++;
  a.nextAt+=ACTION_INTERVAL_MS;processed++;changed=true;
 }
 if(a.nextAt<=cutoff)a.nextAt=cutoff+ACTION_INTERVAL_MS;
 if(changed)a.lastObservedAt=now;
 if(now>=a.endAt&&autoReturn){
  const returned=P().returnHome(s,p.id,a.sessionId);
  if(returned.ok){
   const summary=summarize(s,p,a,Math.min(now,a.endAt),'completed');
   return {changed:true,summary};
  }
 }
 return {changed};
}
function reconcile(s,now=Date.now()){
 if(!s||!Number.isSafeInteger(now)||now<1)return {changed:false,summaries:[]};
 const q=ensure(s),summaries=[];let changed=false;
 for(const p of s.pets||[]){
  if(!p||!q.autonomy[p.id])continue;
  const result=settlePet(s,p,now,true);
  if(result.changed)changed=true;
  if(result.summary)summaries.push(result.summary);
 }
 return {changed,summaries};
}
function send(s,now=Date.now()){
 const g=eligible(s);if(!g.ok)return {ok:false,message:'Прво отклучи ја локалната игротека.'};
 if(!P())return {ok:false,message:'Системот за присуство не е достапен.'};
 const admitted=P().enter(s,g.pet.id,P().LOCAL,null,now);
 if(!admitted.ok)return admitted;
 const q=ensure(s),session=newAutonomy(s,g.pet,P().get(s,g.pet.id));
 // Missing or invalid old-world toy setup does not undo LW-A safe admission.
 if(session)q.autonomy[g.pet.id]=session;
 return {...admitted,message:'🐾 Миленичето самостојно ќе ја истражува игротеката.'};
}
function returnPet(s,now=Date.now()){
 const g=eligible(s),p=g.pet,a=p&&P()?.get(s,p.id);
 if(!p||a?.kind!==P()?.LOCAL)return {ok:false,message:'Миленичето не е во локалната игротека.'};
 const due=settlePet(s,p,now,false);
 const r=P().returnHome(s,p.id,a.sessionId);
 if(r.ok){
  const session=sessionFor(s,p),summary=session&&summarize(s,p,session,now,'returned');
  active=null;challenge=null;
  return {...r,summary:summary||due.summary||null,
   message:summary?'🏠 Миленичето се врати · +'+summary.xpEarned+' XP од самостојна игра.':r.message};
 }
 return r;
}
function canPlay(s,pet){return P()?.isAt(s,pet?.id,P().LOCAL)===true;}
function start(s,id){
 const q=ensure(s),g=eligible(s),toy=TOYS.find(x=>x.id===id);
 if(!g.ok||!toy||!q.unlocked.includes(id))return {ok:false,message:'Оваа играчка сè уште не е отклучена.'};
 if(!canPlay(s,g.pet))return {ok:false,message:'Прво испрати го миленичето во локалната игротека.'};
 const log=q.practice[g.pet.id];
 if(log?.day===s.lastDay && log.count>=maxActions)return {ok:false,message:'Денес миленичето веќе играше доволно. Повтори го трикот бесплатно.'};
 if(Number(g.pet.energy)<5)return {ok:false,message:'Миленичето треба да одмори.'};
 choice=id;
 challenge=questions(toy,g.pet);
 if(challenge){challenge={...challenge,petId:g.pet.id,toy:id,day:s.lastDay};
   active={petId:g.pet.id,toy:id,skill:toy.skill,start:performance.now()/1000,duration:2.7};
   return {ok:true,challenge:true,message:'Реши ја задачата за да заработиш XP.'};
 }
 return complete(s,id);
}
function complete(s,id){
 const q=ensure(s),g=eligible(s),toy=TOYS.find(x=>x.id===id);
 if(!g.ok||!toy||!q.unlocked.includes(id))return {ok:false,message:'Оваа играчка е заклучена.'};
 if(!canPlay(s,g.pet))return {ok:false,message:'Миленичето не е во игротеката.'};
 const r=record(s,g.pet,toy);
 if(r.ok){
  active={petId:g.pet.id,toy:id,skill:toy.skill==='symbols'&&!(g.pet.skills?.symbols)?'wave':toy.skill,start:performance.now()/1000,duration:3.1};
  challenge=null;
  choice=id;
 }
 return r;
}
function answer(s,value){
 if(!challenge)return {ok:false,message:'Нема активна загатка.'};
 if(challenge.petId!==s.selectedPet||challenge.day!==s.lastDay||challenge.toy!==choice){challenge=null;return {ok:false,message:'Загатката е истечена. Почни нова игра.'};}
 if(String(value)!==challenge.answer)return {ok:false,message:'Пробај пак. Нема казна или изгубена акција.'};
 return complete(s,choice);
}
function replay(s,id){
 challenge=null;
 const q=ensure(s),g=eligible(s),toy=TOYS.find(x=>x.id===id);
 if(!g.ok||!toy||!q.unlocked.includes(id))return {ok:false,message:'Оваа играчка е заклучена.'};
 if(!canPlay(s,g.pet))return {ok:false,message:'Прво испрати го миленичето во игротеката.'};
 choice=id;
 active={petId:g.pet.id,toy:id,skill:toy.skill,start:performance.now()/1000,duration:3.1};
 return {ok:true,message:'▶ Гледаш бесплатна реприза, без трошење акции.'};
}
function talk(s,topic){
 const g=eligible(s);if(!g.ok)return {ok:false,message:'Игротеката е заклучена.'};
 if(!canPlay(s,g.pet))return {ok:false,message:'Прво испрати го миленичето во игротеката.'};
 const p=g.pet,choices={
  greeting:'Здраво, пријателе! ♡',
  curious:'Денес научив нешто ново! ✦',
  playing:'Ајде пак да играме! ♪'
 };
 if(!Object.prototype.hasOwnProperty.call(choices,topic))return {ok:false,message:'Непозната комуникација.'};
 if(!(p.skills?.dialogue>0))return {ok:false,message:'🔒 Прво научи ја вештината разговор.'};
 const r=record(s,p,{id:'talk',name:'Комуникација',skill:'dialogue'});
 if(r.ok){
   p.lastSpeech=choices[topic];p.speechAt=performance.now();
   active={petId:p.id,toy:'talk',skill:'dialogue',start:performance.now()/1000,duration:3.3};
   choice='sandbox';
 }
 return r;
}
function trainingDemo(s,petId,skill){
 if(!s?.pets?.some(p=>p.id===petId))return false;
 // The aquarium owns the 2.5D animation; playground mirrors it if visible.
 if(canvas&&world===s){
   active={petId,toy:choice,skill,start:performance.now()/1000,duration:2.8};
 }
 return true;
}
function render(s){
 const q=ensure(s),g=eligible(s),b=creditBalance(s);
 const exp=12+q.space*14;
 if(!g.ok)return '<div class="tab-main"><h2>🎠 Игротека</h2><p class="desc">Место за игра и вистински тренинг на миленичињата — целосно офлајн, без реклами.</p><div class="notice">🔒 Се отклучува со избрано милениче ниво <b>15</b> и истражувачка лабораторија ниво <b>4</b>. Моментално: миленик '+g.level+' · лабораторија '+g.lab+'.</div></div>';
 const pet=g.pet,log=q.practice[pet.id],used=log?.day===s.lastDay?num(log.count,0,maxActions):0;
 const atLocal=canPlay(s,pet),atHome=P()?.atHome(s,pet.id)===true;
 const local=atLocal?P()?.get(s,pet.id):null;
 const session=q.autonomy[pet.id],planned=session?.sessionId===local?.sessionId?session:null;
 const countdown=atLocal?' <span class="small">● Игра во живо · можеш да го вратиш дома кога сакаш</span>':'';
 const locationControls=atLocal?'<button class="primary" data-do="pgReturn">↩ Врати дома</button>'+countdown:atHome?'<button class="primary" data-do="pgSend">🐾 Испрати во игротека</button>':'<span>🐾 Миленичето е на друга локација. Прво врати го.</span>';
 const last=q.lastAutonomySummary?.petId===pet.id?q.lastAutonomySummary:null;
 const lastEvent=planned?.activityLog?.[planned.activityLog.length-1];
 const behavior={practice:'вежба',explore:'истражува',talk:'разговара',observe:'набљудува',hesitate:'се двоуми',rest:'одмора'};
 const latest=lastEvent?' · Последно: '+(behavior[lastEvent.kind]||'игра')+' · '+safe(TOYS.find(t=>t.id===lastEvent.toyId)?.name||''):'';
 const next=planned&&!planned.finished?nextCheckpoint(s,pet):null;
 const wait=next?' <span class="small subtle" id="pgAutoNext">Следна интеракција за '+next.seconds+' сек.</span>':'';
 const dialogue=planned&&!planned.finished?localDialogue(s,pet):null;
 const talkLine=dialogue?'<p class="small subtle" id="pgAutoTalk">'+safe(dialogue.speaker)+': '+safe(dialogue.text)+'</p>':'';
 const progress=planned&&!planned.finished?'<div class="notice" aria-live="polite">🐾 Самостојна игра во реално време · '+(planned.activityCount||0)+' интеракции · '+planned.events.length+'/'+AUTONOMY_STEPS+' наградни активности · +'+planned.events.reduce((n,e)=>n+e.xp,0)+' XP'+latest+'.'+wait+talkLine+'</div>':'';
 const skillReview=last?.skillChanges?.length?'<p>Вештини: '+last.skillChanges.map(x=>safe(x.skill)+' '+x.before+' → '+x.after).join(', ')+'</p>':'';
 const reasonLabel={completed:'завршена сесија',returned:'предвремено враќање',presence_lost:'прекинато присуство'};
 const outcome=last?'<details class="card"><summary>📖 Последно враќање · +'+last.xpEarned+' XP</summary><p>Играно '+Math.floor(last.elapsedMs/MINUTE)+' мин · '+last.practiceCount+' успешни вежби · потрошена енергија '+last.energySpent+'.</p><p>Играчки: '+safe(last.toysUsed.join(', ')||'набљудување')+' · '+safe(reasonLabel[last.reason]||last.reason)+'</p>'+skillReview+'</details>':'';
 let out='<div class="tab-main playground-hub"><div class="playground-title"><div><p class="microcap">МОЈА ИГРОТЕКА · ЛОКАЛНО</p><h2>🎠 Полјана на радоста</h2><p class="desc">Играј во реално време, отклучувај справи и развивај вештини. Без регистрација или интернет.</p></div><span class="tag">Простор '+q.space+'/5</span></div>'+
 '<div class="notice">'+locationControls+'</div>'+progress+outcome+'<div class="pg-board"><canvas id="playgroundScene" width="1000" height="520" role="img" aria-label="Анимирана игротека со милениче и играчки; избери играчка преку копчињата под сликата"></canvas><div class="pg-overlay"><span>🐾 '+safe(pet.name)+' · ниво '+g.level+'</span><span>Игри денес: '+used+'/'+maxActions+'</span></div></div>'+
 '<div class="notice"><strong>💠 '+Math.floor(b)+'</strong> заработени кредити · <strong>'+q.unlocked.length+'/'+slots(q)+'</strong> места за играчки <div class="btn-line"><button data-do="pgExpand"'+(q.space>=5||b<exp?' disabled':'')+'>🌳 Прошири простор · '+exp+' кредити</button></div></div>';
 out+=root.TrialumPlaygroundAI?.control?.(s,pet,'playground',atLocal)||'';
 out+='<h3>Играчки и справи</h3><div class="cards pg-toys">';
 for(const toy of TOYS){
  const has=q.unlocked.includes(toy.id),gate=g.level>=toy.min&&g.lab>=toy.lab,room=q.unlocked.length<slots(q);
  out+='<div class="card pg-toy '+(has?'pg-ready':'locked-card')+'"><h3>'+toy.icon+' '+toy.name+'</h3><p>'+safe(toy.desc)+'</p>'+
     '<p class="small subtle">'+(has?'✓ Отклучено': '🔒 Миленик '+toy.min+' · лабораторија '+toy.lab+' · '+toy.cost+' кредити')+'</p>'+
     (has?'<div class="btn-line"><button class="primary" data-do="pgPlay" data-toy="'+toy.id+'"'+(!atLocal||used>=maxActions?' disabled':'')+'>▶ Играј</button><button data-do="pgReplay" data-toy="'+toy.id+'"'+(!atLocal?' disabled':'')+'>👁 Гледај</button></div>':
       '<button data-do="pgUnlock" data-toy="'+toy.id+'"'+(!gate||!room||b<toy.cost?' disabled':'')+'>🔓 Отклучи · '+toy.cost+'</button>')+
     '</div>';
 }
 out+='</div>';
 if((pet.skills?.dialogue||0)>0)out+='<div class="card pg-challenge"><h3>💬 Миленичето комуницира</h3><p class="desc">Избери кратка порака и гледај како реагира. Не е јавен чет, ниту користи интернет.</p><div class="btn-line"><button data-do="pgTalk" data-topic="greeting">👋 Здраво!</button><button data-do="pgTalk" data-topic="curious">✦ Што научи?</button><button data-do="pgTalk" data-topic="playing">♡ Ајде игра!</button></div></div>';
 if(challenge)out+='<div class="card pg-challenge" aria-live="polite"><h3>🧠 '+safe(challenge.question)+'</h3><div class="btn-line">'+challenge.options.map(v=>'<button data-do="pgAnswer" data-answer="'+safe(v)+'">'+safe(v)+'</button>').join('')+'</div></div>';
 out+='<p class="small subtle">Миленичето само одбира меѓу отклучените справи, понекогаш набљудува или одмора. XP е ограничено по сесија и ден; гледањето анимации не носи XP. Рачниот тренинг останува достапен за тестирање на научените вештини.</p></div>';
 return out;
}
function draw(ctx,s,t){
 const W=1000,H=520,q=ensure(s),g=eligible(s);
 ctx.clearRect(0,0,W,H);
 const sky=ctx.createLinearGradient(0,0,0,H);
 sky.addColorStop(0,'#173e6b');sky.addColorStop(.62,'#31968f');sky.addColorStop(1,'#6cbf7d');
 ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
 for(let i=0;i<7;i++){const x=(i*179+95)%W,y=55+i%3*43;ctx.fillStyle='rgba(235,255,250,.18)';ctx.beginPath();ctx.ellipse(x,y,74,18,0,0,Math.PI*2);ctx.fill();}
 ctx.fillStyle='#348c65';ctx.fillRect(0,350,W,170);
 for(let i=0;i<22;i++){const x=26+i*47;ctx.fillStyle=i%2?'#bee485':'#f5efac';ctx.beginPath();ctx.arc(x,452+(i%4)*11,4+(i%3),0,Math.PI*2);ctx.fill();}
 const enabled=id=>q.unlocked.includes(id);
 // Distinct tangible equipment, not static emoji placeholders.
 const sandbox=(x,y)=>{ctx.fillStyle='#e8ab5b';ctx.fillRect(x-90,y-25,180,64);ctx.fillStyle='#ffdf92';ctx.fillRect(x-76,y-18,152,42);ctx.strokeStyle='#bb7b3d';ctx.lineWidth=8;ctx.strokeRect(x-90,y-25,180,64);};
 const seesaw=(x,y)=>{ctx.fillStyle='#8b5aaf';ctx.beginPath();ctx.moveTo(x,y-28);ctx.lineTo(x-24,y+35);ctx.lineTo(x+25,y+35);ctx.closePath();ctx.fill();ctx.save();ctx.translate(x,y-38);ctx.rotate(active?.toy==='seesaw'?Math.sin(t*4)*.18:-.11);ctx.strokeStyle='#e6c6ef';ctx.lineWidth=11;ctx.beginPath();ctx.moveTo(-82,0);ctx.lineTo(82,0);ctx.stroke();ctx.restore();};
 const slide=(x,y)=>{ctx.strokeStyle='#f1b95b';ctx.lineWidth=13;ctx.beginPath();ctx.moveTo(x+45,y-116);ctx.lineTo(x+45,y+34);ctx.moveTo(x-35,y-116);ctx.lineTo(x-85,y+34);ctx.stroke();ctx.strokeStyle='#ffcaa4';ctx.lineWidth=26;ctx.beginPath();ctx.moveTo(x+45,y-112);ctx.quadraticCurveTo(x+8,y-5,x-96,y+32);ctx.stroke();};
 const pool=(x,y)=>{ctx.fillStyle='#5ed6ee';ctx.beginPath();ctx.ellipse(x,y,105,41,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#a7f7fa';ctx.lineWidth=12;ctx.stroke();};
 const obstacle=(x,y)=>{ctx.strokeStyle='#f6c974';ctx.lineWidth=13;for(let i=0;i<3;i++){const xx=x-55+i*55;ctx.beginPath();ctx.moveTo(xx,y+24);ctx.lineTo(xx,y-65+i%2*20);ctx.stroke();}ctx.strokeStyle='#c8eaf0';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(x-55,y-65);ctx.lineTo(x+55,y-65);ctx.stroke();};
 const trampoline=(x,y)=>{ctx.strokeStyle='#fdf1ab';ctx.lineWidth=9;ctx.beginPath();ctx.ellipse(x,y,93,26,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#b25fe5';ctx.beginPath();ctx.ellipse(x,y,87,19,0,0,Math.PI*2);ctx.fill();};
 sandbox(150,410);seesaw(370,398);
 if(enabled('slide'))slide(590,398);else{ctx.globalAlpha=.22;slide(590,398);ctx.globalAlpha=1;}
 if(enabled('pool'))pool(820,426);else{ctx.globalAlpha=.2;pool(820,426);ctx.globalAlpha=1;}
 if(enabled('obstacle'))obstacle(740,315);
 if(enabled('trampoline'))trampoline(460,467);
 const pet=g.pet;if(!pet||!canPlay(s,pet))return;
 const level=g.level,act=active&&active.petId===pet.id&&t<=active.start+active.duration?active:null;
 const view=act?null:spectator(s,pet,Date.now());
 const currentToy=act?.toy||view?.toyId||choice;
 const phase=act?(t-act.start)/act.duration:0;
 const baseX=currentToy==='sandbox'?150:currentToy==='seesaw'?370:currentToy==='slide'?590:currentToy==='pool'?820:currentToy==='obstacle'?740:460;
 const bounce=act?Math.sin(phase*Math.PI*3)*Math.sin(phase*Math.PI)*(currentToy==='trampoline'?96:38):
  view?.kind==='rest'?Math.sin(t*.9)*2:view?.kind==='hesitate'?Math.sin(t*1.3)*5:
  view?.kind==='observe'?Math.sin(t*1.8)*6:Math.sin(t*3.3)*17;
 const x=baseX+(act?Math.sin(phase*Math.PI*2)*(currentToy==='slide'?55:36):
  view?.kind==='explore'?Math.sin(view.phase*Math.PI*2)*24:0);
 const y=act?.toy==='pool'?367+Math.sin(t*8)*9:287-bounce;
 const at={x,y,size:act?.toy==='pool'?.50:.64};
 const mode=act?{skill:act.skill,start:act.start,duration:act.duration}:null;
 if(root.TrialumCreatureArt?.draw&&level>=18)root.TrialumCreatureArt.draw(ctx,pet,at,t,true,E().evolutionProgress(pet),mode);
 else{
   ctx.fillStyle='rgba(7,39,44,.24)';ctx.beginPath();ctx.ellipse(x,371,64,13,0,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='hsl('+num(pet.hue,0,359)+',72%,68%)';ctx.beginPath();ctx.ellipse(x,y,64,62,0,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x-20,y-12,13,0,Math.PI*2);ctx.arc(x+20,y-12,13,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#17324b';ctx.beginPath();ctx.arc(x-18,y-10,5,0,Math.PI*2);ctx.arc(x+22,y-10,5,0,Math.PI*2);ctx.fill();
 }
 ctx.font='bold 20px system-ui';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText(String(pet.name).slice(0,24),x,y+103);
 // Other pets voluntarily present in the same offline playground can join
 // the conversation. Neither party earns XP for speech or animation frames.
 const dialogue=localDialogue(s,pet,Date.now());
 if(dialogue?.partner){
  const partner=(s.pets||[]).find(q=>q.id===dialogue.partner);
  if(partner){
   const bx=x>700?x-145:x+145,by=294+Math.sin(t*2.4)*8;
   ctx.fillStyle='hsl('+num(partner.hue,0,359)+',72%,68%)';
   ctx.beginPath();ctx.arc(bx,by,34,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#17324b';ctx.beginPath();
   ctx.arc(bx-10,by-7,4,0,Math.PI*2);ctx.arc(bx+10,by-7,4,0,Math.PI*2);ctx.fill();
   ctx.font='bold 15px system-ui';ctx.fillStyle='#fff';ctx.fillText(String(partner.name).slice(0,18),bx,by+60);
  }
 }
 if(dialogue){
  ctx.fillStyle='rgba(14,40,61,.87)';ctx.fillRect(175,50,650,64);
  ctx.fillStyle='#f0fff5';ctx.textAlign='center';ctx.font='bold 17px system-ui';
  ctx.fillText((String(dialogue.speaker)+': '+String(dialogue.text)).slice(0,68),500,88);
 }
 if(act?.toy==='pool'){
  ctx.save();ctx.fillStyle='rgba(60,207,244,.49)';ctx.beginPath();ctx.ellipse(820,426,96,28,0,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.fillStyle='rgba(200,250,255,.65)';for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(x-55+i*23,394+Math.sin(t*8+i)*10,5,0,Math.PI*2);ctx.fill();}}
 if(act&&['symbols','logic','dialogue'].includes(act.skill)){ctx.font='bold 28px system-ui';ctx.fillStyle='#fdffd1';ctx.fillText(act.skill==='symbols'?'✦ ◇ ☼':act.skill==='logic'?'2 • 4 • 6':'Здраво! ♡',x,y-104);}
}
function mount(s,{onSelect,onNotice,onRender}={}){
 world=s;notify=typeof onNotice==='function'?onNotice:()=>{};renderAgain=typeof onRender==='function'?onRender:()=>{};
 const next=document.getElementById('playgroundScene');
 if(!next)return;
 if(canvas!==next){
   if(raf!==null){cancelAnimationFrame(raf);raf=null;}
   viewportObserver?.disconnect?.();viewportObserver=null;inViewport=true;
   canvas=next;
   if(typeof root.IntersectionObserver==='function'){
    viewportObserver=new root.IntersectionObserver(entries=>{
     inViewport=Boolean(entries[0]?.isIntersecting);syncPaint();
    },{threshold:0});
    viewportObserver.observe(canvas);
   }
   canvas.addEventListener('click',ev=>{
     const rect=canvas.getBoundingClientRect();
     if(!rect.width)return;
     const px=(ev.clientX-rect.left)*1000/rect.width;
     const py=(ev.clientY-rect.top)*520/rect.height;
     const map=px<255?'sandbox':px<570&&py>450?'trampoline':px<470?'seesaw':px<680?'slide':px>680&&py<365?'obstacle':'pool';
     const id=ensure(s).unlocked.includes(map)?map:'sandbox';
     choice=id;if(typeof onSelect==='function')onSelect(id);
   });
 }
 syncPaint();
}
function canPaint(){return Boolean(canvas&&world&&canvas.isConnected&&inViewport&&
 root.document?.visibilityState!=='hidden'&&!root.document?.hidden);}
function paint(ms){
 raf=null;
 const node=root.document?.getElementById('playgroundScene');
 if(!node||node!==canvas){stop();return;}
 if(!canPaint())return;
 const ctx=node.getContext('2d');if(ctx)draw(ctx,world,ms/1000);
 if(!root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)syncPaint();
}
function syncPaint(){
 if(!canPaint()){if(raf!==null){cancelAnimationFrame(raf);raf=null;}return;}
 if(raf===null)raf=requestAnimationFrame(paint);
}
root.document?.addEventListener?.('visibilitychange',syncPaint);
root.matchMedia?.('(prefers-reduced-motion: reduce)')?.addEventListener?.('change',syncPaint);
function stop(){
 if(raf!==null)cancelAnimationFrame(raf);
 raf=null;viewportObserver?.disconnect?.();viewportObserver=null;
 canvas=null;world=null;inViewport=true;
}
root.TrialumPlayground={ensure,eligible,TOYS,unlock,expand,send,returnPet,reconcile,durationMs,spectator,nextCheckpoint,localDialogue,refreshProgress,start,answer,replay,talk,trainingDemo,render,mount,stop,record,maxActions,questions};
if(typeof module==='object'&&module.exports)module.exports={ensure,eligible,unlock,expand,send,returnPet,reconcile,durationMs,spectator,nextCheckpoint,localDialogue,render,start,answer,replay,talk,record,TOYS,maxActions,questions};
})(typeof globalThis!=='undefined'?globalThis:this);
