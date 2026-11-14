# Getting started (after fork)

Чеклист после создания проекта из шаблона `webstorm-config`. Файл остаётся в репозитории
проекта вместе с конфигами.

## Step 1: Basic setup

Порядок шагов единый с `README.md` After fork.

1. Обновите `package.json`: `name`, `description`, `repository` (URL форка).
2. Скопируйте `README.template.md` -> `README.md`, заполните Overview, Features, Architecture.
3. Сбросьте `CHANGELOG.md` (история шаблона, не вашего проекта):

   ```bash
   printf '%s\n' '<!-- markdownlint-disable -->' > CHANGELOG.md
   git add CHANGELOG.md
   git commit -m "chore: reset changelog for new project"
   ```

   Файл должен содержать ровно эту строку. В проекте без тегов генератор
   считает header-only чанк пустым и оставляет маркер без заголовка.

4. Удалите `docs/kickoff.md` (стартовый промт шаблона) и
   `docs/audit-recommendations.md` (журнал аудитов шаблона): в новом проекте
   они не нужны. Закоммитьте удаление.

5. Переименуйте `.idea/webstorm-config.iml` и поправьте `.idea/modules.xml`:

   ```bash
   mv .idea/webstorm-config.iml .idea/<ваш-проект>.iml
   git add .idea
   ```

   В `.idea/modules.xml` замените `webstorm-config.iml` на `<ваш-проект>.iml`.
   WebStorm при открытии форка создаст свой `.iml` под именем проекта; старый
   `webstorm-config.iml` останется мёртвой ссылкой, если не переименовать.

6. Настройте WebStorm — [webstorm.md](webstorm.md) (один раз).

## Step 2: Framework dependencies

`react` уже в `devDependencies`: он нужен для ESLint (`eslint-plugin-react`) и JSX-типов.
`react-dom` лежит рядом, чтобы при переносе в `dependencies` версии уже совпадали; для
линтинга и `tsc` он не требуется. Если проект **без React**: удалите оба пакета и добавьте
свой фреймворк. После удаления
проверьте конфиги: уберите `jsx: react-jsx` из `tsconfig.json` (или переключите под свой
стек), отключите React-правила в `eslint.config.js`, затем выполните `npm run lint` и
`npm run typecheck`.

Выберите стек и установите: рантайм-пакеты - в `dependencies`, сборщики и плагины - в
`devDependencies` (`-D`):

```bash
# React/Vite
npm install react react-dom
npm install -D vite @vitejs/plugin-react

# Vue/Vite
npm install vue
npm install -D vite @vitejs/plugin-vue

# Svelte/SvelteKit
npm install -D @sveltejs/kit vite

# Astro
npm install -D astro @astrojs/react

# Next.js
npm install next react react-dom
npm install -D @next/eslint-plugin-next eslint-plugin-testing-library
```

## Step 3: Scripts

Добавьте в `package.json` (пример для Vite):

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

Для Next.js те же три шага выглядят так: `"dev": "next dev"`, `"build": "next build"`,
`"start": "next start"`.

## Step 4: Entry point

Для Vite создайте:

```text
index.html
src/
  main.tsx
  App.tsx
```

Тесты Vitest: `src/**/*.test.ts(x)` — см. `vitest.config.ts` и [testing.md](testing.md).

## Step 5: Verify

Полный набор как в CI (`.github/workflows/ci.yml`):

```bash
npm run lint
npm run lint:prettier-conflicts
npm run lint:metrics   # advisory, не блокирует
npm run typecheck
npm run lint:css
npm run lint:md
npm run format:check
npm test
npm run check:file-length
npm run check:docs
npm run check:templates
npm audit --omit=dev --audit-level=high
```

Anti-monolith (`check:file-length`) смотрит `git ls-files`: файлы вне индекса не
проверяются. В CI это не имеет значения: там проверяются все tracked-файлы.

## Если у проекта UI

Есть пользовательские сценарии в браузере (клик-путь, формы, маршрутизация)?
Тогда добавьте e2e: `@playwright/test` или `cypress` — Vitest (даже с `jsdom`)
их не заменяет. Условия и варианты — [testing.md](testing.md). Проекту без UI
(утилиты, конфиги, CLI) e2e не нужен.

## Recommended dependencies

| Project type         | Add to devDependencies                                      |
| -------------------- | ----------------------------------------------------------- |
| React/Vite           | `vite`, `@vitejs/plugin-react`                              |
| Vue/Vite             | `vite`, `@vitejs/plugin-vue`                                |
| Svelte/SvelteKit     | `@sveltejs/kit`, `vite`                                     |
| Astro                | `astro`, `@astrojs/react`                                   |
| React/Next.js        | `@next/eslint-plugin-next`, `eslint-plugin-testing-library` |
| CSS/SCSS             | `stylelint-config-standard-scss`                            |
| Tailwind CSS         | `tailwindcss` (+ см. раздел ниже)                           |
| Storybook            | `storybook`, `@storybook/react-vite`                        |
| Node.js/Backend      | `eslint-plugin-n`                                           |
| Testing (React UI)   | см. [testing.md](testing.md)                                |
| Testing (Playwright) | `@playwright/test`                                          |
| Testing (Cypress)    | `cypress`                                                   |

## Markdown правила

Markdown (`.md`) ограничен 120 символами на строку (как в `AGENTS.md` §3, `.editorconfig`
и `.markdownlint.json`):

- `.editorconfig`: `[*] max_line_length = 120` (для всех файлов; в `[*.md]` только `trim_trailing_whitespace = false`)
- `.markdownlint.json`: `MD013` (лимит 120 символов)

## Tailwind CSS v4

