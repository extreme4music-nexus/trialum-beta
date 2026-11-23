# Trialum — Pet Economy, Work, and Lifespan Concept

**Captured:** 2026-11-24  
**Status:** Owner concept captured for discussion. Design only; no implementation or balancing decisions are final.  
**Implementation target:** Original engine and Classic view first. Living World 3D will later consume the same authoritative world state.

## 1. Vision captured from the owner

Trialum is intended to grow into a persistent living world. Pets have homes and individual lives, can take suitable jobs in bakeries and other workshops, earn/use an in-game currency, and keep personal possessions. A central world/player reserve is also visible alongside each pet's personal balance. Production facilities are part of the world economy and connect with the garden/crop → harvest → storage → processing plan in [V47_GARDEN_CROPS_AND_PRODUCTION_ROADMAP.md](V47_GARDEN_CROPS_AND_PRODUCTION_ROADMAP.md).

Pets have a simulated lifespan measured in game days/weeks, not the player's real-world age. They become eligible for work after reaching an in-game maturity threshold. Work follows a weekday schedule: up to eight hours per working day, with weekends off. Pet abilities and traits affect which jobs they can perform. Mutations extend a pet's lifespan; higher mutation development should provide a longer life, subject to a balanced limit.

When a pet reaches the end of its life, it gradually disappears from active play without a funeral mechanic. Its possessions and accumulated value remain available in the world; they must not vanish with the pet.

## 2. Design principles to preserve

- **Classic engine first:** the original saved world owns balances, jobs, production, age, mutations, homes, and possessions. The 3D version is a later view/controller over those same rules, not a separate simulation.
- **Offline-first:** the world must continue to progress when the game is closed. Work and aging must reconcile deterministically on return, without requiring the app to remain open.
- **Game currency only:** currency is fictional and cannot be cashed out. Future purchases, if introduced, remain a separate, explicitly reviewed feature and must not make free play impossible.
- **Separate money from materials:** currency balances are not food, seeds, crops, recipes, or warehouse stock. Transfers and processing must not silently convert one category into another.
- **Per-pet agency:** every pet has its own balance, home, work assignment, skills/traits, and possessions. A pet's actions and account must not accidentally spend another pet's funds.
- **Persistent world:** a pet's lifecycle ending does not delete its history, currency, stored items, or contribution to the world.
- **No human-age inference:** pet maturity/work age is a fictional simulation value; it is unrelated to the player's age or age eligibility for social features.

## 3. Suggested economy model (proposal, not owner-approved)

### Two-level ledger

1. **World reserve / player treasury:** the shared balance displayed in the top HUD and used for world-level costs that are explicitly defined as shared.
2. **Individual pet wallets:** one balance per pet for personal purchases, job income, and other pet-level transactions.

The HUD should show the world reserve and provide a breakdown of each pet's balance. A visible total may be calculated as `worldReserve + sum(activePetWallets) + sum(archivedPetWallets)`; do not store a second editable “total” balance that can drift from the ledger. The exact treatment of archived pets' money is an open owner decision.

Every earning, purchase, transfer, wage, and inheritance should create a bounded ledger entry with transaction ID, game day, actor, source, destination, and amount. Transactions must be idempotent, reject negative/invalid values, and conserve currency across wallets. The display name should not be changed until the owner chooses it and a save migration is specified.

**Currency name candidates for later choice:**

- **Кредити / Credits** — retain the familiar current label.
- **Искри / Sparks** — connects the currency to Trialum's world identity.
- **Луми / Lumi** — short, pet-friendly fictional denomination.

Working recommendation: keep **Кредити** in source until the product name is chosen; treat “world reserve/treasury” as the account name, not another currency.

## 4. Suggested jobs and time model (proposal)

- A job definition lists facility, role, required maturity, ability/skill fit, available shifts, inputs, output, and compensation.
- A pet can only be assigned to a compatible role. Its species/traits affect suitability and possibly quality or output, but must not make a pet permanently useless.
- Model work in the **game calendar**, not real device hours: one in-game workday represents an eight-hour shift; ordinary weekends have no shift. The engine should resolve missed shifts on offline return exactly once.
- The owner should choose whether one game day equals one real day, whether day passes advance jobs, and how much offline catch-up is allowed. Do not let paid or skipped time create unbounded currency or goods.
- A production job consumes the exact required inputs from the facility's canonical inventory and emits defined outputs. Wages and product output are one atomic transaction, so reopening or retrying cannot pay twice.
- The bakery and other workshops should plug into the extensible item/recipe system: for example, crops → cold/dry storage → mill or bakery → finished goods. Facility recipes and staffing are data-driven rather than one-off pet scripts.

