/* v44 owner device findings: corrected on-screen version and mandatory complete offline licenses. */
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('all visible app-version labels agree on Trialum 1.4 v44',()=>{
 const page=read('index.html'),build=read('android-template/app/build.gradle.kts');
 assert(page.includes('<h1>TRIALUM <span>1.4 v44</span>'));
 assert(page.includes('Trialum — Living World 1.4 v44 Beta'));
 assert(!page.includes('Living World 1.0 Beta'));
 assert(build.includes('versionName = "1.4 v44"'));
 assert(build.includes('versionCode = 44'));
});
test('all APK build variants must bundle model notices and exact offline Android inventory',()=>{
 const gradle=read('android-template/app/build.gradle.kts');
 assert(gradle.includes('val bundleOfflineLicenseNotices by tasks.registering(Copy::class)'));
 assert(gradle.includes('dependsOn("generateLicenseReport")'));
 assert(gradle.includes('docs/licenses/MODEL-LICENSES.md'));
 assert(gradle.includes('docs/licenses/THIRD-PARTY-NOTICES.txt'));
 assert(gradle.includes('reports/licenses/licenses.json'));
 assert(gradle.includes('ANDROID-DEPENDENCY-LICENSES.json'));
 assert(gradle.includes('dependsOn(syncWebAssets, bundleOfflineLicenseNotices)'));
});
test('complete license page shows actual bundled sections even if optional single notice is missing',()=>{
 const bridge=read('android-template/app/src/main/java/com/trialum/ziivaiskra/LicensesBridge.kt');
 for(const file of ['THIRD-PARTY-NOTICES.txt','MODEL-LICENSES.md',
  'ANDROID-DEPENDENCY-LICENSES.json','APACHE-2.0.txt','ZZFX-MIT.txt',
  'llama-android-0.1.1/LICENSE','llama-android-0.1.1/THIRD-PARTY-NOTICES.txt']){
  assert(bridge.includes(file),file);
 }
 assert(bridge.includes('fun optional(file: String)'));
 assert(bridge.includes('runCatching'));
 assert(bridge.includes('Components: '));
 assert(!bridge.includes('The bundled third-party license notices could not be opened.'));
 const available=fs.readdirSync(path.join(__dirname,'../android-template/app/src/main/assets/licenses'));
 assert(available.includes('llama-android-0.1.1'));
});
test('publisher notices are rooted in the actual upstream and copied files',()=>{
 for(const p of ['docs/licenses/MODEL-LICENSES.md','docs/licenses/THIRD-PARTY-NOTICES.txt',
    'android-template/app/src/main/assets/licenses/APACHE-2.0.txt',
    'android-template/app/src/main/assets/licenses/ZZFX-MIT.txt',
    'android-template/app/src/main/assets/licenses/llama-android-0.1.1/LICENSE'])
  assert(read(p).length>600,p);
});
