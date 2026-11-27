#!/usr/bin/env node

/**
 * Changed-file coverage gate. Selects changed files inside the coverage scope,
 * runs `vitest related` for them and fails when a file has no coverage data or
 * fewer than MIN_CHANGED_LINE_COVERAGE covered lines.
 *
 * Usage:
 *   node scripts/check-changed-coverage.ts [--base <ref>] [--summary <file>]
 *
 * Base: `--base`, then COVERAGE_BASE_SHA (CI), then merge-base with origin/main.
 * `--summary` evaluates an existing report without running Vitest (local re-run).
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import process from "node:process";
import { evaluateCoverage, isZeroSha, parseCoverageSummary, selectMeasured } from "./lib/changed-coverage.ts";
import { COVERAGE_ROOTS, MIN_CHANGED_LINE_COVERAGE } from "./lib/coverage-scope.ts";

/** Report path Vitest writes under the repository root. */
const SUMMARY_PATH = "coverage/coverage-summary.json";

/**
 * Print a failure and stop the process.
 * @param message - line to print
 * @returns never
 */
const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

/**
 * Read a `--name value` or `--name=value` option.
 * @param args - command-line arguments
 * @param name - option name with dashes
 * @returns option value, or undefined when absent
 */
const option = (args: string[], name: string): string | undefined => {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline !== undefined) {
    return inline.slice(name.length + 1);
  }

  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];
  return value === undefined || value.startsWith("--") ? fail(`[FAIL] ${name} needs a value.`) : value;
};

/**
 * Resolve the repository root; the gate needs the changed-file diff.
 * @returns absolute repository root
 */
const readRoot = (): string => {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: process.cwd(), encoding: "utf8" }).trim();
  } catch {
    return fail("[FAIL] Not a git repository; the coverage gate needs the changed-file diff.");
  }
};

const root = readRoot();
const args = process.argv.slice(2);

/**
 * Run git and return trimmed stdout.
 * @param gitArgs - git arguments
 * @returns command output
 */
const git = (gitArgs: string[]): string => execFileSync("git", gitArgs, { cwd: root, encoding: "utf8" }).trim();

/**
 * Canonical absolute path. Windows runners hand out 8.3 short names in the
 * report while git prints the long root, so both sides are unfolded before
 * the prefix comparison. A missing path stays as given.
 * @param path - absolute path from the report or the root
 * @returns canonical path when it exists
 */
const canonicalPath = (path: string): string => {
  try {
    return realpathSync.native(path);
  } catch {
    return path;
  }
};

/**
 * Resolve the base commit: explicit flag, CI environment, then the default
 * branch. A zeroed CI placeholder falls through to the local branch.
 * @param explicit - value of `--base`, when given
 * @returns base ref to compare against
 */
const resolveBase = (explicit: string | undefined): string => {
  if (explicit !== undefined) {
    return explicit;
  }

  const fromEnv = (process.env.COVERAGE_BASE_SHA ?? "").trim();
  if (!isZeroSha(fromEnv)) {
    return fromEnv;
  }

  for (const candidate of ["origin/main", "main"]) {
    try {
      return git(["merge-base", "HEAD", candidate]);
    } catch {
      // Try the next candidate; the final message names the fix.
    }
  }

  return fail("[FAIL] Cannot resolve the coverage base; pass --base <ref> or set COVERAGE_BASE_SHA.");
};

/**
 * Run Vitest for the related tests and overwrite the summary.
 * @param files - measured repository-relative paths
 * @returns nothing; exits on failure
 */
const runVitest = (files: string[]): void => {
  const vitest = join(root, "node_modules", "vitest", "vitest.mjs");
  if (!existsSync(vitest)) {
    fail("[FAIL] node_modules/vitest is missing; run npm ci before the coverage gate.");
  }

  rmSync(join(root, SUMMARY_PATH), { force: true });
  try {
    execFileSync(process.execPath, [vitest, "related", ...files, "--coverage", "--coverage.reporter=json-summary"], {
      cwd: root,
      stdio: "inherit",
    });
  } catch {
    fail("[FAIL] vitest related failed; a changed file without a related test fails the gate. See the output above.");
  }
};

const base = resolveBase(option(args, "--base"));

let mergeBase: string;
try {
  mergeBase = git(["merge-base", base, "HEAD"]);
} catch {
  mergeBase = fail(`[FAIL] Cannot compare '${base}' with HEAD; fetch full history or pass a reachable --base.`);
}

const changed = git(["diff", "--name-only", "--diff-filter=ACMR", mergeBase, "HEAD"]).split("\n").filter(Boolean);
const { measured, skipped } = selectMeasured(changed, COVERAGE_ROOTS);

if (skipped.length > 0) {
  console.log(
    `[INFO] ${skipped.length} changed path(s) outside the coverage scope ` +
      `were not measured (docs, scripts, configs, tests).`,
  );
}

if (measured.length === 0) {
  console.log("[OK] No changed files in the coverage scope; nothing to measure.");
  process.exit(0);
}

const summaryOption = option(args, "--summary");
if (summaryOption === undefined) {
  runVitest(measured);
}

const summaryPath = summaryOption ?? SUMMARY_PATH;
const absoluteSummary = isAbsolute(summaryPath) ? summaryPath : join(root, summaryPath);
if (!existsSync(absoluteSummary)) {
  fail(`[FAIL] Coverage report '${summaryPath}' not found; Vitest did not produce it.`);
}

let summary: Map<string, number>;
try {
  summary = parseCoverageSummary(readFileSync(absoluteSummary, "utf8"), root, canonicalPath);
} catch (error) {
  summary = fail(`[FAIL] Cannot read '${summaryPath}': ${error instanceof Error ? error.message : String(error)}`);
}

const { passed, failures } = evaluateCoverage(measured, summary, MIN_CHANGED_LINE_COVERAGE);

for (const { file, pct } of passed) {
  console.log(`[OK] ${file}: ${pct}% lines.`);
}
for (const failure of failures) {
  console.error(failure);
}

if (failures.length > 0) {
  fail(
    `[FAIL] Changed-file coverage: ${failures.length} file(s) below ` +
      `${MIN_CHANGED_LINE_COVERAGE}% lines or without data.`,
  );
}

console.log(`[OK] Changed-file coverage: ${passed.length} file(s) at or above ${MIN_CHANGED_LINE_COVERAGE}% lines.`);
