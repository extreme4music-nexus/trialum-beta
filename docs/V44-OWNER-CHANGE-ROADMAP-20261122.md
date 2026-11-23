# Trialum 1.4 v44 — Owner Change Roadmap, 22 November 2026

**Source:** ten owner requirements, the supplied mobile HUD screenshot, and the supplied 25-page *Complete Player's Guide — v43 (Living World Edition)*. The latter is the historical reference, **not** proof of current v44 code behavior.
**Baseline:** `feature/v44-unified-cognitive-memory` at `2ad8475dd3f280e4ee29cb9c876973c751f4a700` (Draft PR #12).
**Work branch:** `feature/v44-owner-hud-economy-guidance-20261122`, created from that exact SHA.
**Scope rule:** Do not alter Trialum core/main, trialum-beta main, v44 release branch, production backend, Play publication, or signing secrets without a separate explicit release authorization. Legacy Free Credits panel remains.
**Execution:** one requirement per checkpoint; record source diffs, new targeted tests, CI result, remaining manual/device checks, and open issues; then move to the next. Existing verified tests are reused as evidence, not repeated gratuitously.

## 01 — Contextual action refill in engine and HUD
- Canonical source of credits: existing `s.longplay.credits`; credits are earned in-game, not a new currency balance.
- New transaction API must validate action scope **lab / pet / habitat**, selected entity ID, integer quantity, current cap, sufficient credits, and game saveability **before** any state mutation. Cost: exactly **1 credit per restored action**, whether bought as 1, 5 or 10 actions; no invented pack discount.
- Trigger only when the relevant action is exhausted. Disambiguate truly locked feature/resource shortage from depleted actions. Display a mobile-accessible popup with current credit balance, action target, one-action and pack choices, available refill space and total cost. No navigation through More; keep the legacy Free Credits UI untouched.
- Explain clearly how to earn credits when balance is zero/insufficient: training, evolutionary milestones, research discoveries, achievements (verify actual code for rewards). Disable purchases that cannot fit cap or balance. Persist once and refresh HUD on success. Do not auto-perform the originally requested gameplay action without explicit confirmation.
- Tests: single/pack success, foreign pet/habitat ID refusal, arbitrary/negative/float quantity, max cap, low balance, no partial changes, ledger record, save/restore, replenishment isolation, action locked for another reason, rapid tapping.

## 02 — Purchased skip-day passes (separate from early wait reduction)
- Tapping the Day HUD opens a dedicated days panel. Suggested explicit **pricing proposal** (subject to owner review): 1 day/50 credits; 3/140; 7/315; 14/595; 30/1125. Discount increases with bundle size; no refund/repricing of used passes.
- Purchase grants a **bank of unspent day passes** (e.g., buy 30, use one today and 29 later). Never auto-skip a whole bundle. Display inventory, chosen skip count, cost and confirmation.
- Every redemption must run the **canonical full-day simulation**, not just increment an on-screen number; no artificial real-world clock modifications and no bypass of unrelated real-time research gates. Persist paid offset/ledger and avoid day regression upon app reopen or elapsed-time reconciliation.
- Show an explicit warning before redemption: crops may lose hydration/health or die, pets and habitats may decline, resources/production/maintenance can change, and actions and time-based mechanics advance.
- Validate stock, max jump, save recovery, idempotency and high-day/plant regressions. No negative balances or accidental double redemption.

## 03 — All top HUD indicators interactive
- Day, XP, Credits, Molecules, Biomass and Insight must be accessible by touch, mouse, keyboard and screen reader. Open contextual modal with current/maximum, source, use, next useful activity, relevant thresholds and direct navigation where appropriate.
- Values must come from the live engine and not static/guessed thresholds. Do not clutter sticky navigation or add continuously polling popups. Close via Escape, visible close, outside tap.
- Save/restore and rerenders preserve state; normal overlay behavior must work in Android WebView at 320px width.

## 04 — Living bilingual guide + contextual guidance + pet knowledge
- Update the user-provided v43 25-page guide against v44 real code and preserve its core structure, mechanics and warnings: starting world, resources, lab, evolution, habitat, pets, training, research, DNA, flora, food warehouse, More, playground, Friends, credits, backups, routine and philosophy.
- Provide **offline English and Macedonian** bundled copies. Use selected UI language; English default for other locales until translations exist. Version and last-updated metadata required; invalidate derived caches on guide update.
- Define structured, versioned machine-readable topic records with screen/action IDs, prerequisites, step-by-step guidance, suggested next actions, result and privacy class. This data—not an unbounded PDF prompt—is the shared source for interactive tooltips, Help and every pet assistant (with retrieval limits and correct privacy scope).
- Add an in-context “Help / What next?” overlay that computes unmet requirements from live game state, offers navigation to relevant areas, and never invents capabilities.
- Test bilingual offline, topic coverage, dynamic next-action suggestions, future guide version updates, integration with local pet cognition and safe context budgets.

## 05 — Every pet has a chat assistant, AI optional
- Always offer private conversation for all pets, including primitive/non-AI pets. Without model consent/install/unlock, provide deterministic English intent-response assistant powered by current engine facts + shared guide topics, not misleadingly simulated LLM inference.
- Handle e.g. “Where do I get food?” (Nutrition Lab -> Warehouse -> individual Pet Home Reserve -> Feed), “How do I earn credits?”, “What should I do next?” and depleted actions. Pet-specific state must be scoped by ID; local history remains private; model switching must not reset memory.
- Display clear notice: beta pet communication is **English only**; non-English prompts may not work correctly. No automatic external translation or remote private chat.
- Tests: all species, no-LMM/no-consent, live engine context, unknown question fallback, no private data sent online, English-only notice, existing Mini/Advanced unchanged.

## 06 — Locked Play Billing catalog (beta)
- Prepare non-purchasable presentation/catalog: **100/$0.99**, **750/$4.99**, **1500/$10.00** in USD, subject to Play localized pricing/taxes; mark unavailable during beta. Note: buying two 750 packs at the specified prices is $9.98, 2 cents less than 1500/$10.00. Preserve owner-requested display until pricing decision.
- Hard-disable purchase flow in the UI **and** authoritative native/server interfaces. When later unlocked, require Google Play Billing, verified purchase tokens on trusted backend, idempotent grant, refund/revocation handling, appropriate age/family policy and privacy/legal revisions. No fake successful purchase or local granting credits.
- Verify UI gate, native/store gate, no bypass via JS bridge, persisted disabled state.

## 07 — LLM lifecycle and shared-playground footprint
- Inventory all Kotlin services, model wrappers, foreground/background callbacks and JS intervals. Require on-demand model load/inference, cancellation and unload on app leave/stop/destroy; no unnecessary generator/timer after close.
- Shared playrooms use only Mini when legitimately enabled, for bounded intentional dialogue, with on-device privacy scope and throttling. World/offline simulation proceeds in engine without running an LLM; no silent background cloud AI.
- Test lifecycle and no zombie model, model switch races, battery/thermal/CPU and actual Android stop/kill on device. Background social communications and local inference are separately consented.

## 08 — Shared playground visual overhaul
- Inventory scene renderer, props, toys, shared-credit state, art/assets. Improve scene readability, equipment silhouettes, spatial depth, item effects, touch targets and viewport behavior; take local playground's design as reference without copying its weak animation.
- Keep engine physics/credit accounting/server protocol and consent rules stable. Responsive/contrast/accessibility QA and device screenshots required.

## 09 — Friends beta age-signal eligibility
- Confirm whether `TrialumAgeSignals.kt`, Social JS and server enforce Google Play Age Signals for every social action. **No beta-tester-only eligibility shortcut.** Adult verified users who accept social consent should be eligible; underage, unknown, unavailable/declined must remain fail-closed.
- Avoid treating client-side checks as server authorization. Validate current official Play API and policy, support fallbacks that do not silently unlock unknown users, and test true Android age-signal paths and server permission enforcement.
- No change to production backend without reviewed deployment plan.

## 10 — Evidence audit, integration and Android artifacts (last)
- Diff against PR #12 baseline to ensure no lost earlier functionality; run **new** and impacted regression suites; reuse already verified unaffected suite evidence rather than wastefully rerunning it. Full release smoke as needed.
- Only after 01–09 are accepted: resolve latest changes against target branch and seek explicit owner confirmation for any branch sync/merge. Do **not** touch `Trialum` core main or beta main as part of feature work.
- Build first one isolated **debug/test-signed** APK with a throwaway test certificate for device QA (not production upload, and not guaranteed install over the existing release because signatures differ). Preserve app ID/data safety, document uninstall/backup warnings.
- On owner device sign-off, produce **unsigned AAB + unsigned APK** for local owner signing, with provenance, SHA-256, package/version identification and no signing credentials in CI or repository. Never call the test APK “Play-ready”.

## Cross-cutting engineering and stop conditions
1. **No silent replay of a failed action** after a top-up. Preserve user intent; player taps again.
2. **Economy ledger integrity:** validations before any deduction, integer arithmetic, bounds and deterministic receipts; concurrent UI inputs prevent double spend.
3. **Privacy and minors:** no AI/context/age metadata leakage, no unlocked payment in beta.
4. **Backwards compatibility:** retain internal saved-world version `1.5.5` when that is the migration contract, even when visible application version is `1.4 v44`.
5. **No false CI claims:** simulated/compile-only tests never substitute for real device QA.
6. **Progress log:** for every checkpoint append commit SHA, tests, CI run and outstanding device tasks to `docs/V44-OWNER-IMPLEMENTATION-REPORT.md`.
