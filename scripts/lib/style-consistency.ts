/**
 * Parsers and checks for the style consistency gate: `.editorconfig`,
 * `.prettierrc` and `.idea/codeStyles/Project.xml` must agree on the core
 * code style values. Pure logic; the CLI script owns file output and exit.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { checkMarkdownlint, EXPECTED_LINE_LENGTH } from "./markdownlint-consistency.ts";
import { checkLanguageBlocks } from "./style-language-blocks.ts";

/** Languages every Project.xml must declare a `codeStyleSettings` block for. */
export const EXPECTED_LANGUAGES = new Set([
  "Angular2 HTML",
  "CSS",
  "EJS",
  "Gherkin",
  "HTML",
  "HTTP",
  "JSON",
  "JavaScript",
  "Less",
  "Markdown",
  "Mermaid",
  "PowerShell",
  "Prisma",
  "Pug",
  "Python",
  "SCSS",
  "SQL",
  "Sass",
  "Shell Script",
  "TOML",
  "TypeScript",
  "Vue",
  "XML",
  "YAML",
]);

/** One mismatch between the three sources of style truth. */
export interface StyleFailure {
  file: string;
  key: string;
  expected: string;
  actual: string | null;
}

/**
 * Read a `[*]` section from .editorconfig.
 * @param content - file content
 * @returns key/value pairs of the universal section
 */
export function parseEditorConfig(content: string): Record<string, string> {
  const values: Record<string, string> = {};
  let inStar = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#") || line.startsWith(";")) {
      continue;
    }
    if (line.startsWith("[") && line.endsWith("]")) {
      inStar = line === "[*]";
      continue;
    }
    if (!inStar) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq === -1) {
      continue;
    }
    values[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return values;
}

/**
 * Read an option from one XML fragment.
 * @param fragment - XML text
 * @param name - option name
 * @returns option value or null
 */
function xmlOption(fragment: string, name: string): string | null {
  return new RegExp(`<option name="${name}" value="([^"]*)"`).exec(fragment)?.[1] ?? null;
}

/**
 * Check the universal editorconfig section.
 */
function checkEditorConfig(root: string, failures: StyleFailure[]): void {
  const path = join(root, ".editorconfig");
  const values = parseEditorConfig(readFileSync(path, "utf8"));
  const checks: Array<[string, string]> = [
    ["end_of_line", "lf"],
    ["indent_style", "space"],
    ["indent_size", "2"],
    ["tab_width", "2"],
    ["max_line_length", EXPECTED_LINE_LENGTH],
    ["ij_continuation_indent_size", "2"],
    ["ij_visual_guides", EXPECTED_LINE_LENGTH],
    ["ij_smart_tabs", "false"],
    ["ij_wrap_on_typing", "false"],
  ];
  for (const [key, expected] of checks) {
    const actual = values[key] ?? null;
    if (actual !== expected) {
      failures.push({ file: ".editorconfig", key, expected, actual });
    }
  }
}

/**
 * Check Prettier options.
 */
function checkPrettierRc(root: string, failures: StyleFailure[]): void {
  const path = join(root, ".prettierrc");
  const values = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const checks: Array<[string, string]> = [
    ["tabWidth", "2"],
    ["printWidth", EXPECTED_LINE_LENGTH],
    ["singleQuote", "false"],
    ["semi", "true"],
    ["bracketSpacing", "true"],
    ["trailingComma", "all"],
    ["endOfLine", "lf"],
  ];
  for (const [key, expected] of checks) {
    const actual = values[key] ?? null;
    if (String(actual) !== expected) {
      failures.push({
        file: ".prettierrc",
        key,
        expected,
        actual: actual === null ? null : String(actual),
      });
    }
  }
}

/**
 * Check scheme-wide options and the JS/TS quote and comma rules.
 * @param xml - Project.xml content
 * @param failures - collected consistency failures
 */
function checkSchemeAndJsTs(xml: string, failures: StyleFailure[]): void {
  const schemeChecks: Array<[string, string]> = [
    ["RIGHT_MARGIN", EXPECTED_LINE_LENGTH],
    ["WRAP_WHEN_TYPING_REACHES_RIGHT_MARGIN", "false"],
    ["AUTODETECT_INDENTS", "false"],
  ];
  for (const [key, expected] of schemeChecks) {
    const actual = xmlOption(xml, key);
    if (actual !== expected) {
      failures.push({ file: "Project.xml", key, expected, actual });
    }
  }

  const js = /<JSCodeStyleSettings[\s\S]*?<\/JSCodeStyleSettings>/.exec(xml)?.[0] ?? "";
  const ts = /<TypeScriptCodeStyleSettings[\s\S]*?<\/TypeScriptCodeStyleSettings>/.exec(xml)?.[0] ?? "";
  for (const [name, fragment] of [
    ["JS", js],
    ["TS", ts],
  ] as const) {
    for (const [key, expected] of [
      ["USE_DOUBLE_QUOTES", "true"],
      ["ENFORCE_TRAILING_COMMA", "Always"],
      // Prettier `semi` and `bracketSpacing`; the import-brace option is the
      // IDE side of the same bracket-spacing contract.
      ["FORCE_SEMICOLON_STYLE", "true"],
      ["SPACES_WITHIN_IMPORTS", "true"],
    ] as const) {
      const actual = xmlOption(fragment, key);
      if (actual !== expected) {
        failures.push({ file: `Project.xml:${name}`, key, expected, actual });
      }
    }
  }
}

/**
 * Check project code style XML completely: scheme options, JS/TS quote and
 * comma rules, then one linear pass over the language blocks mirroring the
 * file layout.
 */
function checkProjectXml(root: string, failures: StyleFailure[]): void {
  const path = join(root, ".idea", "codeStyles", "Project.xml");
  const xml = readFileSync(path, "utf8");
  checkSchemeAndJsTs(xml, failures);
  checkLanguageBlocks(xml, EXPECTED_LANGUAGES, failures);
}

/**
 * Run every style consistency check against a repository root.
 * @param root - repository root holding .editorconfig, .prettierrc, .idea/
 * @returns one entry per mismatch, in file order
 */
export function checkStyleConsistency(root: string): StyleFailure[] {
  const failures: StyleFailure[] = [];
  checkEditorConfig(root, failures);
  checkPrettierRc(root, failures);
  checkMarkdownlint(root, failures);
  checkProjectXml(root, failures);
  return failures;
}
