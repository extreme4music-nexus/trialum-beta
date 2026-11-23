# v47 server patch — staging note

**Not implemented against the live server yet. Do not deploy this directory.**

The live server's current source and commit have not been retrieved. The Webmin terminal session was closed during inspection, and the existing `server-patch/v46` is not a valid starting point for v47 because it requires Age Signals and Play Integrity eligibility.

## Required v47 behavior

- Age Signals remains dormant. No server endpoint may require an Age Signals result to use the 13+ social baseline.
- The server remains authoritative for social consent/version, authentication, friendship, block/report, room/visit authorization, rate limits, and abuse controls.
- Preset messages are accepted by stable preset ID only. Custom text is rejected on both REST and WebSocket paths before relay or persistence, including for older clients and retried queued messages.
- Pet interactions in shared spaces remain available. A player's free-form prompt or private local pet-chat content must not be forwarded as another player's message.
- Social profile records remain pseudonymous. Do not add Google email, date of birth, exact age, or location fields.
- Parent/guardian pairing is a future, separately reviewed stage. A pairing code is not proof of legal parenthood or adult identity.

## Required import procedure

1. Read the live repository path and current `git status` / commit through the owner's authenticated server session.
2. Export a source snapshot excluding `.env`, mounted secrets, backups, database files, logs, SSH materials, and private keys.
3. Record source commit, schema revision, active container version, and current feature flags.
4. Import into this repository as a source baseline on a dedicated branch; retain the original history or document the snapshot hash.
5. Implement the v47 patch as a minimal diff against that exact baseline. Add migrations and rollback scripts only after reviewing the live schema.
6. Review and test locally/staging before proposing deployment. Do not modify production configuration or apply a migration from this staging repository.

## Release gate

This patch is not ready until the exact live server source is imported, REST and WebSocket free-text rejection is verified, all preserved social paths are checked, and an owner-reviewed backup/rollback/deployment plan exists.
