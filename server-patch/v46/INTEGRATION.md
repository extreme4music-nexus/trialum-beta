# Apply the v46 eligibility patch to the private server

The main `Trialum` repository and server are kept separate from this public beta build repository. This checklist is written against the existing Node service layout (`server/src/index.mjs`, `social.mjs`, `shared.mjs`, `messaging.mjs`, `live.mjs`). Rebase these changes onto the current private server head; do not replace it with this staged snapshot.

## `index.mjs`

- Import `createSocialEligibilityService` and the server-only Google decoder.
- Construct the service using `socialPool`, `createGoogleIntegrityDecoder()` from `google-integrity-decoder.mjs`, package `com.trialum.ziivaiskra`, code `46`, the verified Play app-signing SHA-256 digest, and consent version `trialum-social-v46`.
- Add `SOCIAL_ELIGIBILITY_ENABLED` as a fail-closed gate. Before it is `true`, do not accept protected social requests from the v46 client.
- Pass the eligibility service to `socialRequest`, `sharedRequest`, `createMessaging` and `createLive`.
- Add a cleanup timer for expired rows.

## `social.mjs`

Before ordinary route dispatch:

- Keep `GET /v1/social/status` available as a health/config response.
- Implement `POST /v1/social/eligibility/challenge` with JSON body size/rate limits and `createChallenge`.
- Implement `POST /v1/social/eligibility/verify`: if a bearer credential identifies an existing installation, pass its ID to `verifyChallenge`; without one, create an unbound lease for a new registration/restore.
- Authenticate as usual for every other route. Except `DELETE /v1/social/account`, call `requireEligibility` after authentication.
- In `register`, use one database transaction to create the installation and bind the `X-Trialum-Eligibility` token to it before commit. In recovery restore, bind the new lease to the recovered installation in its transaction.
- Keep account deletion authenticated but exempt from lease and current-consent checks; delete its eligibility session rows in the same deletion transaction.
- Add `x-trialum-eligibility` to the CORS allow-header list.

## `shared.mjs` and `messaging.mjs`

After existing profile authentication in each request handler, call `requireEligibility(req, profile.id)` before reading or changing protected state. Leave unauthenticated health/status endpoints as they are. This covers shared-room membership, invitations, presence, visits, messages, reports and push registration.

## `live.mjs`

The v46 WSS `auth` frame contains both the existing profile credential and `eligibilityToken`. Authenticate the profile, validate the lease against that profile ID, then emit `ready`. Keep the authorized installation ID on the socket and reject subscription, presence, message and pet-speech frames when the lease expires. Legacy clients without the v46 lease must not gain access to the newly protected endpoints.

## Google token decoder

Use `createGoogleIntegrityDecoder()` in `google-integrity-decoder.mjs`, which uses the server's existing `google-auth-library` dependency and ADC identity with Google's `playintegrity` scope. Keep all credentials on the private server. Configure the digest to match the Play app-signing certificate in the decoded verdict (`certificateSha256Digest`, URL-safe Base64 without padding). If Play Console displays it as colon-separated SHA-256 hex, convert the bytes to Base64URL; do not use the owner's upload-key fingerprint unless it is confirmed to be the app-signing key.

## Transaction/deployment notes

`bindUnboundToken(req, installationId, transactionClient)` accepts the transaction query client so a registration or recovery operation cannot commit without its eligibility lease. Apply `007_v46_social_eligibility.sql` only after a restorable PostgreSQL backup. First deploy with the feature gate false, run private integration tests, then turn it on. The external social service switches remain separate; only turn on the features already intended for this test (social, shared, presence, messages). Leave push off unless its separate FCM setup is already tested.
