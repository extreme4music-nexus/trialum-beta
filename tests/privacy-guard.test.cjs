'use strict';
const assert=require('node:assert/strict');
const {inspect}=require('../js/privacy-guard.js');

assert.deepEqual(inspect('Contact me at child@example.com'),{
 blocked:true,requiresConfirmation:false,reason:'personal_data_blocked'
});
assert.equal(inspect('My real name is Alex').blocked,true);
assert.equal(inspect('Каде живееш?').requiresConfirmation,true);
assert.equal(inspect('How was your day?').requiresConfirmation,false);
console.log('Privacy guard blocks contact/identity disclosure and flags personal-data requests');
