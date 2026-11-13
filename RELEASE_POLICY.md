# Trialum public beta release policy

## Two independent repositories

PRIVATE: extreme4music-nexus/Trialum
- Main development, Living World changes, branches, private tests and QA.
- Confidential infrastructure, test data and working artifacts stay private.

PUBLIC: extreme4music-nexus/trialum-beta
- Only complete, explicitly owner-approved beta source snapshots.
- No mirror of the private Git commit history, branches or working notes.
- No automatic sync from private main to public main.

## Required release gates

1. Owner explicitly approves the beta version AND exact private source SHA.
2. Review existing MIT grants in the private repository; confirm ownership,
   previous license grants, third-party dependencies, models and assets.
   Obtain qualified legal advice before assuming proprietary relicensing.
3. Produce a fresh, allowlisted export without any original .git history.
4. Exclude infrastructure configuration, real user data, credentials,
   Android signing material, private logs and unfinished features.
5. Run pre-publication secret scanning and human security/privacy review.
6. Confirm release-quality Android tests, backup/restore compatibility,
   offline/online behavior and owner-device acceptance.
7. Include an honest release manifest identifying version, SHA and approval.
8. Inspect the EXACT public diff before any push; create beta tag only
   after publication checks pass.
9. Local signing only: never send official signing keys to GitHub Actions.

## Automation

Public GitHub Actions may test or compile unsigned source builds after
publication; it must NEVER fetch private source, sign official Android apps,
deploy servers or publish code automatically on a private-repo push.

A passing CI workflow does not equal permission to publish.
