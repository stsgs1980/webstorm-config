# WebStorm setup

Одноразовая настройка IDE после `npm install`. Файлы конфигурации уже в репозитории;
WebStorm часть из них **не подхватывает автоматически**.

## Чеклист

| Шаг | Обязательно   | Действие                                      |
| --- | ------------- | --------------------------------------------- |
| 1   | Да            | Импортировать `webstorm-codestyle.xml`        |
| 2   | Да            | Включить Prettier (format on save)            |
| 3   | Да            | Включить ESLint (fix on save)                 |
| 4   | Если есть CSS | Включить Stylelint                            |
| 5   | Нет           | Vitest — подхватывается из `vitest.config.ts` |
| 6   | Нет           | EditorConfig — читается из `.editorconfig`    |
| 7   | Рекомендуется | Включить анализ кода при коммите              |

## 1. Code Style (code style)

Путь: `Settings → Editor → Code Style → шестерёнка → Import Scheme → webstorm-codestyle.xml`

Схема согласована с `.prettierrc`: двойные кавычки, trailing comma, 2 пробела,
120 символов. Для TS/JS основной форматтер — **Prettier**; code style — запасная
согласованность и языки без Prettier.

> Импорт **не выполняется сам** при `git clone` — только вручную или через
> **Share → Copy settings** у коллеги, у кого уже настроено.

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

## 4. Stylelint

Путь: `Settings → Languages & Frameworks → Style Sheets → Stylelint`

- Enable Stylelint
- Package: `{project}/node_modules/stylelint`
- При необходимости — fix on save

Использует `.stylelintrc.json` (в т.ч. Tailwind v4 at-правила).

## 5. Vitest

После создания `src/` и файлов `*.test.ts` WebStorm показывает Run/Debug в gutter.
Конфиг: `vitest.config.ts`. Подробнее — [testing.md](testing.md).

> В шаблоне **нет** папки `src/` и примеров тестов — это нормально.
> `passWithNoTests: true` позволяет `npm test` проходить до Step 4 в getting-started.md.

## 6. Markdown и `.editorconfig`

`.editorconfig` устанавливает `max_line_length = 120` для `*.md` (согласно `.aiassistant/rules/AI Rules.md`).
WebStorm `RIGHT_MARGIN=120` для markdown совпадает с линтером
(`MD013: true`); `.markdownlint` и `.editorconfig` синхронизированы.

## 6.5. Конвенции стиля

- 2 пробела, точка с запятой, двойные кавычки (`USE_DOUBLE_QUOTES` в `webstorm-codestyle.xml`).
- `const`/`let` по умолчанию; `var` запрещён.
- JSDoc (`@param`, `@return`) для функций и компонентов.
- Trailing commas (`Always`) в объектах и массивах.
- Максимальная длина строки — 120 символов (`RIGHT_MARGIN` в `webstorm-codestyle.xml`).

## 7. Анализ кода при коммите (рекомендуется)

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

## 8. React Buddy (превью компонентов)

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

## 9. Что не коммитится в `.idea/`

Каталог `.idea/` в git **намеренно отсутствует** — личные настройки IDE не в репозитории.
В репо только переносимые файлы: `webstorm-codestyle.xml`, ESLint, Prettier и т.д.

**Исключение:** `.idea/workspace.xml` может содержать общие настройки проекта
(например, анализ кода при коммите), которые полезно сохранить в репозитории.

## Согласованность IDE и CI

```text
Save в WebStorm  →  Prettier + ESLint + Stylelint
git commit       →  Husky + lint-staged (те же инструменты из CLI)
```

Если при коммите много неожиданных правок — проверьте шаги 2–4.

## Windows

Husky pre-commit использует `node scripts/check-file-length.ts` (кроссплатформенно).
Нужны: Node.js >= 24.0.0, Git.
