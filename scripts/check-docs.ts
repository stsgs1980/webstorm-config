#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import process from "node:process";
import { checkDocFiles, getDocFiles } from "./lib/docs-check.ts";
import {
  checkBadges,
  checkDocsMap,
  checkInstallCoverage,
  collectConfigPackages,
  DOCS_MAP_MARKER,
} from "./lib/docs-lists.ts";
import { checkWiringTable, parseCiSources, parseHuskySources } from "./lib/docs-wiring.ts";
import { checkVersionAlignment } from "./lib/version-alignment.ts";

/**
 * Verify docs against configs: npm run names, Node.js version markers, real
 * paths, the wiring table against CI jobs and hooks, the docs map, README
 * badges and the migration install list.
 * @returns void; exits with code 1 on any violation
 */
function main(): void {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
    engines?: { node?: string };
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const nvmRaw = existsSync(".nvmrc") ? readFileSync(".nvmrc", "utf8").trim() : undefined;
  const files = getDocFiles();
  const failures: string[] = [];
  const engineMin = checkVersionAlignment(nvmRaw, pkg.engines?.node, failures);
  const readmeMarkers = checkDocFiles(files, pkg.scripts, engineMin, failures);

  if (readmeMarkers === 0) {
    failures.push("[FAIL] README.md has no Node.js badge marker for engines.node min.");
  }

  const gettingPath = "docs/getting-started.md";
  if (existsSync(gettingPath)) {
    const gettingText = readFileSync(gettingPath, "utf8");
    const ciPath = ".github/workflows/ci.yml";
    if (existsSync(ciPath)) {
      checkWiringTable(
        pkg.scripts,
        [...parseCiSources(readFileSync(ciPath, "utf8")), ...parseHuskySources()],
        gettingText,
        failures,
      );
    }
    checkInstallCoverage(gettingText, pkg, collectConfigPackages(), failures);
  }

  const readmeText = readFileSync("README.md", "utf8");
  if (readmeText.includes(DOCS_MAP_MARKER)) {
    checkDocsMap(
      readmeText,
      files.filter((file) => file.startsWith("docs/")),
      failures,
    );
  }
  const badgeEntries = ["README.md", "README.template.md"]
    .filter((file) => existsSync(file))
    .map((file) => ({ file, text: readFileSync(file, "utf8") }));
  checkBadges(badgeEntries, { ...pkg.dependencies, ...pkg.devDependencies }, failures);

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure);
    }
    process.exit(1);
  }

  process.stdout.write(`[OK] check-docs: ${files.length} docs files consistent with configs.\n`);
}

main();
