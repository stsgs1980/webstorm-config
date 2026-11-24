// File templates (.idea/fileTemplates) are Velocity documents: `${NAME}` is a
// variable and `$END$` is the caret marker. Live-template syntax `$NAME$` is
// not Velocity: the IDE keeps the trailing dollar as a literal, so every file
// created from such a template ships a broken name (observed: New -> Vitest
// Test produced describe("test$")). ESLint never sees .idea/, so this check is
// the only thing standing between a broken template and every future file.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Markers the file-template engine understands: `$END$` is the caret. */
const ALLOWED_MARKERS = new Set(["$END$"]);

/** Live-template syntax: a dollar-wrapped upper-case variable. */
const LIVE_SYNTAX = /\$[A-Z][A-Z0-9_]*\$/g;

/** Result of scanning one file-templates tree. */
export interface FileTemplateCheck {
  /** Template files scanned. */
  checked: number;
  /** `[FAIL]` lines, one per live-template marker. */
  failures: string[];
}

/**
 * Find live-template markers in a file template. `${NAME}` and `$END$` are
 * valid Velocity; `$NAME$` is not, and the IDE copies it literally.
 * @param content - file-template text
 * @returns every offending marker, in order
 */
export function findLiveSyntaxMarkers(content: string): string[] {
  return [...content.matchAll(LIVE_SYNTAX)].map((match) => match[0]).filter((marker) => !ALLOWED_MARKERS.has(marker));
}

/**
 * Every file under a directory, relative to it, in traversal order.
 * @param dir - directory to walk
 * @param prefix - path prefix used by recursive calls
 * @returns relative file paths
 */
function listFiles(dir: string, prefix = ""): string[] {
  const entries = readdirSync(join(dir, prefix), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = prefix === "" ? entry.name : join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(dir, relative));
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files;
}

/**
 * Check every file template for live-template syntax. A missing directory is
 * not a failure: a fork may drop the templates, and only an existing template
 * can ship a defect.
 * @param dir - directory with file templates
 * @returns scanned count and `[FAIL]` lines
 */
export function checkFileTemplates(dir: string): FileTemplateCheck {
  if (!existsSync(dir)) {
    return { checked: 0, failures: [] };
  }
  const files = listFiles(dir);
  const failures: string[] = [];
  for (const file of files) {
    const path = join(dir, file);
    for (const marker of findLiveSyntaxMarkers(readFileSync(path, "utf8"))) {
      failures.push(`[FAIL] ${path}: ${marker} is live-template syntax; file templates use \${NAME} or $END$`);
    }
  }
  return { checked: files.length, failures };
}
