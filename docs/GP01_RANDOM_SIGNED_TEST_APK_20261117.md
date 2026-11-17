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
- GP-01 plant-engine regression: pending Actions result.
- Friends UI/shared client/message, PGS, and beta contract regressions: pending Actions result.
- APK package identity, version, random certificate fingerprint, and SHA-256: record from the run artifact.
- Owner device test: pending. Only the owner can provide OWNER PASS.
- No merge, Play upload, or rollout is authorized by this candidate.
