# Trialum 1.4 v44 — Server identity recovery security / Codex rollout handoff
**Status:** STAGED DEVELOPMENT, NOT DEPLOYED. Auth regression tests and real Android QA must pass before production enablement.  
**Date:** 2026-11-22  
**Branch:** `feature/v44-owner-hud-economy-guidance-20261122`  
**No main synchronization, server deployment, unsigned AAB/APK, or Play upload authorized by this document.**

## User-visible behavior: preserve social identity on reinstall
The existing server identity is `installations.id` (UUID). Friends, room membership, ownership, purchased shared equipment and shared credits are linked to that same row. Its 256-bit bearer token is encrypted by `SocialCredentialVault` in a no-backup Android Keystore-backed store. Uninstall clears that token, but does **not** automatically delete the account or server records. The local encrypted JSON archive contains the world, private pet memories and local friend conversations, **not** the social server credential.

The new **Social Account Recovery Kit** has a persistent profile ID + a separately generated 256-bit unguessable secret, formatted as 43 URL-safe characters. It is shown in a screenshot-protected native Android dialog on account creation. A user can enter their old ID+key on an eligible new device, save a **new recovery key before submitting**, and then reclaim the **same server ID**. The server atomically rotates both the bearer credential and recovery verifier, disconnects old WSS, and removes stale push registrations. Friends and room ownership remain attached to the old ID. No local world or AI memory is imported by server recovery; those come from the separate encrypted archive.

**Security language:** ID + recovery key is ONE high-entropy recovery credential, NOT independent two-factor authentication. A secure Android confirmation dialog is an extra user safety step, not server-verified MFA. Do not claim 2FA, passkeys, biometric verification or independently identity-verified recovery in the Play listing. True optional MFA/passkeys would require a separately audited FIDO2/Credential Manager backend integration; do NOT invent it, or use unverified SMS/email without privacy consent.

## Files staged in trialum-beta
- `server-patch/v44/src/social.mjs` — registration kit, account-restore and authenticated reissue endpoints
- `server-patch/v44/src/account-recovery.mjs` — 256-bit key generation, keyed HMAC verifier, atomic recovery and bearer rotation, generic invalid-account errors, limited failed attempts
- `server-patch/v44/src/live.mjs` — closes all old authenticated WebSocket sessions on recovery event
- `server-patch/v44/sql/008_social_account_recovery.sh` — idempotent verifier table and least-privilege DB grants
- `server-patch/v44/tests/account-recovery.integration.mjs` — disposable PostgreSQL-based account restoration, friend and group ownership, replay, deletion
- `js/social.js`, `js/app.js` — profile creation + restore, local consent and Age Signals gates, separate encrypted world backup
- `android-template/app/src/main/java/com/trialum/ziivaiskra/MainActivity.kt` — secure native dialog, 256-bit OS RNG, screenshot prevention and pre-commit confirmation
- `tests/v44-social-account-recovery.test.cjs` — native/JS integration contracts and safety rules
- `assets/privacy-policy-v44.html`, `assets/user-agreement-v44.html`, `js/longplay-ui.js` — data transparency and clear separation from local archive recovery

## API contract
**POST `/v1/social/register`** requires previous explicit social consent and local eligible Play age band in app, returns `{id,nickname,credential,recoveryKey,recoveryKitVersion:1}` only after server migration + HMAC pepper are configured. Raw key is returned *once* over HTTPS and never saved in server logs, tables, localStorage, player-world JSON, Cloud Save or URLs.

**GET `/v1/social/status`** advertises `accountRecoveryEnabled:true` and `recoveryVersion:1` only when the configured pepper and recovery table exist.

**POST `/v1/social/recovery/issue`** with valid bearer + `{confirm:true}` regenerates a lost kit for an existing logged-in profile. Previous kit is revoked. Requires user confirmation and screenshot-protected display. Old pre-v44 accounts need to perform this on an **existing active device** before uninstalling.

**POST `/v1/social/recovery/restore`** anonymous endpoint with `{id,recoveryKey,nextRecoveryKey}`. Strict UUID and 32-byte base64url key validation. Client shows the next key BEFORE POST and requires user acknowledgement. On success, server returns `{id,nickname,credential,recoveryKitRotated:true}`; same profile ID retained, stored kit and bearer rotated atomically. If HTTP response is lost *after* successful transaction, the user still has the new key and may try recovery again using it. Old token and old key no longer work. Server sends a session invalidation event and removes old push token.

The endpoint must NOT:
- return whether an unknown UUID exists;
- accept a nickname, pet identifier, JSON backup, share code, Google email, or room membership as proof;
- accept a client-requested price, credits, age band or authority claim;
- return any saved secret or credential hash;
- allow one-time recovery to regenerate old plaintext secrets;
- log request JSON bodies, Authorization bearer or recovery tokens.

