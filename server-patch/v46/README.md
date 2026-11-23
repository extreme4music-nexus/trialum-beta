# v46 Social Eligibility and Play Integrity server patch

This is the server-side half of v46. It is staged in `trialum-beta`; it is **not live** until applied to the owner-controlled private server, deployed and smoke-tested. Do not upload v46 to Play internal testing before that work is complete.

## Flow implemented by the v46 app

1. The device obtains a local Google Play Age Signals result. Only a supported 18+ signal permits continuing. No age data, Google email or Google profile ID is sent to this server.
2. The player must accept the current local consent `trialum.social.consent.v46`.
3. The app requests `POST /v1/social/eligibility/challenge`. The server creates a one-use nonce and returns a request hash bound to action, challenge, consent version, package and version code.
4. Android obtains a Play Integrity Standard token bound to that exact request hash.
5. The app sends the token to `POST /v1/social/eligibility/verify`. The server decodes it with Google and checks app recognition, package, version 46, the **Play app-signing certificate SHA-256 digest**, device integrity, Play license, timestamp and request hash.
6. The server returns a random 15-minute lease. The app keeps it only in memory. Friends, Messages and Shared Playground consume the same `SocialEligibilityController.isReady` state, send the lease on protected REST requests and include it when authenticating WSS.

## Patch components

- `sql/007_v46_social_eligibility.sql` — additive nonce and hashed-lease tables; no game/profile rows are rewritten.
- `src/social-eligibility.mjs` — single-use challenge, Google verdict policy, short lease, profile binding and lease enforcement helpers.
- `src/google-integrity-decoder.mjs` — Google `decodeIntegrityToken` client using server ADC and the Play Integrity OAuth scope.
- `tests/social-eligibility.test.mjs` — deterministic Google verdict policy checks.
- `INTEGRATION.md` — required changes for the existing Node/PostgreSQL service. Keep this service integration in the private Trialum source/server, not in this public repository.

The server module receives `decodeIntegrityToken` as an injected function. Use `createGoogleIntegrityDecoder()` with the existing server `google-auth-library` and server-only Application Default Credentials. It calls Google's Play Integrity decode endpoint using the `playintegrity` OAuth scope. Never place service credentials in Android, this public repo, Actions variables, logs, or chat.

## Required configuration

- `SOCIAL_ELIGIBILITY_ENABLED=true` only after code and SQL are deployed. It is a server-side feature gate, separate from the existing `TRIALUM_SOCIAL_ENABLED`, `TRIALUM_SHARED_ENABLED`, `TRIALUM_PRESENCE_ENABLED`, and `TRIALUM_MESSAGES_ENABLED` switches.
- Package `com.trialum.ziivaiskra`, version code `46`.
- Cloud project number in public build variable `TRIALUM_INTEGRITY_CLOUD_PROJECT_NUMBER` (numeric; not a credential).
- Google Cloud Play Integrity API enabled for that project and the server's ADC identity authorized to decode tokens.
- `certificateSha256Digest` must match the app-signing certificate in Play Integrity's `appIntegrity.certificateSha256Digest` verdict (URL-safe Base64, no padding). If Play Console shows a colon-separated SHA-256 fingerprint, convert its bytes to Base64URL without padding. Use the **Play app-signing certificate**, not the local upload-key certificate. Do not guess it.
- Lease duration: 15 minutes; challenge duration: 2 minutes. A failed/expired check requires a new challenge; the social profile is never reset.

## Route enforcement

- Exempt only health/status, challenge, and the authenticated account-deletion endpoint from lease checks. Deletion must remain possible with a valid profile credential if consent or a lease expires.
- `register` and recovery restore bind their one-use unbound lease to the newly resolved installation **inside the same database transaction** using `bindUnboundToken(req, id, transactionClient)`.
- On the verify route, resolve the existing installation from its bearer credential (without returning its ID to Google), then pass that ID to `verifyChallenge` so the new lease is already bound.
- All other protected REST routes, including `/v1/messages/*` and `/v1/shared/*`, call `requireEligibility(req, installationId)` after authenticating the profile.
- The WSS `auth` message must include `eligibilityToken`; verify it and bind it to the authenticated installation before acknowledging `ready`. Reject every connection or message when the lease is absent, expired, revoked, or bound to another profile.
- Include `x-trialum-eligibility` in CORS allowed headers. Never return raw Google verdicts or failure details to the app. Use stable errors: `integrity_unavailable`, `integrity_rejected`, `server_eligibility_required`, `server_eligibility_expired`.
- Revoke leases on profile deletion, and periodically purge expired challenges and sessions.

## Safe enablement order

1. Back up the private server source and PostgreSQL database; test the backup can be restored.
2. Apply this patch to the current private server head without replacing newer source files. Run the server unit and PostgreSQL integration suites.
3. Deploy with `SOCIAL_ELIGIBILITY_ENABLED=false`; verify health, migration and that all routes still fail closed.
4. Enable Play Integrity API / ADC and configure the verified Play app-signing certificate digest. Configure `TRIALUM_INTEGRITY_CLOUD_PROJECT_NUMBER` in the Beta repository's Actions variables.
5. Run challenge, success, wrong package/version/certificate, replay, expired nonce, expiry, unbound/bound profile, account deletion, REST and WSS tests.
6. Only after those checks pass, switch the server eligibility gate and the needed social service switches to `true`. Then produce and owner-sign the v46 AAB and install it through the Play internal-testing link.

Sideloaded builds may fail `PLAY_RECOGNIZED`/`LICENSED`; end-to-end social testing must use the owner-signed v46 installed from Play internal testing. This patch does not deploy itself and does not publish anything to Play.
