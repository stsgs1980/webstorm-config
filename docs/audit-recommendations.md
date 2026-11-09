# Отчёт: рекомендации по проверке конфига и двум аудитам webstorm-config

## 1. Источники и версии

| Версия            | SHA                | Что даёт                     |
| ----------------- | ------------------ | ---------------------------- |
| Отчёт проверки    | 7313222            | конфиг IDE и прогоны         |
| Первый аудит      | 84d21a6            | P2 x2, P3 x5                 |
| Второй аудит      | 385cb7f            | P1 x1, P2 x1, P3 x2, INFO x3 |
| Сравнение аудитов | 84d21a6 -> 385cb7f | перекрёстная проверка        |

- Файлы-источники:
  - `Отчёт проверка файла.md` (Рабочий стол\Текущие задачи);
  - `Аудит webstorm-config от Zai.md` (первый);
  - `Аудит webstorm-config от Zai от 08 ноября 2026.md` (второй);
  - `Сравнение двух аудитов webstorm-config.md`.

- Проверенный HEAD на 09.11.2026: `385cb7f`, совпадает со вторым аудитом.
- Инцидент 09.11.2026: WebStorm перезаписала `.idea/codeStyles/Project.xml`;
  причина найдена и устранена (A17).
- Цель: свести находки в один план с приоритетами и критериями приёмки.
- Оформление: `docs/markdown.md` (строки ≤ 120, ASCII `->`, теги вместо emoji).

## 2. Что изменилось после повторного анализа

| Тема                                  | Было                        | Стало на 09.11.2026                         |
| ------------------------------------- | --------------------------- | ------------------------------------------- |
| Рабочее дерево `.idea/`               | 4 изменения, опции потеряны | [OK] проверено после перезапуска IDE        |
| Дубль `ProjectCodeStyleConfiguration` | warning в `idea.log`        | [OK] закрыто: с 07.11 warning нет           |
| Версия в `docs/webstorm.md`           | `2026.3.202`                | [OK] закрыто: `2026.3 (WS-263.7307.202)`    |
| Снапшот `npm audit`                   | 9 moderate на 84d21a6       | [FAIL] хуже: факт 0 vuln, текст 16 moderate |
| README broken link                    | P2 во втором аудите         | [OK] не подтвердилось: ссылка валидна       |
| Unicode-стрелки                       | не было в отчёте            | [TODO] новая: 17 + 5 строк                  |
| `.iml` project-name-locked            | не было в отчёте            | [TODO] новая: нет шага переименования       |
| minimatch / Dependabot #26            | 9 moderate                  | [OK] закрыто: 0 vuln всех уровней           |

## 3. Проверка фактов по репозиторию (HEAD 385cb7f)

| Факт                       | Проверка          | Результат                              |
| -------------------------- | ----------------- | -------------------------------------- |
| `git status --short`       | git               | чисто после отката                     |
| `codestyles/*.xml`         | сравнение         | глобальная схема синхронизирована      |
| `Project.xml`              | чтение            | 24 языка, кавычки, trailing comma, 120 |
| `check:style-consistency`  | прогон            | 33 mismatch -> green после фикса       |
| `profiles_settings.xml`    | чтение            | файл на месте                          |
| `npm audit --json`         | прогон            | 0 vuln всех уровней                    |
| `npm ls minimatch`         | прогон            | `11.0.5` во всех ветвях                |
| `README.md` (25)           | `git show`        | ссылка валидна на 3 SHA                |
| `test:e2e`                 | grep README       | только строка 55 (маркер)              |
| `.superpowers/`            | grep `.gitignore` | 0 совпадений                           |
| `style-consistency`        | grep по `md`      | 0 совпадений                           |
| `getting-started.md` (139) | чтение            | не та секция EditorConfig              |
| migration scripts          | чтение            | нет двух lint-скриптов                 |
| Unicode U+2192             | grep `docs/`      | webstorm.md 17, live-templates 5       |
| `.idea/modules.xml`        | чтение            | хардкод `webstorm-config.iml`          |
| CHANGELOG vs pre-push      | чтение            | entry есть, хука нет                   |
| `idea.log`                 | grep              | нет `duplicated name` с 07.11          |
| watcher Markdownlint       | чтение            | `node.exe` + `node_modules`            |
| coverage gate              | grep `ci.yml`     | шага coverage нет                      |
| `scripts/*.ts` (лимит)     | `wc -l`           | 238, 238, 236; лимит 250               |
| `799512d` в CHANGELOG      | `git grep`        | chore не попадает в changelog          |

