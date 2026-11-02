# WebStorm setup

Одноразовая настройка IDE после `npm install`. Файлы конфигурации уже в репозитории;
WebStorm часть из них **не подхватывает автоматически**. Политика уязвимостей — в
[SECURITY.md](../SECURITY.md).

## Чеклист

| Шаг | Обязательно   | Действие                                        |
| --- | ------------- | ----------------------------------------------- |
| 1   | Нет           | Code Style — уже в проекте (см. §1)             |
| 2   | Да            | Включить Prettier (format on save)              |
| 3   | Да            | ESLint — fix on save (уже в `.idea/jsLinters/`) |
| 4   | Если есть CSS | Включить Stylelint                              |
| 5   | Нет           | Vitest — подхватывается из `vitest.config.ts`   |
| 6   | Нет           | EditorConfig — читается из `.editorconfig`      |
| 7   | Рекомендуется | Включить анализ кода при коммите                |

## Уровни настроек: проект, машина, личное

Три уровня не конфликтуют: проект перекрывает глобальные настройки IDE.

| Уровень        | Где физически                           | Действует                       | Кто главнее        |
| -------------- | --------------------------------------- | ------------------------------- | ------------------ |
| IDE-глобальные | `%APPDATA%\JetBrains\WebStorm<версия>\` | Все проекты без своей настройки | Проект перекрывает |
| Проектные      | `.idea\` внутри репозитория             | Только этот проект              | Всегда выигрывают  |
| Личные         | `.idea\workspace.xml` (не коммитится)   | Этот проект и только у вас      | -                  |

`<версия>` - каталог установки, например `WebStorm2026.2`; при обновлении IDE
номер меняется, поэтому в путях он не зашит.

Два смысла слова «шаблонные»: файлы `.idea/` из клона - это и есть настройки
проекта, импортировать их не нужно; часть настроек IDE читает только из
`%APPDATA%` (живые шаблоны, глобальные схема и профиль) и развозит по машине
один раз по runbook [webstorm-settings.md](webstorm-settings.md).

### Что из клона работает сразу

| Настройка               | Файл в репо                              | Из клона               | На машину              |
| ----------------------- | ---------------------------------------- | ---------------------- | ---------------------- |
| Code Style              | `.idea/codeStyles/`                      | [OK]                   | шаг 1: Global          |
| Профиль инспекций       | `.idea/inspectionProfiles/`              | [OK]                   | шаг 2: IDE Default     |
| ESLint и Prettier       | `.idea/jsLinters/`, `.idea/prettier.xml` | [OK]                   | шаг 5: New Projects    |
| Шаблоны файлов          | `.idea/fileTemplates/`                   | [OK] «Файл -> Создать» | шаг 3: Copy to IDE     |
| Живые шаблоны           | `.idea/liveTemplates/`                   | [FAIL] IDE не читает   | шаг 4: импорт XML, §12 |
| Словарь                 | `.idea/dictionaries/`                    | [OK]                   | шаг 7: Accepted Words  |
| File Watchers           | нет в репо                               | -                      | шаг 6: вручную, §11    |
| Analyze code на коммите | нет в репо                               | -                      | шаг 8: per-project, §8 |
| EditorConfig и линтеры  | корень репозитория                       | [OK]                   | не нужна               |

Скоуп `generated_changelog` работает только в этом репозитории: он привязан
к пути проекта. EditorConfig и конфиги линтеров - не настройки IDE: их читают
инструменты в любом клоне.

### Новый проект и проверка

- Клон webstorm-config: всё из строк [OK] таблицы уже на месте.
- Свежий проект: только `%APPDATA%` (живые шаблоны), остальное - дефолты IDE
  до шагов runbook.
- Проверка: `rafce` + Tab в `.tsx`, «Файл -> Создать -> React Component»,
  схема Code Style подписана «(Project)», Prettier и ESLint on save включены,
  Analyze code при коммите включён.

Направление правок: меняем в репозитории и реимпортируем в IDE, не наоборот;
`workspace.xml` - личное состояние и в git не попадает.

## 1. Code Style

Отдельных действий не требуется: схема проекта закоммичена в `.idea/codeStyles/`
(`USE_PER_PROJECT_SETTINGS`) и применяется автоматически при открытии проекта.

Схема согласована с `.prettierrc`: двойные кавычки, trailing comma, 2 пробела,
120 символов. Для TS/JS основной форматтер — **Prettier**; code style — запасная
согласованность и языки без Prettier.

> При необходимости схему можно перенести на другую машину или в глобальные
> настройки IDE штатным экспортом из диалога Code Style.

## 2. Prettier

Путь: `Settings → Languages & Frameworks → JavaScript → Prettier`

- Prettier package: `{project}/node_modules/prettier`
- Run on save уже включён проектом (`.idea/prettier.xml`: `myRunOnSave=true`);
  проверьте после открытия проекта, что галочка активна, и не включайте второй
  механизм (Save Actions, §13).

Использует `.prettierrc` и плагины из `devDependencies`.

## 3. ESLint

Путь: `Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint`

- Mode: **Automatic**
- ESLint package: `{project}/node_modules/eslint`
- **Run eslint --fix on save**

Использует flat config `eslint.config.js`.

Настройка закоммичена в `.idea/jsLinters/eslint.xml` — после клона откройте проект,
галочки уже активны. Проверка — открытием проекта в IDE: при расхождении формата
WebStorm молча проигнорирует файл. Ручные шаги нужны, если файл удалён.

### Известная ложная подсветка: Unknown character category

WebStorm ложно подсвечивает `\p{Extended_Pictographic}` как «Unknown character category»
([IJPL-101766](https://youtrack.jetbrains.com/issue/IJPL-101766); исправления нет).
Поэтому в `eslint-rules/unicode-policy.js` паттерн собирается в рантайме — не сворачивайте
его в литерал или шаблонную строку `new RegExp` (IDE найдёт там «дублирующую ветвь»).
`// noinspection Annotator` в редакторе не подавляет — действует только в batch-отчёте
инспекций.

