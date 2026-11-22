/* v44 shared playground visual overhaul: actual canvas apparatus and pure rendering. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const art=require('../js/shared-playground-art.js');
require('../js/shared-scene.js');
const scene=globalThis.TrialumSharedScene;
const drawOps=[];
const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}}),
 createRadialGradient:()=>({addColorStop(){}}),
 fillText:(value)=>drawOps.push(['text',String(value)]),
 clearRect:()=>drawOps.push(['clear']),
 drawImage:()=>drawOps.push(['image']),
 beginPath:()=>drawOps.push(['path']),
 moveTo(){},lineTo(){},bezierCurveTo(){},quadraticCurveTo(){},closePath(){},stroke(){},fill(){},
 fillRect(){},strokeRect(){},arc(){},ellipse(){},save(){},restore(){},translate(){},scale(){},rotate(){},
 measureText:value=>({width:String(value).length*7})
},{get(target,p){return Object.prototype.hasOwnProperty.call(target,p)?target[p]:typeof p==='string'&&p.startsWith('create')?()=>({addColorStop(){}}):target[p]},set(target,p,v){target[p]=v;return true;}});
const test=(name,fn)=>{fn();console.log('PASS',name)};
const six=['sandbox','seesaw','slide','pool','obstacle','trampoline'];
test('all six toy IDs have stable tangible equipment locations',()=>{
 assert.equal(Object.keys(art.TOYS).length,14,'shop expands beyond the six original apparatus');
 for(const id of six)assert(Object.prototype.hasOwnProperty.call(art.TOYS,id),id);
 for(const key of six){const p=art.slot(key);assert(p&&p.x>0&&p.x<1000&&p.y>200&&p.y<520);}
});
test('drawing all apparatus produces layered paths and semantic labels, not emoji',()=>{
 drawOps.length=0;art.paint(ctx,{toys:six,points:27},1.2);
 assert(drawOps.filter(v=>v[0]==='path').length>80,'must use actual vector geometry');
 const tags=drawOps.filter(v=>v[0]==='text').map(v=>v[1]);
 for(const k of ['SYMBOL SANDBOX','BALANCE SEESAW','RAINBOW SLIDE','CRYSTAL POOL','PUZZLE COURSE','SKY TRAMPOLINE'])
  assert(tags.some(x=>x.includes(k)),k);
 assert(tags.some(x=>x.includes('Shared credits')));
});
test('drawing optional toys does not add game state or unlock them',()=>{
 const s={toys:['sandbox','seesaw'],points:9,snapshot:{id:'room-1'}};
 const before=JSON.stringify(s);
 drawOps.length=0;art.paint(ctx,s,2);
 assert.equal(JSON.stringify(s),before);
 const tags=drawOps.filter(v=>v[0]==='text').map(v=>v[1]);
 assert(tags.some(x=>x.includes('SYMBOL SANDBOX')));
 assert(!tags.some(x=>x.includes('CRYSTAL POOL')));
});
test('shared scene still uses authenticated occupants and pure render path',()=>{
 const s={room:{id:'room-test'},toys:six,points:7,presenceEnabled:true,
  occupants:[{pet:{id:'a',name:'Nova',species:0,hue:170}},{pet:{id:'b',name:'Crystal',species:1,hue:270}}]};
 const before=JSON.stringify(s);
 drawOps.length=0;scene.draw(ctx,s,5);
 assert.equal(JSON.stringify(s),before);
 assert(drawOps.some(v=>v[0]==='text'&&v[1].includes('Nova')));
 assert(drawOps.some(v=>v[0]==='text'&&v[1].includes('Crystal')));
});
test('JS and offline cache load vector renderer before scene animation',()=>{
 const base=p=>fs.readFileSync(require.resolve('../'+p),'utf8');
 const index=base('index.html'),sw=base('sw.js'),code=base('js/shared-scene.js');
 assert(index.includes('js/shared-playground-art.js'));
 assert(index.indexOf('js/shared-playground-art.js')<index.indexOf('js/shared-scene.js'));
 assert(sw.includes('js/shared-playground-art.js'));
 assert(code.includes('TrialumSharedArt.paint'));
 assert(!code.includes("const items={sandbox:'🏖️'"));
});
console.log('V44 SHARED VISUAL TESTS PASSED');
