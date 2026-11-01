#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const DEFAULT_MAX_LINES = 250;
const EXTENSIONS = /\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/;
/** Test files are exempt: the limit must not force splitting one test suite. */
const TEST_FILE = /\.(test|spec)\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/;
/** Everything under tests/ or __tests__/ is test support code. */
const TEST_DIR = /(?:^|[\\/])(?:__tests__|tests?)[\\/]/;

/**
 * Paths holding code nobody edits by hand. Generated and vendored files
 * are produced by a tool or copied wholesale, so a line limit cannot fix
 * them; forcing a person to "split" them only damages the artifact. Every
 * entry must carry a reason: an exemption without a stated reason is a
 * hole in the rule, not a rule.
 * @type {{pattern: RegExp, reason: string}[]}
 */
const EXEMPT_PATHS = [
  {
    pattern: /(?:^|[\\/])vendor[\\/]/,
    reason: "vendored third-party code, copied whole",
  },
  {
    pattern: /(?:^|[\\/])(?:generated|__generated__|codegen)[\\/]/,
    reason: "generated code kept in git",
  },
  {
    pattern: /\.gen\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)$/,
    reason: "codegen output (.gen.* suffix)",
  },
  {
    pattern: /\.generated\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)$/,
    reason: "codegen output (.generated.* suffix)",
  },
  {
    pattern: /\.d\.(?:ts|mts|cts)$/,
    reason: "type declarations, zero runtime",
  },
  {
    pattern: /\.config\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)$/,
    reason: "tool config wired into its tool, not application logic",
  },
  {
    pattern: /(?:^|[\\/])(?:dist|build|third_party)[\\/]/,
    reason: "build output or vendored tree, not edited by hand",
  },
  {
    pattern: /(?:^|[\\/])components[\\/]ui[\\/]/,
    reason: "shadcn/ui components copied from the registry",
  },
];

/** First-line escape hatch for a legitimately cohesive long file. */
const FILE_LENGTH_EXEMPT = /^\/\/\s*file-length-exempt:\s*(\S.*)$/;

/**
 * Match a file against the exempt list.
 * @param {string} file - repository-relative path
 * @returns {{reason: string}|null} matching entry or null
 */
function exemptEntry(file: string): { reason: string } | null {
  for (const entry of EXEMPT_PATHS) {
    if (entry.pattern.test(file)) {
      return entry;
    }
  }
  return null;
}

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
 * Whether a file is a barrel: named index.* and holding nothing but
 * `export` statements. Re-export boundaries are not monoliths; logic
 * hiding behind the name voids the exemption.
 * @param file - repository-relative path
 * @param content - file content
 * @returns true for a pure re-export barrel
 */
function isBarrel(file: string, content: string): boolean {
  const base = file.split(/[\\/]/).pop() ?? "";
  if (!/^index\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/.test(base)) {
    return false;
  }
  const statements = content.split("\n").filter((line) => line.trim() !== "");
  return statements.length > 0 && statements.every((line) => /^\s*export\s/.test(line));
}

/**
 * Anti-monolith check: TS/JS source files must not exceed MAX_LINES.
 * Test files (*.test.*, *.spec.*, tests/, __tests__/), generated or
 * vendored paths (EXEMPT_PATHS), barrel files and a first-line
 * `// file-length-exempt: <reason>` marker are exempt; every exemption
 * is reported with its reason.
 * @returns {void}
 */
function main(): void {
  const candidates = listFiles();

  const skippedTests: string[] = [];
  const exempted: { file: string; reason: string }[] = [];
  let missing = 0;
  let failed = 0;

  for (const file of candidates) {
    if (isTestFile(file)) {
      skippedTests.push(file);
      continue;
    }

    const pathExempt = exemptEntry(file);
    if (pathExempt) {
      exempted.push({ file, reason: pathExempt.reason });
      continue;
    }

    if (!existsSync(file)) {
      missing += 1;
      continue;
    }

    // A trailing newline terminates the last line; it is not an extra line.
    const content = readFileSync(file, "utf8");

    const marker = FILE_LENGTH_EXEMPT.exec(content.split("\n", 1)[0] ?? "");
    if (marker) {
      exempted.push({ file, reason: `file-length-exempt: ${marker[1]}` });
      continue;
    }

    if (isBarrel(file, content)) {
      exempted.push({ file, reason: "barrel file, re-exports only" });
      continue;
    }

    const lines = content.replace(/\r?\n$/, "").split("\n").length;

    if (lines > MAX_LINES) {
      console.error(`[FAIL] File '${file}' has ${lines} lines. Limit: ${MAX_LINES}.`);
      failed = 1;
    }
  }

  if (failed) {
    console.error("[Anti-Monolith] Commit rejected.");
    process.exit(1);
  }

  for (const { file, reason } of exempted) {
    process.stdout.write(`[OK] exempt: ${file} (${reason})\n`);
  }

  process.stdout.write(
    `[OK] Checked files: ${candidates.length - skippedTests.length - exempted.length - missing},` +
      ` tests skipped: ${skippedTests.length}, exempt skipped: ${exempted.length}.` +
      ` Limit: ${MAX_LINES} lines.\n`,
  );
}

main();
