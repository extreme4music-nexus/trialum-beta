/* Trialum v44 — future Google Play credit packs, deliberately fail-closed in beta. */
(function(root,factory){
 const api=factory(root.TrialumEngine);
 root.TrialumBillingCatalog=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(E){
'use strict';
const PRODUCTS=Object.freeze([
 Object.freeze({id:'trialum.credits.100',credits:100,displayPrice:'$0.99',usdCents:99}),
 Object.freeze({id:'trialum.credits.750',credits:750,displayPrice:'$4.99',usdCents:499}),
 Object.freeze({id:'trialum.credits.1500',credits:1500,displayPrice:'$10.00',usdCents:1000})
]);
const BETA_LOCKED=true;
const unavailable=()=>({ok:false,code:'payments_disabled_beta',
 message:'Real-money credit purchases are not available during the Trialum beta.'});
function canPurchase(){return false;}
function attemptPurchase(_s,_id){return unavailable();}
function grantFromClient(_s,_payload){return unavailable();}
function list(){return PRODUCTS.map(p=>({...p,available:false,source:'planned-only',localizedPrice:null}));}
const api={PRODUCTS,BETA_LOCKED,list,canPurchase,attemptPurchase,grantFromClient,
 requirements:['Google Play Billing product catalog','trusted backend purchase-token verification',
  'server idempotency and replay prevention','refund and revocation handling',
  'Play policy and family eligibility','locale-specific store pricing and tax']};
if(E){
 E.longplayPayments=Object.freeze({...E.longplayPayments,enabled:false,billingProvider:null,
  verificationRequired:true,products:PRODUCTS,canPurchase,
  purchase:attemptPurchase,grantFromClient});
 E.futureCreditPacks=list;
}
return api;
});
