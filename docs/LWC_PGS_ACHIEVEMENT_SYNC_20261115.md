# LW-C Play Games achievement sync — 2026-11-15

## Observed state

- Play Games Services project `330148794383` is published.
- The local Release Android credential is published for `com.trialum.ziivaiskra` and SHA-1 `89:CD:30:62:F9:57:8A:9F:9D:6A:64:3D:89:CE:1F:95:E2:58:5F:1D`.
- The owner confirms the Play Games profile now connects, but an earned in-game achievement is not yet visible in Play Games.
- The installed v36 APK contains the expected PGS project ID and seven achievement IDs. The missing signal was the asynchronous result from `AchievementsClient.unlock()`.

## Fix in candidate version 37

- Achievement submissions now use the same one-time `SIGN_IN_REQUIRED` recovery path as the other PGS operations.
- Native success/failure is returned to the WebView and recorded in the opt-in crash diagnostic journal, without player identifiers.
- A submission is marked complete only after Play Games accepts it. Failed requests can retry after a 60-second cooldown.
- Worlds with Debug history remain excluded from PGS achievements and ranked scores. The app now records and displays that suppression reason instead of silently ignoring it.
- The official `com.trialum.ziivaiskra` package, its Release signer/OAuth, local saves, Friends service and server integration are unchanged.
- A separate `com.trialum.ziivaiskra.pgstest` install was registered in Firebase to preserve the owner-installed app and its data. GitHub Actions creates a one-time signing key on its public runner, signs only this isolated package, includes the certificate SHA-1 in the build artifact, then deletes the key before the runner is discarded. No signing key or password is stored in the repository or Actions variables.
- The one-time PGS Android OAuth credential for this package must match that exact candidate fingerprint before installing/testing it. A rebuild creates a new signer and needs a new OAuth credential.

## Owner device check still required

Install the separately signed `.pgstest` v37 candidate alongside the existing app, connect the Play Games profile, earn one achievement through normal gameplay, then inspect Achievements in Play Games. The test package uses a separate Firebase app registration and must not replace or uninstall the official app. If the achievement still does not appear, export the in-app JSON crash report; it will distinguish a Debug-world suppression from an accepted or rejected Play Games API request.

Do not claim achievement functionality as verified until that device check succeeds. Do not publish an app release to Play Store as part of this fix.
