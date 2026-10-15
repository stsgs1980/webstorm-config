# Template Hardening (гейты + R-пакет) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрыть открытые пункты R-листа аудита и гейт-дыры: CI на всех ветках, typecheck/тесты в pre-push, строгий
lint-staged, честное unicode-policy правило, верификатор доков, гигиена IDE-файлов.

**Architecture:** Правки конфигов (ci.yml, хуки, package.json, .npmrc, .nvmrc), переписывание одного ESLint-правила с
тестами RuleTester, новый Node-скрипт верификации доков + шаг CI, точечные правки документации и AI Rules,
коммит/удаление IDE-файлов.

**Tech Stack:** Node ≥24.15 (type stripping для `.ts` -скриптов), ESLint 9 flat + RuleTester, Vitest, Husky v9 (sh -e),
lint-staged 17, GitHub Actions, markdownlint/Prettier.

**Spec:** `docs/superpowers/specs/2026-10-14-template-hardening-design.md`

## Global Constraints

- Node >= 24.15.0, npm >= 11.0.0 (engines); `.nvmrc` после Task 5 — `24.15.0`.
- Каждый коммит — Conventional Commits (`type(scope): description`).
- После каждого задачного набора зелёный полный прогон:

  ```bash
  npm run lint && npm run typecheck && npm run lint:css && \
    npm run lint:md && npm run format:check && npm run check:file-length && npm test
  ```

- НЕ менять: набор стеков (Vue/Svelte/Astro-плагины), мажорные версии (ESLint 10, TS 6), `recommendedTypeChecked`, R17
  (источник стиля), R16 (live templates).
- Windows: `.sh`-скрипты и хуки — через Git Bash; хуки Husky v9 идут через `sh -e`.
- Репозиторий: `C:\Users\stsgr\My Projects\webstorm-config`, HEAD = `aedc954`.

## Review Focus

1. **engine-strict (Task 4):** `.npmrc` с `engine-strict=true` на Node ниже минимума `engines` должен ронять
   `npm install` с EBADENGINE, а на текущем Node 24.18 — проходить без предупреждений. Тест задачи:
   `npm install --dry-run` EXIT 0.
2. **unicode-policy column (Task 6):** RuleTester в 1-based колонках; `pattern.exec(line).index` — 0-based. Off-by-one
   даст падение теста. Тест задачи: фикстуры с точными `column` для `const s = '⏰';`.
3. **lint-staged --max-warnings=0 (Task 3):** warn-правило `react-hooks/exhaustive-deps` должно реально ронять
   `npx lint-staged`. Тест задачи: пробный файл с пустым dep-array, ожидаем EXIT 1.
4. **check-docs regex (Task 11):** сканер ищет `` `npm run X` `` и inline-пути в `.md` — ложные срабатывания на
   упоминаниях будущих скриптов. Тест задачи: allowlist `dev` + зелёный прогон по реальным докам + негативный пробник с
   испорченным бейджем Node.
5. **pre-push на Windows (Task 2):** `npm run` внутри sh-хука. Тест задачи: `sh -n .husky/pre-push` (синтаксис) +
   фактический запуск хука в Git Bash (зелёный прогон typecheck+test, changelog-skip вне main).

---

### Task 1: CI на все ветки

**Files:**

- Modify: `.github/workflows/ci.yml:3-5`

**Interfaces:**

- Consumes: ничего.
- Produces: ветки с PR получают два прогона CI (push — ветка, pull_request — merge-ref); это принятое решение, ничего
  further не потребует.

- [x] **Step 1: Заменить блок `on:` в `ci.yml`**

Было:

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

Стало:

```yaml
on: [push, pull_request]
```

(Блоки `permissions`, `concurrency`, `env` не трогать.)

- [x] **Step 2: Проверить валидность YAML**

Run:

```bash
node -e "const s=require('fs').readFileSync('.github/workflows/ci.yml','utf8');
if (!/^on: \[push, pull_request\]/m.test(s)) process.exit(1);
console.log('OK')"
```

Expected: `OK`

