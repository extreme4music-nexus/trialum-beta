> **TRIALUM 1.5.5 — тековен статус; овој документ е историска основа.** Историски водич за 1.5.4. Во 1.5.5 Play Games v2 останува опционален, без OAuth конфигурација не се активира, JSON backup останува, Cloud Save на два уреди мора да се тестира по Play Console конфигурацијата. [Канонски план](../PROJECT_ROADMAP.md) · [Релис и тестови](RELEASE_V1.5.5.md).

---

# ТРИАЛУМ 1.5.4 — Google Play Games Services v2

**8 ноември 2026 · развојна beta · НЕ Е објавена во Google Play.**  
**Развојна гранка:** \`feature/trialum-v1.5.4-play-games\`.  
**Стабилната \`main\` останува ТРИАЛУМ 1.4.1.**  
Ова е самостојна фаза, изведена врз успешно тестираната 1.5.3 со Android SDK 36. **Нема нов LLM, нова еволуција, платени токени, реклами или промена на P2P протоколот.**

## Функционалност и статус

| Функција | Во кодот на 1.5.4 | Што треба за реална проверка |
|---|---|---|
| Локално играње без Google | **ДА**, без Play Console конфигурација | Android smoke test |
| Google Play Games v2 | **ДА**, \`play-services-games-v2:22.1.0\` | Регистриран PGS game project + Android OAuth |
| Опционален Google профил | **ДА**; вградени SDK authentication/status и опционален Sign in | Дозволен тестер, SHA-1 што се совпаѓа со APK |
| Achievements | **ДА**; мапирање на внатрешните „first-pet“, „first-plant“, „learned“, „advanced“, „ecology“, „lab6“ и „dna“ | Седум идентични постигнувања со вистински ID-а во Play Console |
| Leaderboards | **ДА**; вкупно XP и број различни видови | Две официјални leaderboards и нивните ID-а |
| Cloud Save | **ДА**; опционален автоматски upload по локално зачувување, компресија, проверка на checksum и конфликт | Saved Games ON во Play Console; тест на два уреда |
| Cloud Restore | **ДА**; и од почетниот екран по повторна инсталација | Реална Google најава и постоечка облачна снимка |
| Debug/рангирања | **ДА**; светови со debug активност не испраќаат резултати | Тест со вистински Play Games профил |
| Конфликт меѓу различни Google Snapshots | **ЗАШТИТЕНО**, не се презапишува автоматски | Рачно разрешување е сè уште ограничување; не тврди комплетна merge поддршка |
| Google Cloud sync потврден во живо | **НЕ** — потребни се Play Console поставки и физички тест | Тестери, OAuth и реално Save/Restore |

Самото компајлирање на APK **не значи** дека Google автентикација или Cloud Save се веќе проверени. Без твој Play Console проект и правилни OAuth/SHA-1 credentials новиот PGS дел покажува дека конфигурацијата недостасува, додека целата игра си работи офлајн.

## Како се користи

1. Во **Повеќе → Google Play Games** или **Повеќе → Поставки → Google Play Games** е достапен Google профил, официјални Achievements и Leaderboards, Cloud Save и Cloud Restore.
2. На првото стартување по реинсталација, и пред нов свет, добиваш избор **„Поврзи Google Play Games“** и **„Врати свет од Google Play Games“**. Можеш и да го прескокнеш.
3. По успешна Google најава, **„Провери облак“** ги чита облачните метаподатоци. Може да видиш последен ден, број миленици и верзија.
4. За првото автоматско зачувување избери **„Вклучи Cloud Save“** и потврди ја согласноста. Ова не е задолжително. Играта продолжува да се зачувува локално, без оглед на Google.
5. „Зачувај во облак“ иницира рачна синхронизација. Потоа играта автоматски испраќа нова компресирана снимка по успешен локален save, со ограничување на зачестеноста. Вистинското серверско синхронизирање може да доцни офлајн.
6. „Врати од облак“ го чита светот како **кандидат**, го проверува форматот и **бара потврда пред замена**. Локалната состојба се менува само откако запишувањето во IndexedDB/localStorage ќе успее.
7. JSON **Бекап и враќање** останува целосно достапен во Поставки, најмалку до RTM/Play Store релис.

## Архитектура и заштита на напредокот

- Состојбата останува во \`TrialumStorage\` (IndexedDB со localStorage резервна копија); никогаш не е зависна од најавување. Native WorkManager известувања, локален 135M LLM, P2P и MediaStore остануваат непроменети.
- Kotlin \`TrialumPlayGames.kt\` се поврзува со \`MainActivity.Bridge\`; JS \`js/play-games.js\` ги прикажува статусите и екранот, а при враќање го користи **постојниот сигурен JSON restore процес**.
- Google Snapshot slot: \`trialum_world_primary\`, GZIP со обвивка \`trialum-pgs-v1\`. Големина до **2.85 MB компресирано**, до **12 MB некомпресирано** како претпазливи лимити на нашата имплементација; официјалниот сервис има **3 MB по датотека**. Не го чува GGUF LLM моделот, само светот и податоците за милениците.
- Во Kotlin се чува SHA-256 на **последната успешно предадена** облачна снимка, одделно за секој Google профил. Автоматски upload се дозволува само ако актуелната облачна снимка одговара на тој SHA и **светот е истиот** (исти \`createdAt\` и \`seed\`). Ако е различен, upload **запира**.
- За создаден нов свет, увезен туѓ бекап или играње на два телефони нема тивка замена на облакот. Корисникот може да избере Cloud Restore или **изречно** да го замени облачниот свет по две потврди. Зачувај JSON пред тој чекор.
- Ако самите Google Snapshots вратат вистински **PGS SnapshotConflict**, кодот намерно **не избира „последен“ и не ги спојува автоматски**. Потребен е дополнителен безбеден flow за одлука; автоматското Cloud Save останува запрено.
- По локален restore, само ако \`S.save\` успее, JS го потврдува SHA на преземената снимка на Android. Откажано/невалидно враќање **не го менува светот** и не го означува облакот како синхронизиран.
- **Ограничување:** за многугодишни светови над 12 MB по компресијата ќе треба идно архивирање/делење на историјата во повеќе Saved Games слотови. Не ветувај неограничен Cloud Save во 1.5.4.
- PGS achievements/leaderboards се изведени од локалната игра. „Debug ever used“ и постојни debug записи ги исклучуваат. **Client-only рангирањата не се криптографска заштита од рачно изменет JSON**; за навистина конкурентски рангирања подоцна ќе треба дополнителна верификација.

## Конфигурација на Google Play Console — задолжителна пред тестирање на Google услугите

### A. Play Console и игра

1. Отвори **[Google Play Console](https://play.google.com/console)**. Потребен е валиден Google Play Developer account (регистрацијата и идентитетот се одделни од GitHub).
2. Создај/поврзи Android апликација со **\`com.trialum.ziivaiskra\`**. Нема потреба од јавно објавување за да се тестираат Play Games функции.
3. Под **Play Games Services → Setup and management → Configuration** создај/поврзи **Play Games game project**, најди неговиот **Game services project ID** (долга бројка), и поврзи **Android OAuth client** за истиот Android package.
4. Во Android OAuth конфигурацијата прикачи **точен SHA-1 fingerprint на сертификатот со кој е потпишан тестниот APK**. Ако во GitHub Actions секојпат се создава различен debug keystore, OAuth може да откаже. Затоа користи стабилен тестен keystore (во Secret, никогаш во репото).
5. Вклучи **Saved Games**: \`Grow users → Play Games Services → Setup and management → Configuration → Edit properties → Saved Games ON → Save\`. Активирањето може да доцни.
6. Создај **7 Achievements** и **2 Leaderboards**, забележи ги добиените API ID-а, и додај го својот Google профил како **PGS tester** во \`Play Games Services → Testers\`. Ако користиш тестна апликација, соодветните tester групи можат да се споделуваат.
7. Не е потребен сопствен cloud game server, Gmail, Google Drive или Firebase; ова е директно Play Games Saved Games.

Официјална документација: [PGS authentication](https://developer.android.com/games/pgs/android/android-signin) · [Enable Saved Games](https://developer.android.com/games/pgs/console/enable-features) · [Snapshots Android](https://developer.android.com/games/pgs/android/saved-games) · [PGS testers](https://support.google.com/googleplay/android-developer/answer/9845334).

### B. GitHub Actions променливи (јавни ID-а, НЕ тајни)

Во \`extreme4music-nexus/Trialum → Settings → Secrets and variables → Actions → Variables\`:

| Repository variable | Вредност од Play Console |
|---|---|
| \`TRIALUM_PGS_PROJECT_ID\` | **Game services project ID**, само бројки |
| \`TRIALUM_PGS_ACH_FIRST_PET\` | ID на \`first-pet\` |
| \`TRIALUM_PGS_ACH_FIRST_PLANT\` | ID на \`first-plant\` |
| \`TRIALUM_PGS_ACH_LEARNED\` | ID на \`learned\` |
| \`TRIALUM_PGS_ACH_ADVANCED\` | ID на \`advanced\` |
| \`TRIALUM_PGS_ACH_ECOLOGY\` | ID на \`ecology\` |
| \`TRIALUM_PGS_ACH_LAB6\` | ID на \`lab6\` |
| \`TRIALUM_PGS_ACH_DNA\` | ID на \`dna\` |
| \`TRIALUM_PGS_BOARD_XP\` | Leaderboard „Вкупен XP“ |
| \`TRIALUM_PGS_BOARD_SPECIES\` | Leaderboard „Откриени видови“ |

За користење без Google можеш да ги оставиш празни: кодот тогаш го прикажува „Потребна е Play Console конфигурација“, без да ја наруши играта. Не внесувај лажни ID-а.

### C. Стабилно потпишување (приватна GitHub Secret)

Во \`Actions → Secrets\` постави:

\`TRIALUM_PGS_DEBUG_KEYSTORE_B64\` — Base64 од тестен \`debug.keystore\` со стандарден alias \`androiddebugkey\` и лозинка \`android\`. **Ова е приватна содржина: не ја праќај во разговор, issue, Markdown, PR или јавен ZIP.**

Во GitHub Actions подготвената задача ја враќа датотеката во \`~/.android/debug.keystore\` само за тој CI build, за Google OAuth да го препознава истиот SHA-1. Ако нема Secret, се користи обичен краткотраен GitHub runner debug key и Play Games authentication **не е сигурна** меѓу build-ови.

За проверка на SHA-1 локално:
\`\`\`bash
keytool -list -v -keystore /path/to/debug.keystore -alias androiddebugkey -storepass android
\`\`\`

Публикацискиот **Play App Signing сертификат може да има друг SHA-1**, и тој ќе мора одделно да биде додаден во Google OAuth за официјалниот Play release.

### D. Изградба и независна проверка

GitHub workflow: \`Build Trialum Android APK\` → \`feature/trialum-v1.5.4-play-games\` → \`Run workflow\`. Првично без Play Console ID-ата се добива компајлиран **debug APK со безбеден исклучен PGS режим**; откако ќе ги поставиш \`Variables\` и \`Secret\`, пушти нов build за **вистинска тестна најава**.

Локално, со јавни ID-а:
\`\`\`bash
gradle -p android-template :app:assembleDebug \
  -PtrialumPgsProjectId=1234567890 \
  -PtrialumPgsAchievement_first_pet=YOUR_REAL_ID \
  -PtrialumPgsLeaderboard_xp=YOUR_REAL_ID
\`\`\`
Овие вредности се **пример**, не активна конфигурација.

## Задолжителен физички QA пред следна верзија

- [ ] Offline чист старт без Google или со Google што не може да се најави: **без краш, без изгубен свет, без задолжителна регистрација**.
- [ ] Точен Play Console проект, Android OAuth SHA-1, дозволен Google тестер: успешна Google профилна најава.
- [ ] Achievements и Leaderboards: отварање Google UI, отклучување од реален настан, score submission за нормален свет; debug светови не испраќаат резултати.
- [ ] Вклучување Cloud Save со изречна согласност, правење промени, upload, интернет паузи, повторно поврзување и читање на зачуваниот ден/миленици.
- [ ] Деинсталација **само откако JSON бекапот е проверен**, реинсталација и враќање на сите миленици/ДНК/вештини/дневник преку истиот Google профил.
- [ ] Два телефони со различни еволутивни состојби: блокирано автоматско презапишување, јасни избори, потврда пред замена.
- [ ] Откажано Cloud Restore и намерно погрешен/несовместлив облачен payload: не се уништува локалниот свет.
- [ ] Android SDK36 старите тестови: биосвет, 2.5D очи, скролање, GIF/видео, локален LLM, P2P, звук, нотификации, JSON backup/import.
- [ ] MK/EN сите Play Games пораки и копчиња; изменета Privacy Policy/Data Safety декларација за Play Games и Google cloud пред јавен Play релис.

## Безбедносна ревизија на облачниот напредок (8 ноември 2026)

- **Промена на Google профил:** привремените JS состојби, рангирања и облачни контроли се чистат при промена на Play Games player ID. Native потврда за враќање важи само за истиот профил што ја започнал операцијата.
- **Нерешен Google SnapshotConflict:** контролата „Замени облачен свет“ се блокира; оваа верзија нема автоматски избор на победничка снимка. Потребно е посебно разрешување со зачувани копии, а не ризично тивко презапишување.
- **Грешка при читање од Google:** недостапна мрежа или OAuth/API грешка не се прикажува како „нема облачен свет“. Претходниот cloud статус не се брише погрешно.
- **Регресиони проверки:** автоматските JS тестови ги вклучуваат овие случаи, покрај потврда пред restore, opt-in Cloud Save и блокада на debug рангирања.
- **Не е физичка потврда:** вистинска Google најава, синхронизација и двоен уред мора да поминат со точни Play Console ID-а, OAuth/SHA-1 и дозволени тестери. До тогаш 1.5.4 е beta, не јавен RTM.

## Финална напомена

Верзијата **1.5.4 е развојна интеграција**; не е директно објавена Google игра ниту целосно потврдена cloud услуга. Не ги менува Play Console или Google Cloud поставките самостојно. Ако нема дозвола и ID-а, сите основни offline функции продолжуваат да работат. Следна фаза (поголем локален LLM и ретроградно отклучување кај Мнемос) се започнува **само по твоето тестирање** на овој одделен APK.
