# Trialum 1.0 beta snapshot — Living World edition

- Source repository: `extreme4music-nexus/Trialum`
- Exact source commit: `04457df48b9c012f8667504b935a7ca501d13f07`
- Source branch: `feature/lw-c-contextual-turntaking-session-20261113`
- Beta name/version: `Trialum - Living World 1.0`; versionCode `37` is the AAB already uploaded by the owner. The v39 / versionName `1.1` candidate is the previous build. This incremental translation update keeps versionName `1.1` and uses versionCode `40` only because Play requires a higher code; the separate v40 feature work is deferred.
- Packages: `com.trialum.ziivaiskra`, `com.trialum.ziivaiskra.signqa`, `com.trialum.ziivaiskra.signdebug`
- Android build and regression checks: public GitHub Actions, unsigned artifact only
- Official app signing: local, with the owner's original keystores. The isolated one-time `.pgstest` diagnosis package is signed by an ephemeral GitHub runner key and has a separate PGS OAuth registration.
- Play Games: project is published and sign-in succeeds; achievement recording is still under investigation. The v37 candidate reports asynchronous achievement API outcomes and retries failed submissions; owner retest required.
- Friends/HTTPS/FCM: LW-C modules are included; public Actions now pass the configured HTTPS host and package-specific Firebase Android client IDs. Push remains consent-gated; CI cannot prove real-device delivery.
- Feature, privacy, localization and owner QA ledger: [LW-C beta regression contract](LW_C_BETA_REGRESSION_CONTRACT.md)
- Google Play upload or public release: not performed. The current PR prepares a translations-only update; see [Play Store notes](PLAY_STORE_WHATS_NEW_1.1_TRANSLATION_UPDATE.md).
- Owner Android QA: pending

This is a clean source snapshot commit in the beta repository. It does not import the Trialum repository's Git history, server/deployment files, release artifacts, signing credentials, or secrets. The build receives only the HTTPS API hostname and Firebase client configuration through beta-repository Actions variables. Server-side FCM credentials, encryption keys, signing keys and passwords are excluded.