## 4. План действий

Приоритет: P1 — срочно, P2 — документация, P3 — гигиена, INFO — решение.

### P1

#### A1. [TODO] Обновить снапшот `npm audit` в `SECURITY.md`

- Источник: второй аудит P1; сравнение аудитов №1.
- Проблема: `SECURITY.md` (строки 34-52) датирован 2026-11-03 и говорит
  «0 high и 16 moderate», «minimatch 10.2.6 и пять копий 3.1.5».
- Факт на 09.11.2026: `npm audit --json` -> 0 vuln всех уровней;
  `npm ls minimatch` -> только `11.0.5`.
- Причина: override `minimatch: ">=11.0.1"` от 08.11.2026 закрыл цепочку.
- Действие: переписать раздел «npm audit»: 0 vuln по всем уровням, дата
  снимка 2026-11-08, причина — override; убрать абзац про 16 moderate.
- Приёмка: цифры в `SECURITY.md` совпадают с `npm audit --json`.

### P2

#### A2. [TODO] Задокументировать гейт `check:style-consistency`

- Источник: первый аудит P2-1; сравнение №2.
- Проблема: скрипт есть в `package.json` (строка 72), CI — `ci.yml`
  (строки 37 и 99), но в `*.md` 0 упоминаний.
- Риск: пользователь форка не знает, что CI упадёт при рассогласовании
  `.editorconfig`/`.prettierrc`/`Project.xml`.
- Действие: добавить строку в таблицу скриптов `README.template.md`, в
  `AGENTS.md` §11, в Step 5 и Verify `getting-started.md`, строку в таблицу
  «Где проверяется каждое правило» `docs/webstorm.md`.
- Приёмка: `grep` находит все места; `npm run check:docs` зелёный.

#### A3. [TODO] Починить миграционный путь `getting-started.md`

- Источник: первый аудит P2-2; сравнение №3.
- Проблема: scripts-блок миграции (строки 232-245) не добавляет
  `lint:prettier-conflicts` и `lint:metrics`; список копирования (172-185)
  не включает `eslint.metrics.config.js`; Verify (254-256) эти команды зовёт.
- Действие: дополнить блок scripts и список конфигов либо убрать команды из
  Verify; заодно добавить `check:style-consistency` (см. A2).
- Приёмка: чистый проект по инструкции проходит Verify без «missing script».

### P3

#### A4. [TODO] Согласовать правило о прямых коммитах в `main`

- Источник: первый аудит P3-2; сравнение №4.
- Проблема: `AGENTS.md` §6 запрещает прямые коммиты в `main`. С 23.10.2026
  последний merge — PR #15, дальше 121 коммит без merge (проверено
  `git log --no-merges --since=2026-10-23`).
- В аудитах число расходится: 121 в первом, 119 в сравнении; локально — 121.
- Действие: вернуться к PR-дисциплине или явно оговорить исключение для
  соло-мейнтейнера.
- Приёмка: `AGENTS.md` §6 не противоречит `git log --merges`.

#### A5. [TODO] Убрать `test:e2e` из маркера `README.md` (строка 55)

- Источник: первый аудит P3-3; сравнение №5.
- Проблема: маркер `<!-- check-docs:allow-missing-scripts dev test:e2e -->`
  разрешает `test:e2e`, но в тексте `README.md` он не упоминается.
