// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { afterEach, describe, it } from "vitest";
import { BUILDERS, IDEA_SOURCES } from "../scripts/lib/ide-reference.ts";
import {
  EDITOR_POINTER,
  findNewestWebStormDir,
  isNewer,
  readComponentAttribute,
  readOptionValue,
  SCHEME_FILE,
  SCHEME_NAME,
} from "../scripts/lib/ide-state.ts";

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
 * @param {string} [root] - repository root override, defaults to this repo
 * @returns {{status: number, stdout: string, stderr: string}} run result
 */
const run = (base, root) => {
  try {
    const args = root === undefined ? [SCRIPT] : [SCRIPT, root];
    const stdout = execFileSync(process.execPath, args, {
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
 * Canonical reference bytes for a group, from the generated repository reference.
 * @param {string} group - generated/ide-reference sub-directory
 * @returns {string} file content
 */
const reference = (group) => readFileSync(join(REPO, "generated", "ide-reference", group, SCHEME_FILE), "utf8");

/**
 * Create a fixture WebStorm directory with schemes and correct pointers.
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
    `<application>\n  <component name="ProjectManager">\n    <defaultProject>\n` +
      `      <component name="InspectionProjectProfileManager">\n` +
      `        <option name="PROJECT_PROFILE" value="${SCHEME_NAME}" />\n` +
      `        <option name="USE_PROJECT_PROFILE" value="false" />\n` +
      `      </component>\n` +
      `      <component name="ProjectCodeStyleConfiguration">\n` +
      `        <option name="PREFERRED_SCHEME" value="${SCHEME_NAME}" />\n` +
      `      </component>\n    </defaultProject>\n  </component>\n</application>\n`,
  );
  writeFileSync(
    join(dir, "options", "editor.xml"),
    `<application>\n  <component name="${EDITOR_POINTER.component}" ${EDITOR_POINTER.attribute}="${SCHEME_NAME}" />\n</application>\n`,
  );
  return dir;
};

/**
 * New fixture repository with `.idea/` sources copied from this repo and a
 * generated reference built by the real builder, optionally stale.
 * @param {boolean} stale - write a stale generated reference
 * @returns {string} fixture repository root
 */
const newFixtureRepo = (stale) => {
  const repo = mkdtempSync(join(tmpdir(), "check-ide-repo-"));
  tempDirs.push(repo);
  for (const group of Object.keys(IDEA_SOURCES)) {
    const sourcePath = join(repo, IDEA_SOURCES[group]);
    mkdirSync(dirname(sourcePath), { recursive: true });
    const source = readFileSync(join(REPO, IDEA_SOURCES[group]), "utf8");
    writeFileSync(sourcePath, source);
    mkdirSync(join(repo, "generated", "ide-reference", group), { recursive: true });
    const built = BUILDERS[group](source);
    writeFileSync(
      join(repo, "generated", "ide-reference", group, SCHEME_FILE),
      stale ? `${built}<!-- stale -->\n` : built,
    );
  }
  return repo;
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

  it("readOptionValue reads options, readComponentAttribute reads component attributes", () => {
    assert.equal(readOptionValue('<option name="X" value="v" />', "X"), "v");
    assert.equal(readOptionValue('<option name="X" value="v" />', "Y"), null);
    assert.equal(readComponentAttribute('<component name="Daemon" profile="p" />', "Daemon", "profile"), "p");
    assert.equal(readComponentAttribute('<component name="Daemon" />', "Daemon", "profile"), null);
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

  it("fails when a pointer selects another existing scheme by name", () => {
    const base = newBase();
    const dir = makeIdeDir(base, "2026.3");
    writeFileSync(join(dir, "codestyles", "Default.xml"), '<code_scheme name="Default" version="173" />');
    const drifted = readFileSync(join(dir, "options", "project.default.xml"), "utf8").replaceAll(
      `value="${SCHEME_NAME}"`,
      'value="Default"',
    );
    writeFileSync(join(dir, "options", "project.default.xml"), drifted);
    const result = run(base);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /is "Default", expected/);
  });

  it("fails when editor.xml selects another inspection profile", () => {
    const base = newBase();
    const dir = makeIdeDir(base, "2026.3");
    writeFileSync(
      join(dir, "options", "editor.xml"),
      `<application>\n  <component name="${EDITOR_POINTER.component}" ${EDITOR_POINTER.attribute}="Default" />\n</application>\n`,
    );
    const result = run(base);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[FAIL\].*editor\.xml/);
  });

  it("fails when the phantom pointer file is present", () => {
    const base = newBase();
    const dir = makeIdeDir(base, "2026.3");
    writeFileSync(join(dir, "codestyles", "codeStyleConfig.xml"), "<state />");
    const result = run(base);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[FAIL\].*phantom/);
  });

  it("fails when the generated reference is stale against .idea", () => {
    const base = newBase();
    const repo = newFixtureRepo(true);
    const result = run(base, repo);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /stale against \.idea\//);
  });

  it("passes with a fresh fixture repository and no machine state", () => {
    const base = newBase();
    const repo = newFixtureRepo(false);
    const result = run(base, repo);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /No JetBrains directory found/);
  });

  it("passes on a machine without the IDE and says so", () => {
    const base = newBase();
    const result = run(base);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /No JetBrains directory found/);
  });
});
