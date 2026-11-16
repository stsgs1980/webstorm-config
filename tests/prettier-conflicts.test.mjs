// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { ESLint } from "eslint";
// noinspection NpmUsedModulesInstalled
import { afterEach, describe, it } from "vitest";
import { isRuleEnabled, PRETTIER_CONFLICT_TARGETS } from "../scripts/lib/prettier-conflicts.ts";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const SCRIPT = join(REPO, "scripts", "check-prettier-conflicts.ts");
const CLI = join(REPO, "node_modules", "eslint-config-prettier", "bin", "cli.js");

/** Temp directories created by the current test, removed in afterEach. */
const tempDirs = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

/**
 * Resolve the flat config ESLint computes for each representative path.
 * @returns {Promise<Map<string, object>>} path to config
 */
const resolveConfigs = async () => {
  const eslint = new ESLint({ cwd: REPO });
  const configs = new Map();
  for (const { path } of PRETTIER_CONFLICT_TARGETS) {
    configs.set(path, await eslint.calculateConfigForFile(path));
  }
  return configs;
};

/**
 * Build a fixture with the repository `node_modules` and one config file.
 * @param {string} name - temp directory prefix
 * @param {string} config - eslint.config.js content
 * @returns {string} fixture directory
 */
const newConfigFixture = (name, config) => {
  const dir = mkdtempSync(join(tmpdir(), name));
  tempDirs.push(dir);
  symlinkSync(join(REPO, "node_modules"), join(dir, "node_modules"), "junction");
  writeFileSync(join(dir, "eslint.config.js"), config);
  return dir;
};

describe("prettier conflict targets", () => {
  it("каждый представитель попадает в блок конфига с включёнными правилами", async () => {
    for (const [path, config] of await resolveConfigs()) {
      const enabled = Object.values(config.rules ?? {}).filter(isRuleEnabled);
      assert.ok(enabled.length > 0, `${path} resolves to a config with no enabled rules`);
    }
  });

  it("представители покрывают type-aware, plain-text и Markdown-зоны", async () => {
    const configs = [...(await resolveConfigs()).values()];
    assert.ok(
      configs.some((config) => config.languageOptions?.parserOptions?.projectService === true),
      "no type-aware representative",
    );
    assert.ok(
      configs.some((config) => config.languageOptions?.parser?.meta?.name === "plain-text-parser"),
      "no non-JS snippet representative",
    );
    assert.ok(
      configs.some((config) => config.processor !== undefined),
      "no Markdown processor representative",
    );
    assert.ok(
      PRETTIER_CONFLICT_TARGETS.some(({ path }) => path.includes(".md/")),
      "no virtual Markdown snippet representative",
    );
  });

  it("гейт зелёный на живом конфиге репозитория", () => {
    const result = run(REPO, [SCRIPT]);
    assert.equal(result.status, 0, result.stderr);
  });

  it("гейт падает, когда представитель выпадает из конфига", () => {
    const dir = newConfigFixture(
      "wsc-prettier-uncovered-",
      "export default [{ files: ['**/*.ts'], rules: { 'no-var': 'error' } }];\n",
    );
    const result = run(dir, [SCRIPT]);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /no enabled rules, the zone is not covered/);
  });

  it("базовый детектор падает на конфиге с конфликтующим правилом", () => {
    const dir = newConfigFixture(
      "wsc-prettier-conflict-",
      "export default [{ files: ['**/*.ts'], rules: { semi: ['error', 'always'], 'no-var': 'error' } }];\n",
    );
    writeFileSync(join(dir, "file.ts"), "const x = 1;\n");
    const result = run(dir, [CLI, "file.ts"]);
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.match(result.stdout + result.stderr, /- semi/);
  });
});

/**
 * Run a node entry point and capture its result.
 * @param {string} cwd - working directory
 * @param {string[]} args - script and its arguments
 * @returns {{status: number, stdout: string, stderr: string}} run result
 */
function run(cwd, args) {
  try {
    const stdout = execFileSync(process.execPath, args, { cwd, encoding: "utf8" });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return { status: error.status ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
}
