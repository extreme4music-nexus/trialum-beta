# Trialum v46 Social Eligibility Controller

Status: design contract for v46; not yet implemented or enabled on the production social server.
Branch baseline: `708e71dff612ab06587a8e40cb57a3b1d9577bc8`.
App version target: `1.4 v46`, `versionCode 46` (unchanged).
Scope: Friends, Messages, Shared Playground, presence, invitations, and related social APIs.

## 1. Security decision

There is one authoritative client-side controller, `SocialEligibilityController`. Android and JavaScript report evidence to it; feature modules consume only its `socialReady` state. No feature module may independently grant access.

`socialReady` is true only when all five conditions are true:

1. Age Signals returned a shared, valid 18+ range. The result is held locally and is never sent to Trialum.
2. The player accepted the current social consent version on this device.
3. Play Integrity verified the genuine app/device and the exact eligibility request.
4. The Trialum server issued a non-expired eligibility lease for this social profile/session.
5. The app is foregrounded and no current check has been invalidated.

Unknown, unavailable, under-18, supervised/managed, stale, or contradictory age results fail closed. Offline gameplay remains available. A beta tester flag, saved profile credential, or previous successful check cannot bypass any condition.

The server can verify app/device integrity and the request. Age Signals remains a device-local gate; the server must not receive date of birth, exact age, Google email, or the Age Signals payload.

## 2. Consent contract

- Define a new constant such as `trialum-social-v46`.
- Store consent locally with the version and acceptance time. Consent from v39 or any earlier version is stale and requires a new explicit acceptance.
- A consent-version assertion is sent transiently with an eligibility challenge so the server can reject obsolete client policy. It is not an account identity field and must not be included in application logs or analytics.
- Re-consenting must not delete, recreate, or modify the player's existing social profile or local world.
- Revoke consent immediately closes local access and discards the in-memory eligibility lease. It does not silently delete the profile.
- Because the current UI says consent is local-only, the privacy notice must be updated to disclose the transient version assertion before this contract ships.

## 3. Play Integrity and server API

