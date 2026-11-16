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
 * - every tracked `.idea` file is unchanged against HEAD, so an IDE
 *   overwrite is caught before it reaches a commit.
 *
 * On a machine without the IDE (CI, a fresh clone) the machine checks are
 * skipped and only the repository checks run.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { pointerProblem } from "./lib/ide-pointers.ts";
import { BUILDERS, IDEA_SOURCES } from "./lib/ide-reference.ts";
import type { IdeStateFailure } from "./lib/ide-state.ts";
import {
  EDITOR_POINTER,
  findNewestWebStormDir,
  PHANTOM_FILE,
  resolveJetbrainsRoot,
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
 * Check that every pointer selects exactly the repository scheme by value,
 * not merely an existing scheme: a valid "wrong" pointer is the drift that
 * leaves projects silently on stock settings. A missing file is drift too.
 * @param ideRoot - WebStorm config root
 * @returns list of mismatches
 */
const checkPointers = (ideRoot: string): IdeStateFailure[] => {
  const failures: IdeStateFailure[] = [];
  for (const pointer of SCHEME_POINTERS) {
    const file = join(ideRoot, pointer.file);
    const problem = pointerProblem(readIfExists(file), pointer);
    if (problem !== null) {
      failures.push({ file, problem });
    }
  }
  const editorFile = join(ideRoot, EDITOR_POINTER.file);
  const editorProblem = pointerProblem(readIfExists(editorFile), EDITOR_POINTER);
  if (editorProblem !== null) {
    failures.push({ file: editorFile, problem: editorProblem });
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
 * Check every tracked `.idea` file, not a hand-kept shortlist. The tracked
 * set comes from `git ls-files`, so a project file added to the repository is
 * covered from that commit on. Three outcomes are distinct on purpose: a
 * missing `.git` is a documented skip (a source tarball has no baseline),
 * while a `.git` that git cannot read is a failure - silence there would
 * report green on a corrupt repository.
 * @returns failures, covered file count and whether the check was skipped
 */
const checkProjectFiles = (): { failures: IdeStateFailure[]; trackedCount: number; skipped: boolean } => {
  const gitDir = join(root, ".git");
  if (!existsSync(gitDir)) {
    console.log(`[SKIP] project files: ${root} is not a git work tree; the check did not run.`);
    return { failures: [], trackedCount: 0, skipped: true };
  }
  const git = (args: string[]): string => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  let tracked: string[];
  let changed: string;
  try {
    tracked = git(["ls-files", "--", ".idea"])
      .split("\n")
      .filter((line) => line.trim() !== "");
    changed = git(["status", "--porcelain", "--untracked-files=no", "--", ".idea"]);
  } catch (error) {
    const stderr = (error as { stderr?: string | Buffer }).stderr?.toString().trim();
    const detail = stderr === undefined || stderr === "" ? String(error) : stderr.split("\n")[0];
    return {
      failures: [
        { file: gitDir, problem: `git cannot read the repository (${detail}); the project-file check did not run` },
      ],
      trackedCount: 0,
      skipped: false,
    };
  }
  const failures: IdeStateFailure[] = changed
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const entry = line.slice(3);
      const file = entry.includes(" -> ") ? entry.slice(entry.indexOf(" -> ") + 4) : entry;
      return { file, problem: "changed against HEAD; WebStorm may have overwritten it - review with git status" };
    });
  return { failures, trackedCount: tracked.length, skipped: false };
};

const failures: IdeStateFailure[] = [];
let ideChecked = false;

failures.push(...checkFreshness());

const projectFiles = checkProjectFiles();
failures.push(...projectFiles.failures);

let base = "";
try {
  base = resolveJetbrainsRoot(process.env, process.platform);
} catch (error) {
  console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
if (existsSync(base)) {
  const ideRoot = findNewestWebStormDir(base, readdirSync(base));
  if (ideRoot !== null) {
    ideChecked = true;
    failures.push(...checkSchemes(ideRoot), ...checkPointers(ideRoot), ...checkPhantom(ideRoot));
  }
}

for (const failure of failures) {
  console.error(`[FAIL] ${failure.file}: ${failure.problem}`);
}

if (failures.length > 0) {
  process.exit(1);
}

const projectSummary = projectFiles.skipped
  ? "project-file check skipped"
  : `${projectFiles.trackedCount} tracked .idea files`;

if (ideChecked) {
  console.log(
    `[OK] IDE state matches the repository (scheme ${SCHEME_NAME}, references fresh, pointers, ${projectSummary}).`,
  );
} else {
  console.log(`[OK] No JetBrains directory found; repository checks ran (${projectSummary}).`);
}
