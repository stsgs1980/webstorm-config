// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";
import { gitEnv } from "./lib/git-env.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/check-docs.ts", import.meta.url));
const BADGE = "![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.22.2-green)\n";
const PKG = JSON.stringify({ name: "fixture", scripts: {}, engines: { node: ">=22.22.2" } });
const PKG_NO_ENGINES = JSON.stringify({ name: "fixture", scripts: {} });

/**
 * Run check-docs inside a throwaway project (no docs/ directory on purpose).
 * @param {string} pkg - package.json content
 * @param {string} nvm - .nvmrc content; an empty string omits the file
 * @param {{file: string, content: string}[]} [docs] - extra markdown files
 * @returns {{ status: number, stdout: string, stderr: string }} run result
 */
const runFixture = (pkg, nvm, docs = []) => {
  const dir = mkdtempSync(join(tmpdir(), "wsc-check-docs-"));
  writeFileSync(join(dir, "package.json"), pkg);
  writeFileSync(join(dir, "README.md"), `# Fixture\n\n${BADGE}`);
  for (const { file, content } of docs) {
    const target = join(dir, file);
    const parent = dirname(target);
    if (!existsSync(parent)) {
      mkdirSync(parent, { recursive: true });
    }
    writeFileSync(target, content);
  }
  if (nvm !== "") {
    writeFileSync(join(dir, ".nvmrc"), nvm);
  }
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT], { cwd: dir, env: gitEnv(), encoding: "utf8" });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return { status: error.status ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe("check-docs", () => {
  it("без .nvmrc и docs/ отвечает [FAIL], а не падает с ENOENT", () => {
    const result = runFixture(PKG, "");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[FAIL\] \.nvmrc not found\./);
    assert.doesNotMatch(result.stderr, /ENOENT/);
  });

  it("без engines.node отвечает [FAIL], а не падает с TypeError", () => {
    const result = runFixture(PKG_NO_ENGINES, "22.22.2");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[FAIL\] engines\.node is not set in package\.json\./);
    assert.doesNotMatch(result.stderr, /TypeError/);
  });

  it("согласованные .nvmrc и engines.node дают [OK]", () => {
    const result = runFixture(PKG, "22.22.2");
    assert.equal(result.status, 0);
    assert.match(result.stdout, /\[OK\] check-docs: 1 docs files consistent with configs\./);
  });

  it("имя скрипта с цифрой читается целиком", () => {
    const pkg = JSON.stringify({
      name: "fixture",
      scripts: { "test:e2e": "playwright test" },
      engines: { node: ">=22.22.2" },
    });
    const doc = "# E2E\n\nЗапускается `npm run test:e2e`.\n";
    const result = runFixture(pkg, "22.22.2", [{ file: "docs/e2e.md", content: doc }]);
    assert.equal(result.status, 0, result.stderr);
  });

  it("опечатка в имени скрипта с цифрой ловится", () => {
    const pkg = JSON.stringify({
      name: "fixture",
      scripts: { "test:e2e": "playwright test" },
      engines: { node: ">=22.22.2" },
    });
    const doc = "# E2E\n\nЗапускается `npm run test:e3e`.\n";
    const result = runFixture(pkg, "22.22.2", [{ file: "docs/e2e.md", content: doc }]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /npm run test:e3e is not in package\.json scripts/);
  });

  it("будущий скрипт разрешён только явным маркером", () => {
    const doc = "# Планы\n\n<!-- check-docs:allow-missing-scripts dev -->\n\n`npm run dev`.\n";
    const result = runFixture(PKG, "22.22.2", [{ file: "docs/roadmap.md", content: doc }]);
    assert.equal(result.status, 0);
  });

  it("без маркера будущий скрипт считается битой ссылкой", () => {
    const doc = "# Планы\n\n`npm run dev`.\n";
    const result = runFixture(PKG, "22.22.2", [{ file: "docs/roadmap.md", content: doc }]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /npm run dev is not in package\.json scripts/);
  });

  it("маркер не разрешает скрипты, которых в нём нет", () => {
    const doc = "# Планы\n\n<!-- check-docs:allow-missing-scripts dev -->\n\n`npm run test:e2e`.\n";
    const result = runFixture(PKG, "22.22.2", [{ file: "docs/roadmap.md", content: doc }]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /npm run test:e2e is not in package\.json scripts/);
  });

  it("битая относительная ссылка ловится", () => {
    const doc = "# Ссылки\n\n[missing](no-such.md).\n";
    const result = runFixture(PKG, "22.22.2", [{ file: "docs/links.md", content: doc }]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /link target no-such\.md does not exist/);
  });

  it("валидная относительная ссылка и якорь проходят", () => {
    const docs = [
      { file: "docs/target.md", content: "# Target\n\n## Раздел\n\nТекст.\n" },
      { file: "docs/links.md", content: "# Ссылки\n\n[target](target.md#раздел).\n" },
    ];
    const result = runFixture(PKG, "22.22.2", docs);
    assert.equal(result.status, 0, result.stderr);
  });

  it("битый якорь ловится", () => {
    const docs = [
      { file: "docs/target.md", content: "# Target\n\n## Раздел\n\nТекст.\n" },
      { file: "docs/links.md", content: "# Ссылки\n\n[target](target.md#нет).\n" },
    ];
    const result = runFixture(PKG, "22.22.2", docs);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /anchor #нет not found in target\.md/);
  });

  it("ссылки внутри fenced-блоков не проверяются", () => {
    const doc = "# Код\n\n```md\n[missing](no-such.md)\n```\n";
    const result = runFixture(PKG, "22.22.2", [{ file: "docs/links.md", content: doc }]);
    assert.equal(result.status, 0, result.stderr);
  });

  it("путь, снятый с плана, больше не легализован", () => {
    const doc = "# Планы\n\n`scripts/check-unicode-prose.ts`.\n";
    const result = runFixture(PKG, "22.22.2", [{ file: "docs/roadmap.md", content: doc }]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /path scripts\/check-unicode-prose\.ts does not exist/);
  });

  it("реальный скрипт из package.json в документации проходит", () => {
    const pkg = JSON.stringify({
      name: "fixture",
      scripts: { "lint:metrics": "eslint . --config eslint.metrics.config.js" },
      engines: { node: ">=22.22.2" },
    });
    const doc = "# Ретонка\n\nЗапускается `npm run lint:metrics`.\n";
    const result = runFixture(pkg, "22.22.2", [{ file: "docs/lane.md", content: doc }]);
    assert.equal(result.status, 0);
  });

  it("ссылка на случайный несуществующий путь по-прежнему ловится", () => {
    const doc = "# Фикция\n\nЧто-то в `docs/no-such-file.md`.\n";
    const result = runFixture(PKG, "22.22.2", [{ file: "docs/wrong.md", content: doc }]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /path docs\/no-such-file\.md does not exist/);
  });

  it("ссылка на случайный несуществующий скрипт по-прежнему ловится", () => {
    const doc = "# Фикция\n\nЗапускается `npm run lint:metrics-extra`.\n";
    const result = runFixture(PKG, "22.22.2", [{ file: "docs/wrong.md", content: doc }]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /npm run lint:metrics-extra is not in package\.json scripts/);
  });

  it("ссылка на личный файл из .gitignore не считается несуществующей", { timeout: 120000 }, () => {
    // A checkout (CI) has no personal files like .idea/workspace.xml: the
    // fixture is a git repo whose .gitignore ignores the named path.
    const dir = mkdtempSync(join(tmpdir(), "wsc-check-docs-"));
    try {
      writeFileSync(join(dir, "package.json"), PKG);
      writeFileSync(join(dir, "README.md"), `# Fixture\n\n${BADGE}`);
      writeFileSync(join(dir, ".nvmrc"), "22.22.2");
      writeFileSync(join(dir, ".gitignore"), ".idea/workspace.xml\n");
      const docs = join(dir, "docs");
      mkdirSync(docs, { recursive: true });
      writeFileSync(
        join(docs, "settings.md"),
        "# Папки\n\n`.idea/workspace.xml` - личное состояние, в git не попадает.\n",
      );
      execFileSync("git", ["init", "-q"], { cwd: dir, env: gitEnv(), stdio: "ignore" });
      execFileSync("git", ["config", "core.quotepath", "false"], { cwd: dir, env: gitEnv(), stdio: "ignore" });
      const stdout = execFileSync(process.execPath, [SCRIPT], { cwd: dir, env: gitEnv(), encoding: "utf8" });
      assert.doesNotMatch(stdout, /does not exist/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("AGENTS.md в корне сканируется: битый npm run даёт [FAIL]", () => {
    const result = runFixture(PKG, "22.22.2", [
      { file: "AGENTS.md", content: "# Rules\n\nЗапускается `npm run nosuchscript`.\n" },
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /AGENTS\.md:\d+ npm run nosuchscript/);
  });

  it("валидный AGENTS.md в корне проходит и учитывается в счётчике", () => {
    const result = runFixture(PKG, "22.22.2", [
      { file: "AGENTS.md", content: "# Rules\n\nAlways read a file before editing it.\n" },
    ]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /\[OK\] check-docs: 2 docs files consistent with configs\./);
  });
});
