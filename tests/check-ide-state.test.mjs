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
import { findNewestWebStormDir, isNewer, readOptionValue, SCHEME_FILE } from "../scripts/lib/ide-state.ts";

const SCRIPT = fileURLToPath(new URL("../scripts/check-ide-state.ts", import.meta.url));
const REPO = fileURLToPath(new URL("..", import.meta.url));

/** Temp directories created by the current test, removed in afterEach. */
const tempDirs = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

/**
 * New temp JetBrains base directory, auto-removed after the test.
 * @returns {string} base directory path
 */
const newBase = () => {
  const base = mkdtempSync(join(tmpdir(), "check-ide-"));
  tempDirs.push(base);
  return base;
};

/**
 * Run the gate against a fixture JetBrains base directory.
 * @param {string} base - fixture JetBrains base directory
 * @returns {{status: number, stdout: string, stderr: string}} run result
 */
const run = (base) => {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT], {
      encoding: "utf8",
      env: { ...process.env, APPDATA: base },
      cwd: REPO,
    });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return { status: error.status ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
};

/**
 * Canonical reference bytes for a group, straight from the repository.
 * @param {string} group - ide-reference sub-directory
 * @returns {string} file content
 */
const reference = (group) => readFileSync(join(REPO, "ide-reference", group, SCHEME_FILE), "utf8");

/**
 * Create a fixture WebStorm directory with schemes and pointers.
 * The real layout is `%APPDATA%/JetBrains/WebStorm<version>`, and the gate
 * reads APPDATA from the environment.
 * @param {string} base - fixture JetBrains base directory
 * @param {string} version - version suffix, e.g. "2026.3"
 * @returns {string} path to the created WebStorm directory
 */
const makeIdeDir = (base, version) => {
  const dir = join(base, "JetBrains", `WebStorm${version}`);
  for (const group of ["codestyles", "inspection"]) {
    mkdirSync(join(dir, group), { recursive: true });
    writeFileSync(join(dir, group, SCHEME_FILE), reference(group));
  }
  mkdirSync(join(dir, "options"), { recursive: true });
  writeFileSync(
    join(dir, "options", "project.default.xml"),
    '<component name="ProjectCodeStyleConfiguration"><option name="PREFERRED_SCHEME" value="webstorm-config" /></component>',
  );
  writeFileSync(
    join(dir, "codestyles", "codeStyleConfig.xml"),
    '<state><option name="PREFERRED_PROJECT_CODE_STYLE" value="webstorm-config" /></state>',
  );
  return dir;
};

describe("ide-state helpers", () => {
  it("version comparison is numeric, so 2026.10 beats 2026.3", () => {
    assert.ok(isNewer("WebStorm2026.10", "WebStorm2026.3"));
    assert.ok(!isNewer("WebStorm2026.3", "WebStorm2026.10"));
    assert.ok(!isNewer("WebStorm2026.3", "WebStorm2026.3"));
  });

  it("findNewestWebStormDir ignores unrelated directories", () => {
    const base = newBase();
    mkdirSync(join(base, "WebStorm2025.1"), { recursive: true });
    mkdirSync(join(base, "WebStorm2026.3"), { recursive: true });
    mkdirSync(join(base, "IntelliJIdea"), { recursive: true });
    const found = findNewestWebStormDir(base, ["WebStorm2025.1", "WebStorm2026.3", "IntelliJIdea"]);
    assert.ok(found?.endsWith("WebStorm2026.3"), `expected the newest WebStorm directory, got ${found}`);
  });

  it("readOptionValue reads a value and reports a missing option as null", () => {
    assert.equal(readOptionValue('<option name="X" value="v" />', "X"), "v");
    assert.equal(readOptionValue('<option name="X" value="v" />', "Y"), null);
  });
});

describe("check-ide-state", () => {
  it("passes when the machine matches the repository", () => {
    const base = newBase();
    makeIdeDir(base, "2026.3");
    const result = run(base);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[OK\] IDE state matches/);
  });

  it("fails when a global scheme drifts from the reference", () => {
    const base = newBase();
    const dir = makeIdeDir(base, "2026.3");
    writeFileSync(join(dir, "codestyles", SCHEME_FILE), "<stale />");
    const result = run(base);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[FAIL\].*sync:ide/);
  });

  it("fails when a pointer names a scheme that does not exist", () => {
    const base = newBase();
    const dir = makeIdeDir(base, "2026.3");
    writeFileSync(
      join(dir, "codestyles", "codeStyleConfig.xml"),
      '<state><option name="PREFERRED_PROJECT_CODE_STYLE" value="missing-scheme" /></state>',
    );
    const result = run(base);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[FAIL\].*missing-scheme/);
  });

  it("passes on a machine without the IDE and says so", () => {
    const base = newBase();
    const result = run(base);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /No JetBrains directory found/);
  });
});
