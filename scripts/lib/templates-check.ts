/**
 * Render-and-verify pipeline for .idea/liveTemplates: every template is
 * expanded with sample values and the result must pass `eslint
 * --max-warnings=0` and `tsc --noEmit --strict`. The CLI script owns argv,
 * reporting and the exit code; this module owns the mechanics.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
// noinspection NpmUsedModulesInstalled
import { ESLint } from "eslint";
import { AMBIENT_DECLARATIONS } from "../check-templates-tables.ts";
import { render, unknownVariables, type LiveTemplate } from "./live-templates.ts";
import { tscFailureText } from "./tsc-output.ts";

const TSC = join("node_modules", "typescript", "lib", "tsc.js");
// No dot segment in the directory name: TypeScript include globs do not
// enter dotted directories, and with the type-aware lint layer the
// rendered files must be part of the tsconfig project. The pid suffix
// makes the directory private to this invocation: concurrent runs (IDE
// and console) must not delete each other's rendered files mid-flight.
const LEGACY_RENDER_DIR = join("dev", "templates-check");
const RENDER_DIR = join("dev", `templates-check-${process.pid}`);
/** Leftovers older than this are from a crashed run, not a concurrent one. */
const STALE_RENDER_MS = 60 * 60 * 1000;

/** One rendered template file: its path and its `set/name` label. */
interface RenderedFile {
  path: string;
  label: string;
}

/** Result of a full render-lint-typecheck pass. */
export interface TemplateCheckOutcome {
  files: RenderedFile[];
  failures: string[];
}

/**
 * Remove render directories abandoned by a crashed run. Fresh dirs are kept:
 * a concurrent checker may still be using them, and the pid suffix makes the
 * live one distinct from ours.
 */
function cleanupStaleRenderDirs(): void {
  if (!existsSync("dev")) {
    return;
  }
  for (const entry of readdirSync("dev", { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("templates-check-")) {
      continue;
    }
    const full = join("dev", entry.name);
    if (full === RENDER_DIR) {
      continue;
    }
    try {
      if (Date.now() - statSync(full).mtimeMs > STALE_RENDER_MS) {
        rmSync(full, { recursive: true, force: true });
      }
    } catch {
      // Another run removed it between readdir and stat.
    }
  }
}

/**
 * Skeleton exceptions: these templates intentionally render an empty block
 * (`try {}`, `for (...) {}`) that the user fills in. Only no-empty is
 * relaxed here; unused declarations are handled globally because a live
 * template is a fragment, not a complete module.
 */
const SKELETON_DISABLES: Record<string, string[]> = {
  "utilities/try": ["no-empty"],
  "utilities/for": ["no-empty"],
};

/**
 * Lint all rendered files with the repository config. Unused declarations are
 * expected in a fragment, so that one rule stays off; no-empty is relaxed per
 * template through SKELETON_DISABLES.
 * @param files - rendered file label/path pairs
 * @returns [FAIL] lines for every error message
 */
async function lint(files: RenderedFile[]): Promise<string[]> {
  const labels = new Map(files.map((item) => [join(process.cwd(), item.path), item.label]));
  const eslint = new ESLint({
    ignore: false,
    overrideConfigFile: "eslint.config.js",
    overrideConfig: [
      {
        rules: {
          "@typescript-eslint/no-unused-vars": "off",
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
function typecheck(files: RenderedFile[]): string[] {
  let output: string;
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
    output = tscFailureText(error);
  }
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => `[FAIL] ${line}`);
}

/**
 * Warn about template variables that fall back to 0: usually a missing entry
 * in the tables, not a deliberate value.
 * @param templates - parsed templates with their set and name
 */
function warnUnknownVariables(templates: LiveTemplate[]): void {
  for (const { set, name, value } of templates) {
    for (const variable of unknownVariables(set, name, value)) {
      console.error(`[WARN] ${set}/${name}: unknown variable $${variable}$ rendered as 0.`);
    }
  }
}

/**
 * Remove the render directory of this run. Called after every pass, success
 * or failure, so crashed-attempt leftovers never accumulate.
 */
export function removeRenderDir(): void {
  rmSync(RENDER_DIR, { recursive: true, force: true });
}

/**
 * The pipeline is linear: clean stale dirs, render every template, then lint
 * and typecheck all rendered files in one pass each.
 * @param templates - parsed templates with their set, name and sample values
 * @returns rendered files and combined lint/typecheck [FAIL] lines
 */
export async function checkTemplates(templates: LiveTemplate[]): Promise<TemplateCheckOutcome> {
  warnUnknownVariables(templates);
  // Leftovers of the shared pre-2026-11 era or of a crash with the same
  // pid would beat the tsconfig globs into the next program; remove first.
  cleanupStaleRenderDirs();
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

  const files: RenderedFile[] = [];
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
    const disables = SKELETON_DISABLES[label] ?? [];
    const header = disables.length > 0 ? `/* eslint-disable ${disables.join(", ")} -- template skeleton */\n` : "";
    const text = `${header}${body}export {};\n`;

    mkdirSync(join(RENDER_DIR, set), { recursive: true });
    const ext = set === "react" ? ".tsx" : ".ts";
    const path = join(RENDER_DIR, set, `${name}${ext}`);
    writeFileSync(path, text);
    // Ambient declarations live in one shared d.ts, inside the tsc program
    // only: duplicating them per file breaks the single tsc run.
    files.push({ path, label });
  }
  const ambient = join(RENDER_DIR, "ambient.d.ts");
  writeFileSync(ambient, `${AMBIENT_DECLARATIONS.map((line) => `${line}\n`).join("")}`);

  const lintFailures = await lint(files);
  const typecheckFailures = typecheck([...files, { path: ambient, label: "ambient" }]);
  return { files, failures: [...lintFailures, ...typecheckFailures] };
}
