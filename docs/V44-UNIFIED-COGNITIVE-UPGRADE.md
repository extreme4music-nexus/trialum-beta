# V44 — Unified Cognitive Memory: coordinated architecture upgrade

> Working branch: `feature/v44-unified-cognitive-memory`  
> Baseline: `fix/v44-mnemos-cognitive-integration` @ `479c0e7a413ff7d57a7325c496d996b0df085b4d`  
> Release branch remains unchanged. Each checkpoint requires owner review before continuing.

## Design contract (applies to every present and future pet)

- Every pet receives a private cognitive identity at creation or non-destructive load of an older world, independent of species index or availability of an AI model.
- Events are local and specific to one pet. Remote/replayed inputs must have stable event IDs; repeats are idempotent and conflicting uses of an ID are rejected.
- Original observed timestamps, dates and provenance are retained. Do not fabricate missing historical conversations or events when migrating old worlds.
- AI generation is never required to capture game events. Local cognitive data must not enter the normal cloud/plain JSON export.
- **Memory is universal; conversational AI is an optional unlocked capability.** Every pet—primitive, evolved, current or future—records and consolidates its own memories without any LLM, account, installation or AI consent. Unlocking AI at the defined evolution/research gate grants *communication through a compatible LLM adapter*; it neither creates memory nor replaces the existing memory store.
- **Model/provider agnostic cognition.** Mini, Advanced, Background and future supported LLM runtimes must use the same pet-owned memory retrieval interface, within their own context budgets and visibility permissions. Switching/removing an LLM must never reset, fork or erase the pet's memory. Model output is optional and must not be confused with verified game facts.
- **Unlocked != installed != consented.** Evolution capability, actual model availability, and player consent are independent checks. No AI availability must be assumed merely because a pet is evolved.
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

## Checkpoint 02 — Lifetime contextual memory and periodic semantic consolidation

**Scope implemented on the same coordinated feature branch (owner review required):**

1. `js/cognitive-context.js` implements durable, per-pet, topic-only playground context. Semantically relevant concepts, companion display names (sanitized), activity moments and provenance-aware native import metadata persist without a time-to-live.
2. Deterministic rolling resolution, **not deletion**: full daily summaries remain recent for 45 calendar days; older daily observations fold into monthly summaries; months older than 24 months fold into annual summaries. Historical years are never time-expired. Fixed topic and name vocabularies prevent private raw speech, links, tokens or transcripts from becoming long-lived memory.
3. `js/cognitive-memory.js` archives non-milestone game event payloads older than 45 days, maintaining replay receipts, lifetime cumulative counters and authoritative last occurrences. Birth and evolutionary milestones stay exact. Old game-day buckets aggregate into 30-game-day periods and then 360-game-day years.
4. The V2 `archivedReceipts` record uses *non-cryptographic local checksums*. Its purpose is compact accidental-replay detection, not adversarial message authenticity. For arbitrary novel event IDs the receipt map still grows with lifetime unique IDs; there is no truthful guarantee of constant-size memory without potentially losing information.
5. `js/playground-memory.js` remains a short-term compatibility cache and now writes directly to the durable contextual store. Existing cache data migrates once without inventing missing historical days. Private/local playground topics never enter the public/shared model context. User-requested deletion clears both cache and lifelong playground context.
6. `js/playground-ai.js` retrieves contextual history using the relevant prompt and private/public scope. Advanced local AI also retrieves lifelong contextual summaries using `js/mnemos-context.js`. Previously duplicated private AI topic counting in `advanced-intelligence.js` was removed.
7. `BackgroundPetMemory.kt` now keeps recent daily observations and rolls old native records into monthly/yearly on-device archives instead of discarding them. A compaction-only snapshot advances the stream revision for reliable JS reimport.
8. Native-to-JS import uses per-stream month/year watermarks to account for already-imported daily data and avoid duplicate semantic moments. The private encrypted export synchronizes native background memory first, as does app initialization. Plain/cloud exports still exclude private cognitive data.
9. `tests/cognitive-consolidation-v44.test.cjs` exercises historical multi-year recall, public/private separation, V1 migration, native daily/month/year replay, explicit deletion, full JSON round-trip, large event compression and archived replay IDs. Dedicated CI now also checks Android Kotlin compilation **without APK generation or signing**.

