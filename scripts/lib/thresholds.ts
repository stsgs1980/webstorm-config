/**
 * Anti-monolith thresholds, single owner (AGENTS.md Section 4). Gates and
 * lint lanes import these instead of restating literals, so the numbers
 * cannot drift apart (precedent: tsconfig.base.json owns strictness flags).
 * The JetBrains inspection profile `.idea/inspectionProfiles/Project_Default.xml`
 * carries an IDE-side mirror of every value; it cannot import this module, so
 * `npm run check:style-consistency` compares the profile with this file
 * (`scripts/lib/inspection-profile.ts`).
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

/** IDE-only: maximum methods per class (JetBrains MethodCount); no gate. */
export const MAX_METHODS_PER_CLASS = 25;

/** IDE-only: maximum statements per function (JetBrains StatementsPerFunctionJS); no gate. */
export const MAX_STATEMENTS_PER_FUNCTION = 30;
