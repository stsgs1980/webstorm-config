# webstorm-config

Template repository for WebStorm projects with pre-configured ESLint, Prettier, TypeScript, Husky, and AI rules.

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

| Tool                    | Config                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| **ESLint**              | `eslint.config.js` — TS/JS/JSX/MD, JSDoc required, unicode policy, markdown snippets                      |
| **Prettier**            | `.prettierrc` + `.prettierignore`                                                                         |
| **TypeScript**          | `tsconfig.json` (extends `tsconfig.base.json`), strict mode                                               |
| **Git hooks**           | Husky + lint-staged (pre-commit: prettier + eslint --fix)                                                 |
| **Commitlint**          | Conventional Commits (`feat:`, `fix:`, `docs:`, etc.)                                                     |
| **EditorConfig**        | `.editorconfig`                                                                                           |
| **WebStorm codestyle**  | `webstorm-codestyle.xml`                                                                                  |
| **AI Rules**            | `.aiassistant/rules/AI Rules.md` — project conventions (JSDoc, trailing commas, 250 lines max, TS strict) |
| **Custom ESLint rules** | `eslint-rules/` (unicode-policy, code-block-language)                                                     |
| **Custom processors**   | `eslint-processors/` (markdown snippets)                                                                  |

## Project Conventions (from `.aiassistant/rules/AI Rules.md`)

- **JSDoc** required for every function/method/React component (`@param`, `@returns`)
- **Trailing commas** required in objects/arrays
- **Max file length**: 250 lines (TS/JS), 200 lines (components)
- **TypeScript strict mode**, explicit types (no `any`)
- **Single quotes**, semicolons, 2 spaces, 100 char line limit
- **Anti-monolith**: auto-split at thresholds (3+ useState, 50-line functions)
- **Conventional Commits** enforced via commitlint

## After Creating a Project

1. Update `package.json`: `name`, `description`, `author`
2. Copy `README.template.md` → `README.md` and fill in project details
3. Adjust `eslint.config.js` if needed (e.g., change JSDoc warnings to errors)
4. Add project-specific scripts to `package.json`

## License

MIT
