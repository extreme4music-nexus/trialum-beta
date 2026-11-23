# Trialum — Cloud Migration, AI Modes, and Revenue Plan

**Captured:** 2026-11-24  
**Status:** Owner-directed planning addendum. No server, app endpoint, DNS, billing, or AI provider has been changed or selected.  
**Release requirement:** Complete and verify the cloud migration before the app exits Closed Testing.  
**Related roadmap:** [TRIALUM_GLOBAL_CLASSIC_TO_3D_ROADMAP.md](TRIALUM_GLOBAL_CLASSIC_TO_3D_ROADMAP.md)

## 1. Owner requirements captured

- Before Trialum leaves Closed Testing, move the social service from the private/home server to a secure cloud host.
- The app's server URL will change, which requires a client update unless a later, explicitly designed compatible endpoint/configuration mechanism avoids one.
- Keep the old service and new cloud service reachable during the adoption period so already-installed versions do not abruptly lose social connectivity.
- Retire the home server's public service only after the supported clients have migrated and a rollback window has passed.
- The game is free to download. No in-game third-party ads, ad tracking, or sale of player data to data brokers.
- In-game “advertising” is first-party information about Trialum updates and new features only.
- Local AI stays as it works today, limited to active play and the focused pet. It is not converted into an always-on background service.
- A later optional cloud AI mode may run continuously for a selected pet, but its real infrastructure/model cost must be bounded and paid using the central player balance (“Lumi”/World Treasury), not charged to each pet wallet.
- Laboratory progression should gradually become a deeper, scientifically grounded simulation with hypotheses, experiments, resource costs, and meaningful failed experiments.
- Pet closeness, emotion, and physical/intellectual development are simulated and individual. Ordinary deterministic simulation must continue through periods when the player does not open the game.

## 2. Recommended server migration design

### Non-negotiable architecture rule: one authoritative data plane

The transition may have two reachable endpoints for compatibility, but it must not have two independent authoritative databases accepting the same writes. That causes friend/profile divergence, duplicate events, missed messages, and unclear deletion/consent state.

Recommended arrangement:

- The **cloud service becomes the sole canonical API/database** after cutover.
- New app builds call the new cloud endpoint directly.
- During adoption, the legacy endpoint used by old app builds acts only as a narrow compatibility gateway/proxy to the cloud service, or the existing hostname is safely routed to the cloud gateway. It does not maintain an independently writable copy of social state.
- If a proxy cannot safely route the old clients, keep the home service in a restricted compatibility role with a single, documented, idempotent synchronization protocol. This is a fallback, not the default; do not casually dual-write.
- Once old clients are migrated or gracefully receive an update-required response, remove the compatibility route and shut down the home server's public API.

This allows both old and new app versions to function temporarily while one cloud database remains the source of truth. It is not two live, competing copies of user data.

### Migration stages

#### C0 — Inventory and backup

- Record current production server commit/version, API routes, schema/migrations, database size and table counts, Caddy routing, DNS/TLS, FCM credentials, rate limits, backups, retention/deletion jobs, and current clients' exact hard-coded endpoint.
- Export encrypted backups and test restoring them into an isolated cloud staging database before any production cutover.
- Keep signing credentials, provider tokens, FCM keys, database passwords, and SSH keys out of Git and the app bundle.
- Decide what data actually must migrate. Prefer a data-minimized migration; do not copy logs, test accounts, expired records, secrets, or backups without a defined need and retention policy.

**Gate:** inventory, tested restore, schema map, and rollback plan exist; production is unchanged.

#### C1 — Build a separate cloud staging environment

- Select a provider/region only after cost, data location, backup, security, and operational-access review.
- Deploy a staging copy with a separate database and secrets. Use synthetic test profiles, not live player data.
- Set up HTTPS/TLS, least-privilege network rules, private database networking, secret storage, patching, health checks, rate limits, logs with personal data minimized, and encrypted backup/restore.
- Confirm that social profile deletion, parental/consent state, block/report records, push registration and retention behavior work in staging.

**Gate:** security/restore checks and all API compatibility tests pass in staging; no public production traffic has moved.

#### C2 — Prepare client endpoint and compatibility

