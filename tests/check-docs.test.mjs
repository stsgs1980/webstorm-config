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
    const stdout = execFileSync(process.execPath, [SCRIPT], { cwd: dir, encoding: "utf8" });
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

  it("дорожная карта со ссылками на будущие файлы и скрипт даёт [OK]", () => {
    const doc =
      "# Планы\n\n`npm run dev`, `docs/architecture.md`, `docs/api.md`,\n" +
      "`docs/security.md`, `scripts/check-unicode-prose.ts`.\n";
    const result = runFixture(PKG, "22.22.2", [{ file: "docs/roadmap.md", content: doc }]);
    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stderr, /does not exist/);
    assert.doesNotMatch(result.stderr, /is not in package\.json scripts/);
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
});
