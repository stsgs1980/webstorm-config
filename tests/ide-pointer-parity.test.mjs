// noinspection SpellCheckingInspection,GrazieInspection,GrazieStyle
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
import { EDITOR_POINTER, SCHEME_FILE, SCHEME_NAME } from "../scripts/lib/ide-state.ts";
import { jetbrainsEnv, jetbrainsRoot } from "./lib/ide-env.mjs";

const CHECK = fileURLToPath(new URL("../scripts/check-ide-state.ts", import.meta.url));
const SYNC = fileURLToPath(new URL("../scripts/sync-ide-settings.ts", import.meta.url));
const REPO = fileURLToPath(new URL("..", import.meta.url));
const VERSION = "WebStorm2026.3";
const POINTER_FILES = ["options/project.default.xml", "options/editor.xml"];

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
  const base = mkdtempSync(join(tmpdir(), "ide-parity-"));
  tempDirs.push(base);
  return base;
};

/**
 * Canonical reference bytes for a group, from the generated repository reference.
 * @param {string} group - generated/ide-reference sub-directory
 * @returns {string} file content
 */
const reference = (group) => readFileSync(join(REPO, "generated", "ide-reference", group, SCHEME_FILE), "utf8");

/**
 * Correct content of `options/project.default.xml` pointer values.
 * @returns {string} file content
 */
const correctProjectOptions = () =>
  `<application>\n  <component name="ProjectManager">\n    <defaultProject>\n` +
  `      <component name="InspectionProjectProfileManager">\n` +
  `        <option name="PROJECT_PROFILE" value="${SCHEME_NAME}" />\n` +
  `        <option name="USE_PROJECT_PROFILE" value="false" />\n` +
  `      </component>\n` +
  `      <component name="ProjectCodeStyleConfiguration">\n` +
  `        <option name="PREFERRED_SCHEME" value="${SCHEME_NAME}" />\n` +
  `      </component>\n    </defaultProject>\n  </component>\n</application>\n`;

/**
 * Correct content of `options/editor.xml` pointer attribute.
 * @returns {string} file content
 */
const correctEditor = () =>
  `<application>\n  <component name="${EDITOR_POINTER.component}" ${EDITOR_POINTER.attribute}="${SCHEME_NAME}" />\n` +
  `</application>\n`;

/**
 * Create the machine layout both entry points read: a WebStorm directory with
 * the repository schemes, and pointer files only when requested.
 * @param {string} base - fixture JetBrains base directory
 * @param {boolean} pointers - write the two pointer files
 * @returns {string} path to the WebStorm directory
 */
const makeIdeDir = (base, pointers) => {
  const dir = join(jetbrainsRoot(base), VERSION);
  for (const group of ["codestyles", "inspection"]) {
    mkdirSync(join(dir, group), { recursive: true });
    writeFileSync(join(dir, group, SCHEME_FILE), reference(group));
  }
  if (pointers) {
    mkdirSync(join(dir, "options"), { recursive: true });
    writeFileSync(join(dir, "options", "project.default.xml"), correctProjectOptions());
    writeFileSync(join(dir, "options", "editor.xml"), correctEditor());
  }
  return dir;
};

/**
 * Run one entry point against the fixture.
 * @param {string} script - script path
 * @param {string[]} args - script arguments
 * @param {Record<string, string>} [env] - extra environment variables
 * @returns {{status: number, stdout: string, stderr: string}} run result
 */
const run = (script, args, env = {}) => {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], {
      cwd: REPO,
      env: { ...process.env, ...env },
      encoding: "utf8",
    });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return { status: error.status ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
};

/**
 * Run the repository gate; it resolves the JetBrains base from the
 * platform environment entries (jetbrainsEnv).
 * @param {string} base - fixture base directory hosting the JetBrains config
 * @returns {{status: number, stdout: string, stderr: string}} run result
 */
const gate = (base) => run(CHECK, [], jetbrainsEnv(base));

/**
 * Run the repair command in check mode.
 * @param {string} base - fixture base directory hosting the JetBrains config
 * @returns {{status: number, stdout: string, stderr: string}} run result
 */
const check = (base) => run(SYNC, ["--check", "--jetbrains-root", jetbrainsRoot(base)]);

/**
 * Join both output streams and normalize Windows separators for assertions.
 * @param {{stdout: string, stderr: string}} result - run result
 * @returns {string} normalized output
 */
const output = (result) => `${result.stdout}\n${result.stderr}`.replaceAll("\\", "/");

/**
 * Assert both entry points fail on the same pointer problem.
 * @param {{status: number, stdout: string, stderr: string}} fromGate - gate result
 * @param {{status: number, stdout: string, stderr: string}} fromSync - sync --check result
 * @param {RegExp[]} patterns - extra output fragments both must report
 * @returns {void}
 */
const assertBothReport = (fromGate, fromSync, patterns) => {
  assert.equal(fromGate.status, 1);
  assert.equal(fromSync.status, 1);
  for (const file of POINTER_FILES) {
    assert.match(output(fromGate), new RegExp(file), `гейт не назвал ${file}`);
    assert.match(output(fromSync), new RegExp(file), `sync --check не назвал ${file}`);
  }
  for (const pattern of patterns) {
    assert.match(output(fromGate), pattern);
    assert.match(output(fromSync), pattern);
  }
};

describe("ide pointer parity", () => {
  it("оба входа считают отсутствие файлов указателей расхождением", () => {
    const base = newBase();
    makeIdeDir(base, false);
    const fromGate = gate(base);
    const fromSync = check(base);
    assertBothReport(fromGate, fromSync, [/file is missing; run npm run sync:ide/]);
  });

  it("оба входа одинаково описывают дрейф значения указателя", () => {
    const base = newBase();
    const dir = makeIdeDir(base, true);
    writeFileSync(
      join(dir, "options", "project.default.xml"),
      correctProjectOptions().replaceAll(`value="${SCHEME_NAME}"`, 'value="Default"'),
    );
    writeFileSync(join(dir, "options", "editor.xml"), correctEditor().replaceAll(`="${SCHEME_NAME}"`, '="Default"'));
    const fromGate = gate(base);
    const fromSync = check(base);
    const drift = `is "Default", expected "${SCHEME_NAME}"`;
    assertBothReport(fromGate, fromSync, [new RegExp(drift)]);
  });
});
