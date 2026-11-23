# Trialum v44 — Android Social Attestation: Play Internal Testing handoff

**Source of truth:** `fix/v44-android-social-attestation-20261123` in `extreme4music-nexus/trialum-beta`.

**Scope:** Android/WebView client only. **Do not deploy server patches, rerun DB migration 009, delete profiles, change any user saves or alter the existing v43 Play Console listing in this workstream.**

## Current gates

- The client implements local, fail-closed Google Play Age Signals and explicit versioned consent. Play Integrity Standard `requestHash` is the base64url-without-padding SHA-256 of four UTF-8 lines (no trailing newline): `trialum-social-integrity-v1\n{action}\n{consentVersion}\n{subject}`. Actions: `register` / `renew`.
- No age band, exact age, birthdate, Google account/email, device ID, or Age Signals response goes to the Trialum server. It receives a short-lived Integrity token and only request-bound consent/action fields.
- Registration displays the one-time recovery kit using native protected UI, never in world JSON. Ambiguous network outcomes persist a local no-automatic-retry warning; a user must review explicitly before attempting another registration.
- Existing and restored profile credentials are preserved. Social clients do not start before eligible status / renewal succeeds. Expired eligibility results in recoverable retry, not profile deletion.
- Consent withdrawal stops REST/WSS clients before attempting `POST /v1/social/eligibility/revoke`; failed revokes leave a local retry marker. WSS 1008 revoke/attestation statuses stop reconnect loops.
- Profile recovery and `DELETE /v1/social/account` remain usable without an active social eligibility attestation, and local worlds/pets/memory are untouched.
- App `versionCode=44`, `versionName=1.4 v44`; production app ID `com.trialum.ziivaiskra`. Debug/QA suffixed apps cannot obtain production social attestation.

## First, finish Android candidate configuration

**GitHub repository Actions variable missing as of the first candidate build:** `TRIALUM_PLAY_INTEGRITY_PROJECT_NUMBER`.

1. In Google Play Console, find the Google Cloud **project number** linked to the app's Play Integrity API. This is a public numeric project identifier, **NOT** a service-account key, OAuth secret, Firebase API key or arbitrary project ID.
2. In GitHub repo Settings -> Secrets and variables -> Actions -> **Variables**, add `TRIALUM_PLAY_INTEGRITY_PROJECT_NUMBER` with that exact number. Do not guess from Firebase/PGS sender IDs without verifying the Play Integrity-linked project.
3. Existing release client variables `TRIALUM_SOCIAL_API_URL`, `TRIALUM_FIREBASE_API_KEY`, `TRIALUM_FIREBASE_APP_ID`, `TRIALUM_FIREBASE_PROJECT_ID` and `TRIALUM_FIREBASE_SENDER_ID` are consumed by the candidate workflow. **Do not put server service-account credentials or the Android upload keystore in the repo.**
4. On **Actions -> V44 Play-internal unsigned AAB candidate -> Run workflow**, select branch `fix/v44-android-social-attestation-20261123`. Its configuration gate refuses missing/zero Integrity project numbers and invalid HTTPS/Firebase fields.
5. Obtain the artifact `trialum-v44-play-internal-unsigned-aab-and-mapping` from the successful workflow run. It contains an **unsigned** v44 internalBeta AAB, R8 mapping if produced, a checksum and build metadata. This is **not yet uploadable**.

## Sign and deliver through Play Internal Testing

1. On the owner's trusted local machine, **sign the v44 AAB using the existing Google Play upload keystore** used for v43. Android Studio -> Build -> Generate Signed Bundle / APK is an acceptable path using the existing upload key. Never generate a random replacement release signing identity or expose private key material in GitHub.
2. Check package `com.trialum.ziivaiskra`, `versionCode=44`, `versionName=1.4 v44`, correct SHA-256 and the expected Play Integrity Cloud project. Use the signed, verified bundle.
3. In Google Play Console -> Testing -> Internal testing, create a v44 test release, upload the signed AAB and activate only the internal testers. Do not push to public Production.
4. On a Play-enrolled physical device, **update existing v43 via Google Play**. Confirm v44 is running and the local world, pets and memories are intact. A sideloaded `.qa44` or random-signed APK cannot validate `PLAY_RECOGNIZED`/`LICENSED` and is not a substitute.

## Coordinated live server test (other Codex session owns backend)

- Before Play-installed app test: `TRIALUM_SOCIAL_ATTESTATION_REQUIRED=false` is the compatibility switch, not the availability of token verification. Keep all v43 users and existing profiles alive.
- Check that the server has working Play Integrity token decoding and `GET /v1/social/status` advertises `socialAttestationReady=true` and the current version `trialum-social-v1`.
- On a Play-installed v44: test adult/eligible local Age Signals -> consent -> new registration + one-time recovery kit; old bearer -> `GET /eligibility/status` -> fresh `renew`; aged-out status -> reattest; consent withdrawal -> server revoke/WSS 1008; explicit recovery with ID and key; account deletion separately.
- Test negative conditions (unknown/underage/supervised/declined Age Signals, invalid/replayed Integrity token, 428, 403, 503, expired verification, 401) and confirm the offline world works. Never transmit raw Age Signals to Trialum.
- **Only after the above live flow works**, coordinate a controlled enable of `TRIALUM_SOCIAL_ATTESTATION_REQUIRED=true` with the backend session; verify strict enforcement on social endpoints and recovery/revoke behavior. If needed, immediately roll back to `false` without touching the DB or deleting user data.

## Verification sources

- `.github/workflows/v44-social-attestation-app.yml` — JavaScript tests, age/recovery regression and Kotlin compilation.
- `tests/v44-social-attestation.test.cjs` — mocked action-bound registration, renewal, consent, revoke, 428, 503, deletion and WSS checks.
- `.github/workflows/v44-social-attestation-bundle-smoke.yml` — R8-minified build **without production values**; it does not upload a Play candidate.
- `.github/workflows/v44-social-attestation-internal-aab.yml` — guarded unsigned internalBeta bundle requiring the real Play Integrity project number.

## Release sign-off still required

- A successful **configuration-valid** candidate AAB build and owner signature.
- Installation/updating from Google Play Internal Testing, not sideload.
- Physical Age Signals + Play Integrity end-to-end verification with the real backend.
- Publicly hosted Privacy Policy and Google Play Data Safety responses reviewed and updated for the new Play Integrity token forwarding / versioned social consent.
- Owner and server-session approval for enabling mandatory enforcement.

**Do not call this publicly released or production-enforced until the above sign-offs are actually evidenced.**
