# Trialum v47 — Garden, Crops, Warehouse, and Production Roadmap

**Date:** 2026-11-23  
**Status:** DESIGN AND SOURCE AUDIT ONLY. No gameplay implementation, Android build, Play Console upload, or server change is included in this document.  
**Target:** Classic view first, using the original Trialum engine as the authority. The same saved world and production state must later feed the 3D Living World view.

## 1. Product direction

Trialum's garden is a working part of the living world. It starts empty of planted gameplay plants. Players discover or unlock plant models, create seeds/seedlings, plant them, care for them, and receive real harvests only after a crop grows. Some plants support habitats and can be transplanted; other plants produce vegetables, fruit, grains, or other materials. Harvested goods enter the real warehouse, with fresh produce routed to the refrigerator. Future facilities such as mills, bakeries, kitchens, and other workshops transform stored inputs into new outputs.

This is an extensible production system, not a collection of decorative props or unrelated counters. It must preserve the game's existing offline play, saved worlds, resource costs, and already-built mechanics.

## 2. Source audit: what exists and what is missing

### Present in the Trialum Beta v46/v47 source

- `js/plant-lifecycle.js` already has a real ornamental-flora lifecycle: unlocked blueprint → paid seedling production → planting into a compatible bed → day-based growth/care → mature transplant into a habitat. It tracks hydration, health, death, and garden actions.
- `js/plant-lifecycle-ui.js` exposes the nursery, garden beds, care, and transplant actions in the Classic interface.
- `js/warehouse-inventory.js` models real food portions across rack, cold, packing, hand, and individual pet reserves. The canonical total is `foodFactory.stock`; moves and pet allocations must conserve it.
- `js/food-supply-chain.js` connects warehouse allocations to pet feeding.
- Existing Beta warehouse work and the upstream LW-D warehouse integration are separate source changes; they must be reconciled by exact source SHA before copying or stacking code.

### Concrete gaps and mismatches to address

- The legacy `plantsTab()` in `js/app.js` still presents a direct “plant in selected habitat” action. The newer plant-lifecycle layer overrides `E.plant()` to reject that shortcut and require a seedling, garden growth, and transplant. The Classic UI therefore exposes two conflicting planting paths.
- The current lifecycle's `gardenPlants` represent plants intended for habitat transplant. There is no verified crop category with harvestable fruit/vegetable/grain outputs.
- The warehouse inventory currently treats `foodFactory.stock` as prepared pet-food portions. It does not yet represent raw crop harvest as warehouse goods or connect crop yields to cold storage.
- The owner reports static plants in the world. Every visual plant must be audited and classified as (a) a gameplay plant backed by saved engine state or (b) clearly non-interactive scenery. A decorative plant must never appear as a planted crop, harvestable stock, or a free starting plant.
- The original Trialum repository records Draft PR #92 as connecting canonical food inventory to Classic and the LW-D warehouse. That PR's documented state is owner-device QA pending; do not treat it as merged or assume Beta contains its latest integration. The current Beta source has its own warehouse modules. Reconcile the exact handoff/commit before implementation.

## 3. Intended engine model

### 3.1 One catalog, multiple production roles

Add explicit data-driven item and plant definitions instead of hard-coded special cases:

- **Flora:** oxygen/ecosystem plants, grown in the garden and optionally transplanted into compatible habitats.
- **Crops:** plants grown for one or more harvest products (vegetables, fruit, grains, fibers, and later materials). Crop plants remain in production beds and produce harvests on their defined growth schedule.
- **Goods:** typed inventory items such as seed, raw produce, grain, prepared food, and craft materials. Each definition describes allowed storage zones and, when needed, processing inputs/outputs.
- **Facilities:** seed producer/nursery, garden beds, cold store, dry warehouse, mill, bakery, kitchen, and future workshops. Facilities unlock through existing research/progression rules and operate on the same saved world.

Species and recipe data should define compatibility, growth time, care needs, harvest cycle, yield, storage requirements, and processing recipes. UI, Classic engine, and 3D should read these definitions instead of maintaining separate lists.

### 3.2 Lifecycle and production flow

1. Research/discover a plant model.
2. Produce a finite number of seeds or seedlings using the agreed resources and action cost.
3. Plant one seed/seedling in a compatible empty garden bed. The saved garden shows only plants that were actually planted.
4. Advance crop growth through the same deterministic day/offline-catch-up system used by the world. Care and failure rules must be visible and bounded.
5. Permit harvest only when the crop is ready. One successful harvest consumes the ready state and creates the catalog-defined quantity exactly once.
6. Put harvested vegetables and fruit into cold storage; route grains and shelf-stable goods to the appropriate dry-storage zone. Show the real quantity and capacity.
7. Let future processors consume exact stored inputs and produce exact outputs. For example, a mill converts grain to flour and a bakery converts flour plus other defined inputs into baked goods. No facility may mint output without consuming its recipe inputs.
8. Pet feeding continues to consume prepared food from the pet's own reserve. Raw produce must not silently bypass compatibility, preparation, or the existing food-supply rules.

### 3.3 Inventory invariants

