# GP-01 Play Store update pack — Trialum 1.1 (versionCode 39)

**Status: prepared draft only.** This document prepares the Play Store materials for the GP-01 Living Flora update. It has not been entered in Play Console. No AAB/release has been uploaded, submitted for review, or rolled out.

The immediate next step is to begin testing the existing v38 internal candidate. Prepare v39 only after that test cycle has started and the owner approves moving GP-01 forward. The owner will provide fresh in-game screenshots; the media section below remains pending those files.

## Release identity

| Field | Planned value |
|---|---|
| Play Store app title | Trialum |
| Release name in Play Console | Trialum 1.1 — Living Flora |
| User-facing version name | 1.1 |
| Planned versionCode | 39 |
| Update package | `com.trialum.ziivaiskra` |
| Feature package | GP-01 — Living Flora + Classic PhytoLab |
| Listing language prepared here | English (United States), `en-US` |
| Current state | Draft documentation; not a Play release |

VersionCode 39 is the owner-requested next code. Do not put it into a build until the v38 test outcome and the GP-01 source are accepted. The one-time `.gp01test` APK and its random certificate are testing-only and must never be uploaded as the Play update.

## Google Play “What’s new” — draft

Paste this only into the v1.1 release notes after the v39 AAB has been prepared and approved. It is 288 Unicode characters, below Google Play’s 500-character limit per language.

<en-US>
Explore a complete plant journey in Trialum. Research plant forms, create seedlings, grow and care for them in the PhytoLab, then transplant mature plants into compatible habitats. GP-01 also improves plant growth and habitat ecology while preserving existing worlds and plant identities.
</en-US>

## Optional store listing copy

The app title remains **Trialum**. No full-description or short-description replacement is required for this update. If the current listing needs a brief feature highlight after review, this 76-character line is an optional addition, not an instruction to overwrite the existing description:

> Research plant life, grow seedlings in the PhytoLab, and cultivate habitats.

Compare it with the live listing before use so the update does not repeat existing copy. Keep existing icon, feature graphic, and videos unless the owner asks to replace them.

## GP-01 change summary for release records

- Research plant forms, produce seedlings, grow and care for plants in the Classic PhytoLab/greenhouse, then transplant mature plants to compatible habitats.
- Preserve plant identities and migrate existing worlds without resetting player progress.
- Keep the existing Classic Plants view as a fallback.
- No new payment, token purchase, or merchandise feature is part of GP-01.
- No Friends, messaging, FCM, AI, backup/restore, or Play Games feature change is claimed by these notes.
- Do not advertise this as the 3D Living World update.

## Screenshots — owner assets pending

Use genuine captures from the approved v39 candidate. The screenshots should show the update itself, in English, with a representative saved world and no personal information, debug panels, test dialogs, emulator controls, or misleading overlays.

| Slot | Capture requested | Filename after receipt |
|---|---|---|
| 1 | Plant research/discovery in the Botanical Research Lab | `gp01-01-botanical-research.png` |
| 2 | Seedling or plant lifecycle in the Classic PhytoLab/greenhouse | `gp01-02-phytolab-growth.png` |
| 3 | Plant care or growth stage, showing actual gameplay | `gp01-03-plant-care.png` |
| 4 | Mature plant placed in a compatible habitat | `gp01-04-habitat-transplant.png` |

Google Play currently accepts up to 8 screenshots per supported device type; phone screenshots must be JPEG or 24-bit PNG, at least 320 px and no more than 3840 px on either dimension, with the longest dimension no more than twice the shortest. The current store listing already has preview assets; do not remove or replace them when adding the GP-01 captures.

## Release preparation checklist — after v38 testing

- [ ] Start the v38 internal test and collect tester feedback before preparing a v39 upload.
- [ ] Review and accept the GP-01 source and regression results; record any required fixes before assigning the Play version.
- [ ] Set the production candidate to `versionName 1.1` and `versionCode 39`; keep package ID `com.trialum.ziivaiskra`.
- [ ] Build the AAB from the accepted Beta source. Do not use the disposable random-signed test APK.
- [ ] Apply the owner’s official signing process; verify the package, version, certificate and AAB integrity before upload.
- [ ] Add the approved screenshots and retain existing icon, feature graphic and video unless the owner requests a change.
- [ ] Add the English release notes above and review the listing preview.
- [ ] Upload first to the Play testing track chosen by the owner. Do not roll out to production or publish without explicit owner approval.
- [ ] Recheck Play Console declarations only if the actual app behavior or data collection changed; these release notes alone do not change Data Safety, target audience or Content Rating declarations.

## Primary Google Play references

- [Prepare and roll out a release](https://support.google.com/googleplay/android-developer/answer/9859348) — release notes, language tags, 500-character limit, draft/save and rollout flow.
- [Add preview assets to showcase your app](https://support.google.com/googleplay/android-developer/answer/9866151) — screenshot, icon, feature graphic and video requirements.