- В `README.template.md` (строка 105) маркер обоснован — там `test:e2e` есть.
- Действие: убрать `test:e2e` из маркера `README.md`.
- Приёмка: каждое имя маркера встречается в тексте своего файла.

#### A6. [TODO] Добавить `.superpowers/` в `.gitignore`

- Источник: первый аудит P3-4; сравнение №6.
- Проблема: `eslint.config.js` и `eslint.metrics.config.js` игнорируют
  `.superpowers/**`, но `.gitignore` — нет (рядом с `.agents/`, `.opencode/`,
  `.awb/`).
- Действие: добавить `.superpowers/` в `.gitignore`.
- Приёмка: `git status` чист при локальном `.superpowers/`.

#### A7. [TODO] Исправить цитату `.editorconfig` в `getting-started.md`

- Источник: первый аудит P3-5; сравнение №7.
- Проблема: строка 139 говорит, что `.editorconfig` задаёт
  `max_line_length = 120` в секции для Markdown, но лимит задан в
  глобальной секции (строка 11), а секция `.md` (17-18) меняет только
  `trim_trailing_whitespace`.
- Действие: переформулировать: «глобальная секция: `max_line_length = 120`».
- Приёмка: формулировка совпадает с `docs/webstorm.md` §6; `check:docs` зелёный.

#### A8. [TODO] Убрать Unicode-стрелки из прозы документации

- Источник: второй аудит P3/WARN; сравнение №9.
- Проблема: `docs/markdown.md` (строка 69) требует ASCII `->`, но в прозе
  стоит U+2192:
  - `docs/webstorm.md` — 17 строк: 94, 105, 132, 176, 192, 198, 212, 213,
    241, 255, 271, 276, 277, 300, 301, 302, 316;
  - `docs/live-templates/README.md` — 5 строк: 11, 69, 70, 71, 74.
- Важно: `docs/markdown.md` (строка 69) — намеренный контрпример, не трогать.
- Действие: заменить на `->` в прозе ИЛИ расширить `unicodeGraphicsPattern`
  диапазоном U+2190-21FF и распространить правило на прозу `.md`.
- Приёмка: grep U+2192 по `docs/` пуст (кроме `markdown.md`), либо правило
  ловит нарушения.

#### A9. [TODO] Добавить шаг переименования `.iml` при форке

- Источник: второй аудит P3/WARN; сравнение №10.
- Проблема: `.idea/modules.xml` жёстко ссылается на
  `webstorm-config.iml`; `docs/webstorm.md` (строка 225) перечисляет оба файла
  как переносимые, но Step 1 `getting-started.md` не просит переименовать
  `.iml`.
- В форке `my-project` WebStorm создаст `my-project.iml`, старый останется
  мёртвым.
- Действие: в Step 1 `getting-started.md` и/или `docs/webstorm.md` добавить
  шаг переименования `.idea/<old>.iml` -> `.idea/<new>.iml` и правки
  `.idea/modules.xml`.
- Приёмка: после клона форка WebStorm не создаёт второй `.iml`.

### INFO

#### A10. [INFO] Зафиксировать разницу pre-commit/pre-push и CI

- Источник: второй аудит INFO №5-6; сравнение №11-12.
- Факт: `.husky/pre-commit` = `lint-staged` + `check-file-length`;
  `.husky/pre-push` = `typecheck` + `test`. Локально не запускаются
  `check:docs`, `check:templates`, `check:style-consistency`, `lint:css`,
  `lint:md`, `lint:metrics`, `format:check`, `npm audit`.
- CHANGELOG (строка 83) говорит «add pre-push changelog guard hook», но
  текущий `.husky/pre-push` — typecheck + test; запись историческая.
- Действие: добавить в `AGENTS.md` §6 или `docs/testing.md` явный перечень
  «локально vs CI»; при желании — строку про историческую запись CHANGELOG.
- Приёмка: из текста понятно, какие гейты не сработают локально.

#### A11. [INFO] Решить судьбу глобального Markdownlint-watchera

