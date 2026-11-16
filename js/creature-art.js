/* TRIALUM 1.5 — deterministic, scalable, 2.5D evolved creature renderer.
   Pure Canvas 2D; no network textures, no 3D GPU, no external assets. */
(function(root){
'use strict';
const TAU=Math.PI*2,clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const color=(h,s,l,a=1)=>'hsla('+h+','+s+'%,'+l+'%,'+a+')';
const hash=x=>{const n=Math.sin(x*91.73+17.123)*43658.5453;return n-Math.floor(n)};
function ell(ctx,x,y,rx,ry,fill,rotation=0){
 ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),rotation,0,TAU);
 ctx.fillStyle=fill;ctx.fill();
}
function grad(ctx,x0,y0,x1,y1,stops){
 const g=ctx.createLinearGradient(x0,y0,x1,y1);for(const [i,c] of stops)g.addColorStop(i,c);return g;
}
function shine(ctx,hue,x,y,r,light=82){
 const g=ctx.createRadialGradient(x-r*.42,y-r*.62,r*.04,x,y,r*1.5);
 g.addColorStop(0,color(hue+28,97,Math.min(96,light+12)));g.addColorStop(.15,color(hue+21,88,Math.min(87,light)));g.addColorStop(.46,color(hue+9,74,62));
 g.addColorStop(.73,color(hue,67,39));g.addColorStop(1,color(hue-15,58,14));
 return g;
}
function fin(ctx,hue,p,t,x,y,length,height,flip=1){
 ctx.save();ctx.translate(x,y);ctx.scale(flip,1);
 const wave=Math.sin(t*2.2+(p.seed||0)+x*.027)*8;
 ctx.beginPath();ctx.moveTo(0,0);
 ctx.bezierCurveTo(length*.25,-height*.7+wave,length*.73,-height, length,-height*.35+wave);
 ctx.bezierCurveTo(length*.88,height*.8,length*.34,height*.64,0,0);
 const g=grad(ctx,0,-height,length,height,[[0,color(hue+24,95,84,.93)],[.45,color(hue+6,79,58,.82)],[1,color(hue-22,75,37,.42)]]);
 ctx.fillStyle=g;ctx.fill();
 ctx.strokeStyle=color(hue+38,79,92,.72);ctx.lineWidth=2;ctx.stroke();
 ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(length*.57,-height*.18,length*.91,-height*.27+wave);
 ctx.strokeStyle=color(hue+50,82,88,.57);ctx.lineWidth=2;ctx.stroke();
 ctx.restore();
}
function gill(ctx,hue,t,x,y,i,flip=1){
 ctx.save();ctx.translate(x,y);ctx.scale(flip,1);
 const rise=Math.sin(t*2.6+i*.8)*9;
 ctx.beginPath();ctx.moveTo(0,0);
 ctx.bezierCurveTo(20,-16+rise,26,-45+rise,52,-55+rise);
 ctx.bezierCurveTo(71,-71+rise,78,-52+rise,58,-34+rise);
 ctx.bezierCurveTo(41,-10+rise,20,7,0,0);ctx.closePath();
 ctx.fillStyle=grad(ctx,8,-10,60,-58,[[0,color(hue+23,89,59)],[.65,color(hue+48,88,70)],[1,color(hue+64,85,84)]]);
 ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=color(hue+50,95,86,.8);ctx.stroke();
 ctx.restore();
}
function eye(ctx,x,y,scale,t,seed,irisHue){
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
 // Ambient orbital socket and eyelid shadow.
 const rim=ctx.createRadialGradient(0,-3,1,0,0,27);
 rim.addColorStop(0,'#020f1d');rim.addColorStop(.66,'#102637');rim.addColorStop(1,'#245a59aa');
 ell(ctx,0,0,25,29,rim);
 const iris=ctx.createRadialGradient(-5,-8,1,2,3,19);
 iris.addColorStop(0,'#0a1421');iris.addColorStop(.62,'#030c17');iris.addColorStop(.84,color(irisHue,55,34));iris.addColorStop(1,'#01070d');
 ell(ctx,1,0,19,23,iris);
 ell(ctx,-7,-12,6,7,'#ffffff');
 ell(ctx,4,-16,2.8,2.7,'#fff');
 ell(ctx,8,10,3,2.3,'#ade0d9a9');
 // A blink is a curved eyelid moving over the *eye*, never a rectangular
 // placeholder. Both lids share the eye's elliptical mask and skin palette.
 // A smooth 0..1 closure also prevents a one-frame flash when blinking.
 const closed=clamp((Math.sin(t*1.15+seed)-.965)/.035,0,1);
 if(closed>0){
  ctx.save();
  ctx.beginPath();ctx.ellipse(0,0,25,29,0,0,TAU);ctx.clip();
  const upper=-30+30*closed,lower=30-30*closed;
  const lid=grad(ctx,-11,-30,12,31,[
   [0,color(irisHue+14,76,69)],
   [.48,color(irisHue-12,64,53)],
   [1,color(irisHue-22,61,37)]
  ]);
  ctx.fillStyle=lid;
  ctx.beginPath();
  ctx.moveTo(-27,-31);ctx.lineTo(27,-31);ctx.lineTo(27,upper);
  ctx.quadraticCurveTo(0,upper+4*closed,-27,upper);
  ctx.closePath();ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-27,31);ctx.lineTo(27,31);ctx.lineTo(27,lower);
  ctx.quadraticCurveTo(0,lower-4*closed,-27,lower);
  ctx.closePath();ctx.fill();
  ctx.restore();
  // The eyelid crease follows the curvature of the eye as it closes.
  ctx.save();
  ctx.globalAlpha=closed*.85;
  ctx.beginPath();
  ctx.moveTo(-20,0);ctx.quadraticCurveTo(0,5,20,0);
  ctx.strokeStyle=color(irisHue-26,50,24);ctx.lineWidth=2.8;
  ctx.lineCap='round';ctx.stroke();
  ctx.restore();
 }
 ctx.restore();
}
function face(ctx,p,t,level,hue,detail){
 const seed=p.seed||17,eyes=clamp(Number(p.eyes)||2,1,5);
 const spacing=eyes<=2?41:eyes<=3?33:25;
 const count=Math.min(eyes,4);
 for(let i=0;i<count;i++){
  const x=(i-(count-1)/2)*spacing;
  const y=-18+Math.abs(i-(count-1)/2)*5;
  eye(ctx,x,y,eyes>=4?.63:.88+detail*.08,t,seed+i,hue+14);
 }
 // Three-dimensional snout / cheek / smile.
 const nose=ctx.createRadialGradient(-8,14,3,0,30,65);
 nose.addColorStop(0,color(hue+14,78,72,.9));nose.addColorStop(1,color(hue+4,56,43,.08));
 ell(ctx,0,33,64,39,nose);
 ctx.beginPath();ctx.moveTo(-17,47);if(Number(p.joy??60)<36)ctx.bezierCurveTo(-7,36,10,33,21,45);else ctx.bezierCurveTo(-6,61,9,64,21,45);
 ctx.strokeStyle='#102e38';ctx.lineCap='round';ctx.lineWidth=4;ctx.stroke();
 ell(ctx,-60,36,12,8,'#ffadbd44');ell(ctx,58,36,12,8,'#ffadbd55');
 if(level>=65){ell(ctx,-7,33,7,4,'#0f3938');ell(ctx,7,33,7,4,'#0f3938');}
}
function detailSkin(ctx,p,t,hue,detail){
 const seed=p.seed||1;
 ctx.save();
 ctx.globalAlpha=.18+detail*.18;
 for(let i=0;i<32;i++){
  const u=hash(seed+i*1.92),v=hash(seed+i*2.71+31);
  const x=(u-.5)*158,y=(v-.5)*136;
  ell(ctx,x,y,2+hash(seed+i*4)*5,1.6+hash(i)*3,color((hue+40+i*13)%360,85,92,.9),Math.sin(i)*.5);
 }
 ctx.restore();
 // Subtle scales / bumpy gill ridge, all deterministic for screenshot/video consistency.
 if(detail>.2){
  for(let i=0;i<8+detail*17;i++){
   const x=-71+(i%7)*22,y=-44+Math.floor(i/7)*25;
   ctx.beginPath();ctx.arc(x,y,6,Math.PI*.15,Math.PI*.88);
   ctx.strokeStyle=color(hue+22,79,87,.22+detail*.16);ctx.lineWidth=1.8;ctx.stroke();
  }
 }
}
function draw(ctx,p,at,t,selected,progress,action=null){
 const lvl=progress?.level||p.evolution?.level||1,detail=clamp((lvl-18)/120,0,1),grown=clamp((lvl-18)/200,0,1);
 const species=Number(p.species)||0,hue=((Number(p.hue)||174)%360+360)%360;
 const seed=Number(p.seed)||2;
 const motion=action&&action.duration>0?clamp((t-action.start)/action.duration,0,1):0;
 const active=!!action&&t>=action.start&&t<=action.start+action.duration;
 const arc=active?Math.sin(motion*Math.PI):0;
 const scale=at.size*(.68+(Number(p.growth)||30)/185)*(1+grown*.17);
 const breath=Math.sin(t*2.2+seed)*.012;
 const fish=(species%4===2||p.shape==='leaf'),axolotl=(species%4===0||p.shape==='jelly');
 ctx.save();
 // Shadow + glow establish volume and spatial grounding.
 ctx.shadowBlur=selected?32:13;ctx.shadowColor=color(hue,93,67,.57);
 const jump=active&&action.skill==='leap'?arc*102:0;
 const swing=active&&action.skill==='wave'?Math.sin(motion*TAU*3)*.18:Math.sin(t*.7+seed)*.025;
 const turn=active&&action.skill==='spin'?TAU*(motion*motion*(3-2*motion)):0;
 ctx.translate(at.x,at.y+Math.sin(t*1.4+seed)*7-jump);
 ctx.rotate(swing+turn);
 ctx.scale(scale*(1+breath),scale*(1-breath*.65));
 // The soft contact shadow makes the creature feel grounded in its environment.
 // It is drawn before the body so shadow cannot obscure the face.
 ctx.save();ctx.fillStyle='#031c2a44';
 ell(ctx,0,111,107+grown*18,19,'#041b2659');
 ctx.restore();
 // Tail fin or soft tail grows naturally from the inherited species.
 const tailWave=Math.sin(t*3.6+seed)*16;
 if(fish){
  fin(ctx,hue,p,t,-87,17,-132,89,1);
  fin(ctx,hue+3,p,t,52,-59,68,68,1);
  fin(ctx,hue-10,p,t,22,82,77,51,-1);
 }else{
  ctx.beginPath();ctx.moveTo(63,32);ctx.bezierCurveTo(138,18,133+tailWave,74,173+tailWave,33);
  ctx.bezierCurveTo(213+tailWave,-10,211+tailWave,94,147,110);
  ctx.bezierCurveTo(93,103,74,78,63,32);
  ctx.fillStyle=shine(ctx,hue+6,112,32,110,79);ctx.fill();
  ctx.strokeStyle=color(hue+19,68,74,.53);ctx.lineWidth=3;ctx.stroke();
 }
 // Legs/fin arms are layered behind the body; avoid detached appendage patterns.
 for(const side of [-1,1]){
  if(lvl>=32){
   const footX=side*77;
   ell(ctx,footX,88,38+grown*12,25,shine(ctx,hue+7,footX-8,75,53,76),side*.18);
   if(lvl>=55)fin(ctx,hue+12,p,t,side*74,27,side*(60+grown*28),52,1);
  }
 }
 if(axolotl&&lvl>=27){
  for(let i=0;i<3;i++){
   gill(ctx,hue,t,-78+i*5,-31-i*25,i,-1);
   gill(ctx,hue,t,78-i*5,-31-i*25,i,1);
  }
 }else if(lvl>=48){
  for(let i=0;i<Math.min(6,Math.floor(lvl/28));i++){
   const x=-60+i*23;
   fin(ctx,hue+19,p,t,x,-73,28,37,-1);
  }
 }
 // Advanced organic forms grow a flowing crown rather than infinitely long sticks.
 if(lvl>=95){
  const fullness=clamp((lvl-95)/100,0,1);
  for(let i=0;i<7;i++){
   const x=-68+i*22,wind=Math.sin(t*1.3+i*.38+seed)*8;
   ctx.save();ctx.translate(x,-81);ctx.rotate((i-3)*.12);
   ctx.beginPath();ctx.moveTo(-12,4);
   ctx.bezierCurveTo(-24,-30,-10+wind,-66-13*fullness,7+wind,-78-25*fullness);
   ctx.bezierCurveTo(24+wind,-89-24*fullness,29,-56,9,-14);
   ctx.quadraticCurveTo(5,3,-12,4);ctx.closePath();
   ctx.fillStyle=grad(ctx,-20,0,18,-87,[[0,color(hue+15,78,49,.81)],[.42,color(hue+43,93,72,.96)],[1,color(hue+63,89,90,.85)]]);
   ctx.fill();ctx.strokeStyle=color(hue+58,92,89,.65);ctx.lineWidth=1.5;ctx.stroke();
   ctx.restore();
  }
 }
 // Rounded sculpted body with rim and soft specular highlight.
 ctx.beginPath();
 if(fish){
  ctx.moveTo(-107,-10);
  ctx.bezierCurveTo(-78,-87,-6,-102,69,-73);
  ctx.bezierCurveTo(123,-47,122,29,73,78);
  ctx.bezierCurveTo(-12,113,-91,94,-107,-10);
 }else{
  ctx.moveTo(-103,0);
  ctx.bezierCurveTo(-105,-63,-52,-108,2,-110);
  ctx.bezierCurveTo(67,-108,117,-56,111,9);
  ctx.bezierCurveTo(106,86,64,111,0,111);
  ctx.bezierCurveTo(-69,112,-115,65,-103,0);
 }
 ctx.closePath();
 ctx.fillStyle=shine(ctx,hue,-31,-40,151,82);ctx.fill();ctx.shadowBlur=0;
 ctx.strokeStyle=color(hue+16,68,69,.44);ctx.lineWidth=3;ctx.stroke();
 // A glancing rim light with soft shadow under chin.
 ell(ctx,-40,-63,52,29,color(hue+46,93,97,.28),-.2);
 ell(ctx,-55,-39,20,45,color(hue+66,97,96,.14),-.5);
 ell(ctx,60,24,19,72,'#07363e21',-.2);
 ell(ctx,8,91,62,14,'#071d2d61');
 // True articulated fin/forelimb performance. Learned wave moves independently
 // of the body sway and is physically different from a spin or leap.
 for(const side of [-1,1]){
  const finX=side*(fish?76:86),finY=25;
  ctx.save();ctx.translate(finX,finY);
  const beat=active&&action.skill==='wave'?Math.sin(motion*TAU*3.3)*.92:Math.sin(t*1.8+seed+side)*.16;
  ctx.rotate(side*.48+beat*side);
  ctx.scale(side,1);
  ctx.beginPath();ctx.moveTo(0,-5);
  ctx.bezierCurveTo(20,-28,51,-43,72,-22);
  ctx.bezierCurveTo(83,-6,76,11,58,15);
  ctx.bezierCurveTo(37,17,20,29,0,16);ctx.closePath();
  const limb=grad(ctx,3,-23,72,23,[[0,color(hue+51,96,91,.9)],[.44,color(hue+20,84,65,.98)],[1,color(hue-9,72,42,.94)]]);
  ctx.fillStyle=limb;ctx.fill();ctx.strokeStyle=color(hue+38,89,87,.8);ctx.lineWidth=2;ctx.stroke();
  ctx.beginPath();ctx.moveTo(11,3);ctx.quadraticCurveTo(44,-13,64,-8);
  ctx.strokeStyle=color(hue+64,96,93,.6);ctx.lineWidth=1.5;ctx.stroke();
  ctx.restore();
 }
 detailSkin(ctx,p,t,hue,detail);
 if(lvl>=100){
  for(let i=0;i<5;i++)ell(ctx,-41+i*22,-89-Math.sin(i)*9,4,12,color(hue+70,95,87,.65),i*.14);
 }
 face(ctx,p,t,lvl,hue,detail);
 // Learning is visible: glowing signs and little thinking ornaments.
 if(active&&(action.skill==='symbols'||action.skill==='logic'||action.skill==='dialogue')){
  const tokens=action.skill==='logic'?['◈','△','∞']:action.skill==='dialogue'?['♪','•','♡']:['✦','◇','☼'];
  ctx.font='bold 24px system-ui';ctx.textAlign='center';
  tokens.forEach((token,i)=>{ctx.globalAlpha=.75+.25*Math.sin(t*3+i);ctx.fillStyle='#e5ffca';ctx.fillText(token,-86+i*87,-134-Math.sin(t*2+i)*13);});
  ctx.globalAlpha=1;
 }
 ctx.restore();
 if(selected){
  ctx.save();ctx.setLineDash([8,7]);ctx.beginPath();ctx.ellipse(at.x,at.y,118*scale,117*scale,0,0,TAU);
  ctx.strokeStyle='#b6fce4';ctx.lineWidth=2;ctx.stroke();ctx.setLineDash([]);ctx.restore();
 }
 ctx.save();ctx.font='700 16px system-ui';ctx.textAlign='center';ctx.fillStyle='#eafff8';ctx.shadowColor='#071926';ctx.shadowBlur=8;
 ctx.fillText(p.name||'Миленик',at.x,at.y+113*scale+22);ctx.restore();
 return{id:p.id,x:at.x,y:at.y,r:124*scale};
}
root.TrialumCreatureArt={draw,renderLevel:p=>Number(p.evolution?.level)||1,version:'1.5.2'};
if(typeof module==='object'&&module.exports)module.exports={draw,hash,drawEye:eye};
})(typeof globalThis!=='undefined'?globalThis:this);
