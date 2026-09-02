# Getting started (after fork)

Чеклист после создания проекта из шаблона `webstorm-config`. Файл остаётся в репозитории
проекта вместе с конфигами.

## Step 1: Basic setup

1. Обновите `package.json`: `name`, `description`.
2. Скопируйте `README.template.md` → `README.md`, заполните Overview, Features, Architecture.
3. Настройте WebStorm — [webstorm.md](webstorm.md) (один раз).

## Step 2: Framework dependencies

`react` и `react-dom` уже в `dependencies` (шаблон React-centric). Если проект **без React**:
удалите их из `dependencies` и добавьте свой фреймворк.

Выберите стек и установите:

```bash
# React/Vite
npm install vite @vitejs/plugin-react

# Vue/Vite
npm install vite @vitejs/plugin-vue

# Svelte/SvelteKit
npm install @sveltejs/kit vite

# Astro
npm install astro @astrojs/react

# Next.js
npm install @next/eslint-plugin-next eslint-plugin-testing-library
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

```bash
npm run lint
npm run lint:css
npm run lint:md
npm run format
npm test
```

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

- Если проект **React-centric**: `react` и `react-dom` в `dependencies` — ок.
- Если проект **без React**: удалите `react`/`react-dom` из `dependencies`.
- Если проект **не React**: установите свой фреймворк (см. Step 2).

### 1. Скопируйте конфиги

Из шаблона в корень проекта:

```text
eslint.config.js
eslint-rules/
eslint-processors/
.prettierrc
.stylelintrc.json
.markdownlint.json
.markdownlint-cli.json
.editorconfig
tsconfig.base.json
vitest.config.ts
webstorm-codestyle.xml
```

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
```

### 4. WebStorm

Импортируйте `webstorm-codestyle.xml` — [webstorm.md](webstorm.md).

### 5. Скрипты

Добавьте в `package.json`:

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:css": "stylelint \"**/*.css\" --allow-empty-input",
    "lint:md": "markdownlint \"**/*.md\" --ignore node_modules",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "prepare": "husky"
  }
}
```

### 6. Verify

```bash
npm run lint
npm run lint:css
npm run lint:md
npm run format
npm test
```

Исправьте ошибки линтеров до зелёного состояния.

## Optional later

- `eslint-plugin-vitest` — ESLint для тестовых файлов.
- `types: ["vitest/globals"]` в `tsconfig.json` — если используете `describe`/`it` без импортов
  (см. [testing.md](testing.md)).
