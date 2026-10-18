#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Documented future scripts that intentionally do not exist yet. */
const KNOWN_FUTURE_SCRIPTS = ["dev"];

/** Inline-code path prefixes that must exist in the repository. */
const PATH_PREFIXES = [
  "docs/",
  ".idea/",
  "scripts/",
  ".husky/",
  "eslint-rules/",
  "eslint-processors/",
  "eslint-parsers/",
];

/** `npm run <name>` references inside docs. */
const SCRIPT_PATTERN = /npm run ([a-z:.-]+)/g;

/** Inline-code values shaped like repository paths. */
const PATH_PATTERN = /`([^`]+\/[^`]*)`/g;

/** "Node.js >= x.y.z" markers, including the percent-encoded badge form. */
const NODE_VERSION_PATTERN = /Node\.js-?\s*(?:%3E%3D|>=)\s*(\d+\.\d+\.\d+)/g;

/** Strict x.y.z version, as required inside .nvmrc. */
const EXACT_VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

/** First x.y.z version found in a range, e.g. engines.node. */
const VERSION_PATTERN = /(\d+)\.(\d+)\.(\d+)/;

/**
 * Recursively collect .md files under a directory.
 * @param dir - directory to walk
 * @returns markdown file paths with forward slashes
 */
function collectMarkdown(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  const out: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      if (full === "docs/superpowers") {
        continue;
      }
      out.push(...collectMarkdown(full));
    } else if (entry.name.endsWith(".md")) {
      out.push(full);
    }
  }

  return out;
}

/**
 * Markdown files the verifier scans (root README files plus docs/, agent workspace excluded).
 * @returns list of file paths
 */
function getDocFiles(): string[] {
  const root = ["README.md", "README.template.md"].filter((file) => existsSync(file));
  return [...root, ...collectMarkdown("docs")];
}

/**
 * Convert a character offset to a 1-based line number.
 * @param text - full file content
 * @param index - character offset
 * @returns line number
 */
function lineOf(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

/**
 * Compare two x.y.z version strings numerically.
 * @param a - first version
 * @param b - second version
 * @returns negative when a < b, zero when equal, positive when a > b
 */
function compareVersions(a: string, b: string): number {
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
 * @param nvmRaw - raw .nvmrc content, if the file exists
 * @param enginesNode - engines.node value from package.json, if set
 * @param failures - collector for error lines
 * @returns min version extracted from engines.node, if parseable
 */
function checkVersionAlignment(
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

/**
 * Check that every `npm run <name>` in a doc file is a real script.
 * @param file - doc file being checked
 * @param text - file content
 * @param scripts - package.json scripts
 * @param failures - collector for error lines
 */
function checkScriptNames(file: string, text: string, scripts: Record<string, string>, failures: string[]): void {
  for (const match of text.matchAll(SCRIPT_PATTERN)) {
    // Strip trailing sentence punctuation: "…run `npm run lint.`".
    const name = match[1].replace(/[.-]+$/, "");
    const at = match.index ?? 0;

    if (KNOWN_FUTURE_SCRIPTS.includes(name)) {
      continue;
    }
    if (!(name in scripts)) {
      failures.push(`[FAIL] ${file}:${lineOf(text, at)} npm run ${name} is not in package.json scripts.`);
    }
  }
}

/**
 * Check that file paths in a doc file's inline code exist.
 * @param file - doc file being checked
 * @param text - file content
 * @param failures - collector for error lines
 */
function checkPaths(file: string, text: string, failures: string[]): void {
  for (const match of text.matchAll(PATH_PATTERN)) {
    let path = match[1];
    const at = match.index ?? 0;

    if (path.includes("$") || path.includes("*")) {
      // Template variables and globs are not concrete paths.
      continue;
    }
    const anchor = path.indexOf("#");
    if (anchor !== -1) {
      path = path.slice(0, anchor);
    }
    if (!PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      continue;
    }
    if (!existsSync(path)) {
      failures.push(`[FAIL] ${file}:${lineOf(text, at)} path ${path} does not exist.`);
    }
  }
}

/**
 * Count Node.js version markers in a doc file and flag version mismatches.
 * @param file - doc file being checked
 * @param text - file content
 * @param engineMin - min version from engines.node, if parseable
 * @param failures - collector for error lines
 * @returns marker count for README.md, otherwise 0
 */
function checkNodeVersionMarkers(
  file: string,
  text: string,
  engineMin: string | undefined,
  failures: string[],
): number {
  let markers = 0;

  for (const match of text.matchAll(NODE_VERSION_PATTERN)) {
    markers += 1;

    if (engineMin !== undefined && match[1] !== engineMin) {
      const at = match.index ?? 0;
      failures.push(`[FAIL] ${file}:${lineOf(text, at)} Node.js version ${match[1]} != engines.node min ${engineMin}.`);
    }
  }

  return file === "README.md" ? markers : 0;
}

/**
 * Verify docs against configs: npm run names, Node.js version markers, real paths.
 * @returns void; exits with code 1 on any violation
 */
function main(): void {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
    engines?: { node?: string };
  };
  const nvmRaw = existsSync(".nvmrc") ? readFileSync(".nvmrc", "utf8").trim() : undefined;
  const files = getDocFiles();
  const failures: string[] = [];
  const engineMin = checkVersionAlignment(nvmRaw, pkg.engines?.node, failures);
  let readmeMarkers = 0;

  for (const file of files) {
    const text = readFileSync(file, "utf8");

    checkScriptNames(file, text, pkg.scripts, failures);
    checkPaths(file, text, failures);
    readmeMarkers += checkNodeVersionMarkers(file, text, engineMin, failures);
  }

  if (readmeMarkers === 0) {
    failures.push("[FAIL] README.md has no Node.js badge marker for engines.node min.");
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure);
    }
    process.exit(1);
  }

  process.stdout.write(`[OK] check-docs: ${files.length} docs files consistent with configs.\n`);
}

main();
