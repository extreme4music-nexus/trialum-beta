# GP-01 — Living Flora + PhytoLab (Classic)

Status: isolated development candidate. This is not a Play release and has not received owner QA in the beta snapshot.

## Exact provenance
- Beta base branch: release/lw-c-1.6-LW-dev.12, base SHA 9d2511fd4e82e9404b217ff04ca580f45ae1667c.
- Source: Trialum LW-D L3.9 original-game implementation at 7466c38c0f863cf4299fbdf6263f823c60b2608d, PR #73 (still Draft in the source repo).
- Original-source acceptance record: owner PASS and Actions #171 are recorded for that source SHA. This does not transfer as a PASS for this beta port.

## Integrated existing behavior
The package ports the canonical plant lifecycle and original Classic PhytoLab view: researched model → produced seedling → greenhouse bed/aquarium → care and growth → transplant to compatible habitat, plus existing additive recipes. It uses the original engine state and resource pools and preserves plant IDs when migrating old worlds. Dead plants no longer provide live-plant oxygen/nutrient effects, lifecycle growth is not double-counted, and newly built habitats do not receive a free mature starter when the lifecycle schema is active. The original Classic Plants view remains the fallback if the optional module is absent.

Touched files: js/plant-lifecycle.js, js/plant-lifecycle-ui.js, js/engine.js, js/app.js, js/longplay-ui.js, index.html, sw.js, the existing LW-C Actions regression step, and tests/lw-d-l3-9-original-plant-engine.test.cjs.

## Boundaries and QA
- No LW-D files, 3D prototype, Play Games credentials, signing, package identity, or server code are copied or changed.
- Existing social/FCM, AI, Play Games, backups, and release configuration remain from the beta base and must be exercised in the future owner+assistant test session.
- The new regression is wired into GitHub Actions but has not been run from this staging action. No Android build was started.
- No versionCode is assigned here. The published track must be checked immediately before any future build candidate.
- Requires GitHub Actions run, unsigned Android Build snapshot, source/artifact SHA reconciliation, local official signing, then owner device QA. Only the owner can record OWNER PASS for this beta build.

## Known risk to inspect during QA
Legacy saves with existing flora receive the one-time lifecycle migration/grace behavior in the exact source code. Include a copied/test world with old habitat flora and a newly built habitat; confirm backup/restore round trip and no lost pet/social state before proposing Play upload.
