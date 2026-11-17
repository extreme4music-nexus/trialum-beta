# LW-C v40 candidate — Classic Food Warehouse and Pet Home Supplies

**Status: source integration prepared on a separate branch; Android build intentionally not started.** This candidate is a Classic-view port of the already implemented food-storage and personal pet-reserve mechanics. It contains no 3D scene, GLB, or bridge code, and it is not release-ready or owner-accepted.

## Provenance

- Beta base: `extreme4music-nexus/trialum-beta` branch `beta/gp-01-living-flora-phyto-20261116`, commit `dc45bc56c26623330ef14fdad5107558fba1d05c`.
- Upstream source: `extreme4music-nexus/Trialum` branch `feature/classic-only-food-warehouse-play-update-20261117`, source tip `f1df1eeb542e8f5187187c692a7df79d7dd4ab99`.
- Working branch: `feature/lwc-v40-classic-food-warehouse-20261117`.
- Release train: this is the first Classic candidate that combines **GP-02 warehouse allocation** and **GP-03 per-pet home reserves**. The two parts share one conservation ledger and are not useful as separate installable increments.
- Candidate label: v40. Do not infer or assign a Play version name/code from this label; check the live Play track before building.

## Ported behavior

1. Food Laboratory remains the sole food-production path. Each recipe's existing canonical `foodFactory.stock[id]` remains the total quantity.
2. Warehouse locations (`rack`, `cold`, `packing`, `hand`) and per-pet reserves are allocations of that total, not a second wallet.
3. Each successful transfer conserves portions. Feeding consumes one manufactured portion from that specific pet's reserve, and must not charge biomass a second time.
4. Classic **More → Food Warehouse** exposes actual stock and the shelf/refrigerator/packing movement controls. The selected pet's details show its personal reserve, supply/return actions, and prepared feeding.
5. Legacy saves without location fields place their existing remaining stock on the rack. No food or reserve is minted. Existing world state and JSON backup/restore remain authoritative.
6. Offline app cache includes the three new modules and uses a new cache key so the old cached script set cannot mask the update.
7. No changes are made to Friends, messaging, FCM, AI, PGS, identities, server behavior, or any 3D scene. The current Classic UI is the only implementation target.

## Changed files

- Added `js/warehouse-inventory.js`, `js/food-supply-chain.js`, and `js/food-home-ui.js` from the upstream Classic-only handoff.
- Adapted `js/app.js`, `js/expansion-ui.js`, `js/longplay-ui.js`, `index.html`, and `sw.js` to wire the modules into the current GP-01 beta source.
- Added English translations in `locales/en.json` and the upstream focused regression tests in `tests/classic-food-warehouse.test.cjs` and `tests/lw-d-food-supply-chain.test.cjs`.
- The copied upstream supply-chain test had an invalid over-escaped regular expression; it was corrected in the Beta copy so Node can execute the intended no-network check.

## Validation completed

- `node --test tests/classic-food-warehouse.test.cjs tests/lw-d-food-supply-chain.test.cjs` — **9/9 passed**. Covers real stock accounting, warehouse movement, individual pet ownership, feeding, duplicate prevention, old-save reconciliation, and JSON round-trip.
- `node tests/beta-contract.test.cjs` — **4/4 passed**, including Friends/FCM configuration, beta-only tester behavior, and existing About/Help content.
- `TRIALUM_LOCALE_AUDIT=1 node tests/ui.test.cjs` — **passed**; all audited views including `warehouse` had zero remaining Cyrillic in English mode.
- `node --check` for all six changed/added application JavaScript files and JSON parse of `locales/en.json` — **passed**.
- The `jsdom`/`gifuct-js` test dependencies were installed locally without saving them to the project.

## Still pending

- Review the exact branch diff and obtain owner device testing with a copy of an existing saved world.
- Test food production, all warehouse zones, supply and return for two pets, both feeding paths, empty stock, incompatible recipes, offline reload, backup/restore, and repeat taps on a physical Android device.
- Compare the behavior and affected source SHA with LW-D so any fixes can be returned to the active development branch.
- Only after source/owner acceptance: create a minimal public Android Build snapshot, run its existing workflow on the already-public snapshot, and build unsigned artifacts. No APK/AAB has been built, signed, uploaded, or published in this preparation.

## Candidate risk to verify on device

Old saves with stock reconcile to the warehouse rack. If a pet has no compatible food in its personal reserve, the existing Home feed control is disabled until the owner produces food and supplies that pet. Confirm this transition is understandable in the actual interface and does not leave saved pets without a practical feeding path.
