# Trialum v47 — 13+ social safety roadmap

**Status:** implementation in progress; not a release approval or legal certification  
**App branch:** `feature/v47-social-safety-13plus-20261123`  
**Starting point:** Trialum Beta v46 branch, commit `08e36fe58336686a1388cb43a1a85643854022f4`  
**Version target:** versionCode 47, versionName `1.5 v47`

## Owner-approved product direction

- Trialum is being prepared for a **13+ audience**, subject to matching the actual game, store listing, rating, privacy notices, and applicable regional rules. This roadmap does not itself establish legal compliance or change Play Console declarations.
- Friends, friend invitations, shared playgrounds, pet visits, and in-game pet-to-pet interactions remain part of the game.
- Player-to-player free-form messages are off. Only reviewed, predefined messages may be sent between players.
- Google Play Age Signals remains in the source as a future integration, but is **dormant in v47**. It must not be called or used to block the social baseline in this release.
- Local offline play, worlds, pets, memories, achievements, and existing social profiles must not be reset or removed by this work.
- A parent/guardian management feature is a separate, staged capability. A pairing code proves only that two app profiles completed a pairing flow; it must never be described as proof of legal parenthood or adult identity.
- Generated species names are localized for display. A player's custom pet name remains exactly as chosen and is never translated.

## Current v47 changes in this branch

1. The Android build metadata is set to versionCode 47 / `1.5 v47`.
2. The social client treats Age Signals as dormant and no longer uses its result as the social access gate. The dormant branch ignores late callbacks rather than revoking social state.
3. The message composer is forced to preset-only mode in the client, irrespective of the server's advertised `freeTextEnabled` value.
4. The localization layer distinguishes generated species-based names (for example, `Лумира 1`) from custom names. Generated names are rendered using the active locale; custom names and saved values are preserved.

These client changes are not sufficient for a tester release until the matching server patch is based on the live server source and verifies that custom text is rejected on both REST and WebSocket paths.

## Work stages and completion gates

### Stage 0 — Freeze and protect the baseline

- Keep all work on the v47 branch. Do not change the main Trialum repository, v45/v46 branches, release signing material, or Play Console.
- Record the source commit, version identity, and changed-file list.
- Treat the v46 child-safety document as historical; this roadmap supersedes its 6+ target and mandatory 18+ Age Signals behavior for v47 planning.
- Preserve existing saves and add only backward-compatible fields. Do not rename or rewrite stored custom pet names.

**Gate:** reproducible source baseline and no changes outside the isolated branch.

### Stage 1 — Social access controller and Age Signals dormancy

- Keep one client-side social policy entry point for consent, foreground state, service state, and age policy.
- In v47, Age Signals mode is dormant: no access request, no age check, and no callback may unlock or revoke social access.
- Current social consent remains explicit and revocable. Backgrounding the app closes live social transport; returning to foreground rechecks session state without deleting or recreating a profile.
- The server remains authoritative for each operation. A client-side flag or hidden button is never the security boundary.

**Gate:** source review confirms no Age Signals request is reachable in dormant mode; social state transitions do not erase identity or local progress.

### Stage 2 — Messaging boundary

- Keep predefined messages that have reviewed text and stable identifiers.
- Reject free-form player-to-player messages in the server parser before persistence or relay, over both HTTP and WebSocket.
- Do not accept an arbitrary `text` field as a preset or silently convert unknown payloads.
- Keep pet dialogue/gameplay separate from player-to-player messaging. Validate that one player's arbitrary prompt or custom pet name is not relayed to another player as generated pet speech.
- Keep clear UI copy: preset messages are available; custom player messages are disabled in this version.

**Gate:** negative server checks cover HTTP, WebSocket, offline/retry queues, old clients, malformed payloads, and direct event replay.

### Stage 3 — Social safety baseline

- Keep profiles pseudonymous and private by default; do not add email, date of birth, phone, or exact location to the social schema.
- Require explicit two-sided friend acceptance and room/visit acceptance.
- Keep remove, block, report, profile deletion, and local social opt-out accessible.
- Add server-side throttles and authorization to invitations, preset messages, presence, rooms, visits, reports, and push registration.
- Define report access and retention in the privacy notice before retaining additional safety content.

**Gate:** every REST, WebSocket, presence, shared-room, and push route enforces the same account, friendship, block, and moderation rules.

### Stage 4 — Parent/guardian controls

- Implement a transparent pairing flow and a parent-facing control surface as a later v47 stage only after its threat model and data model are approved.
- Pairing must be revocable from both profiles. Child-facing controls must show the current manager and enabled permissions and offer a report/unpair route.
- A short code or QR is a bearer pairing secret, not legal proof of parent/guardian status. Never claim otherwise in UI, policy text, or store declarations.
- Require one-time, short-lived codes, attempt limits, cooldowns, replay protection, and server-side audit events. Do not reveal codes in notifications, logs, clipboard, or analytics.
- Until this stage is implemented and independently reviewed, do not represent parental management as an existing protection.

