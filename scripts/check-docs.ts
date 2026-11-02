#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { checkVersionAlignment } from "./lib/version-alignment.ts";

/**
 * Documented future scripts that intentionally do not exist yet.
 * `dev` is a documented workspace bootstrap script; until it is added to
 * package.json the doc reference is a plan, not a dead link.
 */
const KNOWN_FUTURE_SCRIPTS = ["dev"];

/**
 * Future paths referenced by the roadmap section of the WebStorm setup
 * guide; each entry carries a reason, an exemption without one is a hole
 * in the rule, not a rule.
 * @type {{path: string, reason: string}[]}
 */
const KNOWN_FUTURE_PATHS = [
  {
    path: "docs/architecture.md",
    reason: "planned module-boundary policy document",
  },
  {
    path: "docs/security.md",
    reason: "planned secrets and server authorization policy document",
  },
  {
    path: "docs/api.md",
    reason: "planned API conventions document",
  },
  {
    path: "scripts/check-unicode-prose.ts",
    reason: "planned prose checker, one of the two documented options",
  },
];

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
 * Markdown files the verifier scans (root AGENTS.md and README files plus docs/, agent
 * workspace excluded).
 * @returns list of file paths
 */
function getDocFiles(): string[] {
  const root = ["AGENTS.md", "README.md", "README.template.md"].filter((file) => existsSync(file));
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
 * Whether git ignores the path. Ignored paths are personal files by the
 * `.idea` whitelist policy: documentation may and must name them even
 * though a CI checkout holds none of them. Outside a git repository the
 * path simply does not exist, and the ordinary existence check applies.
 * @param path - repo-relative path
 * @returns true when `git check-ignore` reports the path ignored
 */
function isGitIgnored(path: string): boolean {
  try {
    execFileSync("git", ["check-ignore", "-q", "--", path], { stdio: "ignore" });
    return true;
  } catch (error) {
    // git exit codes: 0 = ignored (throws never), 1 = not ignored,
    // 128 = not a repository or broken git: the path is not ignored.
    return (error as { status?: number }).status === 0;
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
    const future = KNOWN_FUTURE_PATHS.find((entry) => entry.path === path);
    if (future !== undefined) {
      // Roadmap reference: the failure would be creating it, not naming it.
      continue;
    }
    if (!existsSync(path) && !isGitIgnored(path)) {
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
