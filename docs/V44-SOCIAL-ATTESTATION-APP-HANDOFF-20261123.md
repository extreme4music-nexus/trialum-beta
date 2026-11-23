# Trialum v44 — social eligibility server integration handoff

**Audience:** Android/app implementation session  
**Server patch:** `server-patch/v44` on `feature/v44-owner-hud-economy-guidance-20261122`  
**Status:** server contract staged; Android changes are required before enforcement is enabled.

## Safety and rollout contract

- Keep the existing native Google Play Age Signals check as the sole source of the local adult/eligible decision. Unknown, declined, underage, supervised/ineligible, or unavailable results remain fail-closed for social features.
- Play Integrity proves that Google recognized the installed app/device and that a request was bound to its contents. **It does not prove age and is not a substitute for Age Signals.** The server trusts the signed production app to request the token only after its native Age Signals check succeeds.
- Do not send the Age Signals response, age band, exact age, date of birth, Google account/email, or device ID to Trialum. The app sends only the Play Integrity token, explicit consent/version and required action-bound request data. Trialum forwards the token to Google to decode it and stores only the consent version, consent timestamp and server verification timestamp.
- Keep `TRIALUM_SOCIAL_ATTESTATION_REQUIRED=false` until this app update is available and verified on a Play-installed production-package build, and backend Google credentials are configured. Legacy clients and existing profiles continue in compatibility mode during that period.
- When enforcement is enabled, stale/legacy profiles are not erased. At next app use, ask the user to review/accept the current social consent and reattest. Until then only social online actions are unavailable; local worlds, pets, memories and profile recovery/deletion remain available. If the user withdraws consent, call revoke and stop social clients. Never delete or reset local progress.

## Server capability discovery

`GET /v1/social/status` returns, among other existing fields:

```json
{
  "socialAttestationReady": true,
  "socialEligibilityRequired": false,
  "registrationIntegrityRequired": false,
  "socialConsentVersion": "trialum-social-v1",
  "eligibilityTtlSeconds": 86400
}
```

The two `false` values are deliberate while the app rollout is staged. The app must continue enforcing its native Age Signals + explicit-consent checks locally regardless of these server flags. A missing or false `socialAttestationReady` means do not attempt the new server flow; preserve the existing account and show a recoverable retry/update state.

## Request hash (exact bytes)

Use UTF-8 bytes of this exact string, including the four newline-delimited lines and no trailing newline:

```text
trialum-social-integrity-v1
{action}
{consentVersion}
{subject}
```

Compute SHA-256, then Base64 URL-safe **without padding**. `requestHash` is this result. The server uses the same function in `server-patch/v44/src/play-integrity.mjs`.

- `action` is `register` or `renew`.
- `consentVersion` is read from `/v1/social/status` (`trialum-social-v1` at this revision).
- For `register`, `subject` is the exact trimmed nickname sent in the registration body.
- For `renew`, `subject` is the profile UUID returned by the server (not the credential).
- Call Play Integrity Standard's `requestIntegrityToken(requestHash=...)` only after the native age check permits social use and the user has accepted the current social consent. Do not log or persist the raw token.

The server accepts only a newly issued token (maximum age 2 minutes), matching package and request hash, `PLAY_RECOGNIZED`, `LICENSED`, and `MEETS_DEVICE_INTEGRITY`. The production package is `com.trialum.ziivaiskra`. Do not use QA/debug/suffixed packages for production eligibility.

## Profile creation

Keep the current local age gate, social consent screen, nickname privacy confirmation and recovery-kit safety flow. For the network request, add:

```http
POST /v1/social/register
Content-Type: application/json
```

```json
{
  "nickname": "Trimmed nickname",
  "socialConsentAccepted": true,
  "socialConsentVersion": "trialum-social-v1",
  "nicknamePrivacyConfirmed": true,
  "integrityToken": "<fresh Play Integrity Standard token>"
}
```

The existing response still returns `id`, `nickname`, `credential`, `recoveryKey`, and `recoveryKitVersion`. Preserve the existing secure display/storage behavior for the one-time recovery key. Do not retry registration automatically after an ambiguous network timeout; first use the existing recovery/profile flow so the app cannot create duplicate identities or lose the only returned recovery key.

## Existing profiles and each social session

After loading the saved credential, before starting REST/WSS/social clients:

1. Run the native Age Signals check and require the same eligible adult result as the current app.
2. If the user has not accepted the current social consent version, show the consent text and privacy disclosure, and wait for explicit acceptance.
3. Call `GET /v1/social/eligibility/status` with `Authorization: Bearer <credential>`.
4. If eligible and not expired, continue.
5. Otherwise create a fresh `renew` request hash using the server consent version and profile UUID, obtain a fresh Play Integrity token, and call:

```http
POST /v1/social/eligibility/attest
Authorization: Bearer <credential>
Content-Type: application/json
```

```json
{
  "socialConsentAccepted": true,
  "socialConsentVersion": "trialum-social-v1",
  "integrityToken": "<fresh token bound to renew/version/profile UUID>"
}
```

Only start online social services after success. The attestation lasts 24 hours. Recheck at app foreground/resume and renew when needed. A `428 eligibility_attestation_required` response means run this recoverable flow; do not erase the profile or local world. Network/Google temporary failures should show retry and leave local/offline play available.

After restoring a profile on a new installation, keep the existing ID/recovery-key flow, then run the Age Signals + consent + `renew` attestation sequence before social use. Account recovery itself must remain reachable even when the previous attestation has expired.

## Consent withdrawal

When the user turns social consent off, first stop local social REST/WSS clients, then call:

```http
POST /v1/social/eligibility/revoke
Authorization: Bearer <credential>
```

Server clears only the eligibility/consent timestamps and closes active WSS sessions. It does not delete the account, friends, room ownership, game data, or local save. Keep a clear path to review consent and reattest later.

The existing `DELETE /v1/social/account` route remains usable for account deletion even if the attestation is stale. Do not hide it behind the new gate.

## Errors and recovery UX

- `428 eligibility_attestation_required`: refresh eligibility/consent and obtain a new bound token; preserve profile and local progress.
- `400 social_consent_required`: show the current consent UI; do not silently retry.
- `403 eligibility_proof_invalid`: discard the token and start a new Age Signals + Integrity request; do not loop indefinitely.
- `503 integrity_verification_unavailable`: keep offline gameplay available and offer retry. Do not fall back to a client boolean or bypass.
- `401 authentication_required`: use the existing profile recovery UX; never create a new account automatically.
- WSS close code 1008 with `eligibility_attestation_required` or `session_revoked`: stop reconnect loops, refresh status, and follow the same consent/attestation flow.

## Privacy text and implementation checks

Update the in-app social-consent/privacy text to disclose that a short-lived Play Integrity token is sent to Trialum and forwarded to Google for verification, and that Trialum records the consent text version/time and verification time. Reconfirm the public Privacy Policy and Play Data Safety answers before release. Do not describe this as server verification of age or identity, and do not claim biometric/ID/MFA verification.

The app handoff is complete only when the production package uses the contract above, native Age Signals remains fail-closed, consent withdrawal reaches the revoke endpoint, old/restored profiles can renew without losing progress, and server enforcement is not enabled before the Play-installed flow is ready.