- One authoritative inventory ledger is shared by the laboratory, garden, warehouse, processors, pet home reserves, Classic UI, and 3D projections.
- Item type is part of the identity. Raw fruit, grain, flour, prepared pet food, and seeds are not interchangeable counters.
- Every transfer conserves stock. Every processor has an atomic input→output transaction. A repeated tap/retry cannot duplicate harvest or craft output.
- Pet reserves remain reserved for compatible prepared food unless a later, explicit design changes that rule.
- Fridge and warehouse numbers are real engine state. A true zero displays zero; unavailable/missing engine state is displayed as unavailable, never fabricated as zero or a nonzero visual prop.
- Capacity, units, storage compatibility, and any spoilage/decay policy must be explicit and consistent across Classic, offline progression, backup/restore, and 3D.

**Initial policy recommendation:** implement real refrigerator storage without spoilage in the first crop increment. Add freshness/expiry only as a separately balanced and documented mechanic; otherwise time-away could silently destroy saved harvests.

## 4. Garden and visual rules

- A new world starts with no planted gameplay flora or crops. Empty beds remain visibly empty.
- A newly constructed garden/habitat does not receive an implicit free live plant. If a tutorial grants a starter seed, it must appear as a real inventory item and be planted by the player.
- Existing saved plants and inventories are preserved during migration; no retroactive seed costs, deletion, or invented harvest.
- Replace/remove static gameplay-looking plants in garden beds. Keep only scenery that is clearly non-interactive and outside planting slots; all mature/harvestable plants must be rendered from canonical saved state.
- Provide visible bed occupancy, plant/crop identity, growth stage, health/care status, harvest readiness, and warehouse destination.
- Keep flora transplantation and food-crop harvesting as separate actions so habitat plants are not accidentally consumed as crops.

## 5. Incremental implementation stages

### Stage A — Source reconciliation and UI consistency

- Compare exact v47 Beta branch with the current Classic-only handoff and Draft LW-D PR #92/S7 garden sources.
- Record exact source SHAs, identify which warehouse integration is already in Beta, and port only missing, reviewed changes.
- Remove the contradictory direct-plant UI path; all new planting uses the seedling/garden lifecycle.
- Inventory static plant visuals and classify each as gameplay or scenery.

**Gate:** one authoritative plant flow; no source overwrite or unrelated 3D changes; existing save fields and food warehouse behavior documented.

### Stage B — Empty garden and real seed-to-plant lifecycle

- Ensure new saves and newly built garden areas contain no live gameplay plants until planted.
- Keep existing `agro.gardenPlants` lifecycle where compatible; define a safe schema migration and preserve legacy habitat flora.
- Verify seed production, compatibility, planting, growth, care, death/removal, and transplantation with real state.

**Gate:** an empty fresh garden stays empty; no plant can appear without seed/seedling consumption; old worlds retain their saved plants.

### Stage C — First productive crops

- Add one representative vegetable and one fruit crop using data-driven definitions.
- Plant, grow, and harvest them through the same authoritative garden system, with duplicate-harvest protection.
- Store harvested produce in the refrigerator and persist it across save/load and JSON backup/restore.

**Gate:** harvest quantities match definitions; refrigerator shows the same stock in every Classic view; no free output or loss on reload.

### Stage D — Expand to grains and processing facilities

- Add grains as a dry-stored crop category.
- Add processor definitions and one end-to-end chain, such as grain → mill → flour → bakery → baked goods, only after input/output transactions and capacities are stable.
- Add further produce and facilities as independent data entries, not one-off engine branches.

**Gate:** each chain conserves inputs/outputs, respects facility unlocks/capacity, and saves/restores correctly.

### Stage E — Classic/3D parity and owner QA

- Classic UI is the functional acceptance surface first. The 3D scene becomes a read-only projection for counts/state and sends actions through the existing trusted parent-engine bridge.
- Verify rack/cold/dry storage and production state across screens and after navigation, restart, offline progression, and backup/restore.
- Test fresh and legacy copied saves, action limits, low resources, full beds/storage, incompatible species, duplicate taps, and true zero inventory.
- Obtain owner phone acceptance before moving any candidate to a Play track.

**Gate:** engine tests/CI pass, source SHA recorded, owner device PASS recorded, and Beta/3D handoff aligned. CI is not a substitute for owner QA.

## 6. Compatibility, privacy, and release boundaries

- Keep all world state offline-first and in the existing save/backup model unless a later approved design explicitly changes this.
- Do not add account identifiers, server inventory, or online dependency to garden/crop production.
- Do not clear app data, reset profiles, or change the production server as part of the plant/warehouse work.
- Do not copy the entirety of the main Trialum or LW-D branch into Beta. Import only scoped engine/UI assets and cite source branch and SHA.
- No Android build, signing, Play upload, release, or version-code change is implied by this plan.

## 7. Current decision and next action

The next work item is **Stage A: source reconciliation and UI consistency**, followed by the engine implementation in stages. The existing ornamental plant lifecycle and prepared-food warehouse should be preserved and unified, not replaced. Productive crops expand the same engine into a longer production ladder: seeds → crops → harvest → storage → processing facilities → finished goods.

Before Stage A implementation, obtain/verify the exact current source handoff for the main Trialum garden/crop changes and the latest PR #92 warehouse integration, then record their commit SHAs in the implementation handoff.
