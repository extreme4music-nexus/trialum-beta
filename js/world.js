/* Canvas renderer with precise, direct touch/click selection of visible creatures. */
(function(root){
'use strict';
const E=()=>root.TrialumEngine;const canvas=document.getElementById('world');let ctx=canvas.getContext('2d'),W=1100,H=625,TAU=Math.PI*2;
let state=null,hit=[],last=0,pickCallback=()=>{},phase=0,guest=null,activeTricks=new Map(),lastTrick=0,suppressClickUntil=0;
const TRICKS=['wave','spin','leap','symbols','logic','dialogue'];
const rand=(i,s=1)=>{const v=Math.sin(i*127.81+s*78.233)*43758.54;return v-Math.floor(v)};
function circle(x,y,r,fill,stroke=null,line=1){ctx.beginPath();ctx.arc(x,y,r,0,TAU);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke()}}
function text(content,x,y,size=16,color='#eaffff',align='center'){ctx.font=`700 ${size}px system-ui,sans-serif`;ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(String(content),x,y)}
function path(points,close=true){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(close)ctx.closePath()}
function bg(t){const gradient=ctx.createLinearGradient(0,0,0,H);const h=state&&E().currentHabitat(state);if(!h){gradient.addColorStop(0,'#102f4c');gradient.addColorStop(.65,'#0b4a53');gradient.addColorStop(1,'#0d303f')}else if(h.biome==='crystal'){gradient.addColorStop(0,'#191e58');gradient.addColorStop(.65,'#3c487c');gradient.addColorStop(1,'#1b446b')}else if(h.biome==='garden'){gradient.addColorStop(0,'#163d40');gradient.addColorStop(.6,'#1d614f');gradient.addColorStop(1,'#19413c')}else{gradient.addColorStop(0,'#10355c');gradient.addColorStop(.6,'#13616d');gradient.addColorStop(1,'#143c45')}
 ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
 const glow=ctx.createRadialGradient(550,200,5,550,200,500);glow.addColorStop(0,'#92ffee20');glow.addColorStop(1,'#9fffff00');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
 for(let i=0;i<75;i++){const x=rand(i+12)*W,y=(rand(i+32)*H-(t*12+i*2)%(H+70)+H*2)%(H+70),r=1+rand(i+5)*3;circle(x,y,r,'#dcfffd27','#dcfff31b')}
 ctx.beginPath();ctx.moveTo(0,570);ctx.bezierCurveTo(260,505,380,585,580,554);ctx.bezierCurveTo(770,517,890,555,1100,535);ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.fillStyle=h&&h.biome==='crystal'?'#2d3a67':h&&h.biome==='garden'?'#19544c':'#143b49';ctx.fill();
 for(let i=0;i<23;i++){const x=rand(i+33)*W;ctx.beginPath();ctx.moveTo(x,600);ctx.quadraticCurveTo(x+Math.sin(t+i)*16,568,x+8*Math.cos(t+i),555-rand(i+37)*58);ctx.strokeStyle=i%2?'#5dbd9c68':'#8cc9e35e';ctx.lineWidth=2+rand(i+71)*5;ctx.stroke()}
}
function drawPlant(f,i,t,hue){const x=90+(i*173)%930,y=534+(i%3)*8,growth=f.growth/100;ctx.save();ctx.translate(x,y);ctx.globalAlpha=.5+growth*.5;
 const stem=(70+growth*68);ctx.strokeStyle=hue;ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(Math.sin(t+i)*12,-stem*.6,Math.sin(t+i)*20,-stem);ctx.stroke();
 for(let k=0;k<5;k++){let yy=-12-k*stem/6,xx=Math.sin(t+i)*8;ctx.save();ctx.translate(xx,yy);ctx.rotate((k%2?-.8:.8)+Math.sin(t+i+k)*.06);ctx.beginPath();ctx.ellipse(20,0,25*growth+11,8*growth+7,0,0,TAU);ctx.fillStyle=k%2?'#74ef9f':'#8eecda';ctx.fill();ctx.restore()}
 circle(Math.sin(t+i)*20,-stem,8+growth*6,'#c6fff5');ctx.restore()}
function petPosition(p,index,total){const cols=total>=5?4:total>=3?3:total===2?2:1,rows=Math.ceil(total/cols),col=index%cols,row=Math.floor(index/cols);const x= W*(col+1)/(cols+1)+(row%2?25:-25), y=rows===1?315:205+row*235;const size=cols===1?1:cols===2?.78:.62;return {x,y,size};}
function drawCreatureClassic(p,at,t,selected,act=null){const sz=at.size*(.62+p.growth/150)*((p.evolution?.level||1)>=90?1.23:(p.evolution?.level||1)>=45?1.12:1),r=105*sz;ctx.save();const playing=!!act&&t>=act.start&&t<act.start+act.duration,progress=playing?(t-act.start)/act.duration:0;const reacting=playing||(Date.now()-(p.reactionAt||0)<1600),pose=playing?act.skill:(p.reaction||'');ctx.translate(at.x,at.y+Math.sin(t*1.3+(p.seed||0))*6-(playing&&pose==='leap'?Math.sin(progress*Math.PI)*85:(reacting&&['play','leap'].includes(pose)?Math.sin((Date.now()-p.reactionAt)/1600*Math.PI)*40:0)));ctx.scale(sz*(1+Math.sin(t*1.6+(p.seed||0))*.012),sz*(1-Math.sin(t*1.6+(p.seed||0))*.009));ctx.rotate(Math.sin(t*.7+(p.seed||0))*.035+(playing&&pose==='spin'?progress*Math.PI*2:(reacting&&pose==='spin'?Math.sin((Date.now()-p.reactionAt)/1600*Math.PI)*Math.PI*2:0)));
 if(playing&&pose==='dialogue')ctx.scale(1+Math.sin(progress*Math.PI*7)*.055,1-Math.sin(progress*Math.PI*7)*.05);const hue=p.hue||176,ev=E().evolutionProgress?E().evolutionProgress(p):{limbs:0,feelers:0,tail:0};
 ctx.shadowColor=`hsla(${hue},95%,70%,.5)`;ctx.shadowBlur=selected?44:20;
 // Appendages emerge only at individual evolution milestones; no limbs at birth.
 if(ev.tail){for(let j=0;j<ev.tail;j++){ctx.beginPath();ctx.moveTo(-67,37+j*11);ctx.bezierCurveTo(-135,15+Math.sin(t*2+j)*20,-155,87+Math.sin(t*3+j)*16,-179,38+Math.cos(t*3+j)*24);ctx.strokeStyle='hsl('+hue+',78%,69%)';ctx.lineWidth=13-j*3;ctx.lineCap='round';ctx.stroke();}}
 for(let i=0;i<ev.limbs;i++){const side=i%2?-1:1,rank=Math.floor(i/2),rootX=side*(46+rank*10),rootY=38-rank*24;ctx.beginPath();ctx.moveTo(rootX,rootY);ctx.quadraticCurveTo(rootX+side*42,rootY+22+Math.sin(t*2.4+i)*8,rootX+side*(48+rank*5),rootY+66+Math.sin(t*2.4+i)*(reacting&&pose==='wave'?30:12));ctx.lineWidth=14-rank*2;ctx.lineCap='round';ctx.strokeStyle='hsl('+hue+',78%,67%)';ctx.stroke();circle(rootX+side*(48+rank*5),rootY+66+Math.sin(t*2.4+i)*12,8,'#ddffec');}
 // Progressive anatomy: body silhouette transforms at personal evolution thresholds.
 if(ev.level>=100){ctx.beginPath();ctx.moveTo(-119,-24);ctx.bezierCurveTo(-90,-93,-34,-105,0,-68);ctx.bezierCurveTo(45,-135,111,-77,141,-36);ctx.bezierCurveTo(169,2,132,75,79,96);ctx.bezierCurveTo(19,115,-68,104,-120,48);ctx.closePath();}
 else if(ev.level>=45){ctx.beginPath();ctx.moveTo(-116,-44);ctx.quadraticCurveTo(-82,-112,-15,-102);ctx.quadraticCurveTo(58,-146,118,-74);ctx.bezierCurveTo(155,-22,112,71,58,106);ctx.bezierCurveTo(-33,132,-125,70,-116,-44);ctx.closePath();}
 else if(ev.level>=22){ctx.beginPath();ctx.moveTo(-40,-125);ctx.bezierCurveTo(43,-145,106,-72,115,-7);ctx.bezierCurveTo(150,95,65,137,-16,119);ctx.bezierCurveTo(-138,115,-149,-32,-40,-125);ctx.closePath();}
 else if(p.shape==='crystal'){const pts=[];for(let i=0;i<12;i++){const a=i*TAU/12,r=i%2?94:116;pts.push([r*Math.cos(a),r*Math.sin(a)])}path(pts);}
 else if(p.shape==='leaf'){ctx.beginPath();ctx.moveTo(0,-120);ctx.bezierCurveTo(125,-90,165,90,0,118);ctx.bezierCurveTo(-167,90,-122,-89,0,-120);}
 else if(p.shape==='cloud'){ctx.beginPath();ctx.moveTo(100,35);ctx.bezierCurveTo(144,-38,91,-112,40,-103);ctx.bezierCurveTo(-22,-160,-78,-118,-93,-62);ctx.bezierCurveTo(-150,-10,-125,84,-60,92);ctx.bezierCurveTo(15,145,97,116,100,35);}
 else {ctx.beginPath();for(let i=0;i<=90;i++){const a=i/90*TAU,rr=103*(1+.065*Math.sin(4*a+t+p.seed));if(i===0)ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);else ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr)}ctx.closePath()}
 const g=ctx.createRadialGradient(-45,-53,4,0,0,170);g.addColorStop(0,`hsl(${(hue+27)%360},91%,82%)`);g.addColorStop(.5,`hsl(${hue},75%,58%)`);g.addColorStop(1,`hsl(${hue},70%,31%)`);ctx.fillStyle=g;ctx.fill();ctx.shadowBlur=0;ctx.lineWidth=selected?6:3;ctx.strokeStyle=selected?'#effff6':`hsl(${hue},88%,81%)`;ctx.stroke();
 for(let i=0;i<12;i++){const a=i*2.39996,px=Math.sin(a)*68,py=Math.cos(a)*62;circle(px,py,4+(i%3),`hsla(${(hue+88)%360},85%,94%,.38)`)}
 for(let i=0;i<(p.eyes||2);i++){const ex=(i-((p.eyes||2)-1)/2)*48,ey=-15+(i%2)*5,blink=Math.sin(t*1.6+(p.seed||0)+i*.2)>.991;ctx.save();ctx.translate(ex,ey);ctx.scale(1,blink?.12:1);circle(0,0,21,'#f4fffa');circle(4*Math.sin(t/2),2,11,'#13314e');circle(-3,-4,4,'#fff');ctx.restore();}
 ctx.beginPath();ctx.arc(0,36,13,0,Math.PI);ctx.lineWidth=4;ctx.strokeStyle='#133b4b';ctx.stroke();circle(-60,33,8,'#ffb0bb7c');circle(60,33,8,'#ffb0bb7c');
 for(let i=0;i<ev.feelers;i++){const xx=(i-(ev.feelers-1)/2)*28;ctx.beginPath();ctx.moveTo(xx,-87);ctx.quadraticCurveTo(xx+Math.sin(t*1.5+i)*18,-129,xx+4,-138+Math.sin(t+i)*9);ctx.strokeStyle='#d4ffdd';ctx.lineWidth=5;ctx.stroke();circle(xx+4,-138+Math.sin(t+i)*9,7,'#dafff5')}
 if(ev.level>=15){circle(-91,-14,9,'#fff4b7');circle(91,-14,9,'#fff4b7');}
 if(ev.level>=35){for(let i=0;i<Math.min(7,Math.floor(ev.level/28));i++){const xx=-68+i*23;ctx.beginPath();ctx.moveTo(xx,-83);ctx.lineTo(xx+14,-115-(i%3)*7);ctx.lineTo(xx+19,-81);ctx.closePath();ctx.fillStyle='hsl('+((hue+39)%360)+',80%,72%)';ctx.fill();}}
 if(ev.level>=75){ctx.save();ctx.globalAlpha=.55;ctx.fillStyle='hsl('+((hue+140)%360)+',90%,69%)';ctx.beginPath();ctx.moveTo(-59,-56);ctx.quadraticCurveTo(-175,-125+Math.sin(t*2)*13,-143,48);ctx.quadraticCurveTo(-116,13,-59,-6);ctx.fill();ctx.beginPath();ctx.moveTo(60,-56);ctx.quadraticCurveTo(180,-125+Math.sin(t*2)*13,143,48);ctx.quadraticCurveTo(110,13,60,-6);ctx.fill();ctx.restore();}
 if(ev.level>=150){for(let j=0;j<4;j++)circle(-75+j*50,-45+Math.sin(t*2+j)*7,5+j%2,'#e8fcff');}
 ctx.restore();if(selected){ctx.save();ctx.setLineDash([6,6]);ctx.strokeStyle='#c6ffe5';ctx.lineWidth=2;circle(at.x,at.y,r*.99,null,'#bbffe6',2);ctx.setLineDash([]);text('▼',at.x,at.y-r-25,22,'#dafff4');ctx.restore()}
 text(p.name,at.x,at.y+r*.89+26,16,'#effffe');if(p.lastSpeech&&t*1000-(p.speechAt||0)<1900)text(p.lastSpeech,at.x,at.y-r*1.05-30,18,'#f9d9ff');
 return {id:p.id,x:at.x,y:at.y,r:r*1.04};}
