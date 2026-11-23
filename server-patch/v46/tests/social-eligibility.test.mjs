import test from 'node:test';
import assert from 'node:assert/strict';
import { createSocialEligibilityService, evaluateIntegrityPayload } from '../src/social-eligibility.mjs';

const expected = {
  packageName: 'com.trialum.ziivaiskra',
  versionCode: 46,
  certificateSha256Digest: 'owner-cert-digest',
  requestHash: 'bound-request-hash'
};
const payload = () => ({
  requestDetails: {
    requestPackageName: expected.packageName,
    requestHash: expected.requestHash,
    timestampMillis: '1000000'
  },
  appIntegrity: {
    appRecognitionVerdict: 'PLAY_RECOGNIZED',
    certificateSha256Digest: [expected.certificateSha256Digest],
    versionCode: '46'
  },
  deviceIntegrity: { deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'] },
  accountDetails: { appLicensingVerdict: 'LICENSED' }
});

test('accepts only the exact app, signing certificate, version, device and bound request', () => {
  assert.deepEqual(evaluateIntegrityPayload(payload(), expected, 1_000_001), { eligible: true, failures: [] });
});
test('rejects unrecognized, sideloaded, mismatched or stale evidence', () => {
  const cases = [
    p => { p.appIntegrity.appRecognitionVerdict='UNRECOGNIZED_VERSION'; },
    p => { p.appIntegrity.certificateSha256Digest=['wrong']; },
    p => { p.appIntegrity.versionCode='45'; },
    p => { p.deviceIntegrity.deviceRecognitionVerdict=[]; },
    p => { p.accountDetails.appLicensingVerdict='UNLICENSED'; },
    p => { p.requestDetails.requestHash='other-request'; }
  ];
  for (const mutate of cases) {
    const p=payload();mutate(p);
    assert.equal(evaluateIntegrityPayload(p,expected,1_000_001).eligible,false);
  }
  assert.equal(evaluateIntegrityPayload(payload(),expected,1_500_000).eligible,false);
});

test('one-use challenge issues a profile-bound short lease; replay is rejected', async () => {
  const fixedNow=1_000_000;
  let challengeRow=null,sessionRow=null;
  const pool={
    async query(sql,values=[]){
      if(sql.includes('INSERT INTO social_eligibility_challenges')){
        challengeRow={challenge_id:values[0],nonce_hash:values[1],action:values[2],consent_version:values[3],
          package_name:values[4],version_code:values[5],expires_at:values[6],consumed_at:null};return {rowCount:1};
      }
      if(sql.includes('INSERT INTO social_eligibility_sessions')){
        sessionRow={token_hash:values[0],installation_id:values[1],consent_version:values[2],expires_at:values[3]};return {rowCount:1};
      }
      if(sql.includes('UPDATE social_eligibility_sessions SET installation_id')){
        if(sessionRow?.installation_id===null&&sessionRow.token_hash.equals(values[0])){
          sessionRow.installation_id=values[1];return {rowCount:1};
        }
        return {rowCount:0};
      }
      if(sql.includes('SELECT 1 FROM social_eligibility_sessions')){
        const ok=sessionRow&&sessionRow.token_hash.equals(values[0])&&sessionRow.installation_id===values[1]&&
          sessionRow.consent_version===values[2]&&sessionRow.expires_at.getTime()>fixedNow;
        return {rowCount:ok?1:0};
      }
      throw new Error('unexpected_test_query');
    },
    async connect(){return {async query(sql,values=[]){
      if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK')return {rowCount:0};
      if(sql.startsWith('SELECT * FROM social_eligibility_challenges'))return {rowCount:challengeRow?1:0,rows:challengeRow?[challengeRow]:[]};
      if(sql.startsWith('UPDATE social_eligibility_challenges')){challengeRow.consumed_at=new Date(fixedNow);return {rowCount:1};}
      throw new Error('unexpected_test_transaction_query');
    },release(){}};}
  };
  let decodedHash='';
  const service=createSocialEligibilityService({pool,packageName:expected.packageName,versionCode:46,
    certificateSha256Digest:expected.certificateSha256Digest,now:()=>fixedNow,
    decodeIntegrityToken:async()=>({...payload(),requestDetails:{...payload().requestDetails,requestHash:decodedHash}})});
  const consentVersion='trialum-social-v46';
  const challenge=await service.createChallenge({action:'social_enable',consentVersion,
    packageName:expected.packageName,versionCode:46});
  decodedHash=challenge.requestHash;
  const result=await service.verifyChallenge({challengeId:challenge.challengeId,nonce:challenge.nonce,
    integrityToken:'opaque-integrity-token',consentVersion},null);
  assert.equal(result.eligible,true);assert.equal(sessionRow.installation_id,null);
  const req={headers:{'x-trialum-eligibility':result.eligibilityToken}};
  assert.equal(await service.bindUnboundToken(req,'installation-1'),true);
  assert.equal(await service.requireEligibility(req,'installation-1'),true);
  await assert.rejects(()=>service.requireEligibility(req,'installation-2'),/server_eligibility_expired/);
  await assert.rejects(()=>service.verifyChallenge({challengeId:challenge.challengeId,nonce:challenge.nonce,
    integrityToken:'opaque-integrity-token',consentVersion},null),/eligibility_challenge_expired/);
});