- Add the new endpoint to a dedicated new app build/configuration and document exactly which app versions call which endpoint.
- Keep the old URL reachable through a compatibility gateway during adoption. If the old hostname is routed to the cloud, verify certificate renewal, callback origins, Play Games/FCM behavior, and rollback before switching DNS.
- Do not rely on an undocumented remote flag to change a security-sensitive endpoint. The endpoint must be authenticated/TLS-protected and a bad config must fail safely.
- Test existing old clients and new clients concurrently against the same canonical data. Include friend acceptance, profiles, preset messages, shared spaces, push events, deletion, consent/revocation, retry, and idempotency.
- Observe the home WAN exposure during transition. If the goal is to hide/protect the private host, old-client compatibility should use a cloud gateway or restricted outbound tunnel; do not leave a broad direct-to-home API open just to avoid an app update.

**Gate:** old and new client versions can both operate without duplicate or split-brain state; the private origin is not unnecessarily exposed.

#### C3 — Production cutover and dual-endpoint adoption window

- Freeze writes briefly if required, take a final verified backup, apply the reviewed migration once, validate record counts/references, and switch the cloud database to canonical production.
- Route the new build directly to cloud and the legacy app endpoint through the compatibility gateway to the same cloud service.
- Monitor availability, error rates, queue/retry depth, missed/duplicate events, database growth, cost, backup status, and aggregate client-version adoption. Use privacy-minimizing operational metrics; do not add advertising or behavioral profiling.
- Keep a tested rollback plan that restores service without making the old database writable concurrently with cloud. If rolling back, select one authority and reconcile writes deliberately.
- Maintain the compatibility window until active supported clients have updated or have received a clear update-required path and the owner approves shutdown.

**Gate:** cloud has been stable for the agreed soak period, migration checks and deletion paths pass, backups can restore, and remaining old-client handling is understood.

#### C4 — Retire the home public service

- Revoke cloud-to-home migration credentials and old exposed API secrets; rotate any credentials that were ever present on a client or in an unencrypted file.
- Remove WAN port forwarding/public Caddy routes and direct DNS paths to the home origin. Keep only the required private backup/archive under an owner-approved retention policy.
- Confirm old supported builds either reach cloud through the compatibility path or get a safe update-required response.
- Verify that server shutdown does not affect offline worlds, local saves, local pet AI, or JSON backup/restore.
- Record final shutdown time, source revisions, data verification, retained backup policy, and recovery owner.

**Gate:** no supported client depends on the home API, no public route remains, and the cloud rollback/restore process is documented.

## 3. Ads, privacy, and free access

### Product commitments

- Free install and a meaningful free-to-play path.
- No third-party in-game ad network or personalized ads in the planned experience.
- No sale/rental of player profiles, pet memories, usage histories, or social graphs to data brokers.
- No ad identifier or cross-app advertising profile added for monetization.
- In-game update cards are first-party release/news notices, clearly labeled as Trialum updates. They are not paid ads, do not target based on sensitive behavior, and can be dismissed or muted.
- External advertising to promote Trialum is a separate future marketing choice; it does not imply ads inside the game.
- Keep the Privacy Policy and Play Console Data Safety answers synchronized with actual app, SDK, server, cloud AI, and diagnostic behavior.

### Sustainable revenue options to evaluate later

No monetization method is activated by this document. Possible future choices, in the order that best preserves the current principles:

1. **Optional cloud-AI usage** paid from earned or optionally purchased Lumi, because it creates a real variable model/hosting cost.
2. **Optional Lumi packs** through Google Play Billing, with no cash-out, no peer-to-peer cash-equivalent transfer, no exclusive access to core progression, and clear quantity/price.
3. **Cosmetic/merchandise items** later, with physical goods handled through the applicable physical-goods payment path.
4. **Supporter or subscription bundles** only if the value and quotas are explicit and do not remove the ordinary free experience.

The game must remain complete enough to enjoy without paying. Purchases may save time or fund optional cloud compute; they must not be the only way to feed, heal, house, or keep a pet alive.

## 4. Local simulation and two AI modes

Keep the engine simulation distinct from a generative AI service:

### Local/foreground AI — current mode

