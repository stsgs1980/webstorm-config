#!/usr/bin/env node

// noinspection SpellCheckingInspection

/**
 * Verifies that every tool which walks the repository skips the same
 * workspace zones. A zone that ESLint skips but the compiler does not make
 * `npm run typecheck` fail on a scratch file; a zone that Prettier skips but
 * `format:check` does not make the formatting gate fail. The list lives in
 * `scripts/lib/workspace-zones.ts`, and this gate keeps every tool in sync
 * with it.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import type { ZoneCandidateSource, ZoneTool } from "./lib/workspace-zones.ts";
import {
  checkExtraZoneMentions,
  checkLintStagedPatterns,
  checkVitestIncludeRooting,
  checkZoneCoverage,
  mentionsZone,
  WORKSPACE_ZONES,
} from "./lib/workspace-zones.ts";

const root = process.argv[2] ?? process.cwd();

/**
 * Read a repo file, or an empty string when it does not exist.
 * @param relativePath - repo-relative path
 * @returns file content
 */
const read = (relativePath: string): string => {
  const path = join(root, relativePath);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
};

/**
 * Read the `exclude` list of the base tsconfig. The file carries comments,
 * so it is JSONC and plain JSON.parse cannot read it.
 * @returns excluded directory names
 */
const readTsconfigExclude = (): string[] => {
  const content = read("tsconfig.base.json");
  const withoutComments = content.replace(/^\s*\/\/.*$/gm, "");
  try {
    const parsed: unknown = JSON.parse(withoutComments);
    const exclude = (parsed as { exclude?: unknown }).exclude;
    return Array.isArray(exclude) ? (exclude as string[]) : [];
  } catch {
    return [];
  }
};

const files = {
  gitignore: read(".gitignore"),
  prettierignore: read(".prettierignore"),
  stylelintignore: read(".stylelintignore"),
  markdownlintignore: read(".markdownlintignore"),
  eslintConfig: read("eslint.config.js"),
  metricsConfig: read("eslint.metrics.config.js"),
  vitestConfig: read("vitest.config.ts"),
  packageJson: read("package.json"),
};

const tsconfigExclude = readTsconfigExclude();

/**
 * Read the lint-staged block from package.json. A missing or broken block is
 * a failure, not a skip: without it the staged-pattern check would pass over
 * an empty object.
 * @returns pattern-to-command map
 */
const readLintStaged = (): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(files.packageJson);
    const config = (parsed as { "lint-staged"?: unknown })["lint-staged"];
    if (typeof config === "object" && config !== null) {
      return config as Record<string, unknown>;
    }
  } catch (error) {
    console.error(`Workspace zone gate cannot parse package.json: ${String(error)}`);
    process.exit(1);
  }
  console.error("Workspace zone gate found no lint-staged block in package.json.");
  process.exit(1);
};

const tools: ZoneTool[] = [
  { name: ".gitignore", ignores: (zone: string) => mentionsZone(files.gitignore, zone) },
  { name: ".prettierignore", ignores: (zone: string) => mentionsZone(files.prettierignore, zone) },
  { name: ".stylelintignore", ignores: (zone: string) => mentionsZone(files.stylelintignore, zone) },
  { name: ".markdownlintignore", ignores: (zone: string) => mentionsZone(files.markdownlintignore, zone) },
  { name: "eslint.config.js", ignores: (zone: string) => mentionsZone(files.eslintConfig, zone) },
  { name: "eslint.metrics.config.js", ignores: (zone: string) => mentionsZone(files.metricsConfig, zone) },
  { name: "tsconfig exclude", ignores: (zone: string) => tsconfigExclude.includes(zone) },
];

/**
 * Every list the two-way check reads. The direction matters: `tools` proves a
 * zone the owner declares is skipped everywhere, `sources` proves a list does
 * not invent a directory the owner never declared.
 */
const sources: ZoneCandidateSource[] = [
  { name: ".gitignore", kind: "ignoreFile", content: files.gitignore },
  { name: ".prettierignore", kind: "ignoreFile", content: files.prettierignore },
  { name: ".stylelintignore", kind: "ignoreFile", content: files.stylelintignore },
  { name: ".markdownlintignore", kind: "ignoreFile", content: files.markdownlintignore },
  { name: "eslint.config.js", kind: "globList", marker: "ignores: [", content: files.eslintConfig },
  { name: "eslint.metrics.config.js", kind: "globList", marker: "const EXEMPT = [", content: files.metricsConfig },
  { name: "tsconfig exclude", kind: "nameList", content: JSON.stringify(tsconfigExclude) },
];

const coverageFailures = checkZoneCoverage(WORKSPACE_ZONES, tools);
const extraFailures = checkExtraZoneMentions(WORKSPACE_ZONES, sources);
const vitestFailures = checkVitestIncludeRooting(files.vitestConfig);
const lintStagedFailures = checkLintStagedPatterns(readLintStaged(), WORKSPACE_ZONES);

if (coverageFailures.length > 0) {
  console.error("Workspace zone coverage failed:");
  for (const failure of coverageFailures) {
    console.error(`  ${failure.zone}: not ignored by ${failure.tools.join(", ")}`);
  }
}

if (extraFailures.length > 0) {
  console.error("Workspace zone list drift:");
  for (const failure of extraFailures) {
    console.error(`  ${failure.token}: mentioned by ${failure.tool} but absent from the zone list`);
  }
}

if (vitestFailures.length > 0) {
  console.error("Vitest include failed:");
  for (const failure of vitestFailures) {
    console.error(`  ${failure}`);
  }
}

if (lintStagedFailures.length > 0) {
  console.error("Lint-staged zone coverage failed:");
  for (const failure of lintStagedFailures) {
    console.error(`  lint-staged pattern "${failure.pattern}" covers zone ${failure.zone}`);
  }
}

if (
  coverageFailures.length > 0 ||
  extraFailures.length > 0 ||
  vitestFailures.length > 0 ||
  lintStagedFailures.length > 0
) {
  process.exit(1);
}

console.log(`Workspace zone coverage passed: all ${WORKSPACE_ZONES.length} zones are ignored by every tool.`);
