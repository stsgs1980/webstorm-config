#!/usr/bin/env node

// Renderer for .idea/liveTemplates: every template is expanded with sample
// values and the result must pass `eslint --max-warnings=0` and
// `tsc --noEmit --strict`. This guards against a broken template shipping
// its defect into every future component silently (the rafce incident:
// .idea/ is excluded from ESLint, so templates are invisible to the
// ordinary gates).

import { join } from "node:path";
import process from "node:process";
import { collectTemplates } from "./lib/live-templates.ts";
import { checkTemplates, removeRenderDir } from "./lib/templates-check.ts";

/**
 * Render, lint, typecheck every template; failures go to stderr, exit 1.
 * @returns {Promise<void>}
 */
async function main(): Promise<void> {
  const dir = process.argv[2] ?? join(".idea", "liveTemplates");
  let templates;
  try {
    templates = collectTemplates(dir);
  } catch (error) {
    console.error(`[FAIL] ${(error as Error).message}`);
    process.exitCode = 1;
    return;
  }
  const { files, failures } = await checkTemplates(templates);

  if (failures.length > 0 || files.length === 0) {
    if (files.length === 0) {
      failures.push(`[FAIL] check-templates: no templates in ${dir}.`);
    }
    for (const failure of failures) {
      console.error(failure);
    }
    console.error(`[Anti-Drift] templates checked: 0 of ${files.length} rendered cleanly.`);
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
  removeRenderDir();
}