**Gate:** abuse-case review includes coercive pairing, code sharing, a wrong adult, account takeover, emergency unlink, and simultaneous requests.

### Stage 5 — Localization, including pet names

- Localize all eight current fictional species names: Lumira, Crystel, Nubela, Florix, Synapso, Teralin, Orbivox, and Noetrium.
- Apply the display-only mapping to the pet list, selected-pet panel, local/shared playground labels, visit cards, and pet chat heading.
- Preserve `pet.name` in saves, server payloads, logs, and exports. A user-created name is never auto-translated. Renaming marks it custom.
- Audit new species and all UI surfaces whenever the catalog changes. The locale file's word table is fallback vocabulary, not proof that every rendered surface is translated.

**Gate:** every species display surface is checked in English and Macedonian; custom names, including Cyrillic names, remain unchanged.

### Stage 6 — Privacy, store declarations, and release notes

- Reconcile the in-app social consent, Privacy Policy, User Agreement, FAQ, Play Store listing, Target Audience, Data Safety, and Content Rating with the actual v47 behavior.
- Do not state that the server does not retain/process data until the live code and retention jobs confirm it.
- Do not submit new Play Console declarations as part of source work. The publisher must review and submit them after confirming the final behavior.
- Describe the update as changes to age handling, preset-only messaging, social safety controls, and translations only where those changes are present and server-enforced.

**Gate:** no mismatch between executable behavior, server behavior, disclosures, and store declarations.

### Stage 7 — Closed-test verification

Verify on Play-installed builds, using a second tester account:

- offline save/load, upgrade, export/import, achievements, and existing pet/world continuity;
- social consent on/off, profile recovery, invitations, friend acceptance/removal/blocking/reporting;
- shared playground entry, consent, visits, return, background/foreground recovery, and network interruption;
- preset messages work and free-form text is rejected by both client and server;
- dormant Age Signals makes zero API requests and does not block eligible social paths;
- no stale client or direct API call bypasses the server policy;
- all fictional species display localized names while user-chosen pet names stay unchanged.

**Release gate:** source, matching server patch, migration/rollback plan, test evidence, Play Console declarations, and owner approval all agree. No v47 AAB/APK is produced by this roadmap change.

## Server synchronization status and hard dependency

The live server source has **not yet been imported**. The logged-in Webmin terminal session was already closed when inspected; a read-only command did not return a repository path or source revision. Direct secret-based SSH was blocked by the execution environment, and no SSH credential was printed or copied. Therefore there is no claim that the current server head has been pulled, patched, or deployed.

The v46 patch under `server-patch/v46/` is historical and requires Age Signals/Play Integrity eligibility. It is not the v47 server patch and must not be applied for this policy. Once the live server source is safely available, create a v47 branch in `Trialum-Server`, import the exact current server revision without credentials, then implement and review the v47 policy in that repository. Do not overwrite live server files or run migrations before a backup and owner-reviewed deployment plan.

## Change log

- 2026-11-23: opened v47 branch from v46 base; set app version identity; began dormant Age Signals, preset-only client, and display-only generated pet-name localization work. Server synchronization remains pending.
- 2026-11-23: added a design-only roadmap for empty-by-default gardens, real seed-to-crop harvest, refrigerator storage, and extensible grain/mill/bakery production. No gameplay code or build changed. See [V47_GARDEN_CROPS_AND_PRODUCTION_ROADMAP.md](V47_GARDEN_CROPS_AND_PRODUCTION_ROADMAP.md).
- 2026-11-23: documented the shared UI cause of accordions collapsing after successful actions and the intentional habitat-switch exception. See [V47_UI_DROPDOWN_PERSISTENCE_FIX.md](V47_UI_DROPDOWN_PERSISTENCE_FIX.md). No UI code changed.
- 2026-11-24: captured the owner's persistent-world economy, per-pet wallets/jobs, mutation-linked lifespan, and retained possessions concept. See [TRIALUM_WORLD_ECONOMY_PETS_AND_LIFESPAN_CONCEPT.md](TRIALUM_WORLD_ECONOMY_PETS_AND_LIFESPAN_CONCEPT.md). Design only; requirements remain open for continuation.
- 2026-11-24: added the umbrella Classic 2.5D → shared engine → future 3D roadmap, including proposed increments, world/economy/family systems, and age/guardian/social policy gates. See [TRIALUM_GLOBAL_CLASSIC_TO_3D_ROADMAP.md](TRIALUM_GLOBAL_CLASSIC_TO_3D_ROADMAP.md). This is a planning draft; version labels are not release approvals.
