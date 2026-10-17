#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Documented future scripts that intentionally do not exist yet. */
const KNOWN_FUTURE_SCRIPTS = ["dev"];

/** Inline-code path prefixes that must exist in the repository. */
const PATH_PREFIXES = ["docs/", ".idea/", "scripts/", ".husky/", "eslint-rules/", "eslint-processors/"];

/**
 * Recursively collect .md files under a directory.
 * @param dir - directory to walk
 * @returns markdown file paths with forward slashes
 */
function collectMarkdown(dir: string): string[] {
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
 * Markdown files the verifier scans (root READMEs plus docs/, agent workspace excluded).
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
 * Verify docs against configs: npm run names, Node.js version markers, real paths.
 * @returns void; exits with code 1 on any violation
 */
function main(): void {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
    engines: { node: string };
  };
  const nvmrc = readFileSync(".nvmrc", "utf8").trim();
  const files = getDocFiles();
  const failures: string[] = [];

  const scriptPattern = /npm run ([a-z:.-]+)/g;
  const pathPattern = /`([^`]+\/[^`]*)`/g;
  const nodeVersionPattern = /Node\.js-?\s*(?:%3E%3D|>=)\s*(\d+\.\d+\.\d+)/g;

  const nvmVersion = /^(\d+)\.(\d+)\.(\d+)$/.exec(nvmrc)?.[0];
  const engineMin = /(\d+)\.(\d+)\.(\d+)/.exec(pkg.engines.node)?.[0];
  let readmeMarkers = 0;

  if (nvmVersion === undefined || engineMin === undefined) {
    failures.push("[FAIL] Cannot parse version from .nvmrc or engines.node.");
  } else if (compareVersions(nvmVersion, engineMin) < 0) {
    failures.push(`[FAIL] .nvmrc ${nvmVersion} does not satisfy engines.node ${pkg.engines.node}.`);
  }

  for (const file of files) {
    const text = readFileSync(file, "utf8");

    for (const match of text.matchAll(scriptPattern)) {
      // Strip trailing sentence punctuation: "…run `npm run lint.`".
      const name = match[1].replace(/[.-]+$/, "");
      const at = match.index ?? 0;
      if (KNOWN_FUTURE_SCRIPTS.includes(name)) {
        continue;
      }
      if (!(name in pkg.scripts)) {
        failures.push(`[FAIL] ${file}:${lineOf(text, at)} npm run ${name} is not in package.json scripts.`);
      }
    }

    for (const match of text.matchAll(pathPattern)) {
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

    for (const match of text.matchAll(nodeVersionPattern)) {
      const found = match[1];
      const at = match.index ?? 0;

      if (file === "README.md") {
        readmeMarkers += 1;
      }
      if (engineMin !== undefined && found !== engineMin) {
        failures.push(`[FAIL] ${file}:${lineOf(text, at)} Node.js version ${found} != engines.node min ${engineMin}.`);
      }
    }
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
