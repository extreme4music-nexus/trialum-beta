/* Trialum v44 — locked beta real-money catalog and no local credit grant. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('../js/engine.js');
require('../js/evolution.js');
require('../js/progression.js');
require('../js/longplay.js');
const B=require('../js/locked-billing.js');
const test=(name,fn)=>{fn();console.log('PASS',name)};
function world(){const s=E.newGame('real');s.longplay.credits=10;s.longplay.earned=25;return s;}
test('exact owner-supplied future USD prices are predeclared',()=>{
 assert.deepEqual(B.PRODUCTS.map(x=>[x.credits,x.usdCents]),[[100,99],[750,499],[1500,1000]]);
 assert.deepEqual(B.PRODUCTS.map(x=>x.displayPrice),['$0.99','$4.99','$10.00']);
});
test('purchase remains hard-disabled even without UI',()=>{
 const s=world(),before=JSON.stringify(s);
 for(const id of B.PRODUCTS.map(x=>x.id).concat(['invalid',''])) {
  assert.equal(B.attemptPurchase(s,id).ok,false);
  assert.equal(E.longplayPayments.purchase(s,id).ok,false);
  assert.equal(B.canPurchase(),false);
  assert.equal(E.longplayPayments.canPurchase(),false);
 }
 assert.equal(JSON.stringify(s),before);
});
test('client cannot grant credits by faking any receipt',()=>{
 const s=world(),before=JSON.stringify(s);
 for(const fake of [{verified:true,productId:B.PRODUCTS[0].id},'token',{credits:9999999}])
  assert.equal(B.grantFromClient(s,fake).ok,false);
 assert.equal(JSON.stringify(s),before);
});
test('engine and persisted world explicitly keep store disabled',()=>{
 const s=world();
 assert.equal(B.BETA_LOCKED,true);
 assert.equal(E.longplayPayments.enabled,false);
 assert.equal(s.longplay.storeEnabled,false);
 assert.equal(s.longplay.purchasesEnabled,false);
});
test('future catalog cards are noninteractive in beta',()=>{
 const index=fs.readFileSync(require.resolve('../index.html'),'utf8');
 const ui=fs.readFileSync(require.resolve('../js/longplay-ui.js'),'utf8');
 const sw=fs.readFileSync(require.resolve('../sw.js'),'utf8');
 assert(index.includes('js/locked-billing.js'));
 assert(ui.includes('future-credit-pack')&&ui.includes('item.displayPrice'));
 assert(ui.includes('button disabled aria-disabled="true"'));
 assert(sw.includes('js/locked-billing.js'));
});
console.log('V44 LOCKED BILLING TESTS PASSED');
