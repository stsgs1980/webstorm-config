#!/usr/bin/env node

/**
 * Verifies that `.editorconfig`, `.prettierrc` and
 * `.idea/codeStyles/Project.xml` agree on the core code style values:
 * indent size, continuation indent, tab width, line length, double quotes
 * and trailing comma. Every declared language is checked, not just the first.
 */

import process from "node:process";
import { checkStyleConsistency } from "./lib/style-consistency.ts";

const root = process.argv[2] ?? process.cwd();
const failures = checkStyleConsistency(root);

if (failures.length > 0) {
  console.error("Style consistency check failed:");
  for (const failure of failures) {
    console.error(`  ${failure.file}: ${failure.key} = ${failure.actual ?? "<missing>"}, expected ${failure.expected}`);
  }
  process.exit(1);
}

console.log("Style consistency check passed: .editorconfig, .prettierrc, Project.xml agree for all 24 languages.");
