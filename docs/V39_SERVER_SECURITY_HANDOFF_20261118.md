# Trialum v39 server security handoff

**Date:** 2026-11-18  
**For:** the Codex session maintaining the main `Trialum` repository  
**Status:** implementation handoff only; no server code/config has been deployed.

## Owner decisions to preserve

- Keep Friends, messaging, and push available. **Do not disable them globally.**
- Age verification must be evaluated for each individual client. The v39 Android source restores the Play Age Signals gate and records only privacy-limited diagnostics locally.
- Do not send date of birth, exact age, Google account details, or Play install identifiers to the Trialum server.
- Conversation history and pet AI memory belong on the user's device. Optional long-term transfer/sync is user-controlled through Google services, not Trialum storage.
- Activate server changes only after the owner tests the candidate app and the app/server release is coordinated.

## Findings from the live Trialum server inspection

- The API is healthy and its host mapping is loopback-only.
- The server source has no Play Age Signals or age-eligibility check on social/message requests. A client-only gate can be bypassed by a modified client, so do not describe the backend as enforcing age eligibility.
- The message endpoint receives plaintext text, encrypts it with a server-held key, and stores message cards in PostgreSQL. This is encryption at rest, **not end-to-end encryption or zero-retention**: the API sees plaintext before storing it and can decrypt the stored content.
- Existing feature switches are global. They are not a per-client age or consent control. Leave them unchanged while implementing the per-client design; a global off switch would break all players.

A root-only pre-change config archive and PostgreSQL dump were created on the server and their archive formats/checksums were verified. They contain private material and user data and must stay on the server; do not copy them into GitHub, CI artifacts, logs, or chat. No firewall, Caddy, Webmin, Plex, or other host services were changed.

## Required implementation in main `Trialum`

### 1. Per-client age enforcement

- Preserve the v39 app's fail-closed behavior for `NOT_SHARED`, `VERIFICATION_REQUIRED`, ineligible age bands, and API errors.
- Do not add a server API that trusts a client-supplied `isAdult` / `ageApproved` boolean.
- The Play Age Signals API is client-side and its result is for the requesting app. Review Google's current rules before transmitting any signal to a backend.
- If server-side enforcement is required, design a verifiable app/request attestation flow and bind it to the specific social action. Play Integrity may help establish app/device integrity, but must not be treated by itself as proof of age. If the age result cannot be securely verified server-side without sending restricted age data, document the limit and keep the age decision in the app; do not falsely claim backend age enforcement.
- Store no DOB, exact age, Google account identifier, or install ID. Do not log age signal values.

References: [Request age signals](https://developer.android.com/google/play/age-signals/request-age-signals) · [Understand age signals responses](https://developer.android.com/google/play/age-signals/understand-age-signals-responses).

### 2. Message confidentiality and retention

- Replace server-visible message text with client-side end-to-end encryption before the request reaches Trialum.
- For the owner's no-server-retention requirement, use an online-only relay over the existing authenticated transport: route opaque ciphertext in memory and do not persist message payloads in PostgreSQL, files, analytics, or logs. If the recipient is offline, report that delivery did not occur; do not silently queue content server-side.
- Keep history only on each device. Add optional export/restore through the user's chosen Google storage flow; do not mirror local conversation or AI memory to Trialum.
- Push may carry only generic, content-free event references and must follow each client's opt-in. Never include message text or pet/AI content.
- Keep abuse/reporting and account-deletion behavior compatible with this design. Reports must not silently upload message text.

### 3. Migration and rollout

- Implement source changes and tests in the main repository first; keep this public beta repo as the owner-approved Android snapshot plus this handoff. Keep the Android build-center repo limited to its documented Android-only purpose.
- Write an explicit migration for legacy stored message cards. Do not purge existing rows as part of an unreviewed deploy; use the existing backup and obtain owner approval for any irreversible deletion.
- Add a staging/rollback runbook. Never run `docker compose down -v` on the live data volume.
- Keep the live server unchanged until the owner has installed/tested the matching v39 app. Then deploy only the Trialum API/DB changes, verify health and private routing, and retain a tested rollback path.

## Acceptance criteria for the main-repo PR

- Tests cover each age status independently and prove an unknown/error state cannot enable Friends.
- Direct API calls cannot bypass whatever per-client gate the approved design claims to enforce.
- A test message is absent from database rows, files, logs, and push payloads after delivery; only the two clients retain message history.
- Offline delivery behavior is explicit and does not create hidden server retention.
- Backup and restore are rehearsed in staging, migrations are reversible or have a documented restore path, and no other host services are touched.
