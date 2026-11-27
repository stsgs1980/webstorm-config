// noinspection GrazieInspection,GrazieStyle

/**
 * Wiring check for the docs gate: the table in docs/getting-started.md must
 * match where every script actually runs - the CI jobs and the git hooks.
 * Pure logic over given texts; the CLI script owns reading and output.
 */

import { existsSync, readFileSync } from "node:fs";

/** One place that runs repository commands: a CI job or a git hook. */
export interface CommandSource {
  /** Job or hook name shown in failure messages. */
  name: string;
  /** Command text owned by this source. */
  text: string;
}

/** One row of the getting-started wiring table. */
export interface WiringRow {
  /** Script name from the `npm run <name>` / `npm test` cell. */
  script: string;
  /** Locations listed in the second cell. */
  locations: string[];
}

/** The `npm test` shorthand maps to the `test` script. */
const NPM_TEST_PATTERN = /\bnpm test\b/;

/**
 * Parse the `run:` steps of a workflow into per-job command sources.
 * @param ciText - raw .github/workflows/ci.yml content
 * @returns one source per job with commands, in file order
 */
export function parseCiSources(ciText: string): CommandSource[] {
  const sources: CommandSource[] = [];
  const lines = ciText.split("\n");
  let job = "";

  for (let i = 0; i < lines.length; i += 1) {
    const jobLine = /^ {2}([a-z][a-z0-9_-]+):\s*$/.exec(lines[i]);
    if (jobLine) {
      job = jobLine[1];
      continue;
    }

    const runLine = /^(\s*)- ?run:(.*)$/.exec(lines[i]);
    if (!runLine || job === "") {
      continue;
    }
    const indent = runLine[1].length;
    const rest = runLine[2].trim();
    const chunk: string[] = rest === "" || rest === "|" ? [] : [rest];

    if (rest === "|") {
      const contentPattern = new RegExp(`^ {${indent + 1},}\\S`);
      let j = i + 1;
      while (j < lines.length && contentPattern.test(lines[j])) {
        chunk.push(lines[j]);
        j += 1;
      }
    }

    if (chunk.length > 0) {
      sources.push({ name: job, text: chunk.join("\n") });
    }
  }

  return sources;
}

/**
 * Parse the git hooks that run repository commands.
 * @returns one source per existing .husky/pre-commit and .husky/pre-push
 */
export function parseHuskySources(): CommandSource[] {
  const sources: CommandSource[] = [];
  for (const hook of ["pre-commit", "pre-push"]) {
    const path = `.husky/${hook}`;
    if (existsSync(path)) {
      sources.push({ name: hook, text: readFileSync(path, "utf8") });
    }
  }
  return sources;
}

/**
 * Compute where each script actually runs: a script is wired to a location
 * when its `npm run <name>` (or the `npm test` shorthand, or the verbatim
 * `node <file>` command) appears in that source.
 * @param scripts - package.json scripts
 * @param sources - CI jobs and git hooks
 * @returns script name -> set of location names
 */
export function expectedWiring(scripts: Record<string, string>, sources: CommandSource[]): Map<string, Set<string>> {
  const wiring = new Map<string, Set<string>>();

  for (const [name, command] of Object.entries(scripts)) {
    const locations = new Set<string>();
    const runPattern = new RegExp(`\\bnpm run ${name}(?![\\w:.-])`);

    for (const source of sources) {
      if (runPattern.test(source.text) || (name === "test" && NPM_TEST_PATTERN.test(source.text))) {
        locations.add(source.name);
      } else if (command.startsWith("node ") && source.text.includes(command)) {
        locations.add(source.name);
      }
    }

    if (locations.size > 0) {
      wiring.set(name, locations);
    }
  }

  return wiring;
}

/**
 * Parse the wiring table rows of docs/getting-started.md.
 * @param text - file content
 * @returns rows with the script name and the split second cell
 */
export function parseWiringTable(text: string): WiringRow[] {
  const rows: WiringRow[] = [];
  const rowPattern = /^\|\s*`npm (?:run ([a-z0-9:._-]+)|test)`\s*\|([^|]*)\|/gm;

  for (const match of text.matchAll(rowPattern)) {
    rows.push({
      script: match[1] ?? "test",
      locations: match[2]
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    });
  }

  return rows;
}

/**
 * Check the wiring table against the computed wiring, in both directions:
 * a script the CI runs must be tabled with all its locations, and a table
 * row must not name a script or location nothing runs.
 * @param scripts - package.json scripts
 * @param sources - CI jobs and git hooks
 * @param tableText - docs/getting-started.md content
 * @param failures - collector for error lines
 */
export function checkWiringTable(
  scripts: Record<string, string>,
  sources: CommandSource[],
  tableText: string,
  failures: string[],
): void {
  const expected = expectedWiring(scripts, sources);
  const rows = parseWiringTable(tableText);

  for (const [name, locations] of expected) {
    const row = rows.find((candidate) => candidate.script === name);
    if (!row) {
      failures.push(`[FAIL] docs/getting-started.md wiring table has no row for ${name}.`);
      continue;
    }
    const listed = new Set(row.locations);
    for (const location of [...locations].filter((place) => !listed.has(place))) {
      failures.push(`[FAIL] docs/getting-started.md wiring row for ${name} misses location ${location}.`);
    }
    for (const location of [...listed].filter((place) => !locations.has(place))) {
      failures.push(`[FAIL] docs/getting-started.md wiring row for ${name} lists unwired location ${location}.`);
    }
  }

  for (const row of rows) {
    if (!(row.script in scripts)) {
      failures.push(`[FAIL] docs/getting-started.md wiring row for ${row.script}: script does not exist.`);
      continue;
    }
    if (!expected.has(row.script)) {
      for (const location of row.locations) {
        failures.push(
          `[FAIL] docs/getting-started.md wiring row for ${row.script} lists unwired location ${location}.`,
        );
      }
    }
  }
}
