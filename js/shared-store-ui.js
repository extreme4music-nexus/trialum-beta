/* Trialum v44 — community-only store presentation. Never adjusts a wallet.
 * Purchase, inventory and scene-placements require authenticated server responses.
 */
(function(root){
'use strict';
const Shop=()=>root.TrialumSharedShop;
const t=(en,mk)=>root.TrialumI18n?.language?.()==='mk'?mk:en;
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function render(snap,{owner=false,enabled=false,catalog=[],open=false,selectedToy=''}={}){
 const inv=Shop()?.inventory?.(snap);
 if(!inv)return '';
 const canBuy=owner&&enabled;
 const loc=root.TrialumI18n?.language?.()||'en';
 const known=new Set(catalog.filter(i=>Shop().isSupported(i.id)&&i.cost===Shop().BY_ID[i.id].cost).map(i=>i.id));
 let html='<section class="card shared-store" data-no-translate>'+
  '<div class="mini-row"><h3>🛍️ '+t('Playground store','Продавница за игротека')+'</h3>'+
  '<button data-do="shShopToggle" aria-expanded="'+!!open+'">'+
  (open?t('Close store','Затвори продавница'):t('Open store','Отвори продавница'))+'</button></div>'+
  '<p class="small">💠 '+inv.credits+' '+t('Shared credits','Заеднички кредити')+
  ' · '+inv.active.length+'/'+inv.capacity+' '+t('placed','поставени')+
  ' · '+inv.owned.length+' '+t('owned','купени')+'</p>'+
  '<p class="small subtle">'+t(
   'These credits belong to this shared playground, not to any player’s personal credit wallet.',
   'Овие кредити припаѓаат на заедничката игротека, не на личниот кредитен биланс на играчите.')+'</p>';
 if(!enabled)html+='<p class="notice">'+t(
  'The store will activate after the private server’s shared-shop upgrade. Your existing credits and toys remain safe.',
  'Продавницата ќе се активира по надградба на приватниот сервер. Постоечките кредити и справи се безбедни.')+'</p>';
 else if(!owner)html+='<p class="small">'+t(
   'Only the owner can buy, place or store equipment. All members earn shared credits by playing.',
   'Само сопственикот може да купува, поставува и складира справи. Сите членови заработуваат заеднички кредити со играње.')+'</p>';
 if(open&&enabled){
  if(selectedToy&&inv.activeSet.has(selectedToy)&&owner){
   html+='<div class="notice"><b>'+esc(Shop().localName(selectedToy,loc))+'</b>'+
    '<p class="small">'+t('Selected in the playground','Избрана во игротеката')+'</p>'+
    '<button data-do="shToyRemove" data-toy="'+esc(selectedToy)+'">↩ '+
    t('Put in storage (no refund)','Врати во складиште (без враќање кредити)')+'</button></div>';
  }
  html+='<div class="cards shared-store-catalog" role="list">'+Shop().ITEMS
   .map(item=>{
    const owned=inv.ownedSet.has(item.id),placed=inv.activeSet.has(item.id);
    const available=known.has(item.id),affordable=inv.credits>=item.cost;
    const text=placed?t('Installed','Поставена'):owned?t('Owned · stored','Купена · складирана'):t('Not owned','Некупена');
    const button=placed?'<button data-do="shToyRemove" data-toy="'+item.id+'"'+(!canBuy?' disabled':'')+
      '>↩ '+t('Store','Складирај')+'</button>':
     owned?'<button data-do="shToyPlace" data-toy="'+item.id+'"'+(!canBuy||inv.active.length>=inv.capacity?' disabled':'')+
      '>➕ '+t('Place free','Постави бесплатно')+'</button>':
     '<button data-do="shShopBuy" data-toy="'+item.id+'"'+(!canBuy||!available||!affordable||item.cost===0?' disabled':'')+
      '>💠 '+t('Buy for','Купи за')+' '+item.cost+'</button>';
    return '<div class="card shared-shop-item" role="listitem"><div class="mini-row"><b>'+
     item.icon+' '+esc(Shop().localName(item.id,loc))+'</b><span>'+text+'</span></div>'+
     '<p class="small subtle">'+(owned?t('Permanent room property','Трајна сопственост на игротеката'):
       '💠 '+item.cost+' '+t('shared credits','заеднички кредити'))+'</p>'+button+'</div>';
   }).join('')+'</div>';
 }
 return html+'</section>';
}
root.TrialumSharedStoreUI={render};
if(typeof module==='object'&&module.exports)module.exports=root.TrialumSharedStoreUI;
})(typeof globalThis!=='undefined'?globalThis:this);
