# Trialum — Global Classic-to-3D Product, Engine, Economy, and Safety Roadmap

**Created:** 2026-11-24  
**Status:** Owner discussion draft. This is a product/engineering roadmap, not a release commitment, legal opinion, or completed implementation.  
**Current workstream:** Trialum Beta v47, isolated from the main Trialum development repository.  
**Core rule:** Build and validate gameplay in the original simulation engine and Classic 2.5D view first. Later, the 3D Living World becomes a visual and interaction adapter over the same authoritative simulation. Do not create a second set of game rules for 3D.

## 1. The game we are building

Trialum should become a persistent world that grows with the player over many years. The player is a spectator, planner, and caretaker: they choose what to research, build, unlock, plant, staff, buy, and improve. The pets remain characters with their own needs, homes, histories, memories, relationships, work, money, and family lives.

The intended blend is **simulation plus directed action**:

- The player chooses goals and issues commands, rather than controlling a first-person character.
- Pets act autonomously between player decisions. Their abilities, needs, relationships, and memories influence what they do.
- The player can intervene through short, readable actions: assign a pet, dispatch help, repair or upgrade a facility, resolve an event, care for a pet, or organize a day's plan.
- The world continues at a bounded, deterministic pace while the game is closed. Opening the app reconciles elapsed game time once; no pet earns unlimited wages or consumes unlimited stock because of a retry or time skip.
- Progress opens more of the world over time. The player is not shown a finished, crowded city on day one.

The 2.5D Classic release should be satisfying as a complete game in its own right. It should not feel like a temporary shell waiting for 3D.

## 2. The 2.5D world proposal

### Camera and presentation

Use a readable, oblique/isometric diorama rather than first-person movement. The player can inspect a district, select a building or pet, open its functional panel, and issue commands. Use layered parallax, animated pets, clear building silhouettes, day/night and weather cues, and small visible production effects. Keep the scene legible on a phone at portrait width.

The simulation remains usable without relying on animation. Each scene object has a corresponding accessible UI/action, clear label, keyboard/touch target, and state summary. Respect reduced-motion settings.

### Progressive map

The player begins with the lab, a small habitat, a modest home, and the first garden plot. Research, earned currency, and completed goals unlock additional plots, homes, workshops, public services, and districts. A locked area explains its actual requirement; it does not display fake stock or a misleading “coming soon” control as if it worked.

Suggested district order:

1. **Origin Lab and first habitat** — current core evolution, creature creation, research, and the first planted flora.
2. **Garden Quarter** — nursery, empty beds, productive crops, orchard/fruit plots, and harvest logistics.
3. **Home Quarter** — pet homes, household storage, needs, and personal belongings.
4. **Workshop Row** — mill, bakery, kitchen, and later specialist production.
5. **Community Square** — shared facilities, gathering spaces, and age-appropriate social play.
6. **Care District** — a fictional clinic and other services staffed by suitable pets.
7. **Safety and civic district** — later, a fictional community-safety/police service if it adds a meaningful, nonviolent gameplay loop. It is not a replacement for online moderation, reporting, or real-world emergency services.

Each district is a set of spaces and unlocks in the same saved world. A building can be represented by an illustrated card or 2.5D scene before it gets detailed animation; its engine rules and inventory must already be real.

## 3. Engine/rendering architecture

### Canonical simulation engine

The original engine owns all game rules and saved state:

- world day, unlocks, building levels, costs, and action queues;
- pets, homes, needs, skills, abilities, jobs, wallets, relationships, family lineage, lifespan, and memories;
- seed inventory, planted flora/crops, growth, harvest, goods, warehouses, recipes, workshop inputs/outputs;
- deterministic offline catch-up, save/load, migration, backup, and restore.

Gameplay changes should go through named engine commands and return explicit results/events. Views should query a projection of engine state; they must not invent stock, award money, age pets, or directly mutate the save from display code.

### Classic 2.5D view

The current Classic UI and future 2.5D scenes call the canonical engine. If an action succeeds, the same transaction updates the same save whether it was initiated from a card, a map hotspot, or a future 3D object.

### Future 3D view

3D receives a documented state snapshot and sends validated action requests through the existing parent-engine boundary. It does not own a parallel inventory, wallet, pet-age clock, crop growth, relationship system, or job simulator. The same save must produce the same answers in Classic and 3D.

### Server boundary

