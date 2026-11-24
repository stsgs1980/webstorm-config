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
import { evaluateCoverage, isZeroSha, parseCoverageSummary, selectMeasured } from "../scripts/lib/changed-coverage.ts";
import { COVERAGE_INCLUDE, COVERAGE_ROOTS, MIN_CHANGED_LINE_COVERAGE } from "../scripts/lib/coverage-scope.ts";
import { gitEnv } from "./lib/git-env.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/check-changed-coverage.ts", import.meta.url));
const ROOTS = ["eslint-rules", "tests/lib"];
const THRESHOLD = 80;

describe("coverage scope", () => {
  it("корни выводятся из списка include, а не дублируются", () => {
    assert.equal(COVERAGE_ROOTS.length, COVERAGE_INCLUDE.length);
    COVERAGE_INCLUDE.forEach((glob, index) => {
      assert.match(glob, /\/\*\*$/);
      assert.equal(COVERAGE_ROOTS[index], glob.slice(0, -3));
    });
    assert.equal(MIN_CHANGED_LINE_COVERAGE, 80);
  });
});

describe("selectMeasured", () => {
  it("оставляет код в измеряемых корнях и отбрасывает остальное", () => {
    const changed = [
      "eslint-rules/unicode-policy.js",
      "tests/lib/git-env.mjs",
      "docs/testing.md",
      "scripts/check-docs.ts",
      "src/app.tsx",
      "eslint-rules/types.d.ts",
      "eslint-rules/rule.test.js",
    ];
    const { measured, skipped } = selectMeasured(changed, ROOTS);
    assert.deepEqual(measured, ["eslint-rules/unicode-policy.js", "tests/lib/git-env.mjs"]);
    assert.equal(skipped.length, 5);
  });

  it("Windows-разделители нормализуются до сравнения", () => {
    assert.deepEqual(selectMeasured(["eslint-rules\\rule.js"], ROOTS).measured, ["eslint-rules/rule.js"]);
  });
});

describe("parseCoverageSummary", () => {
  it("делает ключи относительными и выбрасывает total", () => {
    const json = JSON.stringify({
      total: { lines: { pct: 50 } },
      "C:\\repo\\eslint-rules\\rule.js": { lines: { pct: 91.5 } },
    });
    const summary = parseCoverageSummary(json, "C:/repo");
    assert.equal(summary.get("eslint-rules/rule.js"), 91.5);
    assert.equal(summary.has("total"), false);
  });

  it("резолвер снимает Windows-короткое имя корня", () => {
    const json = JSON.stringify({
      total: { lines: { pct: 50 } },
      "C:\\REPO~1\\eslint-rules\\rule.js": { lines: { pct: 88.5 } },
    });
    const resolve = (path) => path.replace("C:\\REPO~1", "C:\\repo");
    const summary = parseCoverageSummary(json, "C:\\repo", resolve);
    assert.equal(summary.get("eslint-rules/rule.js"), 88.5);
  });

  it("бросает на отчёте без total и на не-JSON", () => {
    assert.throws(() => parseCoverageSummary("{}", "/repo"), /no 'total'/);
    assert.throws(() => parseCoverageSummary("not json", "/repo"), SyntaxError);
  });
});

describe("evaluateCoverage", () => {
  it("80% проходит, 79.9% падает, отсутствие данных падает", () => {
    const summary = new Map([
      ["eslint-rules/pass.js", 80],
      ["eslint-rules/fail.js", 79.9],
    ]);
    const result = evaluateCoverage(
      ["eslint-rules/pass.js", "eslint-rules/fail.js", "eslint-rules/missing.js"],
      summary,
      THRESHOLD,
    );
    assert.deepEqual(result.passed, [{ file: "eslint-rules/pass.js", pct: 80 }]);
    assert.equal(result.failures.length, 2);
    assert.match(result.failures[0], /79\.9% of lines, below 80%/);
    assert.match(result.failures[1], /no coverage data/);
  });
});

describe("isZeroSha", () => {
  it("all-zero и пустая строка считаются отсутствием базы", () => {
    assert.equal(isZeroSha("0".repeat(40)), true);
    assert.equal(isZeroSha(""), true);
    assert.equal(isZeroSha("abc1234"), false);
  });
});

/**
 * Run git in a fixture repository.
 * @param {string} cwd - repository path
 * @param {string[]} args - git arguments
 * @returns {string} stdout
 */
const git = (cwd, args) => execFileSync("git", args, { cwd, env: gitEnv(), encoding: "utf8" });

