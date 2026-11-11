#!/usr/bin/env node

/**
 * Verifies that every tool which walks the repository skips the same
 * workspace zones. A zone that ESLint skips but the compiler does not makes
 * `npm run typecheck` fail on a scratch file; a zone that Prettier skips but
 * `format:check` does not makes the formatting gate fail. The list lives in
 * `scripts/lib/workspace-zones.ts`, and this gate keeps every tool in sync
 * with it.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import type { ZoneTool } from "./lib/workspace-zones.ts";
import { checkZoneCoverage, mentionsZone, WORKSPACE_ZONES } from "./lib/workspace-zones.ts";

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
  eslintConfig: read("eslint.config.js"),
};

const tsconfigExclude = readTsconfigExclude();

const tools: ZoneTool[] = [
  { name: ".gitignore", ignores: (zone: string) => mentionsZone(files.gitignore, zone) },
  { name: ".prettierignore", ignores: (zone: string) => mentionsZone(files.prettierignore, zone) },
  { name: ".stylelintignore", ignores: (zone: string) => mentionsZone(files.stylelintignore, zone) },
  { name: "eslint.config.js", ignores: (zone: string) => mentionsZone(files.eslintConfig, zone) },
  { name: "tsconfig exclude", ignores: (zone: string) => tsconfigExclude.includes(zone) },
];

const failures = checkZoneCoverage(WORKSPACE_ZONES, tools);

if (failures.length > 0) {
  console.error("Workspace zone coverage failed:");
  for (const failure of failures) {
    console.error(`  ${failure.zone}: not ignored by ${failure.tools.join(", ")}`);
  }
  process.exit(1);
}

console.log(`Workspace zone coverage passed: all ${WORKSPACE_ZONES.length} zones are ignored by every tool.`);
