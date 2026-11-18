/**
 * Which files the docs gate scans: root AGENTS/README/SECURITY, the AI rules
 * pointer and the docs/ tree, recursively. Agent workspace files outside
 * these locations are not documentation. Pure discovery; the checks live in
 * `docs-check.ts`.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Recursively collect .md files under a directory.
 * @param dir - directory to walk
 * @returns Markdown file paths with forward slashes
 */
export function collectMarkdown(dir: string): string[] {
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
 * Markdown files the verifier scans: root files, the AI rules pointer and
 * docs/. Other agent workspace files are not documentation.
 * @returns list of file paths
 */
export function getDocFiles(): string[] {
  const root = ["AGENTS.md", "README.md", "README.template.md", "SECURITY.md", ".aiassistant/rules/AI Rules.md"].filter(
    (file) => existsSync(file),
  );
  return [...root, ...collectMarkdown("docs")];
}