Перепроверено 02.11.2026 на WebStorm 2026.2.4: литерал `/\p{Extended_Pictographic}/u`
по-прежнему даёт «Неизвестная категория символов», а `new RegExp(String.raw...)` -
чистый. Обход обязателен до исправления IJPL-101766.

## 4. Stylelint

Путь: `Settings → Languages & Frameworks → Style Sheets → Stylelint`

- Enable Stylelint
- Package: `{project}/node_modules/stylelint`
- При необходимости — fix on save

Использует `.stylelintrc.json` (в т.ч. Tailwind v4 at-правила).

## 5. Vitest

После создания `src/` и файлов `*.test.ts` WebStorm показывает Run/Debug в gutter.
Конфиг: `vitest.config.ts`. Подробнее — [testing.md](testing.md).

> В шаблоне есть `tests/` (проверки тулчейна, не удалять), но нет папки `src/` — это нормально.
> `passWithNoTests: true` позволяет `npm test` проходить до Step 4 в getting-started.md.

## 6. Markdown и `.editorconfig`

`.editorconfig` устанавливает `max_line_length = 120` для `*.md` (согласно `.aiassistant/rules/AI Rules.md`).
Визуальная направляющая `SOFT_MARGINS=120` для Markdown задана в `.idea/codeStyles/Project.xml`;
жёсткий лимит держит markdownlint (`MD013` с `line_length: 120` в `.markdownlint.json`).

Инспекция IDE «Line is longer than allowed by code style» берёт лимит из code style
(«Hard wrap at»), а не из `.editorconfig`. Для генерируемого `CHANGELOG.md` (строки
с commit-ссылками длиннее 120 by design) подсказки IDE — LongLine, Grazie и
орфография — отключены скоупом `generated_changelog`: `.idea/scopes/generated_changelog.xml`
и профиль `Project Default` в `.idea/inspectionProfiles/Project_Default.xml`.

## 7. Конвенции стиля

- 2 пробела, точка с запятой, двойные кавычки (`USE_DOUBLE_QUOTES` в `.idea/codeStyles/Project.xml`).
- `const`/`let` по умолчанию; `var` запрещён.
- JSDoc для публичного API; `@param`/`@returns` — опциональны в TS-файлах, обязательны в JS-файлах.
- Trailing commas (`Always`) в объектах и массивах.
- Максимальная длина строки — 120 символов (`.prettierrc`, `.editorconfig`).

## 8. Анализ кода при коммите (рекомендуется)

Путь: `Commit tool window (Alt+0) → Settings (⚙) → Commit Checks → Analyze code`

Включите **Analyze code** и выберите профиль **Project Default**.

### Что делает

