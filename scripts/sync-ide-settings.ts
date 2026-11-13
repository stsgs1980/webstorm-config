#!/usr/bin/env node

/**
 * Deploy the repository IDE settings to `%APPDATA%\JetBrains\WebStorm<version>\`:
 *
 * - restore the named scheme files (`codestyles/`, `inspection/`) from
 *   `generated/ide-reference/` - the copies WebStorm and its Settings Sync can
 *   overwrite;
 * - write the scheme pointers so the machine selects exactly that scheme:
 *   `PREFERRED_SCHEME` and `PROJECT_PROFILE` in `options/project.default.xml`
 *   and the `profile` attribute of `DaemonCodeAnalyzerSettings` in
 *   `options/editor.xml`. Restoring bytes without pointers was the blind spot
 *   that left projects silently on stock settings;
 * - delete the phantom `codestyles/codeStyleConfig.xml`, which re-points new
 *   projects at the global scheme.
 *
 * The payload source is verified fresh against `.idea/` first; a stale
 * `generated/ide-reference/` aborts the run - regenerate it with
 * `npm run gen:ide-reference`.
 *
 * Usage:
 *   node scripts/sync-ide-settings.ts          apply (default)
 *   node scripts/sync-ide-settings.ts --check  report differences, exit 1
 *   --jetbrains-root <dir>                     override %APPDATA%\JetBrains
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { syncPointers } from "./lib/ide-pointers.ts";
import { BUILDERS, IDEA_SOURCES } from "./lib/ide-reference.ts";
import { findNewestWebStormDir, PHANTOM_FILE, SCHEME_FILE, SCHEME_GROUPS } from "./lib/ide-state.ts";

/** Repository root, for reading the `.idea/` sources. */
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Directory holding exact copies of the machine scheme files. */
const REFERENCES_ROOT = fileURLToPath(new URL("../generated/ide-reference/", import.meta.url));

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
 * Verify that the generated reference matches what `.idea/` builds right now.
 * @returns null when fresh, otherwise the problem description
 */
const referenceProblem = (): string | null => {
  for (const group of SCHEME_GROUPS) {
    const sourcePath = join(REPO_ROOT, IDEA_SOURCES[group]);
    if (!existsSync(sourcePath)) {
      return `source file is missing: ${sourcePath}`;
    }
    const referencePath = join(REFERENCES_ROOT, group, SCHEME_FILE);
    if (!existsSync(referencePath)) {
      return `reference file is missing: ${referencePath} (run npm run gen:ide-reference)`;
    }
    const expected = BUILDERS[group](readFileSync(sourcePath, "utf8"));
    if (readFileSync(referencePath, "utf8") !== expected) {
      return `reference file is stale: ${referencePath} (run npm run gen:ide-reference)`;
    }
  }
  return null;
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
    const reference = readFileSync(join(REFERENCES_ROOT, group, SCHEME_FILE));
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

/**
 * Delete the phantom pointer file that re-points new projects at the global scheme.
 * @param ideRoot - WebStorm config root
 * @param check - when true, report without writing
 * @returns 1 when the phantom is present, otherwise 0
 */
const syncPhantom = (ideRoot: string, check: boolean): number => {
  const file = join(ideRoot, PHANTOM_FILE);
  if (!existsSync(file)) {
    return 0;
  }
  if (check) {
    console.log(`[FAIL] ${file} phantom pointer file; run npm run sync:ide to delete`);
    return 1;
  }
  rmSync(file);
  console.log(`[OK] deleted phantom ${file}`);
  return 1;
};

const main = (): number => {
  const { check, jetbrainsRoot } = parseArgs(process.argv.slice(2));
  const base = jetbrainsRoot ?? join(process.env.APPDATA ?? "", "JetBrains");
  try {
    const stale = referenceProblem();
    if (stale !== null) {
      console.error(`[FAIL] ${stale}`);
      return 1;
    }
    if (!existsSync(base)) {
      console.error(`[FAIL] JetBrains config directory not found: ${base} (set APPDATA or --jetbrains-root)`);
      return 1;
    }
    const ideRoot = findNewestWebStormDir(base, readdirSync(base));
    if (ideRoot === null) {
      console.error(`[FAIL] no WebStorm* config directory under ${base}`);
      return 1;
    }
    const mismatches = syncFiles(ideRoot, check) + syncPointers(ideRoot, check) + syncPhantom(ideRoot, check);
    return check && mismatches > 0 ? 1 : 0;
  } catch (error) {
    console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
};

process.exit(main());
