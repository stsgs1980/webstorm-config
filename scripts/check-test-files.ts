#!/usr/bin/env node

// Vitest exits with a generic "No test files found" when the suite is empty.
// That is correct (passWithNoTests stays off) but unhelpful for a fresh fork,
// so fail first with a message that names the fix.

import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import process from "node:process";

const ROOT = process.argv[2] ?? process.cwd();
const SRC_TEST = /\.(?:test|spec)\.(?:ts|tsx)$/;
const ALL_TEST = /\.(?:test|spec)\.(?:ts|tsx|mjs)$/;

/**
 * Collect test files below a directory, skipping hidden and dependency dirs.
 * @param dir - absolute directory to scan
 * @param pattern - test file name pattern
 * @returns repository-relative paths of matching files
 */
function collect(dir: string, pattern: RegExp): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collect(full, pattern));
    } else if (pattern.test(entry.name)) {
      found.push(relative(ROOT, full));
    }
  }
  return found;
}

const files = [...collect(join(ROOT, "src"), SRC_TEST), ...collect(join(ROOT, "tests"), ALL_TEST)];

if (files.length === 0) {
  console.error("[FAIL] No test files found.");
  console.error("Add at least one test, for example src/app.test.ts (Step 4 in docs/getting-started.md),");
  console.error("or keep the shipped tests/ directory. passWithNoTests is intentionally off.");
  process.exitCode = 1;
} else {
  process.stdout.write(`[OK] test files: ${files.length}\n`);
}
