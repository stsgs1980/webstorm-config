# webstorm-config

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI][ci-badge]][ci-workflow]
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.22.2-brightgreen.svg)](https://nodejs.org/)
[![WebStorm](https://img.shields.io/badge/WebStorm-2026.2-orange.svg)](https://www.jetbrains.com/webstorm/)

Репозиторий-**шаблон** настроек для WebStorm: ESLint, Prettier, Stylelint, Vitest, Husky, AI rules.

## Docs: один вопрос - один документ

Каждый документ отвечает на свой вопрос; текст на другой вопрос живёт в другом
файле, а здесь остаётся ссылка.

| Документ                                                  | В форке         | Отвечает на вопрос           |
| --------------------------------------------------------- | --------------- | ---------------------------- |
| [README.md](README.md)                                    | это шаблон      | Что это за шаблон            |
| [README.template.md](README.template.md)                  | заменяет README | Какой README будет у проекта |
| [kickoff.md](docs/kickoff.md)                             | удаляется       | Промт запуска настройки      |
| [getting-started.md](docs/getting-started.md)             | да              | Шаги после форка             |
| [webstorm.md](docs/webstorm.md)                           | да              | Что где в IDE                |
| [webstorm-settings.md](docs/webstorm-settings.md)         | да              | Перенос настроек на машину   |
| [live-templates/README.md](docs/live-templates/README.md) | да              | Импорт и устройство шаблонов |
| [testing.md](docs/testing.md)                             | да              | Тесты и покрытие             |
| [markdown.md](docs/markdown.md)                           | да              | Оформление `.md`             |
| [architecture.md](docs/architecture.md)                   | да              | Границы модулей              |
| [security.md](docs/security.md)                           | да              | Правила безопасного кода     |
| [api.md](docs/api.md)                                     | да              | Конвенции HTTP API           |
| [AGENTS.md](AGENTS.md)                                    | да              | Обязательные правила         |
| [SECURITY.md](SECURITY.md)                                | да              | Политика уязвимостей         |
| [CHANGELOG.md](CHANGELOG.md)                              | генерируется    | История версий               |

Справочник и процедура разведены: `webstorm.md` отвечает «что где лежит и как
проверить», `webstorm-settings.md` - «какие шаги выполнить на машине».

## Что есть в шаблоне (и чего нет)

> **Шаблон настроек, не приложение:** нет `src/`, нет `npm run dev` до Steps 2–4 в
> [docs/getting-started.md](docs/getting-started.md).

| Есть сразу после `npm install`   | Нет до настройки проекта |
| -------------------------------- | ------------------------ |
| Линтеры, Prettier, Husky         | `src/`, UI-код           |
| Vitest (тесты в `tests/`)        | `npm run dev` / сборщик  |
| `react` в devDeps (ESLint и TSX) | Vite / Next (Step 2)     |

`react` и `react-dom` в `devDependencies` — **для линтинга и TypeScript (JSX)**, не для запуска
приложения. Сборщик добавляете на Step 2. Проект без React: удалите их и поправьте
`tsconfig.json` (`jsx`) и `eslint.config.js` (React-правила) — детали в Step 2
[getting-started](docs/getting-started.md).

## Quick Start (создать проект из шаблона)

<!-- check-docs:allow-missing-scripts dev test:e2e -->

После любого Option выполните обязательные шаги из [After fork](#after-fork-кратко).

### Option 1: GitHub Template (recommended)

```bash
gh repo create my-project --template stsgs1980/webstorm-config --clone
cd my-project
npm install
```

### Option 2: `degit` (no git history)

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

### Package managers

| Manager | Install        | Lock file           |
| ------- | -------------- | ------------------- |
| npm     | `npm install`  | `package-lock.json` |
| pnpm    | `pnpm install` | `pnpm-lock.yaml`    |
| Bun     | `bun install`  | `bun.lock`          |

## What's Included

| Tool             | Config                                      |
| ---------------- | ------------------------------------------- |
| **ESLint**       | `eslint.config.js` — TS/JS/JSX, React, a11y |
| **Stylelint**    | `.stylelintrc.json`, `.stylelintignore`     |
| **Prettier**     | `.prettierrc`, `.prettierignore`            |
| **markdownlint** | `.markdownlint.json`                        |
| **TypeScript**   | `tsconfig.json` (strict)                    |
| **Git hooks**    | Husky + lint-staged                         |
| **Commitlint**   | Conventional Commits                        |
| **EditorConfig** | `.editorconfig`                             |
| **WebStorm**     | `.idea/` — code style, ESLint, templates    |
| **AI Rules**     | `AGENTS.md` — канон; AI Rules — указатель   |
| **Testing**      | Vitest — `vitest.config.ts`                 |
| **Security**     | `SECURITY.md` — политика уязвимостей        |

## After fork (кратко)

1. Обновите `package.json`: `name`, `description`.
2. `README.template.md` -> `README.md`, заполнить Overview / Features / Architecture
   и заменить плейсхолдеры `${PROJECT_NAME}`, `${DATE}`, `${GITHUB_USER}`.
3. Удалить `CHANGELOG.md` (история шаблона) и `docs/kickoff.md` (стартовый промт):

   ```bash
   rm CHANGELOG.md docs/kickoff.md && git add -A && git commit -m "chore: reset template files"
   ```

4. WebStorm — [docs/webstorm.md](docs/webstorm.md).
5. Фреймворк, `src/`, скрипты — [docs/getting-started.md](docs/getting-started.md) (Steps 2–5).

## Conventions

См. [AGENTS.md](AGENTS.md): JSDoc, strict TS, 120 chars, Conventional Commits,
anti-monolith (250 lines; test files are exempt).

## License

MIT

[ci-badge]: https://github.com/stsgs1980/webstorm-config/actions/workflows/ci.yml/badge.svg
[ci-workflow]: https://github.com/stsgs1980/webstorm-config/actions/workflows/ci.yml
