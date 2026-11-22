# V44 — Unified Cognitive Memory: coordinated architecture upgrade

> Working branch: `feature/v44-unified-cognitive-memory`  
> Baseline: `fix/v44-mnemos-cognitive-integration` @ `479c0e7a413ff7d57a7325c496d996b0df085b4d`  
> Release branch remains unchanged. Each checkpoint requires owner review before continuing.

## Design contract (applies to every present and future pet)

- Every pet receives a private cognitive identity at creation or non-destructive load of an older world, independent of species index or availability of an AI model.
- Events are local and specific to one pet. Remote/replayed inputs must have stable event IDs; repeats are idempotent and conflicting uses of an ID are rejected.
- Original observed timestamps, dates and provenance are retained. Do not fabricate missing historical conversations or events when migrating old worlds.
- AI generation is never required to capture game events. Local cognitive data must not enter the normal cloud/plain JSON export.
- The canonical memory may be read through bounded private/room-specific adapters, rather than letting each model maintain an incompatible source of truth.
- No release signing, Play publication or merge into the V44 release branch without owner approval.

## Checkpoint 01 — Canonical event identity, V1→V2 migration and storage hooks

**Implementation committed (awaiting CI and owner review):**
1. `js/cognitive-memory.js`: V2, per-pet `eventLedger`, schema version, monotonic per-pet event serial, event source, event timestamp/day, precise food quantity and evolution level.
2. `ingest(p,event)`: validates event scope and fields before mutations; deduplicates stable external IDs after JSON save/reload; rejects an ID reused for conflicting facts; preserves per-pet counters and graph semantics.
3. `ensureWorld(world)`: creates an empty truthful V2 ledger for existing or future pet species; upgrades V1 cognitive objects in place, preserving earlier summaries, topic counts, social records, graph and last-event fields. No artificial legacy birth/action entries.
4. `js/storage.js`: hydrate/migrate local world records upon load and before save; an invalid memory never causes local load to silently replace the world with a new game; refuse to persist inconsistent memory structures.
5. `js/engine.js`: capture authoritative food quantity (3 biomass) in care events; existing birth, care and transfer hooks continue to work.
6. `js/evolution.js`: persist each observed level advance as a per-pet cognitive event (level and day).
7. Regression suites `tests/cognitive-events-v44.test.cjs`, `tests/cognitive-integration-v44.test.cjs` plus dedicated CI workflow `.github/workflows/v44-unified-cognitive-memory.yml` for current and future species, V1 migration, replay, corruption, offline persistence, privacy export, game integration and prior cognitive/engine/evolution tests.

**Compatibility notes:** `record(p,kind,options)`, `ensure(p)`, `recall`, `topic`, `encounter`, and `socialMoment` retain their preexisting external signatures. An older pet whose V1 record did not contain an event stream has a V2 ledger that starts empty; old summaries remain accessible.

**Not claimed by checkpoint 01:**
- All social, owner, playground and Android background observations have **not yet** been moved through `ingest`. The old playground/native rolling 45-day stores remain.
- Durable event compaction, capacity management, atomic cross-storage imports, and fully transactional encrypted restore are **not yet** proven.
- The current Advanced AI species-index gate remains; replacing it with declarative capabilities is a later checkpoint.
- A GitHub Actions pass does not establish Android runtime correctness, battery/performance profiling, or signed build status.

## Coordinated follow-up checkpoints (owner-controlled order)

- **Checkpoint 02:** Canonical adapters for Playground, private owner conversations, native background snapshots and social contacts; scope isolation, stable import/dedup, no cloud leaks.
- **Checkpoint 03:** Universal AI capability descriptors for existing/future species, unified context assembler and safe retrieval for Mini/Advanced/Background paths, game knowledge catalog.
- **Checkpoint 04:** Long-horizon consolidation/index budgets, stable archive migration and encryption, recovery and corruption handling.
- **Checkpoint 05:** Multiyear simulation, stress/restarts, offline Android + real GGUF model QA, privacy audit, final regression and review.

Each checkpoint ends with a commit diff, tests and explicit open findings. No implicit approval or promotion to release.
