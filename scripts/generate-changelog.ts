#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
// conventional-changelog 8 appends the --infile content to the generated
// release. Pointing it at the draft or at the previous CHANGELOG mixes released
// history into the chunk and changes the output on every run, so the chunk is
// generated from git only: the input path below never exists, and the
// generator leaves it untouched.
const CHANGELOG_INPUT = join(tmpdir(), `wsc-changelog-input-${process.pid}.md`);
// -u prints the unreleased chunk, --stdout keeps it off the file system, and
// --no-install never downloads a package behind the user's back.
const CHANGELOG_COMMAND = `npx --no-install conventional-changelog -p angular -u --stdout -i "${CHANGELOG_INPUT}"`;

const previous = existsSync(CHANGELOG) ? readFileSync(CHANGELOG, "utf8").replace(/\r\n/g, "\n") : "";

// With git tags present the chunk holds only commits since the newest tag;
// without tags the single chunk covers the whole history (fresh projects).
const hasTags = execSync("git tag -l", { encoding: "utf8" }).trim().length > 0;

rmSync(DRAFT, { force: true });
rmSync(CHANGELOG_INPUT, { force: true });

/**
 * Drop the volatile parts of the unreleased heading. The writer puts the
 * compare link with the current commit and the generation date there, and both
 * differ on every run; the CI freshness check compares the regenerated text
 * with the committed file, so a volatile heading could never pass it. Released
 * blocks are not regenerated, so their dates stay frozen.
 * @param text - generated chunk
 * @returns chunk with a stable "# Unreleased" heading
 */
function stableHeader(text: string): string {
  return text.replace(/^# \[Unreleased\][^\n]*$/m, "# Unreleased");
}

/**
 * Heading identity of a changelog block: "unreleased" for both heading forms,
 * the version for a release, null for any other line.
 * @param line - one line of markdown
 * @returns block key or null
 */
function blockKey(line: string): string | null {
  if (/^# (?:\[Unreleased\]|Unreleased)(?:\s|$)/.test(line)) {
    return "unreleased";
  }

  return /^# (\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/.exec(line)?.[1] ?? null;
}

/**
 * Remove the block that the regenerated chunk replaces. Prepending alone would
 * duplicate the same release or unreleased section on a rerun, and the CI
 * freshness check would fail on every run after the first.
 * @param text - stored changelog body without the markdownlint header
 * @param chunk - regenerated chunk
 * @returns body with the replaced block removed
 */
function withoutReplacedBlock(text: string, chunk: string): string {
  const key = blockKey(chunk.split("\n", 1)[0] ?? "");

  if (key === null) {
    return text;
  }

  const lines = text.split("\n");
  const start = lines.findIndex((line) => blockKey(line) === key);

  if (start === -1) {
    return text;
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (blockKey(lines[index]) !== null) {
      end = index;
      break;
    }
  }

  return [...lines.slice(0, start), ...lines.slice(end)]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

try {
  const generated = execSync(CHANGELOG_COMMAND, { encoding: "utf8" });
  // Convert asterisk to dash for consistency with prettier.
  const chunk = stableHeader(generated).replace(/^\* /gm, "- ").trim();

  // After the release tag every already-published commit sits in previous
  // releases below, so an empty chunk means nothing to release: keep the
  // committed file byte-for-byte to make the CI diff check idempotent.
  if (hasTags && chunk === "") {
    process.stdout.write("CHANGELOG.md is up to date.\n");
    process.exit(0);
  }

  let combined;
  if (hasTags) {
    // Tags are present: the regenerated block replaces its own previous copy
    // and keeps the released history below.
    const previousBody = previous.startsWith(`${MARKDOWNLINT_DISABLE}\n`)
      ? previous.slice(MARKDOWNLINT_DISABLE.length + 1).replace(/^\n+/, "")
      : previous;
    const rest = withoutReplacedBlock(previousBody, chunk).trim();
    combined = rest ? `${MARKDOWNLINT_DISABLE}\n\n${chunk}\n\n${rest}\n` : `${MARKDOWNLINT_DISABLE}\n\n${chunk}\n`;
  } else {
    // Fresh untagged projects: the chunk covers the whole history, so replace.
    combined = `${MARKDOWNLINT_DISABLE}\n${chunk ? `\n${chunk}\n` : ""}`;
  }
  writeFileSync(DRAFT, combined);

  // The draft has no known extension, so the prettier parser is explicit.
  execSync(`npx --no-install prettier --write --parser markdown ${DRAFT}`, { stdio: "inherit" });
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