- Это Advanced Commit Checks: IDE анализирует изменённые файлы после коммита и
  показывает уведомление с найденными проблемами.
- Блокирует коммит не он, а Husky + lint-staged; анализ IDE - дополнительный
  слой, который видит инспекции, недоступные CLI.
- Настройка личная (`workspace.xml`, в git не попадает): включите её на каждой
  машине через UI. Фиксировать её в репозитории нельзя - `workspace.xml`
  в `.gitignore` по белому списку.

## 9. React Buddy (превью компонентов)

Установка: `Settings → Plugins → Marketplace`, найти «React Buddy», Install,
перезапустить IDE. Раздел доступен только после установки; на части машин
плагина нет — тогда шаг пропустите.

Настройка при первом использовании:

1. ПКМ на файле компонента → **React Buddy** → **Add to Palette**
2. При появлении диалога **Настройка React Buddy Toolbox**:
   - **Файл package.json** — оставьте по умолчанию
   - **Директория тулбокса** — `dev/` (создаётся автоматически)
   - **Корневой компонент** — укажите `src/App.tsx` или `src/main.tsx`
3. Нажмите **OK**

### Что создаётся

- Папка `dev/` — палитра компонентов (добавлена в `.gitignore`)
- Файлы конфигурации React Buddy

### Использование

- ПКМ на компоненте → **React Buddy** → **Preview Component**
- Палитра: `View → Tool Windows → React Buddy Palette`

## 10. Что коммитится в `.idea/`

В git лежат только переносимые настройки (белый список в `.gitignore`):

- `codeStyles/` — схема Project (`Project.xml`, включение в `codeStyleConfig.xml`);
- `inspectionProfiles/` — общие инспекции (профиль `Project Default`);
- `fileTemplates/`, `liveTemplates/` — шаблоны (склад для ручного импорта, см. §12);
- `jsLinters/` — ESLint Automatic + fix on save;
- `dictionaries/project.xml` — словарь проекта (термины и аббревиатуры);
- `scopes/` — скоуп `generated_changelog` (исключение `CHANGELOG.md` из подсказок IDE, см. §6);
- `jsonSchemas.xml`, `jsonCatalog.xml`, `prettier.xml`, `vcs.xml`, `modules.xml`, `webstorm-config.iml`.

Личное (`workspace.xml`, локальные вотчеры, IDE-профили) в git не попадает.

Словарь в git - сознательное отклонение от рекомендации JetBrains: он держит
термины проекта и переносим, но в форке его можно удалить без последствий для
гейтов.

Белый список осознанный: новый файл настроек `.idea/` не попадёт в git без `!`-строки
в `.gitignore`. Это отличается от рекомендации JetBrains (коммитить все XML, кроме
`workspace.xml`) — так надёжнее для форков.

## 11. File Watchers (ручная настройка, 5 минут)

Определения вотчеров хранятся в `.idea/watcherTasks.xml` (проектная настройка; файл
не входит в белый список `.gitignore`, поэтому в git не попадает). На новой машине
`Settings → Tools → File Watchers` пуст. Создайте вручную:

1. **Stylelint**: Program — `stylelint`, Arguments — `$FilePath$`, File type — CSS/SCSS.
   Если включена штатная интеграция Stylelint (§4), вотчер не нужен: он дублирует
   ту же подсветку.
2. **Markdownlint**: Program — `markdownlint`, Arguments — `$FilePath$`, File type — Markdown.
3. Вотчер длины файла **не создавайте**: скрипт `check-file-length.ts` проверяет
   staged-файлы, при сейве ему нечего проверять, а в pre-commit хуке он уже работает.

## 12. Live Templates (импорт)

Каталог `.idea/liveTemplates/` IDE не читает (известное ограничение, YouTrack IDEABKL-5033) —
XML-файлы там это склад. Импорт: откройте нужный XML, скопируйте тело шаблона,
`Settings → Editor → Live Templates` → `+` → вставьте.

Источники истины — репозиторий, а не IDE-настройки: правки шаблона вносятся в XML
`.idea/liveTemplates/`, затем в IDE реимпортируются; сделанное только в IDE и не
закоммиченное считается потерянным. Чистота склада машинно проверяется:
`npm run check:templates` рендерит каждый шаблон со значениями переменных и прогоняет
через ESLint и tsc (CI и локально).