- [x] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run workflow on every branch, not only main"
```

---

### Task 2: pre-push гейтит typecheck и тесты

**Files:**

- Modify: `.husky/pre-push`

**Interfaces:**

- Consumes: npm-скрипты `typecheck` и `test` из `package.json` (уже есть).
- Produces: перед каждым `git push` выполняются `npm run typecheck` && `npm test`; changelog-логика (строки 2-3) не меняется.

- [x] **Step 1: Добавить проверки в `.husky/pre-push` перед changelog-скриптом**

Итоговое содержимое файла:

```sh
#!/usr/bin/env bash
# Гейты перед пушем: типы и тесты
npm run typecheck
npm test
# Generate CHANGELOG on main and block if changed
bash scripts/generate-changelog.sh
```

- [x] **Step 2: Проверить синтаксис и фактический запуск**

Run: `sh -n .husky/pre-push`
Expected: без вывода, EXIT 0.

Run: `bash .husky/pre-push` (в Git Bash; ветка не main → changelog пропускает)
Expected: `[OK]` typecheck молчит (EXIT 0), vitest — все тесты прошли, затем
`Not on main branch (X), skipping changelog generation.`

- [x] **Step 3: Commit**

```bash
git add .husky/pre-push
git commit -m "ci(hooks): gate typecheck and tests on pre-push"
```

---

### Task 3: lint-staged с --max-warnings=0

**Files:**

- Modify: `package.json:52` (lint-staged блок)

**Interfaces:**

- Consumes: правило `react-hooks/exhaustive-deps: "warn"` из `eslint.config.js` (используется как warn-фикстура).
- Produces: `eslint --fix --max-warnings=0` — все warn-правила блокируют коммит.

- [x] **Step 1: Негативный пробник (доказать, что warn сейчас проходит)**

Создать файл `probe-warn.ts` в корне (с JSDoc, чтобы единственный сигнал был warn `exhaustive-deps`, а не jsdoc-ошибки):

```text
import { useEffect } from "react";

const outside = 1;

/**
 * Probe component for the lint-staged warn gate check.
 * @returns null
 */
