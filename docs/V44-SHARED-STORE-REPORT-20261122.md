# Trialum 1.4 v44 — Shared Playground Community Store

**Date:** 2026-11-22  
**Branch:** `feature/v44-owner-hud-economy-guidance-20261122`  
**Integration status:** client store + server patch are staged and new/integration client regressions have passed in GitHub Actions run [45066037274](https://github.com/extreme4music-nexus/trialum-beta/actions/runs/45066037274). Server migration, live deployment, DB-backed integration test and owner phone acceptance remain unverified.

## Shipped client implementation
- The existing **server-earned shared playground points** are now displayed as **Shared credits / Заеднички кредити**. This is one existing room wallet, NOT a new balance grant, separate from personal `s.longplay.credits` and future locked Play Billing.
- Owner-visible shared playground store with **14 apparatus**, 8 new: Moon swing, Flower carousel, Explorer tunnel, Climbing tower, Color ball pit, Puzzle wall, Music garden, Star observatory. Legacy sandbox, seesaw, slide, pool, puzzle course and trampoline are preserved.
- Purchase price in shared credits: Slide 8, Pool 10, Puzzle course 12, Trampoline 14, Moon swing 10, Flower carousel 12, Explorer tunnel 14, Climbing tower 16, Color ball pit 18, Puzzle wall 20, Music garden 22, Star observatory 26. Sandbox and seesaw are owned initially and never resold.
- Owner may buy any item from the server-verified catalog; when all `min(6,2+room tier)` scene slots are occupied, purchase goes into permanent inventory and awaits placement.
- Tap/click installed toy inside Canvas to open **immediate owner-only HUD** with *Put in storage*. Stored items remain owned; returning to scene is **free** and requires capacity. A keyboard-accessible Canvas selection and explicit store buttons cover non-touch use.
- All 14 toys have 2D vector illustrations with dynamic six-slot placements and different pet actions. Static scenery remains cached; no personal XP/credits or server award logic is changed by rendering.
- Guest members may see the catalog and earn shared credits via existing server-confirmed activities, but cannot buy, store or place apparatus.
- Client API negotiation requires server `sharedShopEnabled=true`, matching versioned authoritative catalog and existing authenticated social profile. Old private servers present an explicit upgrade notice and **do not allow fake client-only purchases**.
- Updated `js/shared-playground.js`, `js/shared-shop.js`, `js/shared-store-ui.js`, `js/shared-playground-art.js`, `js/shared-scene.js`, `js/app.js`, `index.html`, `sw.js`, `assets/style.css`.

## Server upgrade package (STAGED, NOT DEPLOYED)
- Full reviewed starting point: `Trialum/main/server/src/shared.mjs` main blob SHA `05ac9d3e7db32ea17347e3437d3e28f90c5317ba`.
- Staged target `server-patch/v44/src/shared.mjs` adds catalog, versioned feature flag, permanent `ownedToys`, active `toys`, alias `sharedCredits` for legacy `points`, server-only purchases with idempotent event keys, owner-only placement, WSS notifications, row locks, and activity rewards only on placed toys.
- Idempotent manual migration `server-patch/v44/sql/007_v44_shared_store.sh` expands IDs in existing constraints and adds `playground_toys.placed DEFAULT true`. Existing purchases and all room credit balances remain unchanged. **Database backup before running mandatory.**
- Detailed server deployment instructions `server-patch/v44/README.md`.
- This patch has **not** been applied to `Trialum/main` or NAS/server. No main branch, release signing or Play Console changes have been made.

## Quality gates and follow-up
- Reuses previous v44 game/AI/security test evidence, plus new dedicated `tests/v44-shared-community-store.test.cjs`, original visual regression and relevant shared client tests.
- CI pass: [45066037274](https://github.com/extreme4music-nexus/trialum-beta/actions/runs/45066037274). This is client and static server-contract verification, **not** proof of running PostgreSQL integration or remote server deployment.
- Before releasing to Google Play: Codex must compare staged server source to the true live server version, run tested DB backup + migration, deploy server via owner-authorized path, run authoritative backend integration with two authenticated players and owner/guest negative cases, and confirm real device store transactions.
- Then owner approves updated Android QA, **then** an explicitly reviewed sync against `main`, **then** unsigned APK/AAB for owner-local signing. Preserve the current Age Signals policy in any official build; age mock only in a temporary isolated QA APK.
