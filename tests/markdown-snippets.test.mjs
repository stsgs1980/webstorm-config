// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import { ESLint } from "eslint";
// noinspection NpmUsedModulesInstalled
import { describe } from "vitest";

import prodConfig from "../eslint.config.js";

const lintMarkdown = async (text) => {
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: prodConfig });
  const results = await eslint.lintText(text, { filePath: "docs/fixture.md" });

  return results.flatMap((result) => result.messages).filter((message) => message.ruleId?.startsWith("unicode-policy"));
};

describe("markdown-snippets", () => {
  it("эмодзи в fenced-блоке ловится с координатой в файле .md", async () => {
    const messages = await lintMarkdown("# Demo\n\n```ts\nconst s = '⏰';\n```\n");

    expect(messages).toHaveLength(1);
    expect(messages[0].ruleId).toBe("unicode-policy/emoji");
    expect(messages[0].line).toBe(4);
    expect(messages[0].column).toBe(12);
  });

  it("псевдографика в fenced-блоке ловится", async () => {
    const messages = await lintMarkdown("# Demo\n\n```ts\nconst bar = '─';\n```\n");

    expect(messages).toHaveLength(1);
    expect(messages[0].ruleId).toBe("unicode-policy/unicode-graphics");
    expect(messages[0].line).toBe(4);
    expect(messages[0].column).toBe(14);
  });

  it("эмодзи в прозе не трогается", async () => {
    const messages = await lintMarkdown("Прозу с ⏰ юникод-политика не проверяет.\n");

    expect(messages).toHaveLength(0);
  });
});
