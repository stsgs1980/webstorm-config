#!/usr/bin/env node

/**
 * Verifies that `.editorconfig`, `.prettierrc` and
 * `.idea/codeStyles/Project.xml` agree on the core code style values:
 * indent size, continuation indent, tab width, line length, double quotes
 * and trailing comma. Every declared language is checked, not just the first.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const ROOT = process.argv[2] ?? process.cwd();

const EXPECTED_LANGUAGES = new Set([
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

interface Failure {
  file: string;
  key: string;
  expected: string;
  actual: string | null;
}

const failures: Failure[] = [];

/**
 * Record a mismatch.
 * @param file - file being checked
 * @param key - option name
 * @param expected - required value
 * @param actual - found value
 */
function fail(file: string, key: string, expected: string, actual: string | null): void {
  failures.push({ file, key, expected, actual });
}

/**
 * Read a `[*]` section from .editorconfig.
 * @param content - file content
 * @returns key/value pairs of the universal section
 */
function parseEditorConfig(content: string): Record<string, string> {
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
 * Check the universal editorconfig section.
 */
function checkEditorConfig(): void {
  const path = join(ROOT, ".editorconfig");
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
      fail(".editorconfig", key, expected, actual);
    }
  }
}

/**
 * Check Prettier options.
 */
function checkPrettierRc(): void {
  const path = join(ROOT, ".prettierrc");
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
      fail(".prettierrc", key, expected, actual === null ? null : String(actual));
    }
  }
}

/**
 * Read an option from one XML fragment.
 * @param fragment - XML text
 * @param name - option name
 * @returns option value or null
 */
function option(fragment: string, name: string): string | null {
  return new RegExp(`<option name="${name}" value="([^"]*)"`).exec(fragment)?.[1] ?? null;
}

/**
 * Check one codeStyleSettings block.
 * @param language - block language
 * @param fragment - block body
 */
function checkLanguageBlock(language: string, fragment: string): void {
  const checks: Array<[string, string]> = [
    ["INDENT_SIZE", "2"],
    ["CONTINUATION_INDENT_SIZE", "2"],
    ["TAB_SIZE", "2"],
    ["USE_TAB_CHARACTER", "false"],
    ["SOFT_MARGINS", "120"],
  ];
  for (const [key, expected] of checks) {
    const actual = option(fragment, key);
    if (actual !== expected) {
      fail(`Project.xml:${language}`, key, expected, actual);
    }
  }
}

/**
 * Check project code style XML completely.
 */
function checkProjectXml(): void {
  const path = join(ROOT, ".idea", "codeStyles", "Project.xml");
  const xml = readFileSync(path, "utf8");

  const schemeChecks: Array<[string, string]> = [
    ["RIGHT_MARGIN", "120"],
    ["WRAP_WHEN_TYPING_REACHES_RIGHT_MARGIN", "false"],
    ["AUTODETECT_INDENTS", "false"],
  ];
  for (const [key, expected] of schemeChecks) {
    const actual = option(xml, key);
    if (actual !== expected) {
      fail("Project.xml", key, expected, actual);
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
      const actual = option(fragment, key);
      if (actual !== expected) {
        fail(`Project.xml:${name}`, key, expected, actual);
      }
    }
  }

  const blocks = [...xml.matchAll(/<codeStyleSettings language="([^"]+)">([\s\S]*?)<\/codeStyleSettings>/g)];
  const seen = new Set<string>();
  for (const [, language, fragment] of blocks) {
    if (seen.has(language)) {
      fail("Project.xml", `duplicate language ${language}`, "one block", "duplicate");
      continue;
    }
    seen.add(language);
    if (!EXPECTED_LANGUAGES.has(language)) {
      fail("Project.xml", `language ${language}`, "known language", "unexpected");
    }
    checkLanguageBlock(language, fragment);
  }
  for (const language of EXPECTED_LANGUAGES) {
    if (!seen.has(language)) {
      fail("Project.xml", `language ${language}`, "present", "missing");
    }
  }
}

checkEditorConfig();
checkPrettierRc();
checkProjectXml();

if (failures.length > 0) {
  console.error("Style consistency check failed:");
  for (const failure of failures) {
    console.error(`  ${failure.file}: ${failure.key} = ${failure.actual ?? "<missing>"}, expected ${failure.expected}`);
  }
  process.exit(1);
}

console.log("Style consistency check passed: .editorconfig, .prettierrc, Project.xml agree for all 24 languages.");
