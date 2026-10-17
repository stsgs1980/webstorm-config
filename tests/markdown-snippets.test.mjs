// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import { ESLint } from "eslint";
import assert from "node:assert/strict";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";

import prodConfig from "../eslint.config.js";

/**
 * @typedef {object} LintMessageInfo
 * @property {string | null} ruleId
 * @property {number} line
 * @property {number} column
 * @property {string} message
 * @property {string} [messageId]
 * @property {boolean} [fatal]
 */

/**
 * @param {string} text
 * @returns {Promise<LintMessageInfo[]>}
 */
const lintMarkdownAll = async (text) => {
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: prodConfig });
  const results = await eslint.lintText(text, { filePath: "docs/fixture.md" });

  return results.flatMap((result) => result.messages);
};

const lintMarkdown = async (text) =>
  (await lintMarkdownAll(text)).filter((message) => message.ruleId?.startsWith("unicode-policy"));

describe("markdown-snippets", () => {
  it("эмодзи в fenced-блоке ловится с координатой в файле .md", async () => {
    const messages = await lintMarkdown("# Demo\n\n```ts\nconst s = '⏰';\n```\n");

    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, "unicode-policy/emoji");
    assert.equal(messages[0].line, 4);
    assert.equal(messages[0].column, 12);
  });

  it("псевдографика в fenced-блоке ловится", async () => {
    const messages = await lintMarkdown("# Demo\n\n```ts\nconst bar = '─';\n```\n");

    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, "unicode-policy/unicode-graphics");
    assert.equal(messages[0].line, 4);
    assert.equal(messages[0].column, 14);
  });

  it("эмодзи в прозе не трогается", async () => {
    const messages = await lintMarkdown("Прозу с ⏰ юникод-политика не проверяет.\n");

    assert.equal(messages.length, 0);
  });

  it("эмодзи в json-сниппете ловится", async () => {
    const messages = await lintMarkdown('# Demo\n\n```json\n{"status": "Готово \u{1F600}"}\n```\n');

    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, "unicode-policy/emoji");
    assert.equal(messages[0].messageId, "noEmoji");
    assert.equal(messages[0].line, 4);
    assert.equal(messages[0].column, 20);
  });

  it("эмодзи в python-сниппете ловится (расширение .python)", async () => {
    const messages = await lintMarkdown('# Demo\n\n```python\nprint("Ещё раз \u{1F525}")\n```\n');

    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, "unicode-policy/emoji");
    assert.equal(messages[0].line, 4);
    assert.equal(messages[0].column, 16);
    assert.ok(messages[0].message.includes("U+1F525"));
  });

  it("псевдографика в bash-сниппете ловится по всем вхождениям", async () => {
    const messages = await lintMarkdown('# Demo\n\n```bash\nprintf "\u{2588}\u{2588}\u{2588}"\n```\n');

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

  it("неиспользованная директива в js-сниппете не репортится", async () => {
    const messages = await lintMarkdownAll(
      "# Demo\n\n```js\n// eslint-disable-next-line no-console\nconst value = 1;\nexport default value;\n```\n",
    );

    assert.equal(messages.length, 0);
  });

  it("markdown- и plain-фенсы не проверяются", async () => {
    const messages = await lintMarkdown(
      "# Demo\n\n```markdown\n# заголовок \u{1F600}\n```\n\n```\nпросто \u{1F600}\n```\n",
    );

    assert.equal(messages.length, 0);
  });

  it("чистые не-JS сниппеты не дают сообщений", async () => {
    const messages = await lintMarkdown('# Demo\n\n```json\n{"ok": true}\n```\n\n```py\nx = 1\n```\n');

    assert.equal(messages.length, 0);
  });
});
