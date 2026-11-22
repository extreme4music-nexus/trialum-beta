'use strict';
// Recovery gate: assert the user's last verified LW-A work is still bundled.
// Source-level guard; the real-world backup and data remains unmodified.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
for(const p of [
 'android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumBackupVault.kt',
 'docs/BACKUP_DATA_SAFETY_20261110.md',
 'android-template/app/src/main/res/xml/trialum_backup_rules.xml',
 'js/presence.js','server/src/presence.mjs','server/sql/006_pet_presence.sh',
 'tests/presence.test.cjs','server/tests/presence.integration.mjs',
 'tests/theme-preview.html'
])assert(fs.existsSync(path.join(root,p)),'Missing LW-A source or safety artifact: '+p);
const backup=read('android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumBackupVault.kt');
for(const needle of ['noBackupFilesDir','rescue_keep_','verifyFile(pending, bytes)',
 'MediaStore.Downloads.EXTERNAL_CONTENT_URI','IS_PENDING','exportToDownloads','exportToFolder',
 'MessageDigest.isEqual','verifyFile','UUID.randomUUID','fun snapshot(']){
 assert(backup.includes(needle),'LW-A verified backup vault contract missing: '+needle);
}
const activity=read('android-template/app/src/main/java/com/trialum/ziivaiskra/MainActivity.kt');
for(const needle of ['TrialumBackupVault(this)','saveSafetySnapshot','listRescueBackups',
 'restoreRescueBackup','backupVault.exportToDownloads','backupVault.snapshot']){
 assert(activity.includes(needle),'LW-A Android backup bridge missing: '+needle);
}
const app=read('js/app.js');
for(const needle of ['if(!rescueSnapshot(true))throw Error','globalThis.TrialumNativeBackupVaultList',
 'saveSafetySnapshot','Presence?.ensure(s)','TrialumNativeBackupReceived']){
 assert(app.includes(needle),'LW-A game restore/presence integration missing: '+needle);
}
const html=read('index.html');
assert(html.includes('js/presence.js'),'LW-A presence module missing from HTML');
const gradle=read('android-template/app/build.gradle.kts');
for(const needle of ['create("lwa")','applicationIdSuffix = ".lwa"',
 'trialum-lwa','versionName = "1.6-LW-dev.12"','versionCode = 35',
 'create("lw16")','applicationIdSuffix = ".lw16"','trialum-lw16']){
 assert(gradle.includes(needle),'Parallel build separation missing: '+needle);
}
const locale=JSON.parse(read('locales/en.json'));
assert(locale.strings['Не успеав да го зачувам вратениот свет. Тековната игра останува непроменета.'],
 'Recovery lost English safe-restore message');
const css=read('assets/style.css');
assert(css.includes('155-04: Trialum\'s original layered visual language'),
 'Daylight theme not restored');
console.log('RECOVERY PASS: 1.6-LW backup vault, pinned rescues, presence, legacy LW-A and new isolated LW16 app, theme and English all present.');
