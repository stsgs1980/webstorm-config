// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { platform, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";
import { gitEnv } from "./lib/git-env.mjs";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const NODE_MODULES = join(REPO_ROOT, "node_modules");
const MARKER = "<!-- markdownlint-disable -->";
const GIT_IDENTITY = [
  ["user.name", "test"],
  ["user.email", "test@example.com"],
  ["commit.gpgsign", "false"],
  ["core.autocrlf", "false"],
];

/**
 * Run git in a fixture repository.
 * @param {string} cwd - repository path
 * @param {string[]} args - git arguments
 * @param {"pipe"|"ignore"} [stdio] - stdio mode
 * @returns {string} stdout
 */
const git = (cwd, args, stdio = "pipe") => execFileSync("git", args, { cwd, env: gitEnv(), encoding: "utf8", stdio });

/**
 * Copy every tracked file of this repository into a fixture.
 * @param {string} target - destination directory
 * @returns {void}
 */
const copyTracked = (target) => {
  const listed = execFileSync("git", ["-c", "core.quotepath=false", "ls-files", "-z"], {
    cwd: REPO_ROOT,
    env: gitEnv(),
  });
  for (const file of listed.toString("utf8").split("\0")) {
    if (file === "") {
      continue;
    }
    const destination = join(target, file);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(REPO_ROOT, file), destination);
  }
};

/**
 * Create an untagged fixture repository with a node_modules junction.
 * @param {string} target - empty destination directory
 * @returns {void}
 */
const initFixture = (target) => {
  symlinkSync(NODE_MODULES, join(target, "node_modules"), platform() === "win32" ? "junction" : "dir");
  git(target, ["init", "-q"], "ignore");
  for (const [key, value] of GIT_IDENTITY) {
    git(target, ["config", key, value], "ignore");
  }
  git(target, ["add", "-A"], "ignore");
  git(target, ["commit", "-q", "-m", "Initial commit"], "ignore");
};

/**
 * Apply Step 1 of docs/getting-started.md.
 * @param {string} target - fixture repository
 * @returns {void}
 */
const applyStepOne = (target) => {
  copyFileSync(join(target, "README.template.md"), join(target, "README.md"));
  writeFileSync(join(target, "CHANGELOG.md"), MARKER + "\n");
  rmSync(join(target, "docs", "kickoff.md"), { force: true });
  rmSync(join(target, "docs", "audit-recommendations.md"), { force: true });
  renameSync(join(target, ".idea", "webstorm-config.iml"), join(target, ".idea", "my-project.iml"));
  const modules = join(target, ".idea", "modules.xml");
  writeFileSync(modules, readFileSync(modules, "utf8").replaceAll("webstorm-config.iml", "my-project.iml"));
  const pkgPath = join(target, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.name = "my-project";
  pkg.repository.url = "https://github.com/example/my-project.git";
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  git(target, ["add", "-A"], "ignore");
  git(target, ["commit", "-q", "-m", "chore: reset template files"], "ignore");
};

/**
 * Run the changelog generator in a fixture.
 * @param {string} cwd - fixture repository
 * @returns {string} stdout
 */
const runGenerator = (cwd) =>
  execFileSync(process.execPath, [join(cwd, "scripts", "generate-changelog.ts")], {
    cwd,
    env: gitEnv(),
    encoding: "utf8",
    timeout: 180000,
  });

describe("fork simulation", () => {
  it("Step 1 оставляет гейты и changelog зелёными", { timeout: 180000 }, () => {
    const dir = mkdtempSync(join(tmpdir(), "wsc-fork-sim-"));
    try {
      copyTracked(dir);
      initFixture(dir);
      applyStepOne(dir);

      const docs = execFileSync(process.execPath, [join(dir, "scripts", "check-docs.ts")], {
        cwd: dir,
        env: gitEnv(),
        encoding: "utf8",
      });
      assert.match(docs, /\[OK\] check-docs: \d+ docs files consistent with configs\./);

      let ignoreStatus = 0;
      try {
        git(dir, ["check-ignore", "-q", ".idea/my-project.iml"], "ignore");
      } catch (error) {
        ignoreStatus = error.status ?? 1;
      }
      assert.equal(ignoreStatus, 1, "the renamed .iml must not be ignored");
      assert.doesNotThrow(() => git(dir, ["ls-files", "--error-unmatch", ".idea/my-project.iml"], "ignore"));

      assert.match(runGenerator(dir), /up to date/);
      const first = readFileSync(join(dir, "CHANGELOG.md"), "utf8");
      assert.equal(first, MARKER + "\n");
      assert.match(runGenerator(dir), /up to date/);
      assert.equal(readFileSync(join(dir, "CHANGELOG.md"), "utf8"), first);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
