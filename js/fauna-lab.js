/* Procedural research-generated fauna: same pet evolves; never creates from nothing. */
(function(root){
'use strict';
const E=root.TrialumEngine,old={ensure:E.ensureLongplay,invent:E.longplayInvent,requirements:E.longplayRequirements,transform:E.longplayTransform};
const fail=message=>({ok:false,message}),pass=message=>({ok:true,message});
const safe=(n,min,max)=>Math.min(max,Math.max(min,Number(n)||0));
const partsA=['Нео','Астра','Луми','Крио','Тера','Кванто','Етер','Мнемо','Орби','Сина'];
const partsB=['релис','мири','трон','вокс','сфер','лиси','вера','зин','кор'];
function register(s){
 if(!s?.longplay?.invented)return;
 for(const x of s.longplay.invented.filter(x=>x.kind==='fauna')){
  if(!Number.isInteger(x.speciesIndex)||x.speciesIndex<11||x.speciesIndex>300)continue;
  if(!E.SPECIES[x.speciesIndex]||E.SPECIES[x.speciesIndex].researchId!==x.id){
   E.SPECIES[x.speciesIndex]={researchId:x.id,name:String(x.name).slice(0,38),
    shape:['jelly','crystal','leaf','cloud'][x.speciesIndex%4],hue:(x.speciesIndex*37+173)%360,
    eyes:3+(x.speciesIndex%3),weight:2+(x.speciesIndex%3),
    voice:1+(x.speciesIndex%4),icon:['🔷','🌠','🐉','✨'][x.speciesIndex%4],
    habitat:x.biome||'garden',labTier:x.tier,description:'Генетска форма откриена преку долгорочно истражување',
    procedural:true};
  }
 }
}
function condition(s,index){
 const l=old.ensure(s);register(s);
 const x=l.invented.find(x=>x.kind==='fauna'&&x.speciesIndex===index);if(!x)return fail('Неистражена форма.');
 const parent=s.pets.filter(p=>p.species===x.source).sort((a,b)=>E.evolutionProgress(b).level-E.evolutionProgress(a).level)[0];
 const items=[
  ['Лабораторија',s.research.level>=x.tier,s.research.level+'/'+x.tier],
  ['Когнитивно знаење',s.research.fields.cognition>=x.points,s.research.fields.cognition+'/'+x.points],
  ['Геномско знаење',s.research.fields.genomics>=x.points,s.research.fields.genomics+'/'+x.points],
  ['Изминати денови',s.lastDay>=x.day,s.lastDay+'/'+x.day],
  ['Изворен вид '+(E.SPECIES[x.source]?.name||'непознат'),!!parent,parent?'Постои':'Недостига'],
  ['Ниво на изворниот миленик',!!parent&&E.evolutionProgress(parent).level>=x.sourceLevel,(parent?E.evolutionProgress(parent).level:0)+'/'+x.sourceLevel],
  ['Биосвет '+x.biome,s.habitats.some(h=>h.biome===x.biome&&E.envScore(h)>=68),x.biome+' · ≥68%']
 ];
 return{target:index,mode:'DNA',source:parent,lab:x.tier,description:'Истражена уникатна фауна, без генерирање од нула.',items:items.map(v=>({label:v[0],ok:v[1],value:v[2]})),ok:items.every(v=>v[1]),record:x};
}
function inventFauna(s){
 const l=old.ensure(s),p=E.currentPet(s),r=s.research;
 if(r.level<12)return fail('🔒 Фаунски откритија бараат лабораторија ниво 12.');
 if(!p||p.species<7||E.evolutionProgress(p).level<75)return fail('🔒 Потребен е Ноетриум или подоцнежен вид со ниво најмалку 75.');
 if(s.labActions<1||s.insight<35||s.compounds<50)return fail('Потребни се 1 акција, 35 сознание и 50 молекули.');
 const forms=l.invented.filter(x=>x.kind==='fauna').length;if(forms>=75)return fail('Моментален лимит: 75 истражени дополнителни фаунски форми.');
 let idx=Math.max(11,E.SPECIES.length);
 // Maintain unique append-only species indices; saved lineages remain stable.
 const name=partsA[forms%partsA.length]+partsB[Math.floor(forms/2)%partsB.length]+' '+(forms+1);
 const x={id:'research-fauna-'+(forms+1),kind:'fauna',name,speciesIndex:idx,source:p.species,
 sourceLevel:E.evolutionProgress(p).level+8,tier:Math.max(12,r.level),day:s.lastDay+Math.max(12,Math.floor((forms+1)*8)),
 points:Math.ceil(Math.max(r.fields.genomics,r.fields.cognition)/2)+50,
 biome:['garden','crystal','lagoon'][forms%3],createdDay:s.lastDay};
 s.labActions--;s.insight-=35;s.compounds-=50;l.invented.push(x);register(s);
 E.log(s,'🐉 Откриен е нов фаунски проект: '+name+'. ДНК-трансформацијата бара дополнителен развој.','milestone');
 return pass('Откриен е '+name+'. Прво развивај го изворното милениче до ниво '+x.sourceLevel+'.');
}
function transform(s,petId,index){
 if(index<11)return old.transform(s,petId,index);
 const g=condition(s,index);if(!g.ok)return fail('🔒 '+g.items.filter(x=>!x.ok).map(x=>x.label+' ('+x.value+')').join('; '));
 const p=s.pets.find(p=>p.id===petId),x=g.record;
 if(!p||p.species!==x.source)return fail('Избери го точниот изворен вид '+E.SPECIES[x.source].name+'.');
 const h=s.habitats.find(h=>h.biome===x.biome&&E.envScore(h)>=68&&E.occupancy(s,h.id)+E.SPECIES[index].weight*2-(p.habitatId===h.id?E.loadOf(p):0)<=h.capacity);
 if(!h)return fail('Нема соодветен биосвет со квалитет ≥68% и слободен капацитет.');
 if(s.compounds<120||s.insight<80||s.labActions<1)return fail('ДНК-трансформацијата бара 120 молекули, 80 сознание и 1 акција.');
 s.compounds-=120;s.insight-=80;s.labActions--;
 p.species=index;p.hue=E.SPECIES[index].hue;p.shape=E.SPECIES[index].shape;p.eyes=E.SPECIES[index].eyes;
 p.lineage=(p.lineage||[]).concat(index);p.habitatId=h.id;s.activeHabitat=h.id;p.genome={...p.genome,stage:index,source:x.source,day:s.lastDay};
 p.name=x.name+' '+p.id.slice(-4);
 E.longplayCredits(s,35,'Истражена фауна');E.log(s,'🧬 Нов истражувачки вид '+x.name+' ја наследи меморијата на зрелото милениче.','milestone');
 return pass('Успешна ДНК еволуција: '+p.name+'.');
}
E.ensureLongplay=s=>{const v=old.ensure(s);register(s);return v;};
E.longplayInvent=(s,kind)=>kind==='fauna'?inventFauna(s):old.invent(s,kind);
E.longplayRequirements=(s,index)=>index>=11?condition(s,index):old.requirements(s,index);
E.longplayTransform=transform;
E.longplayFaunaList=s=>(E.ensureLongplay(s),s.longplay.invented.filter(x=>x.kind==='fauna'));
if(typeof module==='object'&&module.exports)module.exports={register,condition,inventFauna,transform};
})(typeof globalThis!=='undefined'?globalThis:this);
