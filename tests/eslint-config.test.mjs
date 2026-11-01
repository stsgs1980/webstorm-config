// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
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
  it("console.log в прикладном коде - ошибка no-console", { timeout: 120000 }, async () => {
    const rules = await reportRules('console.log("debug leftover");\n', "src/app.mjs");
    assert.ok(rules.includes("no-console"), `expected no-console, got: ${rules.join(", ")}`);
  });

  it("console.log в скриптах - разрешён (логирование - инструмент)", { timeout: 120000 }, async () => {
    const rules = await reportRules('console.log("progress");\n', "scripts/tool.mjs");
    assert.ok(!rules.includes("no-console"), `unexpected no-console, got: ${rules.join(", ")}`);
  });

  it("console.log на сервере - разрешён", { timeout: 120000 }, async () => {
    const rules = await reportRules('console.log("request handled");\n', "server/log.mjs");
    assert.ok(!rules.includes("no-console"), `unexpected no-console, got: ${rules.join(", ")}`);
  });

  it("console.warn в прикладном коде остаётся разрешённым", { timeout: 120000 }, async () => {
    const rules = await reportRules('console.warn("deprecation");\n', "src/app.mjs");
    assert.ok(!rules.includes("no-console"), `unexpected no-console, got: ${rules.join(", ")}`);
  });
});

describe("eslint-config type-aware promises", () => {
  /**
   * Lint a real .ts fixture: the type service resolves the file on disk
   * through tsconfig, so a virtual path cannot exercise type-aware rules.
   * @param {string} code - fixture source
   * @param {string} name - fixture file name
   * @returns {Promise<string[]>} rule ids reported for the fixture
   */
  const lintFixture = async (code, name) => {
    // No dot segments in the path: TypeScript include globs do not enter
    // dotted directories, and the type service must find the fixture in
    // the tsconfig project (include "**/*.ts").
    const dir = join(REPO, "dev", "eslint-fixtures");
    const path = join(dir, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, code);
    try {
      const eslint = new ESLint({ overrideConfigFile: CONFIG, cwd: REPO, ignore: false });
      const results = await eslint.lintFiles([path]);
      return results.flatMap((result) => result.messages.map((message) => message.ruleId ?? "parse-error"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it("промис без await или void - ошибка no-floating-promises", { timeout: 120000 }, async () => {
    const floating =
      "const work = async (): Promise<void> => {};\n" +
      "const run = (): void => {\n" +
      "  work();\n" +
      "};\n" +
      "run();\n";
    const rules = await lintFixture(floating, "floating.ts");
    assert.ok(
      rules.includes("@typescript-eslint/no-floating-promises"),
      `expected no-floating-promises, got: ${rules.join(", ")}`,
    );
  });

  it("промис в условии if - ошибка no-misused-promises", { timeout: 120000 }, async () => {
    const misused =
      "const pred = async (): Promise<boolean> => true;\n" +
      "const shouldRenew = (): boolean => {\n" +
      "  if (pred()) {\n" +
      "    return true;\n" +
      "  }\n" +
      "  return false;\n" +
      "};\n" +
      "void shouldRenew();\n";
    const rules = await lintFixture(misused, "misused.ts");
    assert.ok(
      rules.includes("@typescript-eslint/no-misused-promises"),
      `expected no-misused-promises, got: ${rules.join(", ")}`,
    );
  });

  it("корректный await с void-вызовом сверху не ловится ложным срабатыванием", { timeout: 120000 }, async () => {
    const clean =
      "const work = async (): Promise<void> => {};\n" +
      "const run = async (): Promise<void> => {\n" +
      "  await work();\n" +
      "};\n" +
      "void run();\n";
    const rules = await lintFixture(clean, "clean.ts");
    assert.deepEqual(rules, []);
  });
});
