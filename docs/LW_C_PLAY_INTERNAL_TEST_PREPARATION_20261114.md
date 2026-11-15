# LW-C: Google Play Internal Testing preparation

**Status:** beta preparation is active; no Play Store track is released. The player-facing app title is **Trialum**; **Living World** names the first edition. The Play app entry and Play Games Services project exist. The latest unsigned candidates are built by GitHub Actions. Physical owner QA is still pending.

## Android candidate

| Variant | Application ID | Version |
|---|---|---|
| Release candidate | `com.trialum.ziivaiskra` | `Trialum`, versionName `1.0`, versionCode `37` |
| Signing QA | `com.trialum.ziivaiskra.signqa` | QA-only variant |
| Friends Debug | `com.trialum.ziivaiskra.signdebug` | QA-only, debuggable variant |

The package IDs are preserved. CI built and validated unsigned APKs for all three variants and an unsigned Release AAB from public snapshot commit `9a3e81fc7d109bf341e268430b1a6bd1750afd4d`. Regression tests and Android build passed in [Actions run #43625153896](https://github.com/extreme4music-nexus/trialum-beta/actions/runs/43625153896). [Unsigned candidates](https://github.com/extreme4music-nexus/trialum-beta/actions/runs/43625153896/artifacts/14125049307) expire 2026-11-21; artifact SHA-256 is `7f578802b4b6d44f1d227bb162cedab08e2f262d33a564962c3c98b83bc2a678`.

Official signing is local only. The intended key mapping is the existing Release key for the main package and the existing QA key for both QA packages. Keep package IDs, signers, data, and installed apps unchanged; update in place, never uninstall to work around a signer mismatch. CI does not receive private signing keys.

## Play Games Services

Play Games project ID `330148794383` is linked to the app. Saved Games is **On** and saved. The required Google Play Games and Google Drive APIs are enabled. The owner account is on the PGS tester list. Cloud Save remains a player opt-in.

The Play Games project is **Published**. Saved Games is enabled. The one-time `com.trialum.ziivaiskra.pgstest` credential is published and authorized by its exact test signing SHA-1; the Play App Signing credential is the default for the official package; locally sideloaded release APKs use a different certificate. The profile sign-in and Saved Games path were confirmed by the owner on-device for the isolated test package. Achievement and leaderboard posting are not yet owner-confirmed for the official package.

Publishing the PGS project does **not** publish the Play Store app. The Play Store app remains unpublished until its separate track release is submitted.

## Play Store Internal Testing

The app exists in Play Console under the exact main package ID. The `Trialum Internal QA` email list containing the owner is selected. The default English store listing draft uses the player-facing title **Trialum**. There is no uploaded signed Release AAB, active internal-testing release, or tester opt-in link yet. Only the locally signed main Release AAB belongs on the Internal testing track; never upload the QA or Friends Debug APKs.

Before creating the track release, confirm versionCode 37 is unused, confirm the registered upload certificate, upload the locally signed AAB, review Play's generated APKs and pre-launch report, and then create/share the opt-in link. Do not promote to closed/open testing or production without owner approval.

## Data Safety, content rating, and listing

- **Data Safety:** not submitted. The source has local/offline progress and JSON backup, optional Google Play Games, optional social features that use the separate Trialum service, opt-in push, nearby permissions, and optional on-device background pet dialogue. The owner must confirm actual production server and Firebase behavior before declarations; do not state “no data collected/shared.”
- **Content rating:** not completed. Answer the IARC questionnaire against the shipping build, including optional social text features.
- **Store listing:** prepare the final icon, feature graphic, screenshots, short/full descriptions, privacy-policy URL, support contact, and localization before any track submission. Keep user-facing default language English.
- **In-game About & Help:** included in the draft beta snapshot in English and Macedonian. Device review remains part of owner QA.

## Testing and release boundary

GitHub Actions performs tests and Android compilation. Local work is limited to owner-key signing and verification. No public Play app release, PGS project publication, or OWNER PASS is claimed. Keep the private development repo and LW-D unchanged; the public repo contains only the beta build snapshot and excludes private history, secrets, and signing material.
