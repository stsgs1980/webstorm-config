#!/usr/bin/env node

/**
 * Generate the repository reference for the machine-level schemes from the
 * project-level sources in `.idea/`.
 *
 * `.idea/` is the single place where values are edited by hand;
 * `generated/ide-reference/` is derived from it and must be regenerated (and
 * committed together with the `.idea/` change) after every such edit:
 *
 *   npm run gen:ide-reference
 *
 * The gate (`npm run check:ide-state`) verifies that the committed copy is
 * fresh, and `npm run sync:ide` deploys it to `%APPDATA%` together with the
 * scheme pointers.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { BUILDERS, IDEA_SOURCES } from "./lib/ide-reference.ts";
import { SCHEME_FILE, SCHEME_GROUPS } from "./lib/ide-state.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUTPUT_ROOT = join(ROOT, "generated", "ide-reference");

/**
 * Read every project source file and build the machine file contents.
 * @returns built content per scheme group
 */
const buildAll = (): Map<string, string> => {
  const built = new Map<string, string>();
  for (const group of SCHEME_GROUPS) {
    const source = readFileSync(join(ROOT, IDEA_SOURCES[group]), "utf8");
    built.set(group, BUILDERS[group](source));
  }
  return built;
};

const main = (): number => {
  try {
    for (const [group, content] of buildAll()) {
      const target = join(OUTPUT_ROOT, group, SCHEME_FILE);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content, "utf8");
      console.log(`[OK] ${target}`);
    }
    return 0;
  } catch (error) {
    console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
};

process.exit(main());
