# webstorm-config

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.12.0-brightgreen.svg)](https://nodejs.org/)
[![WebStorm](https://img.shields.io/badge/WebStorm-2026.2-orange.svg)](https://www.jetbrains.com/webstorm/)
[![Stylelint](https://img.shields.io/badge/Stylelint-16.x-263227.svg)](https://stylelint.io/)
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

## What's Included

| Tool                                 | Config                                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| **ESLint**                           | `eslint.config.js` — TS/JS/JSX/MD, JSDoc, React, a11y, unicode policy                                     |
| **Prettier**                         | `.prettierrc` + `.prettierignore`                                                                         |
| **Stylelint**                        | `.stylelintrc.json` — CSS linting                                                                         |
| **markdownlint**                     | `.markdownlint.json` — Markdown linting                                                                   |
| **React ESLint plugins**             | `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`                              |
| **prettier-plugin-organize-imports** | Auto-sorts imports on format                                                                              |
| **TypeScript**                       | `tsconfig.json` (extends `tsconfig.base.json`), strict mode                                               |
| **Git hooks**                        | Husky + lint-staged (pre-commit: prettier, eslint, stylelint, markdownlint)                               |
| **Commitlint**                       | Conventional Commits (`feat:`, `fix:`, `docs:`, etc.)                                                     |
| **EditorConfig**                     | `.editorconfig`                                                                                           |
| **WebStorm codestyle**               | `webstorm-codestyle.xml`                                                                                  |
| **AI Rules**                         | `.aiassistant/rules/AI Rules.md` — project conventions (JSDoc, trailing commas, 250 lines max, TS strict) |
| **Custom ESLint rules**              | `eslint-rules/` (unicode-policy, code-block-language)                                                     |
| **Custom processors**                | `eslint-processors/` (markdown snippets)                                                                  |

## Project Conventions (from `.aiassistant/rules/AI Rules.md`)

- **JSDoc** required for every function/method/React component (`@param`, `@returns`)
- **Trailing commas** required in objects/arrays
- **Max file length**: 250 lines (TS/JS), 200 lines (components)
- **TypeScript strict mode**, explicit types (no `any`)
- **Double quotes**, semicolons, 2 spaces, 120 char line limit
- **Anti-monolith**: auto-split at thresholds (3+ useState, 50-line functions)
- **Conventional Commits** enforced via commitlint

## After Creating a Project

1. Update `package.json`: `name`, `description`
2. Copy `README.template.md` → `README.md` and fill in project details
3. Adjust `eslint.config.js` if needed (e.g., change JSDoc warnings to errors)
4. Add project-specific scripts to `package.json`

## Recommended Dependencies by Project Type

| Project Type         | Add to devDependencies                                      |
| -------------------- | ----------------------------------------------------------- |
| **React/Next.js**    | `@next/eslint-plugin-next`, `eslint-plugin-testing-library` |
| **CSS/SCSS**         | `stylelint-config-standard-scss`                            |
| **Tailwind CSS**     | `prettier-plugin-tailwindcss`                               |
| **Node.js/Backend**  | `eslint-plugin-n`                                           |
| **Testing (Vitest)** | `vitest`, `@vitest/coverage-v8`                             |
| **Testing (Jest)**   | `jest`, `eslint-plugin-jest`                                |

## License

MIT
