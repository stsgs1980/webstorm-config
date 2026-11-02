// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("../scripts/generate-changelog.ts", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPO_NODE_MODULES = join(REPO_ROOT, "node_modules");
const OLD_CHANGELOG = "# 1.0.0 (2026-10-18)\n\n### Bug Fixes\n\n- Old entry\n";
const NEW_RELEASE_CHUNK = "# 1.1.0 (2026-11-01)\n\n### Bug Fixes\n\n- New fix\n";
const DRAFT = "CHANGELOG.md.tmp";
const MARKDOWNLINT_DISABLE = "<!-- markdownlint-disable -->";
const GIT_IDENTITY = ["-c", "user.name=test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false"];

/**
 * Create a throwaway git repository with an existing changelog.
 * @param {string} text - initial CHANGELOG.md content
 * @returns {string} repository path
 */
const makeRepo = (text = OLD_CHANGELOG) => {
  const dir = mkdtempSync(join(tmpdir(), "wsc-changelog-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: dir, stdio: "ignore" });
  writeFileSync(join(dir, "CHANGELOG.md"), text);
  execFileSync("git", ["add", "-A"], { cwd: dir });
  return dir;
};

/**
 * Commit the working tree of a fixture repository.
 * @param {string} dir - repository path
 * @param {string} message - commit message
 * @returns {void}
 */
const commitAll = (dir, message) => {
  execFileSync("git", ["add", "-A"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", [...GIT_IDENTITY, "commit", "-m", message], { cwd: dir, stdio: "ignore" });
};

/**
 * Create a throwaway git repository with a committed changelog tagged as 1.0.0.
 * @param {string} text - initial CHANGELOG.md content
 * @returns {string} repository path
 */
const makeTaggedRepo = (text = OLD_CHANGELOG) => {
  const dir = makeRepo(text);
  commitAll(dir, "chore: init");
  execFileSync("git", ["tag", "v1.0.0"], { cwd: dir });
  return dir;
};

/**
 * Create a repository wired to the real node_modules, so the script spawns the
 * installed generator and prettier instead of a stub.
 * @returns {string} repository path
 */
const makeLiveRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), "wsc-changelog-live-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0" }));
  writeFileSync(join(dir, "CHANGELOG.md"), OLD_CHANGELOG);
  // The junction must stay out of the fixture index: committing thousands of
  // real dependency files makes git slow and floods stderr with line-ending
  // warnings.
  writeFileSync(join(dir, ".gitignore"), "node_modules/\n");
  symlinkSync(REPO_NODE_MODULES, join(dir, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  execFileSync("git", ["init", "-q"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: dir, stdio: "ignore" });
  commitAll(dir, "chore: init");
  execFileSync("git", ["tag", "v1.0.0"], { cwd: dir, stdio: "ignore" });
  return dir;
};

/**
 * Create a directory whose npx always fails, to simulate generator crashes.
 * @returns {string} shim directory path
 */
const makeFailingNpx = () => {
  const dir = mkdtempSync(join(tmpdir(), "wsc-npx-shim-"));
  if (process.platform === "win32") {
    writeFileSync(join(dir, "npx.cmd"), "@exit /b 1\r\n");
  } else {
    writeFileSync(join(dir, "npx"), "#!/bin/sh\nexit 1\n");
    chmodSync(join(dir, "npx"), 0o755);
  }
  return dir;
};

/**
 * Create a directory whose npx prints fixed content to stdout, imitating the
 * generator output. Only calls containing `-i` (the generator) are answered;
 * the prettier call must not print the payload.
 *
 * @param {string} content - text to print on stdout
 * @returns {string} shim directory path
 */
const makeGeneratedNpx = (content) => {
  const dir = makeFailingNpx();
  if (process.platform === "win32") {
    writeFileSync(
      join(dir, "npx.cmd"),
      ["@echo off", 'set "args=%*"', 'if "%args%" neq "%args:-i=%" type "%~dp0content.txt"'].join("\r\n"),
    );
  } else {
    writeFileSync(
      join(dir, "npx"),
      [
        "#!/bin/sh",
        'for arg in "$@"; do',
        '  if [ "$arg" = "-i" ]; then',
        '    exec cat "$(dirname "$0")/content.txt"',
        "  fi",
        "done",
        "exit 0",
      ].join("\n"),
    );
    chmodSync(join(dir, "npx"), 0o755);
  }
  writeFileSync(join(dir, "content.txt"), content);
  return dir;
};

/**
 * Run the changelog script with the shim first on PATH.
 * @param {string} repo - working directory
 * @param {string} shim - npx shim directory
 * @returns {{ status: number, stdout: string, stderr: string }} run result
 */
const runWithShim = (repo, shim) => {
  const env = { ...process.env };
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH";
  env[pathKey] = `${shim}${delimiter}${env[pathKey]}`;
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT], { cwd: repo, env, encoding: "utf8" });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return { status: error.status ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
};

