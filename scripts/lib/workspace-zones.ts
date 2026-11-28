// noinspection GrazieInspection,GrazieStyle

/**
 * Workspace zones shared by the tooling. Every tool that walks the
 * repository must skip these: a file that ESLint never sees must not fail
 * the typecheck gate, and a file Prettier never formats must not fail
 * format:check. The set lives here so the tools cannot drift apart.
 */

/** Directories that hold generated output, scratch work or agent state. */
export const WORKSPACE_ZONES = [
  "node_modules",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".astro",
  ".output",
  ".vite",
  ".cache",
  "coverage",
  "dev",
  "drafts",
  ".idea",
  ".superpowers",
  ".opencode",
  ".agents",
  ".awb",
] as const;

/** One tool that must skip the workspace zones. */
export interface ZoneTool {
  /** Tool name shown in the failure message. */
  name: string;
  /**
   * Whether the tool skips a zone.
   * @param zone - directory name
   * @returns true when the zone is ignored
   */
  ignores: (zone: string) => boolean;
}

/** One workspace zone that at least one tool still walks. */
export interface ZoneFailure {
  /** The zone that leaked. */
  zone: string;
  /** Tools that still walk the zone. */
  tools: string[];
}

/** How a tool lists the paths it skips; drives candidate extraction. */
export interface ZoneCandidateSource {
  /** Tool name shown in the failure message. */
  name: string;
  /** Raw content of the tool's list. */
  content: string;
  /**
   * Extraction kind: an ignore file lists plain directory entries, a glob
   * list holds quoted `dir/**` globs inside one array, a name list is a
   * JSON array of plain directory names.
   */
  kind: "ignoreFile" | "globList" | "nameList";
  /** Text before the glob array for `globList` sources. */
  marker?: string;
}

/** One entry a tool's list mentions that the zone owner does not declare. */
export interface ExtraZoneFailure {
  /** The tool whose list mentions the token. */
  tool: string;
  /** The directory-like token missing from the zone list. */
  token: string;
}

/** One lint-staged glob that covers a workspace zone. */
export interface LintStagedFailure {
  /** The staged-file pattern. */
  pattern: string;
  /** The zone the pattern covers. */
  zone: string;
}

/**
 * Check whether a text file mentions a zone as a path segment.
 * @param content - file content
 * @param zone - directory name to look for
 * @returns true when the zone appears as a path segment
 */
export function mentionsZone(content: string, zone: string): boolean {
  const escaped = zone.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // A zone counts as ignored when it appears as a path segment: at the start
  // of a line, after a slash, or wrapped in quotes.
  return new RegExp(`(^|[/\\s"'\`])${escaped}([/\\s"'\`]|$)`, "m").test(content);
}

/**
 * Find workspace zones that some tool still walks.
 * @param zones - the zones every tool must skip
 * @param tools - the tools to check
 * @returns one failure per zone that is not ignored everywhere
 */
export function checkZoneCoverage(zones: readonly string[], tools: ZoneTool[]): ZoneFailure[] {
  const failures: ZoneFailure[] = [];
  for (const zone of zones) {
    const leaking = tools.filter((tool) => !tool.ignores(zone)).map((tool) => tool.name);
    if (leaking.length > 0) {
      failures.push({ zone, tools: leaking });
    }
  }
  return failures;
}

/**
 * Read directory-like zone candidates out of one tool's list.
 * @param source - the tool's list and how to read it
 * @returns directory names the list mentions
 */
export function collectZoneCandidates(source: ZoneCandidateSource): string[] {
  if (source.kind === "nameList") {
    const parsed: unknown = JSON.parse(source.content);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is string => typeof entry === "string");
  }
  const text = source.marker ? source.content.slice(source.content.indexOf(source.marker)) : source.content;
  if (source.kind === "globList") {
    const end = text.indexOf("]");
    const bounded = end === -1 ? text : text.slice(0, end);
    return [...bounded.matchAll(/"([^"*/]+)\/\*\*"/g)].map((match) => match[1]);
  }
  const entries: string[] = [];
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*!?(\/)?([A-Za-z0-9_.-]+)\/\s*$/);
    if (match) {
      entries.push(match[2]);
    }
  }
  return entries;
}

/**
 * Find entries a tool's list mentions that the zone owner does not declare:
 * a directory added to one list but absent from the owner is exactly the
 * drift the one-directional check cannot see.
 * @param zones - the zones every tool must skip
 * @param sources - the lists to scan for unowned entries
 * @returns one failure per unowned entry per tool
 */
export function checkExtraZoneMentions(zones: readonly string[], sources: ZoneCandidateSource[]): ExtraZoneFailure[] {
  const failures: ExtraZoneFailure[] = [];
  for (const source of sources) {
    for (const token of collectZoneCandidates(source)) {
      if (!zones.includes(token)) {
        failures.push({ tool: source.name, token });
      }
    }
  }
  return failures;
}

/**
 * Check that every Vitest include glob is rooted in a directory. A glob
 * starting with `*` matches zone files and pulls them back into the test
 * run, which defeats the include-based isolation.
 * @param content - vitest.config.ts content
 * @returns one failure per unrooted glob
 */
export function checkVitestIncludeRooting(content: string): string[] {
  const failures: string[] = [];
  let position = content.indexOf("include: [");
  while (position !== -1) {
    const end = content.indexOf("]", position);
    const bounded = content.slice(position, end === -1 ? content.length : end);
    for (const match of bounded.matchAll(/"([^"]+)"/g)) {
      if (match[1].startsWith("*")) {
        failures.push(`vitest include glob "${match[1]}" is not rooted in a directory`);
      }
    }
    position = content.indexOf("include: [", position + 1);
  }
  return failures;
}

/**
 * Check that no lint-staged pattern covers a workspace zone: staged-file
 * globs must stay extension-based, or the hook formats generated content.
 * @param patterns - lint-staged config keys
 * @param zones - the zones every tool must skip
 * @returns one failure per pattern-zone overlap
 */
export function checkLintStagedPatterns(
  patterns: Record<string, unknown>,
  zones: readonly string[],
): LintStagedFailure[] {
  const failures: LintStagedFailure[] = [];
  for (const pattern of Object.keys(patterns)) {
    for (const zone of zones) {
      if (mentionsZone(pattern, zone)) {
        failures.push({ pattern, zone });
      }
    }
  }
  return failures;
}
