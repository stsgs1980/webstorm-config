#!/usr/bin/env node

/**
 * Prettier conflict gate. Resolves every representative zone of
 * `eslint.config.js` first: a representative that falls back to an empty
 * config would make the CLI report green while checking nothing. Then hands
 * the same set to the eslint-config-prettier CLI, whose exit code 2 means a
 * rule conflicts with Prettier.
 */

import { execFileSync } from "node:child_process";
import process from "node:process";
// noinspection NpmUsedModulesInstalled
import { ESLint } from "eslint";
import { findUnresolvedTargets, PRETTIER_CONFLICT_CLI, PRETTIER_CONFLICT_TARGETS } from "./lib/prettier-conflicts.ts";

/**
 * Check the representative set, then run the conflict detector.
 * @returns void; exits with the CLI status on a conflict
 */
async function main(): Promise<void> {
  const eslint = new ESLint({ cwd: process.cwd() });
  const unresolved = await findUnresolvedTargets(eslint);
  if (unresolved.length > 0) {
    console.error("Prettier conflict gate cannot resolve representatives:");
    for (const entry of unresolved) {
      console.error(`  ${entry}: no enabled rules, the zone is not covered by eslint.config.js`);
    }
    process.exit(1);
  }
  try {
    execFileSync(process.execPath, [PRETTIER_CONFLICT_CLI, ...PRETTIER_CONFLICT_TARGETS.map(({ path }) => path)], {
      stdio: "inherit",
    });
  } catch (error) {
    const status = (error as { status?: unknown }).status;
    process.exit(typeof status === "number" ? status : 1);
  }
}

await main();
