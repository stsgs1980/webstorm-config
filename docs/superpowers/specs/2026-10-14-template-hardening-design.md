# Дизайн: доработка шаблона webstorm-config (гейты + R-пакет)

Дата: 2026-10-14. База: `main` @ `aedc954`.
Источники: аудиты (Desktop): «Ромендации по webstorm-config_13окт.md» (R1–R22),
«Единый отчёт-аудит_13окт.md» (A/B/C/D/E/F), «ФИНАЛЬНЫЙ-ОТЧЕТ» (статус фиксов),
аудит `.idea/` («Аудит_13окт.md», «Класс C-класс B»), «Аудит конфигурации
webstorm-config.md» (матрица стеков, вариант B для Markdown).

## Намерение и зачем

Шаблон проверяет код «на входе в main», а не «на выходе из рабочего цикла»:
typecheck, тесты и warning-уровень eslint не гейтятся локально, CI не запускается
на feature-ветках. Плюс открытая часть R-листа: дрейф документации, мёртвые
IDE-файлы, непорядочное правило unicode-policy, незащищённая версия Node.

Цель: локальные гейты эквивалентны CI, каждый факт доков проверяется машиной,
мёртвые файлы удалены, полезные — закоммичены.

## Цели

1. CI запускается на push в любую ветку и на PR.
2. `typecheck` + `test` гейтят `pre-push`; `--max-warnings=0` — в lint-staged.
3. `engine-strict=true` — старый Node блокируется понятной ошибкой.
4. `unicode-policy`: ловит реальные эмодзи, не ложные срабатывания, точные локации.
5. `scripts/check-docs.ts` + шаг CI: команды, версии и пути в доках сверяются с репо.
6. IDE-гигиена: `watcherTasks.xml` и `saveactions_settings.xml` удалены,
   `jsLinters/eslint.xml` закоммичен (ESLint --fix on save после клона).
7. Дешёвые R-фиксы: `.nvmrc`, ссылки на SECURITY, pin JSON-схемы,
   `vitest/globals` types, единая форма команды anti-monolith, границы anti-monolith
   в доках, оговорка про прозу Markdown.

## Не цели (non-goals)

- Не добавляем плагины Vue/Svelte/Astro/Next — остаются рецептами в доках.
- Не обновляем мажоры (ESLint 10, TS 6/7) — за Dependabot.
- Не включаем `recommendedTypeChecked` (падает на файлах вне tsconfig — осознанно отложено).
- Не сводим стили в один источник (R17) — отдельное решение.
- Live templates (R16) не трогаем: `docs/live-templates/README.md` уже честен («склад для ручного импорта»).
- «Вариант B» для Markdown (два прохода ESLint по прозе) не делаем — вместо него честная оговорка в `docs/markdown.md`
  (R8, дешёвый путь).

## Принятые пользователем решения

| Решение                                | Выбор                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------- |
| Объём                                  | Полный: гейты + дешёвые R-фиксы + unicode-policy + check-docs           |
| `.idea/watcherTasks.xml` (R5)          | Удалить; доки — ручная настройка вотчеров                               |
| `.idea/saveactions_settings.xml` (R19) | Удалить; доки — нативные Actions on Save + Prettier                     |
| `.idea/jsLinters/eslint.xml` (R4)      | Создать и закоммитить (Automatic, fix on save) + whitelist `.gitignore` |

## Части изменений

### 1. Гейты коммита/пуша/CI

- `.github/workflows/ci.yml`: триггеры `on: [push, pull_request]`.
  **Принято: ветка с открытый PR даёт два прогона** (push — проверяет ветку,
  pull_request — интеграцию с main через merge-ref). Это разные проверки,
  склеивать их не надо; concurrency-group `ci-${{ github.ref }}` гасит только
  повторные пушы одной и той же ветки (cancel-in-progress). Минуты для
  публичного репозитория бесплатны.
- `.husky/pre-push`: перед changelog-скриптом добавить
  `npm run typecheck` и `npm test`.
- `package.json` → lint-staged: `"eslint --fix"` → `"eslint --fix --max-warnings=0"`.
- `.npmrc`: `engine-strict=true`.

### 2. Дешёвые R-фиксы

- R3: `.nvmrc` → `24.15.0` (точная версия = минимум `engines`).
- R2: SECURITY.md — строка в таблицу «What's Included» README + упоминание в `docs/webstorm.md`.
- R6: `docs/webstorm.md` и `README.template.md` — `node scripts/check-file-length.ts` → `npm run check:file-length`.
  (Форма в `.husky/pre-commit` не трогается — там она уместна.)
- R10: `tsconfig.json` → `compilerOptions.types: ["vitest/globals"]` (профилактика для будущих `src/**/*.test.ts`).
- R15: `.idea/jsonSchemas.xml` — URL схемы: `main` → `v0.41.1` (как в `.markdownlint.json`).
- R21: `docs/getting-started.md` — фраза: anti-monolith смотрит `git ls-files`, неотслеживаемые файлы не проверяются (в
  CI это не имеет значения).
