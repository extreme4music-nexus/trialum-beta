> **TRIALUM 1.5.5 — тековен статус; овој документ е историска основа.** План за Google Play Console по 15 ноември 2026: developer account, signing/AAB, Privacy Policy/Data Safety, дозволени testers и Google Play Games јавни ID-а/OAuth/SHA-1. Плаќањата преку Play Billing, refunds и верификација се идни фази, не 1.5.5. [Канонски план](../PROJECT_ROADMAP.md) · [Релис и тестови](RELEASE_V1.5.5.md).

---

> **1.5.5 CURRENT DEVELOPMENT — 8 November 2026:** Android SDK36 (`versionCode 21`, `versionName 1.5.5`), offline 17-language selection (15 additional starter catalogs with English fallback), system/light/dark themes, welcome/tutorial and opt-in advanced Mnemos on-device Qwen 0.5B/1.5B models. Real Play Games OAuth/cloud, large-model phone performance, complete community translation review and public store publishing are **not yet certified**. [Canonical roadmap](../PROJECT_ROADMAP.md) · [1.5.5 release/QА](RELEASE_V1.5.5.md) · [localization coverage](LOCALIZATION_V1.5.5.md). Historical documentation below describes earlier versions.

Play Console signup intended only after 15 November 2026. Production release still requires developer enrollment, signing/AAB, legal Privacy Policy, Data Safety, testers, PGS public IDs/OAuth and Google billing review. **No payments enabled in 1.5.5.**

---

# ТРИАЛУМ 1.4.1 — Google Play подготовка

> **Актуелен развоен статус — ТРИАЛУМ 1.5.4 / Google Play Games:** SDK 36 останува потврден од 1.5.3, а во посебната `feature/trialum-v1.5.4-play-games` гранка е додаден Google Play Games Services v2 (профил, постигнувања, рангирања, Cloud Save и Cloud Restore). **Без реален Play Console Game project ID, OAuth сертификат, Saved Games ON и одобрени тестери интеграцијата останува неконфигурирана**; локалната игра и JSON Бекап и враќање не се менуваат. Реалната Google синхронизација и судир меѓу две облачни верзии сè уште чекаат тест на два уреда. [Целосно упатство](GOOGLE_PLAY_GAMES_V1.5.4.md).

## Нови Play Console / приватност ставки за 1.5.4

- [ ] Дополнително: [Play Games Services проект, Android OAuth + SHA-1, Saved Games ON, Achievements, Leaderboards и тестери](GOOGLE_PLAY_GAMES_V1.5.4.md).
- [ ] Освежи Privacy Policy и Data Safety за **Google Play Games gamer profile, achievements, leaderboard submission, Google Saved Games и Google network metadata**, според реалните поставки.
- [ ] Не наведувај „никакви надворешни услуги“ по активирање PGS. Без конфигурација, локалното играње е независно.
- [ ] Debug сертификатот и продукцискиот Play App Signing сертификат можат да имаат различни SHA-1 и двата мора правилно да се регистрираат за тест/production.
- [ ] Тестирај Google профил и cloud restore со ист Google Play Games акаунт на два телефони пред да се размислува за официјален release.


> **Актуелна развојна фаза — 1.5.3 (Android SDK 36):** изолиран Android build врз потврдената 1.5.2. `compileSdk=36`, `targetSdk=36`, `versionCode=19`, Gradle/AGP/Kotlin ажурирани само за компатибилност. **Игровните механики и локалниот LLM/P2P не се менуваат.** Главната `main` останува 1.4.1; ова **не е RTM**. Потребна е физичка проверка на телефонот пред следната фаза. [Точен SDK36 план и QA](ANDROID_SDK36_V1.5.3.md).


> **Статус на 8 ноември 2026:** ТРИАЛУМ **1.5.1** е **развојна Android/HTML beta** во гранката `feature/trialum-v1.5.1-final-polish`. Стабилната `main` сè уште е **1.4.1**. Не е RTM, Play Store release или потврдено функционална на физички Android уред. Пред експериментално инсталирање на debug APK извези JSON од 1.4.1; различни debug потписи можат да бараат деинсталација.

## Развојна надградба 1.5.1 — што е ново

