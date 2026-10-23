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

// With git tags present the chunk holds only commits since the newest tag;
// without tags the single chunk covers the whole history (fresh projects).
const hasTags = execSync("git tag -l", { encoding: "utf8" }).trim().length > 0;

// Generate into a draft first: a failed generator or formatter run must not
// leave the repository without CHANGELOG.md.
rmSync(DRAFT, { force: true });

try {
  execSync(`npx conventional-changelog -p angular -i ${DRAFT} -s`, { stdio: "inherit" });

  // Convert asterisk to dash for consistency with prettier.
  const chunk = readFileSync(DRAFT, "utf8").replace(/^\* /gm, "- ").trim();

  // After the release tag every already-published commit sits in previous
  // releases below, so an empty chunk means nothing to release: keep the
  // committed file byte-for-byte to make the CI diff check idempotent.
  if (hasTags && chunk === "") {
    rmSync(DRAFT, { force: true });
    process.stdout.write("CHANGELOG.md is up to date.\n");
    process.exit(0);
  }

  let combined;
  if (hasTags) {
    // Tags are present: prepend the newest release above the stored history
    // so old releases survive regeneration. Strip the duplicate header comment.
    const previousBody = previous.startsWith(`${MARKDOWNLINT_DISABLE}\n`)
      ? previous.slice(MARKDOWNLINT_DISABLE.length + 1).replace(/^\n+/, "")
      : previous;
    combined = previous
      ? `${MARKDOWNLINT_DISABLE}\n\n${chunk}\n\n${previousBody}`
      : `${MARKDOWNLINT_DISABLE}\n\n${chunk}\n`;
  } else {
    // Fresh untagged projects: the chunk covers the whole history, so replace.
    combined = `${MARKDOWNLINT_DISABLE}\n${chunk ? `\n${chunk}\n` : ""}`;
  }
  writeFileSync(DRAFT, combined);

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
