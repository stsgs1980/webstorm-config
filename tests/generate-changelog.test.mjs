// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("../scripts/generate-changelog.ts", import.meta.url));
const OLD_CHANGELOG = "# Changelog\n\n- Old entry\n";
const DRAFT = "CHANGELOG.md.tmp";

/**
 * Create a throwaway git repository with an existing changelog.
 * @returns {string} repository path
 */
const makeRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), "wsc-changelog-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  writeFileSync(join(dir, "CHANGELOG.md"), OLD_CHANGELOG);
  execFileSync("git", ["add", "-A"], { cwd: dir });
  return dir;
};

/**
 * Create a directory whose npx always fails, to simulate generator crashes.
 * @returns {string} shim directory path
 */
const makeFailingNpx = () => {
  const dir = mkdtempSync(join(tmpdir(), "wsc-npx-shim-"));
  if (process.platform === "win32") {
    writeFileSync(join(dir, "npx.cmd"), "@exit /b 1\r\n");
  } else {
    writeFileSync(join(dir, "npx"), "#!/bin/sh\nexit 1\n");
    chmodSync(join(dir, "npx"), 0o755);
  }
  return dir;
};

/**
 * Run the changelog script with the failing npx first on PATH.
 * @param {string} repo - working directory
 * @param {string} shim - failing npx directory
 * @returns {{ status: number, stderr: string }} run result
 */
const runWithFailingNpx = (repo, shim) => {
  const env = { ...process.env };
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH";
  env[pathKey] = `${shim}${delimiter}${env[pathKey]}`;
  try {
    execFileSync(process.execPath, [SCRIPT], { cwd: repo, env, encoding: "utf8" });
    return { status: 0, stderr: "" };
  } catch (error) {
    return { status: error.status ?? 1, stderr: error.stderr ?? "" };
  }
};

describe("generate-changelog", () => {
  it("при падении генератора не трогает CHANGELOG.md и убирает черновик", () => {
    const repo = makeRepo();
    const shim = makeFailingNpx();
    try {
      const result = runWithFailingNpx(repo, shim);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /left untouched/);
      assert.equal(readFileSync(join(repo, "CHANGELOG.md"), "utf8"), OLD_CHANGELOG);
      assert.equal(existsSync(join(repo, DRAFT)), false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(shim, { recursive: true, force: true });
    }
  });
});
