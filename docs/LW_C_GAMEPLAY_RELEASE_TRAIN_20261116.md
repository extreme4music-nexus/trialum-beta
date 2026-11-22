# LW-C gameplay release train (2026-11-16)

Status: staging plan, not a release approval. This branch starts from the public LW-C source snapshot release/lw-c-1.6-LW-dev.12 at 9d2511fd4e82e9404b217ff04ca580f45ae1667c. The clean main branch is intentionally unchanged. Each gameplay package is isolated in a follow-up branch and must retain its own source provenance and regression tests.

## Operating rules
- Integrate only mechanics and Classic UI already implemented in the private Trialum development source. Do not design replacement mechanics or alter LW-D.
- Do not merge, publish, assign a Play version code, or call a candidate beta-ready until the owner and assistant have compared the exact source, completed agreed QA, and recorded the owner's device result.
- Use GitHub Actions for source tests and Android builds. Build outputs are unsigned. Official signing remains local; never put signing keys, passwords, private server credentials, or private Git history in either public repository.
- Keep existing package identities, Play Games configuration, saves, social/FCM behavior, and data migration intact.
- Version code is assigned only after checking the current Play Console track. Existing snapshot documents disagree about v37/v38 history; this train does not guess or reserve a code.

## Package sequence
| Package | Prepared source | Scope | State |
|---|---|---|---|
| GP-01 | LW-D L3.9, exact source 7466c38c0f863cf4299fbdf6263f823c60b2608d, original Trialum PR #73 | Canonical plant lifecycle and its existing Classic PhytoLab/greenhouse UI | First isolated Classic integration branch; see its handoff document |
| GP-02 | LW-D S5 warehouse, PR #82 head ba405fa0eb33f96961d49048f1dcde399f7cccbb | Existing inventory/warehouse model | Not yet staged. S5's zone transfer controls are currently in 3D prototype only; no Classic UI is claimed |
| GP-03 | LW-D S6 personal reserves, exact source ee05d2555fc00920edd9c7f4872829af51ab2e69, PR #83 | Existing food supply, return-to-rack, and feeding flow in Classic Pet Home | Not yet staged; preserve its dependency on the S5 inventory model and document the absent Classic zone-transfer UI |
| GP-04 | Existing LW-C public baseline source 04457df48b9c012f8667504b935a7ca501d13f07 | Contextual Living Conversations | Already represented in the LW-C snapshot; compare the exact candidate before making another package |
| GP-05+ | Future owner-approved LW-D source only | Later gameplay increments | Create one branch per actual mechanic; do not stage 3D-only shells as Classic gameplay |

The staged GP-01 branch is based on the current public LW-C release snapshot, not LW-C main and not a LW-D branch. Its source is a selective port of the already implemented original-engine changes; it does not copy the LW-D prototype or 3D UI.

## Candidate gate for every package
1. Record base SHA, source SHA, changed file list, migration behavior, and explicit non-goals.
2. Verify the Classic entry points and preserved social, AI, Play Games, and save/restore integrations.
3. Run the package-specific Node regression tests and existing beta contract in GitHub Actions; then build unsigned Android artifacts in the separate public Android Build repository.
4. Compare the Actions source SHA and artifact metadata; only then hand the APK to the owner for local signing and device QA.
5. Record owner PASS/FAIL and issues. Fix a bug in this package and relay the exact fix/source to the LW-D development branch. No Play Console upload or rollout happens automatically.

## Android Build repository
The corresponding build-stage branch must contain a minimal, clean public source snapshot and the same package documentation, based only on public beta source. It must keep the existing unsigned-only workflow and source-SHA acknowledgement gate. This plan does not copy private repository history or introduce any credentials.
