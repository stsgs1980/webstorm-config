// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { ESLint } from "eslint";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const CONFIG = join(REPO, "eslint.config.js");

/**
 * Lint virtual code at a virtual path: flat config `files` patterns select
 * the scope by that path, so no real fixture files are needed.
 * @param {string} code - snippet source
 * @param {string} filePath - repo-relative virtual path
 * @returns {Promise<string[]>} rule ids reported for the snippet
 */
const reportRules = async (code, filePath) => {
  const eslint = new ESLint({
    overrideConfigFile: CONFIG,
    cwd: REPO,
    ignore: false,
  });
  const results = await eslint.lintText(code, { filePath: join(REPO, filePath) });
  return results.flatMap((result) => result.messages.map((message) => message.ruleId ?? "parse-error"));
};

describe("eslint-config no-console scopes", () => {
  it("console.log в прикладном коде - ошибка no-console", async () => {
    const rules = await reportRules('console.log("debug leftover");\n', "src/app.mjs");
    assert.ok(rules.includes("no-console"), `expected no-console, got: ${rules.join(", ")}`);
  });

  it("console.log в скриптах - разрешён (логирование - инструмент)", async () => {
    const rules = await reportRules('console.log("progress");\n', "scripts/tool.mjs");
    assert.ok(!rules.includes("no-console"), `unexpected no-console, got: ${rules.join(", ")}`);
  });

  it("console.log на сервере - разрешён", async () => {
    const rules = await reportRules('console.log("request handled");\n', "server/log.mjs");
    assert.ok(!rules.includes("no-console"), `unexpected no-console, got: ${rules.join(", ")}`);
  });

  it("console.warn в прикладном коде остаётся разрешённым", async () => {
    const rules = await reportRules('console.warn("deprecation");\n', "src/app.mjs");
    assert.ok(!rules.includes("no-console"), `unexpected no-console, got: ${rules.join(", ")}`);
  });
});
