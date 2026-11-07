// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("../scripts/check-test-files.ts", import.meta.url));

/**
 * Run the guard against a fixture root.
 * @param {string} root - fixture directory
 * @returns {{status: number, stdout: string, stderr: string}}
 */
const run = (root) => {
  try {
    // noinspection JSUnresolvedVariable
    const stdout = execFileSync(process.execPath, [SCRIPT, root], { encoding: "utf8" });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: String(error.stdout ?? ""),
      stderr: String(error.stderr ?? error.message ?? ""),
    };
  }
};

describe("check-test-files", () => {
  it("пустой проект падает с подсказкой, а не generic-ошибкой Vitest", () => {
    const root = mkdtempSync(join(tmpdir(), "wsc-empty-"));
    try {
      const result = run(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /No test files found/);
      assert.match(result.stderr, /src\/app\.test\.ts/);
      assert.match(result.stderr, /passWithNoTests is intentionally off/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("тест в src проходит проверку", () => {
    const root = mkdtempSync(join(tmpdir(), "wsc-src-"));
    try {
      mkdirSync(join(root, "src"));
      writeFileSync(join(root, "src", "app.test.ts"), "export {};\n");
      const result = run(root);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /test files: 1/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("тест в tests проходит проверку", () => {
    const root = mkdtempSync(join(tmpdir(), "wsc-tests-"));
    try {
      mkdirSync(join(root, "tests"));
      writeFileSync(join(root, "tests", "tool.test.mjs"), "export {};\n");
      const result = run(root);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /test files: 1/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("тест в scripts проходит проверку", () => {
    const root = mkdtempSync(join(tmpdir(), "wsc-scripts-"));
    try {
      mkdirSync(join(root, "scripts"));
      writeFileSync(join(root, "scripts", "check.test.ts"), "export {};\n");
      const result = run(root);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /test files: 1/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
