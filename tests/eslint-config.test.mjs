// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { ESLint } from "eslint";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const CONFIG = join(REPO, "eslint.config.js");

/**
 * Lint virtual code at a virtual path: flat config `files` patterns select
 * the scope by that path, so no real fixture files are needed.
 * @param {string} code - snippet source
 * @param {string} filePath - repo-relative virtual path
 * @returns {Promise<string[]>} rule ids reported for the snippet
 */
const reportRules = async (code, filePath) => {
  const eslint = new ESLint({
    overrideConfigFile: CONFIG,
    cwd: REPO,
    ignore: false,
  });
  const results = await eslint.lintText(code, { filePath: join(REPO, filePath) });
  return results.flatMap((result) => result.messages.map((message) => message.ruleId ?? "parse-error"));
};

describe("eslint-config no-console scopes", () => {
  it("console.log в прикладном коде - ошибка no-console", { timeout: 120000 }, async () => {
    const rules = await reportRules('console.log("debug leftover");\n', "src/app.mjs");
    assert.ok(rules.includes("no-console"), `expected no-console, got: ${rules.join(", ")}`);
  });

  it("console.log в скриптах - разрешён (логирование - инструмент)", { timeout: 120000 }, async () => {
    const rules = await reportRules('console.log("progress");\n', "scripts/tool.mjs");
    assert.ok(!rules.includes("no-console"), `unexpected no-console, got: ${rules.join(", ")}`);
  });

  it("console.log на сервере - разрешён", { timeout: 120000 }, async () => {
    const rules = await reportRules('console.log("request handled");\n', "server/log.mjs");
    assert.ok(!rules.includes("no-console"), `unexpected no-console, got: ${rules.join(", ")}`);
  });

  it("console.warn в прикладном коде остаётся разрешённым", { timeout: 120000 }, async () => {
    const rules = await reportRules('console.warn("deprecation");\n', "src/app.mjs");
    assert.ok(!rules.includes("no-console"), `unexpected no-console, got: ${rules.join(", ")}`);
  });
});

describe("eslint-config environment globals", () => {
  it("браузерные глобали известны в src", { timeout: 120000 }, async () => {
    const rules = await reportRules('window.matchMedia("(min-width: 1px)");\n', "src/app.mjs");
    assert.ok(!rules.includes("no-undef"), `unexpected no-undef, got: ${rules.join(", ")}`);
  });

  it("Node-глобали известны в scripts", { timeout: 120000 }, async () => {
    const rules = await reportRules("process.exit(0);\n", "scripts/tool.mjs");
    assert.ok(!rules.includes("no-undef"), `unexpected no-undef, got: ${rules.join(", ")}`);
  });

  it("браузерное имя в Node-скрипте остаётся ошибкой", { timeout: 120000 }, async () => {
    const rules = await reportRules('window.matchMedia("x");\n', "scripts/tool.mjs");
    assert.ok(rules.includes("no-undef"), `expected no-undef, got: ${rules.join(", ")}`);
  });

  it("console.warn в src не даёт no-undef", { timeout: 120000 }, async () => {
    const rules = await reportRules('console.warn("deprecation");\n', "src/app.mjs");
    assert.ok(!rules.includes("no-undef"), `unexpected no-undef, got: ${rules.join(", ")}`);
  });

  /**
   * Lint a real file at a repo-relative path: no-undef is off for .ts, so the
   * boundary is enforced by no-restricted-globals and must be checked on disk.
   * @param {string} code - snippet source
   * @param {string} relPath - repo-relative path, e.g. scripts/probe.ts
   * @returns {Promise<string[]>} rule ids reported for the snippet
   */
  const lintAt = async (code, relPath) => {
    const path = join(REPO, relPath);
    const dir = join(REPO, relPath.split(/[\\/]/)[0]);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, code);
    try {
      const eslint = new ESLint({ overrideConfigFile: CONFIG, cwd: REPO, ignore: false });
      const results = await eslint.lintFiles([path]);
      return results.flatMap((result) => result.messages.map((message) => message.ruleId ?? "parse-error"));
    } finally {
      rmSync(path, { force: true });
      try {
        rmSync(dir, { recursive: false });
      } catch {
        // Directory still holds other files: leave it.
      }
    }
  };

  it("браузерное имя в Node-скрипте ловится и для .ts", { timeout: 120000 }, async () => {
    const rules = await lintAt('window.alert("audit");\n', "scripts/__env_probe.ts");
    assert.ok(rules.includes("no-restricted-globals"), `expected no-restricted-globals, got: ${rules.join(", ")}`);
  });

  it("Node-имя в src ловится и для .ts", { timeout: 120000 }, async () => {
    const rules = await lintAt("process.exit(0);\n", "src/__env_probe.ts");
    assert.ok(rules.includes("no-restricted-globals"), `expected no-restricted-globals, got: ${rules.join(", ")}`);
  });
});

describe("eslint-config prettier compatibility", () => {
  it("форматные правила выключены eslint-config-prettier", { timeout: 120000 }, async () => {
    const eslint = new ESLint({ overrideConfigFile: CONFIG, cwd: REPO });
    const config = await eslint.calculateConfigForFile(join(REPO, "scripts/check-docs.ts"));
    const severity = (value) => (Array.isArray(value) ? value[0] : value);
    for (const rule of ["indent", "quotes", "semi"]) {
      const value = config.rules[rule];
      assert.ok(severity(value) === 0 || value === "off", `expected ${rule} to be off, got: ${JSON.stringify(value)}`);
    }
  });
});

