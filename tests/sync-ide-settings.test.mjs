// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { afterEach, describe, it } from "vitest";
import { EDITOR_POINTER, PHANTOM_FILE, SCHEME_FILE, SCHEME_NAME } from "../scripts/lib/ide-state.ts";

const SCRIPT = fileURLToPath(new URL("../scripts/sync-ide-settings.ts", import.meta.url));
const REPO = fileURLToPath(new URL("..", import.meta.url));
const GROUPS = ["codestyles", "inspection"];

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
 * Canonical reference bytes for a group, from the generated repository reference.
 * @param {string} group - generated/ide-reference sub-directory (codestyles, inspection)
 * @returns {Buffer}
 */
const referenceBytes = (group) => readFileSync(join(REPO, "generated", "ide-reference", group, SCHEME_FILE));

/**
 * Correct content of `options/project.default.xml` pointer values.
 * @returns {string}
 */
const correctProjectOptions = () =>
  `<application>\n  <component name="ProjectManager">\n    <defaultProject>\n` +
  `      <component name="InspectionProjectProfileManager">\n` +
  `        <option name="PROJECT_PROFILE" value="${SCHEME_NAME}" />\n` +
  `        <option name="USE_PROJECT_PROFILE" value="false" />\n` +
  `        <version value="1.0" />\n` +
  `      </component>\n` +
  `      <component name="ProjectCodeStyleConfiguration">\n` +
  `        <option name="PREFERRED_SCHEME" value="${SCHEME_NAME}" />\n` +
  `      </component>\n    </defaultProject>\n  </component>\n</application>\n`;

/**
 * Correct content of `options/editor.xml` pointer attribute.
 * @returns {string}
 */
const correctEditor = () =>
  `<application>\n  <component name="${EDITOR_POINTER.component}" ${EDITOR_POINTER.attribute}="${SCHEME_NAME}" />\n</application>\n`;

/**
 * Create a fixture WebStorm directory with per-group payload contents and
 * correct pointers.
 * @param {string} base - fixture JetBrains base directory
 * @param {string} version - version suffix, e.g. "2026.3"
 * @param {(group: string) => string | Buffer} contentFor - content per group
 * @returns {string} path to the created WebStorm directory
 */
const makeIdeDir = (base, version, contentFor) => {
  const dir = join(base, `WebStorm${version}`);
  for (const group of GROUPS) {
    mkdirSync(join(dir, group), { recursive: true });
    writeFileSync(join(dir, group, SCHEME_FILE), contentFor(group));
  }
  mkdirSync(join(dir, "options"), { recursive: true });
  writeFileSync(join(dir, "options", "project.default.xml"), correctProjectOptions());
  writeFileSync(join(dir, "options", "editor.xml"), correctEditor());
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
  it("check mode passes when the IDE files and pointers match the references", () => {
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
      const target = join(base, "WebStorm2026.3", group, SCHEME_FILE);
      assert.deepEqual(readFileSync(target), referenceBytes(group));
    }
    assert.match(result.stdout, /\[OK\] restored/);
  });

  it("apply mode creates missing group directories and option files", () => {
    const base = newBase();
    mkdirSync(join(base, "WebStorm2026.3"), { recursive: true });
    const result = run(["--jetbrains-root", base]);
    assert.equal(result.status, 0);
    for (const group of GROUPS) {
      const target = join(base, "WebStorm2026.3", group, SCHEME_FILE);
      assert.deepEqual(readFileSync(target), referenceBytes(group));
    }
    const dir = join(base, "WebStorm2026.3");
    assert.equal(readFileSync(join(dir, "options", "project.default.xml"), "utf8"), correctProjectOptions());
    assert.equal(readFileSync(join(dir, "options", "editor.xml"), "utf8"), correctEditor());
  });

  it("apply mode repairs drifted pointers and deletes the phantom file", () => {
    const base = newBase();
    const dir = makeIdeDir(base, "2026.3", (group) => referenceBytes(group));
    writeFileSync(
      join(dir, "options", "project.default.xml"),
      correctProjectOptions().replaceAll(`value="${SCHEME_NAME}"`, 'value="Default"'),
    );
    writeFileSync(join(dir, "options", "editor.xml"), correctEditor().replaceAll(`="${SCHEME_NAME}"`, '="Default"'));
    writeFileSync(join(dir, "codestyles", "codeStyleConfig.xml"), "<state />");
    const result = run(["--jetbrains-root", base]);
    assert.equal(result.status, 0);
    assert.equal(readFileSync(join(dir, "options", "project.default.xml"), "utf8"), correctProjectOptions());
    assert.equal(readFileSync(join(dir, "options", "editor.xml"), "utf8"), correctEditor());
    assert.equal(existsSync(join(dir, PHANTOM_FILE)), false);
  });

  it("check mode reports pointer drift without writing", () => {
    const base = newBase();
    const dir = makeIdeDir(base, "2026.3", (group) => referenceBytes(group));
    const driftedEditor = correctEditor().replaceAll(`="${SCHEME_NAME}"`, '="Default"');
    writeFileSync(join(dir, "options", "editor.xml"), driftedEditor);
    const result = run(["--check", "--jetbrains-root", base]);
    assert.equal(result.status, 1);
    assert.equal(readFileSync(join(dir, "options", "editor.xml"), "utf8"), driftedEditor);
    assert.match(result.stdout, /\[FAIL\].*pointer/);
  });

  it("targets the newest WebStorm directory, comparing versions numerically", () => {
    const base = newBase();
    const old = makeIdeDir(base, "2025.1", () => stale);
    const middle = makeIdeDir(base, "2026.3", () => stale);
    makeIdeDir(base, "2026.10", () => stale);
    const result = run(["--jetbrains-root", base]);
    assert.equal(result.status, 0);
    for (const group of GROUPS) {
      assert.deepEqual(readFileSync(join(base, "WebStorm2026.10", group, SCHEME_FILE)), referenceBytes(group));
      assert.equal(readFileSync(join(old, group, SCHEME_FILE), "utf8"), stale);
      assert.equal(readFileSync(join(middle, group, SCHEME_FILE), "utf8"), stale);
    }
  });

  it("fails when the base directory has no WebStorm directory", () => {
    const base = newBase();
    const result = run(["--jetbrains-root", base]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[FAIL\].*no WebStorm/);
  });
});
