#!/usr/bin/env node

// Renderer for .idea/liveTemplates: every template is expanded with sample
// values and the result must pass `eslint --max-warnings=0` and
// `tsc --noEmit --strict`. This guards against a broken template shipping
// its defect into every future component silently (the rafce incident:
// .idea/ is excluded from ESLint, so templates are invisible to the
// ordinary gates).

import { join } from "node:path";
import process from "node:process";
import { checkFileTemplates } from "./lib/file-templates.ts";
import { collectTemplates } from "./lib/live-templates.ts";
import { checkTemplates, removeRenderDir, type TemplateCheckOutcome } from "./lib/templates-check.ts";

/**
 * Report file-template failures and decide whether the gate may continue.
 * @param result - outcome of the file-template check
 * @returns true when every file template passed
 */
function fileTemplatesPassed(result: ReturnType<typeof checkFileTemplates>): boolean {
  if (result.failures.length === 0) {
    return true;
  }
  for (const failure of result.failures) {
    console.error(failure);
  }
  console.error(`[Anti-Drift] file templates checked: 0 of ${result.checked} passed.`);
  return false;
}

/**
 * Collect, render and verify every live template; failures go to stderr.
 * @param dir - live template directory
 * @returns the rendered outcome, or null when verification failed
 */
async function checkLiveTemplates(dir: string): Promise<TemplateCheckOutcome | null> {
  let templates;
  try {
    templates = collectTemplates(dir);
  } catch (error) {
    console.error(`[FAIL] ${(error as Error).message}`);
    return null;
  }
  const outcome = await checkTemplates(templates);
  if (outcome.failures.length > 0 || outcome.files.length === 0) {
    if (outcome.files.length === 0) {
      outcome.failures.push(`[FAIL] check-templates: no templates in ${dir}.`);
    }
    for (const failure of outcome.failures) {
      console.error(failure);
    }
    console.error(`[Anti-Drift] templates checked: 0 of ${outcome.files.length} rendered cleanly.`);
    return null;
  }
  return outcome;
}

/**
 * Render, lint, typecheck every template; failures go to stderr, exit 1.
 * @returns {Promise<void>}
 */
async function main(): Promise<void> {
  const dir = process.argv[2] ?? join(".idea", "liveTemplates");
  const fileDir = process.argv[3] ?? join(".idea", "fileTemplates");
  const fileTemplates = checkFileTemplates(fileDir);
  if (!fileTemplatesPassed(fileTemplates)) {
    process.exitCode = 1;
    return;
  }
  const outcome = await checkLiveTemplates(dir);
  if (outcome === null) {
    process.exitCode = 1;
    return;
  }
  for (const { label } of outcome.files) {
    process.stdout.write(`[OK] ${label}: rendered, eslint OK, tsc OK\n`);
  }
  process.stdout.write(`[OK] templates checked: ${outcome.files.length}\n`);
  process.stdout.write(`[OK] file templates checked: ${fileTemplates.checked}\n`);
}

try {
  await main();
} finally {
  removeRenderDir();
}
