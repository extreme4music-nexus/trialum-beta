/* S6 home pantry in existing Classic pet details. No new view or game state. */
(function(root){
 "use strict";
 const escapeHTML=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const n=x=>String(Math.max(0,Math.floor(Number(x)||0)));
 function render(s,p,away,E){
  const I=root.TrialumWarehouseInventory;
  if(!p||!I)return "";
  const rows=I.petView(s,E.foodRecipes,p.id);
  const valid=rows.filter(r=>E.foodRecipes.some(f=>f.id===r.id&&
   E.feedCompatible(E.SPECIES[p.species],f,p)));
  const total=valid.reduce((acc,r)=>acc+r.petReserve,0);
  const disabled=away?" disabled":"";
  return '<details class="game-accordion"><summary>🍱 Лична храна дома · '+n(total)+' порции</summary>'+
   '<p class="desc">Лабораторијата произведува. Складиштето чува. Секој миленик добива свои порции од магацинот; кога ќе се потрошат, снабди го повторно.</p>'+
   '<div class="cards">'+valid.map(r=>{
    const f=E.foodRecipes.find(f=>f.id===r.id);
    const mkButton=(action,zone,label,available)=>
     '<button class="smallbtn" data-do="'+action+'" data-id="'+escapeHTML(p.id)+
     '" data-recipe="'+escapeHTML(r.id)+'" data-zone="'+zone+'" '+
     (!available||away?" disabled":"")+ '>'+label+'</button>';
    return '<div class="card"><h4>'+escapeHTML(f.icon||"🥣")+' '+escapeHTML(r.name)+'</h4>'+
     '<p>🏠 Моја резерва: <b>'+n(r.petReserve)+'</b> · 🏭 Складиште: '+n(r.warehouse)+'</p>'+
     '<div class="btn-grid">'+[
      ["rack","📚 Од сталажи"],["cold","❄ Од разладна"],["packing","📦 Од пакување"]
     ].map(([zone,label])=>mkButton("petFoodSupply",zone,"+1 "+label+" ("+n(r[zone])+")",r[zone]>0)).join("")+
     mkButton("petFoodReturn","rack","↩ Врати 1 во склад",r.petReserve>0)+
     mkButton("petFeedPrepared","rack","🍽 Нахрани со 1",r.petReserve>0&&p.actionsLeft>0)+
     "</div></div>";
   }).join("")+"</div></details>";
 }
 root.TrialumFoodHomeUI={render};
})(globalThis);
