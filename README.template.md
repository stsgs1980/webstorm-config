# ${PROJECT_NAME}

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
- **Linting**: ESLint, Prettier
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