export function Probe() {
  useEffect(() => {
    console.warn(outside);
  }, []);
  return null;
}
```

Run: `git add probe-warn.ts && npx lint-staged; echo "exit=$?"`
Expected (ДО правки): `exit=0` — warn не блокирует.

- [x] **Step 2: Правка в package.json**

В блоке `"lint-staged"` заменить строку:

```json
"*.{js,ts,jsx,tsx,mjs,cjs,mts,cts}": "eslint --fix",
```

на:

```json
"*.{js,ts,jsx,tsx,mjs,cjs,mts,cts}": "eslint --fix --max-warnings=0",
```

- [x] **Step 3: Негативный пробник (после правки warn блокирует)**

Run: `npx lint-staged; echo "exit=$?"` (файл всё ещё staged)
Expected: `exit=1`, вывод содержит `exhaustive-deps`.

Run: `git rm --cached probe-warn.ts && rm probe-warn.ts`
Expected: дерево чистое (`git status --porcelain` пусто).

- [x] **Step 4: Зелёный прогон**

Run: `npm run lint && npm test`
Expected: EXIT 0.

- [x] **Step 5: Commit**

```bash
git add package.json
git commit -m "chore(lint-staged): block eslint warnings on pre-commit"
```

---

### Task 4: engine-strict

**Files:**

- Create: `.npmrc`

**Interfaces:**

- Consumes: `engines` из `package.json` (`node >=24.15.0`, `npm >=11.0.0`).
- Produces: `npm install`/`npm ci` падают с EBADENGINE на Node ниже минимума.

- [x] **Step 1: Создать `.npmrc`**

```ini
engine-strict=true
```

- [x] **Step 2: Проверить, что на текущем Node установка проходит**

Run: `npm install --dry-run`
Expected: EXIT 0, без EBADENGINE (Node 24.18.x удовлетворяет engines).

- [x] **Step 3: Commit**

```bash
git add .npmrc
git commit -m "chore: enforce engines with engine-strict"
```

---

### Task 5: Конфиг-пины: .nvmrc и vitest types

**Files:**

- Modify: `.nvmrc`
- Modify: `tsconfig.json` (R10)

**Interfaces:**

- Consumes: `engines.node = ">=24.15.0"`; CI читает `.nvmrc` через `node-version-file`.
- Produces: `nvm use` ставит ровно `24.15.0` — версию, равную минимуму engines (R3); `types: ["vitest/globals"]` —
  глобальные `describe` / `it` типизированы для будущих `src/**/*.test.ts` (R10).

- [x] **Step 1: Заменить содержимое `.nvmrc`**

Было: `24`. Стало: `24.15.0`

- [x] **Step 2: Добавить vitest types в `tsconfig.json`**

В `compilerOptions` (после `"lib"`) добавить:

```json
"types": ["vitest/globals"]
```

- [x] **Step 3: Проверить согласованность и типы**

Run:

```bash
node -e "const nvm=require('fs').readFileSync('.nvmrc','utf8').trim();
const eng=require('./package.json').engines.node;
if (nvm !== '24.15.0' || !eng.includes(nvm)) process.exit(1);
console.log('OK')"
```

Expected: `OK`

Run: `npm run typecheck`
Expected: EXIT 0 (если typecheck падает на `node:`-импортах `scripts/*.ts` — добавить `"node"` в массив `types`).

- [x] **Step 4: Commit**

```bash
git add .nvmrc tsconfig.json
git commit -m "chore: pin .nvmrc to 24.15.0 and type vitest globals"
```

---

### Task 6: unicode-policy — точное Unicode-правило (TDD)

**Files:**

- Test: `tests/unicode-policy.test.mjs`
- Modify: `eslint-rules/unicode-policy.js`

**Interfaces:**

- Consumes: API ESLint-правила (`meta.messages`, `create(context)`).
- Produces: два правила с messageId `noEmoji` / `noUnicodeGraphics`; эмодзи-паттерн
  `/\p{Extended_Pictographic}|\p{Regional_Indicator}/u`; отчёт по первой строке-нарушению? Нет — по каждой строке с
  нарушением, один отчёт на строку, `column` = индекс первого совпадения + 1. Имена правил и messageId не меняются (ими
  пользуются конфиг и md-оверрайды).

Эталонные значения (пробником проверено на Node 24):
ловятся эмодзи-правилом: `⏰⭐⬛🀄🅰 ⚙ ✔ ♥ ©®™⚠`; не ловится: `★ → — …`;
графика-правило ловит: `─ █`; не ловит: `★ ✔ ♥ +---+`.

- [x] **Step 1: Переписать тест с новыми ожиданиями (FAIL до реализации)**

В `tests/unicode-policy.test.mjs`, `describe("unicode-policy/emoji")`: валидные фикстуры —
`"export const ok = '[OK]';"`, `"const s = '->';"`, `"const star = '★';"` (не Epicto),
`"const path = 'docs/live-templates/README.md';"`; инвалидные — сохранить существующие
кейсы с заменой `★` на `⏰` и добавить: `©` (кейс «текстовый copyright»),
`🅰` (бывший пропуск U+1F170), кейс с точной колонкой:

```text
{
  name: "column указывает на первый запрещённый символ",
  code: "const s = '⏰';",
  errors: [{ messageId: "noEmoji", line: 1, column: 12 }],
},
```

(Проверить колонку: `const s = '` занимает 11 символов → `⏰` на позиции 12; `exec().index` 0-based, ESLint-колонка =
index + 1. Символ `⏰` U+23F0 — BMP, одна UTF-16-единица; для астральных вроде `🀄` колонка-начало считается так же.)
Кейс «два эмодзи в одной строке дают одну ошибку» сохранить (со `⭐`).
Графику не трогать, кроме как убедиться, что `★ ✔ ♥` теперь в **valid** emoji-фикстурах.

- [x] **Step 2: Запустить тесты, убедиться в FAIL**

Run: `npm test`
Expected: FAIL в `emoji` — `★` больше не даёт ошибку / старые ожидания не выполняются.

- [x] **Step 3: Переписать `eslint-rules/unicode-policy.js`**

Новое тело (сохранить JSDoc-комментарии, структуру экспорта и messageId):

```regex
const emojiPattern = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const unicodeGraphicsPattern = /[\u{2500}-\u{257F}\u{2580}-\u{259F}\u{25A0}-\u{25FF}\u{2800}-\u{28FF}]/u;
```

`createRule` — без `replaceFn` (не использовался): в `Program()` идти по строкам, искать
`emojiPattern.exec(line)` / `unicodeGraphicsPattern.exec(line)`, при нахождении
`context.report({ loc: { line: index + 1, column: match.index + 1 }, messageId })`.
Убрать `eslint-disable no-misleading-character-class` (ручные классы больше нет).

- [x] **Step 4: Запустить тесты, убедиться в PASS**

Run: `npm test`
Expected: все тесты прошли (emoji + graphics).

- [x] **Step 5: Зелёный прогон по репо**

Run: `npm run lint && npm test && npm run lint:md`
Expected: EXIT 0 (в репо нет запрещённых символов в коде; `tests/**` — правила выключены).

- [x] **Step 6: Commit**

```bash
git add eslint-rules/unicode-policy.js tests/unicode-policy.test.mjs
git commit -m "feat(eslint-rules): exact unicode-policy via Extended_Pictographic"
```

---

### Task 7: Закоммитить jsLinters/eslint.xml

**Files:**

- Modify: `.gitignore:31-42` (whitelist `.idea/`)
- Commit: `.idea/jsLinters/eslint.xml` (уже существует на диске, создан IDE: `EslintConfiguration`, `fix-on-save=true`)

**Interfaces:**

- Consumes: схема `.idea/*` whitelist в `.gitignore`.
- Produces: `!.idea/jsLinters/` в whitelist; файл в git — после клона ESLint Automatic + fix on save активны (R4).

- [x] **Step 1: Добавить строку в whitelist `.gitignore`**

После `!.idea/codeStyles/` добавить:

```gitignore
!.idea/jsLinters/
```

- [x] **Step 2: Проверить, что файл перестал игнорироваться, и закоммитить его**

Run: `git check-ignore -v .idea/jsLinters/eslint.xml; echo "exit=$?"`
Expected: `exit=1` (не игнорируется).

Run: `git add .idea/jsLinters/eslint.xml .gitignore`
Run: `git ls-files .idea/jsLinters/`
Expected: `.idea/jsLinters/eslint.xml`

- [x] **Step 3: Commit**

```bash
git commit -m "feat(ide): share ESLint fix-on-save via jsLinters/eslint.xml"
```

---

### Task 8: Удалить мёртвые IDE-файлы, пин JSON-схемы

**Files:**

- Delete: `.idea/watcherTasks.xml`, `.idea/saveactions_settings.xml` (git rm)
- Modify: `.gitignore:34,37` — убрать строки `!.idea/watcherTasks.xml` и `!.idea/saveactions_settings.xml`
- Modify: `.idea/jsonSchemas.xml:10` (R15: пин схемы markdownlint)

**Interfaces:**

- Consumes: whitelist-схема `.gitignore`.
- Produces: файлов нет в git и на диске; схема markdownlint с тега `v0.41.1` (как в `.markdownlint.json`); доки
  поправятся в Task 9.

- [x] **Step 1: Удалить файлы и строки whitelist**

Run: `git rm .idea/watcherTasks.xml .idea/saveactions_settings.xml`
В `.gitignore` удалить две строки whitelist (`!.idea/watcherTasks.xml`, `!.idea/saveactions_settings.xml`).

- [x] **Step 2: Проверить, что удалённые файлы теперь игнорируются**

Run: `git check-ignore -v .idea/watcherTasks.xml; echo "exit=$?"`
Expected: `exit=0` (паттерном `.idea/*`).

- [x] **Step 3: Пин схемы markdownlint (R15)**

В `.idea/jsonSchemas.xml` заменить в URL `relativePathToSchema` часть `/main/` на `/v0.41.1/`:

```text
https://raw.githubusercontent.com/DavidAnson/markdownlint/v0.41.1/schema/markdownlint-config-schema.json
```

(версия `v0.41.1` совпадает с `$schema` в `.markdownlint.json` и с установленной библиотекой).

- [x] **Step 4: Commit**

```bash
git add .gitignore .idea/jsonSchemas.xml
git commit -m "chore(ide): remove dead IDE files, pin markdownlint schema to v0.41.1"
```

---

### Task 9: Синхронизация документации

**Files:**

- Modify: `README.md` (What's Included), `README.template.md:47-49`, `docs/webstorm.md` (чеклист, §3, §10, §11,
  «Согласованность», Windows), `docs/getting-started.md` (Step 5, Migrating §6, Optional later), `docs/markdown.md`
  (новый раздел + чеклист), `.aiassistant/rules/AI Rules.md` (§3, §4)

**Interfaces:**

- Consumes: решения Task 1-8 (удаленные файлы, eslint.xml, `.nvmrc`, pre-push гейты).
- Produces: документы без противоречий репо; check-docs (Task 11) должен пройти по этим файлам.

- [x] **Step 1: README.md — SECURITY в карту репозитория (R2)**

В таблицу «What's Included» добавить строку:

```text
| **Security**    | `SECURITY.md` — политика уязвимостей           |
```

- [x] **Step 2: README.template.md — единая форма anti-monolith (R6)**

Строка 47 заменить на текст: Node.js >= 24.15.0 (обязателен для
`npm run check:file-length` в pre-commit).
Строку 49 («Pre-commit останавливается…») дополнить предложением: перед пушем
pre-push дополнительно прогоняет `npm run typecheck` и `npm test`.

- [x] **Step 3: docs/webstorm.md**

- Чеклист, строка 3: заменить «Включить ESLint (fix on save)» на «ESLint — fix on save (уже в `.idea/jsLinters/`)».
- §3: после списка «Mode: Automatic…» добавить абзац: настройка закоммичена в
  `.idea/jsLinters/eslint.xml` — после клона откройте проект, галочки уже активны.
  Ручные шаги нужны только если файл удалён.
- §10: из списка коммитящихся файлов убрать `watcherTasks.xml` и `saveactions_settings.xml`, добавить `jsLinters/`; в
  конец раздела добавить абзац (R14):
  Белый список осознанный: новый файл настроек `.idea/` не попадёт в git без `!`-строки
  в `.gitignore`. Это отличается от рекомендации JetBrains (коммитить все XML, кроме
  `workspace.xml`) — так надёжнее для форков.
- §11: в пункте 1 убрать ссылку на watcherTasks.xml («сами определения — локально, см. §11» — фразу удалить из §10 было
  сделано выше; в §11 оставить ручную настройку без упоминания удалённого файла).
- «Согласованность IDE и CI»: добавить строку `git push       →  typecheck + тесты (pre-push)`.
- Windows (строка ~173): `node scripts/check-file-length.ts` → `npm run check:file-length` (R6).

- [x] **Step 4: docs/getting-started.md**

- Step 5 и Migrating §6: в набор команд добавить строку `npm run check:docs` после `npm run check:file-length`.
- После кодового блока Step 5 добавить (R21):
  Anti-monolith (`check:file-length`) смотрит `git ls-files` — неотслеживаемые (не
  добавленные в индекс) файлы не проверяются. В CI это не имеет значения: там
  проверяются все tracked-файлы.
- «Optional later»: пункт про `types: ["vitest/globals"]` заменить на «Включено в `tsconfig.json` — `describe` / `it`
  без импортов типизированы.»

- [x] **Step 5: docs/markdown.md — оговорка о границах проверки (R8)**

Добавить раздел после «Fenced code blocks»:

```markdown
## Что проверяет ESLint в .md

ESLint проверяет **только код внутри fenced-блоков** (сниппеты: unicode-policy,
jsx-a11y, синтаксис TS/JS). Прозу документации линтит markdownlint (длина строк,
структура), но эмодзи-политика на **тексте** `.md` не действует — не полагайтесь
на неё для прозы; проверяйте глазами по чеклисту ниже.
```

В чеклисте пункт 4 уточнить: `Нет emoji или Unicode graphics (ESLint unicode-policy — в коде и сниппетах; проза — вручную)`.

- [x] **Step 6: AI Rules.md**

- §3, строка 31 (`Max file length is 250 lines…`): дополнить `(проверяется npm run check:file-length в pre-commit и CI)`.
- §4: блок порогов (строки 42-44) переформулировать со ссылкой на исполнителей:

```markdown
- File exceeds 250 lines (TS/JS) — enforced by `npm run check:file-length`.
- Function exceeds 50 lines or cyclomatic complexity > 15 — enforced by
  WebStorm inspections (`OverlyLongFunctionJS`, `CyclomaticComplexityJS`).
- 3+ `useState` in one component (extract to custom hook).
```

- [x] **Step 7: Зелёный прогон markdown**

Run: `npm run lint:md && npm run format:check`
Expected: EXIT 0 (проверить выравнивание новых строк таблиц MD055/MD056 и длину ≤120).

- [x] **Step 8: Commit**

```bash
git add README.md README.template.md docs/webstorm.md docs/getting-started.md docs/markdown.md ".aiassistant/rules/AI Rules.md"
git commit -m "docs: sync docs with gates, IDE decisions and machine-checked rules"
```

---

### Task 10: Проверяемые правила стиля в ESLint

**Files:**

- Modify: `eslint.config.js:79-97` (блок rules)
- Modify: `scripts/check-file-length.ts:75` (console.log → stdout; аннотации возврата listFiles/main)
- Modify: `.aiassistant/rules/AI Rules.md` §3 (R9: строка о проверяемости правилом)

**Interfaces:**

- Consumes: AI Rules §3 (требования явных типов и запрета произвольного console).
- Produces: правила `explicit-function-return-type` (`error`, allowExpressions +
  allowTypedFunctionExpressions) и `no-console` (`error`, allow: warn/error) в конфиге (R9).

- [x] **Step 1: Негативный пробник (правило ещё не включено)**

Создать `probe-return.ts` (с JSDoc, чтобы до правки единственный сигнал был возврат без типа, а не jsdoc-ошибки):

```text
/**
 * Probe function for the return-type gate check.
 * @param a - number
 * @returns doubled value
 */
