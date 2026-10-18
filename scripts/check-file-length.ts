#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const DEFAULT_MAX_LINES = 250;
const EXTENSIONS = /\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/;
/** Test files are exempt: the limit must not force splitting one test suite. */
const TEST_FILE = /\.(test|spec)\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/;
/** Everything under tests/ or __tests__/ is test support code. */
const TEST_DIR = /(?:^|[\\/])(?:__tests__|tests?)[\\/]/;

const args = process.argv.slice(2);
const checkAll = args.includes("--all");
const maxLinesArg = args.find((arg) => arg.startsWith("--max-lines="));

/**
 * Parse and strictly validate the --max-lines flag.
 * @param raw - raw flag value without the prefix
 * @returns validated line limit
 */
function parseMaxLines(raw: string | undefined): number {
  if (raw === undefined) {
    return DEFAULT_MAX_LINES;
  }

  const parsed = Number(raw.slice("--max-lines=".length));

  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.error(`[FAIL] Invalid --max-lines value: '${raw}'. Expected a positive integer.`);
    process.exit(2);
  }

  return parsed;
}

const MAX_LINES = parseMaxLines(maxLinesArg);

/**
 * Pre-commit check by default (staged files), full-tree check with --all.
 * @returns {string[]} file paths to check
 */
function listFiles(): string[] {
  // -z keeps paths verbatim: without it git quotes non-ASCII names ("\320\244..."),
  // and the trailing quote breaks both the extension filter and existsSync.
  const command = checkAll ? "git ls-files -z" : "git diff --cached --name-only --diff-filter=ACM -z";

  return execSync(command, { encoding: "utf8" })
    .split("\0")
    .filter((file) => EXTENSIONS.test(file));
}

/**
 * Whether test code is exempt from the anti-monolith limit.
 * @param file - repository-relative path
 * @returns true for *.test.* and *.spec.* files and tests/ or __tests__/ trees
 */
function isTestFile(file: string): boolean {
  return TEST_FILE.test(file) || TEST_DIR.test(file);
}

/**
 * Anti-monolith check: TS/JS source files must not exceed MAX_LINES.
 * Test files (*.test.*, *.spec.*, tests/, __tests__/) are exempt.
 * @returns {void}
 */
function main(): void {
  const candidates = listFiles();
  const files = candidates.filter((file) => !isTestFile(file));
  const skippedTests = candidates.length - files.length;

  let failed = 0;

  for (const file of files) {
    if (!existsSync(file)) {
      continue;
    }

    // A trailing newline terminates the last line; it is not an extra line.
    const content = readFileSync(file, "utf8").replace(/\r?\n$/, "");
    const lines = content.split("\n").length;

    if (lines > MAX_LINES) {
      console.error(`[FAIL] File '${file}' has ${lines} lines. Limit: ${MAX_LINES}.`);
      failed = 1;
    }
  }

  if (failed) {
    console.error("[Anti-Monolith] Commit rejected.");
    process.exit(1);
  }

  process.stdout.write(
    `[OK] Checked files: ${files.length}, tests skipped: ${skippedTests}. Limit: ${MAX_LINES} lines.\n`,
  );
}

main();