- **Еволутивен 2.5D Canvas приказ** со послоевити сенки, заоблени перки/жабри, органски гребени, динамични очи и изрази на лицето. Старите едноставни форми остануваат во раните нивоа, а преминот започнува околу лично ниво 18 и завршува околу 44.
- **Научени трикови:** краток допир изведува позната вештина; долг допир/контекстно мени ја прикажува личната листа на научени вештини; копчето „Покажи трик“ се наоѓа под Миленици → Обука. Повторувањето на вештина не троши нова акција.
- **Медиуми:** избор PNG, 4-секунден GIF (12 fps), или 5-секундно видео, реален преглед пред зачувување, системско споделување и GIF fallback ако WebView нема поддржан video encoder. Во Android API 29+ зачувува во `Pictures/Screenshots` или `Movies/TRIALUM` преку MediaStore; API 26–28 има app-specific fallback. Форматот MP4 не е гарантиран на секој Android WebView.
- **Пократки менија:** sticky HUD, склоплив интерактивен биосвет, детали за миленик само во неговото мени и склопливи каталози, вештини и истражувачки списоци.
- **Јазици:** MK/EN каталози со избор во Поставки, без промена на кориснички имиња и стари дневнички записи. **Динамичните англиски текстови се предмет на финална проверка**; не се тврди дека преводот е 100% потврден.
- **Миграција:** старите 1.4.1 и 1.5.0 светови се прифаќаат, а зачувувањето при работа со 1.5.1 не треба да ги губи милениците, XP, ДНК, историјата или научените вештини. Сè уште е потребен вистински тест на телефон.

**Не се менуваат:** Android `minSdk=26`, `compileSdk=35`, `targetSdk=35`, системот за локални LLM модели, P2P или платежниот статус (без активни купувања). Android build во развојната гранка има `versionName 1.5.1` и `versionCode 17`.

**Тест-gate:** engine/evolution/progression/longplay/UI/creature-media, GIF декодирање, Android `assembleDebug`, визуелен preview; потоа физичко QA за GIF/видео, MediaStore, ориентација, англиски текстови и старите светови. **CI PASS не е доказ за Android UX.**


**Ажурирано: 8 ноември 2026 · статус: НЕ Е ОБЈАВЕНО.** Овој документ е checklist за *идна* публикација. Не се активираат наплата, production signing, кориснички сметки или објавување.

**Статус:** ТРИАЛУМ **1.4.1** е постојниот функционален **debug/test build** и **можен релис-кандидат по неколкудневно рачно тестирање**. Не е прогласен за конечен релис, нема Play Store објава и оваа документациска ревизија **не менува код, APK или број на верзија**.

