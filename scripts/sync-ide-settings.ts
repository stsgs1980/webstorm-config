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
import { findNewestWebStormDir, SCHEME_FILE, SCHEME_GROUPS } from "./lib/ide-state.ts";

/** Directory in the repository holding exact copies of the IDE files. */
const REFERENCES_ROOT = new URL("../ide-reference/", import.meta.url);

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
 * Restore every reference file when it differs from the IDE copy.
 * @param ideRoot - WebStorm config root (contains codestyles/, inspection/)
 * @param check - when true, report differences without writing
 * @returns number of files that differ from the reference
 */
const syncFiles = (ideRoot: string, check: boolean): number => {
  let mismatches = 0;
  for (const group of SCHEME_GROUPS) {
    const reference = readFileSync(fileURLToPath(new URL(`${group}/${SCHEME_FILE}`, REFERENCES_ROOT)));
    const target = join(ideRoot, group, SCHEME_FILE);
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
    const ideRoot = findNewestWebStormDir(base, readdirSync(base));
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
