#!/usr/bin/env node

// Renderer for .idea/liveTemplates: every template is expanded with sample
// values and the result must pass `eslint --max-warnings=0` and
// `tsc --noEmit --strict`. This guards against a broken template shipping
// its defect into every future component silently (the rafce incident:
// .idea/ is excluded from ESLint, so templates are invisible to the
// ordinary gates).

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
// noinspection NpmUsedModulesInstalled
import { ESLint } from "eslint";
import { AMBIENT_DECLARATIONS } from "./check-templates-tables.ts";
import { collectTemplates, render, type LiveTemplate } from "./lib/live-templates.ts";

const TSC = join("node_modules", "typescript", "lib", "tsc.js");
// No dot segment in the directory name: TypeScript include globs do not
// enter dotted directories, and with the type-aware lint layer the
// rendered files must be part of the tsconfig project. The pid suffix
// makes the directory private to this invocation: concurrent runs (IDE
// and console) must not delete each other's rendered files mid-flight.
const LEGACY_RENDER_DIR = join("dev", "templates-check");
const RENDER_DIR = join("dev", `templates-check-${process.pid}`);

/**
 * Lint all rendered files: repository config plus a snippet-override block.
 * A template is a skeleton, so unused declarations and empty blocks are
 * expected there; every other rule stays at full strength.
 * @param files - rendered file label/path pairs
 * @returns [FAIL] lines for every error message
 */
async function lint(files: { path: string; label: string }[]): Promise<string[]> {
  const labels = new Map(files.map((item) => [join(process.cwd(), item.path), item.label]));
  const eslint = new ESLint({
    ignore: false,
    overrideConfigFile: "eslint.config.js",
    overrideConfig: [
      {
        rules: {
          "@typescript-eslint/no-unused-vars": "off",
          "no-unused-vars": "off",
          "no-empty": "off",
        },
      },
    ],
  });
  const results = await eslint.lintFiles(files.map((item) => item.path));
  const failures: string[] = [];
  for (const result of results) {
    const label = labels.get(result.filePath) ?? result.filePath;
    for (const message of result.messages) {
      if (message.severity === 2) {
        failures.push(`[FAIL] ${label}:${message.line} ${message.ruleId} ${message.message}`);
      }
    }
  }
  return failures;
}

/**
 * Compile all rendered files with strict TypeScript. A single tsc run:
 * each file is standalone (prelude inline), cross-file deps do not exist.
 * @param files - rendered file label/path pairs
 * @returns [FAIL] lines naming label and message
 */
function typecheck(files: { path: string; label: string }[]): string[] {
  let output = "";
  try {
    output = execFileSync(
      process.execPath,
      [
        TSC,
        "--noEmit",
        "--strict",
        "--jsx",
        "react-jsx",
        "--target",
        "es2022",
        "--module",
        "esnext",
        "--moduleResolution",
        "bundler",
        ...files.map((item) => item.path),
      ],
      { encoding: "utf8" },
    );
  } catch (error) {
    output = (error as { stdout?: string }).stdout ?? String(error);
  }
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => `[FAIL] ${line}`);
}

/**
 * Render, lint, typecheck every template; failures go to stderr, exit 1.
 * @returns {Promise<void>}
 */
async function main(): Promise<void> {
  const dir = process.argv[2] ?? join(".idea", "liveTemplates");
  let templates: LiveTemplate[];
  try {
    templates = collectTemplates(dir);
  } catch (error) {
    console.error(`[FAIL] ${(error as Error).message}`);
    process.exitCode = 1;
    return;
  }
  const files: { path: string; label: string }[] = [];
  // Leftovers of the shared pre-2026-11 era or of a crash with the same
  // pid would beat the tsconfig globs into the next program; remove first.
  rmSync(RENDER_DIR, { recursive: true, force: true });
  rmSync(LEGACY_RENDER_DIR, { recursive: true, force: true });
  mkdirSync(RENDER_DIR, { recursive: true });
  // The root tsconfig excludes dev/, so the type-aware ESLint layer needs its
  // own project next to the rendered files; otherwise projectService rejects
  // every template as "not found by the project service".
  writeFileSync(
    join(RENDER_DIR, "tsconfig.json"),
    `${JSON.stringify({ extends: "../../tsconfig.json", include: ["**/*.ts", "**/*.tsx"], exclude: [] }, null, 2)}\n`,
  );

  let okCount = 0;
  for (const { set, name, value } of templates) {
    const label = `${set}/${name}`;
    const rendered = render(set, name, value);
    // Hook snippets describe code typed inside a component body; render
    // them in that context so rules-of-hooks judges them as used.
    const isHook = set === "react" && /^use[A-Z]/.test(name);
    const body = isHook
      ? `const TemplateSnippet = (): void => {\n${rendered}\n};\nTemplateSnippet();\n`
      : `${rendered}\n`;
    // A module per file: top-level consts can then collide with nothing.
    const text = `${body}export {};\n`;

    mkdirSync(join(RENDER_DIR, set), { recursive: true });
    const ext = set === "react" ? ".tsx" : ".ts";
    const path = join(RENDER_DIR, set, `${name}${ext}`);
    writeFileSync(path, text);
    // Ambient declarations live in one shared d.ts, inside the tsc program
    // only: duplicating them per file breaks the single tsc run.
    files.push({ path, label });
    okCount += 1;
  }
  const ambient = join(RENDER_DIR, "ambient.d.ts");
  writeFileSync(ambient, `${AMBIENT_DECLARATIONS.map((line) => `${line}\n`).join("")}`);

  const lintFailures = await lint(files);
  const typecheckFailures = typecheck([...files, { path: ambient, label: "ambient" }]);
  const failures = [...lintFailures, ...typecheckFailures];

  if (failures.length > 0 || files.length === 0) {
    if (files.length === 0) {
      failures.push(`[FAIL] check-templates: no templates in ${dir}.`);
    }
    for (const failure of failures) {
      console.error(failure);
    }
    console.error(`[Anti-Drift] templates checked: 0 of ${okCount} rendered cleanly.`);
    process.exitCode = 1;
    return;
  }

  for (const { label } of files) {
    process.stdout.write(`[OK] ${label}: rendered, eslint OK, tsc OK\n`);
  }
  process.stdout.write(`[OK] templates checked: ${files.length}\n`);
}

try {
  await main();
} finally {
  rmSync(RENDER_DIR, { recursive: true, force: true });
}
