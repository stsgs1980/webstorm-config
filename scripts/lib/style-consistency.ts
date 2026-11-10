/**
 * Parsers and checks for the style consistency gate: `.editorconfig`,
 * `.prettierrc` and `.idea/codeStyles/Project.xml` must agree on the core
 * code style values. Pure logic; the CLI script owns file output and exit.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

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
    ["indent_style", "space"],
    ["indent_size", "2"],
    ["tab_width", "2"],
    ["max_line_length", "120"],
    ["ij_continuation_indent_size", "2"],
    ["ij_visual_guides", "120"],
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
    ["printWidth", "120"],
    ["singleQuote", "false"],
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
 * Check one codeStyleSettings block.
 * @param language - block language
 * @param fragment - block body
 */
function checkLanguageBlock(language: string, fragment: string, failures: StyleFailure[]): void {
  const checks: Array<[string, string]> = [
    ["INDENT_SIZE", "2"],
    ["CONTINUATION_INDENT_SIZE", "2"],
    ["TAB_SIZE", "2"],
    ["USE_TAB_CHARACTER", "false"],
    ["SOFT_MARGINS", "120"],
  ];
  for (const [key, expected] of checks) {
    const actual = xmlOption(fragment, key);
    if (actual !== expected) {
      failures.push({ file: `Project.xml:${language}`, key, expected, actual });
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

  const schemeChecks: Array<[string, string]> = [
    ["RIGHT_MARGIN", "120"],
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
    ] as const) {
      const actual = xmlOption(fragment, key);
      if (actual !== expected) {
        failures.push({ file: `Project.xml:${name}`, key, expected, actual });
      }
    }
  }

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
    if (!EXPECTED_LANGUAGES.has(language)) {
      failures.push({
        file: "Project.xml",
        key: `language ${language}`,
        expected: "known language",
        actual: "unexpected",
      });
    }
    checkLanguageBlock(language, fragment, failures);
  }
  for (const language of EXPECTED_LANGUAGES) {
    if (!seen.has(language)) {
      failures.push({ file: "Project.xml", key: `language ${language}`, expected: "present", actual: "missing" });
    }
  }
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
  checkProjectXml(root, failures);
  return failures;
}
