'use strict';
/* Preflight for a NEW independently installable QA package. No signing keys are read. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const g=fs.readFileSync('android-template/app/build.gradle.kts','utf8');
const q=fs.readFileSync('android-template/app/src/signqa/res/values/trialum_app_labels.xml','utf8');
const d=fs.readFileSync('android-template/app/src/signdebug/res/values/trialum_app_labels.xml','utf8');
for(const s of ['create("signqa")','initWith(getByName("release"))','applicationIdSuffix = ".signqa"','versionNameSuffix = "-signqa"','isDebuggable = false','trialum-signqa']) {
  assert(g.includes(s),'Missing signed QA separation: '+s);
}
for(const s of ['create("lwa")','create("lw16")','versionCode = 35','versionName = "1.6-LW-dev.12"']) {
  assert(g.includes(s),'Historical or current QA configuration removed: '+s);
}
assert(q.includes('<string name="trialum_app_label">Trialum Signing QA</string>'));
assert(q.includes('<string name="trialum_invite_scheme">trialum-signqa</string>'));
for(const x of ['create("signdebug")','initWith(getByName("release"))','applicationIdSuffix = ".signdebug"','versionNameSuffix = "-signdebug"','isDebuggable = true','trialum-signdebug']) {
  assert(g.includes(x), 'Missing owner-signed Friends Debug package: '+x);
}
assert(d.includes('<string name="trialum_app_label">Trialum Friends Debug</string>'));
assert(d.includes('<string name="trialum_invite_scheme">trialum-signdebug</string>'));
assert(!g.includes('applicationIdSuffix = ".debug"'), 'Never reuse historical main debug package ID');
assert(!g.includes('TRIALUM_RELEASE_STORE_PASS'),'Never place signing credentials or release signing logic in Gradle source');
const y=fs.readFileSync('.github/workflows/android-signing.yml','utf8');
assert(y.includes('workflow_dispatch:'));
assert(y.includes("github.ref == 'refs/heads/main'"));
assert(y.includes('TRIALUM_RELEASE_KEYSTORE_B64'));
assert(y.includes('TRIALUM_QA_KEYSTORE_B64'));
assert(y.includes('apksigner'));
assert(y.includes("github.actor == 'extreme4music-nexus'"), 'Manual signing must be owner-only on main');
assert(y.includes('RELEASE_CERT_SHA256') && y.includes('QA_CERT_SHA256'), 'Both signing certificates must be pinned');
assert(y.includes('Signer #1 certificate SHA-256 digest:'), 'Signed artifact must be checked against its public cert pin');
assert(y.includes('sign_one release') && y.includes('sign_one signqa') && y.includes('sign_one signdebug'),
  'All three owner-signed APK families must be generated together');
assert(y.includes('for variant in release signqa signdebug; do'),
  'Check manifest/package and Friends backend URL for all three APKs');
assert(y.includes('assembleRelease :app:assembleSignqa :app:assembleSigndebug'),
  'Release, QA and Friends Debug must compile from the same source');
assert(y.includes('com.trialum.ziivaiskra.signdebug 1.6-LW-dev.12-signdebug "$work/qa.p12"') &&
  y.includes('trialum-qa "$QA_CERT_SHA256" QA_STORE_PASS QA_KEY_PASS true'),
  'Friends Debug MUST share fixed QA private key and SHA256 pin, not Release or transient debug signer');
assert(y.includes('trialum-qa "$QA_CERT_SHA256" QA_STORE_PASS QA_KEY_PASS false'),
  'Existing Signing QA must retain the same permanent signer');
assert(y.includes('if [ "$expects_debug" = true ]; then') &&
  y.includes('elif [ "$expects_debug" = false ]; then'),
  'Require debuggable only for Friends Debug and reject it for Release and Signing QA');
assert(y.includes("versionCode='35'") && y.includes('version_code=35'),
  'Increment package versionCode for existing QA updates (never reuse v24)');


// Friends regression: the signed build (not just the historical debug APK)
// must carry the user-configured HTTPS endpoint into the native Android
// string resource for BOTH the Release and SignQA APK variants.
assert(y.includes('TRIALUM_SOCIAL_API_URL: ${{ vars.TRIALUM_SOCIAL_API_URL }}'),
  'Owner signing workflow lost Friends server variable');
assert(y.includes('"-PtrialumSocialApiUrl=$social_url"'),
  'Owner signing workflow did not pass Friends HTTPS endpoint to Gradle');
assert(y.includes('GitHub Actions Variable TRIALUM_SOCIAL_API_URL is required'),
  'Owner signing must fail closed rather than publish an offline-looking Friends APK');
assert(y.includes('dump --values resources') &&
  y.includes('grep -Fq "$social_url"'),
  'Both compiled APKs must be checked for embedded Friends URL before signing');
assert(y.includes('TRIALUM_FIREBASE_APP_ID: ${{ vars.TRIALUM_FIREBASE_APP_ID }}'),
  'Signed builds should not discard previously supported opt-in Firebase config');
assert(g.includes('resValue("string", "trialum_social_api_url", socialApiUrl)'),
  'Native Android resource for Friends server must remain configured');

// The older CI workflow must NEVER publish runner-generated Android debug APKs.
// This is the regression guard against installation/update failures caused by
// a new debug certificate on each GitHub-hosted build.
const oldCi = fs.readFileSync('.github/workflows/build-android.yml','utf8');
assert(!/path:\s*android-template\/app\/build\/outputs\/apk\//.test(oldCi),
  'Never publish a temporary debug APK from legacy CI; use pinned GitHub signing instead');
assert(!oldCi.includes('name: Trialum-Android-1.6-LW-dev-debug'),
  'Legacy debug artifact name must not be distributable');
assert(!oldCi.includes('name: Trialum-1.6-LW-Isolated-Test-APK'),
  'Legacy .lw16 debug artifact must not be distributable');
// Explicit owner authorization now allows signing automatically for *trusted
// main push* or an owner-manual main dispatch. PRs remain strictly no secrets.
const trustedMain = "github.ref == 'refs/heads/main' && (github.event_name == 'push' || (github.event_name == 'workflow_dispatch' && github.actor == 'extreme4music-nexus'))";
assert(y.includes('Store UNSIGNED candidates for same-run signing only\n        if: '+trustedMain),
  'Unsigned APK handoff must be restricted to trusted main signing jobs');
assert(y.includes('needs: preflight\n    if: '+trustedMain),
  'Permanent signing must never run on pull requests or untrusted branches');
assert(y.includes('needs: sign\n    if: '+trustedMain),
  'Git-sync publishing must happen only after protected owner-key signing');
assert(y.includes("      - main") && y.includes("      - 'js/**'"),
  'Merging a game source change into main must trigger an automated signed build');
assert(y.includes("permissions:\n      contents: write") &&
  y.includes("name: Sync owner-signed Android apps into Git for desktop pull"),
  'Only the separate verified-artifact publish job may write back to Git');
assert(y.includes('git ls-remote origin refs/heads/main') &&
  y.includes('if [ "$remote" != "$GITHUB_SHA" ]; then'),
  'Must never overwrite a newer source commit with stale signed APKs');
for(const dest of [
  'artifacts/android/Release',
  'artifacts/android/Signing-QA',
  'artifacts/android/Friends-Debug'
])assert(y.includes(dest),'Missing permanent APK Git sync destination '+dest);
assert(y.includes('signing_certificate_sha256=$cert') &&
  y.includes('apk_sha256=$sha') &&
  y.includes('apksigner" verify --verbose --print-certs'),
  'Git-sync step must reverify APK content, provenance and certificate');
const ignore=fs.readFileSync('.gitignore','utf8');
for(const allowed of [
  '!artifacts/android/Release/Trialum-release.apk',
  '!artifacts/android/Signing-QA/Trialum-signqa.apk',
  '!artifacts/android/Friends-Debug/Trialum-signdebug.apk'
])assert(ignore.includes(allowed),'Missing exact verified APK path allowlist: '+allowed);
for(const doc of [
  'artifacts/android/README.md',
  'artifacts/android/Release/README.md',
  'artifacts/android/Signing-QA/README.md',
  'artifacts/android/Friends-Debug/README.md',
  'artifacts/windows/README.md',
  'artifacts/ios/README.md'
])assert(fs.existsSync(doc),'Missing platform artifact folder '+doc);
assert((y.match(/name: trialum-internal-unsigned-builds-DO-NOT-INSTALL/g)||[]).length===2,
  'Internal unsigned APK handoff producer/consumer must use the same name');
assert(!/release\W+upload-release-asset/.test(y),'Never auto-publish APK to GitHub Releases');
console.log('SIGNING PREFLIGHT PASS: signing stays on GitHub; package identity and saved worlds protected.');