/**
 * Run the changelog script against the real toolchain in a fixture repository.
 * @param {string} repo - working directory
 * @returns {{ status: number, stdout: string, stderr: string }} run result
 */
const runScript = (repo) => {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT], { cwd: repo, encoding: "utf8", timeout: 180000 });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return { status: error.status ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
};

describe("generate-changelog", () => {
  it("при падении генератора не трогает CHANGELOG.md и убирает черновик", () => {
    const repo = makeRepo();
    const shim = makeFailingNpx();
    try {
      const result = runWithShim(repo, shim);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /left untouched/);
      assert.equal(readFileSync(join(repo, "CHANGELOG.md"), "utf8"), OLD_CHANGELOG);
      assert.equal(existsSync(join(repo, DRAFT)), false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(shim, { recursive: true, force: true });
    }
  });

  it("при наличии тега дописывает новый релиз, не теряя старые выше него", () => {
    const repo = makeTaggedRepo();
    const shim = makeGeneratedNpx(NEW_RELEASE_CHUNK);
    try {
      const result = runWithShim(repo, shim);
      assert.equal(result.status, 0);
      const content = readFileSync(join(repo, "CHANGELOG.md"), "utf8");
      assert.match(content, /New fix/);
      assert.match(content, /- Old entry/);
      assert.ok(content.indexOf("New fix") < content.indexOf("- Old entry"), "новый релиз должен стоять выше старого");
      assert.ok(content.startsWith(MARKDOWNLINT_DISABLE), "заголовок с markdownlint-disable должен остаться первым");
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(shim, { recursive: true, force: true });
    }
  });

  it("при пустой генерации после последнего тега оставляет CHANGELOG.md неизменным", () => {
    const repo = makeTaggedRepo();
    const shim = makeGeneratedNpx("");
    try {
      const first = runWithShim(repo, shim);
      assert.equal(first.status, 0);
      assert.equal(readFileSync(join(repo, "CHANGELOG.md"), "utf8"), OLD_CHANGELOG);
      const second = runWithShim(repo, shim);
      assert.equal(second.status, 0);
      assert.equal(readFileSync(join(repo, "CHANGELOG.md"), "utf8"), OLD_CHANGELOG);
      assert.match(second.stdout, /up to date/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(shim, { recursive: true, force: true });
    }
  });

  it("повторный прогон с тем же чанком заменяет блок, а не дублирует его", () => {
    const repo = makeTaggedRepo();
    const shim = makeGeneratedNpx(NEW_RELEASE_CHUNK);
    try {
      const first = runWithShim(repo, shim);
      assert.equal(first.status, 0);
      const afterFirst = readFileSync(join(repo, "CHANGELOG.md"), "utf8");
      const second = runWithShim(repo, shim);
      assert.equal(second.status, 0);
      const content = readFileSync(join(repo, "CHANGELOG.md"), "utf8");
      assert.equal(content, afterFirst, "повторный прогон не должен менять файл");
      assert.equal(content.match(/# 1\.1\.0/g)?.length, 1, "блок релиза не должен дублироваться");
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(shim, { recursive: true, force: true });
    }
  });
});

describe("generate-changelog (real generator)", () => {
  it("пишет невыпущенный feat из git и нормализует заголовок Unreleased", { timeout: 180000 }, () => {
    const repo = makeLiveRepo();
    try {
      writeFileSync(join(repo, "feature.txt"), "feature\n");
      commitAll(repo, "feat: add live generation");
      const result = runScript(repo);
      assert.equal(result.status, 0, result.stderr);
      const content = readFileSync(join(repo, "CHANGELOG.md"), "utf8");
      assert.match(content, /add live generation/);
      assert.match(content, /- Old entry/);
      assert.ok(content.indexOf("add live generation") < content.indexOf("- Old entry"));
      assert.match(content, /^# Unreleased$/m, "заголовок без ссылки и даты");
      assert.doesNotMatch(content, /\[Unreleased\]\(/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("повторный прогон идемпотентен: гейт свежести не даёт дифф", { timeout: 180000 }, () => {
    const repo = makeLiveRepo();
    try {
      writeFileSync(join(repo, "feature.txt"), "feature\n");
      commitAll(repo, "feat: add idempotent generation");
      assert.equal(runScript(repo).status, 0);
      const afterFirst = readFileSync(join(repo, "CHANGELOG.md"), "utf8");
      const second = runScript(repo);
      assert.equal(second.status, 0, second.stderr);
      assert.equal(readFileSync(join(repo, "CHANGELOG.md"), "utf8"), afterFirst);
      assert.match(second.stdout, /up to date/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