- Источник: `Отчёт проверка файла.md` §6 пункт 1.
- Факт: `%APPDATA%\JetBrains\WebStorm2026.3\options\watcherDefaultTasks.xml`
  содержит watcher Markdownlint: `node.exe` +
  `$ProjectFileDir$/node_modules/markdownlint-cli/markdownlint.js --fix`,
  `exitCodeBehavior=ALWAYS`.
- Риск: в проекте без пакета watcher упадёт; путь к Node абсолютный.
- Действие: оставить (работает только в проектах с пакетом) или удалить
  глобальный и держать проектный.
- Приёмка: решение зафиксировано.

#### A12. [INFO] Coverage gate 80% не подключён в CI

- Источник: оба аудита; `docs/testing.md` (строка 139).
- Факт: порог 80% на изменённых файлах описан как «ещё не в CI»;
  в `ci.yml` шага coverage нет.
- Действие: оставить как есть (задокументировано) или подключить
  `vitest related --coverage`.
- Приёмка: решение зафиксировано в `docs/testing.md`.

#### A13. [INFO] Добавить импорт live templates в Step 1

- Источник: второй аудит, план №8.
- Факт: IDE не читает `.idea/liveTemplates/`; импорт описан в
  `docs/live-templates/README.md` (строка 13), Step 1 ссылается на
  `webstorm.md`.
- Действие: добавить явный пункт в Step 1 `getting-started.md`.
- Приёмка: после Step 1 `rafce` + Tab разворачивает компонент.

#### A14. [INFO] Опционально: усилить `check:docs` для таблиц

- Источник: второй аудит, план №3.
- Контекст: заявленная битая ссылка `README.md` (строка 25) не подтвердилась
  (см. §6), поэтому это не исправление, а страховка.
- Действие: добавить проверку строк таблицы docs map на валидный
  link-синтаксис.
- Приёмка: тест на фикстуре `arkdown.md](docs/markdown.md)` падает.

#### A15. [INFO] Учесть близость гейт-скриптов к лимиту 250 строк

- Источник: `Отчёт проверка файла.md`, дополнительное наблюдение §7.
- Факт: `DEFAULT_MAX_LINES = 250` в `scripts/check-file-length.ts`;
  `check-docs.ts` — 238 строк, `check-style-consistency.ts` — 238,
  `check-templates.ts` — 236.
- Риск: один содержательный PR в любом из них уронит hard gate. Общая логика
  уже вынесена в `scripts/lib/` (4 модуля), но сами гейты остаются крупными.
- Действие: при следующем изменении этих скриптов вынести вспомогательные
  функции в `scripts/lib/`, не дожидаясь отказа гейта.
- Приёмка: ни один гейт-скрипт не превышает 250 строк, поведение не меняется.

#### A16. [INFO] Решить видимость гейта `check:style-consistency` в CHANGELOG

- Источник: первый аудит, опциональный пункт 8.
- Факт: коммит `799512d` — `chore(ci): check code style consistency across all 24 languages`;
  `conventional-changelog -p angular` не включает `chore`,
  поэтому записи о гейте в `CHANGELOG.md` нет.
- Действие: либо принять, что CI-гейт — это `chore` и в CHANGELOG ему не место,
  либо провести отдельным `feat`-коммитом, чтобы он попал в changelog.
- Приёмка: решение зафиксировано; при выборе `feat` запись есть в `CHANGELOG.md`.

#### A17. [OK] Глобальная схема code style задокументирована

- Источник: инцидент 09.11.2026 04:29; повтор пункта R10 из
  `Отчёт проверка файла.md`.
- Факт: при сохранении проекта WebStorm записала в
  `.idea/codeStyles/Project.xml` содержимое глобальной схемы
  `%APPDATA%\JetBrains\WebStorm2026.3\codestyles\webstorm-config.xml`.
  В ней не было `USE_DOUBLE_QUOTES`, `ENFORCE_TRAILING_COMMA` и части
  per-language опций.
- Последствие: `npm run check:style-consistency` упал с 33 расхождениями,
  `git status` показывал `M .idea/codeStyles/Project.xml`.