**Important caveats remaining:** Android compilation must be confirmed by the workflow, and an emulator/device test remains outstanding. Daily native summaries still retain a preexisting 99-moment counter cap; future work must raise/normalize that counter without breaking older imports. The 20 MB encrypted archive size ceiling may become a constraint in extreme simulated lifetimes; measure and address in archive/performance checkpoint. Exact original sentence-level transcripts are intentionally not promised or stored; only factual and semantic summaries persist. Contextual archives do not yet have a separately tested encrypted restoration path across a true Android installation.

**Next owner-controlled checkpoint:** declarative AI eligibility for future species, one safe scoped context assembler for every model tier and background route, and game knowledge retrieval. No merge to the release branch.

## Checkpoint 03 — Universal memory, unlocked LLM communication and source-backed knowledge

**Implementation submitted for owner review on this same branch:**

1. **Universal memory is independent of LLMs.** Every pet starts with a local V2 cognitive identity and accumulates/consolidates observations without model installation, account, advanced species status or AI conversation consent. Opting out of conversation or changing a local model tier does not delete, fork or reset `pet.cognitiveMemory`.
2. **Declarative AI communication, not `species >= N`.** Existing evolved species declare `aiAbilities.mini` or `aiAbilities.advanced` with explicit per-pet-level and research-laboratory requirements in authoritative species definitions (`progression.js`, `longplay.js`). `pet-ai-capabilities.js` resolves and checks these; procedurally researched descendants inherit eligible capabilities from `parentSpecies` unless an explicit ability declaration overrides them. Future species can declare capabilities independently of their numeric index. Unlock does **not** mean model installed or user consented.
3. **One provider-neutral memory context schema.** `ai-context.js` assembles bounded JSON from authoritative pet state, lifelong semantic context, topic/peer memory, live game knowledge and relevant in-session text. It has explicit private/room-scoped visibility. This assembler serves direct Mini chat via `longplay-ui.js`, Mini playground via `playground-ai.js` and Advanced via the compatibility `mnemos-context.js` wrapper.
4. **Native Background AI counterpart.** `BackgroundPetMemory.contextForModel` returns only local public/shared semantic archives (no owner/private speech). `TrialumBackgroundSpeechService` constructs the same bounded `memories`/room-turns contract with in-memory JSON arrays. Kotlin cannot invoke the WebView assembler while its WebView is closed; the native adapter implements the matching privacy and format policy instead. No private source content is relayed to the server.
5. `ModelRuntime.kt` verifies structured JSON and per-tier size **before inference**, rather than truncating serialized JSON into invalid input. The model system prompt explicitly treats memory and game knowledge as untrusted factual data.
6. **Searchable game catalog.** `game-knowledge.js` derives versioned entries from current engine species (including newly registered researched forms), evolution phases, plants, biomes, foods, research fields and lab tiers, material recipes, technology, lineage requirements and playground toys, plus approved static gameplay rules and navigation. Source coverage and private/public behavior have regression tests.
7. Existing Mini/Advanced lock UI now describes **communication** rather than falsely implying memory appears only with AI. The stable memory owner remains the pet; current installed/local GGUF models are interchangeable consumers, not memory stores.

**Explicit limitations and later checks:**
- This is *model-neutral memory architecture*, not a claim that every arbitrary third-party LLM is installable. Current UI/native runtime supports its existing approved local model tiers; additional LLM backends need compatible adapters.
- Memory retrieval is deterministic taxonomy/keyword based; advanced semantic embedding search, nuanced multilingual ranking and tokenizer-accurate full-prompt budgets are later optimization/audit work.
- The native Background service does not have a live WebView, so background context has local shared semantic history and room turns but cannot assert current food/energy/habitat state unless independently verified.
- Long-lived private owner preferences/significant-event provenance and some social history details still need deeper coverage, redaction and privacy review. The full long-horizon encrypted restore, extreme storage constraints and Android on-device runtime QA remain part of checkpoints 04 and 05.
- No signed test APK, app version bump, or release branch merge without approval.

**Verification gate:** `.github/workflows/v44-unified-cognitive-memory.yml` now checks core/longplay regression, future species capability inheritance, model switch isolation, scoped Mini/Advanced context, source-backed catalog coverage and Kotlin compile-only. Check the final commit's CI result; passing a previous commit is not sufficient.

