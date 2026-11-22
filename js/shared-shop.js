/* Trialum v44 community-only catalog. NO personal currency, Play Billing or client grants.
 * The server independently validates prices, inventory, placements and ownership.
 * Purchase never refunds or permanently consumes an existing owned toy.
 */
(function(root){
'use strict';
const ITEMS=Object.freeze([
 ['sandbox','🏖️','Sandbox','Песочник',0,'symbols'],
 ['seesaw','⚖️','Balance seesaw','Клацкалка',0,'wave'],
 ['slide','🛝','Rainbow slide','Лизгалка',8,'leap'],
 ['pool','🏊','Crystal pool','Базенче',10,'leap'],
 ['obstacle','🧩','Puzzle course','Патека со пречки',12,'logic'],
 ['trampoline','✨','Sky trampoline','Трамболина',14,'spin'],
 ['swing','🎠','Moon swing','Лулашка',10,'wave'],
 ['carousel','🎡','Flower carousel','Цветна вртелешка',12,'spin'],
 ['tunnel','🌀','Explorer tunnel','Истражувачки тунел',14,'leap'],
 ['climbing','🪜','Climbing tower','Кула за качување',16,'leap'],
 ['ballpit','🔮','Color ball pit','Базен со топчиња',18,'symbols'],
 ['puzzlewall','🧠','Puzzle wall','Ѕид со загатки',20,'logic'],
 ['music','🎵','Music garden','Музичка градина',22,'dialogue'],
 ['stargazer','🌠','Star observatory','Ѕвездена опсерваторија',26,'logic']
].map(([id,icon,en,mk,cost,skill])=>Object.freeze({id,icon,en,mk,cost,skill})));
const BY_ID=Object.freeze(Object.fromEntries(ITEMS.map(item=>[item.id,item])));
const isSupported=id=>Object.prototype.hasOwnProperty.call(BY_ID,id);
const localName=(id,lang)=>{const i=BY_ID[id];return i?(lang==='mk'?i.mk:i.en):String(id||'');};
function capacity(tier){return Math.min(6,2+Math.max(1,Math.min(5,Math.trunc(Number(tier)||1))));}
function clean(ids){return [...new Set((Array.isArray(ids)?ids:[]).filter(isSupported))];}
function inventory(snap){
 const active=clean(snap?.toys),owned=clean(snap?.ownedToys||snap?.toys);
 return {active,owned,ownedSet:new Set(owned),activeSet:new Set(active),
  credits:Math.max(0,Math.floor(Number(snap?.sharedCredits??snap?.points)||0)),
  capacity:capacity(snap?.room?.tier)};
}
root.TrialumSharedShop={ITEMS,BY_ID,isSupported,localName,capacity,clean,inventory};
if(typeof module==='object'&&module.exports)module.exports=root.TrialumSharedShop;
})(typeof globalThis!=='undefined'?globalThis:this);
