// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("../scripts/check-style-consistency.ts", import.meta.url));
const REPO = fileURLToPath(new URL("..", import.meta.url));

/**
 * Run the style checker against a fixture root.
 * @param {string} root - fixture directory
 * @returns {{status: number, stdout: string, stderr: string}}
 */
const run = (root) => {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, root], { encoding: "utf8" });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return { status: error.status ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
};

/**
 * Copy the three source files into a temp root.
 * @returns {string} fixture root
 */
const makeFixture = () => {
  const root = mkdtempSync(join(tmpdir(), "wsc-style-"));
  cpSync(join(REPO, ".editorconfig"), join(root, ".editorconfig"));
  cpSync(join(REPO, ".prettierrc"), join(root, ".prettierrc"));
  mkdirSync(join(root, ".idea", "codeStyles"), { recursive: true });
  cpSync(join(REPO, ".idea", "codeStyles", "Project.xml"), join(root, ".idea", "codeStyles", "Project.xml"));
  return root;
};

describe("check-style-consistency", () => {
  it("согласованные файлы проходят", () => {
    const root = makeFixture();
    try {
      const result = run(root);
      assert.equal(result.status, 0, result.stderr);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("пропавшая опция языка ловится", () => {
    const root = makeFixture();
    try {
      const path = join(root, ".idea", "codeStyles", "Project.xml");
      writeFileSync(path, readFileSync(path, "utf8").replace(/<option name="INDENT_SIZE"[^>]*\/>\s*/g, ""));
      const result = run(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Project\.xml:HTML: INDENT_SIZE/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("пропавший язык ловится", () => {
    const root = makeFixture();
    try {
      const path = join(root, ".idea", "codeStyles", "Project.xml");
      const xml = readFileSync(path, "utf8").replace(
        /<codeStyleSettings language="HTML">[\s\S]*?<\/codeStyleSettings>/,
        "",
      );
      writeFileSync(path, xml);
      const result = run(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /language HTML = missing/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("расхождение Prettier ловится", () => {
    const root = makeFixture();
    try {
      const path = join(root, ".prettierrc");
      const value = JSON.parse(readFileSync(path, "utf8"));
      value.printWidth = 100;
      writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
      const result = run(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /\.prettierrc: printWidth/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