- Runs on the user's device while the game is actively used.
- Applies to the currently focused pet or an explicitly selected interaction.
- Remains local; it is not silently moved to the cloud and is not billed per token.
- When the user closes the game, deterministic engine systems continue through bounded offline catch-up. The local generative model itself does not secretly run 24/7.

### Optional cloud-autonomy mode — later product

- Explicit opt-in for a selected pet; it can continue designated AI interactions while the game is closed.
- Uses cloud inference only for defined actions. Hunger, wages, crop growth, sleep, simple schedules, and other deterministic simulation should use ordinary engine code, not expensive model calls.
- Shows which pet is active, the allowed action scope, remaining daily/monthly quota, current Lumi budget, and a clear pause/off switch.
- Never lets cloud AI spend money, change consent, message a player, alter another pet's profile, or change the world outside a small, auditable list of engine-authorized commands.
- Uses an allowlisted tool/action API, server-side authorization, fixed context/output caps, replay protection, per-user and per-pet rate limits, cost alarms, and a hard budget stop.
- Sends only the minimum pet/context data necessary. Explain that selected pet context is sent to the cloud AI provider; provide memory controls, deletion, retention, and parent controls before enabling it for any minor/managed profile.
- No open-ended network/agent tool access. Cloud-generated content is validated before it becomes an engine command or visible player-to-player content.

The world can therefore keep progressing for days/weeks when the player is away without continuously buying LLM tokens. Cloud AI is for optional richer autonomy, not the clock or the entire game engine.

## 5. Recommended cloud AI pricing model

### Recommendation: charge for completed AI action units, backed by server-side compute budgets

Do **not** bill players directly by raw provider tokens; it is hard to understand and model/token prices can change. Do **not** sell unlimited “24/7 AI time”; actual use can vary wildly and create an uncapped bill. Use a clear, bounded **AI action unit** priced in Lumi:

- Define small action classes (for example, short response, thoughtful response, multi-step autonomous task) with a fixed maximum context and output budget.
- Before enabling cloud autonomy, show the Lumi cost per action/class and the daily/weekly/monthly cap.
- Charge only for an accepted/completed action, with an idempotency key to prevent duplicate debits on retries. If the provider fails or output is rejected, do not charge or refund according to a clearly specified rule.
- Meter actual provider input/output tokens privately on the server for cost control and accounting. The player sees predictable action units and remaining budget; no raw token math is required in the game UI.
- Allow an owner-selected maximum spend. Stop cloud actions automatically when the cap is reached; never silently top up or switch to paid billing.

### Bundles and subscriptions

Weekly, monthly, or annual plans may be evaluated later, but should include **defined daily action quotas plus a total-period cap**, not unlimited generation. Make renewal, expiry, and remaining quota clear. An unused daily quota should not silently create a growing debt/overage. Any unused Lumi and subscription entitlements need a documented policy before sale.

For a managed/child profile, default cloud-autonomy purchases and recurring plans off. A parent should be able to disable cloud AI, set or approve a budget, and review aggregate usage. Purchase approval must use Google Play's supported family/billing flow where available and be tested on managed accounts; an in-game parent PIN is not a substitute for store purchase controls.

Cloud AI pricing must not be finalized until a provider is chosen and measured: compute real cost for representative input/context/output, retries, peak use, storage, network, moderation, and support. Then set the action-unit cost with a safe margin and a hard monthly provider budget. No provider selection, price, quota, or paid feature is approved here.

Google Play's current policy requires Google Play Billing for in-app digital goods such as virtual currency, with exceptions only where the policy explicitly allows them. Purchased virtual currency must be used within the app/game title where it was purchased: [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en). Re-check the policy at the time purchases are designed.

## 6. Advanced laboratory direction

The laboratory evolves from simple taps into a research process:

1. Observe a question or ecosystem condition.
2. Choose a hypothesis and a safe, abstract experiment.
3. Allocate time, energy, compounds, and research actions.
4. Receive an outcome that can be successful, inconclusive, or a meaningful failed attempt.
5. Record what the player learned, unlock improved methods, and decide whether to repeat or change conditions.

