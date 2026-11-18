// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { lint } from "markdownlint/sync";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const CONFIG = JSON.parse(readFileSync(join(REPO, ".markdownlint.json"), "utf8"));

/**
 * Lint a virtual Markdown document with the repository config.
 * @param {string} content - document
 * @returns {string[]} rule names reported
 */
const rulesFor = (content) => {
  const results = lint({ strings: { fixture: content }, config: CONFIG });
  return (results.fixture ?? []).flatMap((error) => error.ruleNames);
};

describe("markdownlint config", () => {
  it("строка длиннее 120 символов - MD013", () => {
    const words = Array.from({ length: 40 }, (_, index) => `word${index}`).join(" ");
    const rules = rulesFor(`# T\n\n${words}\n`);
    assert.ok(rules.includes("MD013"), `expected MD013, got: ${rules.join(", ")}`);
  });

  it("fenced-блок без языка - MD040", () => {
    const rules = rulesFor("# T\n\n```\ncode\n```\n");
    assert.ok(rules.includes("MD040"), `expected MD040, got: ${rules.join(", ")}`);
  });

  it("таблица с несовпадающими колонками - MD060", () => {
    const rules = rulesFor("# T\n\n| a | b |\n| - | - |\n| longer cell | x |\n");
    assert.ok(rules.includes("MD060"), `expected MD060, got: ${rules.join(", ")}`);
  });

  it("аккуратный документ не даёт MD013/MD040/MD060", () => {
    const doc =
      "# T\n\n| a           | b   |\n| ----------- | --- |\n| longer cell | x   |\n\n```ts\nconst value = 1;\n```\n";
    const rules = rulesFor(doc).filter((rule) => rule === "MD013" || rule === "MD040" || rule === "MD060");
    assert.deepEqual(rules, []);
  });
});