function drawSkillFX(p,at,t,act){
 if(!act||t<act.start||t>act.start+act.duration)return;
 const progress=Math.max(0,Math.min(1,(t-act.start)/act.duration));
 const lvl=Math.max(1,Number(p.skills?.[act.skill])||1);
 if(act.skill==='symbols'){
  const tokens=['✦','◇','☼','△','∞'],idx=Math.min(tokens.length-1,Math.floor(progress*tokens.length));
  ctx.save();ctx.globalAlpha=Math.min(1,Math.sin(progress*Math.PI)*1.8);text(tokens[idx],at.x,at.y-145-Math.sin(progress*Math.PI)*23,Math.min(48,28+lvl*2),'#fff5b7');ctx.restore();
 }else if(act.skill==='logic'){
  ctx.save();ctx.globalAlpha=.92;ctx.fillStyle='rgba(15,47,69,.85)';ctx.beginPath();ctx.roundRect(at.x-98,at.y-174,196,54,13);ctx.fill();
  text(progress>.65?'2 · 4 · 6 · 8 ✓':'2 · 4 · 6 · ?',at.x,at.y-137,20,'#e8ffdd');ctx.restore();
 }else if(act.skill==='dialogue'){
  ctx.save();ctx.fillStyle='rgba(17,59,73,.92)';ctx.beginPath();ctx.roundRect(at.x-110,at.y-167,220,57,14);ctx.fill();
  text(progress<.4?'Здраво, другар!':progress<.8?'Ајде да играме!':'Браво! ♡',at.x,at.y-132,17,'#ffdcf2');ctx.restore();
 }else if(act.skill==='leap'){
  ctx.save();ctx.strokeStyle='rgba(219,250,246,.7)';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(at.x,at.y+90,35+Math.sin(progress*Math.PI)*48,10,0,0,TAU);ctx.stroke();ctx.restore();
 }else if(act.skill==='wave'){
  ctx.save();ctx.globalAlpha=.65;for(let i=0;i<3;i++)text('♡',at.x+78+i*14,at.y-88-i*22,16,'#fff1ca');ctx.restore();
 }else if(act.skill==='spin'){
  ctx.save();ctx.strokeStyle='rgba(230,255,198,.7)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(at.x,at.y,88,progress*TAU*1.8,progress*TAU*1.8+Math.PI);ctx.stroke();ctx.restore();
 }
}
function drawCreature(p,at,t,selected){
 const level=E().evolutionProgress?E().evolutionProgress(p).level:(p.evolution?.level||1);
 const art=root.TrialumCreatureArt;
 const act=activeTricks.get(p.id);
 if(act&&t>act.start+act.duration)activeTricks.delete(p.id);
 let box;
 if(!art||level<18)box=drawCreatureClassic(p,at,t,selected,act);
 else{
  const blend=Math.max(0,Math.min(1,(level-18)/26));
  if(blend>=1)box=art.draw(ctx,p,at,t,selected,E().evolutionProgress(p),act);
  else{
   ctx.save();ctx.globalAlpha=1-blend;const hit0=drawCreatureClassic(p,at,t,selected,act);ctx.restore();
   ctx.save();ctx.globalAlpha=blend;const hit1=art.draw(ctx,p,at,t,selected,E().evolutionProgress(p),act);ctx.restore();
   box=hit1||hit0;
  }
 }
 drawSkillFX(p,at,t,act);
 return box;
}
function availableTricks(p){
 return TRICKS.filter(x=>(p?.skills?.[x]||0)>0);
}
function playTrick(id,skill){
 const p=state?.pets?.find(x=>x.id===id);
 if(!p||!availableTricks(p).includes(skill))return false;
 activeTricks.set(id,{skill,start:performance.now()/1000,duration:skill==='spin'?2:skill==='leap'?1.9:skill==='symbols'?3.1:skill==='logic'?3.4:skill==='dialogue'?3.3:2.2});
 return true;
}
// Emotion expression is a visual reaction, not a newly learned skill.
function reactEmotion(id,emotion){
 const p=state?.pets?.find(x=>x.id===id);
 if(!p)return false;
 const skill=emotion==='joyful'?'spin':emotion==='tired'?'wave':emotion==='sad'?'wave':emotion==='hungry'?'wave':'leap';
 const start=performance.now()/1000;
 activeTricks.set(id,{skill,start,duration:skill==='spin'?1.5:1.7});
 p.reaction=skill;p.reactionAt=Date.now();
 return true;
}
function playRandomTrick(p){
 if(!p)return false;
 const options=availableTricks(p);if(!options.length)return false;
 const skill=options[lastTrick++%options.length];return playTrick(p.id,skill);
}
function showTrickMenu(id){
 const p=state?.pets?.find(x=>x.id===id);if(!p)return;
 pickCallback(p.id);
 let menu=document.getElementById('trialumTrickMenu');
 if(!menu){menu=document.createElement('div');menu.id='trialumTrickMenu';menu.className='trick-menu';canvas.parentElement.appendChild(menu);}
 menu.replaceChildren();
 const label=document.createElement('strong');label.textContent='🎓 '+p.name;menu.appendChild(label);
 const skills=availableTricks(p),names={wave:'👋 Мавтај',spin:'🔄 Заврти се',leap:'✨ Скокни',symbols:'✦ Знаци',logic:'🧠 Размисли',dialogue:'💬 Комуницирај'};
 if(!skills.length){const text=document.createElement('p');text.textContent='Прво научи трик во Миленици.';menu.appendChild(text);}
 for(const skill of skills){const button=document.createElement('button');button.type='button';button.textContent=names[skill];button.onclick=()=>{playTrick(p.id,skill);menu.hidden=true};menu.appendChild(button);}
 const close=document.createElement('button');close.type='button';close.textContent='✕';close.setAttribute('aria-label','Затвори');close.onclick=()=>menu.hidden=true;menu.appendChild(close);menu.hidden=false;
}
function nearestPet(event){
 const rect=canvas.getBoundingClientRect();
 if(!rect.width||!rect.height)return null;
 // The compact mobile aquarium uses object-fit:cover. Account for cropped
 // canvas edges so users can still tap the creature they see on screen.
 const cover=getComputedStyle(canvas).objectFit==='cover';
 const scale=cover?Math.max(rect.width/W,rect.height/H):Math.min(rect.width/W,rect.height/H);
 const dx=(W*scale-rect.width)/2,dy=(H*scale-rect.height)/2;
 const x=(event.clientX-rect.left+dx)/scale,y=(event.clientY-rect.top+dy)/scale;
 return hit.filter(p=>Math.hypot(p.x-x,p.y-y)<p.r).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];
}
function drawPreLife(t){const stage=state.stage;
 if(stage<2){for(let i=0;i<85;i++){let x=rand(i+180)*W+Math.sin(t+i)*16,y=rand(i+500)*H+Math.cos(t+i*.5)*12;circle(x,y,2+rand(i+700)*5,['#79efdb','#d5affb','#f2cb8e','#acd9ff'][i%4]);if(stage===1&&i%4===0){circle(x+9,y-7,5,'#aaffd35f','#efffbb91')}}text(stage?'Органски молекули се поврзуваат…':'Нема живот · само елементи',550,270,27,'#d9fff2');}
 else{const count=Math.min(80,Math.max(1,state.cells));for(let i=0;i<count;i++){const a=i*2.39996,r=Math.sqrt(i/count)*230,x=550+Math.cos(a)*r,y=300+Math.sin(a)*r*.75;const size=12+(i%4)*3;const g=ctx.createRadialGradient(x-5,y-5,0,x,y,size*1.2);g.addColorStop(0,'#d1ffde');g.addColorStop(1,i%3?'#42a7b5':'#ba9fea');circle(x,y,size,g,'#a0f7ec88',1);circle(x+2,y,Math.max(3,size/4),'#eeaeed')};text(`${Math.round(state.cells)} виртуелни клетки`,550,75,24,'#d4fff3')}
}
function draw(t){if(!state)return;ctx.clearRect(0,0,W,H);bg(t);hit=[];const h=E().currentHabitat(state);if(!h){drawPreLife(t);if(state.construction){text(`🏗️ Изградба ${state.construction.step}/5`,550,90,27,'#f3e4bb')}return;}
 for(let i=0;i<h.flora.length;i++)drawPlant(h.flora[i],i,t,'#61e5ad');
 const pets=state.pets.filter(p=>p.habitatId===h.id&&(!root.TrialumPresence||root.TrialumPresence.atHome(state,p.id))),count=pets.length;
 for(let i=0;i<count;i++)hit.push(drawCreature(pets[i],petPosition(pets[i],i,count),t,pets[i].id===state.selectedPet));
 // Temporary *visual-only* home echo while a return is awaiting server confirmation.
 // The remote lease stays authoritative; no hit target, care, trick, XP or live HOME.
 const waiting=state.pets.filter(p=>p.habitatId===h.id&&
  p.presence?.kind==='shared_playground'&&p.presence?.sessionId&&
  p.pendingRemoteReturn?.sessionId===p.presence.sessionId);
 if(waiting.length){
  ctx.save();ctx.globalAlpha=.3;
  for(let i=0;i<waiting.length;i++)
   drawCreature(waiting[i],petPosition(waiting[i],i,waiting.length),t,false);
  ctx.restore();
  text(root.TrialumI18n?.t?.('⏳ Привремена слика · враќањето чека серверска потврда')||'⏳ Привремена слика · враќањето чека серверска потврда',550,495,17,'#f2e5b3');
 }
 if(guest){const sp=E().SPECIES[guest.species]||E().SPECIES[0],g={...guest,seed:89,eyes:sp.eyes,shape:sp.shape,ageDays:60,growth:guest.growth||15,evolution:{level:guest.level||1,xp:0,lastDay:1,memories:[],socialDays:{}}};ctx.save();ctx.globalAlpha=.72;drawCreature(g,{x:938,y:174,size:.35},t,false);ctx.restore();text('🤝 P2P гостин',938,268,15,'#f6c4fc');}
 if(!pets.length){text('🏞 Биосветот е подготвен',550,260,27,'#e2ffed');text('Создај суштество во лабораторијата',550,306,17,'#b8ddd5')}
 text(`${h.name} · ${E().occupancy(state,h.id)} / ${h.capacity} биокапацитет`,550,50,19,'#d7fff1')}
