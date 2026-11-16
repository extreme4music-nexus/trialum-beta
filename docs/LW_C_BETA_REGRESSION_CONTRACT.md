# LW-C Beta 1.0 — Feature and Regression Contract

**Purpose:** keep the owner-approved LW-C feature set intact while preparing Trialum - Living World Beta 1.0. This file is the beta snapshot's durable feature ledger and release checklist. Update it in the same change as any intentional feature or behavior change.

## Source and release boundary

- Private source of truth: `extreme4music-nexus/Trialum`, LW-C branch `feature/lw-c-contextual-turntaking-session-20261113`.
- Snapshot source commit recorded for this beta: `04457df48b9c012f8667504b935a7ca501d13f07`.
- Public beta candidate: `extreme4music-nexus/trialum-beta`, Draft PR #2, branch `release/lw-c-1.6-LW-dev.12`.
- Product identity: **Trialum**, first edition **Living World**, Beta `1.0`. Owner uploaded versionCode `37`; proposed next internal-test candidate is versionCode `38`.
- Android package IDs remain `com.trialum.ziivaiskra`, `com.trialum.ziivaiskra.signqa`, and `com.trialum.ziivaiskra.signdebug`.
- LW-D is a separate development track. No LW-D source or commits belong in this beta snapshot.
- GitHub Actions builds APK candidates. The official package remains unsigned in CI and uses the owner's local Release signer. The isolated one-time `.pgstest` diagnosis package may use a runner-ephemeral signer with its own PGS OAuth credential. The owner's persistent signing keys remain local. Do not publish an app release to Play or mark owner QA passed without device testing.

## Features that must not disappear

| Area | Beta contract | Key source and regression coverage |
|---|---|---|
| Core Living World | Existing game state, pets, progression, research, habitats, flora, care, backup/restore and journal stay in the LW-C snapshot. | `js/engine.js`, `js/world.js`, `js/progression.js`, `js/storage.js`, `tests/engine.test.cjs`, `tests/progression.test.cjs`, `tests/version155.test.cjs` |
| Friends | Opt-in account; HTTPS-only social API; consented, one-use invitations; accept/remove/block; no Trialum-server Google password or Google profile sign-in. | `js/social.js`, native `SocialCredentialVault.kt`, `tests/social-ui.test.cjs`, `tests/shared-client.test.cjs` |
| Messages and push | Private, bounded message cards between confirmed friends; no public chat or message text in game backups; push off until player consent; opting out leaves the in-game inbox available. | `js/messages.js`, `TrialumPush.kt`, `TrialumFirebaseService.kt`, `tests/messages-client.test.cjs` |
| Shared playground and presence | Existing friend-gated shared-room, visit, presence and reconnect logic stays present. Do not claim guaranteed message delivery or a single WSS responder without protocol evidence. | `js/shared-playground.js`, `js/presence.js`, `tests/presence.test.cjs`, `tests/playground.test.cjs` |
| Pet conversations | Bounded 36-reply session memory, reply-to links, speaker selection for 2/3/4+ pets, retained unconfirmed statements, short contextual AI replies, no random topic jumps, isolated local memory and per-pet opt-in. | `js/playground-dialogue-session.js`, `js/playground-memory.js`, `tests/dialogue-session.test.cjs`, `tests/playground-memory.test.cjs`, `tests/dialogue-mix.test.cjs` |
| Google Play Games | Optional profile, achievements, leaderboards and opt-in Saved Games. PGS project published 2026-11-15; owner confirms profile sign-in, but achievement recording is not yet confirmed. Keep package/signing OAuth registrations and service IDs intact. | `js/play-games.js`, `TrialumPlayGames.kt`, `tests/play-games.test.cjs`, `tests/version155.test.cjs` |
| Player information | The in-game About & Help includes game/developer information, offline/save guidance, Friends/Google/FCM guidance, FAQ and replayable tutorial instructions. Purchases remain off in Beta 1.0. | `js/longplay-ui.js`, `js/onboarding.js`, English locale audit in `tests/ui.test.cjs` |
| English interface | Every user-visible string shown in English must be idiomatic, complete, and punctuation-checked. Changes to Macedonian UI copy require a same-change English translation and baseline update. | `locales/en.json`, `tests/forward-only-baseline.json`, `tests/accepted-english-complete-baseline-20261111.json`, `tests/english-sync-guard.cjs` |