Use Play Integrity Standard requests. The app prepares a token provider using the public numeric Cloud project number, computes a request hash for the specific challenge, requests a token, and sends the encrypted token to the Trialum server. The server—not the app—decodes the token through Google's Play Integrity API and makes the decision. See [Google's Standard request flow](https://developer.android.com/google/play/integrity/standard).

### 3.1 Create a challenge

`POST /v1/social/eligibility/challenge` over HTTPS, rate-limited, without a social bearer token (the player may not have created a profile yet).

Request:

```json
{
  "action": "social_enable",
  "consentVersion": "trialum-social-v46",
  "packageName": "com.trialum.ziivaiskra",
  "versionCode": 46
}
```

Response:

```json
{
  "challengeId": "opaque-random-id",
  "nonce": "base64url-random-value",
  "expiresAt": "server-issued-UTC-time"
}
```

The server generates a cryptographically random, one-use nonce and stores only what it needs to validate and consume the challenge. Target lifetime: 120 seconds. Challenges are single-use and rate-limited. Do not use a client-generated timestamp as a nonce.

### 3.2 Bind and verify the request

The client forms canonical UTF-8 data from the server challenge ID, nonce, action, consent version, package name, and version code; it computes SHA-256 and encodes the result as required by Play Integrity's `requestHash`. The canonicalization format is versioned and tested identically on client and server.

`POST /v1/social/eligibility/verify`

Request:

```json
{
  "challengeId": "opaque-random-id",
  "requestHash": "base64url-sha256",
  "integrityToken": "encrypted-google-token",
  "consentVersion": "trialum-social-v46"
}
```

Server checks, in order:

- challenge exists, has not expired, matches the action/consent/version, and has not been consumed;
- Google successfully decodes the token;
- token package name, app recognition verdict, signing certificate digest, and version code match the server allowlist;
- device verdict meets the configured physical-device policy;
- Play licensing verdict is acceptable for the selected distribution channel;
- decoded request hash equals the server's expected canonical hash;
- request timestamp/freshness and nonce are valid, with replay prevention.

For v46 Play-distributed testing, the initial policy is `PLAY_RECOGNIZED`, the owner release certificate, `versionCode 46`, `MEETS_DEVICE_INTEGRITY`, and `LICENSED`. A locally sideloaded APK may not satisfy the Play licensing verdict; a full social-flow acceptance run therefore uses an app installed from its Play test track. Such a sideload can still verify offline operation and fail-closed behavior.

Successful response:

```json
{
  "eligible": true,
  "eligibilityToken": "opaque-random-server-token",
  "expiresAt": "server-issued-UTC-time",
  "consentVersion": "trialum-social-v46"
}
```

Target lease lifetime: 15 minutes. Store only a hash of the opaque token server-side. Bind it to the social profile after profile registration; before registration, allow it only for the single profile-creation flow. The token is memory-only on the device and is never written to localStorage, world saves, backups, crash reports, or logs.

Renewal repeats the challenge and verification flow. The client requests renewal only when the lease is near expiry or a protected server response says it expired. There is no background retry loop.

### 3.3 Protect social APIs

Every protected REST and WebSocket operation must require both the existing social profile credential and a valid eligibility lease, including profile creation, friend operations, messages, shared-playground operations, presence, invitations, and social push registration. The server validates expiry, profile binding, and consent version on each connection/action. A client-side UI gate alone is not authorization.

Account deletion and local consent revocation remain available when the lease has expired; deletion still requires the existing profile credential and is never blocked by Age Signals or Play Integrity. A user-triggered disable/revoke request may invalidate the lease server-side. If offline, local access is closed immediately and the server lease expires on its short TTL.

## 4. Controller state and lifecycle

Controller states exposed to the UI:

- `age_unchecked`, `age_checking`, `age_adult`, `age_restricted`, `age_unavailable`
- `consent_required`
- `integrity_preparing`, `integrity_unavailable`, `integrity_rejected`
- `server_checking`, `server_unavailable`, `eligibility_expired`
- `app_background`
- `social_ready`

Rules:

- Each asynchronous Age Signals, Integrity, and server request has a monotonically increasing request/generation ID. Ignore late callbacks whose generation no longer matches.
- A Google-owned Activity interruption does not discard the in-flight request. A valid callback may update the current session while backgrounded, but cannot unlock social access until the app is foregrounded and the controller reevaluates all prerequisites.
- **Do not invalidate the pending Age Signals request solely from `MainActivity.onStop()`.** Google-owned consent UI can stop the Activity during a valid request. `onStop()` closes social access and pauses social transports, but keeps the matching request generation pending; its callback may update the session while backgrounded. Invalidate only when a newer request supersedes it, consent is revoked, or the Activity/process is being permanently destroyed. On foreground return, reevaluate every prerequisite before reopening access. In the v46 baseline inspected for this design, `onStop()` does not currently call `ageSignals.invalidate()` and `TrialumAgeSignals` has no `invalidate()` method; this rule prevents a future lifecycle regression and is not a claim of a physically reproduced failure.
- On background: set `socialReady=false` first; close WebSockets; stop nearby discovery and presence; stop social polling. Preserve the social profile credential and the already completed local age/consent results in memory as appropriate.
- On foreground: recheck native Age Signals eligibility, consent version, and lease expiry. Renew only the expired/missing prerequisite. Never register the profile again as recovery behavior.
- A process restart begins closed. Keep no eligibility token in persistent storage; obtain fresh Integrity/server eligibility before social access.
- A stale consent version returns to `consent_required`; it does not erase the profile or world.
- Keep at most one in-flight request per prerequisite. No automatic retry loops. A user retry repeats only the failed prerequisite, uses a fresh challenge/token when required, and has a bounded cooldown.

The JavaScript facade exposes read-only `getState()`, `isSocialAllowed()`, and `isSocialProfileActive()`; only the controller can transition eligibility. Friends, Messages, Shared Playground, and presence query this facade and cannot set readiness themselves.

## 5. User-facing status copy

Show the blocking prerequisite, not a generic “Locked” message. English and Macedonian copy must be maintained together.

| State | English | Macedonian |
|---|---|---|
| Age Signals passed | Age check complete on this device. | Проверката на возраст на овој уред е успешна. |
| Consent missing/stale | Review and accept the current social consent. | Прегледај ја и прифати ја тековната согласност за социјалните функции. |
| Integrity unavailable | Play Integrity is unavailable. Try again. | Play Integrity не е достапен. Обиди се повторно. |
| Integrity rejected | This app or device could not be verified. | Апликацијата или уредот не можеа да се потврдат. |
| Server unavailable | The social service could not confirm access. Try again. | Социјалната услуга не можеше да го потврди пристапот. Обиди се повторно. |
| Lease expired | Social eligibility expired. Refresh access. | Потврдата за социјален пристап истече. Обнови ја. |
| Ready | Social features are active. | Социјалните функции се активни. |

Never display or log the Integrity token, nonce, exact age range, DOB, or Google account data.

## 6. Implementation sequence

1. Add the versioned controller contract and tests in the beta branch.
2. Implement Android Age Signals request IDs and lifecycle callbacks.
3. Add Play Integrity Standard provider preparation and request hashing, configured by a public numeric Cloud project number. Keep service-account credentials exclusively on the private server.
4. Implement the server challenge/verify/lease patch in the beta handoff; do not deploy it from CI or expose credentials in the public build repo.
5. Make every social client module consume the central controller and add the eligibility header to all protected REST/WebSocket paths.
6. Update the in-app consent disclosure and privacy documentation before release.
7. Run deterministic CI tests, then produce an unsigned v46 Play candidate. Owner signing and Play-track upload remain separate owner actions.

## 7. Acceptance tests

CI must cover: eligible 18+; underage/unknown/not-shared; stale consent; integrity provider unavailable; rejected app/device verdict; expired/replayed challenge; server offline; expired lease; lost network; duplicate and stale callbacks; background during the Google UI; resume after valid/failed callback; process restart; simultaneous requests; social-module REST/WebSocket gates; profile deletion while eligibility is expired; and proof that credentials, age data, and Integrity tokens never enter logs or saves.

Physical acceptance uses the owner-signed v46 installed from the Play test track. Verify offline play remains usable, social functions remain closed until all five checks pass, then exercise Friends, Messages, Shared Playground, background/foreground, and lease renewal. Do not claim beta approval until the owner completes this phone test.