export function probe(a: number) {
  return a * 2;
}
```

Run: `npx eslint probe-return.ts; echo "exit=$?"`
Expected (ДО правки): `exit=0` — возврат без типа не ловится.

- [x] **Step 2: Добавить два правила в `eslint.config.js`**

В блок rules (после `jsdoc/require-returns`) добавить:

```json
"@typescript-eslint/explicit-function-return-type": [
  "error",
  { allowExpressions: true, allowTypedFunctionExpressions: true },
],
"no-console": ["error", { allow: ["warn", "error"] }],
```

- [x] **Step 3: Прогон по репо, погасить шум**

Run: `npx eslint probe-return.ts; echo "exit=$?"`
Expected: `exit=1` — `Missing return type on function`.

Run: `npm run lint`
Expected: если есть ошибки — исправить в этом же шаге:

- у `probe-return.ts` — функция-объявление без return type, ловится новым правилом (это ожидание, не шум);
- в `scripts/check-file-length.ts`: заменить `console.log("[OK] …")` на `process.stdout.write("[OK] …\n")` (no-console);
  добавить аннотации возврата: `function listFiles(): string[]` и `function main(): void` (explicit-function-return-type);
- в тестах шума не будет (`allowExpressions` покрывает коллбэки).

- [x] **Step 4: Удалить пробник, зелёный прогон**

Run: `rm probe-return.ts && npm run lint && npm run typecheck && npm test`
Expected: EXIT 0.

- [x] **Step 5: Зафиксировать проверяемость в AI Rules (R9)**

В `.aiassistant/rules/AI Rules.md` §3, после строки про explicit typing (строка 25), добавить:
`Checked by ESLint rule @typescript-eslint/explicit-function-return-type and no-console.`

- [x] **Step 6: Commit**

```bash
git add eslint.config.js scripts/check-file-length.ts ".aiassistant/rules/AI Rules.md"
git commit -m "feat(eslint): enforce explicit return types and no-console"
```

---

### Task 11: check-docs — верификатор документации

**Files:**

- Create: `scripts/check-docs.ts`
- Modify: `package.json` (скрипт `check:docs`), `.github/workflows/ci.yml` (шаг), `README.template.md` (строка Scripts-таблицы)

**Interfaces:**

- Consumes: `package.json` scripts/engines, `.nvmrc`, README-бейдж, перечень `*.md`.
- Produces: `"check:docs": "node scripts/check-docs.ts"`; команда `npm run check:docs`; allowlist `["dev"]` внутри скрипта.

- [x] **Step 1: Написать `scripts/check-docs.ts`**

Три проверки:

1. Сканировать `README.md`, `README.template.md`, `docs/**/*.md` (кроме `docs/superpowers/`, `CHANGELOG.md`):
   извлекать `npm run X` (regex `/npm run ([a-z:.-]+)/g`), пропускать `KNOWN_FUTURE_SCRIPTS = ["dev"]`, остальные
   должны быть ключами `package.json.scripts`.
2. Major из `.nvmrc` должен совпадать с числом перед точкой минимальной версии `engines.node` (regex
   `/(\d+)\.(\d+)\.(\d+)/`), и `README.md` должен содержать `24.15.0` (бейдж).
3. Упоминания путей в inline-code (``/`([^`]+\/[^`]*)`/g``), начинающихся с `docs/`, `.idea/`,
   `scripts/`, `.husky/`, `eslint-rules/`, `eslint-processors/` — существовать в репо (без учёта
   якорей `file.md#section` и путей с `$`/шаблонными строками — пропускать такие).