- Причина: глобальная схема `webstorm-config` устарела; на неё указывают
  `options/project.default.xml` (`PREFERRED_SCHEME`) и
  `codestyles/codeStyleConfig.xml` (`PREFERRED_PROJECT_CODE_STYLE`).
- Фикс: `Project.xml` откачен из HEAD; глобальная схема пересобрана из
  HEAD (24 языка, все опции); бэкапы в `%TEMP%\opencode\*.bak`; гейт зелёный.
- Проверено: после перезапуска IDE 09.11.2026 04:54 `Project.xml` не изменился,
  `git status` чист, гейт зелёный.
- Документация: абзац добавлен в `docs/webstorm.md` §14: при смене code style
  обновлять глобальную схему или выбирать схему `Project`, затем проверять
  `npm run check:style-consistency`.
- Приёмка: после перезапуска WebStorm и сохранения проекта
  `git diff .idea/codeStyles/Project.xml` пуст, гейт зелёный.

## 5. Закрыто и не требует действий

| Пункт                                    | Проверка                     | Статус                      |
| ---------------------------------------- | ---------------------------- | --------------------------- |
| Дубль `ProjectCodeStyleConfiguration`    | текущий `idea.log`           | [OK] закрыто                |
| Версия `2026.3.202` в `docs/webstorm.md` | grep по файлу                | [OK] закрыто                |
| Dependabot #26 minimatch                 | `npm audit`, `npm ls`        | [OK] закрыто                |
| `air-*.xml` = 7, не 18                   | глобальный каталог IDE       | [INFO] справочно            |
| README broken link                       | `git show` на 3 SHA          | [OK] не подтвердилось       |
| watcher длины файла и Stylelint-watcher  | глобальные options           | [INFO] отсутствуют          |
| ShellCheck/fsnotifier пути               | `Отчёт проверка файла.md` §2 | [INFO] устарели в источнике |
| Stylelint fix-on-save                    | docs говорит «подсветка»     | [INFO] решение отдельно     |
| Повторная инспекция IDE                  | 77 файлов, проблем нет       | [OK] закрыто                |

## 6. Расхождения источников

| Утверждение источника           | Проверка                        | Вывод                                           |
| ------------------------------- | ------------------------------- | ----------------------------------------------- |
| README broken link              | `git show` HEAD/84d21a6/7313222 | [OK] ссылка валидна, ложное срабатывание        |
| 121 vs 119 прямых коммитов      | `git log --no-merges`           | 121 локально; расхождение метрик                |
| SECURITY: 9 moderate на 84d21a6 | `npm audit` на 385cb7f          | на новом SHA 0; оба аудита правы для своего SHA |
| air-*.xml: 18 файлов            | глобальный каталог              | фактически 7; сравнение 2026.2 непроверяемо     |
| `markdown.md` U+2192            | чтение                          | намеренный контрпример, не нарушение            |

## 7. Слепые зоны

- Поведение IDE: on-save Prettier/ESLint, инспекции, Tab для live templates.
- Глобальные схемы code style в `%APPDATA%\JetBrains\...`: вне репозитория,
  проверяются вручную.
- File templates: применимость через `File -> New` не проверяется скриптом.
- Соответствие inspection profile правилам `AGENTS.md`.
- Настройки GitHub: secret scanning, push protection, branch protection.
- Coverage-гейт 80%: схема описана, в CI не подключена.
- React Buddy и скоуп `generated_changelog`: только декларации в docs.

## 8. Чеклист перед коммитом

1. `npm run lint:md` — строки ≤ 120, без emoji.
2. `npm run check:docs` — ссылки, пути и имена скриптов валидны.
3. `npm run check:file-length` — для `.md` не применяется, но проверить diff.
4. В WebStorm: нет ошибок в Problems для изменённых `.md`.
5. Нет emoji и Unicode-графики; только ASCII `->` и теги [OK]/[TODO]/[INFO].
