#!/usr/bin/env node

/**
 * Verifies that the IDE state matches the repository, on both shoulders of the
 * data flow `.idea/` -> `generated/ide-reference/` -> `%APPDATA%`:
 *
 * - `generated/ide-reference/` is fresh, that is byte-identical to what the
 *   generator would build from `.idea/` right now (run
 *   `npm run gen:ide-reference` after every edit of `.idea/`);
 * - the named schemes in `%APPDATA%/JetBrains/WebStorm<version>/` are byte
 *   identical to the generated reference;
 * - the pointers select exactly the repository scheme by value:
 *   `PREFERRED_SCHEME` and `PROJECT_PROFILE` in `options/project.default.xml`,
 *   the `profile` attribute of `DaemonCodeAnalyzerSettings` in
 *   `options/editor.xml`;
 * - the phantom `codestyles/codeStyleConfig.xml` is absent;
 * - the project files in `.idea/` are not modified against HEAD, so an IDE
 *   overwrite is caught before it reaches a commit.
 *
 * On a machine without the IDE (CI, a fresh clone) the machine checks are
 * skipped and only the repository checks run.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { BUILDERS, IDEA_SOURCES } from "./lib/ide-reference.ts";
import type { IdeStateFailure } from "./lib/ide-state.ts";
import {
  EDITOR_POINTER,
  findNewestWebStormDir,
  PHANTOM_FILE,
  readComponentAttribute,
  readOptionValue,
  SCHEME_FILE,
  SCHEME_GROUPS,
  SCHEME_NAME,
  SCHEME_POINTERS,
} from "./lib/ide-state.ts";

const root = process.argv[2] ?? process.cwd();
const REFERENCES_ROOT = join(root, "generated", "ide-reference");

/**
 * Read a file, or return null when it does not exist.
 * @param path - absolute file path
 * @returns file content, or null
 */
const readIfExists = (path: string): string | null => (existsSync(path) ? readFileSync(path, "utf8") : null);

/**
 * Check that the generated reference is fresh against the `.idea/` sources.
 * @returns list of mismatches
 */
const checkFreshness = (): IdeStateFailure[] => {
  const failures: IdeStateFailure[] = [];
  for (const group of SCHEME_GROUPS) {
    const sourcePath = join(root, IDEA_SOURCES[group]);
    const source = readIfExists(sourcePath);
    if (source === null) {
      failures.push({ file: sourcePath, problem: "source file is missing" });
      continue;
    }
    const generatedPath = join(REFERENCES_ROOT, group, SCHEME_FILE);
    const generated = readIfExists(generatedPath);
    if (generated === null) {
      failures.push({ file: generatedPath, problem: "reference file is missing; run npm run gen:ide-reference" });
      continue;
    }
    if (generated !== BUILDERS[group](source)) {
      failures.push({ file: generatedPath, problem: "stale against .idea/; run npm run gen:ide-reference" });
    }
  }
  return failures;
};

/**
 * Check the named schemes against the generated reference.
 * @param ideRoot - WebStorm config root
 * @returns list of mismatches
 */
const checkSchemes = (ideRoot: string): IdeStateFailure[] => {
  const failures: IdeStateFailure[] = [];
  for (const group of SCHEME_GROUPS) {
    const reference = join(REFERENCES_ROOT, group, SCHEME_FILE);
    const target = join(ideRoot, group, SCHEME_FILE);
    if (!existsSync(reference)) {
      failures.push({ file: reference, problem: "reference file is missing; run npm run gen:ide-reference" });
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
 * Build a failure for a pointer value that is missing or names another scheme.
 * @param file - absolute path of the file the pointer lives in
 * @param label - pointer description for the message
 * @param value - pointer value, or null when absent
 * @returns failure, or null when the pointer is correct
 */
const pointerFailure = (file: string, label: string, value: string | null): IdeStateFailure | null => {
  if (value === null) {
    return { file, problem: `${label} is missing; run npm run sync:ide` };
  }
  if (value !== SCHEME_NAME) {
    return { file, problem: `${label} is "${value}", expected "${SCHEME_NAME}"; run npm run sync:ide` };
  }
  return null;
};

/**
 * Check that every pointer selects exactly the repository scheme by value,
 * not merely an existing scheme: a valid "wrong" pointer is the drift that
 * leaves projects silently on stock settings.
 * @param ideRoot - WebStorm config root
 * @returns list of mismatches
 */
const checkPointers = (ideRoot: string): IdeStateFailure[] => {
  const failures: IdeStateFailure[] = [];
  for (const pointer of SCHEME_POINTERS) {
    const file = join(ideRoot, pointer.file);
    const content = readIfExists(file);
    if (content === null) {
      continue;
    }
    const failure = pointerFailure(file, pointer.option, readOptionValue(content, pointer.option));
    if (failure !== null) {
      failures.push(failure);
    }
  }
  const file = join(ideRoot, EDITOR_POINTER.file);
  const content = readIfExists(file);
  if (content !== null) {
    const label = `${EDITOR_POINTER.component} ${EDITOR_POINTER.attribute}`;
    const value = readComponentAttribute(content, EDITOR_POINTER.component, EDITOR_POINTER.attribute);
    const failure = pointerFailure(file, label, value);
    if (failure !== null) {
      failures.push(failure);
    }
  }
  return failures;
};

/**
 * Check that the phantom pointer file is absent from the machine.
 * @param ideRoot - WebStorm config root
 * @returns list of mismatches
 */
const checkPhantom = (ideRoot: string): IdeStateFailure[] => {
  const file = join(ideRoot, PHANTOM_FILE);
  return existsSync(file) ? [{ file, problem: "phantom pointer file; run npm run sync:ide to delete it" }] : [];
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

failures.push(...checkFreshness());

const base = join(process.env.APPDATA ?? "", "JetBrains");
if (existsSync(base)) {
  const ideRoot = findNewestWebStormDir(base, readdirSync(base));
  if (ideRoot !== null) {
    ideChecked = true;
    failures.push(...checkSchemes(ideRoot), ...checkPointers(ideRoot), ...checkPhantom(ideRoot));
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
  console.log(
    `[OK] IDE state matches the repository (scheme ${SCHEME_NAME}, references fresh, pointers, project files).`,
  );
} else {
  console.log("[OK] No JetBrains directory found; only the repository checks ran.");
}
