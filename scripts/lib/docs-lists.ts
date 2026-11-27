/**
 * List checks for the docs gate: the docs map in README.md against the
 * docs/ tree, README badges against package.json majors, and the migration
 * install list against package.json and the packages the configs import.
 * Pure logic over given texts; the CLI script owns reading and output.
 */

// noinspection GrazieInspection,GrazieStyle

import { existsSync, readFileSync } from "node:fs";

/** A tool-version badge: name, N.x value and the link target. */
const BADGE_PATTERN =
  /\[!\[(ESLint|TypeScript|Stylelint)]\(https:\/\/img\.shields\.io\/badge\/\1-(\d+)\.x[^)]*\)]\(([^)]+)\)/g;

/** Opt-in marker: README.md claims to hold the docs map. */
export const DOCS_MAP_MARKER = "<!-- check-docs:docs-map -->";

/**
 * Check tool badges against package.json majors. A present badge must carry
 * the actual major; the template README must carry all three badges.
 * @param entries - README files as name/content pairs
 * @param deps - merged dependencies of package.json
 * @param failures - collector for error lines
 */
export function checkBadges(
  entries: { file: string; text: string }[],
  deps: Record<string, string>,
  failures: string[],
): void {
  const present = new Map<string, Set<string>>();

  for (const entry of entries) {
    const badges = new Set<string>();

    for (const match of entry.text.matchAll(BADGE_PATTERN)) {
      const tool = match[1];
      badges.add(tool);
      const digits = /^\^?\d+/.exec(deps[tool.toLowerCase()] ?? "");
      const major = digits ? digits[0].replace("^", "") : "";
      if (major !== "" && match[2] !== major) {
        failures.push(`[FAIL] ${entry.file} ${tool} badge says ${match[2]}.x, package.json has ${major}.x.`);
      }
      if (tool === "TypeScript" && !match[3].includes("typescriptlang.org")) {
        failures.push(`[FAIL] ${entry.file} TypeScript badge must link typescriptlang.org.`);
      }
    }

    present.set(entry.file, badges);
  }

  const template = present.get("README.template.md");
  for (const tool of ["ESLint", "TypeScript", "Stylelint"]) {
    if (template && !template.has(tool)) {
      failures.push(`[FAIL] README.template.md misses the ${tool} badge.`);
    }
  }
}

/**
 * Check that the README docs map links every docs/ Markdown file.
 * @param readmeText - README.md content (assumes the docs-map marker opt-in)
 * @param docFiles - Markdown files of the docs/ tree, recursive
 * @param failures - collector for error lines
 */
export function checkDocsMap(readmeText: string, docFiles: string[], failures: string[]): void {
  const linked = new Set<string>();

  for (const match of readmeText.matchAll(/]\((docs\/[^)\s#]+\.md)\)/g)) {
    linked.add(match[1]);
  }

  for (const file of docFiles.filter((candidate) => !linked.has(candidate))) {
    failures.push(`[FAIL] README.md docs map misses ${file}.`);
  }
}

/**
 * Extract the migration install section of docs/getting-started.md.
 * @param text - file content
 * @returns the section under "### 2. Установите devDependencies"
 */
function migrationSection(text: string): string {
  const start = text.indexOf("### 2. Установите devDependencies");
  if (start === -1) {
    return "";
  }
  const next = text.indexOf("\n### ", start + 1);
  return next === -1 ? text.slice(start) : text.slice(start, next);
}

/**
 * Collect the package names of the section's `npm install` commands,
 * following backslash line continuations.
 * @param section - migration install section text
 * @returns package names in command order
 */
function installPackages(section: string): string[] {
  const packages: string[] = [];
  const lines = section.split("\n");

  for (let i = 0; i < lines.length; i += 1) {
    if (!/^npm install /.test(lines[i])) {
      continue;
    }
    let command = lines[i];
    while (command.trimEnd().endsWith("\\")) {
      i += 1;
      command += ` ${lines[i] ?? ""}`;
    }
    for (const token of command.split(/\s+/)) {
      if (token === "npm" || token === "install" || token === "\\" || token.startsWith("-")) {
        continue;
      }
      packages.push(token);
    }
  }

  return packages;
}

/**
 * Collect the external packages the repository configs import or extend.
 * @returns unique package names
 */
export function collectConfigPackages(): string[] {
  const packages = new Set<string>();

  const addSpecifier = (specifier: string): void => {
    if (specifier.startsWith(".") || specifier.startsWith("node:")) {
      return;
    }
    const segments = specifier.split("/");
    packages.add(segments[0].startsWith("@") ? segments.slice(0, 2).join("/") : segments[0]);
  };

  for (const file of ["eslint.config.js", "eslint.metrics.config.js"]) {
    if (!existsSync(file)) {
      continue;
    }
    for (const match of readFileSync(file, "utf8").matchAll(/from\s+["']([^"']+)["']/g)) {
      addSpecifier(match[1]);
    }
  }

  for (const entry of [
    { path: ".prettierrc", field: "plugins" },
    { path: ".stylelintrc.json", field: "extends" },
  ]) {
    if (!existsSync(entry.path)) {
      continue;
    }
    const parsed = JSON.parse(readFileSync(entry.path, "utf8")) as Record<string, unknown>;
    for (const name of Array.isArray(parsed[entry.field]) ? (parsed[entry.field] as string[]) : []) {
      packages.add(name);
    }
  }

  return [...packages];
}

/**
 * Check the migration install list against package.json and the config
 * imports: every listed package must exist in package.json, and every
 * package a config imports must be listed for installation.
 * @param gettingText - docs/getting-started.md content
 * @param pkg - package.json dependencies
 * @param configPackages - packages the configs import or extend
 * @param failures - collector for error lines
 */
export function checkInstallCoverage(
  gettingText: string,
  pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> },
  configPackages: string[],
  failures: string[],
): void {
  const installed = new Set(installPackages(migrationSection(gettingText)));
  const owned = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);

  for (const name of [...installed].filter((candidate) => !owned.has(candidate))) {
    failures.push(`[FAIL] getting-started.md install list: ${name} is not in package.json.`);
  }
  for (const name of configPackages.filter((candidate) => !owned.has(candidate))) {
    failures.push(`[FAIL] config import ${name} is not in package.json.`);
  }
  for (const name of configPackages.filter((candidate) => owned.has(candidate) && !installed.has(candidate))) {
    failures.push(`[FAIL] getting-started.md install list misses ${name} (imported by a config).`);
  }
}
