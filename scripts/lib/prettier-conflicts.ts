/**
 * Representative set for the Prettier conflict gate. The
 * eslint-config-prettier CLI inspects only the files it is given, so the set
 * lives here: one path per zone of `eslint.config.js`. Every representative
 * must resolve to a config with enabled rules - a stale path or a changed
 * `files` pattern makes ESLint fall back to an empty config, and the CLI
 * would then report green while checking nothing.
 */

import { join } from "node:path";
// noinspection NpmUsedModulesInstalled
import type { ESLint, Linter } from "eslint";

/** One representative path per `eslint.config.js` zone. */
export interface PrettierConflictTarget {
  /** Path or virtual path handed to ESLint and to the CLI. */
  path: string;
  /** Zone of the flat config this path selects. */
  zone: string;
}

/**
 * One representative per zone. Paths under `.md/` are virtual filenames the
 * Markdown processor emits, so no such file exists on disk;
 * `calculateConfigForFile` selects the zone by pattern all the same.
 */
export const PRETTIER_CONFLICT_TARGETS: readonly PrettierConflictTarget[] = [
  { path: "eslint.config.js", zone: "root flat config" },
  { path: "eslint.metrics.config.js", zone: "metrics lane" },
  { path: "scripts/check-docs.ts", zone: "tooling TypeScript" },
  { path: "tests/check-docs.test.mjs", zone: "tooling tests" },
  { path: "server/app.ts", zone: "server TypeScript" },
  { path: "src/App.tsx", zone: "browser TSX" },
  { path: "docs/testing.md", zone: "Markdown file" },
  { path: "docs/testing.md/0_0.ts", zone: "Markdown TypeScript snippet" },
  { path: "docs/testing.md/0_0.bash", zone: "Markdown plain-text snippet" },
];

/** The eslint-config-prettier CLI, relative to the repository root. */
export const PRETTIER_CONFLICT_CLI = join("node_modules", "eslint-config-prettier", "bin", "cli.js");

/**
 * Whether a configured rule entry is enabled.
 * @param value - rule entry from a flat config
 * @returns true unless the entry is off
 */
export function isRuleEnabled(value: unknown): boolean {
  const level = Array.isArray(value) ? value[0] : value;
  return level !== "off" && level !== 0;
}

/**
 * Find representatives whose resolved config enables no rules at all.
 * @param eslint - ESLint instance pointed at the repository config
 * @returns one `path (zone)` entry per uncovered representative
 */
export async function findUnresolvedTargets(eslint: ESLint): Promise<string[]> {
  const unresolved: string[] = [];
  for (const { path, zone } of PRETTIER_CONFLICT_TARGETS) {
    const config: Linter.Config | undefined = await eslint.calculateConfigForFile(path);
    if (config === undefined || !Object.values(config.rules ?? {}).some(isRuleEnabled)) {
      unresolved.push(`${path} (${zone})`);
    }
  }
  return unresolved;
}