Стиль: JSDoc на функциях, `console.error` для `[FAIL]`, `process.stdout.write` для `[OK]`, `process.exit(1)` при любых
нарушениях (как в `check-file-length.ts`).

- [x] **Step 2: Добавить npm-скрипт и шаг CI**

`package.json` scripts: `"check:docs": "node scripts/check-docs.ts",` (после `check:file-length`).
`ci.yml` lint-джоб: шаг `- run: npm run check:docs` после `- run: npm run check:file-length`.
`README.template.md` Scripts-таблица: строка с `npm run check:docs` и описанием «Сверка
доков с конфигами (шаблон)» — с выравниванием колонок.

- [x] **Step 3: Зелёный прогон**

Run: `npm run check:docs`
Expected: `[OK]` EXIT 0 (allowlist гасит `dev`).

- [x] **Step 4: Негативные пробники (обе ключевые проверки)**

Пробник A: временно в README.md бейдж `24.15.0` заменить на `24.0.0`, запустить `npm run check:docs` — Expected: FAIL с
сообщением о версии. Вернуть бейдж (git checkout README.md).

Пробник B: временно добавить в README.md строку «Run `npm run nonexistent` to debug» —
запустить — Expected: FAIL с именем скрипта. Вернуть файл.

- [x] **Step 5: Зелёный прогон и Commit**

Run: `npm run lint && npm run typecheck && npm run format:check && npm test`
Expected: EXIT 0.

```bash
git add scripts/check-docs.ts package.json .github/workflows/ci.yml README.template.md
git commit -m "feat(scripts): add check-docs verifier for docs-vs-config drift"
```

---

### Task 12: Финальная верификация

**Files:**

- Modify: ничего (только проверки)

**Interfaces:**

- Consumes: все задачи 1-11.
- Produces: доказательство зелёного состояния перед сдачей.

- [ ] **Step 1: Полный CI-набор**

Run:

```bash
npm run lint && npm run typecheck && npm run lint:css && \
  npm run lint:md && npm run format:check && npm run check:file-length && \
  npm run check:docs && npm test
```

Expected: все команды EXIT 0.

- [ ] **Step 2: Проверка хуков и дерева**

Run: `sh -n .husky/pre-commit && sh -n .husky/pre-push && sh -n .husky/commit-msg; git status --porcelain`
Expected: без вывода (синтаксис ок, дерево чистое).

- [ ] **Step 3: Сверка лога**

Run: `git log --oneline aedc954..HEAD`
Expected: 11 коммитов (Task 1-11), все Conventional Commits.
