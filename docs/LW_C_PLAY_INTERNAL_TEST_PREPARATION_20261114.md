# LW-C: Google Play Internal Testing preparation

**Status:** preparation draft only. No Play Console changes, upload, test-track activation or public release has been performed. Google Play Games setup is intentionally deferred to the final integration step.

## Android build identity

| Purpose | Application ID | Current version |
|---|---|---|
| Main candidate for Play | `com.trialum.ziivaiskra` | versionCode `35`, versionName `1.6-LW-dev.12` |
| Signing QA device candidate | `com.trialum.ziivaiskra.signqa` | QA only; never upload as the Play app |
| Friends Debug device candidate | `com.trialum.ziivaiskra.signdebug` | QA only; never upload as the Play app |

Current Android configuration: min SDK 26, target/compile SDK 36. The target SDK meets the current Google Play requirement for new apps and updates taking effect on 31 August 2026. Confirm the Play Console's existing package and version history before uploading; Play rejects reused version codes.

The private LW-C CI now builds an unsigned Release AAB alongside the three unsigned APK candidates. A pull-request artifact is intended for short-lived, owner-only download and local signing. CI must never receive the official upload or app-signing private key. The three package identities remain unchanged.

## Signing and Play App Signing

1. Download the unsigned Release AAB from the successful private GitHub Actions run.
2. Sign it locally with the existing Play upload key, then verify the signature and record the SHA-256 of the AAB.
3. In Play Console, verify the app's package identity and the displayed upload certificate before uploading.
4. If the app is new to Play App Signing, review Google's key choice carefully: Google can manage the app-signing key while the owner keeps the upload key. Existing published apps must use the signing setup already registered to that package.
5. Keep the owner’s existing APK signing identities for the three device QA packages. Never substitute CI/debug signing for an installed package's owner signer.

Keystore files, aliases, passwords, and private certificates remain local. GitHub **Variables** are visible configuration values; private keystore bytes and passwords belong in GitHub **Secrets** only when a workflow explicitly needs them. This LW-C flow does not need or read those signing secrets.

## Internal testing setup (not activated)

- Create or select the Play app for package `com.trialum.ziivaiskra`.
- Use the **Internal testing** track and a private tester list. Internal testing supports up to 100 testers.
- Upload only the locally upload-key-signed main Release AAB. Do not upload `.signqa` or `.signdebug`.
- Review the generated device APKs and Play pre-launch report before sharing the opt-in link.
- Do not promote to closed testing, open testing, production, or publish a public listing without the owner's separate approval.

## Data Safety and privacy form — draft evidence, owner completion required

Source code indicates these behaviors, but the owner must confirm actual production/server settings and complete Google's form truthfully:

- World progress and local pet state are stored on-device; backups/restores are part of the app. Do not claim cloud backup or transcript persistence from this LW-C change.
- Optional social features send account/profile and room activity to the configured Trialum social service. Shared pet speech is relayed to authenticated room members. The LW-C session ledger is ephemeral in memory; it does not send private player-to-pet chat.
- Optional social messages, nearby discovery, and friend features need separate data-flow confirmation against the enabled production server settings before any declaration.
- Push registration is opt-in in the app; Firebase automatic initialization and analytics collection are disabled in the manifest. Confirm the production configuration and actual Firebase processing before declaring.
- The Android manifest requests Internet/network, notifications, foreground service, and version-limited nearby-device/Bluetooth permissions. Nearby permissions are marked `neverForLocation`; verify runtime behavior and Play Console declarations.
- The app includes an explicitly started special-use foreground service for optional on-device background pet dialogue, with an ongoing notification and Stop action. This requires a truthful Play Console foreground-service declaration and policy review before enabling it for Play distribution.

**Do not submit a “no data collected/shared” answer based on this draft.** Internal-only testing tracks are exempt from the Data Safety section while the app is active exclusively on that track, but this does not remove the need to prepare accurate privacy disclosures for any later track.

## Content rating — not yet rated

Complete the IARC questionnaire in Play Console based on the shipping build and enabled social features. The app contains a fictional creature game and optional user-generated social text; the correct age rating must come from complete, truthful questionnaire answers, not a guessed rating.

## Remaining owner-only confirmations

- Confirm the exact Play Console app/package entry and whether versionCode 35 has already been used.
- Confirm which local upload keystore/certificate is registered in Play Console. A Play app-signing certificate is public; its private signing key is not retrievable from GitHub Variables or Play Console.
- Confirm production social, messaging, push, and nearby settings before Data Safety or Content Rating submission.
- Complete device QA personally. CI success is not OWNER PASS.
- Defer Play Games Services linking/OAuth/achievement activation until the final integration step, after the rest of LW-C is stable.

## Public source publication

No source or build artifact has been transferred to `extreme4music-nexus/trialum-beta`. Public export requires the owner's explicit approval for the exact source SHA and the repository's licensing/security release gates.
