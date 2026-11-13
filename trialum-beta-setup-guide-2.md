# Trialum Beta — упатство за активирање на новото јавно репо

**Состојба (13.11.2026):** Приватниот `extreme4music-nexus/Trialum` е потврден и не е изменет. `extreme4music-nexus/trialum-beta` не постои. Поврзаниот GitHub конектор нема команда за креирање нов репозиториум, па за тоа е потребен еден рачен чекор на GitHub.

## 1. Креирање на GitHub (еден рачен чекор)

Отвори: https://github.com/new

- Owner: `extreme4music-nexus`
- Repository name: `trialum-beta`
- Description: `Official owner-approved Trialum beta source snapshots. Source available; all rights reserved.`
- Visibility: **Public**
- Add README: **Off**
- Add .gitignore: **Off**
- Choose a license: **None**
- Create repository.

**Зошто без автоматска лиценца?** Бидејќи е подготвена посебна сопственичка лиценца, а не MIT, GPL или друга open-source лиценца.

Ако GitHub App има пристап само до избрани репозиториуми, додади го и `trialum-beta` во дозволените репозиториуми на поврзаниот GitHub конектор. Потоа во разговорот напиши „Репото е креирано“, за да може да се наполнат подготвените 12 датотеки.

## 2. Што веќе е подготвено

Во `trialum-beta-public-starter.zip` се:
- двојазичен README;
- LICENSE (сопственички код / Source Available);
- TRADEMARKS, CONTRIBUTING, SECURITY и RELEASE_POLICY;
- детална контролна листа за одобрена бета;
- CODEOWNERS и issue templates;
- GitHub Actions workflow за основна јавна проверка;
- Python проверувач за основна хигиена и manifest gate.

**Нема код од приватниот Trialum во архивата.** Нема копирање на историја, гранки, клучеви, backend податоци или APK.

## 3. Поставки што треба да се активираат на јавното репо

Во Settings:
- Enforce branch protection / ruleset on `main`, block force pushes and branch deletions.
- Require pull request and CI checks for external proposals wherever plan supports them.
- Only owner-authorized maintainers get write/merge access.
- Enable secret scanning, push protection and private vulnerability reporting when available.
- Actions: restrict `GITHUB_TOKEN` to read-only by default.
- Do not add keystores, Android signing passwords, Play publishing credentials or production server secrets.

`CODEOWNERS` is documentation/review routing, not a substitute for GitHub access control.

## 4. Пред прва јавна бета

1. Затвори развојна фаза во приватното репо и земи точен commit SHA.
2. Одреди точно која бета е финално прифатена од сопственикот.
3. Провери правата за **постојната MIT-лиценца** во приватниот репо: каде е употребена, кои се авторите, и што веќе е лиценцирано. Ако има други носители на права, не менувај нивна лиценца без дозвола.
4. Инвентар на third-party код, модели, музика, фонтови и графика.
5. Направи нов јавен snapshot **без `.git` историја** и без лични/серверски податоци.
6. Изврши независно скенирање на тајни **пред push**, не само Actions по push.
7. Потврди owner QA, приватност, безбедност, backup/restore, Android build.
8. Додади `.trialum-release.json` со вистински commit и документирана согласност на сопственикот.
9. Јавен push само на провереното издание. Официјалните APK/AAB потпишувања остануваат **локални**.

## 5. Важни правни граници

- Public **не** е исто со open source; GitHub корисниците сепак имаат GitHub ToS право да гледаат и прават fork.
- Лиценцата не може да забрани независно создадена идеја или решение, ниту да поништи стари важечки MIT дозволи.
- Сопственичка лиценца може да се однесува само на деловите за кои издавачот ги има правата.
- Пред јавно објавување на играта се препорачува правна проверка за авторско право и лиценци.

**Кога новото репо ќе постои, приватниот `Trialum` останува недопрен.**
