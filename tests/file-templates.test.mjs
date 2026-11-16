// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { afterEach, describe, it } from "vitest";
import { checkFileTemplates, findLiveSyntaxMarkers } from "../scripts/lib/file-templates.ts";

const REPO_DIR = fileURLToPath(new URL("../.idea/fileTemplates", import.meta.url));

/** Temp directories created by the current test, removed in afterEach. */
const tempDirs = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

/**
 * Create a throwaway file-templates tree.
 * @param {Record<string, string>} files - relative path to content
 * @returns {string} fixture root
 */
const makeFixture = (files) => {
  const root = mkdtempSync(join(tmpdir(), "wsc-file-templates-"));
  tempDirs.push(root);
  for (const [name, content] of Object.entries(files)) {
    const path = join(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return root;
};

describe("findLiveSyntaxMarkers", () => {
  it("ловит двойной доллар live-шаблонов", () => {
    assert.deepEqual(findLiveSyntaxMarkers('describe("$NAME$", () => {})'), ["$NAME$"]);
    assert.deepEqual(findLiveSyntaxMarkers('it("should $TEST_NAME$", () => {})'), ["$TEST_NAME$"]);
  });

  it("пропускает Velocity-переменную и маркер курсора", () => {
    assert.deepEqual(findLiveSyntaxMarkers('describe("${NAME}", () => {\n  $END$\n});'), []);
  });

  it("возвращает каждый маркер, включая повтор", () => {
    assert.deepEqual(findLiveSyntaxMarkers("$NAME$ $NAME$ $OTHER$"), ["$NAME$", "$NAME$", "$OTHER$"]);
  });
});

describe("checkFileTemplates", () => {
  it("файл с live-синтаксисом даёт FAIL с путём и маркером", () => {
    const root = makeFixture({ "Vitest Test.test.ts": 'describe("$NAME$");\n' });
    const result = checkFileTemplates(root);
    assert.equal(result.checked, 1);
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0], /\[FAIL\] .*Vitest Test\.test\.ts: \$NAME\$ is live-template syntax/);
  });

  it("Velocity-шаблон проходит", () => {
    const root = makeFixture({ "Component.tsx": "export const ${NAME} = 1;\n$END$\n" });
    const result = checkFileTemplates(root);
    assert.equal(result.checked, 1);
    assert.deepEqual(result.failures, []);
  });

  it("обходит подкаталоги", () => {
    const root = makeFixture({
      "node/npm.xml": "<template />\n",
      "nested/deep/Probe.ts": 'const x = "$TITLE$";\n',
    });
    const result = checkFileTemplates(root);
    assert.equal(result.checked, 2);
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0], /Probe\.ts: \$TITLE\$ is live-template syntax/);
  });

  it("отсутствующий каталог не считается нарушением", () => {
    const result = checkFileTemplates(join(tmpdir(), `wsc-missing-${Date.now()}`));
    assert.equal(result.checked, 0);
    assert.deepEqual(result.failures, []);
  });

  it("реальные шаблоны репозитория проходят", () => {
    const result = checkFileTemplates(REPO_DIR);
    assert.deepEqual(result.failures, []);
    assert.ok(result.checked >= 3, `expected the shipped templates, got ${result.checked}`);
  });
});

describe("Vitest file template", () => {
  it("использует Velocity-переменную и маркер курсора", () => {
    const content = readFileSync(join(REPO_DIR, "Vitest Test.test.ts"), "utf8");
    assert.match(content, /\$\{NAME\}/);
    assert.match(content, /\$END\$/);
    assert.deepEqual(findLiveSyntaxMarkers(content), []);
  });
});
