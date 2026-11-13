/**
 * Shared logic for the IDE-state gate and the restore script. Both work on
 * the same JetBrains config directory: the gate reports where the machine
 * drifted from the repository, the restore script puts it back.
 *
 * The machine keeps two levels of the same settings:
 * - `%APPDATA%/JetBrains/WebStorm<version>/codestyles|inspection/` holds the
 *   named schemes, copied from the repository so other projects inherit them.
 * - `options/project.default.xml` and `options/editor.xml` hold the pointers
 *   that select those schemes. A stale pointer is what made WebStorm overwrite
 *   the project file with an outdated global scheme; the phantom
 *   `codestyles/codeStyleConfig.xml` would do the same for new projects.
 */

import { join } from "node:path";

/** Directory inside the JetBrains config that holds the named schemes. */
export const SCHEME_GROUPS = ["codestyles", "inspection"] as const;

/** One scheme group. */
export type SchemeGroup = (typeof SCHEME_GROUPS)[number];

/** The scheme name used for both the code style and the inspection profile. */
export const SCHEME_NAME = "webstorm-config-ide";

/** File inside a scheme group that holds the named scheme. */
export const SCHEME_FILE = `${SCHEME_NAME}.xml`;

/** One mismatch between the machine state and the repository. */
export interface IdeStateFailure {
  /** File the mismatch was found in. */
  file: string;
  /** What is wrong. */
  problem: string;
}

/** Numeric version parts of a WebStorm directory name ("WebStorm2026.3" -> [2026, 3]). */
export const versionParts = (name: string): number[] =>
  name
    .replace(/^WebStorm/i, "")
    .split(".")
    .map((chunk) => Number.parseInt(chunk, 10) || 0);

/**
 * Compare two WebStorm version directory names numerically.
 * @param a - first directory name
 * @param b - second directory name
 * @returns true when a is newer
 */
export const isNewer = (a: string, b: string): boolean => {
  const left = versionParts(a);
  const right = versionParts(b);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const aPart = left[index] ?? 0;
    const bPart = right[index] ?? 0;
    if (aPart !== bPart) {
      return aPart > bPart;
    }
  }
  return false;
};

/**
 * Find the newest WebStorm config directory under the base directory.
 * @param base - JetBrains settings base directory
 * @param entries - directory names under the base
 * @returns path to the newest WebStorm* directory, or null when none exists
 */
export const findNewestWebStormDir = (base: string, entries: string[]): string | null => {
  let newest: string | null = null;
  for (const entry of entries) {
    if (!/^WebStorm\d/i.test(entry)) {
      continue;
    }
    if (newest === null || isNewer(entry, newest)) {
      newest = entry;
    }
  }
  return newest === null ? null : join(base, newest);
};

/**
 * Read the value of an option from an XML settings file.
 * @param content - file content
 * @param optionName - value of the `name` attribute
 * @returns the `value` attribute, or null when the option is absent
 */
export const readOptionValue = (content: string, optionName: string): string | null => {
  const pattern = new RegExp(`<option name="${optionName}" value="([^"]*)"`);
  return pattern.exec(content)?.[1] ?? null;
};

/**
 * Read an attribute of a component element from an XML settings file.
 * @param content - file content
 * @param component - value of the component `name` attribute
 * @param attribute - attribute to read
 * @returns the attribute value, or null when the attribute is absent
 */
export const readComponentAttribute = (content: string, component: string, attribute: string): string | null => {
  const pattern = new RegExp(`<component name="${component}"[^>]*\\s${attribute}="([^"]*)"`);
  return pattern.exec(content)?.[1] ?? null;
};

/**
 * List the option-based pointers that select a named scheme for new projects.
 * These are the settings that make WebStorm apply the global copy to a
 * project, so a stale pointer is what overwrites the project file.
 */
export const SCHEME_POINTERS = [
  {
    file: "options/project.default.xml",
    option: "PREFERRED_SCHEME",
    owner: "ProjectCodeStyleConfiguration",
  },
  {
    file: "options/project.default.xml",
    option: "PROJECT_PROFILE",
    owner: "InspectionProjectProfileManager",
  },
] as const;

/** Attribute-based pointer selecting the inspection profile in `options/editor.xml`. */
export const EDITOR_POINTER = {
  file: "options/editor.xml",
  component: "DaemonCodeAnalyzerSettings",
  attribute: "profile",
} as const;

/**
 * Machine file that must not exist: it re-points new projects at the global
 * scheme instead of the project-level one, which is how WebStorm ended up
 * overwriting `.idea/codeStyles/Project.xml` with an outdated copy.
 */
export const PHANTOM_FILE = "codestyles/codeStyleConfig.xml";
