# GP-01 isolated test APK plan

This file describes the one-time installable APK for owner gameplay testing. It is not a Play candidate.

## Package separation
- Application ID: `com.trialum.ziivaiskra.gp01test`
- Version name: `1.0-gp01test`
- Version code: `38` (local test build only; not reserved for Play)
- The distinct app ID gives Android separate app data and prevents replacement of the Play installation and existing QA packages.

## Random test signing
GitHub Actions creates a fresh throwaway RSA signing key in the hosted runner and signs only the `.gp01test` APK. It uploads the signed APK, SHA-256, and public certificate fingerprints. The keystore and password are removed before the job ends; neither is committed or uploaded. This signature is not the owner's release or QA certificate, and this APK is not uploadable to Play.

## Social and Google service boundaries
GP-01 changes plant lifecycle and Classic PhytoLab code; it does not edit the Friends HTTPS client, message client, FCM implementation, AI, save/restore, or Play Games code. The Actions regression workflow runs their existing JavaScript regression tests alongside the GP-01 plant regression.

The isolated random-signed test package deliberately has Play Games disabled (project ID `0`) and FCM disabled (no Firebase Android app ID registered for this package). It is suitable for checking GP-01 gameplay without risking the installed app. Do not interpret the test APK as proof that live Friends, notifications, or Google Play Games authenticate correctly. Those integrations stay covered by source regression tests and must be checked later using an approved stable signer/package.

The HTTPS social API configuration is injected using the existing public build variable; no server credentials or private repository history enter the snapshot.

## Required test record
- GitHub Actions run #43989558036 passed plant engine regression, social UI/shared-client, messaging client cases, Play Games source tests, beta contract, Android compilation, package/resource checks and ephemeral signing on commit `9db6b97ca9bcf870132accc287f17249c270cc6c`. Final PR run #43990876099 and matching push run #43990866349 also passed at `891cd84dfc61c8937c4da5dc5dc25b2c5ac8a3c8`.
- The public snapshot intentionally excludes the private server, so server-side FCM delivery assertions were not run.
- APK: [Trialum-GP01-random-signed-test.apk](https://github.com/extreme4music-nexus/trialum-beta/actions/runs/43989558036), artifact expires 2026-11-24.
- SHA-256: `161989281bd0ec409c9e9833a92dbe8b3446980ded66318e1d629b24aa02e2a7`.
- Ephemeral certificate SHA-1: `bd972603b43779d8b718f68ca3742ea5ac8c881d`; SHA-256: `5c45636400ba9cabfadbd0aea9729dd296fda08379f7aa4a4e3e334a9361accd`.
- Owner device test: pending. Only the owner can provide OWNER PASS.
- No merge, Play upload, or rollout is authorized by this candidate.
