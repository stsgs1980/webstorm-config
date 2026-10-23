// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("../scripts/generate-changelog.ts", import.meta.url));
const OLD_CHANGELOG = "# 1.0.0 (2026-10-18)\n\n### Bug Fixes\n\n- Old entry\n";
const NEW_RELEASE_CHUNK = "# 1.1.0 (2026-11-01)\n\n### Bug Fixes\n\n- New fix\n";
const DRAFT = "CHANGELOG.md.tmp";
const MARKDOWNLINT_DISABLE = "<!-- markdownlint-disable -->";

/**
 * Create a throwaway git repository with an existing changelog.
 * @param {string} text - initial CHANGELOG.md content
 * @returns {string} repository path
 */
const makeRepo = (text = OLD_CHANGELOG) => {
  const dir = mkdtempSync(join(tmpdir(), "wsc-changelog-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  writeFileSync(join(dir, "CHANGELOG.md"), text);
  execFileSync("git", ["add", "-A"], { cwd: dir });
  return dir;
};

/**
 * Create a throwaway git repository with a committed changelog tagged as 1.0.0.
 * @param {string} text - initial CHANGELOG.md content
 * @returns {string} repository path
 */
const makeTaggedRepo = (text = OLD_CHANGELOG) => {
  const dir = makeRepo(text);
  execFileSync(
    "git",
    ["-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--no-gpg-sign", "-m", "chore: init"],
    { cwd: dir },
  );
  execFileSync("git", ["tag", "v1.0.0"], { cwd: dir });
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
 * Create a directory whose npx writes fixed content into the file passed
 * after the `-i` argument, imitating the generator output.
 * @param {string} content - text to write into the target file
 * @returns {string} shim directory path
 */
const makeGeneratedNpx = (content) => {
  const dir = makeFailingNpx();
  if (process.platform === "win32") {
    writeFileSync(
      join(dir, "npx.cmd"),
      `@echo off\npowershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0emit-chunk.ps1" %*\r\n`,
    );
  } else {
    writeFileSync(
      join(dir, "npx"),
      [
        "#!/bin/sh",
        'dir="${0%/*}"',
        "if command -v pwsh >/dev/null 2>&1; then",
        '  exec pwsh -NoProfile -File "$dir/emit-chunk.ps1" "$@"',
        "fi",
        "if command -v powershell >/dev/null 2>&1; then",
        '  exec powershell -NoProfile -ExecutionPolicy Bypass -File "$dir/emit-chunk.ps1" "$@"',
        "fi",
        "exit 1",
      ].join("\n"),
    );
    chmodSync(join(dir, "npx"), 0o755);
  }
  writeFileSync(
    join(dir, "emit-chunk.ps1"),
    [
      "### no param() block: everything goes to $args, so -i stays positional",
      '$contentPath = Join-Path $PSScriptRoot "content.txt"',
      "if (-not (Test-Path $contentPath)) { exit 0 }",
      "$content = Get-Content -Raw -LiteralPath $contentPath",
      '$index = [array]::IndexOf($args, "-i")',
      "if ($index -lt 0 -or ($index + 1) -ge $args.Count) { exit 0 }",
      "[System.IO.File]::WriteAllText($args[$index + 1], $content)",
      "exit 0",
    ].join("\n"),
  );
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
});
