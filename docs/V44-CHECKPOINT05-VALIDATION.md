# Trialum V44 — Checkpoint 05: validation evidence and device acceptance

> Source: `feature/v44-unified-cognitive-memory`  
> Single coordinated upgrade; Draft PR #12; no merge, signed APK or Play submission.  
> Reference run (JS/stress): [GitHub Actions 45035714676](https://github.com/extreme4music-nexus/trialum-beta/actions/runs/45035714676).  
> These measurements are **GitHub-hosted Node 22 simulations**, not a physical Android benchmark.

## Acceptance contract

1. **Every pet has independent, lifelong semantic memory**, from its creation, even if no local model or AI consent exists.
2. **AI conversation is a separately unlocked ability**, not a memory prerequisite. Changing supported model tiers must not reset memory.
3. Day → month → year consolidation changes resolution, **not the existence of meaningful historical topics or milestone events**.
4. Old event payloads can be compacted while exact replay/collision detection remains available. Distinct external ID receipts cannot be made constant-size without loss.
5. Public/shared-room AI must not receive the owner's private topics, contacts, local-only activities, bond or habitat identifiers.
6. Private archive restoring must reject malformed data before any write, preserve V1 encrypted archives and never silently overwrite a good local state after an interrupted restore.

## Automated results

| Scenario | Measured result | Gate |
|---|---|---|
| Twenty calendar years of one pet | 7,306 daily observations; 583,539 → 12,384 JSON bytes; historical recall preserved (97.88% reduction) | PASS |
| Independent pet roster | 1,000 pets, 64,000 aggregated contextual moments and 12,000 replay receipts; 3,185,035 serialized bytes (~3,185 bytes/pet) | PASS |
| Large gameplay event ledger | 30,000 events; 5,540,003 → 481,521 JSON bytes (~91.31% reduction); duplicate/collision checks preserved | PASS |
| Encrypted migration of 1,000 pets | 2,545,182 bytes original payload → 80,728 bytes GZIP+AES-GCM V2 envelope; decrypt, individual memory retrieval and portable-cloud redaction verified | PASS |
| Interrupted world + conversation restore | Persistent IndexedDB write-ahead journal, simulated restart mid-write, retry after conversation-store failure, damaged journal rejection, unavailable primary store guard | PASS (simulated) |
| Private conversation fallback | Primary IndexedDB must succeed; obsolete localStorage threads must be erased or restore fails | PASS (simulated) |
| Hostile private data | Duplicate pet IDs, impossible dates, forged native period watermarks and replay index corruption refused | PASS |
| Scoped model context | Owner relationship identifiers and owner-only topics absent from public/shared Mini context | PASS |

At commit `a50cb5a27798820a1e6e328391d1360346774104`, the dedicated longevity and crash-recovery audit reported **15 passed, 0 failed**. The existing V44 JS suite and the Kotlin compile job run separately; the CI run for the **final head** must be examined before release.

### Threat-model and code review observations

- Regular JSON / Play Games snapshots strip `cognitiveMemory`, owner `chatHistory`, playground memory, private AI memory and local friend histories. Full private migration is deliberately AES-GCM encrypted.
- Private local stores are app-scoped IndexedDB and local conversation data. They are **not** themselves application-level encrypted; on-device OS sandbox/lockscreen protections are separate from the exported encrypted archive.
- The write-ahead journal retains the previous world and friend history in app-private IndexedDB until a complete restore/rollback. A short synchronous pending marker stops a temporarily unavailable IndexedDB from allowing an unsafe local fallback.
- Recovery after an interrupted restore is deliberately conservative: an uncommitted transaction returns to the **previous** complete state, even if the incoming world was already written. If recovery cannot finish, editing/new-game operations are blocked.
- Background AI invokes an **on-device** local model. The optional shared-room WSS service can send *generated, voluntarily shared speech* to other players; it must never transmit the internal owner memory context or the private archive. Real network inspection is still required.
- Models download from configured pinned HTTPS sources on demand. LLM model files are not embedded in private memory exports.
- The native Android manifest disables ordinary Android app backup (`android:allowBackup="false"`) and cleartext HTTP traffic (`android:usesCleartextTraffic="false"`); it declares the background service non-exported.
- No zero-storage-growth guarantee: receipt digests for unique event IDs, meaningful milestones, and truly new yearly experiences persist. A 64 MiB **unencrypted private world** safety ceiling fails closed instead of silently discarding memories.
- The compression ratio is scenario-specific. The tests are reproducible but do **not** establish identical reductions for every real-world user.

## Device-only acceptance — still required, not claimed

Do **not** install over the normal Trialum or its release signing identity. Use a separate QA application ID and a disposable, user-approved Android test build. Back up existing local data first.

| Gate | On-device procedure | Expected evidence |
|---|---|---|
| Fresh install, every pet memory | Create primitive pet; feed/play; verify memory before AI is unlocked | Persisted memory on app restart |
| Unlock and model swap | Develop to Mini/Advanced; consent; install each supported local GGUF; converse, disable, change models | Same pet memories and provenance across model changes |
| Private/shared isolation | Create local-only topic and peer; enter shared playground/Background AI | No private topic/peer/owner identifiers in public context or outgoing payload |
| 45+ day background history | Import controlled historic daily/monthly/yearly test records; run background dialogue | Historical recall, stable idempotent counters; no 99-moment saturation |
| Real process death during restore | In **isolated QA build**, inject deterministic stop after world commit and before friend-history commit; relaunch | Write-ahead recovery restores original world AND friend messages; journal cleared |
| Failure when storage is full | Constrain test-app storage; attempt export and restore; relaunch | Clear errors, no misleading success, no silent loss |
| Encrypted V1/V2 cross-device migration | Export V2, test wrong key/damaged data, then restore on separate QA install; also restore known V1 fixture | Correct history on successful decrypt; no change on invalid archive |
| Runtime performance | Log CPU/RAM, model inference time and thermal/battery drain during idle, Mini, Advanced, Background session | Comparable measurements with device details, no out-of-memory or stuck foreground service |
| Security/privacy verification | Inspect HTTPS/WSS traffic metadata and app logs, explicitly opt out, deny permissions, repeat after restart | No raw owner memory or recovery code in network traffic/logs; services respect consent |

**Needed for sign-off:** record Android version, device model, test package/variant, test date, branch commit, redacted logs, data-size and battery/memory metrics, and results for each row. Do not upload a player's private recovery code or raw private conversations to issues or CI artifacts.

## Decision state

- **Architecture and host simulation:** implemented and passing on the checked GitHub revision.
- **Android Kotlin compile:** a compile-only CI gate, not model-inference or device runtime proof.
- **Physical device, local GGUF runtime, force-stop race, actual battery and network inspection:** **NOT VERIFIED** from Chat mode.
- **Release:** BLOCKED pending owner review and the Android device matrix. No signing, no publication, no merge into the V44 release branch.

The authoritative architecture journal is [V44-UNIFIED-COGNITIVE-UPGRADE.md](V44-UNIFIED-COGNITIVE-UPGRADE.md).
