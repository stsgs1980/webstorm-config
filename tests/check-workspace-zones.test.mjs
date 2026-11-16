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
  "vitest.config.ts",
  "package.json",
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

/**
 * Append one line to a fixture file.
 * @param {string} root - fixture root
 * @param {string} file - repo-relative file name
 * @param {string} line - line to append including its trailing newline
 */
const appendLine = (root, file, line) => {
  const path = join(root, file);
  writeFileSync(path, readFileSync(path, "utf8") + line);
};

/**
 * Replace one exact line in a fixture file.
 * @param {string} root - fixture root
 * @param {string} file - repo-relative file name
 * @param {string} from - exact line including its trailing newline
 * @param {string} to - replacement line including its trailing newline
 */
const replaceLine = (root, file, from, to) => {
  const path = join(root, file);
  const content = readFileSync(path, "utf8");
  assert.ok(content.includes(from), `fixture ${file} has no line ${from.trim()}`);
  writeFileSync(path, content.replace(from, to));
};

describe("check-workspace-zones gate", () => {
  it("копия реальных конфигов проходит", () => {
    const result = runGate(makeRoot());
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /all 19 zones are ignored by every tool/);
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

  it("framework-зона, выпавшая из .stylelintignore, валит гейт", () => {
    const root = makeRoot();
    dropLine(root, ".stylelintignore", ".next/\n");
    const result = runGate(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\.next: not ignored by \.stylelintignore/);
  });

  it("запись вне списка владельца валит гейт двусторонней сверкой", () => {
    const root = makeRoot();
    appendLine(root, ".prettierignore", ".turbo/\n");
    const result = runGate(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\.turbo: mentioned by \.prettierignore but absent from the zone list/);
  });

  it("безкорневой glob в vitest include валит гейт", () => {
    const root = makeRoot();
    replaceLine(
      root,
      "vitest.config.ts",
      '      "src/**/*.{test,spec}.{ts,tsx}",\n',
      '      "**/*.{test,spec}.{ts,tsx}",\n',
    );
    const result = runGate(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /vitest include glob "\*\*\/\*\.\{test,spec\}\.\{ts,tsx\}" is not rooted/);
  });

  it("lint-staged паттерн, накрывающий зону, валит гейт", () => {
    const root = makeRoot();
    replaceLine(
      root,
      "package.json",
      '    "*.md": "markdownlint --fix --ignore node_modules"\n',
      '    "drafts/**/*.md": "markdownlint --fix"\n',
    );
    const result = runGate(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /lint-staged pattern "drafts\/\*\*\/\*\.md" covers zone drafts/);
  });
});
