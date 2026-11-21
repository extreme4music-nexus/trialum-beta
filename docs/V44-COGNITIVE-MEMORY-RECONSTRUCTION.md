# Trialum Beta V44 / 1.3 — Persistent Cognitive Memory
Status: architecture baseline; implementation and release pending.
Base: release/lwc-v43-1.2-privacy-links-20261120 @ 8e13c4e407a9b7787e7481c8d7085eaa382c49dc (Fix Privacy Policy and account deletion links).
Target: versionCode 44 / versionName 1.3; do not publish or sign until approved.

## V43 audit / handoff
- js/playground-dialogue-session.js: RAM ledger, 36 turns / 90 minutes; recent context only.
- js/playground-memory.js: per-pet thematic memories, 45-day expiry, 60 records; limited coarse recall.
- js/playground-ai.js: bounded 1450-character context, room turns and recent thematic memory.
- js/advanced-intelligence.js: 8 memory strings, 12 chat turns, 6 supplied to model; 2200-character slicing risks invalid JSON.
- ModelRuntime.kt: mini 1024 / advanced 2048 token context, runtime caps; no verified persistent model latent state.
- TrialumBackgroundSpeechService.kt: recent room turns; unify capture and retrieval across foreground/background.
- Preserve V43 privacy fixes, game behavior, unlock gates and backup compatibility. Audit actual save/export/import and native bridge before editing.

## Nonnegotiable requirements
Memory belongs to every pet from creation, including pets without AI. No model inference required to record game events. Lifetime contextual/semantic memory: remember what happened and what topics meant, not necessarily verbatim conversations. No TTL on significant memories. Local-only; no cloud sync, remote telemetry or shared-room transmission of private memory. Full versioned JSON backup/restore, preferably encrypted envelope with user-controlled portable recovery (not device-only key); explicit warning if plaintext export is supported. Exclude cognitive data from ordinary cloud saves. User controls inspect/delete/reset. Never fabricate missing historical events.

## Architecture
One engine-owned event pipeline with stable pet IDs, unique event IDs, timestamps, source and schema version. Persist atomically; deduplicate foreground/native background events and reconcile clocks. Local storage adapter (evaluate IndexedDB/native SQLite based on existing runtime), canonical portable JSON serialization independent of backend.
1. Self/autobiographical: birth timestamp, evolution, meals with food/quantity, baths, play, locations, activities, milestones, daily summaries, cumulative counters. Current hunger/energy/joy/bond derived from authoritative game state; age computed from birth date. Track last meal/bath/activity explicitly. Unknown legacy fields remain unknown.
2. Owner relationship: private conversation topics, semantic summaries, significant shared events, preferences with provenance and confidence. No mandatory verbatim retention. Store observed facts separately from inferred preferences; no sensitive profiling or secrets. Never expose owner context to other pets.
3. Social: stable scoped peer ID, display name history, species if visible, first/last encounter, place, shared activities/topics, counts, relationship/affinity; distinguish same-owner pets and external peers. Local-only observations; no remote private data. Follow existing multiplayer permissions.
4. Latent associative: per-pet weighted topic/entity graph, recency, salience, reinforcement, emotional association and optional compact embeddings. Maintain without AI using deterministic events and multilingual topic extraction; model-assisted summarization optional, never required for event capture. This is external semantic/associative memory, not persistent neural hidden state. Evaluate native KV/adapters separately; not a dependency.
5. Shared game knowledge: versioned searchable catalog generated from authoritative game definitions covering game rules, items, food, evolution, lab, gardens, economy, inventory, minigames, UI/navigation and unlocks. No secrets/admin internals. Coverage manifest and tests against source definitions; retrieve relevant subset, never inject whole catalog.
6. Live awareness: read-only self/world snapshots including location, visible nearby pets, own roster, available activities and authoritative last-event data. Semantic scene rather than screenshots. No access to unauthorized players' state.
7. Initiative: deterministic optional suggestions based on social affinity, time since play, current needs and cooldown; e.g. ask owner to visit playground with a known pet. User confirms actions; no autonomous spending, messaging or navigation. Suppress manipulative or repetitive prompts.

## Data contract
PetMemoryV1: schemaVersion, petId, birthAt, self{lastEvents, dailySummaries, milestones, counters}, owner{topics, significantEvents}, social{peers}, associative{nodes, edges}, eventLedger, migrationMetadata. Separate authoritative live state from memory. Each observation has timestamp, source, eventId and visibility. Preserve significant facts permanently until explicit deletion; compact repeated events into dated summaries, never erase last-event fields or unique milestones. Use local calendar/timezone to answer yesterday. Keep storage budget measurable, indexes rebuildable and compaction deterministic.
Backup: versioned JSON manifest + per-pet cognitive payload; validate size/schema/IDs, sanitize untrusted strings, reject corrupt archives without overwriting current state, transactional restore, duplicate handling, legacy migration and round-trip equality for semantic data. No public export by default.

## Retrieval / AI tiers
Single scope-aware context assembler used for private, playground and native background paths. Collect authoritative state first, then intent-relevant knowledge and memory. Owner memory only in private scope; public scope uses self-safe facts and observed social memories. Treat memory text as data, not instructions. Serialize valid structured context and use tokenizer-aware budgets including system prompt, user message and output reserve; never slice serialized JSON. Mini: essential facts + 1–2 relevant records, advanced: more history, associations and knowledge; actual budgets benchmark against available models. Both use same underlying memory. No-AI UI can expose summaries and deterministic status/initiative. Provide factual fallback for exact stats; unknown stays unknown.

## Delivery phases / gates
0. Freeze baseline, document paths, inspect save lifecycle, backup transport, native bridge, game event hooks and test harness.
1. Versioned storage, identity, event ingestion, migration and backup round-trip; tests without AI.
2. Self-awareness and game knowledge catalog, coverage report and exact state queries.
3. Owner topic memory and social encounters across all playground modes; privacy isolation tests.
4. Association engine, deterministic consolidation and optional initiative.
5. Integrate all model tiers and foreground/background paths; token budget, multilingual recall and anti-injection tests.
6. Regression, simulated lifetime, large roster, offline, process death, restart, corrupt backup, duplicate events, upgrade/downgrade handling, Android RAM/latency/battery profiling and privacy audit.
7. Update actual version metadata after locating canonical sources; signed test build only after explicit approval, no Play publication.

## Acceptance
A pet without AI records meals, baths, age, play and social history, later recalls it with either model. Recall yesterday and months-old meaningful topics after restart and backup/restore. Two pets cannot read each other's private memories. Public context excludes owner data. Same peer renamed remains recognizable. No invented past or stale current stats. All supported game mechanics indexed. Existing V43 saves migrate without losing game progress. No cloud network transmission of cognitive payload. Test report and changelog required before release.

## Change log
2026-11-22: V44 branch created from exact V43 baseline; architecture, privacy rules, migration and acceptance plan documented. No runtime implementation or release yet.
