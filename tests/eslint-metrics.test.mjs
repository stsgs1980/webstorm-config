// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { ESLint } from "eslint";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const CONFIG = join(REPO, "eslint.metrics.config.js");

/**
 * Lint a virtual source file with the advisory metrics lane.
 * @param {string} code - snippet source
 * @returns {Promise<Array<{ruleId: string | null, severity: number}>>} reported messages
 */
const lintMetrics = async (code) => {
  const eslint = new ESLint({ overrideConfigFile: CONFIG, cwd: REPO, ignore: false });
  const results = await eslint.lintText(code, { filePath: join(REPO, "src/probe.ts") });
  return results.flatMap((result) =>
    result.messages.map((message) => ({ ruleId: message.ruleId, severity: message.severity })),
  );
};

/**
 * Assert that a threshold rule fires as a warning, never as an error: the
 * lane is advisory and `npm run lint:metrics` must not block a merge.
 * @param {Array<{ruleId: string | null, severity: number}>} messages - reported messages
 * @param {string} rule - expected rule id
 * @returns {void}
 */
const assertWarning = (messages, rule) => {
  const hit = messages.find((message) => message.ruleId === rule);
  assert.ok(hit, `expected ${rule}, got: ${messages.map((message) => message.ruleId).join(", ")}`);
  assert.equal(hit.severity, 1, `${rule} must stay a warning`);
  assert.ok(
    messages.every((message) => message.severity === 1),
    `metrics lane must not raise errors: ${JSON.stringify(messages)}`,
  );
};

describe("eslint-metrics advisory thresholds", () => {
  it("сложность выше 15 - warning complexity", { timeout: 120000 }, async () => {
    const branches = Array.from({ length: 16 }, (_, index) => `  if (value === ${index}) return ${index};`).join("\n");
    const messages = await lintMetrics(
      `export function probe(value: number): number {\n${branches}\n  return -1;\n}\n`,
    );
    assertWarning(messages, "complexity");
  });

  it("функция длиннее 60 строк - warning max-lines-per-function", { timeout: 120000 }, async () => {
    const statements = Array.from({ length: 65 }, (_, index) => `  const v${index} = ${index};`).join("\n");
    const messages = await lintMetrics(`export function probe(): number {\n${statements}\n  return v64;\n}\n`);
    assertWarning(messages, "max-lines-per-function");
  });

  it("пять параметров - warning max-params", { timeout: 120000 }, async () => {
    const messages = await lintMetrics(
      "export function probe(a: number, b: number, c: number, d: number, e: number): number {\n" +
        "  return a + b + c + d + e;\n}\n",
    );
    assertWarning(messages, "max-params");
  });

  it("вложенность пять уровней - warning max-depth", { timeout: 120000 }, async () => {
    const messages = await lintMetrics(
      "export function probe(flag: boolean): number {\n" +
        "  if (flag) {\n    if (flag) {\n      if (flag) {\n        if (flag) {\n          if (flag) {\n" +
        "            return 1;\n          }\n        }\n      }\n    }\n  }\n  return 0;\n}\n",
    );
    assertWarning(messages, "max-depth");
  });
});