## Public build configuration

The beta Actions workflow must inject the same non-secret client configuration used by the private LW-C build. Empty settings deliberately produce an offline-only social build and are therefore a build failure for this beta candidate.

In [trialum-beta Actions variables](https://github.com/extreme4music-nexus/trialum-beta/settings/variables/actions), preserve these names and values from the private Trialum repository:

- `TRIALUM_SOCIAL_API_URL`
- `TRIALUM_FIREBASE_API_KEY`
- `TRIALUM_FIREBASE_APP_ID`
- `TRIALUM_FIREBASE_APP_ID_SIGNQA`
- `TRIALUM_FIREBASE_APP_ID_SIGNDEBUG`
- `TRIALUM_FIREBASE_PROJECT_ID`
- `TRIALUM_FIREBASE_SENDER_ID`

The HTTPS endpoint currently configured is `https://dedopero.servegame.com`; its public `/healthz` endpoint returned HTTP 200 with `status: ok` and `db: connected` on 2026-11-15. This is an availability check only, not an end-to-end Friends or FCM acceptance.

Firebase Android app IDs and API key are client configuration embedded in the APK. They are not server credentials. Never add the FCM service-account JSON, server data-encryption keys, bearer tokens, database passwords, keystores, signing passwords, or private deployment configuration to this public repository or workflow. Those remain on the private server or owner's device. Android builds must embed distinct Firebase app IDs for the three package IDs. FCM registration remains disabled until explicit opt-in.

The workflow validates that each unsigned APK embeds the HTTPS host and its matching Firebase app ID. This prevents a green build from silently producing a Friends/FCM-disabled candidate.

## CI gates

The `Trialum LW-C beta build` workflow runs the game, social, messaging, PGS, English UI, pet-memory and package/version checks. `tests/beta-contract.test.cjs` specifically fails if:

1. A required Actions variable is removed or stops reaching Gradle.
2. A package loses the HTTPS Friends host or package-specific Firebase app ID.
3. Friends, messages, opt-in FCM, shared rooms, presence, or required local source modules disappear from the clean export.
4. About, developer details, FAQ, tutorial instructions or their English translations disappear.
5. The public build workflow starts receiving server credentials or signing materials.

CI PASS proves the tested source and build contract only. It does not prove real-device FCM delivery, two-player server interactions, Play Games on every package/signer, or owner acceptance.

## Device acceptance still required

| Check | Status |
|---|---|
| Core LW-C features, data preservation and restore on owner's phone | Owner test required |
| Friends opt-in, HTTPS account, invite/accept/remove/block between two separate package identities | Owner test required |
| Private message inbox, mute/block and deletion behavior | Owner test required |
| FCM opt-in, permission denial, foreground/background receipt, token rotation and opt-out | Owner test required; server health does not prove delivery |
| Google Play Games profile, achievement recording, leaderboard and optional Cloud Save | Profile sign-in confirmed; achievement API acknowledgement and owner retest required on the exact signed candidate |
| About/FAQ/Tutorial on device in English and Macedonian | Owner review required |
| Existing save remains intact across installation/update in Secure Folder | Owner test required |

Do not label this candidate “ready for beta testing” until the new CI run passes, its artifact is signed with the correct owner key, the package/version/certificate are confirmed, and these owner-device checks are either completed or explicitly listed as accepted limitations by the owner.

## Change procedure

1. Work only on the beta candidate branch or a branch based on it; never commit beta fixes to LW-D.
2. State the affected feature and this contract row in every bug-fix PR description.
3. Add a regression test for the reported bug and run the relevant existing gate once. Do not remove a feature to make a failing test pass.
4. Keep translation, documentation, and tests in the same reviewed change as their UI/code edit.
5. Compare the final source SHA, package IDs, versionCode, HTTPS/Firebase resources and signing certificate with this ledger before handing an APK to the owner.
6. Preserve player data and signer identity. Never require uninstalling an existing install as a workaround.
7. Keep PRs Draft until the owner accepts the candidate. No Play Games project publication, Play Store upload, or public release is implied.
