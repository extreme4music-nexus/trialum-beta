'use strict';
/* TRIALUM FORWARD-ONLY ACCEPTANCE GATE — no hidden regression across milestones.
   This is a source/contract regression, not a substitute for physical owner QA.
   To intentionally change an owner-accepted contract, document the decision and
   update this baseline/test in the SAME reviewed PR. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const baseline=JSON.parse(file('tests/forward-only-baseline.json'));
const golden=JSON.parse(file('tests/accepted-english-156-archive.json'));
const fullEnglish=JSON.parse(file('tests/accepted-english-complete-baseline-20261111.json'));
const en=JSON.parse(file('locales/en.json'));
const cy=/[\u0400-\u04ff]/u;

const valid=new Set(['OWNER_PASS','OWNER_ACCEPTED_AS_IS','CI_PASS_NOT_OWNER_ACCEPTED','PARTIAL_ACCEPTED_AS_IS']);
assert.equal(baseline.accepted.length,15,'Expected full accepted 1.5.5, 1.5.6, LW-A, signing coverage');
assert.equal(new Set(baseline.accepted.map(x=>x.id)).size,baseline.accepted.length,'Duplicate acceptance ID');
for(const item of baseline.accepted){
 assert(valid.has(item.status),'Unsupported or unverified acceptance status '+item.id);
 assert(item.evidence && (item.evidence.startsWith('https://')||exists(item.evidence)),'Missing proof reference '+item.id);
 for(const p of item.files){
  assert(exists(p),'Previously accepted feature '+item.id+' lost its source/test: '+p);
 }
 for(const [p,markers] of Object.entries(item.mustContain||{})){
  const s=file(p);
  for(const marker of markers){
   assert(s.includes(marker),'Previously accepted feature '+item.id+' lost invariant '+JSON.stringify(marker)+' in '+p);
  }
 }
}
for(const item of baseline.deferred){
 assert.equal(item.status,'DEFERRED','Deferred functionality cannot silently be marked owner-accepted: '+item.id);
 assert(!baseline.accepted.some(x=>x.id===item.id),'Deferred feature copied into locked accepted list: '+item.id);
}

// Historical owner-accepted social/playground/message English exact strings
// were accidentally lost when 1.5.5 and 1.5.6 branches diverged.
assert.equal(en.language,'en');
assert(Object.keys(en.strings).length>=690,'English exact-phrase catalog fell below the reconsolidated baseline');
assert(Object.keys(en.words).length>=985,'English fallback glossary was silently truncated');
assert.deepEqual(Object.keys(en.strings).sort(),fullEnglish.stringKeys,
 'English exact keys changed without a reviewed update to the full acceptance baseline');
assert.deepEqual(Object.keys(en.words).sort(),fullEnglish.wordKeys,
 'English glossary keys changed without a reviewed update to the full acceptance baseline');
// Key-preserving fixes are allowed: translate better rather than delete a label.
for(const [mk,value] of Object.entries(en.words)){
 assert(typeof value==='string'&&value.trim()&&!cy.test(value),
  'Accepted English glossary word was emptied or left Cyrillic: '+mk);
}

const archived=Object.entries(golden.strings);
assert.equal(archived.length,178,'Historical acceptance snapshot was silently edited or truncated');
for(const [mk,original] of archived){
 assert(typeof original==='string'&&!cy.test(original),'Broken archived English baseline '+mk);
 const now=en.strings[mk];
 assert(typeof now==='string'&&now.trim().length>0&&!cy.test(now),
  'Previously translated 1.5.6 UI text lost/left untranslated: '+mk);
}
for(const [mk,value] of Object.entries(en.strings)){
 assert(typeof value==='string'&&value.trim()&&!cy.test(value),'Cyrillic or empty English string for '+mk);
}
// Spot-check semantic contracts, not only number of entries.
for(const [mk,want] of Object.entries({
 'Создај профил':'Create profile',
 'Заедничка игротека':'Shared playground',
 'Пријателски пораки':'Friend messages',
 'Избриши социјален профил':'Delete social profile',
 'Пријател во близина':'Nearby friend',
 'Испрати покана за посета':'Send visit invitation',
 'Покана за заедничка игротека':'Shared playground invitation',
 'Отвори ја поканата:':'Open the invitation:',
 'Ако линкот не се отвори, внеси го кодот:':'If the link does not open, enter the code:'
})) assert.equal(en.strings[mk],want,'Semantically essential 1.5.6 English label changed: '+mk);

// IMPORTANT: Android share sheets are outside the WebView translation tree.
// The English invitation must REALLY render in English, not merely sit in JSON.
const oldI18n=globalThis.TrialumI18n;
try{
 globalThis.TrialumI18n={t:text=>en.strings[text]||text};
 const {inviteMessage}=require('../js/social.js');
 const token='a'.repeat(43);
 const message=inviteMessage(token,'https://friends.example');
 assert(message.includes('TRIALUM — friendship invitation'),'Shared invite was not translated');
 assert(message.includes('Open the invitation: https://friends.example/invite#'+token),
  'Shared invite HTTPS URL was not preserved or translated');
 assert(message.includes('If the link does not open, enter the code:'),
  'Shared invite fallback was not translated');
 assert(message.includes('The invitation is valid for 15 minutes.'),
  'Shared invite expiry notice was not translated');
 assert(!cy.test(message),'Shared English invitation still contains Cyrillic');
 globalThis.TrialumI18n={t:value=>value};
 assert(inviteMessage(token,'https://friends.example').includes('ТРИАЛУМ — покана за пријателство'),
  'MK share invitation stopped working');
}finally{
 if(oldI18n===undefined)delete globalThis.TrialumI18n;
 else globalThis.TrialumI18n=oldI18n;
}

// Status text is itself a regressive product contract. The implementation
// may be CI-PASS but must not be described as absent after PR #26; equally,
// never confuse source implementation with human/device acceptance.
const readme=file('README.md');
assert(readme.includes('session lifecycle/expiry is now implemented in source') &&
       !readme.includes('session lifecycle/expiry remains to be implemented'),
 'Root README shows an obsolete "LW-A sessions not implemented" development state');
const currentBaseline=file('docs/TRIALUM_1.6_LW_BASELINE.md').split('\n').slice(0,3).join('\n');
assert(currentBaseline.includes('merged into `main` by PR #26') &&
       currentBaseline.includes('NOT physically owner-accepted yet'),
 'Canonical baseline confuses source CI completion with owner-device acceptance');

// UI release identity must advance with the actual Living World source line.
const html=file('index.html');
assert(html.includes('ТРИАЛУМ 1.6-LW — Жива искра') &&
  html.includes('ТРИАЛУМ <span>1.6-LW</span>'),
  'Main menu silently reverted to the obsolete 1.5.6 beta identity');

// Recover the 1.5.6-F security patches that were never merged with its
// feature-gate branch. These are fail-closed client privileges/consent rules.
const activity=file('android-template/app/src/main/java/com/trialum/ziivaiskra/MainActivity.kt');
for(const marker of [
 'web.settings.allowFileAccess = false',
 'web.settings.allowContentAccess = false',
 'web.settings.allowFileAccessFromFileURLs = false',
 'web.settings.allowUniversalAccessFromFileURLs = false',
 'WebSettings.MIXED_CONTENT_NEVER_ALLOW',
 'setSupportMultipleWindows(false)',
 'safeBrowsingEnabled = true',
 'uri.scheme == "https"',
 'uri.host == host',
 'uri.port == -1',
 'startsWith("/assets/web/")'
])assert(activity.includes(marker),'1.5.6-F WebView security regression: '+marker);
const push=file('android-template/app/src/main/java/com/trialum/ziivaiskra/TrialumPush.kt');
assert(push.includes('getBoolean(ENABLED,false) && SocialCredentialVault.read(c).isNotEmpty()'),
 'Old restored FCM consent may reactivate without an active social identity');
for(const p of [
 'android-template/app/src/main/res/xml/trialum_backup_rules.xml',
 'android-template/app/src/main/res/xml/trialum_data_extraction_rules.xml'
]){
 const s=file(p);
 assert(s.includes('trialum_social_v1.xml')&&s.includes('trialum_push_v1.xml'),
  'Device-bound identity/consent may leak into Android Auto Backup: '+p);
}
const gradle=file('android-template/app/build.gradle.kts');
const version=Number(gradle.match(/versionCode\s*=\s*(\d+)/)?.[1]||0);
assert(version>=25,'Android versionCode must never roll back below accepted signed QA 25');
assert(gradle.includes('create("signqa")')&&gradle.includes('create("signdebug")'),
 'Owner-signed two-app Friends self-test package was lost');
const actions=file('.github/workflows/android-signing.yml');
for(const marker of [
 'TRIALUM_SOCIAL_API_URL',
 'apksigner" verify',
 'sign_one release','sign_one signqa','sign_one signdebug',
 'artifacts/android/Signing-QA','artifacts/android/Friends-Debug'
])assert(actions.includes(marker),'Protected Android signing/social artifact regression: '+marker);
console.log('FORWARD-ONLY PASS: 15 owner/CI-separated contracts, 178 legacy English strings, 690+ exact translations, 1.5.6-F security, signed Android continuity.');