Offline world simulation should remain local and playable. The social server may authorize online profiles, friends, shared rooms, preset messages, reports, and safety controls. It should not become a second source of truth for the local garden, offline job clock, or pet wallet unless a later, explicit cross-device/cloud-save design requires it. Any server feature must be enforced on the server as well as hidden/disabled in the UI.

**Before exiting Closed Testing, migrate the social service from the private/home host to cloud.** During app-version adoption, old and new endpoints may both be reachable, but they must route to one canonical cloud data plane; do not run two independently writable profile databases. The old server may remain a restricted compatibility gateway until supported clients migrate. See [TRIALUM_CLOUD_MIGRATION_AI_AND_REVENUE_PLAN.md](TRIALUM_CLOUD_MIGRATION_AI_AND_REVENUE_PLAN.md).

## 4. Progression and unlock philosophy

- Unlock the next layer through a mix of research, earned materials, completed goals, and world readiness.
- Give each lock a clear preview, exact requirements, and an alternate activity the player can do now.
- Do not use paid currency as the only route through a required progression gate.
- A player should always have a free, understandable path to obtain basic food, care, and future production inputs.
- Limit simultaneous chores. Pets can handle routine work autonomously; the player makes meaningful strategic choices rather than tapping every meter every few minutes.
- Let players pause or slow the world, and make important changes reversible where possible.

## 5. Economy: one world reserve and individual pet wallets

### Name recommendation

**Recommended currency name: Луми (Lumi).** It is short, fictional, easy to display in Macedonian and English, and fits Trialum's light/energy identity. Use **Светофонд / World Treasury** for the player's shared reserve. These are names only; do not rename the existing `credits` field until the owner approves a data migration and UI copy.

Other candidates retained for discussion: **Кредити / Credits** (familiar but generic) and **Искри / Sparks** (thematic but may sound like an energy resource). “Loan,” “bank credit,” or cash-equivalent language should be avoided; these are fictional game balances, not financial products.

### Ledger model

- **World Treasury:** owner-controlled shared balance for buildings, upgrades, staffing, shared supplies, and explicit subsidies.
- **Pet wallet:** each pet's personal balance, used for permitted personal food/care purchases and other later-defined spending.
- **Displayed world total:** calculated from the authoritative ledgers; never kept as a second independently editable balance.
- **Materials and currency:** separate typed systems. A bag of grain is not money; fridge stock is not a pet wallet; a wage cannot be paid by silently changing an item count.

Every money transaction records a stable transaction ID, game day, source, destination, actor, amount, and reason. Transactions reject negative or invalid amounts, are idempotent, and conserve balances across source and destination. The player can inspect the breakdown for each pet and the world reserve.

### Avoiding an infinite-money loop

Decide exactly where value enters and exits the world. Examples of sources: a bounded starting allowance, defined achievements, NPC customer purchases, and later optional Play purchases. Examples of sinks: construction, upgrades, rent/maintenance, supplies, and paid services. If a facility sells output, the system records a customer purchase and its source; production must not mint currency merely because an animation ran.

When a pet works for the player's facility, model gross sales, operating inputs, facility costs, and wages explicitly. The owner receives only the business remainder after wages/costs; the pet receives its defined share in its own wallet. Do not both debit the owner wage and mint the same wage as extra revenue. A company transfer should balance before/after as a single transaction.

### Future paid currency

Paid currency is explicitly **out of the initial implementation**. Free play, jobs, research, and ordinary progression must remain viable without spending. If currency packs are enabled later on Google Play, implement them through Google Play Billing, disclose price/value clearly, use the currency only in Trialum, test supervised-account purchase behavior, and keep cash-out and peer-to-peer payment routes absent unless separately reviewed. Google Play lists virtual currency among digital goods requiring Play billing and says purchased in-app virtual currency must be used in the app/game title where purchased: [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en).

## 6. Production world: garden to workshops

Use one data-driven production catalogue and one canonical inventory:

1. Discover a plant model.
2. Produce seeds/seedlings from real inputs.
3. Plant into a compatible empty bed.
4. Grow and care for the planted plant/crop over simulated days.
5. Harvest only when ready; prevent duplicate harvests.
6. Route fruit and vegetables to cold storage; grains and shelf-stable goods to dry storage.
7. Use facilities to consume exact inputs and create exact outputs: grain → mill → flour → bakery → baked goods, with later chains added through data.
8. Use prepared food for pet feeding under the existing compatibility and household-reserve rules.

