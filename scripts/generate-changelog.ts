#!/usr/bin/env node

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A shallow clone hides most of the git log, so the regenerated changelog would
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
const CONTEXT_FILE = join(tmpdir(), `wsc-changelog-context-${process.pid}.json`);
// Only semver tags name releases; milestone tags such as post-ide-rename are
// informational and must not switch the generator into release mode.
const TAG_GLOB = "v[0-9]*";

const previous = existsSync(CHANGELOG) ? readFileSync(CHANGELOG, "utf8").replace(/\r\n/g, "\n") : "";

// With semver tags present the chunk holds only commits since the newest tag;
// without tags the single chunk covers the whole history (fresh projects).
const hasTags = execFileSync("git", ["tag", "-l", TAG_GLOB], { encoding: "utf8" }).trim().length > 0;

/**
 * Release version from the newest reachable semver tag. The tag, not
 * package.json, names the release: a template package stays at 1.0.0 while
 * releases advance. Reading the version here also keeps the "Unreleased"
 * heading in sync when the tag differs from the package version.
 * @returns version without the leading "v", or an empty string without tags
 */
function releaseVersion(): string {
  if (!hasTags) {
    return "";
  }
  try {
    const tag = execFileSync("git", ["describe", "--tags", "--abbrev=0", "--match", TAG_GLOB], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return tag.replace(/^v/, "");
  } catch {
    return "";
  }
}

const version = releaseVersion();
const contextFlag = version === "" ? "" : ` -c "${CONTEXT_FILE}"`;
// -u prints the unreleased chunk, --stdout keeps it off the file system,
// --no-install never downloads a package, and -c passes the tag version.
const CHANGELOG_COMMAND = `npx --no-install conventional-changelog -p angular -u --stdout -i "${CHANGELOG_INPUT}"${contextFlag}`;

rmSync(CONTEXT_FILE, { force: true });
if (version !== "") {
  writeFileSync(CONTEXT_FILE, JSON.stringify({ version }));
}
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
  return text.replace(/^# (?:\[Unreleased\]|Unreleased)[^\n]*$/m, "# Unreleased");
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

  return /^# v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/.exec(line)?.[1] ?? null;
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
  let chunk = stableHeader(generated).replace(/^\* /gm, "- ").trim();
  // The writer always renders the title, so a header-only chunk is not empty:
  // release mode must look for section headings, not for an empty string.
  const hasSections = /^### /m.test(chunk);
  if (!hasSections) {
    if (hasTags) {
      process.stdout.write("CHANGELOG.md is up to date.\n");
      process.exit(0);
    }
    // A fresh untagged project has no released history: the file is just the
    // markdownlint marker, not a "1.0.0" heading with today's date.
    chunk = "";
  }

  let combined;
  if (hasTags) {
    // Tags are present: the regenerated block replaces its own previous copy
    // and keeps the released history below.
    const previousBody = previous.startsWith(MARKDOWNLINT_DISABLE)
      ? previous.slice(MARKDOWNLINT_DISABLE.length).replace(/^\n+/, "")
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
  rmSync(CONTEXT_FILE, { force: true });
  process.stderr.write("Changelog generation failed; CHANGELOG.md was left untouched.\n");
  throw error;
}

renameSync(DRAFT, CHANGELOG);
rmSync(CONTEXT_FILE, { force: true });

const updated = readFileSync(CHANGELOG, "utf8").replace(/\r\n/g, "\n");

if (updated === previous) {
  process.stdout.write("CHANGELOG.md is up to date.\n");
} else {
  process.stdout.write(
    `\nCHANGELOG.md updated. Commit it:\n  git add CHANGELOG.md && git commit -m "docs: update changelog"\n`,
  );
}
