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
  return new RegExp(`(^|[/\\s"'\`])${escaped}([/\\s"'\`/]|$)`, "m").test(content);
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
