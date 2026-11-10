#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import process from "node:process";
import { checkDocFiles, getDocFiles } from "./lib/docs-check.ts";
import { checkVersionAlignment } from "./lib/version-alignment.ts";

/**
 * Verify docs against configs: npm run names, Node.js version markers, real paths.
 * @returns void; exits with code 1 on any violation
 */
function main(): void {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
    engines?: { node?: string };
  };
  const nvmRaw = existsSync(".nvmrc") ? readFileSync(".nvmrc", "utf8").trim() : undefined;
  const files = getDocFiles();
  const failures: string[] = [];
  const engineMin = checkVersionAlignment(nvmRaw, pkg.engines?.node, failures);
  const readmeMarkers = checkDocFiles(files, pkg.scripts, engineMin, failures);

  if (readmeMarkers === 0) {
    failures.push("[FAIL] README.md has no Node.js badge marker for engines.node min.");
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure);
    }
    process.exit(1);
  }

  process.stdout.write(`[OK] check-docs: ${files.length} docs files consistent with configs.\n`);
}

main();
