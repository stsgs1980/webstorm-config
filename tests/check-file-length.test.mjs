// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";
import { gitEnv } from "./lib/git-env.mjs";

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
  execFileSync("git", ["init", "-q"], { cwd: dir, env: gitEnv() });
  mkdirSync(join(dir, dirname(name)), { recursive: true });
  writeFileSync(join(dir, name), content);
  execFileSync("git", ["add", "-A"], { cwd: dir, env: gitEnv() });
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
    const stdout = execFileSync(process.execPath, [SCRIPT, ...args], { cwd: dir, env: gitEnv(), encoding: "utf8" });
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
  it("при провале всё равно печатает исключения с причиной", () => {
    const dir = mkdtempSync(join(tmpdir(), "wsc-file-length-"));
    try {
      execFileSync("git", ["init", "-q"], { cwd: dir, env: gitEnv() });
      mkdirSync(join(dir, "generated"), { recursive: true });
      writeFileSync(join(dir, "generated", "schema.ts"), LONG_FILE);
      writeFileSync(join(dir, "long.ts"), LONG_FILE);
      execFileSync("git", ["add", "-A"], { cwd: dir, env: gitEnv() });
      const result = run(dir, ["--all"]);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /exempt: .*generated[/\\]schema\.ts \(/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

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

  it("сгенерированный файл в generated/ пропускается с причиной", () => {
    const result = runFixture(join("generated", "schema.ts"), LONG_FILE, ["--all"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /exempt: .*generated[/\\]schema\.ts \(.+\)/);
  });

  it("сторонний код в vendor/ пропускается", () => {
    const result = runFixture(join("vendor", "lib.js"), LONG_FILE, ["--all"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /exempt: .*vendor[/\\]lib\.js \(.+\)/);
  });

  it("файл суффикса .gen.ts (кодогенерация) пропускается", () => {
    const result = runFixture(join("src", "schema.gen.ts"), LONG_FILE, ["--all"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /exempt: .*schema\.gen\.ts \(.+\)/);
  });

  it("копированные shadcn/ui компоненты пропускаются", () => {
    const result = runFixture(join("src", "components", "ui", "sidebar.tsx"), LONG_FILE, ["--all"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /exempt: .*components[/\\]ui[/\\]sidebar\.tsx \(shadcn/);
  });

  it("обычный длинный файл вне сгенерированных деревьев по-прежнему ловится", () => {
    const result = runFixture(join("src", "generated-looking.ts"), LONG_FILE, ["--all"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[FAIL\] File 'src[/\\]generated-looking\.ts' has 260 lines\./);
  });

  it("сводка [OK] отчитывает и пропущенные исключения, а не молчит", () => {
    const result = runFixture(join("generated", "schema.ts"), LONG_FILE, ["--all"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /exempt skipped: \d+/);
  });

  it("маркер file-length-exempt первой строкой пропускает файл с его причиной", () => {
    const content = `// file-length-exempt: cohesive state machine, splitting would break invariants\n${LONG_FILE}`;
    const result = runFixture("shield.ts", content, ["--all"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /exempt: shield\.ts \(file-length-exempt: cohesive state machine/);
  });

  it("маркер не первой строкой не работает", () => {
    const content = `${LONG_FILE.slice(0, 40)}\n// file-length-exempt: too late\n${LONG_FILE.slice(40)}`;
    const result = runFixture("late-marker.ts", `${content}\n`, ["--all"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[FAIL\] File 'late-marker\.ts' has/);
  });

  it("файл объявлений типов .d.ts пропускается", () => {
    const result = runFixture(join("src", "types.d.ts"), LONG_FILE, ["--all"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /exempt: .*types\.d\.ts \(type declarations/);
  });

  it("конфиг инструмента *.config.ts пропускается", () => {
    const result = runFixture("vite.config.ts", LONG_FILE, ["--all"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /exempt: vite\.config\.ts \(tool config/);
  });

  it("дерево dist/ пропускается", () => {
    const result = runFixture(join("dist", "lib.js"), LONG_FILE, ["--all"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /exempt: .*dist[/\\]lib\.js \(build output/);
  });

  it("чистый barrel index.ts пропускается даже длинным", () => {
    const barrel = Array.from({ length: 260 }, (_, index) => `export { x${index} } from "./x${index}.js";`).join("\n");
    const result = runFixture(join("src", "index.ts"), barrel, ["--all"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /exempt: .*index\.ts \(barrel file, re-exports only\)/);
  });

  it("index.ts с логикой barrel не является и ловится", () => {
    const barrel = `${Array.from({ length: 260 }, (_, index) => `export { x${index} } from "./x${index}.js";`).join("\n")}\nconsole.log("loaded");`;
    const result = runFixture(join("src", "index.ts"), barrel, ["--all"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[FAIL\] File/);
  });
});
