/**
 * Pure logic for the changed-file coverage gate: which changed paths are
 * measured, how `coverage-summary.json` maps to repository paths, and whether
 * every measured file reaches the line threshold. The CLI owns git and Vitest.
 */

/** Extensions the v8 provider instruments. */
const SOURCE_FILE = /\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)$/;

/** Declarations have no runtime lines; measuring them reports a false zero. */
const DECLARATION_FILE = /\.d\.(?:ts|mts|cts)$/;

/** Tests are the instrument, not the target: their coverage is not gated. */
const TEST_FILE = /\.(?:test|spec)\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)$/;

/** One file entry of `coverage-summary.json`; `total` uses the same shape. */
interface SummaryEntry {
  /** Line counters; absent only in a malformed report. */
  lines?: { pct?: number };
}

/** Selection of changed paths for the gate. */
export interface MeasuredSelection {
  /** Paths inside the coverage scope that the gate evaluates. */
  measured: string[];
  /** Paths outside the scope: docs, scripts, configs, tests, declarations. */
  skipped: string[];
}

/** Result of comparing measured files with the report. */
export interface CoverageEvaluation {
  /** Files at or above the threshold. */
  passed: { file: string; pct: number }[];
  /** One `[FAIL]` line per file with no data or too few covered lines. */
  failures: string[];
}

/**
 * Normalize a filesystem path to the forward-slash form git prints.
 * @param file - path from git or from the coverage report
 * @returns path with `/` separators
 */
export function normalizePath(file: string): string {
  return file.replaceAll("\\", "/");
}

/**
 * Strip the repository root from an absolute coverage path.
 * @param file - absolute path from the report
 * @param root - repository root as git prints it
 * @returns repository-relative path
 */
export function toRepoRelative(file: string, root: string): string {
  const path = normalizePath(file);
  const prefix = `${normalizePath(root).replace(/\/$/, "")}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

/**
 * Whether a changed path belongs to the measured scope.
 * @param file - repository-relative path
 * @param roots - coverage roots
 * @returns true when the gate must evaluate the file
 */
export function isMeasuredPath(file: string, roots: string[]): boolean {
  const path = normalizePath(file);
  if (!SOURCE_FILE.test(path) || DECLARATION_FILE.test(path) || TEST_FILE.test(path)) {
    return false;
  }
  return roots.some((root) => path.startsWith(`${normalizePath(root)}/`));
}

/**
 * Split changed paths into measured and skipped.
 * @param changed - repository-relative paths from `git diff --name-only`
 * @param roots - coverage roots
 * @returns measured paths and skipped paths, in input order
 */
export function selectMeasured(changed: string[], roots: string[]): MeasuredSelection {
  const measured: string[] = [];
  const skipped: string[] = [];

  for (const file of changed) {
    if (isMeasuredPath(file, roots)) {
      measured.push(normalizePath(file));
    } else {
      skipped.push(file);
    }
  }

  return { measured, skipped };
}

/**
 * Read per-file line percentages from a Vitest coverage summary. Report keys
 * are absolute paths; the gate compares repository-relative ones.
 * @param json - raw `coverage-summary.json`
 * @param root - repository root as git prints it
 * @returns repository-relative path to line percentage; `total` is dropped
 * @throws when the JSON is malformed or lacks the `total` entry
 */
export function parseCoverageSummary(json: string, root: string): Map<string, number> {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null || !("total" in parsed)) {
    throw new Error("coverage-summary.json has no 'total' entry; the report is malformed.");
  }

  const summary = new Map<string, number>();
  for (const [file, entry] of Object.entries(parsed as Record<string, SummaryEntry>)) {
    if (file === "total") {
      continue;
    }
    const pct = entry.lines?.pct;
    if (typeof pct === "number") {
      summary.set(toRepoRelative(file, root), pct);
    }
  }

  return summary;
}

/**
 * Whether a base ref is the all-zero placeholder git sends for a new branch.
 * @param value - candidate base ref
 * @returns true for an empty string or forty zeroes
 */
export function isZeroSha(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "" || /^0{40}$/.test(trimmed);
}

/**
 * Format a percentage without a trailing `.0`.
 * @param pct - percentage from the report
 * @returns display string
 */
const formatPct = (pct: number): string => (Number.isInteger(pct) ? String(pct) : pct.toFixed(1));

/**
 * Compare measured files with the report. A file missing from the report is a
 * failure, not a skip: no related test loaded it, so its changed lines are
 * unverified.
 * @param measured - repository-relative paths in scope
 * @param summary - parsed report
 * @param threshold - minimum percentage of covered lines
 * @returns passed files and one failure line per rejected file
 */
export function evaluateCoverage(
  measured: string[],
  summary: Map<string, number>,
  threshold: number,
): CoverageEvaluation {
  const passed: { file: string; pct: number }[] = [];
  const failures: string[] = [];

  for (const file of measured) {
    const pct = summary.get(file);
    if (pct === undefined) {
      failures.push(`[FAIL] ${file}: no coverage data - no related test loaded it (0% of lines).`);
      continue;
    }
    if (pct < threshold) {
      failures.push(`[FAIL] ${file}: ${formatPct(pct)}% of lines, below ${threshold}%.`);
      continue;
    }
    passed.push({ file, pct });
  }

  return { passed, failures };
}
