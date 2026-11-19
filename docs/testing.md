# Testing with Vitest

<!-- check-docs:allow-missing-scripts dev test:e2e -->

Шаблон включает Vitest с `environment: "node"` — этого достаточно для юнит-тестов
чистых функций и Node-логики. Менять конфиг **не нужно**, пока вы не начнёте
тестировать React-компоненты или код с DOM (`document`, `window`, `localStorage`).

## Где чьи тесты

- `tests/**` — проверки тулчейна самого шаблона (например `unicode-policy`), не удалять при fork.
- `src/**` — тесты вашего проекта, создаются по Step 4 в [getting-started.md](getting-started.md).

## Пустой набор тестов

`passWithNoTests` выключен намеренно: `npm test` и pre-push падают, если тестов нет.
Перед первым push добавьте хотя бы один `src/*.test.ts` (Step 4) или оставьте
поставляемый `tests/`. Вместо generic-ошибки Vitest срабатывает
`scripts/check-test-files.ts` и печатает, что именно создать.

## Изоляция git-фикстур

Тесты, создающие временные репозитории, запускают `git` и скрипты под тестом через
`gitEnv()` из `tests/lib/git-env.mjs`. Хук (pre-commit, pre-push) экспортирует
`GIT_DIR`; унаследованное значение уводит `git init` и `git commit` в репозиторий,
который пушат. В linked worktree это уже давало коммиты фикстур в чужую ветку и
`core.bare=true` на основном репозитории; helper убирает все `GIT_*`-переменные.

## Скрипты

| Команда                  | Описание                            |
| ------------------------ | ----------------------------------- |
| `npm test`               | Запуск тестов (один прогон)         |
| `npm run test:watch`     | Тесты в watch-режиме                |
| `npm run test:coverage`  | Тесты с отчётом покрытия (v8)       |
| `npm run check:coverage` | 80% строк на изменённых файлах (CI) |

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
import { COVERAGE_INCLUDE } from "./scripts/lib/coverage-scope.ts";

export default defineConfig({
  test: {
    globals: true,
    // Project addition: browser environment for DOM tests.
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    // Keep: template keys. An empty suite must not look green, and fixture
    // tests spawn git/npx/tsc and need the raised timeout.
    passWithNoTests: false,
    testTimeout: 30_000,
    // Extend, never remove: tests/** and scripts/** are the toolchain tests
    // shipped with the template; dropping them silently disables the gates.
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "tests/**/*.{test,spec}.{ts,tsx,mjs}",
      "scripts/**/*.{test,spec}.{ts,mjs}",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Scope owner: add src/** here (scripts/lib/coverage-scope.ts); the
      // changed-file gate filters the same list.
      include: COVERAGE_INCLUDE,
    },
  },
});
```

Не удаляйте из этого конфига поставляемые ключи: `passWithNoTests: false` и
`testTimeout: 30_000` отвечают за честный набор и медленные fixture-тесты, а корни
`tests/**` и `scripts/**` в `include` — за тесты тулчейна шаблона. Расширяйте
`include`, а не заменяйте его.

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

## Coverage-гейт: 80% строк на изменённых файлах

Гейт подключён в CI джобой `coverage` (`npm run check:coverage`). Скоуп и порог
живут в `scripts/lib/coverage-scope.ts`: `vitest.config.ts` импортирует оттуда
`COVERAGE_INCLUDE`, поэтому отчёт и гейт меряют один набор файлов.

`scripts/check-changed-coverage.ts`:

1. разрешает базу: `--base`, затем `COVERAGE_BASE_SHA` (PR base sha или
   `github.event.before`), затем merge-base с `origin/main`;
2. оставляет изменённые `*.{ts,tsx,js,...}` в измеряемых корнях, кроме `*.d.ts`
   и `*.test.*` / `*.spec.*`;
3. запускает `vitest related <files> --coverage --coverage.reporter=json-summary`;
4. падает, если у изменённого файла нет данных покрытия (нет связанного теста)
   или меньше 80% строк.

Локально: `npm run check:coverage` (нужен `origin/main`; `--base <ref>` меняет
базу). `--summary <file>` сверяет готовый `coverage/coverage-summary.json`, не
запуская Vitest.

Шаблон меряет `eslint-rules/`, `eslint-parsers/`, `eslint-processors/` и
`tests/lib/`; форк с `src/` добавляет `src/**` в `COVERAGE_INCLUDE` один раз.
Изменения вне скоупа (доки, `scripts/`, конфиги, сами тесты) гейт печатает как
`[INFO] ... outside the coverage scope` и не меряет: это задокументированная
слепая зона, а не зелёный результат покрытия. Глобальный порог не вводится:
общая цифра ничего не гарантирует и стимулирует тесты ради процента.

Скрипты `scripts/**` запускаются через `execFileSync`, поэтому v8 их не
инструментирует; их поведение проверяется фикстурами, а не процентом строк.
