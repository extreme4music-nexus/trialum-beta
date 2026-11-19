# v40 localization and Android optimization

- Beta version: `1.1.1`, Android `versionCode 40`; package identity remains `com.trialum.ziivaiskra`.
- Scope: complete app localization and User Agreement translation; no gameplay feature changes.
- `locales/en.json` is the canonical source. Every supported locale now has matching coverage: 876 interface strings and 1,035 dynamic word mappings. The User Agreement is bundled in English and each of the 16 non-English locales.
- The first-run agreement records acceptance as local version 40. Social consent continues to use its existing versioned record.
- The default theme is dark. Existing explicit system/light/dark preferences remain intact; an untouched legacy system default migrates to dark.
- Release-derived Android builds enable R8 shrinking, optimization, obfuscation and resource shrinking. `proguard-rules.pro` preserves the annotated WebView bridge methods. Keep the `internalBeta` mapping file with the AAB for crash deobfuscation.
- GitHub Actions builds unsigned candidates only. The owner signs the AAB locally; this change does not publish a Play release.

The non-English catalog and agreements were machine-translated from the canonical English content. Native-speaker review of legal wording is recommended before treating a translation as authoritative legal text.