**Google Play не е предмет на сегашниот тест-период.** Прво неколку дена го проверуваме 1.4.1 како можен релис-кандидат; откако ќе се решат критичните проблеми, одделно ќе се планира Play compliance. Актуелната официјална [Google Play API политика](https://support.google.com/googleplay/android-developer/answer/11926878) бара `targetSdk 36+` за нови телефонски апликации од 31 август 2026; `targetSdk 35` на ТРИАЛУМ сè уште е непроменет.
## Моментална техничка состојба

| Ставка | Состојба |
|---|---|
| Android package/application ID | `com.trialum.ziivaiskra` |
| Android верзија | `versionName 1.4.1`, `versionCode 15` |
| Android SDK | `minSdk 26`, `compileSdk 35`, `targetSdk 35` |
| Android Gradle Plugin / Gradle | 8.7.3 / CI 8.9 |
| Дистрибуција сега | GitHub Actions **debug APK** за тестирање, не потпишан production AAB |
| Библиотеки | WebView, WorkManager, AndroidX, native локален `llama.cpp` runtime |
| Дополнителен модел | Смол GGUF пакет во GitHub Releases, не е во APK |

**Важно:** од **31 август 2026** нови Android телефонски апликации и ажурирања за Google Play треба да таргетираат **Android 16 / API 36+**. Актуелниот `targetSdk=35` не ги исполнува барањата за ново објавување во ноември 2026. Види: https://support.google.com/googleplay/android-developer/answer/11926878.

## Пред да започне Play Console објавување

- [ ] Отвори Google Play Console developer account; заврши identity/contact verification. Регистрацијата обично има еднократна такса **US$25**. https://support.google.com/googleplay/android-developer/answer/6112435
- [ ] Ако е нов **личен** developer account создаден по 13.11.2023, испланирај **12 континуирано пријавени тестери за најмалку 14 дена**, по што се бара production access. Правилото зависи од типот/датумот на account. https://support.google.com/googleplay/android-developer/answer/14151465
- [ ] Задржи го постојниот `applicationId` ако сакаш истиот идентитет на апликацијата, а зголемувај `versionCode` за секој следен Play build.
- [ ] Надгради ги `compileSdk` и `targetSdk` на API 36+, со соодветна AGP/Gradle верзија, па повтори регресија и физички Android тестови.
- [ ] Создај **приватен upload keystore**, не го прикачувај во Git, ZIP или логови; постави **Play App Signing**, направи потпишан **`.aab`** (`bundleRelease`), не само `assembleDebug`.
- [ ] Провери upgrade од debug до production signing: debug APK може да бара деинсталација поради потпис. **Извези JSON и тестирај restore пред какво било бришење на локални податоци.**

## Физичко QA — не заменувај со „Build Successful“

- [ ] Почетен свет, првите минути, премини и ресурси; долг свет со многу миленици/флора.
- [ ] 5 главни и сите секундарни менија; Живеалишта, ДНК, Пријатели, Дневник, Поставки.
- [ ] JSON backup/import преку Storage Access Framework; screenshot и sharesheet/FileProvider.
- [ ] Push не е потребен за нотификации: провери `POST_NOTIFICATIONS`, звучен notification channel, launcher badge и WorkManager одложувања при Doze/Battery Saver.
- [ ] WebRTC P2P на иста Wi-Fi и на различни мобилни мрежи, со и без STUN; документирај NAT ограничувања.
- [ ] Опционален SmolLM2-135M GGUF: преземање/откажување, checksum, простор, CPU/RAM/батерија/температура, локален чат и прекин кога апликацијата е неактивна.
- [ ] Возрасни категории, пристапност, локализација и стабилност на вистински Android уреди.

## Play Store листинг

- [ ] Икона **512×512 PNG**; feature graphic **1024×500** (дозволен формат според Play Console).
- [ ] Вистински screenshots од апликацијата (не mockup со функции што не работат).
- [ ] Краток/долг опис, контакт e-mail, category, content rating и target audience.
- [ ] Јавно достапна URL за **Privacy Policy**, точна **Data safety** декларација и процена на применливите Families/child-directed барања.

Официјални упатства: https://support.google.com/googleplay/android-developer/answer/9866151 · https://support.google.com/googleplay/android-developer/answer/10787469 · https://support.google.com/googleplay/android-developer/answer/9842756.

## Приватност и надворешни услуги — потврди фактички пред декларација

- **Локално:** свет, миленици, дневник, DNA варијанти, фотографии, истражување, бесплатни кредити и chat history.
- **P2P:** при директна WebRTC врска се разменуваат доброволно избрани профилни/миленички податоци и можни мрежни адреси. Опционален јавен Google STUN открива мрежни метаподатоци. Нема сопствен gaming backend и нема cloud sync.
- **LLM:** GGUF тежини се преземаат од pin-уван Hugging Face URL по експлицитно корисничко барање; самата генерација на одговор е локална. Преземањето може да открие IP/network metadata на надворешниот hosting provider. Проверувај лиценца, checksum, CDN политики и трети страни.
- **Android system Sharesheet:** корисникот сам избира трета апликација. Таа може да обработува содржина според своите правила.
- **Нема рекламен SDK, активни купувања или платежни информации** во оваа верзија. Не тврди „не собира никакви податоци“ пред да направиш целосна проверка на Android permission/network однесувањето.

## Идни плаќања — исклучени

Играта во 1.4.1 **не продава** истражувачки кредити и нема активни billing производи. Ако подоцна се воведуваат реални купувања за виртуелни токени или забрзување, прво провери ги тековните **Google Play Payments** правила и интегрирај Play Billing со серверска/серверлес проверка на трансакции, двојно исполнување, откажувања и refund-и. Не е задолжителен посебен хост за P2P играта, но client-only доверба во купувањата не е доволна.

Референци: https://support.google.com/googleplay/android-developer/answer/9858738 · https://developer.android.com/google/play/billing.

## Ограничување

Овој checklist **не е потврда за Play compliance** и не е инструкција за објавување сега. При реалното објавување, повторно провери ги тековните Google Play правила. Поврзано: [ANDROID.md](ANDROID.md) · [UI_QA_V1.4.1.md](UI_QA_V1.4.1.md).
