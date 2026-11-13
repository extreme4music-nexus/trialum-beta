# Public beta publication checklist — owner approval required

- [ ] A beta is finalized and accepted by the owner.
- [ ] Version and private source commit SHA are pinned.
- [ ] Existing MIT license and historical author/contributor grants reviewed.
- [ ] First-party rights verified; third-party dependencies and resources inventoried.
- [ ] Models, fonts, art, music and other assets cleared for public distribution.
- [ ] Fresh source snapshot prepared WITHOUT private .git history.
- [ ] Private infrastructure, backup data and unfinished features excluded.
- [ ] Offline pre-push secrets scan performed on full snapshot (including binaries).
- [ ] Manual security, privacy and permissions review completed.
- [ ] No real user / tester data included.
- [ ] Two-device networking, offline recovery and safe pet return reviewed.
- [ ] Local backup / restore migration tested.
- [ ] Macedonian and English UI tested; accessibility regressions checked.
- [ ] Unsigned Android build and tests pass from exact snapshot.
- [ ] App identifier, official signing and Play Console ownership preserved.
- [ ] No Android signing keys or Play credentials placed in public CI.
- [ ] Release manifest includes exact source commit and owner approvals.
- [ ] Owner inspects final staged files and explicitly authorizes public push.
- [ ] Published version, source commit and release notes match owner decision.

## Manifest example (not an actual release)

Create .trialum-release.json ONLY for an approved source snapshot:

{
  "version": "1.6.0-beta.1",
  "source_commit": "0000000000000000000000000000000000000000",
  "owner_approved": true,
  "license_review_complete": true,
  "secret_scan_complete": true,
  "qa_acceptance_complete": true
}

Replace illustrative values with real, verified approval and exact commit.
A manifest file is evidence to check, not proof by itself.