The science should become more rigorous over time: conserve quantities, track units, use consistent reaction constraints, model uncertainty/error, and connect outcomes to plant/pet/ecosystem effects. The game can distinguish scientifically grounded general chemistry from fictional species and fictional biology. It should not turn into an unsafe real-world synthesis manual. A failed experiment should consume only the stated resources and teach something; it must not corrupt the save or arbitrarily punish the player.

## 7. Persistent-world time without punishing absence

The simulation does not need a server process awake every second to feel persistent. Save a deterministic world timestamp/day and reconcile elapsed time when the app resumes:

- Pets' schedules, needs, jobs, crop growth, facility production, and age advance by bounded game-calendar events.
- Each event has a unique period ID so repeated launch, retry, and process death cannot duplicate wages, harvests, or consumption.
- Use caps and safe defaults for long absences. Give warning/repair/feeding paths and never make a player return to a dead, bankrupt, irrecoverable world after an ordinary break.
- If the device clock changes or the save is moved, detect implausible jumps and reconcile safely; do not award unlimited offline production.
- Cross-device sync, server-side world simulation, or live multiplayer worlds are separate future architecture decisions.

Optional cloud AI may continue only for the explicit paid/earned quota and authorized actions. Deterministic simulation remains the always-available, low-cost layer.

## 8. Cross-cutting age, privacy, and cloud-AI gates

The existing global roadmap's safety model remains in force:

- Age Signals dormant in v47; future use only where supported/required, and never treated as global adult proof.
- Keep online social capability tiers region-aware; preset-only communication reduces risk but does not remove all social-feature responsibilities.
- Parent/guardian linking and verified parental consent remain different states. A short-lived QR/code is a secure pairing mechanism only when correctly implemented, not proof of family relationship.
- No free-form messaging or cloud pet AI for child/managed profiles until target audience, laws, platform policy, provider child-directed terms, parent controls, retention/deletion, and server enforcement are reviewed and implemented.
- Give a player an immediate safety pause/unlink path. A manual Webmin decision must not be the only way to stop a risky link.
- No exact DOB, parent contact, identity evidence, private memories, or social graph is sent to an AI provider unless explicitly necessary, disclosed, authorized, and covered by a reviewed retention/deletion plan.
- Store age/provider results only as the smallest permitted feature state and expiry/revocation data. Never use age signals for advertising, profiling, or analytics.

## 9. Cloud cutover release gates

Closed Testing cannot be marked complete until all of these are met:

1. Cloud staging is restored from a verified backup and tested with synthetic profiles.
2. A new client build points to the reviewed cloud endpoint and retains working Play Games/FCM/social behavior as applicable.
3. Legacy installed versions reach the same canonical cloud state through a compatibility gateway, or display a clear update-required response.
4. Old and new versions are exercised concurrently: friend requests, preset messages, shared rooms/visits, blocks/reports, profile deletion, consent/revocation, offline/online transitions, push registration, and retry behavior.
5. There is one authoritative database, tested rollback, monitoring, backups, deletion/retention policy, and cost ceiling.
6. The home server is either restricted behind the compatibility route or no longer publicly reachable. Do not leave open WAN ports simply to preserve an old URL.
7. The owner verifies the new client on a physical device and approves the compatibility window, cloud provider, and final home-server retirement.

## 10. Decisions still open

- Cloud provider, region, budget, data location, operations access, and backup-retention duration.
- Exact old/new API hostname and whether the old domain can safely route through a cloud gateway.
- Adoption window and aggregate threshold for ending legacy compatibility.
- Currency final name, the World Treasury label, and transaction sources/sinks.
- Whether cloud AI charges by one action unit or several action classes, and the free earned daily quota.
- Whether weekly/monthly/yearly quota bundles exist, their caps, and whether unused quota expires.
- Which model/provider is acceptable for pet memories, costs, child-directed services, retention, and deletion.
- The first research experiment and first production chain for the advanced laboratory.
- Exact absence/catch-up maximum and pet-safety policy for long player breaks.

## Change log

- 2026-11-24: recorded the pre-Closed-Test cloud migration requirement, compatible dual-endpoint window with one authority, no-ad/no-data-broker commitment, local/cloud AI split, action-unit pricing recommendation, advanced-lab direction, and persistent-world catch-up constraints.
