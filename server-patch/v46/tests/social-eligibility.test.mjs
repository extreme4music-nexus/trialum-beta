import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateIntegrityPayload } from '../src/social-eligibility.mjs';

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
