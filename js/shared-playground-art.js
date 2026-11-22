/* TRIALUM v44 — dedicated shared playground canvas environment & tangible equipment.
 * Decorative drawing only: no server calls, no gameplay rewards and no credit accounting.
 * Static assets are cached to keep the main thread cool while pets are animated.
 */
(function(root){
'use strict';
const TAU=Math.PI*2;
const POS=Object.freeze({
 sandbox:Object.freeze({x:170,y:449,s:.88}),
 seesaw:Object.freeze({x:485,y:448,s:.86}),
 slide:Object.freeze({x:241,y:353,s:.82}),
 pool:Object.freeze({x:823,y:459,s:.88}),
 obstacle:Object.freeze({x:514,y:352,s:.78}),
 trampoline:Object.freeze({x:783,y:348,s:.82})
});
let cached=null,cacheKey='';
function path(ctx,points){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();}
function round(ctx,x,y,w,h,r=10){
 const radius=Math.min(r,w/2,h/2);
 ctx.beginPath();ctx.moveTo(x+radius,y);
 ctx.lineTo(x+w-radius,y);ctx.quadraticCurveTo(x+w,y,x+w,y+radius);
 ctx.lineTo(x+w,y+h-radius);ctx.quadraticCurveTo(x+w,y+h,x+w-radius,y+h);
 ctx.lineTo(x+radius,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-radius);
 ctx.lineTo(x,y+radius);ctx.quadraticCurveTo(x,y,x+radius,y);ctx.closePath();
}
function linear(ctx,y0,y1,colors){
 const g=ctx.createLinearGradient(0,y0,0,y1);
 for(const [p,c] of colors)g.addColorStop(p,c);
 return g;
}
function shadow(ctx,x,y,w,h,alpha=.23){
 ctx.fillStyle='rgba(4,34,43,'+alpha+')';ctx.beginPath();ctx.ellipse(x,y,w,h,0,0,TAU);ctx.fill();
}
function tree(ctx,x,y,size,variation){
 ctx.save();ctx.translate(x,y);ctx.scale(size,size);
 ctx.fillStyle='#183d44';round(ctx,-7,-48,15,74,5);ctx.fill();
 for(let i=0;i<3;i++){
  const r=27+i*7,c=['#1e7668','#238b71','#56b989'][(i+variation)%3];
  const grad=ctx.createRadialGradient(-9,-64-i*14,2,0,-65-i*14,r);
  grad.addColorStop(0,'#85d7a1');grad.addColorStop(.65,c);grad.addColorStop(1,'#144b55');
  ctx.fillStyle=grad;ctx.beginPath();ctx.ellipse((i%2?6:-5),-80+i*23,r,r*.83,0,0,TAU);ctx.fill();
 }
 ctx.restore();
}
function terrain(ctx){
 ctx.clearRect(0,0,1000,520);
 ctx.fillStyle=linear(ctx,0,520,[[0,'#0b213e'],[.40,'#1b5974'],[.73,'#318b84'],[1,'#67b37f']]);
 ctx.fillRect(0,0,1000,520);
 // Moon/halo and quiet clouds give the open-world scene depth without animation cost.
 const light=ctx.createRadialGradient(775,66,3,775,66,225);
 light.addColorStop(0,'rgba(255,238,183,.42)');light.addColorStop(1,'rgba(255,238,183,0)');
 ctx.fillStyle=light;ctx.fillRect(510,0,490,300);
 ctx.fillStyle='#ffefbf';ctx.beginPath();ctx.arc(776,79,24,0,TAU);ctx.fill();
 for(let i=0;i<25;i++){
  const x=(i*173+47)%1000,y=21+(i*67)%190;
  ctx.fillStyle=i%4===0?'rgba(255,243,182,.72)':'rgba(191,233,247,.43)';
  ctx.beginPath();ctx.arc(x,y,1+(i%3)*.6,0,TAU);ctx.fill();
 }
 ctx.fillStyle='rgba(202,247,248,.11)';
 for(let i=0;i<7;i++){
  ctx.beginPath();ctx.ellipse((i*197+110)%1000,116+(i%3)*33,79,14,0,0,TAU);ctx.fill();
 }
 path(ctx,[[0,269],[110,211],[177,242],[295,180],[390,245],[485,191],[618,250],[738,174],[863,236],[1000,188],[1000,390],[0,390]]);
 ctx.fillStyle='#1b5662';ctx.fill();
 path(ctx,[[0,310],[150,261],[312,303],[482,231],[621,288],[777,243],[1000,297],[1000,405],[0,405]]);
 ctx.fillStyle='#247579';ctx.fill();
 ctx.fillStyle=linear(ctx,315,520,[[0,'#2e946c'],[.6,'#37845f'],[1,'#285d51']]);
 ctx.beginPath();ctx.moveTo(0,345);ctx.bezierCurveTo(240,316,480,355,760,331);ctx.quadraticCurveTo(900,327,1000,350);ctx.lineTo(1000,520);ctx.lineTo(0,520);ctx.closePath();ctx.fill();
 // Wide walkway and soft edge accent, with perspective.
 path(ctx,[[0,487],[250,413],[760,411],[1000,485],[1000,520],[0,520]]);
 ctx.fillStyle='#557d70';ctx.fill();
 ctx.strokeStyle='rgba(203,243,185,.45)';ctx.lineWidth=4;
 ctx.beginPath();ctx.moveTo(0,487);ctx.lineTo(250,413);ctx.lineTo(760,411);ctx.lineTo(1000,485);ctx.stroke();
 for(let i=0;i<13;i++){
  const x=i*86-20,y=496+Math.sin(i*2.9)*12;
  ctx.fillStyle=i%3===0?'rgba(252,230,166,.25)':'rgba(176,223,204,.18)';
  ctx.beginPath();ctx.ellipse(x,y,19,5,.1,0,TAU);ctx.fill();
 }
 // Fenced garden boundary, independent of gameplay collision.
 for(let x=17;x<1000;x+=69){
  ctx.fillStyle='#7db49b';round(ctx,x,303,8,40,3);ctx.fill();
 }
 ctx.strokeStyle='rgba(153,219,182,.53)';ctx.lineWidth=7;
 for(const y of [320,336]){ctx.beginPath();ctx.moveTo(0,y);ctx.quadraticCurveTo(490,y+12,1000,y-1);ctx.stroke();}
 tree(ctx,65,348,1.1,1);tree(ctx,940,348,1.05,2);
 tree(ctx,395,303,.6,1);tree(ctx,676,300,.62,2);
 for(let i=0;i<55;i++){
  const x=(i*133+31)%1000,y=379+(i*43)%133;
  ctx.fillStyle=['#e6d9a2','#e9adbd','#c3e9b0','#9ed7dc'][i%4];
  ctx.beginPath();ctx.arc(x,y,1.6+i%3,0,TAU);ctx.fill();
 }
 // Pet-safe decorative lamps.
 for(const x of [108,884]){
  ctx.fillStyle='#214a4d';round(ctx,x-4,258,8,76,3);ctx.fill();
  const g=ctx.createRadialGradient(x,256,2,x,256,30);
  g.addColorStop(0,'rgba(255,228,159,.56)');g.addColorStop(1,'rgba(255,228,159,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,256,30,0,TAU);ctx.fill();
  ctx.fillStyle='#ffe9ad';ctx.beginPath();ctx.arc(x,255,7,0,TAU);ctx.fill();
 }
}
function plaque(ctx,label,x,y,w=150){
 ctx.fillStyle='rgba(7,38,55,.78)';round(ctx,x-w/2,y,w,24,12);ctx.fill();
 ctx.strokeStyle='rgba(191,245,227,.57)';ctx.lineWidth=1.4;ctx.stroke();
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#e4fcf3';ctx.font='600 12px system-ui';
 ctx.fillText(label,x,y+12,w-12);
}
function equipment(ctx,id,pos){
 ctx.save();ctx.translate(pos.x,pos.y);ctx.scale(pos.s,pos.s);
 shadow(ctx,0,13,108,21);
 if(id==='sandbox'){
  // Raised walnut frame, sloping walls, real sand grains and embedded symbols.
  ctx.fillStyle='#754a34';round(ctx,-103,-43,206,69,15);ctx.fill();
  ctx.fillStyle='#c78651';round(ctx,-100,-51,200,65,14);ctx.fill();
  ctx.fillStyle='#f7d99b';round(ctx,-91,-46,182,49,11);ctx.fill();
  ctx.fillStyle='#fbe9b5';round(ctx,-87,-43,174,34,9);ctx.fill();
  ctx.strokeStyle='#bd864c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-67,-18);ctx.lineTo(-38,-30);ctx.lineTo(-9,-15);ctx.stroke();
  ctx.strokeStyle='#c58d59';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(28,-22,12,0,TAU);ctx.stroke();
  for(let i=0;i<26;i++){
   ctx.fillStyle=i%2?'#dfb976':'#fff1c5';ctx.beginPath();
   ctx.arc(-79+(i*53)%160,-41+(i*13)%37,1.4,0,TAU);ctx.fill();
  }
  ctx.fillStyle='#d66476';round(ctx,55,-40,21,22,4);ctx.fill();
  ctx.strokeStyle='#d4eafb';ctx.lineWidth=3;ctx.beginPath();ctx.arc(65,-41,11,Math.PI,TAU);ctx.stroke();
  plaque(ctx,'✦ SYMBOL SANDBOX',0,33,174);
 }else if(id==='seesaw'){
  // An actual fulcrum with softly animated angle applied in overlay layer only.
  ctx.fillStyle='#354c71';path(ctx,[[-31,8],[0,-74],[31,8]]);ctx.fill();
  ctx.fillStyle='#b7a1d1';path(ctx,[[-24,0],[0,-61],[24,0]]);ctx.fill();
  ctx.strokeStyle='#ffd6a2';ctx.lineWidth=16;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(-115,-64);ctx.lineTo(115,-90);ctx.stroke();
  ctx.strokeStyle='#d6a8f9';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-114,-70);ctx.lineTo(112,-96);ctx.stroke();
  for(const sign of [-1,1]){
   ctx.fillStyle=sign<0?'#6ad4c7':'#e9a2c7';round(ctx,sign*108-19,-82,38,18,7);ctx.fill();
   ctx.strokeStyle='#f7e2d0';ctx.lineWidth=5;ctx.beginPath();
   ctx.moveTo(sign*107,-83);ctx.lineTo(sign*107,-102);ctx.stroke();
  }
  ctx.fillStyle='#9be8d6';ctx.beginPath();ctx.arc(0,-75,12,0,TAU);ctx.fill();
  plaque(ctx,'✦ BALANCE SEESAW',0,29,162);
 }else if(id==='slide'){
  // Twin steel supports, platform with guardrails and a continuous curved chute.
  ctx.strokeStyle='#4d7190';ctx.lineWidth=12;ctx.lineCap='round';
  for(const x of [-50,42]){ctx.beginPath();ctx.moveTo(x,-159);ctx.lineTo(x+2,5);ctx.stroke();}
  ctx.fillStyle='#d6a66e';round(ctx,-71,-166,132,23,8);ctx.fill();
  ctx.fillStyle='#72a7e2';round(ctx,-71,-175,132,19,7);ctx.fill();
  ctx.strokeStyle='#d2e6f2';ctx.lineWidth=6;
  for(let y=-130;y<-10;y+=23){ctx.beginPath();ctx.moveTo(-58,y);ctx.lineTo(-17,y);ctx.stroke();}
  ctx.strokeStyle='#f4b87b';ctx.lineWidth=36;ctx.beginPath();ctx.moveTo(38,-165);
  ctx.bezierCurveTo(22,-76,-26,-30,-113,1);ctx.stroke();
  ctx.strokeStyle='#fff0c4';ctx.lineWidth=25;ctx.beginPath();ctx.moveTo(38,-165);
  ctx.bezierCurveTo(22,-76,-26,-30,-113,1);ctx.stroke();
  ctx.strokeStyle='rgba(235,151,122,.72)';ctx.lineWidth=4;
  ctx.beginPath();ctx.moveTo(47,-165);ctx.bezierCurveTo(35,-65,-22,-20,-113,6);ctx.stroke();
  plaque(ctx,'✦ RAINBOW SLIDE',0,23,170);
 }else if(id==='pool'){
  // Border, depth, transparent water and a reflective rippling surface.
  ctx.fillStyle='#234e70';ctx.beginPath();ctx.ellipse(0,-14,115,47,0,0,TAU);ctx.fill();
  ctx.strokeStyle='#b9e4f0';ctx.lineWidth=20;ctx.beginPath();ctx.ellipse(0,-30,112,44,0,0,TAU);ctx.stroke();
  const water=ctx.createLinearGradient(-50,-80,75,30);
  water.addColorStop(0,'#2d8ecb');water.addColorStop(.5,'#52dcdd');water.addColorStop(1,'#2c9faa');
  ctx.fillStyle=water;ctx.beginPath();ctx.ellipse(0,-30,103,35,0,0,TAU);ctx.fill();
  ctx.strokeStyle='#d7ffff';ctx.lineWidth=3;
  for(let i=0;i<4;i++){ctx.beginPath();ctx.ellipse(-49+i*32,-28+(i%2)*4,22,7,0,Math.PI*.25,Math.PI*1.1);ctx.stroke();}
  ctx.strokeStyle='#e2eef3';ctx.lineWidth=5;
  ctx.beginPath();ctx.moveTo(86,-67);ctx.lineTo(86,-11);ctx.moveTo(112,-66);ctx.lineTo(112,-4);
  ctx.moveTo(86,-67);ctx.quadraticCurveTo(100,-84,112,-66);ctx.stroke();
  for(const y of [-45,-25]){ctx.beginPath();ctx.moveTo(87,y);ctx.lineTo(111,y);ctx.stroke();}
  plaque(ctx,'✦ CRYSTAL POOL',0,29,150);
 }else if(id==='obstacle'){
  // Arches, stepping discs and luminous goal portal.
  ctx.fillStyle='#5e6e74';
  for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(-96+i*46,-11+(i%2)*10,17,9,0,0,TAU);ctx.fill();}
  for(let i=0;i<3;i++){
   const x=-76+i*75;
   ctx.strokeStyle=['#b3d1f9','#d4adf6','#e4d18c'][i];ctx.lineWidth=10;
   ctx.beginPath();ctx.moveTo(x-23,-6);ctx.lineTo(x-23,-102+i*8);
   ctx.quadraticCurveTo(x,-137+i*8,x+23,-102+i*8);ctx.lineTo(x+23,-6);ctx.stroke();
   ctx.strokeStyle='rgba(255,255,255,.65)';ctx.lineWidth=2;ctx.stroke();
  }
  ctx.fillStyle='#b0e6b6';ctx.beginPath();ctx.arc(89,-107,13,0,TAU);ctx.fill();
  ctx.fillStyle='#234a52';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 16px system-ui';ctx.fillText('?',89,-107);
  plaque(ctx,'✦ PUZZLE COURSE',0,30,160);
 }else if(id==='trampoline'){
  // Flexible mat, steel rim, legs, safety net arms and springs.
  ctx.strokeStyle='#c6e5ef';ctx.lineWidth=7;
  for(const x of [-68,68]){ctx.beginPath();ctx.moveTo(x,-14);ctx.lineTo(x-6,22);ctx.stroke();}
  ctx.fillStyle='#354f79';ctx.beginPath();ctx.ellipse(0,-33,102,31,0,0,TAU);ctx.fill();
  ctx.strokeStyle='#e9f6f9';ctx.lineWidth=10;ctx.beginPath();ctx.ellipse(0,-34,102,30,0,0,TAU);ctx.stroke();
  ctx.fillStyle='#a861ca';ctx.beginPath();ctx.ellipse(0,-34,90,24,0,0,TAU);ctx.fill();
  ctx.strokeStyle='#e3aff3';ctx.lineWidth=3;
  ctx.beginPath();ctx.ellipse(0,-34,69,15,0,0,TAU);ctx.stroke();
  ctx.fillStyle='rgba(246,255,255,.65)';
  for(let i=0;i<12;i++){const a=i*TAU/12;ctx.beginPath();ctx.arc(Math.cos(a)*95,-34+Math.sin(a)*26,2.2,0,TAU);ctx.fill();}
  for(const x of [-95,95]){
   ctx.strokeStyle='#8ccccc';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,-31);ctx.lineTo(x,-112);ctx.stroke();
  }
  plaque(ctx,'✦ SKY TRAMPOLINE',0,31,170);
 }
 ctx.restore();
}
function staticScene(ctx,toys){
 terrain(ctx);
 const back=toys.filter(x=>['slide','obstacle','trampoline'].includes(x));
 const front=toys.filter(x=>['sandbox','seesaw','pool'].includes(x));
 for(const id of back)equipment(ctx,id,POS[id]);
 for(const id of front)equipment(ctx,id,POS[id]);
 // Small public-room legend (no personal data and no invented shared points).
 ctx.fillStyle='rgba(6,37,55,.68)';round(ctx,14,16,234,31,12);ctx.fill();
 ctx.fillStyle='#e9fffa';ctx.textAlign='left';ctx.textBaseline='middle';ctx.font='600 13px system-ui';
 ctx.fillText('✦ SHARED LIVING GARDEN',27,32);
}
function paint(ctx,s,t=0){
 if(!ctx)return;
 const toys=Array.isArray(s?.toys)?s.toys.filter(id=>POS[id]).slice(0,6):[];
 const key=toys.join('|');
 if(key!==cacheKey){cached=null;cacheKey=key;}
 if(!cached&&root.document?.createElement){
  try{
   const canvas=root.document.createElement('canvas');canvas.width=1000;canvas.height=520;
   const c=canvas.getContext('2d');
   if(c){staticScene(c,toys);cached=canvas;}
  }catch(_){cached=null;}
 }
 ctx.clearRect(0,0,1000,520);
 if(cached)ctx.drawImage(cached,0,0);
 else staticScene(ctx,toys);
 // Subtle low-cost light reflections, static under reduced motion.
 if(!root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches){
  ctx.fillStyle='rgba(255,240,191,.45)';
  for(let i=0;i<9;i++){
   const x=(i*137+83)%940+28,y=215+(i*41)%180;
   const r=1.6+Math.max(0,Math.sin(t*.65+i*.8))*2;
   ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
  }
 }
 if(Number.isFinite(s?.points)){
  ctx.fillStyle='rgba(6,37,55,.83)';round(ctx,780,17,204,34,12);ctx.fill();
  ctx.fillStyle='#bdeee4';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 15px system-ui';
  ctx.fillText('✦ Shared points: '+Math.max(0,Math.floor(s.points)),882,34);
 }
}
function slot(id){return POS[id]||null;}
root.TrialumSharedArt={paint,slot,TOYS:POS};
if(typeof module==='object'&&module.exports)module.exports=root.TrialumSharedArt;
})(typeof globalThis!=='undefined'?globalThis:this);
