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
 * Verify docs against configs: npm run names, pinned versions, real paths.
 * @returns void; exits with code 1 on any violation
 */
function main(): void {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
    engines: { node: string };
  };
  const nvmrc = readFileSync(".nvmrc", "utf8").trim();
  const readme = existsSync("README.md") ? readFileSync("README.md", "utf8") : "";
  const files = getDocFiles();
  const failures: string[] = [];

  const scriptPattern = /npm run ([a-z:.-]+)/g;
  const pathPattern = /`([^`]+\/[^`]*)`/g;
  const versionPattern = /(\d+)\.(\d+)\.(\d+)/;

  const nvmMajor = /^\d+/.exec(nvmrc)?.[0];
  const engineMin = versionPattern.exec(pkg.engines.node)?.[1];

  if (nvmMajor === undefined || engineMin === undefined) {
    failures.push("[FAIL] Cannot parse version from .nvmrc or engines.node.");
  } else if (nvmMajor !== engineMin) {
    failures.push(`[FAIL] .nvmrc major ${nvmMajor} != engines.node min major ${engineMin}.`);
  }

  if (!readme.includes(nvmrc)) {
    failures.push(`[FAIL] README.md does not contain pinned version ${nvmrc} (badge).`);
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
