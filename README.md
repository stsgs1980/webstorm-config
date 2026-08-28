# webstorm-config

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/stsgs1980/webstorm-config/actions/workflows/ci.yml/badge.svg)](https://github.com/stsgs1980/webstorm-config/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.12.0-brightgreen.svg)](https://nodejs.org/)
[![WebStorm](https://img.shields.io/badge/WebStorm-2026.2-orange.svg)](https://www.jetbrains.com/webstorm/)
[![Stylelint](https://img.shields.io/badge/Stylelint-17.x-263227.svg)](https://stylelint.io/)
[![markdownlint](https://img.shields.io/badge/markdownlint-0.x-263227.svg)](https://github.com/DavidAnson/markdownlint)

Template repository for WebStorm projects with pre-configured ESLint, Prettier, Stylelint, markdownlint, TypeScript, Husky, and AI rules.

## Quick Start

### Option 1: GitHub Template (recommended)

```bash
gh repo create my-project --template stsgs1980/webstorm-config --clone
cd my-project
npm install
```

### Option 2: degit (no git history)

```bash
npx degit stsgs1980/webstorm-config my-project
cd my-project
npm install
```

### Option 3: Manual clone

```bash
git clone https://github.com/stsgs1980/webstorm-config my-project
cd my-project
rm -rf .git
git init
npm install
```

### Package Managers

Template works with any package manager:

| Manager  | Install        | Run            | Lock file           |
| -------- | -------------- | -------------- | ------------------- |
| **npm**  | `npm install`  | `npm run dev`  | `package-lock.json` |
| **pnpm** | `pnpm install` | `pnpm run dev` | `pnpm-lock.yaml`    |
| **Bun**  | `bun install`  | `bun run dev`  | `bun.lockb`         |

## What's Included

| Tool                                 | Config                                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **ESLint**                           | `eslint.config.js` — TS/JS/JSX/MD, JSDoc, React, a11y, unicode policy                                            |
| **Stylelint**                        | `.stylelintrc.json` — CSS linting, толерантен к at-правилам Tailwind v4 (`@theme`, `@utility`, `@source` и т.д.) |
| **Prettier**                         | `.prettierrc` + `.prettierignore`, плагины: `prettier-plugin-organize-imports`, `prettier-plugin-tailwindcss`    |
| **markdownlint**                     | `.markdownlint.json` — Markdown linting                                                                          |
| **React ESLint plugins**             | `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`                                     |
| **prettier-plugin-organize-imports** | Auto-sorts imports on format                                                                                     |
| **TypeScript**                       | `tsconfig.json` (extends `tsconfig.base.json`), strict mode                                                      |
| **Git hooks**                        | Husky + lint-staged (pre-commit: prettier, eslint, stylelint, markdownlint)                                      |
| **Commitlint**                       | Conventional Commits (`feat:`, `fix:`, `docs:`, etc.)                                                            |
| **EditorConfig**                     | `.editorconfig`                                                                                                  |
| **WebStorm codestyle**               | `webstorm-codestyle.xml`                                                                                         |
| **AI Rules**                         | `.aiassistant/rules/AI Rules.md` — project conventions (JSDoc, trailing commas, 250 lines max, TS strict)        |
| **Custom ESLint rules**              | `eslint-rules/` (unicode-policy, code-block-language)                                                            |
| **Custom processors**                | `eslint-processors/` (markdown snippets)                                                                         |
| **Testing**                          | Vitest + coverage (v8)                                                                                           |

## Project Conventions (from `.aiassistant/rules/AI Rules.md`)

- **JSDoc** required for every function/method/React component (`@param`, `@returns`)
- **Trailing commas** required in objects/arrays
- **Max file length**: 250 lines (TS/JS), 200 lines (components)
- **TypeScript strict mode**, explicit types (no `any`)
- **Double quotes**, semicolons, 2 spaces, 120 char line limit
- **Anti-monolith**: auto-split at thresholds (3+ useState, 50-line functions)
- **Conventional Commits** enforced via commitlint

## After Creating a Project

### Step 1: Basic Setup

1. Update `package.json`:
   - `name` — project name (e.g., `my-react-app`)
   - `description` — project description

2. Copy `README.template.md` → `README.md` and fill in:
   - Project overview
   - Features
   - Architecture

### Step 2: Add Framework Dependencies

Choose your stack from the table below and install:

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

### Step 3: Add Scripts

Add framework-specific scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### Step 4: Create Entry Point

For Vite projects, create:

```text
index.html
src/
  main.tsx
  App.tsx
```

### Step 5: Verify Everything Works

```bash
npm run lint      # ESLint
npm run lint:css  # Stylelint
npm run lint:md   # markdownlint
npm run format    # Prettier
npm test          # Vitest
```

## Recommended Dependencies by Project Type

| Project Type             | Add to devDependencies                                          |
| ------------------------ | --------------------------------------------------------------- |
| **React/Vite**           | `vite`, `@vitejs/plugin-react`                                  |
| **Vue/Vite**             | `vite`, `@vitejs/plugin-vue`                                    |
| **Svelte/SvelteKit**     | `@sveltejs/kit`, `vite`                                         |
| **Astro**                | `astro`, `@astrojs/react`                                       |
| **React/Next.js**        | `@next/eslint-plugin-next`, `eslint-plugin-testing-library`     |
| **CSS/SCSS**             | `stylelint-config-standard-scss`                                |
| **Tailwind CSS**         | `prettier-plugin-tailwindcss` (уже в базовых `devDependencies`) |
| **Storybook**            | `storybook`, `@storybook/react-vite`                            |
| **Node.js/Backend**      | `eslint-plugin-n`                                               |
| **Testing (Jest)**       | `jest`, `eslint-plugin-jest`                                    |
| **Testing (Playwright)** | `@playwright/test`                                              |
| **Testing (Cypress)**    | `cypress`                                                       |

## Tailwind CSS v4

Если проект использует Tailwind v4, базовые линтеры уже настроены его понимать — **не подгоняйте Tailwind-код под линтер**, подстраивайте линтер под Tailwind.

- `.stylelintrc.json` игнорирует at-правила Tailwind (`@theme`, `@custom-variant`, `@utility`, `@source`, `@apply`, `@layer` и т.д.) и отключает `import-notation`, чтобы `@import "tailwindcss";` (строковая форма) не считался ошибкой.
- `.prettierrc` подключает `prettier-plugin-tailwindcss` (сортировка Tailwind-классов). Плагин уже в `devDependencies`.

**Важно:** в `app/globals.css` (или аналоге) импорт Tailwind должен быть строго строковым:

```css
@import "tailwindcss";
```

Форма `url("tailwindcss")` распознаётся браузером как обычный CSS-импорт, который он не резолвит — компиляция утилит не происходит и UI остаётся без стилей.

## License

MIT
