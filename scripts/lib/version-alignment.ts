/**
 * Node.js version alignment between .nvmrc and package.json engines.node.
 * Shared by doc/config verifiers that must report drift, not guess it.
 */

/** Strict x.y.z version, as required inside .nvmrc. */
export const EXACT_VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

/** First x.y.z version found in a range, e.g. engines.node. */
export const VERSION_PATTERN = /(\d+)\.(\d+)\.(\d+)/;

/**
 * Compare two x.y.z version strings numerically.
 * @param {string} a - left version
 * @param {string} b - right version
 * @returns {number} negative when a < b, zero when equal, positive when a > b
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);

  for (let i = 0; i < 3; i += 1) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;

    if (da !== db) {
      return da - db;
    }
  }

  return 0;
}

/**
 * Check that the .nvmrc version satisfies engines.node.
 * @param {string | undefined} nvmRaw - raw .nvmrc content, if the file exists
 * @param {string | undefined} enginesNode - engines field value from package.json, when set
 * @param {string[]} failures - collector for error lines
 * @returns {string | undefined} min version extracted from the engines field, when parseable
 */
export function checkVersionAlignment(
  nvmRaw: string | undefined,
  enginesNode: string | undefined,
  failures: string[],
): string | undefined {
  const nvmVersion = nvmRaw === undefined ? undefined : EXACT_VERSION_PATTERN.exec(nvmRaw)?.[0];
  const engineMin = enginesNode === undefined ? undefined : VERSION_PATTERN.exec(enginesNode)?.[0];
  if (nvmRaw === undefined) {
    failures.push("[FAIL] .nvmrc not found.");
  } else if (nvmVersion === undefined) {
    failures.push("[FAIL] Cannot parse version from .nvmrc.");
  }
  if (enginesNode === undefined) {
    failures.push("[FAIL] engines.node is not set in package.json.");
  } else if (engineMin === undefined) {
    failures.push("[FAIL] Cannot parse version from engines.node.");
  }
  if (nvmVersion !== undefined && engineMin !== undefined && compareVersions(nvmVersion, engineMin) < 0) {
    failures.push(`[FAIL] .nvmrc ${nvmVersion} does not satisfy engines.node ${enginesNode}.`);
  }
  return engineMin;
}
