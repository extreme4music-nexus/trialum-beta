/* L3.9 original Classic greenhouse controls. No engine arithmetic/stock writes here. */
(function(root){
"use strict";
const E=root.TrialumEngine;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const en={
 "🌿 Флора · животен циклус":"🌿 Flora · life cycle",
 "Отклучувањето во лабораторијата создава модел, НЕ зрело растение. Произведи расад → одгледај го во градина → пресади го во живеалиште. Без соодветна нега растенијата можат да угинат.":"Research unlocks a model, NOT a mature plant. Produce a seedling → grow in the greenhouse → transplant to a habitat. Neglected plants can die.",
 "Лабораториски акции":"Laboratory actions",
 "Градинарски акции":"Garden actions",
 "🌰 Расадник":"🌰 Nursery",
 "🔒 Неоткриено":"🔒 Undiscovered",
 "✓ Модел отклучен":"✓ Model discovered",
 "🧪 Отклучи модел":"🧪 Unlock model",
 "🌱 Произведи расад":"🌱 Produce seedling",
 "Расади":"Seedlings",
 "🌱 Градина · леи и аквариум":"🌱 Greenhouse · beds and aquarium",
 "Сувоземни леи":"Terrestrial beds",
 "Воден базен":"Aquatic pool",
 "Празно":"Empty",
 "Засади":"Plant",
 "Раст":"Growth",
 "Здравје":"Health",
 "Влажност":"Hydration",
 "Зрело за пресадување":"Mature and transplant-ready",
 "Потребна нега или раст":"Needs care or growth",
 "Угинато":"Dead",
 "Наводни":"Water",
 "Отстрани суво растение":"Remove dead plant",
 "Пресади во":"Transplant to",
 "Нема слободно место":"No capacity",
 "🌿 Растенија во живеалиштата":"🌿 Plants in habitats",
 "🌡️ Фитолаб · адитиви":"🌡️ Plant Care Lab · additives",
 "Средство":"Formula",
 "На залиха":"In stock",
 "Произведи адитив":"Craft additive",
 "Примени":"Apply",
 "Растенија за нега":"Plants to care for",
 "Вкупно растенија":"Total plants",
 "Секоја акција троши реални ресурси. Сите податоци се зачувуваат во истиот свет.":"Every action uses real game resources. All data stays in the same saved world.",
 "Нема произведени расади":"No seedlings produced",
 "Нема растенија":"No plants",
 "Во градината":"In the greenhouse",
 "Во живеалиште":"In a habitat",
 "Нема живеалишта":"No habitats",
 "Аквариум":"Aquarium",
 "Елементи":"Elements",
 "Градината е приземна 3D просторија во изградба. Ова е целосно функционалната основна игра.":"The ground-floor 3D greenhouse is being built. These are the functional original-game controls.",
 "Растение":"Plant",
 "Преглед":"Overview",
 "Засади во":"Plant in"
};
const t=k=>root.TrialumI18n?.language?.()==="en"?(en[k]||k):k;
const b=(label,action,attrs,disabled)=>'<button data-do="'+action+'" '+(attrs||'')+(disabled?' disabled':'')+'>'+esc(label)+'</button>';
const pbar=(name,n)=>'<span class="small">'+esc(t(name))+' '+Math.round(Number(n)||0)+'%</span><div class="progress"><div style="width:'+Math.min(100,Math.max(0,Number(n)||0))+'%"></div></div>';
function render(s){
 const agro=E.ensureAgro(s),garden=agro.gardenPlants,homes=s.habitats||[];
 const modelCards=E.PLANTS.map(x=>{
  const known=s.blueprints.includes(x.id),tier=Math.max(1,x.labTier||1);
  const eligible=s.stage>=5&&s.research?.level>=tier;
  return '<article class="card"><h3>'+esc(x.icon||"🌱")+' '+esc(x.name)+'</h3>'+
   '<p class="small">'+esc(t(known?"✓ Модел отклучен":"🔒 Неоткриено"))+
   ' · '+esc(x.medium==="aquatic"?t("Аквариум"):t("Сувоземни леи"))+'</p>'+
   '<p class="small">'+esc(t("Расади"))+': '+(agro.seedlings[x.id]||0)+'</p>'+
   '<div class="btn-line">'+b(t("🧪 Отклучи модел"),"inventPlant",'data-plant="'+esc(x.id)+'"',known||!eligible)+
   b(t("🌱 Произведи расад"),"agroSeed",'data-plant="'+esc(x.id)+'"',!known||s.labActions<1||(agro.seedlings[x.id]||0)>=120)+
   '</div></article>';
 }).join("");
 const bedPanels=E.agroBeds.map(bed=>{
  const occupants=garden.filter(p=>p.bedId===bed.id);
  const candidates=E.PLANTS.filter(x=>s.blueprints.includes(x.id)&&
   (agro.seedlings[x.id]||0)>0&&((x.medium||"terrestrial")===bed.medium));
  const create=candidates.map(x=>b((x.icon||"🌱")+" "+t("Засади")+": "+x.name,
    "agroPlant",'data-plant="'+esc(x.id)+'" data-bed="'+esc(bed.id)+'"',
    agro.actionsLeft<1||occupants.length>=bed.capacity)).join("");
  const heading=bed.medium==="aquatic"?t("Воден базен"):t("Сувоземни леи")+" "+bed.id.split("-").pop();
  return '<article class="card"><h3>'+esc(heading)+'</h3><p class="small">'+occupants.length+'/'+bed.capacity+'</p>'+
   (create?'<div class="btn-line">'+create+'</div>':'<p class="small">'+esc(t("Нема произведени расади"))+'</p>')+
   occupants.map(p=>plantCard(s,p,"garden")).join("")+'</article>';
 }).join("");
 const homePlants=homes.map(h=>{
  const list=(h.flora||[]).map(x=>plantCard(s,x,"home")).join("");
  return '<article class="card"><h3>🏡 '+esc(h.name)+'</h3>'+
   '<p class="small">'+(h.flora?.length||0)+'/'+(h.floraSlots||6)+'</p>'+
   (list||'<p class="small">'+esc(t("Нема растенија"))+'</p>')+'</article>';
 }).join("");
 const additives=E.agroAdditiveRecipes.map(recipe=>{
  const cost=Object.entries(recipe.cost).map(([key,n])=>key+' '+n).join(" · ");
  const allowed=s.research?.level>=recipe.level;
  return '<article class="card"><h3>🧪 '+esc(recipe.name)+'</h3><p class="small">'+
   esc(t("На залиха"))+': '+(agro.additives[recipe.id]||0)+'</p><p class="price">'+
   esc(t("Елементи"))+': '+esc(cost)+'</p>'+
   b(t("Произведи адитив"),"agroCraft",'data-additive="'+esc(recipe.id)+'"',!allowed||s.labActions<1)+
   '</article>';
 }).join("");
 const total=garden.length+homes.reduce((n,h)=>n+(h.flora?.length||0),0);
 return '<div class="tab-main"><h2>'+esc(t("🌿 Флора · животен циклус"))+'</h2>'+
  '<p class="desc">'+esc(t("Отклучувањето во лабораторијата создава модел, НЕ зрело растение. Произведи расад → одгледај го во градина → пресади го во живеалиште. Без соодветна нега растенијата можат да угинат."))+'</p>'+
  '<div class="notice">'+esc(t("Лабораториски акции"))+': '+s.labActions+' · '+
  esc(t("Градинарски акции"))+': '+agro.actionsLeft+' · '+
  esc(t("Вкупно растенија"))+': '+total+'</div>'+
  '<h3>'+esc(t("🌰 Расадник"))+'</h3><div class="cards">'+modelCards+'</div>'+
  '<h3>'+esc(t("🌱 Градина · леи и аквариум"))+'</h3>'+
  '<p class="small">'+esc(t("Градината е приземна 3D просторија во изградба. Ова е целосно функционалната основна игра."))+'</p>'+
  '<div class="cards">'+bedPanels+'</div>'+
  '<h3>'+esc(t("🌡️ Фитолаб · адитиви"))+'</h3><div class="cards">'+additives+'</div>'+
  '<h3>'+esc(t("🌿 Растенија во живеалиштата"))+'</h3><div class="cards">'+homePlants+'</div>'+
  '<p class="small">'+esc(t("Секоја акција троши реални ресурси. Сите податоци се зачувуваат во истиот свет."))+'</p></div>';
}
function plantCard(s,p,where){
 const a=s.agro,isDead=p.dead===true,canWater=!isDead&&p.lastWaterDay<s.lastDay;
 const hasAction=where==="garden"?a.actionsLeft>0:s.habitats.find(h=>h.id===p.habitatId)?.dayActions>0;
 const name=E.PLANTS.find(x=>x.id===p.species)?.name||p.species;
 const attr='data-id="'+esc(p.id)+'"';
 const info='<div>'+pbar("Раст",p.growth)+pbar("Здравје",p.health)+pbar("Влажност",p.hydration)+'</div>';
 const ops=isDead?b(t("Отстрани суво растение"),"agroRemove",attr,!hasAction):
  b(t("Наводни"),"agroWater",attr,!canWater||!hasAction)+
  E.agroAdditiveRecipes.filter(r=>r.medium==="any"||r.medium===p.medium).map(r=>
   b(t("Примени")+" "+r.name,"agroTreat",
   attr+' data-additive="'+esc(r.id)+'"',
   !hasAction||p.lastAdditiveDay>=s.lastDay||(a.additives[r.id]||0)<1)).join("");
 const mature=!isDead&&p.growth>=85&&p.health>=50;
 const transplant=where==="garden"&&!isDead?s.habitats.map(h=>
  b(t("Пресади во")+" "+h.name,"agroTransplant",attr+' data-hab="'+esc(h.id)+'"',
    !mature||(h.flora||[]).length>=(h.floraSlots||6)||h.dayActions<1||
    (p.medium==="aquatic"&&h.biome!=="lagoon"))).join(""):"";
 return '<div class="card"><h4>🌱 '+esc(name)+(isDead?' · '+esc(t("Угинато")):'')+'</h4>'+
   '<p class="small">'+esc(where==="garden"?t("Во градината"):t("Во живеалиште"))+
   ' · '+esc(p.id)+'</p>'+info+
   (!isDead?'<p class="small">'+esc(t(mature?"Зрело за пресадување":"Потребна нега или раст"))+'</p>':"")+
   '<div class="btn-line">'+ops+transplant+'</div></div>';
}
root.TrialumPlantUI={render};
if(typeof module==="object"&&module.exports)module.exports={render};
})(typeof globalThis!=="undefined"?globalThis:this);
