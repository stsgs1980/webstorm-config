#!/usr/bin/env node

/**
 * Restore the IDE-level `webstorm-config` code style scheme and inspection
 * profile from the exact copies kept in `ide-reference/`.
 *
 * WebStorm (and its Settings Sync) can overwrite the files under
 * `%APPDATA%\JetBrains\WebStorm<version>\`. This script compares them with
 * the repository references and restores the canonical bytes.
 *
 * Usage:
 *   node scripts/sync-ide-settings.ts          restore files (default)
 *   node scripts/sync-ide-settings.ts --check  report differences, exit 1
 *   --jetbrains-root <dir>                     override %APPDATA%\JetBrains
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

/** Directory in the repository holding exact copies of the IDE files. */
const REFERENCES_ROOT = new URL("../ide-reference/", import.meta.url);

/** IDE config sub-directories mirrored under ide-reference/. */
const GROUPS = ["codestyles", "inspection"];

/** File name of the scheme/profile inside each group directory. */
const FILE_NAME = "webstorm-config.xml";

/**
 * Parse command line arguments.
 * @param argv - raw arguments after the script path
 * @returns check mode flag and optional JetBrains base directory
 */
const parseArgs = (argv: string[]): { check: boolean; jetbrainsRoot: string | null } => {
  const rootIndex = argv.indexOf("--jetbrains-root");
  const rootValue = rootIndex >= 0 ? argv[rootIndex + 1] : undefined;
  return {
    check: argv.includes("--check"),
    jetbrainsRoot: typeof rootValue === "string" && rootValue.length > 0 ? rootValue : null,
  };
};

/**
 * Numeric version parts of a WebStorm directory name ("WebStorm2026.3" -> [2026, 3]).
 * @param name - directory name
 * @returns numeric parts, non-numeric chunks count as 0
 */
const versionParts = (name: string): number[] =>
  name
    .replace(/^WebStorm/i, "")
    .split(".")
    .map((chunk) => Number.parseInt(chunk, 10) || 0);

/**
 * Compare WebStorm version directories numerically, so 2026.10 beats 2026.3.
 * @param a - first directory name
 * @param b - second directory name
 * @returns true when a is newer than b
 */
const isNewer = (a: string, b: string): boolean => {
  const left = versionParts(a);
  const right = versionParts(b);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const aPart = left[index] ?? 0;
    const bPart = right[index] ?? 0;
    if (aPart !== bPart) {
      return aPart > bPart;
    }
  }
  return false;
};

/**
 * Find the newest WebStorm config directory under the base directory.
 * @param base - JetBrains settings base directory
 * @returns path to the newest WebStorm* directory, or null when none exists
 */
const findNewestWebStormDir = (base: string): string | null => {
  let newest: string | null = null;
  for (const entry of readdirSync(base)) {
    if (!/^WebStorm\d/i.test(entry)) {
      continue;
    }
    if (newest === null || isNewer(entry, newest)) {
      newest = entry;
    }
  }
  return newest === null ? null : join(base, newest);
};

/**
 * Restore every reference file when it differs from the IDE copy.
 * @param ideRoot - WebStorm config root (contains codestyles/, inspection/)
 * @param check - when true, report differences without writing
 * @returns number of files that differ from the reference
 */
const syncFiles = (ideRoot: string, check: boolean): number => {
  let mismatches = 0;
  for (const group of GROUPS) {
    const reference = readFileSync(fileURLToPath(new URL(`${group}/${FILE_NAME}`, REFERENCES_ROOT)));
    const target = join(ideRoot, group, FILE_NAME);
    if (existsSync(target) && reference.equals(readFileSync(target))) {
      console.log(`[OK] ${target} matches the reference`);
      continue;
    }
    mismatches += 1;
    if (check) {
      console.log(`[FAIL] ${target} differs from the reference; run npm run sync:ide to restore`);
      continue;
    }
    mkdirSync(join(ideRoot, group), { recursive: true });
    writeFileSync(target, reference);
    console.log(`[OK] restored ${target}`);
  }
  return mismatches;
};

const main = (): number => {
  const { check, jetbrainsRoot } = parseArgs(process.argv.slice(2));
  const base = jetbrainsRoot ?? join(process.env.APPDATA ?? "", "JetBrains");
  try {
    if (!existsSync(base)) {
      console.error(`[FAIL] JetBrains config directory not found: ${base} (set APPDATA or --jetbrains-root)`);
      return 1;
    }
    const ideRoot = findNewestWebStormDir(base);
    if (ideRoot === null) {
      console.error(`[FAIL] no WebStorm* config directory under ${base}`);
      return 1;
    }
    const mismatches = syncFiles(ideRoot, check);
    return check && mismatches > 0 ? 1 : 0;
  } catch (error) {
    console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
};

process.exit(main());
