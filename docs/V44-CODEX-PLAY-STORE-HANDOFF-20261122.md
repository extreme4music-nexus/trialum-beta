# TRIALUM 1.4 v44 — Codex / Google Play Console handoff

**Date:** 2026-11-22  
**Owner stage:** physical Android QA in progress; owner reports gameplay, HUD, guide, private pet memory and prior changes functional on phone. Two final fixes made for footer and offline licenses. **DO NOT PUBLISH** before owner approves the final Play-installed build.  
**Current development branch:** `feature/v44-owner-hud-economy-guidance-20261122`  
**Draft PR:** https://github.com/extreme4music-nexus/trialum-beta/pull/13  
**Authoritative implementation report:** `docs/V44-OWNER-IMPLEMENTATION-REPORT.md`  
**Previous baseline:** `feature/v44-unified-cognitive-memory` / draft PR #12, baseline SHA `2ad8475dd3f280e4ee29cb9c876973c751f4a700`.

## Non-negotiable release sequence for Codex on the desktop
1. Read PR #12 and PR #13, both implementation logs, live current source, and the owner’s mobile QA observations. Confirm the latest protected main SHA and Play Console versionCode before changing anything. Do not treat old documents as proof of current release track.
2. **First: owner installs and tests the isolated one-time social QA APK.** This side-loaded disposable package simulates an adult Age Signals response **only in its CI build workspace**, to test social UI/HTTPS flow without Play installation. It is not a model for any production security behavior, and must never be uploaded. Social consent and server-side controls must still be tested.
3. Once owner confirms UI+social behavior, review real Play-distributed Age Signals on a registered package; server authorization and WSS permissions remain separate security blockers. Do not claim adult verification from a self-reported Google `TIER_A` age band.
4. **Before generating any unsigned release AAB or APK: perform an explicit, reviewed sync against the intended `main` branch.** Back up refs, compare divergence, resolve collisions, verify `versionCode`, `applicationId`, translations, legal assets, native modules and data migrations; run only necessary affected regressions plus a final build smoke. Do not force-push, merge to `main`, or alter the original `Trialum` engine repository without explicit owner sign-off.
5. Only after that sync and owner approval, build **unsigned** release `.aab` and `.apk`, attach exact source SHA, build-variant metadata, SHA-256 hashes, R8 mapping and dependency license inventory. Owner signs locally; Codex on the owner PC publishes to Google Play only on explicit authorization. Never embed signing secrets in GitHub.
6. After Play upload, verify internal testing track, test device, `What's new`, main store listing, screenshots, Data Safety/Privacy Policy, age-signal behavior, FCM/PGS config and any Play warnings; await owner confirmation before promotion.

## Cumulative changes since v38 (version-aligned when evidence exists)
- **v38 / Beta 1.0:** optional Google Play Age Signals gating for Friends/messages/nearby/shared play; explicit adult/unknown fail-closed policy in the beta; Beta Tester Center diagnostics, PGS status, local notifications and Friends service check. Source: `docs/INTERNAL_BETA_RELEASE_NOTES_V38.md`.
- **v39 / 1.1:** clearer first-run User Agreement and separate voluntary Friends/social consent; online data handling, retention, privacy and opt-out disclosure; offline play remains possible. Source: `docs/PLAY_STORE_WHATS_NEW_V39.txt`.
- **v40:** translation and UI quality pass, translated legal agreement in supported locales and untranslated text repairs. Source: `docs/PLAY_STORE_WHATS_NEW_V40.txt`.
- **v41 / 1.2:** Classic Food Warehouse — shelves/cold storage, production, packing, home reserves per pet, feeding, plus Journal, screen layout and further language/privacy fixes. Source: `docs/PLAY_STORE_WHATS_NEW_V41.txt`.
- **v42–v43 development/integration (version assignment to individual mechanics to be confirmed against final commit history):** working Living World features integrated into Classic including plant research, seedling production, greenhouse and habitat cultivation, environmental health, food transfers and differentiated pet/home state. Do not assign a feature to a precise v42/v43 Play release without checking the actual track. Sources: `docs/LW_C_GAMEPLAY_RELEASE_TRAIN_20261116.md`, `docs/LW_C_V40_CLASSIC_FOOD_WAREHOUSE_PREP_20261117.md`, current `js/plant-lifecycle.js`.
- **v44 / 1.4 baseline:** individual lifelong cognitive memory and encrypted private migrations; unified scrollable English pet chat, single model selector, consented optional local Mini/Advanced models; Android offline STT/non-network TTS; privacy-screened English shared pet speech with Macedonian room captions when available; updated eXtreme4 legal terms and offline privacy policy, release version and complete 17-language UI fallback.
- **v44 owner upgrade, PR #13:** action refills at **1 earned credit = 1 action** in Lab/Pet/Habitat/Greenhouse; no need to open old Free Credits settings. Bought game-day passes with increasing discounts up to 30 days, banked separately and consumed at will, applying real plant/pet/habitat consequences. Day, XP, Credits, Molecules, Biomass, Insight top HUD now interactive with live explanations. Complete canonical 20-topic offline EN/MK guide and contextual “What next?” tips; all pets can answer common gameplay questions in English without a downloaded LLM. New layered shared-playground scenery and tangible equipment. AI stops outside foreground, shared playground uses Mini only. Future paid-credit packs ($0.99/100, $4.99/750, $10/1500) are **display-only, entirely locked**. Adult social eligibility is no longer restricted to beta testers; still requires Google Play shared 18+ signal, consent, and a valid profile. Age-signal client logic implemented; live server/Play verification not yet approved.
- **Final owner QA fixes:** screen footer corrected from “Living World 1.0 Beta” to **“Living World 1.4 v44 Beta”**; offline licensing now includes model license terms plus a generated *exact build-time Android runtime dependency inventory*. The Licenses dialog no longer suppresses all notices when one asset is missing.

