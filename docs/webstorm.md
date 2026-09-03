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

## 1. Code Style (codestyle)

Путь: `Settings → Editor → Code Style → шестерёнка → Import Scheme → webstorm-codestyle.xml`

Схема согласована с `.prettierrc`: двойные кавычки, trailing comma, 2 пробела,
120 символов. Для TS/JS основной форматтер — **Prettier**; codestyle — запасная
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

`.editorconfig` отключает `max_line_length` для `*.md` (`[*.md] max_line_length = off`).
WebStorm может показывать визуальную границу `RIGHT_MARGIN=120` для markdown-файлов — это не ошибка линтера; `.markdownlint` (`MD013: false`) и `.editorconfig` синхронизированы. Игнорируйте предупреждения `RIGHT_MARGIN` в `.md` или отключите инспекцию для этого типа файлов.

## 7. Что не коммитится в `.idea/`

Каталог `.idea/` в git **намеренно отсутствует** — личные настройки IDE не в репозитории.
В репо только переносимые файлы: `webstorm-codestyle.xml`, ESLint, Prettier и т.д.

## Согласованность IDE и CI

```text
Save в WebStorm  →  Prettier + ESLint + Stylelint
git commit       →  Husky + lint-staged (те же инструменты из CLI)
```

Если при коммите много неожиданных правок — проверьте шаги 2–4.

## Windows

Husky pre-commit использует `node scripts/check-file-length.mjs` (кроссплатформенно).
Нужны: Node.js >= 20.12.0, Git.