describe("eslint-config react rules under ESLint 10", () => {
  /**
   * Lint a real .tsx fixture: the type service resolves the file on disk
   * through tsconfig, so a virtual path cannot exercise the .tsx scope.
   * @param {string} code - fixture source
   * @param {string} name - fixture file name
   * @returns {Promise<string[]>} rule ids reported for the fixture
   */
  const lintTsxFixture = async (code, name) => {
    const dir = join(REPO, "dev", "eslint-tsx-fixtures");
    const path = join(dir, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "tsconfig.json"),
      `${JSON.stringify({ extends: "../../tsconfig.json", include: ["**/*.tsx"], exclude: [] }, null, 2)}\n`,
    );
    writeFileSync(path, code);
    try {
      const eslint = new ESLint({ overrideConfigFile: CONFIG, cwd: REPO, ignore: false });
      const results = await eslint.lintFiles([path]);
      return results.flatMap((result) => result.messages.map((message) => message.ruleId ?? "parse-error"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it("версия React задана явно, а не detect", { timeout: 120000 }, async () => {
    const eslint = new ESLint({ overrideConfigFile: CONFIG, cwd: REPO });
    const config = await eslint.calculateConfigForFile(join(REPO, "src/app.tsx"));
    const version = config.settings?.react?.version;
    // "detect" resolves the React version through context.getFilename(),
    // which ESLint 10 removed: the rule then throws a TypeError while it
    // loads. eslint-plugin-react has no ESLint 10 release yet.
    assert.notEqual(version, "detect", 'react.version must not be "detect" under ESLint 10');
    assert.equal(typeof version, "string", `expected a string version, got: ${JSON.stringify(version)}`);
  });

  it("React-правила грузятся без TypeError", { timeout: 120000 }, async () => {
    const rules = await lintTsxFixture("export const App = (): JSX.Element => <div>text</div>;\n", "app.tsx");
    assert.ok(!rules.includes("parse-error"), `unexpected parse error, got: ${rules.join(", ")}`);
  });

  it("jsx-a11y правило срабатывает на .tsx", { timeout: 120000 }, async () => {
    const rules = await lintTsxFixture('export const Img = (): JSX.Element => <img src="a.png" />;\n', "img.tsx");
    assert.ok(rules.includes("jsx-a11y/alt-text"), `expected alt-text, got: ${rules.join(", ")}`);
  });
});

describe("eslint-config type-aware promises", () => {
  /**
   * Lint a real .ts fixture: the type service resolves the file on disk
   * through tsconfig, so a virtual path cannot exercise type-aware rules.
   * @param {string} code - fixture source
   * @param {string} name - fixture file name
   * @returns {Promise<string[]>} rule ids reported for the fixture
   */
  const lintFixture = async (code, name) => {
    // No dot segments in the path: TypeScript include globs do not enter
    // dotted directories, and the type service must find the fixture in
    // the tsconfig project (include "**/*.ts").
    const dir = join(REPO, "dev", "eslint-fixtures");
    const path = join(dir, name);
    mkdirSync(dir, { recursive: true });
    // dev/ is excluded by the root tsconfig, so the fixture needs its own
    // project for the type-aware layer (projectService) to accept it.
    writeFileSync(
      join(dir, "tsconfig.json"),
      `${JSON.stringify({ extends: "../../tsconfig.json", include: ["**/*.ts"], exclude: [] }, null, 2)}\n`,
    );
    writeFileSync(path, code);
    try {
      const eslint = new ESLint({ overrideConfigFile: CONFIG, cwd: REPO, ignore: false });
      const results = await eslint.lintFiles([path]);
      return results.flatMap((result) => result.messages.map((message) => message.ruleId ?? "parse-error"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it("промис без await или void - ошибка no-floating-promises", { timeout: 120000 }, async () => {
    const floating =
      "const work = async (): Promise<void> => {};\n" +
      "const run = (): void => {\n" +
      "  work();\n" +
      "};\n" +
      "run();\n";
    const rules = await lintFixture(floating, "floating.ts");
    assert.ok(
      rules.includes("@typescript-eslint/no-floating-promises"),
      `expected no-floating-promises, got: ${rules.join(", ")}`,
    );
  });

  it("промис в условии if - ошибка no-misused-promises", { timeout: 120000 }, async () => {
    const misused =
      "const pred = async (): Promise<boolean> => true;\n" +
      "const shouldRenew = (): boolean => {\n" +
      "  if (pred()) {\n" +
      "    return true;\n" +
      "  }\n" +
      "  return false;\n" +
      "};\n" +
      "void shouldRenew();\n";
    const rules = await lintFixture(misused, "misused.ts");
    assert.ok(
      rules.includes("@typescript-eslint/no-misused-promises"),
      `expected no-misused-promises, got: ${rules.join(", ")}`,
    );
  });

  it("корректный await с void-вызовом сверху не ловится ложным срабатыванием", { timeout: 120000 }, async () => {
    const clean =
      "const work = async (): Promise<void> => {};\n" +
      "const run = async (): Promise<void> => {\n" +
      "  await work();\n" +
      "};\n" +
      "void run();\n";
    const rules = await lintFixture(clean, "clean.ts");
    assert.deepEqual(rules, []);
  });
});
