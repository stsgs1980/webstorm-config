// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, URL } from "node:url";
import { promisify } from "node:util";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";

const execFileP = promisify(execFile);

const SCRIPT = fileURLToPath(new URL("../scripts/check-templates.ts", import.meta.url));
const REPO_TEMPLATES = fileURLToPath(new URL("../.idea/liveTemplates", import.meta.url));

/**
 * Create a throwaway templates directory with the given XML contents.
 * @param {{name: string, xml: string}[]} sets - template set files
 * @returns {string} directory path
 */
const makeFixture = (sets) => {
  const dir = mkdtempSync(join(tmpdir(), "wsc-check-templates-"));
  for (const { name, xml } of sets) {
    writeFileSync(join(dir, name), xml);
  }
  return dir;
};

/**
 * Run the template checker for a directory of templates.
 * @param {string} dir - directory with *.xml template sets
 * @returns {{ status: number, stdout: string, stderr: string }} run result
 */
const run = (dir) => {
  const result = spawnSync(process.execPath, [SCRIPT, dir], { encoding: "utf8" });
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};

/**
 * Run a fixture and clean it up afterward.
 * @param {{name: string, xml: string}[]} sets - template set files
 * @returns {{ status: number, stdout: string, stderr: string }} run result
 */
const runFixture = (sets) => {
  const dir = makeFixture(sets);
  try {
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const xmlOf = (group, templates) => `<templateSet group="${group}">\n${templates.join("\n")}\n</templateSet>\n`;

describe("check-templates", () => {
  it("валидный шаблон отвечает [OK] с прогонами lint и tsc", { timeout: 120000 }, () => {
    // noinspection LongLine
    const rafce =
      '<template name="rafce" value="import type { ReactElement, ReactNode } from &quot;react&quot;;&#xA;&#xA;interface $NAME$Props {&#xA;  children?: ReactNode;&#xA;}&#xA;&#xA;/**&#xA; * $NAME$ component.&#xA; */&#xA;export const $NAME$ = ({ children }: $NAME$Props): ReactElement =&gt; {&#xA;  return &lt;div&gt;{children}&lt;/div&gt;;&#xA;};&#xA;&#xA;export default $NAME$;" description="React Arrow Function Component"></template>';
    const result = runFixture([{ name: "react.xml", xml: xmlOf("React", [rafce]) }]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /\[OK\] react\/rafce.*(eslint|tsc)/);
  });

  it("параллельные вызовы чекера не затирают рендер друг друга", { timeout: 240000 }, async () => {
    // Two terminals (IDE + console) may run the renderer at once; a shared
    // render dir lets one invocation's rmSync delete the other's files
    // mid-flight (observed: TS6053, eslint ENOENT). Keep the concurrency but
    // bound the work: a 2 GB CI box must not SIGKILL both processes, and the
    // pid-dir isolation does not depend on the repository template count.
    // noinspection LongLine
    const rafce =
      '<template name="rafce" value="import type { ReactElement, ReactNode } from &quot;react&quot;;&#xA;&#xA;interface $NAME$Props {&#xA;  children?: ReactNode;&#xA;}&#xA;&#xA;/**&#xA; * $NAME$ component.&#xA; */&#xA;export const $NAME$ = ({ children }: $NAME$Props): ReactElement =&gt; {&#xA;  return &lt;div&gt;{children}&lt;/div&gt;;&#xA;};&#xA;&#xA;export default $NAME$;" description="React Arrow Function Component"></template>';
    const simple = (name) => `<template name="${name}" value="const $NAME$ = 1;"></template>`;
    const attempt = (templatesDir) =>
      execFileP(process.execPath, [SCRIPT, templatesDir], { timeout: 180000 }).then(
        () => ({ ok: true, stderr: "" }),
        (error) => ({
          ok: false,
          stderr: String(error.stderr || error.stdout || error.message || ""),
        }),
      );
    const longFixture = makeFixture([
      { name: "react.xml", xml: xmlOf("React", [rafce, simple("one"), simple("two")]) },
    ]);
    const fixture = makeFixture([{ name: "react.xml", xml: xmlOf("React", [rafce]) }]);
    try {
      const longRun = attempt(longFixture);
      await sleep(1500);
      const shortRun = attempt(fixture);
      const [first, second] = await Promise.all([longRun, shortRun]);
      for (const [label, attemptResult] of [
        ["long", first],
        ["short", second],
      ]) {
        // noinspection JSUnresolvedVariable
        assert.ok(attemptResult.ok, `${label}: ${attemptResult.stderr}`);
      }
    } finally {
      rmSync(longFixture, { recursive: true, force: true });
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("синтаксически сломанный шаблон падает и называет шаблон", { timeout: 120000 }, () => {
    const broken = '<template name="broken" value="const broken = ;" description="bad"></template>';
    const result = runFixture([{ name: "react.xml", xml: xmlOf("React", [broken]) }]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[FAIL\] react\/broken/);
  });

  it("переменная NAME подставляется во все места - защита от дрейфа rafce", { timeout: 120000 }, () => {
    const tpl = '<template name="names" value="const $NAME$Trait = 1;&#xA;export default $NAME$Trait;"></template>';
    const result = runFixture([{ name: "react.xml", xml: xmlOf("React", [tpl]) }]);
    assert.equal(result.status, 0);
  });

  it("неизвестная переменная рендерится с fallback и предупреждением", { timeout: 120000 }, () => {
    const tpl = '<template name="fallback" value="const u = $UNKNOWN$;"></template>';
    const result = runFixture([{ name: "typescript.xml", xml: xmlOf("TSx", [tpl]) }]);
    assert.equal(result.status, 0);
    assert.match(result.stderr, /\[WARN\].*\$UNKNOWN\$/);
  });

  it("значение с '>' в атрибуте не пропускается", { timeout: 120000 }, () => {
    const arrow = '<template name="arrow" value="const $NAME$ = (x: number): number => x + 1;"></template>';
    const result = runFixture([{ name: "typescript.xml", xml: xmlOf("TSx", [arrow]) }]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[OK\] typescript\/arrow/);
  });

  it("XML-комментарий с <template> не создаёт ghost-шаблон", { timeout: 120000 }, () => {
    const real = '<template name="real" value="const $NAME$ = 1;"></template>';
    // noinspection LongLine
    const xml = `<templateSet group="Probe">\n<!-- <template name="ghost" value="const ghost = 1;"></template> -->\n${real}\n</templateSet>\n`;
    const result = runFixture([{ name: "probe.xml", xml }]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /templates checked: 1/);
    assert.doesNotMatch(result.stdout, /ghost/);
  });

  it("пустой блок разрешён только шаблонам-заготовкам", { timeout: 120000 }, () => {
    const skeleton = '<template name="try" value="try {} catch {}"></template>';
    const allowed = runFixture([{ name: "utilities.xml", xml: xmlOf("Utilities", [skeleton]) }]);
    assert.equal(allowed.status, 0, allowed.stderr);

    const other = '<template name="other" value="try {} catch {}"></template>';
    const rejected = runFixture([{ name: "utilities.xml", xml: xmlOf("Utilities", [other]) }]);
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /no-empty/);
  });

  it("удаляет устаревший каталог рендера", { timeout: 120000 }, () => {
    const stale = join(process.cwd(), "dev", `templates-check-stale-${process.pid}-${Date.now()}`);
    mkdirSync(stale, { recursive: true });
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    utimesSync(stale, old, old);
    try {
      const tpl = '<template name="real" value="const $NAME$ = 1;"></template>';
      const result = runFixture([{ name: "typescript.xml", xml: xmlOf("TSx", [tpl]) }]);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(existsSync(stale), false);
    } finally {
      rmSync(stale, { recursive: true, force: true });
    }
  });

  it("шаблоны живого репозитория проходят рендер, eslint и tsc", { timeout: 120000 }, () => {
    const result = run(REPO_TEMPLATES);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /\[OK\] react\/rafce/);
    assert.match(result.stdout, /templates checked: 18/);
  });
});
