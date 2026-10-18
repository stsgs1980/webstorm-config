// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("../scripts/check-docs.ts", import.meta.url));
const BADGE = "![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.22.2-green)\n";
const PKG = JSON.stringify({ name: "fixture", scripts: {}, engines: { node: ">=22.22.2" } });
const PKG_NO_ENGINES = JSON.stringify({ name: "fixture", scripts: {} });

/**
 * Run check-docs inside a throwaway project (no docs/ directory on purpose).
 * @param {string} pkg - package.json content
 * @param {string} nvm - .nvmrc content; an empty string omits the file
 * @returns {{ status: number, stdout: string, stderr: string }} run result
 */
const runFixture = (pkg, nvm) => {
  const dir = mkdtempSync(join(tmpdir(), "wsc-check-docs-"));
  writeFileSync(join(dir, "package.json"), pkg);
  writeFileSync(join(dir, "README.md"), `# Fixture\n\n${BADGE}`);
  if (nvm !== "") {
    writeFileSync(join(dir, ".nvmrc"), nvm);
  }
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT], { cwd: dir, encoding: "utf8" });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return { status: error.status ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe("check-docs", () => {
  it("без .nvmrc и docs/ отвечает [FAIL], а не падает с ENOENT", () => {
    const result = runFixture(PKG, "");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[FAIL\] \.nvmrc not found\./);
    assert.doesNotMatch(result.stderr, /ENOENT/);
  });

  it("без engines.node отвечает [FAIL], а не падает с TypeError", () => {
    const result = runFixture(PKG_NO_ENGINES, "22.22.2");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[FAIL\] engines\.node is not set in package\.json\./);
    assert.doesNotMatch(result.stderr, /TypeError/);
  });

  it("согласованные .nvmrc и engines.node дают [OK]", () => {
    const result = runFixture(PKG, "22.22.2");
    assert.equal(result.status, 0);
    assert.match(result.stdout, /\[OK\] check-docs: 1 docs files consistent with configs\./);
  });
});
