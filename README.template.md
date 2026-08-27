# ${PROJECT_NAME}

[![Build Status](https://img.shields.io/badge/build-pending-yellow.svg)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-blue.svg)](https://www.typescriptlang.org/)
[![ESLint](https://img.shields.io/badge/ESLint-10.x-4B32C3.svg)](https://eslint.org/)
[![Prettier](https://img.shields.io/badge/Prettier-3.x-F7B93E.svg)](https://prettier.io/)
[![Stylelint](https://img.shields.io/badge/Stylelint-17.x-263227.svg)](https://stylelint.io/)
[![markdownlint](https://img.shields.io/badge/markdownlint-0.x-263227.svg)](https://github.com/DavidAnson/markdownlint)
[![jsx-a11y](https://img.shields.io/badge/jsx--a11y-accessible-brightgreen.svg)](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y)

> **Status**: ACTIVE
> **Last Updated**: ${DATE}

## Overview

Краткое описание проекта, его цели и решаемые задачи.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

## Features

- Функция 1
- Функция 2

## Tech Stack

- **Language**: JavaScript / TypeScript
- **Framework**: Next.js / React
- **Linting**: ESLint, Stylelint, markdownlint, Prettier
- **Accessibility**: eslint-plugin-jsx-a11y
- **Hooks**: Husky, lint-staged

## Getting Started

### Prerequisites

- Node.js >= 20.12.0
- npm

### Installation

1. Клонируйте репозиторий:

   ```bash
   git clone <repository-url>
   ```

2. Установите зависимости:

   ```bash
   npm install
   ```

## Scripts

- `npm run dev` — запуск development сервера.
- `npm run lint` — проверка кода через ESLint.
- `npm run lint:css` — проверка стилей через Stylelint.
- `npm run lint:md` — проверка Markdown через markdownlint.
- `npm run format` — форматирование кода через Prettier.
- `npm run validate` — комплексная проверка (lint + typecheck + test).

## Architecture

Опишите архитектуру проекта (например, FSD - Feature-Sliced Design).

- `app/` — точка входа и маршрутизация.
- `features/` — бизнес-логика и кастомные хуки.
- `sections/` — крупные UI-блоки.
- `shared/` — переиспользуемые утилиты и компоненты.

## Contributing

1. Создайте новую ветку: `git checkout -b feat/your-feature`.
2. Сделайте коммит: `git commit -m "feat: add your feature"`.
3. Отправьте изменения: `git push origin feat/your-feature`.

## License

Этот проект распространяется под лицензией MIT.
