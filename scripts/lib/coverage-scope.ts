/**
 * Scope and threshold of the changed-file coverage gate, single owner.
 * `vitest.config.ts` imports the include list, so the coverage report and the
 * gate measure the same files; a fork with application code adds `src/**`
 * here once instead of editing two lists.
 */

/** Coverage include globs; every entry is a `dir/**` pattern. */
export const COVERAGE_INCLUDE = ["eslint-rules/**", "eslint-parsers/**", "eslint-processors/**", "tests/lib/**"];

/** Minimum covered-line share for every changed file in scope. */
export const MIN_CHANGED_LINE_COVERAGE = 80;

/**
 * Turn an include glob into the directory the gate filters changed files
 * against. The include list is the owner: the gate must not carry a copy.
 * @param glob - include entry
 * @returns repository-relative directory without the glob suffix
 */
export function includeRoot(glob: string): string {
  if (!glob.endsWith("/**")) {
    throw new Error(`Coverage include '${glob}' must be a 'dir/**' pattern so the gate can filter changed files.`);
  }
  return glob.slice(0, -3);
}

/** Directories derived from the include list, in the same order. */
export const COVERAGE_ROOTS = COVERAGE_INCLUDE.map(includeRoot);
