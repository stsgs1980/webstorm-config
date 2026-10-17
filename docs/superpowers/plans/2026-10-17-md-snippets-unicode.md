# Юникод-политика в не-JS markdown-сниппетах: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** unicode-policy (`emoji`, `unicode-graphics`) проверяет сниппеты любого языка в
`*.md`; поведение js/ts-сниппетов не меняется.

**Architecture:** Мёртвый блок `files: ["**/*.md/**"]` (ESLint не даёт конфиг файлам,
матчащимся только «универсальными» паттернами) заменяется точечным `files: ["**/*.md/*.*"]`
с `ignores` для js/ts и минимальным парсером `eslint-parsers/plain-text.js` (пустая
`Program`; правила читают сырой текст). JS/TS-сниппеты остаются за существующим блоком
`**/*.{ts,...}` с `tsParser`.

**Tech Stack:** ESLint 9.39 (flat config), @eslint/markdown 8.0.3, vitest 5, Node.js >= 22.22.2.

**Spec:** `docs/superpowers/specs/2026-10-17-md-snippets-unicode-design.md`

## Global Constraints

- Node.js >= 22.22.2, npm >= 10.9.0 (engines).
- Prettier: printWidth 120, double quotes, trailing commas, LF.
- `markdownlint`: default + MD013 (120, code_blocks off) + MD060 aligned; все код-фенсы с языком.
- Коммиты: conventional commits, subject по-английски; `test:` и `fix(...)` видны в
  changelog, `docs:` — скрыт.
- Каждый коммит проходит хуки: pre-commit (lint-staged: prettier + `markdownlint` + eslint;
  check-file-length — лимит 250 строк для не-тестовых TS/JS) и pre-push (typecheck + test).
- Без новых зависимостей. Правки только в: `eslint.config.js`, `eslint-parsers/plain-text.js`
  (новый), `tests/markdown-snippets.test.mjs`, `docs/markdown.md`, `scripts/check-docs.ts`,
  `CHANGELOG.md` (генерация).
- Ни одного литерального эмодзи/псевдографики в плане, спеке и новых фикстурах: в тексте —
  нотация `U+XXXX`, в коде — escape-последовательности `\u{...}` (плановые файлы сами
  линтуются).

## Review Focus

1. `ts`-сниппет с TS-синтаксисом: TS-пайплайн сохраняется — тест «ts-сниппет остаётся на
   TS-парсере» (Task 1).
2. Многосимвольные расширения (`python`) и прочие языки (`bash`, `text`): ловятся без
   ручных списков расширений (Task 1).
3. `markdown`- и plain-фенсы: не ловятся (Task 1).
4. Чистые не-JS сниппеты: ни одного сообщения (Task 1).
5. Самопрогон: `npm run lint` и `npm run check:docs` чистые с учётом плана и спеки (Task 2).

---

### Task 0: Зафиксировать дизайн и план

Files:

- Create: `docs/superpowers/specs/2026-10-17-md-snippets-unicode-design.md` (создан при
  планировании)
- Create: `docs/superpowers/plans/2026-10-17-md-snippets-unicode.md` (этот файл)

- [ ] **Step 1: Проверить форматирование и разметку**

```bash
npx prettier --check docs/superpowers
npm run lint:md
```

Expected: обе команды зелёные. При замечаниях — исправить и повторить.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers
git commit -m "docs: add md snippets unicode design and plan"
```

### Task 1: Красные интеграционные тесты

Files:

- Modify: `tests/markdown-snippets.test.mjs`

Interfaces:

- Consumes: `prodConfig` из `../eslint.config.js` (существующий импорт), текущие 3 теста.
- Produces: helper `lintMarkdownAll(text)` — все сообщения ESLint; расширенный typedef
  `LintMessageInfo` (`message`, `messageId`, `fatal`); 7 новых тестов (4 «красных» до Task 2).

- [ ] **Step 1: Заменить typedef и helper `lintMarkdown` (строки 9-23)**

```text
/**
 * @typedef {object} LintMessageInfo
 * @property {string | null} ruleId
 * @property {number} line
 * @property {number} column
 * @property {string} message
 * @property {string} [messageId]
 * @property {boolean} [fatal]
 */

const lintMarkdownAll = async (text) => {
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: prodConfig });
  const results = await eslint.lintText(text, { filePath: "docs/fixture.md" });
  /** @type {LintMessageInfo[]} */
  const messages = results.flatMap((result) => result.messages);

  return messages;
};

const lintMarkdown = async (text) =>
  (await lintMarkdownAll(text)).filter((message) => message.ruleId?.startsWith("unicode-policy"));
