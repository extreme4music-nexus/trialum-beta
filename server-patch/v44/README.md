# Trialum v44 — shared playground store, server rollout package

This folder is a **staged patch**, not a deployed backend. The original `Trialum` main repository and its live NAS/server were **not modified**.

## Authoritative balance and inventory design
- Existing PostgreSQL `shared_playground_state.points` stays unchanged for backwards compatibility. The v44 API adds `sharedCredits` as the exact same integer, not a second wallet. **Personal earned credits in game storage are separate and cannot be spent in the shared playground.**
- Existing purchased/initial toys are all preserved; the new `playground_toys.placed` column defaults to true for all existing rows. Unplacing a toy removes it from the scene but never removes its ownership or refunds spent credits.
- Up to `min(6, 2 + room tier)` toys may be placed; the owner can buy all catalog toys and swap placed selections without paying twice.
- New server-authenticated `GET /v1/shared/catalog` publishes the available IDs and costs.
- Current `GET /v1/shared/status` gains `sharedShopEnabled=true`. Older deployments return false/missing and clients **fail closed** on new purchase/placement APIs.
- `GET /v1/shared/rooms/:roomId/snapshot` returns `toys` (currently placed), `ownedToys` (permanent inventory), and `sharedCredits` (exact existing points, with legacy `points` preserved).
- Existing `POST /v1/shared/rooms/:roomId/upgrade` with `kind=toy`, server-price-verified and transactionally idempotent `eventKey`, now buys from the extended catalog. If there is no free scene slot, the purchased toy goes into inventory (`placed=false`).
- `POST /v1/shared/rooms/:roomId/placement` with `{toyId,placed:true|false}` requires the verified **room owner**, uses a transaction and row locks, checks inventory and capacity, updates server version and emits room-change WSS. No debit/refund occurs and repeat requests are idempotent.
- Server daily room activity checks `placed=true`: stored toys cannot generate communal credits.
- Any direct forged credit transfer, client-only placement, member-only unplace, unknown item, or currency conversion is rejected. The existing room membership and consent checks remain intact.
- Existing `server/src/shared.mjs` source base inspected from `Trialum/main` at blob SHA `05ac9d3e7db32ea17347e3437d3e28f90c5317ba`; the complete modified source is staged in `src/shared.mjs` for peer review and controlled deployment. **Do not assume your current deployed server is still this exact version.**

## New: recover existing social ID after reinstall (requires independent security review)
- Following community shop migration `007`, apply `sql/008_social_account_recovery.sh` under a privileged role. Confirm account verifier table and least-privilege push token deletion grants.
- Staged `src/social.mjs`, `src/account-recovery.mjs`, `src/live.mjs` add pseudonymous same-ID recovery. Generated 256-bit one-time recovery code is shown only in Android protected UI, while keyed HMAC verifier is stored on server. New device user must save a fresh recovery code BEFORE rotating the old secret/credential. Prior sessions/WSS are invalidated.
- REQUIRED secret `SOCIAL_RECOVERY_PEPPER_B64`: generate 32 CSPRNG bytes outside source control, deploy via secure secret manager and back up. Never commit, print or replace this value casually.
- Disposable PostgreSQL suite `tests/account-recovery.integration.mjs` verifies same UUID, preserved friends/room wallet, generic errors, old token revocation, kit reissue and permanent deletion. Real server and phone proof still required.
- Full threat model/Play policy: `docs/V44-SOCIAL-RECOVERY-SECURITY-CODEX-HANDOFF-20261122.md` in the parent development repository. The ID plus random code is not independent MFA.

## Safe rollout order — not automatic
1. Verify currently deployed server commit, schema, permissions, health and REST/WSS behavior. Acquire a consistent PostgreSQL backup and rehearse restore to a disposable database.
2. Review the diff between the currently deployed `server/src/shared.mjs` and this staged file. Resolve newer server modifications; never blindly overwrite. Install modified server source through the owner-controlled backend deployment.
3. Run `sql/007_v44_shared_store.sh` manually after backup on the correct social database using a privileged DB role. It is idempotent and updates constraints without deleting purchased records; do **not** run `docker compose down -v`.
4. Update application server image/service, keep secrets and endpoints outside git, smoke-test HTTPS `/v1/shared/status`, `/v1/shared/catalog`, snapshot, purchase and placement on a disposable room.
5. Check unauthorized requests (non-member and room member), double purchase, forged costs, replay, concurrent placement, all six slots, and credit balance. Confirm old client retains default toys and legacy `points`.
6. Only then turn on v44 client Store UI and perform owner Android QA before main synchronization/release. Never deploy this stage automatically or declare production readiness from client CI alone.

**Critical:** production Social security and independent age/consent checks need review as separately documented in `docs/V44-FRIENDS-AGE-SIGNALS-VERIFICATION.md`; this store patch does not remove them.
