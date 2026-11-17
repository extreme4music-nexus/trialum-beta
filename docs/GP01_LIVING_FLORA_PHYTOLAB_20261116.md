# GP-01 — Living Flora + PhytoLab (Classic)

Status: isolated development candidate. This is not a Play release and has not received owner QA in the beta snapshot.

## Exact provenance
- Beta base branch: release/lw-c-1.6-LW-dev.12, base SHA 9d2511fd4e82e9404b217ff04ca580f45ae1667c.
- Source: Trialum LW-D L3.9 original-game implementation at 7466c38c0f863cf4299fbdf6263f823c60b2608d, PR #73 (still Draft in the source repo).
- Original-source acceptance record: owner PASS and Actions #171 are recorded for that source SHA. This does not transfer as a PASS for this beta port.

## Integrated existing behavior
The package ports the canonical plant lifecycle and original Classic PhytoLab view: researched model → produced seedling → greenhouse bed/aquarium → care and growth → transplant to compatible habitat, plus existing additive recipes. It uses the original engine state and resource pools and preserves plant IDs when migrating old worlds. Dead plants no longer provide live-plant oxygen/nutrient effects, lifecycle growth is not double-counted, and newly built habitats do not receive a free mature starter when the lifecycle schema is active. The original Classic Plants view remains the fallback if the optional module is absent.

Touched gameplay files: js/plant-lifecycle.js, js/plant-lifecycle-ui.js, js/engine.js, js/app.js, js/longplay-ui.js, index.html and sw.js. Beta-only build/test additions are isolated to android-template/app/build.gradle.kts, .github/workflows/lw-c-beta.yml, tests/beta-contract.test.cjs, tests/messages-client.test.cjs invocation and tests/lw-d-l3-9-original-plant-engine.test.cjs.

## Boundaries and QA
- No LW-D files, 3D prototype, Play Games credentials, signing, package identity, or server code are copied or changed.
- Existing social/FCM, AI, Play Games, backups, and release configuration remain from the beta base and must be exercised in the future owner+assistant test session.
- GitHub Actions #43989558036 passed on staging source SHA 9db6b97ca9bcf870132accc287f17249c270cc6c: selected social and message client regressions, PGS, GP-01 plant engine, beta contract, Android build, package identity/resource checks and random test signing.
- The CI build uses package com.trialum.ziivaiskra.gp01test, versionName 1.0-gp01test and versionCode 38 only for side-by-side owner testing; this is not a Play versionCode reservation.
- The APK is signed with an ephemeral runner-only key. The key and password were removed; the artifact contains no signing key.
- Official-signature candidate, device QA, backup/restore round trip on a copied world and OWNER PASS remain pending. Only the owner can record OWNER PASS for this beta build.

## Known risk to inspect during QA
Legacy saves with existing flora receive the one-time lifecycle migration/grace behavior in the exact source code. Include a copied/test world with old habitat flora and a newly built habitat; confirm backup/restore round trip and no lost pet/social state before proposing Play upload.