The laboratory grows from basic resource actions into a safe, scientifically grounded research loop: hypothesis → experiment → success/inconclusive/failure → recorded learning and next attempt. Real chemistry principles should be modeled consistently, while fictional species remain fictional and the experience does not become an unsafe real-world synthesis manual. Cloud migration, future AI costs, and the no-ad/data-broker commitments are detailed in [TRIALUM_CLOUD_MIGRATION_AI_AND_REVENUE_PLAN.md](TRIALUM_CLOUD_MIGRATION_AI_AND_REVENUE_PLAN.md).

Flora for a habitat and productive crops are distinct plant roles. Transplanting habitat flora must not accidentally consume a food crop. A newly created garden starts empty. Keep legacy planted world state in existing saves; do not grant free harvest or delete old plants during migration. The detailed staged plan is in [V47_GARDEN_CROPS_AND_PRODUCTION_ROADMAP.md](V47_GARDEN_CROPS_AND_PRODUCTION_ROADMAP.md).

## 7. Homes, needs, jobs, and services

### Homes and needs

Each pet gets a home or household assignment as part of progression. Hunger, health, comfort, cleanliness, rest, and social bond should use clear bounded values. Pets can use their own wallet for defined goods and care; the owner may explicitly subsidize them from the World Treasury.

**Fairness requirement:** lack of currency must not silently create an unrecoverable hunger/death spiral. Define a free emergency-care/basic-food path and understandable warnings before autonomous spending. The owner decides how generous it should be; it cannot become a paywall for basic survival.

### Work and schedules

Jobs are data-driven roles at facilities. A job describes required maturity, skills/traits, work output, inputs, hours, wage/share, and days off. Pet suitability makes job choice meaningful without permanently making a pet worthless.

Initial schedule proposal: one completed in-game weekday can represent one eight-hour shift; Saturday/Sunday are off. Resolve jobs by game-calendar shift IDs, not by keeping a timer alive while the app is open. Returning from offline play processes only eligible shifts once, with a bounded catch-up. Day-pass/time-skip effects need a separate owner decision and must not mint unlimited money or goods.

### Workshops and care services

- **Bakery and mill:** use the production chain above and employ suitable pets.
- **Clinic:** a fictional care service staffed by suitable pets; treat game conditions only. Publish prices, inputs, available free care, and wait/status clearly.
- **Police/community safety:** later optional fictional civic gameplay, not a child-tracking system and not a substitute for the report/block/moderation systems required for online play.
- **Other workshops:** add only when their inputs, outputs, employee behavior, unlocks, and sinks fit the shared economy.

## 8. Relationships, families, and individual memory

- Each pet has a relationship with the player and relationship edges to other pets. Bond changes come from repeat, understandable interactions and shared life events, not hidden random boosts.
- Mutual affection can progress into a partnership and, later, offspring through a non-explicit, age-appropriate simulation mechanic.
- Only pets that reached the game's explicit maturity threshold can form a breeding pair or create offspring. No pet-child/adult pairing and no real-world sexual content.
- Offspring inherit defined fictional traits and lineage. Mutation can create variety and affect lifespan only through transparent, bounded rules.
- Children need a home, care, food, and time to mature before work. Family size is bounded by real housing/care capacity and the player's ability to manage the world.
- Memories remain per-pet and bounded: recent events plus durable summaries/important milestones. Reuse the existing contextual memory/compression work only after source and retention audits; do not assume that compression alone solves storage/privacy.
- Online play must never allow another player to write arbitrary memory, rename a local pet, or change its wallet/relationships without an explicit, authorized engine action.

## 9. Lifespan, mutation, and legacy

- Pet age uses simulated world days/weeks, not the player's real age. Define species/lineage maturity and a lifespan range that can be explained in-game.
- Higher mutation development can extend maximum life, but the rule needs a clear cap so repeated mutation does not unintentionally create immortality or an unbounded balance exploit.
- Give the player a long, visible late-life notice and an opportunity to prepare; never remove a pet unexpectedly on app open.
- On end of life, follow the owner's direction: no funeral requirement; the active pet gently disappears/archives. Its identity, history, family tree, memories chosen for retention, wallet, and belongings remain in the world.
- Proposed archival model: mark the pet inactive, freeze its job and needs, and move its wallet/items to an inspectable household/legacy account. Do not delete or automatically spend the estate. Whether another pet can inherit or use it is an owner decision.
- Existing pets need a one-time migration that grants a fair legacy lifespan and never instantly expires a saved pet.

## 10. Online social safety and parent/guardian supervision

### Feature tiers

