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
 */

const lintMarkdown = async (text) => {
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: prodConfig });
  const results = await eslint.lintText(text, { filePath: "docs/fixture.md" });
  /** @type {LintMessageInfo[]} */
  const messages = results.flatMap((result) => result.messages);

  return messages.filter((message) => message.ruleId?.startsWith("unicode-policy"));
};

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
});
