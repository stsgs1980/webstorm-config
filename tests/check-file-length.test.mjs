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

const SCRIPT = fileURLToPath(new URL("../scripts/check-file-length.ts", import.meta.url));
const LONG_FILE = Array.from({ length: 260 }, (_, index) => `export const x${index} = ${index};`).join("\n");
const SHORT_FILE = "export const ok = true;\n";

/**
 * Create a throwaway git repository with one staged file.
 * @param {string} name - file name; non-ASCII names are the point of the fixture
 * @param {string} content - file content
 * @returns {string} repository path
 */
const makeRepo = (name, content) => {
  const dir = mkdtempSync(join(tmpdir(), "wsc-file-length-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  writeFileSync(join(dir, name), content);
  execFileSync("git", ["add", "-A"], { cwd: dir });
  return dir;
};

/**
 * Run the anti-monolith script inside a repository.
 * @param {string} dir - working directory
 * @param {string[]} args - script arguments
 * @returns {{ status: number, stdout: string, stderr: string }} run result
 */
const run = (dir, args) => {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, ...args], { cwd: dir, encoding: "utf8" });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return { status: error.status ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
};

/**
 * Run a fixture and clean it up afterwards.
 * @param {string} name - file name
 * @param {string} content - file content
 * @param {string[]} args - script arguments
 * @returns {{ status: number, stdout: string, stderr: string }} run result
 */
const runFixture = (name, content, args) => {
  const dir = makeRepo(name, content);
  try {
    return run(dir, args);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe("check-file-length", () => {
  it("кириллическое имя файла не теряется в git ls-files (-z)", () => {
    const result = runFixture("Файл.ts", LONG_FILE, ["--all"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[FAIL\] File 'Файл\.ts' has 260 lines\./);
  });

  it("кириллическое имя файла не теряется в git diff --cached (-z)", () => {
    const result = runFixture("Файл.ts", SHORT_FILE, []);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /\[OK\] Checked files: 1/);
  });

  it("длинный ASCII-файл по-прежнему отклоняется", () => {
    const result = runFixture("long.ts", LONG_FILE, ["--all"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[FAIL\] File 'long\.ts' has 260 lines\./);
  });
});
