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
- **Run on save** (или Actions on save → Reformat with Prettier)

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

Включите опцию **Analyze code** и выберите профиль **Project Default**.

### Что делает

- Анализирует изменённые файлы inspection profile перед коммитом
- Показывает уведомление, если найдены ошибки/предупреждения
- Позволяет исправить проблемы перед коммитом или проигнорировать

### Альтернатива (через .idea/workspace.xml)

Если хотите зафиксировать настройку в репозитории, добавьте в `.idea/workspace.xml`:

```xml
<component name="CommitConfigs">
  <option name="ANALYZE_CODE" value="true" />
  <option name="ANALYZE_CODE_PROFILE" value="Project Default" />
  <option name="RUN_CLEANUP" value="true" />
  <option name="RUN_CLEANUP_PROFILE" value="Project Default" />
</component>
```

> **Примечание:** Это проектная настройка (в `workspace.xml`). Для каждого нового проекта
> нужно включать отдельно или использовать UI (Alt+0 → Settings).

## 9. React Buddy (превью компонентов)

Плагин установлен. Настройка при первом использовании:

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

Белый список осознанный: новый файл настроек `.idea/` не попадёт в git без `!`-строки
в `.gitignore`. Это отличается от рекомендации JetBrains (коммитить все XML, кроме
`workspace.xml`) — так надёжнее для форков.

## 11. File Watchers (ручная настройка, 5 минут)

Определения вотчеров живут в `workspace.xml` и не коммитятся, поэтому на новой машине
`Settings → Tools → File Watchers` пуст. Создайте вручную:

1. **Stylelint**: Program — `stylelint`, Arguments — `$FilePath$`, File type — CSS/SCSS.
2. **Markdownlint**: Program — `markdownlint`, Arguments — `$FilePath$`, File type — Markdown.
3. Вотчер длины файла **не создавайте**: скрипт `check-file-length.ts` проверяет
   staged-файлы, при сейве ему нечего проверять, а в pre-commit хуке он уже работает.

## 12. Live Templates (импорт)

Каталог `.idea/liveTemplates/` IDE не читает (известное ограничение, YouTrack IDEABKL-5033) —
XML-файлы там это склад. Импорт: откройте нужный XML, скопируйте тело шаблона,
`Settings → Editor → Live Templates` → `+` → вставьте.

Состав групп (React 8 шаблонов, Testing 4, TypeScript 3, Utilities 3), требования
к контексту и частые проблемы — в [docs/live-templates/README.md](live-templates/README.md).
Отдельно смотрите [шаблон компонента](live-templates/README.md): `rafce` больше не
генерирует `React.FC` и пустые Props.

## Согласованность IDE и CI

```text
Save в WebStorm  →  Prettier + ESLint + Stylelint
git commit       →  Husky + lint-staged (те же инструменты из CLI)
git push         →  typecheck + тесты (pre-push)
```

Если при коммите много неожиданных правок — проверьте шаги 2–4.

## Windows

Husky pre-commit проверяет staged-файлы через `node scripts/check-file-length.ts`
(кроссплатформенно); `npm run check:file-length` — тот же скрипт с `--all` по всему
дереву (запускается в CI). Нужны: Node.js >= 22.22.2, Git. Pre-commit останавливается
на первой ошибке.
