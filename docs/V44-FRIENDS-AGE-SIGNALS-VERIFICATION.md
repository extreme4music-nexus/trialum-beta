# Trialum v44 Friends / Google Play Age Signals — client complete, backend gate unresolved

**Date:** 2026-11-22
**Branch:** `feature/v44-owner-hud-economy-guidance-20261122`
**Do not publish / merge release until backend age/privacy security check and physical Play install QA.**

## Owner product rule
- Social Friends, messaging, shared playground, public pet speech and invitation endpoints are **not beta-tester-only**.
- A player with an eligible **Google Play shared age band 18+** and separate voluntary social consent may create and use a social profile, even when `BETA_TESTER_TOOLS=false`.
- Child-managed/supervised (`TIER_B`), under-18, declined, unknown, sharing unavailable, API failure and `VERIFICATION_REQUIRED` remain offline.
- `TIER_A` is included only for an age band 18+; Google says this may be a *self-reported* age, so the app must not claim independent document-based verification. `TIER_C` and `TIER_D` are stronger assessment/ID tiers in regulated regions.
- No internal QA bypass can authorize a production social client, including legacy isolated `.qa39social` variants.

## Changes implemented in this client repository
1. Google Play Age Signals dependency updated to **0.0.6** (`android-template/app/build.gradle.kts`), per the official 2026-11-19 Android guidance.
2. `MainActivity.kt` allows user-requested Age Signals checks in all app variants, not just internal beta. `ageSignalsAdultEligible` no longer depends on `BETA_TESTER_TOOLS`. Legacy QA bypass bridge now permanently returns false.
3. `TrialumAgeSignals.kt` checks shared 18+ source `TIER_A`, `TIER_C`, or `TIER_D`, with `ageLower >= 18 && ageUpper == null`. Supervised and unknown signals rejected. Age range is kept on-device; only an eligibility boolean is sent to the WebView.
4. `js/social.js` requires current native eligibility AND voluntary social consent for all network and identity interactions; client callback statuses cannot grant age without native confirmation. Disabling consent revokes JS social access and deactivates network clients.
5. `js/shared-playground.js` and `js/messages.js` no longer require beta tester flag, but still require authenticated active social profiles; no public chats or shared rooms before that.
6. `tests/v44-friends-age-signals.test.cjs`, existing `social-ui` and relevant `messages-client` tests cover adult/no-beta path, unknown/declined/bypass, consent and credential gating.
7. UI and offline guide distinguish Google-shared age *range* from independent proof of identity.

## External Google documentation verified 2026-11-22
- https://developer.android.com/google/play/age-signals/use-age-signals-api
- https://developer.android.com/google/play/age-signals/request-age-signals
- https://developer.android.com/google/play/age-signals/understand-age-signals-responses
- https://developer.android.com/google/play/age-signals/test-age-signals-api
- https://developer.android.com/google/play/integrity/overview

## Critical unresolved server-side verification
The `trialum-beta` branch has social client and Android code, **not** the production Friends/WSS backend source. Consequently this task **cannot assert** server-side age enforcement is proven or deploy a server fix.

Before enabling Friends for general players, the backend owner must independently review:
- Authenticated social profile creation, session refresh, messages, invite acceptance, media, room join, pet presence and WSS publication all require an authorized eligible session, not just a forgeable client-side `adultEligible=true`.
- Play Integrity / app attestation to resist modified APKs and signal spoofing; **Play Integrity alone does not certify the user's age**. A server authorization architecture must be designed and verified under Google's Age Signals use/handling policy rather than assuming any client boolean is proof.
- Server revalidation/expiry/revocation of social access, protection from replay/credential reuse and consent withdrawal, rate limits/abuse and reporting.
- No raw Google birthdate, full age-band data, account email, age-range source or unnecessary identifiers are uploaded to Trialum. Apply minimal-data design and review current Google terms.
- Explicit user/owner approval for production server changes and internal Play track distribution.

## Device QA required (not covered by Node/Kotlin compile)
1. Install through a supported Google Play track for the **same registered package and signing identity**. A side-loaded random-signed `.qa44` APK is useful for visual/gameplay testing, **not** proof that Play Age Signals will work.
2. With explicit social consent, test shared 18+ `TIER_A` in ordinary opt-in regions, stronger `TIER_C/D` where applicable, supervised `TIER_B`, under-18, unknown/declined and no-network.
3. Observe profile creation, invitations, Friends, private messages and shared playground connection, and capture server logs/network trace without sensitive age or private pet memory data.
4. Verify revocation and app relaunch recheck; test app tampering and forged client callbacks.
5. Do not ship a beta that reports this server-backed gate as approved until those outcomes are documented.

**Status:** Client gate code and targeted tests implemented. Real device signal, production backend authorization and live WSS remain release blockers.