Состав групп (React 8 шаблонов, Testing 4, TypeScript 3, Utilities 3), требования
к контексту и частые проблемы — в [docs/live-templates/README.md](live-templates/README.md).
Отдельно смотрите [шаблон компонента](live-templates/README.md): `rafce` больше не
генерирует `React.FC` и пустые Props.

## 13. Сторонний плагин Save Actions (конфликт с Actions on Save)

Плагин `software.xdev.saveactions` дублирует нативный механизм IDE
«Actions on Save» (`Settings → Tools → Actions on Save`). Если включены оба,
форматирование применяется дважды (плагин + Prettier run on save), что при
расхождении схем даёт «прыгающие» правки до pre-commit.

Чеклист этого документа (шаги 2–3) рассчитан на нативный механизм. Если плагин
установлен — выберите одно: либо отключите его (`Settings → Tools → Save Actions`,
или удалите в `Settings → Plugins`), либо отключите его действия форматирования,
оставив только нативные галочки из шагов 2–4.

## 14. Версии IDE

- Vitest 5: надёжный запуск из gutter требует WebStorm 2026.3 (WEB-79586);
  шаблон ставит `vitest` 5.x, поэтому на 2026.2 Run/Debug может вести себя
  нестабильно, а CLI-прогон остаётся источником истины.
- TypeScript 7: проект держит TS 5.9. IDE 2026.2+ открывает TS 7-проекты через
  LSP без миграции, но typescript-eslint требует `<6.1`, поэтому мажор
  заблокирован в dependabot - это осознанно.
- Chrome Connect и скилл `@Chrome` (2026.3 RC): агент может открыть браузер и
  проверить UI; шаблону без приложения шаг не нужен.
- Git Worktree UX (IJPL-258594): хуки экспортируют `GIT_DIR`, поэтому тесты
  фикстур запускают git через `tests/lib/git-env.mjs` - при работе в worktree
  это обязательно.

## Согласованность IDE и CI

```text
Save в WebStorm  →  Prettier + ESLint + Stylelint
git commit       →  Husky + lint-staged (те же инструменты из CLI)
git push         →  typecheck + тесты (pre-push)
```

Если при коммите много неожиданных правок — проверьте шаги 2–4.

### Где проверяется каждое правило

Обязательность не угадывается: у каждого правила назван канал проверки.
«commit» — husky pre-commit, «CI» — `.github/workflows/ci.yml`, «IDE» —
инспекции WebStorm, «advisory» — `npm run lint:metrics` (CI-шаг не блокирует).

| Правило                                                | Закреплено                              | Проверяется       |
| ------------------------------------------------------ | --------------------------------------- | ----------------- |
| TS/JS-файл до 250 строк; исключения — с причиной       | `scripts/check-file-length.ts`          | commit + CI       |
| Шаблоны рендерятся чисто: render → eslint → tsc        | `scripts/check-templates.ts`            | CI                |
| docs согласованы с конфигами                           | `scripts/check-docs.ts`                 | CI                |
| ESLint-правила кода (в т.ч. без `warn`)                | `eslint.config.js`                      | IDE + commit + CI |
| Промисы: no-floating/misused-promises                  | `eslint.config.js` (type-aware)         | IDE + CI          |
| `no-console`: приложение error, скрипты/сервер off     | `eslint.config.js`                      | IDE + commit + CI |
| Юникод и emoji-политика в коде и прозе                 | `eslint-rules`, markdownlint            | IDE + commit + CI |
| Markdown не длиннее 120                                | markdownlint MD013, `.editorconfig`     | IDE + commit + CI |
| Метрики: 60/15/4/4                                     | `eslint.metrics.config.js`, профиль IDE | IDE + advisory    |
| Вложенность функций (порог 4)                          | профиль IDE, в git не коммитится        | только IDE        |
| TS-типы (tsc), тесты                                   | `tsconfig.json`, `vitest.config.ts`     | push + CI         |
| Prod-аудит зависимостей (high+)                        | `.github/workflows/ci.yml`              | CI                |
| React-компонент 200 строк; 3+ `useState`; сложность 15 | пороги-сигналы                          | ревью             |

## Windows

Husky pre-commit проверяет staged-файлы через `node scripts/check-file-length.ts`
(кроссплатформенно); `npm run check:file-length` — тот же скрипт с `--all` по всему
дереву (запускается в CI). Нужны: Node.js >= 22.22.2, Git. Pre-commit останавливается
на первой ошибке.
