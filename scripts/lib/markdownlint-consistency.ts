/** Check that the Markdownlint line-length options match the other 120 owners. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { StyleFailure } from "./style-consistency.ts";

/** MD013 options that mirror the shared line-length limit. */
const LINE_LENGTH_KEYS = ["line_length", "heading_line_length"] as const;

/** Expected line length, identical to .editorconfig, .prettierrc and Project.xml. */
export const EXPECTED_LINE_LENGTH = "120";

/**
 * Check `.markdownlint.json` against the shared line-length limit.
 * @param root - repository root holding `.markdownlint.json`
 * @param failures - collector for style mismatches
 */
export function checkMarkdownlint(root: string, failures: StyleFailure[]): void {
  const parsed = JSON.parse(readFileSync(join(root, ".markdownlint.json"), "utf8")) as {
    MD013?: Record<string, unknown>;
  };
  for (const key of LINE_LENGTH_KEYS) {
    const value = parsed.MD013?.[key];
    const actual = value === undefined ? null : String(value);
    if (actual !== EXPECTED_LINE_LENGTH) {
      failures.push({ file: ".markdownlint.json", key: `MD013.${key}`, expected: EXPECTED_LINE_LENGTH, actual });
    }
  }
}
