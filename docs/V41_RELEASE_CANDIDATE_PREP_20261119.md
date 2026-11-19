# Trialum v41 / 1.2 candidate preparation

## Provenance

- Play-installed baseline: `i18n/v40-complete-locales-20261119` at `e0429785e95d051d1d04bf191be799dbff74b5f5` (v40, code 40, 1.1.1).
- v39 source carried in that baseline: `feature/v39-first-run-social-consent-20261118` at `eb8d2e7d1ec41b301175295424b73fe8aec687c4`.
- Parallel v40 source merged into this candidate: `feature/lwc-v40-classic-food-warehouse-20261117` at `d592777b10ba08b9a578c343569d31cc9393f94e`.
- v38 English-copy fixes included from `fix/lwc-v38-english-copy-20261117` at `20293dc6ec32ea5a5d44d1bdfe830a11c89b843d`.
- Candidate identity: `com.trialum.ziivaiskra`, Android `versionCode 41`, `versionName 1.2`.
- This is a separate candidate branch. It does not change the Play-installed branch or publish a release.

## Included work

- Retains the v39 first-run agreement, explicit Friends consent, age-signal gate, privacy guard, local conversation history and encrypted/local backup work.
- Adds the parallel v40 Classic Food Warehouse and food supply chain: canonical food stock is moved among rack/cold/packing zones and pet-home reserves; feeding consumes the selected pet's reserve.
- Carries the v38 English Android notices and English notification copy forward.
- Refreshes all 17 supported locale catalogs to 913 UI strings and 1,104 dynamic word mappings, including the v40 warehouse text and v38 English-copy keys.
- Release-derived variants use R8/resource shrinking and FULL native symbols. The exact `internalBeta/mapping.txt` and `native-debug-symbols.zip` are retained alongside the unsigned AAB in the matching CI artifact.
- Phone QA uses only the distinct `.qa41` package and an ephemeral runner-generated signature. Its signing key is deleted and never uploaded. It cannot replace the Play package or inherit its app data.
- Official/internalBeta AAB remains unsigned in CI. Owner signing and Play Console upload wait for phone QA approval.

## What's new

See `PLAY_STORE_WHATS_NEW_V41.txt`.

## CI outputs

- `Trialum-v41-random-signed-phone-QA`: disposable `.qa41` APK, certificate report and SHA-256.
- `Trialum-v41-internal-beta-unsigned-AAB-and-diagnostics`: internal-beta AAB, matching R8 mapping and FULL native symbols.
- Artifact retention: 7 days.

## Device validation still required

Owner must install the `.qa41` APK and confirm Classic Food Warehouse movements, per-pet home reserves, feeding and save/restore. Play Games and Firebase push are disabled in the isolated random-signed package because its package/signing identity is not registered. The official Play package identities, signer, and user data are not touched.