Use a centrally enforced feature policy, not scattered age checks:

1. **Offline world:** local play, pet needs, homes, garden, jobs, memories, and local backups.
2. **Bounded online social:** accepted friends, shared pet spaces/visits, and reviewed preset messages, with block, report, rate limits, privacy controls, and clear consent.
3. **Expanded communication:** free-form player messages, user images/audio, or open discovery remain off until the product has moderation, reporting/response operations, privacy/retention controls, jurisdiction review, and a separate owner decision.

Pet-to-pet preset interaction lowers what players can send, but it is still online social functionality. It is not automatically exempt from age, safety, privacy, or adult-management requirements.

### Account/age states

Keep distinct, server-verifiable states such as `unknown`, `age-signal-shared` with a returned band, `managed/supervised` only when a trusted provider explicitly reports it, `guardian-linked`, `guardian-consent-verified` only when the method actually supports that claim, and `revoked/expired`. Do not infer “unmanaged adult” from an email address, Play Games nickname, payment card on file, user-declared age, or a parent linking code.

Google Play Age Signals remains **dormant in v47**, matching the existing v47 owner direction. In later releases, use the current supported API only where applicable and after testing the real response states. Google documents globally optional sharing and region-specific mandatory protections; users can return `NOT_SHARED` or `VERIFICATION_REQUIRED`, and parent settings can determine whether a supervised user's age is shared. This is not a globally available proof of adult status: [regional protections](https://developer.android.com/distribute/age-appropriate-experiences/regional-protections), [request age signals](https://developer.android.com/google/play/age-signals/request-age-signals), [Age Signals overview](https://developer.android.com/google/play/age-signals/v4/overview?hl=en).

If a jurisdiction requires a platform signal and the signal is unavailable/unknown, keep only that jurisdiction's regulated feature unavailable while preserving offline play and any legally permissible lower-risk experience. In jurisdictions without such a signal mandate, select an age/consent approach with counsel instead of treating an unavailable API as proof of adulthood.

### Parent/guardian controls

- Provide a parent/guardian settings area to review the linked profile and manage each online feature level, friend/contact controls, purchases when eventually enabled, and consent status.
- Give the player/child a visible explanation of what is controlled and a readily available way to pause social features and request unlinking. A child safety stop must take effect immediately; an administrative review must not leave the social connection live while a dispute is pending.
- A one-time QR/code can securely pair two app profiles but does **not** prove the other user is a legal parent or an adult. Describe it as “profile linking” until a trusted adult-verification/consent mechanism is completed.
- Where law or Play requires verifiable parent action/consent, use an approved or reviewed method that is reasonably calculated to verify the parent. Do not substitute a local checkbox, child-generated PIN, or code shown to a nearby stranger.
- Keep parental oversight proportional: feature toggles, approvals/revocation, safety status, and necessary reports; do not expose private pet memories or unrelated local history by default.
- Store only minimum pseudonymous links/status, consent version, feature grants, expiry/revocation markers, and audit events needed for enforcement. No exact DOB, parent email, identity document, or raw provider payload unless an approved necessity and retention plan calls for it.

