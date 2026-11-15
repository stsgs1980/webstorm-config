/**
 * Anti-monolith thresholds, single owner (AGENTS.md Section 4). Gates and
 * lint lanes import these instead of restating literals, so the numbers
 * cannot drift apart (precedent: tsconfig.base.json owns strictness flags).
 * The JetBrains inspection profile `.idea/inspectionProfiles/Project_Default.xml`
 * carries an IDE-side mirror of the file-length and complexity values; it
 * cannot import this module, so update it in the same change.
 */

/** Hard gate: maximum lines in a hand-edited TS/JS source file. */
export const MAX_FILE_LINES = 250;

/** Advisory: maximum lines in a function or hook, comments and blanks excluded. */
export const MAX_FUNCTION_LINES = 60;

/** Advisory: maximum cyclomatic complexity of a function. */
export const MAX_COMPLEXITY = 15;

/** Advisory: maximum number of function parameters. */
export const MAX_PARAMS = 4;

/** Advisory: maximum block nesting depth inside a function. */
export const MAX_NESTING_DEPTH = 4;