## Checkpoint 04 — Long-horizon memory integrity, compact replay index and portable encrypted recovery

**Implementation delivered on the coordinated feature branch; owner review required:**

1. `js/cognitive-memory.js`: serial `event:N` replay receipts are stored in bounded individual checksum *runs* (`receiptRuns`) instead of a JSON key-value entry for every archived local event. The exact digest of each archived event remains addressable by its original ID. Nonsequential external IDs continue to use individually keyed `archivedReceipts`. Existing V2 archived receipt maps migrate into runs on hydration, with no invented or dropped historical facts; overlaps are rejected.
2. `js/cognitive-context.js`, `js/playground-memory.js` and Android `BackgroundPetMemory.kt`: remove legacy 99-moment daily counter saturation, while retaining a defensive 1-billion moment ceiling per summary. The daily/month/year lifelong semantic consolidation remains in force; **age alone never deletes meaningful contextual summaries**.
3. `js/encrypted-archive.js`: version 2 uses optional gzip **before AES-256-GCM**, with authenticated codec metadata, explicit inflated-size checks and a streaming bounded decompressor. Up to 64 MiB of private payload can be archived, with an encrypted JSON envelope cap of 96 MiB. Version 1 PBKDF2/AES-GCM archives remain readable without re-encryption. V2 falls back to uncompressed encrypted data when browser compression support is absent or savings are negligible.
4. `TrialumBackupVault.kt` and `MainActivity.kt`: support V1/V2 encrypted envelope export and import with a separate 96 MiB ciphertext cap. Ordinary plaintext world/rescue files retain the earlier 20 MiB safety limit. Native ciphertext staging still uses app-private filesystem storage and checksum-verified export, never the public cloud.
5. `js/memory-integrity.js`: inspect detached private-world copies before encrypted export and before restoring. Enforce unique pet IDs, matching schema and pet identity, valid contextual bucket shapes, replay checksums/runs, social index limits and overall private-world size. Reject corrupted or oversized archives **before any local write**; no migration synthesizes unobserved earlier events.
6. `js/private-restore.js` and `js/app.js`: snapshot the existing world and conversation history first; apply both stores and confirm results. If either step fails, explicitly check both compensating rollbacks. An incomplete rollback is escalated as `restore_rollback_failed`, never reported as success. The welcome UI is repaired when rollback restores an empty world.
7. Regression suite `tests/private-archive-v44.test.cjs` covers compressed roundtrip, authenticated tamper rejection, V1 archive compatibility, strict memory preflight and unchanged source on failure, exactly replayable packed event receipts, daily counters beyond 99, successful compensating rollback and explicit rollback failure. The V44 GitHub Actions gate includes this test and Android Kotlin compile-only.

**Limits and safety assertions (not hidden):**
- IndexedDB, localStorage and friend-conversation stores are distinct transactional boundaries. *Cross-store atomicity cannot honestly be guaranteed*; this checkpoint provides up-front full validation and verified compensating rollback. The real-device crash-window recovery and transactional native journal belong to checkpoint 05.
- Time-lifetime is unbounded, but physical device storage is finite. Lossless deduplication for arbitrary externally supplied IDs necessarily grows with unique archived inputs. Serial digest packing and gzip reduce overhead; they do not mathematically guarantee constant storage forever. The preflight quota is a controlled safety stop, never silent erasure of user memories.
- V2 archives are encrypted end-to-end locally, but the recovery code must be kept by the player. Losing it means the archive cannot be recovered. Existing plaintext cloud/JSON exports are intentionally stripped of private cognitive data.
- The total 64 MiB private payload limit requires long-lived roster and model-performance measurement on a device. Android signed APK / real device roundtrips, process-death during import, quota exhaustion, hostile archives, backup migration across Android versions, battery and privacy profiling are **not** claimed by these automated unit tests.
- Multiple independently stored raw owner conversations, friend messages and privacy consent need a final security pass in checkpoint 05.

**Next checkpoint, owner-controlled:** multiyear/large-roster stress and memory-size profiles, Android device smoke and model inference, cross-storage process death/recovery, permissions/security audit, version-gate review and release handoff. No V44 release merge or Android signed build without explicit approval.