## Server security controls
- Strong entropy: Node `crypto.randomBytes(32)`, Android `SecureRandom`, **not** `Math.random()`.
- Verification: HMAC-SHA256 with a **32-byte server-only pepper**, not a fast bare hash of low-entropy user-chosen passwords. Input is *always* a random high-entropy token (43-character base64url); no weak user passwords are accepted. Constant-time comparison of 32-byte digests.
- Server pepper env: `SOCIAL_RECOVERY_PEPPER_B64` must be generated outside source control with a cryptographic RNG (e.g. Node crypto randomBytes(32).toString('base64url')), installed in secret management and BACKED UP independently. Never commit, embed in APK, echo to logs or rotate it without a controlled migration: loss of the pepper invalidates all recovery kits.
- HTTPS-only production; strict fixed origin; disable HTTP redirections, request-body and Authorization logging; trusted edge/network rate limits and bot-abuse detection. Node in-memory per-IP/per-ID throttles and DB failed-attempt lockout are extra layers, **not** distributed multi-instance protection. Review reverse-proxy client-IP handling; never blindly trust a user-controlled forwarded IP.
- Single active bearer: recovery rotates the existing `installations.credential_hash`, so previous devices are signed out. Stale FCM push token removed. Authenticated WSS connections closed with `session_revoked`; other running devices must re-authenticate or switch account.
- Transaction row lock prevents parallel reclaim/replay. On deletion `social_account_recovery` cascades with `installations`, permanently disabling restoration. Never enable a deleted-user resurrection path.
- No raw IP, email, date of birth, identity document, advertising ID or real name is needed for recovering this pseudonymous profile. Anonymous recovery attempts may still be processed by edge security logs; disclose logging/retention as applicable.
- Because app only checks Age Signals locally today, **independent backend age/consent authorization still requires its own release security review**. Google Play Integrity alone does not prove age. Preserve fail-closed local gate for production.
- This is strong owner-controlled self-service account recovery, but cannot provide an absolute guarantee against device malware, stolen recovery kits, phishing, compromised server secrets or malicious modified clients.

## Mandatory rollout for Codex / server owner
1. Inspect ACTUAL current live server and PostgreSQL version; diff current `social.mjs`, `shared.mjs`, `live.mjs`, `index.mjs`, identity tables, message/presence/push service, reverse proxy and credential storage against staged files. Do not overwrite newer server work.
2. Backup the complete production database AND backup ability/plan for recovery pepper; verify restore on disposable instance.
3. Apply staged store migration `007_v44_shared_store.sh` if not already live, then `008_social_account_recovery.sh` with a privileged role on the correct DB; verify idempotence and least-privilege access. No volume deletion or destructive recreation.
4. Configure a cryptographically generated **32-byte** pepper via secure deployment secrets, e.g. `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))"` redirected into the operator's secret manager; never print a real secret into CI logs or docs.
5. Reconcile and deploy staged server sources with the actual live version via reviewed patch; verify status flag and database permissions before enabling new app registration.
6. Test registration with new kit, reissue from existing profile, recovery from new Android device, same social ID and friend/room ownership, exact shared credits, invalid or expired/locked attempts, concurrent and replay races, deletion, lost network response, legacy clients, old bearer revocation, old WSS closure and FCM token clearing. Simulate server restart; inspect logs for leaked secrets; test production rate limiter at edge.
7. Test both a **local world encrypted-archive restore** and a **server identity restore** independently and together. Never merge server friendships or credits from JSON; do not overwrite personal local worlds during social restore.
8. Validate privacy policy deployed URL, in-app agreement, Google Play Data Safety account/credential declaration and a working **out-of-app account deletion** process, per current Play User Data and account deletion rules.
9. Obtain independent security review before broad distribution. Report PASS/FAIL/NOT TESTED for every gate. Owner explicitly approves `main` sync and release builds only after live server and device QA.

## Expected real-device acceptance
- Original install: create profile; secure dialog displays ID + one-time key, no screenshot allowed; mark saved; create friend, shared room, earn shared credits, buy toy.
- Reinstall/new device: restore encrypted world archive separately; opt in to social again, pass official Play Age Signals gate; choose `Restore existing social profile`, enter ID + previous recovery key, save NEW key when prompted; confirm.
- Old profile ID, nickname, friends, owned shared room, exact room credits and purchased apparatus reappear from server; private local pet memories come from encrypted archive only.
- Old client bearer fails; old WebSocket terminates; push token on old device removed; old recovery key fails; new key works again if needed.
- Nonexistent/deleted profile or incorrect key returns generic error, does not disclose profile existence and does not change server ownership.

**Irrecoverable historical limitation:** If a profile was created BEFORE recovery feature rollout and was already uninstalled with its unique bearer token lost, the service cannot securely prove ownership. DO NOT invent a reset based on ID, nickname, saved world, pet name or friendship. A legacy account with its existing token still valid can generate a kit via `recovery/issue`.

## Play / policy and external references
- Google Play User Data policy: https://support.google.com/googleplay/android-developer/answer/10144311
- Google Play account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- OWASP forgot-password recovery: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- Android passkeys / Restore Credentials, potential future audited second factor:
  https://developer.android.com/identity/sign-in/restore-credentials

**RELEASE HOLD:** No real-world deployment or promotion, no automatic merge, no production-side bypass of age restrictions. Independent Play compliance/legal/security review cannot be replaced by automated tests; no implementation makes a lawsuit or Play rejection impossible.