## Shipping gates / claims not allowed
- Never ship the temporary age-gate simulation in a release APK, AAB, release branch or `main`. Its isolated package is a manual QA tool only, not an end-user feature.
- No remote/cloud AI claims. Downloadable inference is local and opt-in. Private chats are in English during beta.
- Don't claim Play Billing is live. Do not show “buy credits now”; real-money purchase endpoints must stay disabled.
- Don't claim that social/WSS backend independently verifies age until documented. A Google-shared `TIER_A` band may be self-declared, and no client boolean alone authorizes a secure server.
- Don't claim complete Play Games/FCM cross-device parity from a side-loaded random-signed APK (the isolated QA package intentionally lacks those registrations).
- Don't change stored-world schema identifier solely to match the visible app version; maintain backward compatible saved worlds.
- Privacy Policy, Data Safety, consent, child protection and license notice reports must match the ACTUAL production artifact.

## GOOGLE PLAY — What's new (English, under 500 characters)
Trialum 1.4 v44: Interactive HUD, instant action refills, and day-skip passes with real ecosystem consequences. Updated offline EN/MK guide and contextual help. Every pet can answer gameplay questions without an AI model; optional on-device AI and lifelong pet memory are improved. Refined food warehouse, flora care, shared playground and translations. Better battery management, backups, privacy and optional adult social features.

## GOOGLE PLAY — Што е ново (македонски, под 500 знаци)
Trialum 1.4 v44: интерактивен HUD, дополнување акции и купони за прескокнување денови со вистински последици. Нов офлајн водич на македонски/англиски со контекстуална помош. Секое милениче добива асистент и без AI; подобрена доживотна меморија и локални модели. Подобрени храна, флора, игротека, преводи, батерија, бекап и приватност. Социјалните функции се изборни и со услов за полнолетност.

## GOOGLE PLAY — English short description (max 80)
Evolve a living world, care for pets and plants, and explore science and habitats.

## GOOGLE PLAY — Macedonian short description (max 80)
Создај жив свет, негувај миленичиња и растенија и истражувај екосистеми.

## GOOGLE PLAY — English full description draft
TRIALUM — LIVING WORLD | 1.4 v44

Start with an atomic ocean. Discover molecules, nurture early cells, develop new species and shape a living ecosystem at your own pace. Trialum is an offline-first evolution and pet-care sandbox built around long-term choices, fictional science and a world that remembers.

BUILD YOUR LIVING WORLD
• Explore an eight-stage evolutionary journey, laboratory experiments and scientific research.
• Grow habitats with their own oxygen, pH, temperature, minerals, cleanliness and ecological balance.
• Discover flora, raise seedlings in a greenhouse, water plants and transplant healthy specimens into compatible habitats.
• Create and care for individual pets with their own needs, growth, skills, training and lifelong local memories.
• Produce food in the Nutrition Lab, manage the Warehouse, move supplies into each pet’s home reserve and feed from there.

