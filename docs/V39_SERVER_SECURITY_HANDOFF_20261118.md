# Trialum v39 server security handoff

**Date:** 2026-11-18  
**For:** the Codex session maintaining the main `Trialum` repository  
**Status:** live Privacy Policy and User Agreement updated after root-only backup; no server runtime configuration or service was changed.

## Owner decisions to preserve

- Keep Friends, messaging, and push available. **Do not disable them globally.**
- Evaluate Play Age Signals separately on each client. The v39 Android app restores this gate and handles the returned age range/status locally. Do not send DOB, exact age, Google account details, install identifiers, or the raw signal to Trialum.
- Conversation history and pet AI memory stay on-device; optional user-controlled Google backup is separate from Trialum server storage.
- Coordinate any server behavior change with the matching app release, after owner testing.
- Do not modify firewall, Caddy, Webmin, Plex, Samba, router, or other host services.

## Verified live-server behavior

- Trialum API health reported version `1.5.6-beta1`; its host port is loopback-bound.
- The API receives message text as plaintext, encrypts it using a server-held key, then stores it in PostgreSQL. This is encryption at rest, **not end-to-end encryption**: the server handles plaintext and can decrypt stored rows.
- Message rows expire after 7 days. The API runs a periodic cleanup that deletes expired messages; a message can be removed sooner when both participants have deleted it.
- Message reports are cleaned after 30 days. On account deletion, the reporter reference cascades and the reported sender reference is set null; reports may remain until the 30-day cleanup.
- The server has no independent, verifiable Play Age Signals check. The Android client can gate features per player, but a modified client could call API routes directly. Do not claim backend age enforcement or trust a client boolean such as `isAdult`.
- Existing social, shared-playground, message, free-text, and push switches are global. Leave them unchanged; they are not per-client consent/age controls.

A root-only pre-change config archive and PostgreSQL dump were created on the server and checked. They contain private material and user data and must remain on the server; never copy them to GitHub, CI artifacts, logs, or chat. No host firewall or unrelated service was changed.

## Current decision: keep message storage, disclose it accurately

Server-side message storage is not inherently forbidden by a universal technical standard. It does create a meaningful confidentiality risk because the service processes plaintext. Keep the existing short-lived, encrypted-at-rest behavior for this beta rather than risking a breaking messaging rewrite. The policy now says that Trialum's server processes messages, that database encryption is not end-to-end encryption, and that message cards expire within 7 days while reports expire within 30 days. Players are told not to include real names, contact details, school, precise location, passwords, or other sensitive information.

This decision does **not** assert legal compliance or zero risk. Retention must remain limited, deletion and cleanup must continue to work, access to the server/database key must stay restricted, and the policy must match actual behavior. A future move to client-side E2E/online-only relay needs a separate compatible design, offline-delivery decision, migration, tests, and owner approval.

## Per-client age handling

- Preserve the v39 fail-closed app behavior for unavailable, unshared, verification-required, or ineligible age signals.
- Do not store DOB, exact age, account identity, install ID, or raw age signal; do not log them.
- Play Age Signals is an app-facing API; the server cannot independently verify a client's local result. Do not add a spoofable `ageApproved=true` API field.
- If backend age enforcement becomes a requirement, first design an app-bound, server-verifiable authorization flow and establish what age data may lawfully be sent. Play Integrity alone proves neither age nor parental consent.
- Keep all backend features available for clients that satisfy their own eligibility/consent state; do not turn off features globally.

References: [Play Age Signals request](https://developer.android.com/google/play/age-signals/request-age-signals) · [Age Signals responses](https://developer.android.com/google/play/age-signals/understand-age-signals-responses).

## Rollout / handoff to main repository

- Port the per-client v39 Age Signals behavior into the main app source without sending the signal to Trialum.
- Keep server feature flags and deployment topology as they are for this pass. Only update operational code if a demonstrated defect in retention/deletion or access controls is found.
- Updated `/var/www/trialum/privacy-policy.html` and `user-agreement.html` on 2026-11-18. The pages now disclose plaintext server processing, at-rest encryption (not E2E), 7-day message expiry, 30-day report cleanup, and v39 Age Signals behavior. A root-only backup exists outside the web root; checksums were recorded locally on the server.
- The public Privacy Policy and User Agreement routes returned the updated content. No Caddy change or service restart was needed.
- No database migration or server runtime change was necessary for this documentation-only pass.
- Before any future server code/config deployment: take a root-only backup, use a reversible Trialum-only change, verify API health/message expiry/per-client behavior, and preserve rollback. Never use `docker compose down -v` on the production data volume.

## Acceptance facts to carry forward

- App age handling is client-specific and fail-closed; the backend does not independently attest age.
- Message content is not zero-retention or E2E; it is encrypted at rest and expires within 7 days.
- Message reports expire after 30 days.
- Keep friends, messaging, and push enabled; do not disrupt other server services.
