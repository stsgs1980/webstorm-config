// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";
import { requiresChangelogEntry } from "../scripts/lib/changelog-entry.ts";
import { parseCiSources } from "../scripts/lib/docs-wiring.ts";
import { gitEnv } from "./lib/git-env.mjs";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const SCRIPT = join(REPO, "scripts", "check-changelog-entry.ts");
const GIT_IDENTITY = [
  ["user.name", "test"],
  ["user.email", "test@example.com"],
  ["commit.gpgsign", "false"],
];

/**
 * Create a throwaway repository whose last commit is the tested message.
 * @param {string[]} messages - commit subjects, oldest first
 * @returns {string} repository path
 */
const makeRepo = (messages) => {
  const dir = mkdtempSync(join(tmpdir(), "wsc-entry-"));
  const git = (args) => execFileSync("git", args, { cwd: dir, env: gitEnv(), encoding: "utf8", stdio: "ignore" });
  git(["init", "-q"]);
  for (const [key, value] of GIT_IDENTITY) {
    git(["config", key, value]);
  }
  for (const message of messages) {
    git(["commit", "--allow-empty", "-q", "-m", message]);
  }
  return dir;
};

/**
 * Classify the newest commit of a fixture repository through the CLI.
 * @param {string} dir - fixture repository
 * @returns {string} "entry-required" or "skip"
 */
const classify = (dir) =>
  execFileSync(process.execPath, [SCRIPT, "HEAD~1..HEAD"], {
    cwd: dir,
    env: gitEnv(),
    encoding: "utf8",
  }).trim();

describe("requiresChangelogEntry", () => {
  it("revert требует записи в changelog", () => {
    assert.equal(requiresChangelogEntry('revert: "feat: add the gate"\n', ""), true);
  });

  it("chore, docs и ci записи не требуют", () => {
    assert.equal(requiresChangelogEntry("chore: bump deps\ndocs: fix a typo\nci: pin node\n", ""), false);
  });

  it("BREAKING CHANGE footer требует записи", () => {
    assert.equal(requiresChangelogEntry("chore: drop the old api", "BREAKING CHANGE: the old api is gone\n"), true);
  });

  it("scoped и breaking fix ловятся", () => {
    assert.equal(requiresChangelogEntry("fix(tooling)!: drop node 20\n", ""), true);
  });
});

describe("check-changelog-entry CLI", () => {
  it("revert-only PR требует записи", { timeout: 60000 }, () => {
    const dir = makeRepo(["chore: initial", 'revert: "feat: add the gate"']);
    try {
      assert.equal(classify(dir), "entry-required");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("chore-only PR пропускает гейт", { timeout: 60000 }, () => {
    const dir = makeRepo(["chore: initial", "chore: bump deps"]);
    try {
      assert.equal(classify(dir), "skip");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("changelog CI job", () => {
  it("спрашивает тот же скрипт, который покрыт тестами", () => {
    const ci = readFileSync(join(REPO, ".github", "workflows", "ci.yml"), "utf8");
    const steps = parseCiSources(ci).filter((source) => source.name === "changelog");
    assert.ok(steps.length > 0, "ci.yml must have a changelog job");
    assert.ok(
      steps.some((step) => step.text.includes("node scripts/check-changelog-entry.ts")),
      "the changelog job must call the entry classifier",
    );
  });
});
