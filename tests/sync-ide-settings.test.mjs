// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { afterEach, describe, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("../scripts/sync-ide-settings.ts", import.meta.url));
const REPO = fileURLToPath(new URL("..", import.meta.url));
const GROUPS = ["codestyles", "inspection"];
const FILE_NAME = "webstorm-config.xml";

/** Temp directories created by the current test, removed in afterEach. */
const tempDirs = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

/**
 * Run the sync script against a fixture JetBrains base directory.
 * @param {string[]} args - extra CLI arguments
 * @returns {{status: number, stdout: string, stderr: string}}
 */
const run = (args) => {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return { status: error.status ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
};

/**
 * Canonical reference bytes for a group, straight from the repository.
 * @param {string} group - ide-reference sub-directory (codestyles, inspection)
 * @returns {Buffer}
 */
const referenceBytes = (group) => readFileSync(join(REPO, "ide-reference", group, FILE_NAME));

/**
 * Create a fixture WebStorm directory with per-group file contents.
 * @param {string} base - fixture JetBrains base directory
 * @param {string} version - version suffix, e.g. "2026.3"
 * @param {(group: string) => string | Buffer} contentFor - content per group
 * @returns {string} path to the created WebStorm directory
 */
const makeIdeDir = (base, version, contentFor) => {
  const dir = join(base, `WebStorm${version}`);
  for (const group of GROUPS) {
    mkdirSync(join(dir, group), { recursive: true });
    writeFileSync(join(dir, group, FILE_NAME), contentFor(group));
  }
  return dir;
};

/**
 * New temp JetBrains base directory, auto-removed after the test.
 * @returns {string}
 */
const newBase = () => {
  const base = mkdtempSync(join(tmpdir(), "sync-ide-"));
  tempDirs.push(base);
  return base;
};

const stale = "<stale />";

describe("sync-ide-settings", () => {
  it("check mode passes when the IDE files match the references", () => {
    const base = newBase();
    makeIdeDir(base, "2026.3", (group) => referenceBytes(group));
    const result = run(["--check", "--jetbrains-root", base]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /\[OK\].*codestyles/);
    assert.match(result.stdout, /\[OK\].*inspection/);
  });

  it("check mode fails on stale files and names the restore command", () => {
    const base = newBase();
    makeIdeDir(base, "2026.3", () => stale);
    const result = run(["--check", "--jetbrains-root", base]);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /\[FAIL\].*npm run sync:ide/);
  });

  it("apply mode restores overwritten files byte for byte", () => {
    const base = newBase();
    makeIdeDir(base, "2026.3", () => stale);
    const result = run(["--jetbrains-root", base]);
    assert.equal(result.status, 0);
    for (const group of GROUPS) {
      const target = join(base, "WebStorm2026.3", group, FILE_NAME);
      assert.deepEqual(readFileSync(target), referenceBytes(group));
    }
    assert.match(result.stdout, /\[OK\] restored/);
  });

  it("apply mode creates missing group directories", () => {
    const base = newBase();
    mkdirSync(join(base, "WebStorm2026.3"), { recursive: true });
    const result = run(["--jetbrains-root", base]);
    assert.equal(result.status, 0);
    for (const group of GROUPS) {
      const target = join(base, "WebStorm2026.3", group, FILE_NAME);
      assert.deepEqual(readFileSync(target), referenceBytes(group));
    }
  });

  it("targets the newest WebStorm directory, comparing versions numerically", () => {
    const base = newBase();
    const old = makeIdeDir(base, "2025.1", () => stale);
    const middle = makeIdeDir(base, "2026.3", () => stale);
    makeIdeDir(base, "2026.10", () => stale);
    const result = run(["--jetbrains-root", base]);
    assert.equal(result.status, 0);
    for (const group of GROUPS) {
      assert.deepEqual(readFileSync(join(base, "WebStorm2026.10", group, FILE_NAME)), referenceBytes(group));
      assert.equal(readFileSync(join(old, group, FILE_NAME), "utf8"), stale);
      assert.equal(readFileSync(join(middle, group, FILE_NAME), "utf8"), stale);
    }
  });

  it("fails when the base directory has no WebStorm directory", () => {
    const base = newBase();
    const result = run(["--jetbrains-root", base]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[FAIL\].*no WebStorm/);
  });
});