- R8 (дешёвый путь): `docs/markdown.md` — оговорка: автоматически проверяются только код-сниппеты, проза — нет.

### 3. unicode-policy (R7)

`eslint-rules/unicode-policy.js`:

- Эмодзи-паттерн: `/\p{Extended_Pictographic}|\p{Regional_Indicator}/u` (без `g` — с `g`
  появляется stateful `lastIndex`, правило начнёт пропускать строки).
- **Принято: строго всё по Unicode, включая «текстовые» ©®™** — заголовок
  `// © 2026 Company` станет ошибкой; фикстура теста зафиксирует этот случай.
- Убрать ручные диапазоны (включая недостижимый `2702–27B0` и `FE00–FEFF`,
  где variation selectors трактовались как эмодзи).
- Точные локации: `column` = индекс первого совпадения в строке, а не `0`.
- Графика-правило без изменений (диапазоны 2500–257F/2580–259F/25A0–25FF/2800–28FF
  не захватывают `★✔♥`).
- Ожидаемое изменение поведения (проверено пробником `node` на `\p{Extended_Pictographic}`):
  ловятся `⏰⭐⬛🀄🅰 ⚙ ✔ ♥ ©®™⚠` (все — Extended_Pictographic); **не** ловится `★ U+2605`
  (не Epicto — единственное бывшее «ложное» из списка B2, ушедшее из-под запрета);
  `→ — …` и box-графика эмодзи-правилом не ловились и не ловятся.
- Тесты `tests/unicode-policy.test.mjs`: обновить фикстуры, добавить кейсы из B2.

### 4. check-docs (R1)

Новый `scripts/check-docs.ts` + `"check:docs": "node scripts/check-docs.ts"` + шаг в CI:

1. Каждый `npm run X`, упомянутый в `*.md` (кроме CHANGELOG.md и docs/superpowers/),
   существует в `scripts` файла `package.json`.
   **Escape hatch (решение builder-check):** в скрипте есть allowlist
   «задокументированные, но ещё не созданные скрипты» (сейчас — `dev`:
   README учит «добавьте после Step 3»). Без неё проверка красная с первого дня
   и красит форки, не прошедшие Step 3.
2. Major из `.nvmrc` совпадает с major.minor минимума `engines.node`, и README-бейдж
   содержит ту же минимальную версию.
3. Каждый путь вида `docs/...`, `.idea/...`, `scripts/...`, `.husky/...`, упомянутый
   в доках (в inline-code), существует в репозитории.

Проверка скрипта: временно испортить версию Node в README — `npm run check:docs` падает.

### 5. IDE-файлы

- `git rm .idea/watcherTasks.xml .idea/saveactions_settings.xml`; убрать эти строки
  из whitelist `.gitignore`; поправить доки (§11 — вотчеры настраиваются вручную,
  см. чек-лист; saveactions — не упоминается).
- Создать `.idea/jsLinters/eslint.xml` (режим Automatic, «Run eslint --fix on save»),
  добавить `!.idea/jsLinters/` в whitelist `.gitignore`.
  **Риск:** точное имя `<component>` должно совпадать с форматом WebStorm —
  проверяется открытием проекта в IDE после коммита (ручная проверка, см. ниже).

### 6. Документация и AI Rules

- `docs/webstorm.md`: §9 — абзац про белый список `.idea/` (осознанный выбор,
  новые файлы настроек не коммитятся без `!`-строки; отличие от рекомендации JetBrains).
- AI Rules vs lint (R9) — **уточнено после builder-check**:
  - включить `@typescript-eslint/explicit-function-return-type`:
    `["error", { allowExpressions: true, allowTypedFunctionExpressions: true }]` —
    требование «явные типы» становится проверяемым;
  - включить `no-console`: `["error", { allow: ["warn", "error"] }]` (в AI Rules
    про console ничего не было — правило просто добавляется в eslint);
  - AI Rules §4 (Anti-Monolith пороги: файл 250 / компонент 200 / функция 50 /
    3+ `useState`): **переформулировать, не удалять** — ссылать на машинные
    проверки: файлы гейтит `check:file-length`, длинные функции — инспекции IDE
    (`OverlyLongFunctionJS=50`, `CyclomaticComplexityJS=15`, `StatementsPerFunctionJS=30`);
  - после правок прогнать `npm run lint` по репо и погасить шум.

## Ограничения (constraints)

- Windows-окружение; `.sh`-скрипты — только Git Bash (зафиксировано в доках).
- Husky v9: хуки идут через `sh -e`, shebang не обязателен.
- Не ломать зелёный набор: `lint`, `typecheck`, `lint:css`, `lint:md`, `format:check`,
  `check:file-length`, `test` — всё EXIT 0 после правок.

## Что остаётся строителю (builder)

- Верификация формата `jsLinters/eslint.xml` — пометить в доках как требующий
  ручной проверки в IDE.
- Порядок коммитов — логическими пачками (гейты / дешёвые / unicode-policy /
  check-docs / IDE / доки).
- Прогон полного CI-набора перед сдачей.
