/* Trialum 1.5: standalone, deterministic artwork and media regression. */
'use strict';
const assert=require('node:assert/strict');
const {encode}=require('../js/gif-encoder.js');
const {draw,drawEye}=require('../js/creature-art.js');
const {parseGIF,decompressFrames}=require('gifuct-js');
const E=require('../js/engine.js');
require('../js/evolution.js');require('../js/progression.js');require('../js/longplay.js');
let tests=0;
function test(name,fn){fn();console.log('✓ '+name);tests++;}
function frame(width,height,kind){
 const out=new Uint8ClampedArray(width*height*4);
 for(let i=0;i<width*height;i++){
  const row=Math.floor(i/width),col=i%width,j=i*4;
  out[j]=kind?Math.floor(col*255/width):70;
  out[j+1]=Math.floor(row*255/height);
  out[j+2]=kind?250:180;
  out[j+3]=255;
 }
 return out;
}
test('GIF 89a animated PNG-like frames are LZW-decodable',()=>{
 const width=32,height=18,bytes=encode([frame(width,height,false),frame(width,height,true)],width,height,8);
 assert.equal(Buffer.from(bytes.subarray(0,6)).toString('ascii'),'GIF89a');
 const decoded=decompressFrames(parseGIF(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),true);
 assert.equal(decoded.length,2);
 for(const item of decoded){assert.equal(item.dims.width,width);assert.equal(item.dims.height,height);assert.equal(item.patch.length,width*height*4);}
 assert(bytes[bytes.length-1]===0x3b,'GIF should end with trailer');
});
test('2.5D art renders at several stages without mutating pet identity or XP',()=>{
 const gradients=()=>({addColorStop(){}});
 const ctx=new Proxy({createLinearGradient:gradients,createRadialGradient:gradients}, {
  get(target,prop){return target[prop]??(()=>{})},set(target,key,value){target[key]=value;return true}
 });
 for(const level of [18,22,44,65,100,161,500]){
  const pet={id:'original',name:'Лумира',hue:168,shape:'leaf',growth:95,
   seed:3,species:0,eyes:2,skills:{wave:2,spin:1},evolution:{level,xp:321}};
  const before=JSON.stringify(pet);
  const hit=draw(ctx,pet,{x:220,y:220,size:.75},120,true,{level},{skill:'wave',start:119,duration:2.2});
  assert.equal(hit.id,'original');assert(hit.r>5);assert.equal(JSON.stringify(pet),before);
 }
});
test('blinking eye uses smooth clipped eyelids, never a rectangular placeholder',()=>{
 const calls=[];
 const gradient=()=>({addColorStop(){}});
 const ctx=new Proxy({createLinearGradient:gradient,createRadialGradient:gradient},{
  get(target,prop){return target[prop]||((...args)=>calls.push({op:prop,args}))},
  set(target,key,value){target[key]=value;return true}
 });
 const seed=5;
 // First eye exactly at its natural blink peak; second eye would remain open.
 const peak=(Math.PI/2+Math.PI*2*8-seed)/1.15;
 const open=(Math.PI*3/2+Math.PI*2*8-seed)/1.15;
 drawEye(ctx,0,0,.91,open,seed,185);
 assert.equal(calls.filter(x=>x.op==='clip').length,0,'Open eye should show unobstructed iris');
 calls.length=0;
 drawEye(ctx,0,0,.91,peak,seed,185);
 assert(calls.some(x=>x.op==='clip'),'Closed eyelids must be masked to the curved eye outline');
 assert(calls.filter(x=>x.op==='quadraticCurveTo').length>=3,'Blink should include curved upper/lower eyelids and crease');
 assert.equal(calls.filter(x=>x.op==='fillRect').length,0,'A blinking eye must never become a square placeholder');
 assert(calls.some(x=>x.op==='stroke'),'Closed eyelid seam must be visible');
});
test('1.4.1 saves are accepted and upgraded in-place',()=>{
 const s=E.newGame('real');s.version='1.4.1';
 assert(E.validate(s));E.advance(s,Date.now());
 assert.equal(s.version,'1.5.5');assert(s.pets);
});
console.log('TRIALUM 1.5.5 ART/MEDIA:',tests,'passed');