```

- [ ] **Step 2: Добавить 7 тестов в `describe("markdown-snippets", ...)`**

Вставить после существующих тестов, перед закрывающей `});` файла:

````text
  it("эмодзи в json-сниппете ловится", async () => {
    const messages = await lintMarkdown("# Demo\n\n```json\n{\"status\": \"Готово \u{1F600}\"}\n```\n");

    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, "unicode-policy/emoji");
    assert.equal(messages[0].messageId, "noEmoji");
    assert.equal(messages[0].line, 4);
    assert.equal(messages[0].column, 20);
  });

  it("эмодзи в python-сниппете ловится (расширение .python)", async () => {
    const messages = await lintMarkdown("# Demo\n\n```python\nprint(\"Ещё раз \u{1F525}\")\n```\n");

    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, "unicode-policy/emoji");
    assert.equal(messages[0].line, 4);
    assert.equal(messages[0].column, 16);
    assert.ok(messages[0].message.includes("U+1F525"));
  });

  it("псевдографика в bash-сниппете ловится по всем вхождениям", async () => {
    const messages = await lintMarkdown("# Demo\n\n```bash\nprintf \"\u{2588}\u{2588}\u{2588}\"\n```\n");

    assert.equal(messages.length, 3);
    assert.deepEqual(
      messages.map((message) => message.column),
      [9, 10, 11],
    );
    assert.equal(messages[0].ruleId, "unicode-policy/unicode-graphics");
    assert.equal(messages[0].messageId, "noUnicodeGraphics");
    assert.ok(messages[0].message.includes("U+2588"));
  });

  it("эмодзи в text-сниппете ловится", async () => {
    const messages = await lintMarkdown("# Demo\n\n```text\nсхема: \u{23F0}\n```\n");

    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, "unicode-policy/emoji");
    assert.equal(messages[0].line, 4);
    assert.equal(messages[0].column, 8);
  });

  it("ts-сниппет остаётся на TS-парсере", async () => {
    const messages = await lintMarkdownAll("# Demo\n\n```ts\nconst s: string = '\u{23F0}';\n```\n");

    const fatal = messages.filter((message) => message.fatal);
    const unused = messages.filter((message) => message.ruleId === "@typescript-eslint/no-unused-vars");
    const emoji = messages.filter((message) => message.ruleId === "unicode-policy/emoji");

    assert.equal(fatal.length, 0);
    assert.equal(unused.length, 1);
    assert.equal(emoji.length, 1);
    assert.equal(emoji[0].line, 4);
    assert.equal(emoji[0].column, 20);
  });

  it("markdown- и plain-фенсы не проверяются", async () => {
    const messages = await lintMarkdown(
      "# Demo\n\n```markdown\n# заголовок \u{1F600}\n```\n\n```\nпросто \u{1F600}\n```\n",
    );

    assert.equal(messages.length, 0);
  });

  it("чистые не-JS сниппеты не дают сообщений", async () => {
    const messages = await lintMarkdown("# Demo\n\n```json\n{\"ok\": true}\n```\n\n```py\nx = 1\n```\n");

    assert.equal(messages.length, 0);
  });
````

Note: фикстуры записаны escape-последовательностями (`\u{...}`), чтобы сам план проходил
lint без литеральных эмодзи; в рантайме строки содержат реальные символы.

- [ ] **Step 3: Прогнать тесты — ожидаем красные**

```bash
npx vitest run tests/markdown-snippets.test.mjs
```

Expected: падают 4 новых теста (json, python, bash, text) с `AssertionError` прод-конфига
(«сообщений нет» вместо 1/3); проходят 6 (3 существующих, ts-регрессия, два негативных).
Красные до Task 2. Не пушить до Task 4: pre-push гоняет тесты.

- [ ] **Step 4: Commit**

```bash
git add tests/markdown-snippets.test.mjs
git commit -m "test: cover unicode policy in non-JS markdown snippets"
```

### Task 2: Парсер, конфиг и документация

Files:

- Create: `eslint-parsers/plain-text.js`
- Modify: `eslint.config.js` (импорт + замена блока в строках 48-64)
- Modify: `docs/markdown.md` (раздел «Что проверяет ESLint в .md»)
- Modify: `scripts/check-docs.ts` (`PATH_PREFIXES`)

Interfaces:

- Consumes: тесты из Task 1.
- Produces: default-export парсера `eslint-parsers/plain-text.js`; прод-конфиг с покрытием
  сниппетов не-JS языков.

- [ ] **Step 1: Создать `eslint-parsers/plain-text.js`**

```text
// Snippets in non-JS languages (json, python, bash, text, ...) are checked for the
// unicode policy: the rules read the raw source text, so a minimal empty Program is
// enough and any snippet content stays parseable.
const plainTextParser = {
  meta: { name: "plain-text-parser", version: "1.0.0" },
  parse(text) {
    return {
      type: "Program",
      body: [],
      sourceType: "module",
      comments: [],
      tokens: [],
      range: [0, text.length],
      loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } },
    };
  },
};

export default plainTextParser;
```

- [ ] **Step 2: Добавить импорт в `eslint.config.js`**

Перед строкой `import markdownSnippetsProcessor ...`:

```text
import plainTextParser from "./eslint-parsers/plain-text.js";
```

- [ ] **Step 3: Заменить мёртвый блок (строки 48-64)**

Вместо объекта с `files: ["**/*.md/**"]` (включая старый `languageOptions` с `tsParser`):

