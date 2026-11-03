// Markdown link and anchor validation for check-docs. Kept separate so the
// verifier stays under the file-length limit and links get their own tests.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

/** Markdown link or image: target without title, angle brackets stripped later. */
const LINK_PATTERN = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const HEADING_PATTERN = /^#{1,6}\s+(.+)$/gm;
const FENCE_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`[^`\n]*`/g;
const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;
/** Any URL scheme (https:, mailto:, data:) and protocol-relative URLs. */
const EXTERNAL_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

const anchorCache = new Map<string, Set<string>>();

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
 * Collect character ranges occupied by a pattern.
 * @param text - full file content
 * @param pattern - global pattern to locate
 * @returns [start, end) ranges
 */
function rangesOf(text: string, pattern: RegExp): [number, number][] {
  return [...text.matchAll(pattern)].map((match) => [match.index ?? 0, (match.index ?? 0) + match[0].length]);
}

/**
 * Whether an offset falls inside one of the ranges.
 * @param index - character offset
 * @param ranges - sorted or unsorted [start, end) ranges
 * @returns true when masked (code span, fence or comment)
 */
function isMasked(index: number, ranges: [number, number][]): boolean {
  return ranges.some(([start, end]) => index >= start && index < end);
}

/**
 * Turn a heading into a GitHub-style anchor.
 * @param heading - raw heading text
 * @returns slug used in #fragment links
 */
function slugify(heading: string): string {
  return heading
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, "-");
}

/**
 * Anchors of a markdown file, with GitHub's duplicate-heading suffixes.
 * @param path - file to read
 * @returns set of anchors (including -1, -2 duplicates)
 */
function anchorsOf(path: string): Set<string> {
  const cached = anchorCache.get(path);
  if (cached !== undefined) {
    return cached;
  }
  const text = existsSync(path) ? readFileSync(path, "utf8").replace(FENCE_PATTERN, "") : "";
  const seen = new Map<string, number>();
  const anchors = new Set<string>();
  for (const match of text.matchAll(HEADING_PATTERN)) {
    const base = slugify(match[1]);
    if (base === "") {
      continue;
    }
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  anchorCache.set(path, anchors);
  return anchors;
}

/** Parsed local link: path as written, resolved file and optional fragment. */
interface ParsedLink {
  pathPart: string;
  targetPath: string;
  fragment: string;
}

/**
 * Parse one link target into its path and fragment; undefined means "skip".
 * External URLs, empty targets and pure "#" links are not local checks.
 * @param file - document containing the link
 * @param raw - raw markdown target
 * @returns parsed link or undefined when it must be ignored
 */
function parseLink(file: string, raw: string): ParsedLink | undefined {
  let target = raw;
  if (target.startsWith("<") && target.endsWith(">")) {
    target = target.slice(1, -1);
  }
  const hash = target.indexOf("#");
  let pathPart = hash === -1 ? target : target.slice(0, hash);
  let fragment = hash === -1 ? "" : target.slice(hash + 1);
  try {
    pathPart = decodeURIComponent(pathPart);
    fragment = decodeURIComponent(fragment);
  } catch {
    // Malformed percent-encoding: check the raw text as written.
  }
  if (pathPart !== "" && EXTERNAL_PATTERN.test(pathPart)) {
    return undefined;
  }
  if (pathPart === "" && fragment === "") {
    return undefined;
  }
  const targetPath = pathPart === "" ? file : normalize(join(dirname(file), pathPart));
  return { pathPart, targetPath, fragment };
}

/**
 * Verify that a parsed link exists and its anchor resolves.
 * @param file - document containing the link
 * @param line - 1-based line number
 * @param link - parsed link target
 * @param failures - collector for error lines
 */
function verifyLink(file: string, line: number, link: ParsedLink, failures: string[]): void {
  if (link.pathPart !== "" && !existsSync(link.targetPath)) {
    failures.push(`[FAIL] ${file}:${line} link target ${link.pathPart} does not exist.`);
    return;
  }
  if (link.fragment === "" || !link.targetPath.endsWith(".md")) {
    return;
  }
  if (!anchorsOf(link.targetPath).has(link.fragment)) {
    failures.push(`[FAIL] ${file}:${line} anchor #${link.fragment} not found in ${link.pathPart || file}.`);
  }
}

/**
 * Verify relative markdown links and #anchors in one document.
 * External URLs and code spans/fences are ignored on purpose.
 * @param file - doc file being checked
 * @param text - file content
 * @param failures - collector for error lines
 */
export function checkLinks(file: string, text: string, failures: string[]): void {
  const masked = [
    ...rangesOf(text, FENCE_PATTERN),
    ...rangesOf(text, INLINE_CODE_PATTERN),
    ...rangesOf(text, HTML_COMMENT_PATTERN),
  ];

  for (const match of text.matchAll(LINK_PATTERN)) {
    const at = match.index ?? 0;
    if (isMasked(at, masked)) {
      continue;
    }
    const link = parseLink(file, match[1]);
    if (link !== undefined) {
      verifyLink(file, lineOf(text, at), link, failures);
    }
  }
}
