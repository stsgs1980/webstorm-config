// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { afterEach, describe, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("../scripts/check-workspace-zones.ts", import.meta.url));
const REPO = fileURLToPath(new URL("..", import.meta.url));

/** Every file the gate reads; the fixture is a copy of the real repository set. */
const CONFIG_FILES = [
  ".gitignore",
  ".prettierignore",
  ".stylelintignore",
  ".markdownlintignore",
  "eslint.config.js",
  "eslint.metrics.config.js",
  "tsconfig.base.json",
];

/** Temp directories created by the current test, removed in afterEach. */
const tempDirs = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

/**
 * Temp root holding a copy of the real gate inputs, auto-removed after the test.
 * @returns {string} fixture root
 */
const makeRoot = () => {
  const root = mkdtempSync(join(tmpdir(), "zones-"));
  tempDirs.push(root);
  for (const file of CONFIG_FILES) {
    copyFileSync(join(REPO, file), join(root, file));
  }
  return root;
};

/**
 * Run the gate against a fixture root.
 * @param {string} root - fixture root
 * @returns {{status: number, stdout: string, stderr: string}} run result
 */
const runGate = (root) => {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, root], { cwd: REPO, encoding: "utf8" });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return { status: error.status ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
};

/**
 * Remove one exact line from a fixture file.
 * @param {string} root - fixture root
 * @param {string} file - repo-relative file name
 * @param {string} line - exact line including its trailing newline
 */
const dropLine = (root, file, line) => {
  const path = join(root, file);
  const content = readFileSync(path, "utf8");
  assert.ok(content.includes(line), `fixture ${file} has no line ${line.trim()}`);
  writeFileSync(path, content.replace(line, ""));
};

describe("check-workspace-zones gate", () => {
  it("копия реальных конфигов проходит", () => {
    const result = runGate(makeRoot());
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /all 12 zones are ignored by every tool/);
  });

  it("зона, выпавшая из .markdownlintignore, валит гейт", () => {
    const root = makeRoot();
    dropLine(root, ".markdownlintignore", "drafts/\n");
    const result = runGate(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /drafts: not ignored by \.markdownlintignore/);
  });

  it("зона, выпавшая из eslint.metrics.config.js, валит гейт", () => {
    const root = makeRoot();
    dropLine(root, "eslint.metrics.config.js", '  "drafts/**",\n');
    const result = runGate(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /drafts: not ignored by eslint\.metrics\.config\.js/);
  });
});
