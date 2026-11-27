/**
 * Checks for the language blocks of `.idea/codeStyles/Project.xml`. Kept in
 * its own module so `style-consistency.ts` stays under the hard file limit.
 */

import { EXPECTED_LINE_LENGTH } from "./markdownlint-consistency.ts";
import type { StyleFailure } from "./style-consistency.ts";

/**
 * Read an option from one XML fragment.
 * @param fragment - XML text
 * @param name - option name
 * @returns option value or null
 */
const xmlOption = (fragment: string, name: string): string | null =>
  new RegExp(`<option name="${name}" value="([^"]*)"`).exec(fragment)?.[1] ?? null;

/**
 * Check one codeStyleSettings block.
 * @param language - block language
 * @param fragment - block body
 * @param failures - collected consistency failures
 * @returns void
 */
function checkLanguageBlock(language: string, fragment: string, failures: StyleFailure[]): void {
  const checks: Array<[string, string]> = [
    ["INDENT_SIZE", "2"],
    ["CONTINUATION_INDENT_SIZE", "2"],
    ["TAB_SIZE", "2"],
    ["USE_TAB_CHARACTER", "false"],
    ["SOFT_MARGINS", EXPECTED_LINE_LENGTH],
  ];
  for (const [key, expected] of checks) {
    const actual = xmlOption(fragment, key);
    if (actual !== expected) {
      failures.push({ file: `Project.xml:${language}`, key, expected, actual });
    }
  }
}

/**
 * Check that every expected language appears exactly once and its block agrees.
 * @param xml - Project.xml content
 * @param expectedLanguages - languages the project must declare
 * @param failures - collected consistency failures
 * @returns void
 */
export function checkLanguageBlocks(
  xml: string,
  expectedLanguages: ReadonlySet<string>,
  failures: StyleFailure[],
): void {
  const blocks = [...xml.matchAll(/<codeStyleSettings language="([^"]+)">([\s\S]*?)<\/codeStyleSettings>/g)];
  const seen = new Set<string>();
  for (const [, language, fragment] of blocks) {
    if (seen.has(language)) {
      failures.push({
        file: "Project.xml",
        key: `duplicate language ${language}`,
        expected: "one block",
        actual: "duplicate",
      });
      continue;
    }
    seen.add(language);
    if (!expectedLanguages.has(language)) {
      failures.push({
        file: "Project.xml",
        key: `language ${language}`,
        expected: "known language",
        actual: "unexpected",
      });
    }
    checkLanguageBlock(language, fragment, failures);
  }
  for (const language of expectedLanguages) {
    if (!seen.has(language)) {
      failures.push({ file: "Project.xml", key: `language ${language}`, expected: "present", actual: "missing" });
    }
  }
}