Линтеры в шаблоне уже настроены под Tailwind v4 — не подгоняйте Tailwind-код под линтер.

- `.stylelintrc.json` — at-правила (`@theme`, `@utility`, `@source`, `@apply`, `@layer`).
- `.prettierrc` — `prettier-plugin-tailwindcss` (уже в `devDependencies`).

Импорт в `app/globals.css` (после `npm install tailwindcss`):

```text
@import "tailwindcss";
```

Не используйте `url("tailwindcss")` — браузер не резолвит пакет, стили не применятся.

## Migrating existing projects

Приведение существующего проекта к шаблону. Выполняйте по шагам, коммитьте после каждого.

### 0. Проверьте dependencies

- Если проект **React-centric**: `react` и `react-dom` в `devDependencies` — ок
  для линтинга; для запуска приложения перенесите их в `dependencies`.
- Если проект **без React**: удалите `react`/`react-dom` из `devDependencies`.
- Если проект **не React**: установите свой фреймворк (см. Step 2).

### 1. Скопируйте конфиги

Из шаблона в корень проекта:

```text
eslint.config.js
eslint-parsers/
eslint-rules/
eslint-processors/
scripts/
.prettierrc
.stylelintrc.json
.stylelintignore
.markdownlint.json
eslint.metrics.config.js
.editorconfig
tsconfig.base.json
vitest.config.ts
```

`scripts/` нужен для `check:file-length` и `check:docs` из шага 5; без него эти
команды в Verify упадут с `ENOENT`.

`tsconfig.base.json` содержит только `compilerOptions` и `exclude`. Свой
`tsconfig.json` создайте с явным списком корней, а не с глобом `**/*.ts`:

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["DOM", "DOM.Iterable", "ES2022"]
  },
  "include": ["src", "server", "scripts", "tests", "vitest.config.ts"]
}
```

Глоб подхватывает служебные файлы (отчёты в `drafts/`, покрытие в
`coverage/`), и тогда `npm run typecheck` падает на чужом файле. Список
корней расширяйте своими каталогами исходников.

### 2. Установите devDependencies

```bash
npm install -D \
  eslint @typescript-eslint/parser @eslint/markdown \
  eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y eslint-plugin-jsdoc \
  prettier prettier-plugin-organize-imports prettier-plugin-tailwindcss \
  stylelint stylelint-config-standard \
  markdownlint-cli \
  husky lint-staged \
  @commitlint/cli @commitlint/config-conventional \
  conventional-changelog conventional-changelog-angular \
  vitest @vitest/coverage-v8 typescript
```

Удалите дубликаты, если уже установлены (проверьте `package.json`).

### 3. Husky + lint-staged

```bash
npx husky init
```

Скопируйте хуки из шаблона:

```text
.husky/commit-msg
.husky/pre-commit
.husky/pre-push
```

### 4. WebStorm

Скопируйте `.idea/codeStyles/` из шаблона в `.idea/` проекта — схема Code Style применяется
автоматически (отдельные действия не нужны). Остальные шаги — [webstorm.md](webstorm.md).

### 5. Скрипты

Добавьте в `package.json`:

```json
{
  "scripts": {
    "lint": "eslint . --max-warnings=0",
    "typecheck": "tsc --noEmit",
    "lint:css": "stylelint \"**/*.{css,scss}\" --allow-empty-input",
    "lint:md": "markdownlint \"**/*.md\" --ignore node_modules",
    "lint:prettier-conflicts": "eslint-config-prettier scripts/check-docs.ts",
    "lint:metrics": "eslint . --config eslint.metrics.config.js --no-warn-ignored",
    "check:style-consistency": "node scripts/check-style-consistency.ts",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "check:file-length": "node scripts/check-file-length.ts --all",
    "check:docs": "node scripts/check-docs.ts",
    "prepare": "husky"
  }
}
```

### 6. Verify

Полный набор как в CI (`.github/workflows/ci.yml`):

```bash
npm run lint
npm run lint:prettier-conflicts
npm run lint:metrics   # advisory, не блокирует
npm run typecheck
npm run lint:css
npm run lint:md
npm run format:check
npm test
npm run check:file-length
npm run check:docs
npm run check:workspace-zones
npm run check:ide-state
npm audit --omit=dev --audit-level=high
```

`check:templates` добавьте, если переносите `.idea/liveTemplates/`.

Исправьте ошибки линтеров до зелёного состояния.

## Optional later

- `eslint-plugin-vitest` — ESLint для тестовых файлов.
- Включено в `tsconfig.json` — `describe` / `it` без импортов типизированы.

## Добавить стек (Astro / Vue / Svelte)

Шаблон из коробки — React. Остальное добавляется по рецепту (~10 минут на стек):

| Стек   | Prettier                          | ESLint                        | Игноры        |
| ------ | --------------------------------- | ----------------------------- | ------------- |
| Astro  | `prettier-plugin-astro`           | `@astrojs/eslint-plugin` (\*) | `.astro/`     |
| Vue    | Без плагинов                      | `eslint-plugin-vue` (\*\*)    | `lint-staged` |
| Svelte | `prettier-plugin-svelte` (\*\*\*) | `flat/recommended` (\*\*\*\*) | `lint-staged` |

(\*) Подключать отдельным шагом, проверять на живых файлах.
(\*\*) Flat `recommended` + `parser: tsParser`; a11y отдельно; стили — `standard-vue`.
(\*\*\*) Без плагина Prettier падает (exit 2).
(\*\*\*\*) A11y нет вовсе — только `svelte-check`/компилятор.

Всем стекам: расширить `lint-staged` (`*.{vue,svelte,astro,scss,mts,cts}`),
`lint:css` — на `**/*.{css,scss}` + `stylelint-config-standard-scss`.
