#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

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

const MARKDOWNLINT_DISABLE = "<!-- markdownlint-disable -->";
// WebStorm hints (spelling, Grazie, LongLine) on quoted historical commit text.
const IDE_SUPPRESS = "<!-- noinspection GrazieInspection,GrazieStyle,LongLine,SpellCheckingInspection -->";

const previous = existsSync("CHANGELOG.md") ? readFileSync("CHANGELOG.md", "utf8").replace(/\r\n/g, "\n") : "";

rmSync("CHANGELOG.md", { force: true });
execSync("npx conventional-changelog -p angular -i CHANGELOG.md -s", { stdio: "inherit" });

// Convert asterisk to dash for consistency with prettier.
const generated = readFileSync("CHANGELOG.md", "utf8").replace(/^\* /gm, "- ");
writeFileSync("CHANGELOG.md", `${MARKDOWNLINT_DISABLE}\n${IDE_SUPPRESS}\n${generated}`);

execSync("npx prettier --write CHANGELOG.md", { stdio: "inherit" });

const updated = readFileSync("CHANGELOG.md", "utf8").replace(/\r\n/g, "\n");

if (updated === previous) {
  process.stdout.write("CHANGELOG.md is up to date.\n");
} else {
  process.stdout.write(
    `\nCHANGELOG.md updated. Commit it:\n  git add CHANGELOG.md && git commit -m "docs: update changelog"\n`,
  );
}
