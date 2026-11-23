import { GoogleAuth } from 'google-auth-library';

const PACKAGE = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+$/;

/**
 * Create a private-server Play Integrity decoder using Application Default
 * Credentials. The credential is never passed to callers or logged.
 */
export function createGoogleIntegrityDecoder({
  packageName = 'com.trialum.ziivaiskra',
  auth = new GoogleAuth({scopes: 'https://www.googleapis.com/auth/playintegrity'}),
  timeoutMs = 10_000
} = {}) {
  if (!PACKAGE.test(packageName)) throw new Error('invalid_integrity_package');
  const clientPromise = auth.getClient();
  const endpoint = `https://playintegrity.googleapis.com/v1/${packageName}:decodeIntegrityToken`;

  return async integrityToken => {
    if (typeof integrityToken !== 'string' || integrityToken.length < 1 || integrityToken.length > 16_384)
      throw new Error('invalid_integrity_token');
    const client = await clientPromise;
    const response = await client.request({
      url: endpoint,
      method: 'POST',
      data: {integrityToken},
      timeout: timeoutMs
    });
    const payload = response?.data?.tokenPayloadExternal;
    if (!payload || typeof payload !== 'object') throw new Error('integrity_payload_missing');
    return payload;
  };
}
