# One-time Play Games diagnostic build

Branch: `feature/lwc-debug-crash-json-once-20261115`

The Settings → Debugging screen contains **Export crash log**. On Android it opens
the system document picker and saves a user-selected JSON file. The report keeps
the latest uncaught app exception and up to 80 recent app, WebView, and Play Games
diagnostic events. It includes app/device version details needed to reproduce the
issue and redacts email addresses and common credential patterns.

The diagnostic APK uses the separate package `com.trialum.ziivaiskra.crashdiag`,
so it installs alongside the main game and the existing QA packages without
sharing their app data. GitHub Actions creates a random, temporary signing key
on its runner for this build and deletes it after signing; it never uses the
owner's certificates. This random signer is not registered with Play Games, so
Google sign-in may be rejected in this diagnostic copy.

The app cannot read Android system logcat or native-process crash records. The
report is generated only after the player presses the export button; it is not
uploaded. Keep this instrumentation on this isolated branch for the one-time
troubleshooting APK, then remove it after the Play Games issue is identified.