```text
{
  // Non-JS fenced snippets: the policy works on raw text, the parser returns an
  // empty Program for any content. The pattern must stay specific: patterns that
  // end in /* or /** are "universal" for ESLint, and code blocks matching only
  // those are silently skipped. JS/TS snippets are excluded here: the block below
  // keeps tsParser and the full rule set for them.
  files: ["**/*.md/*.*"],
  ignores: ["**/*.md/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}", "**/*.md/*.md"],
  languageOptions: { parser: plainTextParser },
  linterOptions: { reportUnusedDisableDirectives: false },
  plugins: { "unicode-policy": unicodePolicy },
  rules: {
    "unicode-policy/emoji": "error",
    "unicode-policy/unicode-graphics": "error",
  },
},
```

- [ ] **Step 4: Обновить абзац в `docs/markdown.md` (строки 26-29)**

```md
ESLint проверяет **только код внутри fenced-блоков**. Юникод-политика
(unicode-policy) действует на сниппеты **любого языка**: `ts`, `json`, `python`,
`bash`, `text` и т.д.; не-JS фенсы читает `eslint-parsers/plain-text.js`.
Остальные правила сниппетов (jsx-a11y, синтаксис TS/JS) — только у js/ts-фенсов.
Прозу линтит markdownlint (длина строк, структура), но эмодзи-политика на
**тексте** `.md` не действует — не полагайтесь на неё для прозы; проверяйте
глазами по чеклисту ниже. Не проверяются фенсы без языка (процессор их не
извлекает) и `markdown`-сниппеты (это проза).
```

- [ ] **Step 5: Добавить `eslint-parsers/` в `PATH_PREFIXES` (`scripts/check-docs.ts`)**

```text
const PATH_PREFIXES = [
  "docs/",
  ".idea/",
  "scripts/",
  ".husky/",
  "eslint-rules/",
  "eslint-processors/",
  "eslint-parsers/",
];
```

- [ ] **Step 6: Прогнать тесты и lint — ожидаем зелёные**

```bash
npm test
npm run lint
npm run lint:md
npm run check:docs
```

Expected: весь прогон `npm test` зелёный (в `tests/markdown-snippets.test.mjs` — 10 тестов);
lint чистый (включая новые файлы и план со спекой); check-docs валидирует
`eslint-parsers/plain-text.js` из docs/markdown.md.

- [ ] **Step 7: Commit**

```bash
git add eslint.config.js eslint-parsers/plain-text.js docs/markdown.md scripts/check-docs.ts
git commit -m "fix(eslint): extend unicode policy to non-JS markdown snippets"
```

### Task 3: Changelog

Files:

- Modify: `CHANGELOG.md` (генерация)

- [ ] **Step 1: Сгенерировать**

```bash
npm run changelog
```

- [ ] **Step 2: Проверить диф**

```bash
git diff --stat
git diff CHANGELOG.md
```

Expected: новая запись `**eslint:** extend unicode policy to non-JS markdown snippets` в
разделе Bug Fixes; изменён только `CHANGELOG.md`.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: update changelog"
```

### Task 4: Полный гейт, WS-инспекция, push, CI

- [ ] **Step 1: Полный локальный гейт**

```bash
npm run lint
npm run lint:css
npm run lint:md
npm run format:check
npm run typecheck
npm test
npm run check:docs
npm run check:file-length
```

Expected: всё зелёное.

- [ ] **Step 2: WS-батч-инспекция (сверка с базой `inspect-v5`)**

```powershell
Remove-Item -Recurse -Force C:\Users\stsgr\AppData\Local\Temp\opencode\ws-inspect-run -ErrorAction SilentlyContinue
$env:WEBIDE_PROPERTIES = "C:\Users\stsgr\AppData\Local\Temp\opencode\ws-inspect.properties"
& "C:\Program Files\JetBrains\WebStorm 2026.2.0.1\bin\webstorm.bat" inspect `
  "C:\Users\stsgr\My Projects\webstorm-config" `
  "C:\Users\stsgr\AppData\Local\Temp\opencode\npm-inspection-profile.xml" `
  "C:\Users\stsgr\AppData\Local\Temp\opencode\ws-inspect-run"
Remove-Item Env:WEBIDE_PROPERTIES
node C:\Users\stsgr\AppData\Local\Temp\opencode\compare-inspections.mjs `
  C:\Users\stsgr\AppData\Local\Temp\opencode\inspect-v5 `
  C:\Users\stsgr\AppData\Local\Temp\opencode\ws-inspect-run
```

Expected: в выводе компаратора нет новых находок относительно `inspect-v5`. Если находки
появились на новых/изменённых файлах — исправить по образцу
`eslint-processors/markdown-snippets.js` (`// noinspection ...`), закоммитить `fix(...)` и
повторить Step 1.

- [ ] **Step 3: Push**

```bash
git push
```

Expected: pre-push зелёный (typecheck + test); все коммиты захода уходят одним push.

- [ ] **Step 4: CI**

```bash
gh run list --limit 3
gh run watch <run-id> --exit-status
```

Expected: success (джобы floor, test, changelog, lint).
