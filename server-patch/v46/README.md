# v46 Play Integrity and server eligibility patch

**Staged patch only.** It has not been copied to or deployed on the private Trialum server. Do not point a tester build at this patch until the owner-controlled server has installed the migration, routes, Google decoder credentials, and route-wide enforcement.

## Components

- `sql/009_v46_social_eligibility.sql`: additive challenge and short-lived eligibility lease tables.
- `src/social-eligibility.mjs`: challenge creation, one-use nonce verification, Google-verdict policy, short lease issuance, and middleware helpers.
- `tests/social-eligibility.test.mjs`: deterministic verdict-policy tests.

The module deliberately receives `decodeIntegrityToken` as a dependency. The server integration must implement that dependency with Google Play Integrity's `decodeIntegrityToken` endpoint and server-only Application Default Credentials/service account. Never store a service-account key in this public repository, GitHub Actions, the app, or logs.

## Required route integration

1. Construct `createSocialEligibilityService({pool, decodeIntegrityToken, packageName, versionCode, certificateSha256Digest})` on the private server, using server configuration and a private credential source.
2. Route `POST /v1/social/eligibility/challenge` to `createChallenge(body)`.
3. Route `POST /v1/social/eligibility/verify` to `verifyChallenge(body, installationIdOrNull)`. For profile creation, the returned unbound token must be atomically bound to the new installation; all other social operations require an already bound eligibility token.
4. Verify the token on every protected REST, WebSocket, presence, message, shared-playground and push-registration operation. Keep profile deletion available with valid profile credentials even if eligibility expired.
5. Add `x-trialum-eligibility` to CORS allowed headers. Return stable error codes (`integrity_unavailable`, `integrity_rejected`, `server_eligibility_expired`); do not expose decoded verdict payloads.
6. Revoke/expire leases when a profile is deleted; purge expired challenge/session rows on a scheduled cleanup.
7. Deploy the Google Cloud project number to the public Android build as a non-secret configuration value. Configure the server's Google decoder credentials only through the private server secret store, and enable Play Integrity API for the linked Google Cloud project.

## Policy for v46 Play-distributed testing

- Package: `com.trialum.ziivaiskra`
- Version code: `46`
- App recognition: `PLAY_RECOGNIZED`
- Certificate digest: owner release signing certificate allowlist
- Device verdict: `MEETS_DEVICE_INTEGRITY`
- Play licensing: `LICENSED`

This means a sideloaded APK may intentionally fail social eligibility. Full social-flow testing must install the owner-signed v46 through its Play testing track. A failed eligibility check never deletes or re-registers a social profile.

## Review and deployment gate

Before deployment, integrate against the current private-server head (do not overwrite it with a staged snapshot), run the server's PostgreSQL integration suite, apply the additive SQL migration after a tested backup, and smoke-test challenge, replay rejection, expiry, account deletion, REST/WSS enforcement, and rollback. This repository does not deploy or run production migrations.
