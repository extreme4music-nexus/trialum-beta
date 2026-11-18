# Trialum v39 consent gates

This beta snapshot implements two independent consent gates.

1. **First launch:** a blocking dialog shows the full, bundled `assets/user-agreement-v39.html`. The player must check the affirmative box and accept. Declining leaves the game blocked. The version and acceptance timestamp are stored in app-local `localStorage`; they are not sent to Trialum or Google. The agreement can be reopened from About & Help.
2. **Friends:** a separate optional, detailed disclosure appears before requesting the per-client Google Play age signal, connecting to the social server, or creating a profile. “Not now” leaves the offline game available. The explicit opt-in is stored locally and never sent to the social server.
3. **Service boundaries:** all server-backed friend calls require the consent and eligible age signal. Messages and shared playground require a ready social profile too. Withdrawing consent closes the message/shared sessions and prevents further app-side requests on that device. It does not delete the server profile; the separate delete action does that.
4. **Disclosed data:** pseudonymous profile ID, nickname, friend/invite relationships, selected pet/profile details, shared-play activity and presence; message content is relayed as readable text, encrypted at rest, not end-to-end encrypted, and retained for up to 7 days; safety reports may remain up to 30 days. The optional age signal is processed on-device and not sent to Trialum. Push is optional and requires Android permission.
5. **Temporary QA:** `qa39social` is a distinct package (`com.trialum.ziivaiskra.qa39social`) with a compile-time age-check bypass only for owner smoke tests. GitHub Actions signs its APK using a one-run ephemeral key and deletes the key. It has no PGS/Firebase registration and must never be used for Play upload or distributed as a release.
6. **Official candidate:** `internalBeta` remains fail-closed on age eligibility and uses the affirmative social opt-in. Its AAB is an unsigned CI candidate for the owner to sign after QA PASS. Nothing is uploaded or published automatically.

These controls document the current v39 implementation; they do not guarantee Play policy acceptance or legal compliance. Keep the in-game disclosure, server behavior, privacy policy, Terms, Data Safety answers and Play target-audience declarations aligned.