// LW-B: zero animation work in background, behind other screens, or off viewport.
 // Simulation and presence state remain owned by Engine; this controls paint only.
 let sceneEnabled=true,inViewport=true,frameId=null;
 const reducedMotion=()=>Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
 function canPaint(){return Boolean(state)&&sceneEnabled&&inViewport&&canvas.isConnected&&
   document.visibilityState!=='hidden'&&!document.hidden;}
 function stopPainting(){
   if(frameId!==null){cancelAnimationFrame(frameId);frameId=null;}
 }
 function requestPaint(){
   if(frameId!==null||!canPaint())return;
   frameId=requestAnimationFrame(animate);
 }
 function setSceneVisible(visible){
   sceneEnabled=Boolean(visible);
   if(!canPaint()){stopPainting();return;}
   last=0;
   requestPaint();
 }
 function animate(now){
   frameId=null;
   if(!canPaint())return;
   if(!last||now-last>=33){draw(now/1000);last=now;}
   if(!reducedMotion())requestPaint();
 }
 document.addEventListener('visibilitychange',()=>{
   if(canPaint()){last=0;requestPaint();}else stopPainting();
 });
 if(typeof IntersectionObserver!=='undefined'){
   new IntersectionObserver(entries=>{
     inViewport=Boolean(entries[0]?.isIntersecting);
     if(canPaint()){last=0;requestPaint();}else stopPainting();
   },{threshold:0}).observe(canvas);
 }
 const motionQuery=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 motionQuery?.addEventListener?.('change',()=>{
   if(canPaint()){last=0;requestPaint();}else stopPainting();
 });
