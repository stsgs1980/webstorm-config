# Testing with Vitest

Шаблон включает Vitest с `environment: "node"` — этого достаточно для юнит-тестов
чистых функций и Node-логики. Менять конфиг **не нужно**, пока вы не начнёте
тестировать React-компоненты или код с DOM (`document`, `window`, `localStorage`).

## Где чьи тесты

- `tests/**` — проверки тулчейна самого шаблона (например `unicode-policy`), не удалять при fork.
- `src/**` — тесты вашего проекта, создаются по Step 4 в [getting-started.md](getting-started.md).

## Изоляция git-фикстур

Тесты, создающие временные репозитории, запускают `git` и скрипты под тестом через
`gitEnv()` из `tests/lib/git-env.mjs`. Хук (pre-commit, pre-push) экспортирует
`GIT_DIR`; унаследованное значение уводит `git init` и `git commit` в репозиторий,
который пушат. В linked worktree это уже давало коммиты фикстур в чужую ветку и
`core.bare=true` на основном репозитории; helper убирает все `GIT_*`-переменные.

## Скрипты

| Команда                 | Описание                      |
| ----------------------- | ----------------------------- |
| `npm test`              | Запуск тестов (один прогон)   |
| `npm run test:watch`    | Тесты в watch-режиме          |
| `npm run test:coverage` | Тесты с отчётом покрытия (v8) |

## Когда менять конфиг

| Сценарий                                    | `environment`          | Доп. пакеты                          |
| ------------------------------------------- | ---------------------- | ------------------------------------ |
| Утилиты, парсеры, API-хелперы               | `node` (как сейчас)    | —                                    |
| React-компоненты, хуки с DOM                | `jsdom`                | Testing Library + `jsdom` (см. ниже) |
| Полные пользовательские сценарии в браузере | Vitest не заменяет e2e | `@playwright/test` или `cypress`     |

## Как переключить Vitest на React/DOM-тесты

**1. Установите зависимости:**

```bash
npm install -D jsdom @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event
```

**2. Обновите `vitest.config.ts`:**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
```

**3. Создайте `src/test/setup.ts`:**

```typescript
import "@testing-library/jest-dom/vitest";
```

**4. (Опционально) Добавьте типы Vitest в `tsconfig.json`**, если используете
`describe` / `it` / `expect` без импортов:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

**5. Пример теста компонента (`src/Button.test.tsx`):**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Submit</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

## Уровни тестирования (не путать)

- **Vitest + `node`** — юнит-тесты без UI (уже в шаблоне).
- **Vitest + `jsdom` + Testing Library** — компоненты и интеграция в изолированном DOM.
- **Playwright / Cypress** — e2e в реальном браузере; дополняют Vitest, а не заменяют его.

## E2E: Playwright (когда есть UI)

Vitest не заменяет реальный браузер: клики, формы, маршрутизация, загрузка
данных. Playwright добавляется после Steps 2-4 в [getting-started.md](getting-started.md),
когда приложение уже запускается.

```bash
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

`playwright.config.ts` в корне: `testDir: "tests/e2e"`, `webServer` с командой
запуска приложения (`npm run dev`), `baseURL` из окружения. Скрипт `test:e2e`
(`playwright test`) добавляется в `package.json` вместе с зависимостью; в таблице
скриптов шаблона он помечен как план.

Что покрывать: критический путь (вход, оформление заказа, сохранение формы), а
не каждый компонент. Селекторы - по роли и подписи (`getByRole`), не по
CSS-классам. В CI e2e идёт отдельной джобой с установленными браузерами; в
шаблоне её нет, пока нет UI.

## Coverage-гейт: принятое решение

Порог - 80% строк на изменённых файлах, не глобальный. Схема (ещё не в CI):

```bash
git diff --name-only -- '*.ts' origin/main...HEAD   # изменённые файлы
npx vitest related <files> --coverage --coverage.reporter=json-summary
# небольшой скрипт сверяет per-file покрытие из coverage/coverage-summary.json
```

Статус: решение зафиксировано 02.11.2026, реализация - отдельная задача.
Глобальный порог не вводится: пока гейта на изменениях нет, общая цифра ничего
не гарантирует и стимулирует тесты ради процента.
