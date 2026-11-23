import { createHash, randomBytes, randomUUID } from 'node:crypto';

export const SOCIAL_ELIGIBILITY_CONSENT_VERSION = 'trialum-social-v46';
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const sha256 = value => createHash('sha256').update(value, 'utf8').digest();
const requestHash = ({ action, challengeId, nonce, consentVersion, packageName, versionCode }) =>
  createHash('sha256').update([
    'trialum-social-eligibility-v1', action, challengeId, nonce,
    consentVersion, packageName, String(versionCode)
  ].join('\n'), 'utf8').digest('base64url');

export function evaluateIntegrityPayload(payload, expected, now = Date.now()) {
  const details = payload?.requestDetails;
  const app = payload?.appIntegrity;
  const device = payload?.deviceIntegrity;
  const account = payload?.accountDetails;
  const timestamp = Number(details?.timestampMillis);
  const verdicts = Array.isArray(device?.deviceRecognitionVerdict)
    ? device.deviceRecognitionVerdict : [];
  const certs = Array.isArray(app?.certificateSha256Digest)
    ? app.certificateSha256Digest : [];
  const failures = [];
  if (details?.requestPackageName !== expected.packageName) failures.push('package_mismatch');
  if (details?.requestHash !== expected.requestHash) failures.push('request_hash_mismatch');
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > 120_000) failures.push('stale_integrity_token');
  if (app?.appRecognitionVerdict !== 'PLAY_RECOGNIZED') failures.push('app_not_play_recognized');
  if (!certs.includes(expected.certificateSha256Digest)) failures.push('signing_certificate_mismatch');
  if (String(app?.versionCode) !== String(expected.versionCode)) failures.push('version_mismatch');
  if (!verdicts.includes('MEETS_DEVICE_INTEGRITY')) failures.push('device_integrity_missing');
  if (account?.appLicensingVerdict !== 'LICENSED') failures.push('play_license_missing');
  return { eligible: failures.length === 0, failures };
}

/**
 * Server-side challenge/verification service. The caller must supply decodeIntegrityToken,
 * implemented using Google service credentials from the private server's secret store.
 * No Google credentials belong in the app, GitHub variables, source, or logs.
 */
export function createSocialEligibilityService({
  pool, decodeIntegrityToken, packageName, versionCode, certificateSha256Digest,
  consentVersion = SOCIAL_ELIGIBILITY_CONSENT_VERSION,
  now = () => Date.now(), challengeTtlMs = 120_000, leaseTtlMs = 900_000
}) {
  if (!pool || typeof decodeIntegrityToken !== 'function' || !packageName ||
      !Number.isInteger(Number(versionCode)) || !certificateSha256Digest) {
    throw new Error('social_eligibility_server_not_configured');
  }

  async function createChallenge(input) {
    if (input?.action !== 'social_enable' || input?.consentVersion !== consentVersion ||
        input?.packageName !== packageName || Number(input?.versionCode) !== Number(versionCode)) {
      throw Object.assign(new Error('eligibility_policy_mismatch'), { status: 409 });
    }
    const challengeId = randomUUID();
    const nonce = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now() + challengeTtlMs);
    await pool.query(
      `INSERT INTO social_eligibility_challenges
       (challenge_id,nonce_hash,action,consent_version,package_name,version_code,expires_at)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [challengeId, sha256(nonce), input.action, consentVersion, packageName, Number(versionCode), expiresAt]
    );
    return { challengeId, nonce, expiresAt: expiresAt.toISOString() };
  }

  async function verifyChallenge(input, installationId = null) {
    if (typeof input?.challengeId !== 'string' || input.challengeId.length > 64 ||
        typeof input?.nonce !== 'string' || input.nonce.length > 64 ||
        typeof input?.integrityToken !== 'string' || input.integrityToken.length > 16_384 ||
        input?.consentVersion !== consentVersion) {
      throw Object.assign(new Error('eligibility_request_invalid'), { status: 400 });
    }
    const client = await pool.connect();
    let challenge;
    try {
      await client.query('BEGIN');
      const found = await client.query(
        'SELECT * FROM social_eligibility_challenges WHERE challenge_id=$1 FOR UPDATE',
        [input.challengeId]
      );
      if (!found.rowCount) throw Object.assign(new Error('eligibility_challenge_invalid'), { status: 409 });
      challenge = found.rows[0];
      if (challenge.consumed_at || new Date(challenge.expires_at).getTime() <= now() ||
          challenge.consent_version !== consentVersion ||
          !sha256(input.nonce).equals(challenge.nonce_hash)) {
        throw Object.assign(new Error('eligibility_challenge_expired'), { status: 409 });
      }
      await client.query(
        'UPDATE social_eligibility_challenges SET consumed_at=now() WHERE challenge_id=$1',
        [input.challengeId]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
      throw error;
    }
    client.release();

    let payload;
    try { payload = await decodeIntegrityToken(input.integrityToken); }
    catch (_) { throw Object.assign(new Error('integrity_unavailable'), { status: 503 }); }
    const expectedHash = requestHash({
      action: challenge.action, challengeId: challenge.challenge_id, nonce: input.nonce,
      consentVersion: challenge.consent_version, packageName: challenge.package_name,
      versionCode: challenge.version_code
    });
    const verdict = evaluateIntegrityPayload(payload, {
      packageName, versionCode, certificateSha256Digest, requestHash: expectedHash
    }, now());
    if (!verdict.eligible) {
      throw Object.assign(new Error('integrity_rejected'), { status: 403, reasons: verdict.failures });
    }

    const eligibilityToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now() + leaseTtlMs);
    await pool.query(
      `INSERT INTO social_eligibility_sessions
       (token_hash,installation_id,consent_version,expires_at)
       VALUES($1,$2,$3,$4)`,
      [sha256(eligibilityToken), installationId, consentVersion, expiresAt]
    );
    return { eligible: true, eligibilityToken, expiresAt: expiresAt.toISOString(), consentVersion };
  }

  async function requireEligibility(req, installationId) {
    const token = req.headers['x-trialum-eligibility'];
    if (typeof token !== 'string' || !TOKEN.test(token)) {
      throw Object.assign(new Error('server_eligibility_required'), { status: 403 });
    }
    const found = await pool.query(
      `SELECT 1 FROM social_eligibility_sessions
       WHERE token_hash=$1 AND installation_id=$2
         AND consent_version=$3 AND expires_at>now()`,
      [sha256(token), installationId, consentVersion]
    );
    if (!found.rowCount) throw Object.assign(new Error('server_eligibility_expired'), { status: 403 });
    return true;
  }

  async function bindUnboundToken(req, installationId) {
    const token = req.headers['x-trialum-eligibility'];
    if (typeof token !== 'string' || !TOKEN.test(token)) {
      throw Object.assign(new Error('server_eligibility_required'), { status: 403 });
    }
    const result = await pool.query(
      `UPDATE social_eligibility_sessions SET installation_id=$2
       WHERE token_hash=$1 AND installation_id IS NULL
         AND consent_version=$3 AND expires_at>now()`,
      [sha256(token), installationId, consentVersion]
    );
    if (result.rowCount !== 1) throw Object.assign(new Error('server_eligibility_expired'), { status: 403 });
    return true;
  }

  return { createChallenge, verifyChallenge, requireEligibility, bindUnboundToken };
}

export function eligibilityRequestHashForClient(input) {
  return requestHash(input);
}