/**
 * Commit the index with a fixture identity.
 * @param {string} cwd - repository path
 * @param {string} message - commit message
 * @returns {string} stdout of the commit command
 */
const commit = (cwd, message) =>
  git(cwd, ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.com", "commit", "-q", "-m", message]);

/**
 * Write a file, creating parent directories.
 * @param {string} dir - repository root
 * @param {string} file - repository-relative path
 * @param {string} content - file content
 * @returns {void}
 */
const write = (dir, file, content) => {
  mkdirSync(join(dir, dirname(file)), { recursive: true });
  writeFileSync(join(dir, file), content);
};

/**
 * Create a two-commit repository: base commit with a README, then the change.
 * @param {Record<string, string>} files - files changed by the second commit
 * @returns {string} repository path
 */
const makeRepo = (files) => {
  const dir = mkdtempSync(join(tmpdir(), "wsc-coverage-"));
  git(dir, ["init", "-q"]);
  git(dir, ["config", "core.autocrlf", "false"]);
  write(dir, "README.md", "# base\n");
  git(dir, ["add", "-A"]);
  commit(dir, "base");
  for (const [file, content] of Object.entries(files)) {
    write(dir, file, content);
  }
  git(dir, ["add", "-A"]);
  commit(dir, "change");
  return dir;
};

/**
 * Write a coverage summary with absolute keys, as Vitest does.
 * @param {string} dir - repository root
 * @param {Record<string, number>} entries - repository-relative path to line percentage
 * @returns {void}
 */
const writeSummary = (dir, entries) => {
  const json = { total: { lines: { pct: 0 } } };
  for (const [file, pct] of Object.entries(entries)) {
    json[join(dir, file)] = { lines: { pct } };
  }
  writeFileSync(join(dir, "summary.json"), JSON.stringify(json));
};

/**
 * Run the gate inside a fixture repository.
 * @param {string} dir - repository root
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
 * Run a fixture and clean it up afterward.
 * @param {Record<string, string>} files - files changed by the second commit
 * @param {(dir: string) => { status: number, stdout: string, stderr: string }} scenario - gate invocation
 * @returns {{ status: number, stdout: string, stderr: string }} run result
 */
const runFixture = (files, scenario) => {
  const dir = makeRepo(files);
  try {
    return scenario(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const ARGS = ["--base", "HEAD~1", "--summary", "summary.json"];

describe("check-changed-coverage", () => {
  it("проходит на 80% и печатает каждый измеренный файл", () => {
    const result = runFixture({ "eslint-rules/rule.js": "export const x = 1;\n" }, (dir) => {
      writeSummary(dir, { "eslint-rules/rule.js": 80 });
      return run(dir, ARGS);
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[OK\] eslint-rules\/rule\.js: 80% lines\./);
    assert.match(result.stdout, /\[OK\] Changed-file coverage: 1 file\(s\)/);
  });

  it("падает ниже порога и называет процент", () => {
    const result = runFixture({ "tests/lib/helper.mjs": "export const x = 1;\n" }, (dir) => {
      writeSummary(dir, { "tests/lib/helper.mjs": 66.6 });
      return run(dir, ARGS);
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /tests\/lib\/helper\.mjs: 66\.6% of lines, below 80%/);
  });

  it("падает, когда изменённого файла нет в отчёте", () => {
    const result = runFixture({ "eslint-rules/rule.js": "export const x = 1;\n" }, (dir) => {
      writeSummary(dir, {});
      return run(dir, ARGS);
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no coverage data - no related test loaded it/);
  });

  it("изменения вне скоупа дают INFO и не требуют отчёта", () => {
    const result = runFixture({ "docs/notes.md": "# notes\n" }, (dir) => run(dir, ARGS));
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[INFO\] 1 changed path\(s\) outside the coverage scope/);
    assert.match(result.stdout, /\[OK\] No changed files in the coverage scope/);
  });

  it("отсутствующий отчёт падает с именем файла", () => {
    const result = runFixture({ "eslint-rules/rule.js": "export const x = 1;\n" }, (dir) => run(dir, ARGS));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Coverage report 'summary\.json' not found/);
  });

  it("битый отчёт падает, а не рапортует зелёный", () => {
    const result = runFixture({ "eslint-rules/rule.js": "export const x = 1;\n" }, (dir) => {
      writeFileSync(join(dir, "summary.json"), "{}");
      return run(dir, ARGS);
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no 'total' entry/);
  });
});