PLAY SMARTER IN 1.4 v44
• Tap Day, XP, Credits, Molecules, Biomass or Insight for live explanations and next steps.
• Use earned in-game credits to restore exhausted actions directly where you need them (1 credit per action).
• Buy optional discounted game-day passes and redeem them at your own pace. Skipping days simulates real in-game consequences: plants and pets can suffer from neglect.
• Open contextual “What next?” help and a complete offline player guide in English or Macedonian.
• Ask any pet simple gameplay questions in English, even without an AI model. Compatible pets can optionally use locally downloaded on-device language models with consent.
• Enjoy refreshed shared-playground scenery and equipment.

BUILT FOR PLAYER CONTROL
• The main world works offline; local saves, manual backup and encrypted migration archives help protect your progress.
• Optional Google Play Games and social features require supported services, explicit consent and eligibility checks. Public social features require a Google-shared 18+ age signal and an active profile; availability can vary.
• Real-money credit purchases are NOT active in this beta. The planned credit catalog is visible but locked.
• Supports multiple interface languages; private pet chat is English-only during beta.

Trialum’s biology and chemistry are fictional gameplay systems, not a scientifically accurate simulation. Features may evolve during beta development.

## GOOGLE PLAY — Македонски целосен опис
TRIALUM — LIVING WORLD | 1.4 v44

Започни од атомски океан. Откривај молекули, развивај клетки и нови видови и создавај сопствен жив екосистем со свое темпо. Trialum е долгорочна игра со измислена наука, грижа за миленичиња, офлајн напредок и свет што ја памети сопствената историја.

СОЗДАЈ ГО СВОЈОТ ЖИВ СВЕТ
• Помини низ осум еволутивни фази со лабораториски експерименти и истражувања.
• Гради живеалишта со сопствен кислород, pH, температура, минерали, чистота и биохемиска рамнотежа.
• Откривај растенија, одгледувај расад во стаклена градина, наводнувај и пресадувај во соодветни биосветови.
• Негувај индивидуални миленичиња со посебни потреби, тренинг, вештини и доживотна локална меморија.
• Произведувај храна во нутритивната лабораторија, користи стовариште, префрлај залихи во личните домашни резерви и храни ги миленичињата.

НОВО ВО 1.4 v44
• Допри на Ден, XP, Кредити, Молекули, Биомаса или Сознание за актуелни информации и насоки.
• Дополнувај истрошени акции директно во активноста — една акција за еден заработен кредит.
• Купувај пакети купони за денови со попуст, а користи ги по потреба. Прескокнатите денови носат вистински последици во симулацијата: растенијата и миленичињата може да страдаат од запоставување.
• Користи интерактивна помош „Што понатаму?“ и целосен офлајн водич на македонски и англиски.
• Поставувај едноставни прашања на секое милениче на англиски, и без AI модел. За соодветно развиени миленичиња изборно се достапни локални јазични модели со согласност.
• Истражувај ја обновената заедничка игротека со попрегледни справи и сцена.

ТИ ОДЛУЧУВАШ
• Основната игра работи офлајн. Локалните зачувувања, бекап и шифрираната архива го штитат напредокот.
• Google Play Games и социјалните функции се изборни. За социјални услуги е потребна согласност, Google-споделена возрастна група 18+ и активен профил; достапноста зависи од уредот и услугите.
• Купување кредити со вистински пари НЕ е активно во оваа бета. Идните пакети се прикажани, но заклучени.
• Интерфејсот поддржува повеќе јазици; приватниот чат со миленичињата во бета е на англиски.

Биологијата и хемијата се измислени механики на игра, не научно точна симулација. Бета-функциите може да се менуваат.

## Codex final delivery checklist
- [ ] Confirm scope, `main` baseline, official application ID and currently active Play track.
- [ ] Owner has reviewed both final mobile screenshots (footer and fully populated offline licenses).
- [ ] One-time social test APK passed owner test; no temporary age gate in permanent branch.
- [ ] Google Play registered build passes real age-signal checks; server verifies authorized social sessions/consent.
- [ ] Compare and sync with `main` only after owner sign-off; no unreviewed merge.
- [ ] Final full regression smoke, Android build, signed-independent AAB/APK generation and asset license inspection.
- [ ] Owner signs artifacts locally; release artifact hashes and provenance match tested commit.
- [ ] Paste localized release notes (up to 500 chars) and edit full/short Play Store listing in Play Console.
- [ ] Confirm privacy/data declarations, screenshots, content rating, translations, optional features and store wording before submission.
- [ ] Do not publish or promote without explicit owner approval.

**Store listing editorial guidance:** keep the title “TRIALUM” unless the owner explicitly authorizes renaming the Play app. Put “Living World 1.4 v44” in descriptions, version name and What's new. The version display is not a reason to change the Play package identifier or reset installs.