Google Play says target ages must accurately reflect the app, 13–15 may be considered children in some locales, and apps targeting users under 21 must consider local child definitions. Where children are in the target audience and an app has social features, Play requires adults to be able to manage those features; it also sets conditions for safety reminders and adult action before exchanging personal information. A “13+” declaration alone does not remove these requirements: [target audience guidance](https://support.google.com/googleplay/android-developer/answer/9867159?hl=en), [Families policy](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en).

For EU consent-based personal-data processing, GDPR Article 8 sets 16 as the default age and permits Member States to lower it no further than 13; the exact country rule and lawful basis matter. COPPA generally requires verifiable parental consent before collecting personal information from covered children under 13; merely selecting “13+” does not resolve actual-knowledge or child-directed-service analysis. Review the product and every SDK/provider with counsel before changing the audience or launch regions: [GDPR Article 8](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=celex%3A32016R0679), [FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions).

### Regional policy configuration

Maintain a reviewed country/region matrix with: target-age and legal-child thresholds, age-signal status, consent basis, allowed social tier, store rating/availability, parent-control requirement, purchase handling, data retention, and the authority/date/source of the decision. The server may enforce only the reviewed feature policy; country must not be guessed from IP if unreliable, and unknown region must not be treated as a verified adulthood signal.

The Play Store target audience, content rating, Data Safety, Privacy Policy, Terms, in-app onboarding, and actual code must all describe the same experience. Changing the target audience is a publisher decision and requires a complete product/policy review, not only a console checkbox.

## 11. Proposed version plan

Version labels below are **planning labels**, not confirmed Android version codes or Play releases. Check Play Console and the source handoff before assigning any official version number. Each feature can be split into smaller releases if source review or device QA finds risk.

| Planned increment | Goal | Scope and exit gate |
| --- | --- | --- |
| **v47 — Safety and source baseline** | Finish the currently active beta foundation. | Preset-only social client plus matching server enforcement, name localization, UI dropdown state fix, source/engine reconciliation. Cloud migration is a required gate before Closed Testing ends; it can use a separate cloud-migration build if the engine changes are not ready. No claim of full child compliance. |
| **v48 — Engine contract and 2.5D world foundation** | Stabilize saved state and world navigation. | Source SHA reconciliation; command/event/query contract; save migration; world map and first unlockable spaces; state-driven interactive building panels; fresh garden empty; shared renderer-independent engine. Exit only with old saves and current Classic functionality preserved. |
| **v49 — Garden and first crops** | Make planting and harvest real. | Seed/seedling production, empty beds, growth/care, first vegetable and fruit crops, duplicate-safe harvest. Actual produce enters typed warehouse storage. |
| **v50 — Warehouse, advanced lab, and first production chain** | Connect experiments and harvest to useful goods. | Cold and dry storage, mill/bakery recipe chain, capacity/transactions, food lab and pet-food compatibility; add safe hypothesis/experiment/error/research progression. Exit when item conservation, lab outcomes, and save/restore work. |
| **v51 — Homes and currency ledgers** | Give player and each pet separate balances. | World Treasury + pet wallets, unlock costs, homes and belongings, auditable transaction ledger, migration from existing global credits. Keep currency name configurable until owner decision. |
| **v52 — Needs, care, and first jobs** | Start the autonomous weekday simulation. | Hunger/health/rest, free emergency care path, clinic prototype, work eligibility, suitable jobs, eight-hour game shifts and weekends off, bounded offline reconciliation, paid wages from explicit source. |
| **v53 — Bonds and family** | Make pet relationships persist across generations. | Player-pet and pet-pet bonds, mature-pet pairing, offspring, inherited fictional traits, housing/care capacity, bounded memory summaries and lineage UI. No free-form player chat in this increment. |
| **v54 — Mutation, lifespan, and legacy** | Complete individual lifecycle without losing world history. | Species/lineage life model, transparent mutation extension/cap, late-life notice, gentle archival, retained possessions/wallet/history, old-pet migration and owner-tested transition. |
| **v55 — Community services and town depth** | Add staffed civic loops. | More workshops and clinic roles; consider police/community-safety gameplay only if it adds a useful, age-appropriate simulation loop. Online abuse is still handled by server safety/reporting systems, not fictional police. |
| **v56 — Classic 2.5D world expansion** | Make the Classic world feel complete and lively. | District art, interactive homes/workshops, pet schedules and reactions, readable progression, performance/accessibility, full device QA. Complete 2.5D is a release goal, not merely a prototype. |
| **v57+ — 3D visual adapter** | Deliver the visual jump without rewriting simulation. | Map each engine entity/action to 3D spaces/animations, reuse the same item IDs, job clock, wallets, memories, and save schema. Run parity scenarios across Classic and 3D before a 3D release. |

These increments can have internal alpha/beta builds and smaller source PRs. No Play version, release track, paid feature, or public launch is approved by this planning table.

## 12. Required phase gates

### Engine/data gate

- Canonical data model, stable identifiers, schema version, rollback and save migration documented.
- No duplicate wallet, crop inventory, pet-age clock, job queue, or second 3D economy.
- Transactions and time catch-up are deterministic/idempotent; capacity, resource shortages, job cancellation, and interrupted actions are explicit.

### Player-experience gate

- Fresh-world tutorial teaches research → seed → planting → harvest → storage and first pet care.
- Warnings precede consequential spending, late-life transition, irreversible choices, and social disclosures.
- Core food/care and ordinary progression remain possible without purchased currency.
- Macedonian/English and every enabled locale have complete UI text; custom player pet names are never rewritten by localization.

### Safety/privacy gate

- Age/region/provider status is not overclaimed; unknown/revoked/expired cases have a defined feature tier.
- Parent controls, consent, revocation, delete/unlink, reporting, blocks, retention, server enforcement, and Play Console declarations match the live implementation.
- Review each SDK/API's child-directed terms before using it in a mixed-age or child audience.
- Parent pairing is distinguished from verified adult identity and legally valid parental consent.

### Release gate

- Tests cover new and legacy saves, offline/online transitions, duplicate requests, multiple pets, weekend shifts, day skips, wallet and inventory conservation, backups/restores, family events, and aging boundaries.
- Android build and owner device review are separate gates; CI success is not phone acceptance.
- Changes to age audience, store content, purchases, public server behavior, or Play release require the owner's explicit decision after the artifacts and effects are reviewable.

## 13. Rough planning horizon and risks

The owner's current rough-work expectation is about one month for the first substantial engine work. Treat that as a planning window, not a delivery promise: the full roadmap spans many releases and depends on how much of the main-repo engine is already prepared. First estimate the source deltas at v48 Stage 0, then break work into reviewable changes. Do not compress safety, migrations, or device QA to fit a date.

Primary risks and mitigations:

- **Engine split between Classic and 3D:** share command/state contracts; prohibit parallel authorities.
- **Inflation from offline catch-up/day passes:** use bounded, replay-safe game-calendar events and explicit money sinks.
- **Pet lifespan causes loss/distress:** long warnings, no abrupt expiration, keep estate/history, test with copied worlds.
- **Children or managed accounts receive unsafe features:** regional policy matrix, age-appropriate tiers, adult controls, server authorization, and legal review.
- **Parent link is misused or coercive:** one-time challenge is not adult proof; safety pause/unlink is immediate and simple.
- **Paid currency becomes a survival requirement:** maintain free care/food/progression and test the whole game without purchases.
- **Large memory growth:** retain recent events + bounded long-term summaries and chosen milestones; archive safely instead of keeping unlimited raw dialogue.

## 14. Immediate next steps

1. Continue accepting the owner's remaining gameplay requirements before freezing the global specification.
2. Inspect the exact current Beta, main Trialum, and LW-D handoff SHAs without changing the main development repo; identify existing finished mechanics versus gaps.
3. Finish the v47 safety/server/UI blockers as a separate acceptance gate; do not blend the entire long-range economy into one beta build.
4. Select the v48 engine/state contract, currency name, first-world unlock map, and migration rules.
5. Implement one vertical slice at a time: engine → Classic UI → save/offline behavior → tests/CI → owner phone review → only then the next slice.
6. After Classic engine contracts stabilize, create the 3D adapter handoff so the other development session can build visuals against known APIs.

## 15. References and assumptions

This document uses official policy sources as a planning baseline, not as a legal determination. Play, regional rules, SDK capabilities, and Google Play requirements can change; re-check them before every relevant release. The publisher should obtain jurisdiction-specific legal advice before targeting minors, processing age/guardian data, or enabling purchases.

- Google Play Target Audience guidance: https://support.google.com/googleplay/android-developer/answer/9867159?hl=en
- Google Play Families policy: https://support.google.com/googleplay/android-developer/answer/9893335?hl=en
- Google Play regional age protections: https://developer.android.com/distribute/age-appropriate-experiences/regional-protections
- Google Play Age Signals request and responses: https://developer.android.com/google/play/age-signals/request-age-signals
- GDPR Article 8: https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=celex%3A32016R0679
- FTC COPPA FAQ: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- Google Play Payments policy: https://support.google.com/googleplay/android-developer/answer/9858738?hl=en

The owner's additional hosting, AI, revenue, no-ad, and persistent-time requirements are captured separately in [TRIALUM_CLOUD_MIGRATION_AI_AND_REVENUE_PLAN.md](TRIALUM_CLOUD_MIGRATION_AI_AND_REVENUE_PLAN.md).

## Change log

- 2026-11-24: first consolidated global roadmap from the owner's direction: Classic 2.5D first, shared simulation engine, later 3D adapter, progressive world, wallets/jobs/needs/families/lifespan, future production, and age/parent/social safeguards. Version schedule is provisional and awaits more owner requirements.
- 2026-11-24: added the pre-Closed-Test cloud-migration gate, one-authority dual-endpoint strategy, free/no-ad/data-broker commitment, local-vs-cloud AI modes, bounded action-unit recommendation, advanced-lab direction, and safe offline catch-up. See [TRIALUM_CLOUD_MIGRATION_AI_AND_REVENUE_PLAN.md](TRIALUM_CLOUD_MIGRATION_AI_AND_REVENUE_PLAN.md).
