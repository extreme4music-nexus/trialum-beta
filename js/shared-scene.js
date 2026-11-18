
(function(root){
'use strict';
let active=null,frame=null,viewportObserver=null,inViewport=true;
const TAU=Math.PI*2;
const DIALOGUE=Object.freeze([
 ['Еј, да пробаме заедно?', 'Да! Јас ќе тргнам прв.'],
 ['Што има зад таа лизгалка?', 'Ајде да откриеме!'],
 ['Гледаш колку шарена е полјаната?', 'Да, многу ми се допаѓа.'],
 ['Ќе се менуваме на клацкалката?', 'Секако, по ред!'],
 ['Сакаш да истражуваме?', 'Сакам! Ти покажи го патот.']
]);
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
 const who=pets[turn%2].pet;
 return {speaker:String(who.name||'Милениче').slice(0,32),text:pair[turn%2],turn,
  ids:pets.slice(0,2).map(x=>x.pet.id)};
}
function refreshCaption(s,now=Date.now()){
 const caption=root.document?.getElementById?.('sharedAutoTalk');
 if(!caption)return;
 const item=dialogue(s,now);
 caption.textContent=item?'🐾 '+item.speaker+': '+item.text:
  '🐾 Миленичињата ќе комуницираат кога двајца пријатели ќе бидат потврдени во истата игротека.';
}

function draw(ctx,s,t){
 ctx.clearRect(0,0,1000,520);
 const sky=ctx.createLinearGradient(0,0,0,520);
 sky.addColorStop(0,'#102d53');sky.addColorStop(.59,'#298f9c');sky.addColorStop(1,'#448b65');
 ctx.fillStyle=sky;ctx.fillRect(0,0,1000,520);
 ctx.fillStyle='#297b5b';ctx.fillRect(0,377,1000,143);
 for(let n=0;n<28;n++){
  ctx.fillStyle=n%2?'#b7f6c9':'#ffe0a4';ctx.beginPath();
  ctx.arc(n*40+20,469+(n%3)*12,2.5+n%3,0,TAU);ctx.fill();
 }
 const items={sandbox:'🏖️',seesaw:'⚖️',slide:'🛝',pool:'🏊',obstacle:'🧩',trampoline:'✨'};
 ctx.font='48px system-ui';ctx.textAlign='center';
 s.toys.forEach((id,i)=>ctx.fillText(items[id]||'🎠',110+(i%6)*155,422+Math.sin(t*.8+i)*5));
 // Pet sprites come from live server leases, NEVER from historical play events.
 const cast=new Map();
 if(s.presenceEnabled){
  for(const [i,o] of (s.occupants||[]).entries()){
   if(!o.pet?.id)continue;
   cast.set('member:'+i,{...o.pet,display:o.pet.name||o.display,
    latest:Date.now(),toy:'seesaw'});
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
  const p=pets[i],period=Math.floor(Date.now()/6000),
   toys=(s.toys||[]).filter(id=>Object.prototype.hasOwnProperty.call(items,id)),
   toyId=toys.length?toys[hash((s.room?.id||'')+'|'+p.id+'|'+period)%toys.length]:'seesaw',
   offset=Math.sin(t*1.4+i+period)*16;
  const x=1000*(i+1)/(pets.length+1)+offset,y=283+Math.sin(t*1.5+i)*17;
  const action={skill:toyId==='slide'?'leap':toyId==='trampoline'?'spin':toyId==='seesaw'?'wave':'symbols',
   start:t-1.5,duration:3.2};
  if(root.TrialumCreatureArt?.draw){
   // Level is visual style only. Server does not trust or transfer real XP.
   root.TrialumCreatureArt.draw(ctx,p,{x,y,size:.38},t,false,{level:28},action);
  }else{
   ctx.fillStyle='hsl('+p.hue+',71%,63%)';ctx.beginPath();
   ctx.arc(x,y,47,0,TAU);ctx.fill();
   ctx.fillStyle='white';ctx.fillRect(x-24,y-13,12,12);ctx.fillRect(x+12,y-13,12,12);
  }
  ctx.fillStyle='#edfff5';ctx.textAlign='center';ctx.font='bold 14px system-ui';
  ctx.fillText(String(p.display||p.name).slice(0,32),x,356);
 }
 const speech=dialogue(s);
 if(speech){
  ctx.fillStyle='rgba(10,39,60,.91)';ctx.fillRect(135,60,730,70);
  ctx.fillStyle='#f0fff5';ctx.font='bold 19px system-ui';ctx.textAlign='center';
  ctx.fillText((speech.speaker+': '+speech.text).slice(0,68),500,103);
 }
 ctx.fillStyle='rgba(11,36,56,.7)';ctx.fillRect(10,12,260,32);
 ctx.fillStyle='#e9fff5';ctx.font='bold 14px system-ui';ctx.textAlign='left';
 ctx.fillText('🔐 Потврдени присутни миленичиња',18,33);
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
