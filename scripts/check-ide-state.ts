#!/usr/bin/env node

/**
 * Verifies that the IDE state on this machine matches the repository:
 *
 * - the named schemes in `%APPDATA%/JetBrains/WebStorm<version>/` are byte
 *   identical to the references in `ide-reference/`;
 * - the pointers that select those schemes (`PREFERRED_SCHEME`,
 *   `PROJECT_PROFILE`, `PREFERRED_PROJECT_CODE_STYLE`) name a scheme that
 *   actually exists, so a stale pointer cannot make WebStorm overwrite
 *   `.idea/codeStyles/Project.xml` with an outdated global scheme;
 * - the project files in `.idea/` are not modified against HEAD, so an IDE
 *   overwrite is caught before it reaches a commit.
 *
 * On a machine without the IDE (CI, a fresh clone) the IDE checks are skipped
 * and only the repository checks run.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import type { IdeStateFailure } from "./lib/ide-state.ts";
import {
  findNewestWebStormDir,
  readOptionValue,
  SCHEME_FILE,
  SCHEME_GROUPS,
  SCHEME_NAME,
  SCHEME_POINTERS,
} from "./lib/ide-state.ts";

const REFERENCES_ROOT = fileURLToPath(new URL("../ide-reference/", import.meta.url));
const root = process.argv[2] ?? process.cwd();

/**
 * Read a file, or return null when it does not exist.
 * @param path - absolute file path
 * @returns file content, or null
 */
const readIfExists = (path: string): string | null => (existsSync(path) ? readFileSync(path, "utf8") : null);

/**
 * Check the named schemes against the repository references.
 * @param ideRoot - WebStorm config root
 * @returns list of mismatches
 */
const checkSchemes = (ideRoot: string): IdeStateFailure[] => {
  const failures: IdeStateFailure[] = [];
  for (const group of SCHEME_GROUPS) {
    const reference = join(REFERENCES_ROOT, group, SCHEME_FILE);
    const target = join(ideRoot, group, SCHEME_FILE);
    if (!existsSync(reference)) {
      failures.push({ file: reference, problem: "reference file is missing" });
      continue;
    }
    const expected = readFileSync(reference, "utf8");
    const actual = readIfExists(target);
    if (actual === null) {
      failures.push({ file: target, problem: "scheme file is missing; run npm run sync:ide" });
    } else if (actual !== expected) {
      failures.push({ file: target, problem: "differs from the reference; run npm run sync:ide" });
    }
  }
  return failures;
};

/**
 * Check that every pointer selects a scheme that exists.
 * @param ideRoot - WebStorm config root
 * @returns list of mismatches
 */
const checkPointers = (ideRoot: string): IdeStateFailure[] => {
  const failures: IdeStateFailure[] = [];
  for (const pointer of SCHEME_POINTERS) {
    const path = join(ideRoot, pointer.file);
    const content = readIfExists(path);
    if (content === null) {
      continue;
    }
    const value = readOptionValue(content, pointer.option);
    if (value === null) {
      continue;
    }
    const schemeFile = join(ideRoot, pointer.group, `${value}.xml`);
    if (!existsSync(schemeFile)) {
      failures.push({
        file: path,
        problem: `${pointer.option} points to "${value}", which does not exist in ${pointer.group}/`,
      });
    }
  }
  return failures;
};

/**
 * Check that the project files were not modified against HEAD.
 * @returns list of mismatches
 */
const checkProjectFiles = (): IdeStateFailure[] => {
  const failures: IdeStateFailure[] = [];
  const tracked = [".idea/codeStyles/Project.xml", ".idea/inspectionProfiles/Project_Default.xml"];
  let changed: string;
  try {
    changed = execFileSync("git", ["diff", "--name-only", "HEAD", "--", ...tracked], {
      cwd: root,
      encoding: "utf8",
    });
  } catch {
    return failures;
  }
  for (const file of changed.split("\n").filter((line) => line.trim() !== "")) {
    failures.push({
      file,
      problem: "modified against HEAD; WebStorm may have overwritten it - review with git diff",
    });
  }
  return failures;
};

const failures: IdeStateFailure[] = [];
let ideChecked = false;

const base = join(process.env.APPDATA ?? "", "JetBrains");
if (existsSync(base)) {
  const ideRoot = findNewestWebStormDir(base, readdirSync(base));
  if (ideRoot !== null) {
    ideChecked = true;
    failures.push(...checkSchemes(ideRoot), ...checkPointers(ideRoot));
  }
}

failures.push(...checkProjectFiles());

for (const failure of failures) {
  console.error(`[FAIL] ${failure.file}: ${failure.problem}`);
}

if (failures.length > 0) {
  process.exit(1);
}

if (ideChecked) {
  console.log(`[OK] IDE state matches the repository (scheme ${SCHEME_NAME}, pointers, project files).`);
} else {
  console.log("[OK] No JetBrains directory found; only the repository checks ran.");
}
