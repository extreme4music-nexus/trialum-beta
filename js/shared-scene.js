
(function(root){
'use strict';
let active=null,frame=null,viewportObserver=null,inViewport=true;
const TAU=Math.PI*2;
const DIALOGUE=Object.freeze([
 {en:['Hey, shall we play together?','Yes! You can choose the first toy.'],mk:['Еј, да пробаме заедно?', 'Да! Ти избери прва справа.']},
 {en:['What is beyond that slide?','Let’s explore it together!'],mk:['Што има зад таа лизгалка?', 'Ајде да откриеме заедно!']},
 {en:['Look at this colorful meadow!','I love it!'],mk:['Гледаш колку шарена е полјаната?', 'Да, многу ми се допаѓа!']},
 {en:['Can we take turns on the seesaw?','Of course, one at a time!'],mk:['Ќе се менуваме на клацкалката?', 'Секако, по ред!']},
 {en:['Shall we explore something new?','Yes! Show me the way.'],mk:['Сакаш да истражуваме?', 'Сакам! Ти покажи го патот.']}
]);
const ui=(en,mk)=>root.TrialumI18n?.language?.()==='mk'?mk:en;
function hash(text){let n=2166136261;for(const ch of String(text)){n^=ch.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
function dialogue(s,now=Date.now()){
 const ai=root.TrialumPlaygroundAI?.speech?.('shared',s?.room?.id);
 if(ai)return ai;
 // The foreground LLM owns the caption; do not drown it in scripted
 // dialogue every 3.5 seconds. Deliberate 10% nudges arrive as actual turns.
 if(root.TrialumPlaygroundAI?.suppressSimulation?.('shared',
   root.TrialumShared?.getWorld?.(),null,s?.room?.id))return null;
 // Only room occupants returned by authenticated live server lease/snapshot
 // are considered. Two clients with the same room snapshot see the same
 // reversible question/answer phase; there is no user text or network send.
 if(!s?.presenceEnabled||!s?.room?.id)return null;
 const pets=(s.occupants||[]).filter(x=>x?.pet?.id)
  .slice(0,6).sort((a,b)=>String(a.pet.id+'|'+a.pet.name).localeCompare(String(b.pet.id+'|'+b.pet.name)));
 if(pets.length<2)return null;
 const turn=Math.floor(now/3500),pairIndex=Math.floor(turn/2),pair=DIALOGUE[
  hash(s.room.id+'|'+pets[0].pet.id+'|'+pets[1].pet.id+'|'+pairIndex)%DIALOGUE.length];
 const who=pets[turn%2].pet,which=turn%2;
 return {speaker:String(who.name||ui('Pet','Милениче')).slice(0,32),
  text:ui(pair.en[which],pair.mk[which]),englishText:pair.en[which],turn,
  ids:pets.slice(0,2).map(x=>x.pet.id)};
}
function refreshCaption(s,now=Date.now()){
 const caption=root.document?.getElementById?.('sharedAutoTalk');
 if(!caption)return;
 const item=dialogue(s,now);
 caption.textContent=item?'🐾 '+item.speaker+': '+item.text:
  ui('🐾 Pets will talk when two friends have confirmed pets in the same playground.',
     '🐾 Миленичињата ќе комуницираат кога двајца пријатели ќе бидат потврдени во истата игротека.');
}

function draw(ctx,s,t){
 // Cached, layered 2D scene with tangible garden equipment; no emoji placeholders.
 if(root.TrialumSharedArt?.paint)root.TrialumSharedArt.paint(ctx,s,t);
 else{
  ctx.clearRect(0,0,1000,520);
  ctx.fillStyle='#18465d';ctx.fillRect(0,0,1000,520);
 }
 const toySlots=root.TrialumSharedArt?.TOYS||{};
 // Pet sprites come from live server leases, NEVER from historical play events.
 const cast=new Map();
 if(s.presenceEnabled){
  for(const [i,o] of (s.occupants||[]).entries()){
   if(!o.pet?.id)continue;
   // Owner/session scope is part of visual identity: two devices restoring
   // the same world may carry identical pet UUIDs without synchronized motion.
   const identity=String(o.ownerId||o.userId||o.memberId||o.display||i);
   cast.set('member:'+identity+':'+o.pet.id,{...o.pet,
    motionKey:identity+'|'+o.pet.id+'|'+(o.pet.seed||0),
    display:o.pet.name||o.display,latest:Date.now(),toy:'seesaw'});
  }
 }else{
  // Disabled legacy fallback is used only in older private test servers.
  for(const e of s.events||[]){
   if(e.kind==='played'&&e.payload?.pet&&Date.now()-Date.parse(e.at)<5000){
    const p=e.payload.pet;
    cast.set('legacy:'+e.actor+':'+p.id,{...p,display:e.actor,
     latest:Date.parse(e.at),toy:e.payload.toyId});
   }
  }
 }
 for(const v of s.visitors||[]){
  if(v.pet){
   cast.set('visit:'+v.id,{...v.pet,display:v.pet.name,
     latest:Date.now(),toy:'seesaw'});
  }
 }
 const pets=[...cast.values()].slice(-6);
 for(let i=0;i<pets.length;i++){
  const p=pets[i],id=String(p.motionKey||p.id||'member-'+i),
   seed=hash((s.room?.id||'')+'|'+id),
   // Each pet owns a different speed, phase and activity window, not the same
   // constantly reinitialized 1.5-second action every single animation frame.
   cycleSeconds=8+(seed%9),phaseOffset=((seed>>>8)%1000)/1000*cycleSeconds,
   cycleIndex=Math.floor((t+phaseOffset)/cycleSeconds),
   elapsed=(t+phaseOffset)%cycleSeconds,
   toys=(s.toys||[]).filter(id=>Object.prototype.hasOwnProperty.call(toySlots,id)),
   toyId=toys.length?toys[hash(id+'|toy|'+cycleIndex)%toys.length]:'seesaw',
   slot=root.TrialumSharedArt?.slot?.(toyId),
   phase=seed%628/100,
   moveSpeed=0.55+(seed%70)/100,
   offset=Math.sin(t*moveSpeed+phase)*21;
  const baseX=slot?.x||1000*(i+1)/(pets.length+1);
  // Distinct paths and lane offsets prevent pets from appearing superimposed.
  const x=baseX+offset+((seed>>>16)%5-2)*18,
   y=Math.max(151,(slot?.y||411)-121)+Math.sin(t*(moveSpeed+.37)+phase)*15;
  const duration=cycleSeconds*.66;
  const action=elapsed<duration?{
    skill:toyId==='slide'?'leap':toyId==='trampoline'?'spin':
      toyId==='seesaw'?'wave':toyId==='obstacle'?'logic':'symbols',
    start:t-elapsed,duration
   }:null;
  if(root.TrialumCreatureArt?.draw){
   // Level is visual style only. Server does not trust or transfer real XP.
   root.TrialumCreatureArt.draw(ctx,p,{x,y,size:.38},t,false,{level:28},action);
  }else{
   ctx.fillStyle='hsl('+p.hue+',71%,63%)';ctx.beginPath();
   ctx.arc(x,y,47,0,TAU);ctx.fill();
   ctx.fillStyle='white';ctx.fillRect(x-24,y-13,12,12);ctx.fillRect(x+12,y-13,12,12);
  }
  ctx.fillStyle='#edfff5';ctx.textAlign='center';ctx.font='bold 14px system-ui';
  ctx.fillText(String(p.display||p.name).slice(0,24),x,Math.min(482,y+75));
 }
 const speech=dialogue(s);
 if(speech){
  ctx.fillStyle='rgba(10,39,60,.91)';ctx.fillRect(135,60,730,70);
  ctx.fillStyle='#f0fff5';ctx.font='bold 19px system-ui';ctx.textAlign='center';
  ctx.fillText((speech.speaker+': '+speech.text).slice(0,68),500,103);
 }
 ctx.fillStyle='#e9fff5';ctx.font='bold 12px system-ui';ctx.textAlign='left';
 ctx.fillText(ui('🔐 Verified present pets','🔐 Потврдени присутни миленичиња'),20,69);
}
// LW-B: independent shared room scene paints only if genuinely visible.
function canPaint(){return Boolean(active&&active.isConnected&&inViewport&&
 root.document?.visibilityState!=='hidden'&&!root.document?.hidden);}
function scheduleFrame(){
 if(!canPaint()){
  if(frame!==null){root.cancelAnimationFrame?.(frame);frame=null;}
  return;
 }
 if(frame===null)frame=root.requestAnimationFrame(paint);
}
function paint(now){
 frame=null;
 if(!canPaint())return;
 const snap=root.TrialumShared?.getState?.()?.snapshot;
 const ctx=active?.getContext?.('2d');if(snap&&ctx)draw(ctx,snap,now/1000);
 if(!root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)scheduleFrame();
}
function mount(){
 const node=root.document?.getElementById('sharedScene');
 if(!node){stop();return;}
 if(active!==node){
  stop();active=node;
  if(typeof root.IntersectionObserver==='function'){
   viewportObserver=new root.IntersectionObserver(entries=>{
    inViewport=Boolean(entries[0]?.isIntersecting);
    scheduleFrame();
   },{threshold:0});
   viewportObserver.observe(node);
  }
 }
 scheduleFrame();
}
function stop(){
 if(frame!==null)root.cancelAnimationFrame?.(frame);
 frame=null;viewportObserver?.disconnect?.();viewportObserver=null;
 active=null;inViewport=true;
}
root.document?.addEventListener?.('visibilitychange',scheduleFrame);
root.matchMedia?.('(prefers-reduced-motion: reduce)')?.addEventListener?.('change',scheduleFrame);
root.TrialumSharedScene={mount,stop,draw,dialogue,refreshCaption};
})(typeof globalThis!=='undefined'?globalThis:this);
