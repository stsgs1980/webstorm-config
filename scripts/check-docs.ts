#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { checkLinks } from "./lib/docs-links.ts";
import { checkVersionAlignment } from "./lib/version-alignment.ts";

/**
 * Per-file opt-in for scripts that are documented as future work. Without the
 * marker a missing script is an error, so a typo cannot hide behind the list.
 * Format: <!-- check-docs:allow-missing-scripts dev test:e2e -->
 */
const FUTURE_SCRIPTS_MARKER = /<!--\s*check-docs:allow-missing-scripts\s+([^>]+?)\s*-->/;

/** Inline-code path prefixes that must exist in the repository. */
const PATH_PREFIXES = [
  "docs/",
  ".idea/",
  "scripts/",
  ".husky/",
  ".github/",
  ".aiassistant/",
  "eslint-rules/",
  "eslint-processors/",
  "eslint-parsers/",
];

/** `npm run <name>` references inside docs; digits occur in names like test:e2e. */
const SCRIPT_PATTERN = /npm run ([a-z0-9:.-]+)/g;

/** Inline-code values shaped like repository paths. */
const PATH_PATTERN = /`([^`]+\/[^`]*)`/g;

/** "Node.js >= x.y.z" markers, including the percent-encoded badge form. */
const NODE_VERSION_PATTERN = /Node\.js-?\s*(?:%3E%3D|>=)\s*(\d+\.\d+\.\d+)/g;

/**
 * Recursively collect .md files under a directory.
 * @param dir - directory to walk
 * @returns Markdown file paths with forward slashes
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
 * Markdown files the verifier scans: root AGENTS/README/SECURITY, the AI rules
 * pointer and docs/. Other agent workspace files are not documentation.
 * @returns list of file paths
 */
function getDocFiles(): string[] {
  const root = ["AGENTS.md", "README.md", "README.template.md", "SECURITY.md", ".aiassistant/rules/AI Rules.md"].filter(
    (file) => existsSync(file),
  );
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
  const allowed = new Set((FUTURE_SCRIPTS_MARKER.exec(text)?.[1] ?? "").split(/\s+/).filter(Boolean));

  for (const match of text.matchAll(SCRIPT_PATTERN)) {
    // Strip trailing sentence punctuation: "…run `npm run lint.`".
    const name = match[1].replace(/[.-]+$/, "");
    const at = match.index ?? 0;

    if (allowed.has(name)) {
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

/** Fenced code block: its examples are illustrative, not contract paths. */
const FENCE_PATTERN = /```[\s\S]*?```/g;

/**
 * Replace fenced blocks with spaces while preserving offsets and newlines.
 * Scripts are checked in fences (they are real commands); paths are not.
 * @param text - Markdown content
 * @returns content with fenced blocks masked
 */
function maskFences(text: string): string {
  return text.replace(FENCE_PATTERN, (block) => block.replace(/[^\n]/g, " "));
}

/**
 * Check that file paths in a doc file's inline code exist.
 * @param file - doc file being checked
 * @param text - file content with fenced blocks masked
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
    if (!existsSync(path) && !isGitIgnored(path)) {
      failures.push(`[FAIL] ${file}:${lineOf(text, at)} path ${path} does not exist.`);
    }
  }
}

/**
 * Count Node.js version markers in a doc file and flag version mismatches.
 * @param file - doc file being checked
 * @param text - file content
 * @param engineMin - min version from the engines field, when parseable
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
    checkPaths(file, maskFences(text), failures);
    checkLinks(file, text, failures);
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
