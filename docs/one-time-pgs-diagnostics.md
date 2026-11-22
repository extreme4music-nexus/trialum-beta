# One-time Play Games diagnostic build

Branch: `feature/lwc-pgs-crash-diagnostics-20261115`

The Settings → Debugging screen contains **Export crash log**. On Android it opens
the system document picker and saves a user-selected JSON file. The report keeps
the latest uncaught app exception and up to 80 recent app, WebView, and Play Games
diagnostic events. It includes app/device version details needed to reproduce the
issue and redacts email addresses and common credential patterns.

The diagnostics are included in the real release package `com.trialum.ziivaiskra`.
GitHub Actions builds an unsigned candidate; it must be locally signed with the
existing Release certificate so the installed game identity and Play Games
OAuth fingerprint remain unchanged. The signing key and password are not added
to GitHub or this repository. The report includes the installed certificate's
SHA-1 fingerprint to help match it against the Play Games linked app.

The app cannot read Android system logcat or native-process crash records. The
report is generated only after the player presses the export button; it is not
uploaded. Keep this instrumentation on this isolated branch for the one-time
troubleshooting APK, then remove it after the Play Games issue is identified.
