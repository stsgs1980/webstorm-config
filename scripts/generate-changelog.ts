#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";

// A shallow clone hides most of git log, so the regenerated changelog would
// silently drop old releases.
const isShallowClone = execSync("git rev-parse --is-shallow-repository", { encoding: "utf8" }).trim() === "true";

if (isShallowClone) {
  process.stderr.write(
    "Shallow clone detected: the regenerated changelog would silently drop old releases.\n" +
      "Run `git fetch --unshallow` and try again.\n",
  );
  process.exit(1);
}

const CHANGELOG = "CHANGELOG.md";
const DRAFT = `${CHANGELOG}.tmp`;
const MARKDOWNLINT_DISABLE = "<!-- markdownlint-disable -->";

const previous = existsSync(CHANGELOG) ? readFileSync(CHANGELOG, "utf8").replace(/\r\n/g, "\n") : "";

// Generate into a draft first: a failed generator or formatter run must not
// leave the repository without CHANGELOG.md.
rmSync(DRAFT, { force: true });

try {
  execSync(`npx conventional-changelog -p angular -i ${DRAFT} -s`, { stdio: "inherit" });

  // Convert asterisk to dash for consistency with prettier.
  const generated = readFileSync(DRAFT, "utf8").replace(/^\* /gm, "- ");
  writeFileSync(DRAFT, `${MARKDOWNLINT_DISABLE}\n${generated}`);

  // The draft has no known extension, so the prettier parser is explicit.
  execSync(`npx prettier --write --parser markdown ${DRAFT}`, { stdio: "inherit" });
} catch (error) {
  rmSync(DRAFT, { force: true });
  process.stderr.write("Changelog generation failed; CHANGELOG.md was left untouched.\n");
  throw error;
}

renameSync(DRAFT, CHANGELOG);

const updated = readFileSync(CHANGELOG, "utf8").replace(/\r\n/g, "\n");

if (updated === previous) {
  process.stdout.write("CHANGELOG.md is up to date.\n");
} else {
  process.stdout.write(
    `\nCHANGELOG.md updated. Commit it:\n  git add CHANGELOG.md && git commit -m "docs: update changelog"\n`,
  );
}
