#!/usr/bin/env node

/**
 * Verifies that configuration files which mirror shared values agree:
 * `.editorconfig`, `.prettierrc` and `.idea/codeStyles/Project.xml` on the
 * core code style (indent, quotes, semicolons, bracket spacing, trailing
 * comma, line length, end of line), and
 * `.idea/inspectionProfiles/Project_Default.xml` on the anti-monolith
 * thresholds owned by `scripts/lib/thresholds.ts`. Every declared language
 * is checked, not just the first.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { checkInspectionProfile } from "./lib/inspection-profile.ts";
import { checkStyleConsistency } from "./lib/style-consistency.ts";

const root = process.argv[2] ?? process.cwd();
const failures = checkStyleConsistency(root);
const profilePath = join(root, ".idea", "inspectionProfiles", "Project_Default.xml");
const profileFailures = checkInspectionProfile(readFileSync(profilePath, "utf8"));

if (failures.length > 0 || profileFailures.length > 0) {
  console.error("Style consistency check failed:");
  for (const failure of failures) {
    console.error(`  ${failure.file}: ${failure.key} = ${failure.actual ?? "<missing>"}, expected ${failure.expected}`);
  }
  for (const failure of profileFailures) {
    console.error(
      `  Project_Default.xml: ${failure.inspection}.${failure.option} = ${failure.actual ?? "<missing>"},` +
        ` expected ${failure.expected}`,
    );
  }
  process.exit(1);
}

console.log(
  "Style consistency check passed: .editorconfig, .prettierrc, Project.xml and the inspection profile agree" +
    " for all 24 languages.",
);