canvas.addEventListener('click',event=>{
 if(!state||performance.now()<suppressClickUntil)return;
 const closest=nearestPet(event);
 if(!closest)return;
 const p=state.pets.find(x=>x.id===closest.id);if(p)playRandomTrick(p);
 pickCallback(closest.id);
});
let holdTimeout=null,holdPoint=null;
canvas.addEventListener('pointerdown',event=>{
 if(event.pointerType==='mouse'&&event.button!==0)return;
 const nearest=nearestPet(event);if(!nearest)return;
 holdPoint={x:event.clientX,y:event.clientY,id:nearest.id};
 holdTimeout=setTimeout(()=>{if(holdPoint){suppressClickUntil=performance.now()+600;showTrickMenu(holdPoint.id);holdPoint=null}},570);
});
const clearHold=()=>{clearTimeout(holdTimeout);holdTimeout=null;holdPoint=null};
canvas.addEventListener('pointerup',clearHold);
canvas.addEventListener('pointercancel',clearHold);
canvas.addEventListener('pointermove',event=>{if(holdPoint&&Math.hypot(event.clientX-holdPoint.x,event.clientY-holdPoint.y)>14)clearHold()});
canvas.addEventListener('contextmenu',event=>{const p=nearestPet(event);if(p){event.preventDefault();showTrickMenu(p.id)}});
function frameAt(timeSeconds,scale=1){
 const cv=document.createElement('canvas');cv.width=Math.round(W*scale);cv.height=Math.round(H*scale);
 const target=cv.getContext('2d');if(!target)return null;
 const old=ctx,oldHit=hit;ctx=target;
 try{ctx.scale(scale,scale);draw(timeSeconds);}finally{ctx=old;hit=oldHit}
 return cv;
}
root.TrialumWorld={
 setState(v){state=v;if(canPaint()){last=0;requestPaint();}else stopPainting();},
 setSceneVisible,
 setGuest(v){guest=v;if(canPaint())requestPaint();},onPick(fn){pickCallback=fn},
 playTrick,reactEmotion,availableTricks,showTrickMenu,frameAt,
 prepareRecording(id,skill){const p=state?.pets?.find(x=>x.id===id);if(!p)return false;
  const s=availableTricks(p);return playTrick(id,skill&&s.includes(skill)?skill:(s[0]||''));}
};
// Never start an unbounded paint loop until a validated world is loaded.
})(globalThis);