## 5. Suggested pet life model (proposal)

- Store `birthDay`/age in the existing simulated day system, with visible life stages and a defined in-game work-eligibility threshold.
- Define a base lifespan for each species/lineage. Mutation level may extend the maximum lifespan through a visible, deterministic rule, with a hard balance cap to prevent accidental immortality or runaway age.
- Determine the actual durations and any care/health modifiers only after the owner gives the remaining design requirements; do not invent weeks/months or make mutation a hidden random death shield.
- Use clear lifecycle states, such as `active → late-life notice → archived`. Give the owner a visible warning period before the pet leaves active play; exact timing and whether the player can influence it remain open.
- On archival, stop active needs/work, retain the pet identity/history, and move its currency and possessions to a defined persistent estate/world repository. Do not silently delete or automatically spend them.
- No funeral screen or mandatory grief mechanic is part of the captured direction. The visual transition should be gentle and explain where the pet's belongings remain.

## 6. Engine/save architecture implications

Before implementation, inspect the current Beta and authoritative Trialum branches and record exact SHAs. The current Beta source has a global `s.longplay.credits` balance and pet objects with `birthDay`/`ageDays` and mutations/evolution data. These existing fields must be reconciled before introducing new ledgers or lifespan fields; never layer a second wallet or overwrite existing pet history blindly.

Planned additions, subject to source audit:

- Versioned world economy state for world reserve, per-pet wallets, and ledger entries.
- Versioned job assignments and deterministic completed-shift records.
- Versioned crop/workshop item quantities reusing the canonical warehouse ledger, while keeping currency balances separate.
- Pet lifecycle fields compatible with the existing day progression, mutation, save/load, JSON backup/restore, and offline catch-up.
- Classic UI for wallet breakdown, home, maturity/lifespan information, job assignment, schedule, facility status, and retained belongings.
- Later 3D adapter that renders these canonical values and sends actions through the established original-engine boundary.

Migration must preserve existing global credits and saved pets. A future migration should move the existing global balance exactly once into the agreed world-reserve field, initialize pet wallets to zero unless a documented source value exists, and never mint duplicate credits. Existing pets should receive a documented legacy lifespan policy rather than being abruptly expired on first update.

## 7. Open decisions for the next conversation

1. Final currency name and plural/unit in Macedonian and English.
2. Which costs use the shared reserve and which use a pet's own wallet; whether pets may transfer funds and who authorizes transfers.
3. Whether wages are paid per completed shift, per output, or as a combination; whether a pet can choose/change a job.
4. How game-day duration, weekends, day passes, offline catch-up, and maximum accumulated work are defined.
5. Work eligibility age, life-stage lengths, base lifespan by species, mutation extension table/cap, and warning period.
6. What exactly persists after a pet disappears: wallet, home contents, inventory, job history, memories, achievements, and whether another pet may inherit/use them.
7. Whether lifespan is purely age-based or can also be affected by care/environment, and how to keep the system fair and understandable.
8. Which first production chain should be playable: vegetable, fruit, grain→mill→bakery, or another chain; which inputs/outputs and storage zones it uses.
9. How the persistent-world vision avoids irreversible loss while still honoring the intended end of an individual pet's life.

## 8. Proposed implementation order (not started)

1. Finish source reconciliation and settle the open decisions that affect save schema/economy.
2. Stabilize item production and warehouse categories (crops, refrigerator, dry storage) under one canonical inventory.
3. Add a versioned world-reserve/per-pet-wallet ledger with migration and transaction invariants.
4. Add one end-to-end facility/job prototype with deterministic shifts and no double rewards.
5. Add the pet maturity and lifespan/archival model, preserving possessions and old saves.
6. Integrate Classic UI and test fresh worlds, legacy saves, offline progression, backup/restore, mutation, multiple pets, weekends, and lifecycle archival.
7. Hand off the exact canonical state/API contract for later 3D implementation.

**No gameplay code, server behavior, Play declaration, or build is changed by this concept document.**

## Change log

- 2026-11-24: captured the owner's initial persistent-world economy, pet employment, mutation-linked lifespan, and retained-estate concept. Additional requirements are expected; this is an extensible draft, not a final specification.
