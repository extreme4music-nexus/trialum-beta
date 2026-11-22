# Trialum 1.4 v44 — Owner QA2: Mini conversation, locale, independent animation

Date: 2026-11-22
Branch: `feature/v44-owner-hud-economy-guidance-20261122`
Source build commit: `9f625d328fcb75714a47754c1d7c4b7bf6f97687`
One-time GitHub run: https://github.com/extreme4music-nexus/trialum-beta/actions/runs/45063802908 (**PASS**)
Artifact: https://github.com/extreme4music-nexus/trialum-beta/actions/runs/45063802908/artifacts/14770806965
Package: `com.trialum.ziivaiskra.qa44social2` (separate isolated Android application)
APK: `Trialum-1.4-v44-OWNER-ROOM-AI-QA2-random-signed.apk`
SHA-256: `bce2a2d25a08f8beff3715a05335a011c6b6cc20236731fadfbec3ec7a54345f`
APK bytes: 12,703,220. Built with disposable per-run Android debug signing; Android signature verified in CI and ZIP checksum matched after download.

## Device-reproduced owner defects
1. Optional on-device AI shared playground panel mixed English with untranslated Macedonian, even when UI was English.
2. Two user accounts with Android + Samsung Secure Folder, backed up from the same original world: both pets visible in same private room and LLMs enabled, yet true local LLM reply counter stays zero.
3. Animated pets appeared to move in unison instead of individually selecting/using playground apparatus.

## Implemented root-cause fixes
- **Native Mini silent rejection:** `MainActivity.askPlaygroundAi` silently rejected JSON contexts longer than 700 characters, while JS deliberately produced up to 1,450 chars. It now accepts the exact public-scope bound (1,450) and signals an explicit error to `TrialumLLMEvent` for invalid requests via `ModelRuntime.rejectPlaygroundRequest`, preventing an unresponsive 90-second JS pending queue.
- **Room WebSocket gating:** `TrialumShared.getState` exposes true authenticated/subscribed `speechReady`. Foreground Mini inference waits for an active subscribed WebSocket instead of wasting a local generation that cannot be relayed. UI diagnostics explain when room presence, AI relay, socket or model are unavailable. Error responses are no longer hidden.
- **Translation fallback:** `js/playground-ai.js` has complete English/Macedonian AI panel paragraphs and button labels with `data-no-translate` to prevent word-by-word translated fragments. Real shared model conversations remain canonical English, but a missing optional server translation no longer discards that English turn. Local echoes display safely while translated echo is pending.
- **Scripted room conversation correctness:** `js/shared-scene.js` contains paired EN/MK scripts; the UI shows the appropriate locale and any scripted outgoing message uses the canonical English text, not Macedonian marked `en`. Two present pets waiting for Mini output no longer get the misleading “need two friends” caption.
- **Independent pet animation:** previous code re-created the action `start:t-1.5` every frame, keeping all pets in a fixed synchronized phase. Each pet now receives a deterministic owner/session-scoped motion identity, its own action-cycle duration, offset, apparatus choice, trajectory, pace, and rest windows. Two accounts that restored the same pet ID no longer necessarily share visual motion. No server reward/activity protocol changed.
- **PWA update hygiene:** service-worker cache bumped to `trialum-1.4-v44-offline-room-ai-20261122e` after QA build, to prevent stale JS in the future Play update. This is a cache identifier only; it does not alter gameplay.
- **Dedicated regression:** `tests/v44-phone-ai-animation-locale.test.cjs` reproduces >700-char native bridge, real Mini dispatch, UI locale, untranslated canonical turn fallback, independently moving duplicate-ID creatures. Existing `tests/playground-ai.test.cjs` now explicitly models authenticated WebSocket readiness.
- **Native compilation/QA:** targeted Kotlin compile and integrated Node tests passed; one-time QA2 workflow was fully successful, including APK signature, 96-entry offline license inventory, v44 footer and packaged JS presence checks.

## Isolation and safety
- The temporary mock of Google Play adult eligibility lived **only inside the ephemeral GitHub runner checkout** for the owner-only sideloaded QA APK. The one-time workflow file was **deleted after successful artifact creation**. Production `MainActivity.kt` still delegates `ageSignalsAdultEligible()` to `ageSignals.isAdultEligible()`; QA bridge remains hardcoded false. No permanent age-check bypass is retained.
- The APK includes configured HTTPS social server location but does not prove server authorization. Do not distribute this QA binary, use its identity for Google Play, or infer compliance from successful social traffic.
- Side-loaded `.qa44social2` has fresh app-private storage and may need separate world restore, social login, and optional local Mini model download.
- **One physical Samsung device with its normal profile and Secure Folder does not keep two independent Android apps foreground simultaneously.** Given the owner-approved STOP-AI-ON-HIDE policy, the background client cannot keep generating live LLM responses. This QA can verify presence and foreground-originated replies, but two-way concurrently active model-to-model conversations require two active devices. Do not silently re-enable background inference to fake a pass.
- Live real Mini dialog between two physical Android devices, server receipts, server-independent age authorization and Play-distributed Age Signals still require owner QA before release.

## Release-order invariant
The owner has not authorized main sync, unsigned release AAB/APK generation, local release signing, or Play Console upload. After owner QA approval, compare against the latest main head, perform an explicit reviewed sync/merge, resolve conflicts, rerun final targeted integration and build gates, then prepare **unsigned** AAB/APK for owner-local signing. Do not sign release with temporary QA keys.

This report supplements `docs/V44-OWNER-IMPLEMENTATION-REPORT.md` and `docs/V44-CODEX-PLAY-STORE-HANDOFF-20261122.md`.
