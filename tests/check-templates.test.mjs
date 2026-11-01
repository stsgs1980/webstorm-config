// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";

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
 * Run the template checker against a templates directory.
 * @param {string} dir - directory with *.xml template sets
 * @returns {{ status: number, stdout: string, stderr: string }} run result
 */
const run = (dir) => {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, dir], { encoding: "utf8" });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return { status: error.status ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
};

/**
 * Run a fixture and clean it up afterwards.
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
    const rafce =
      '<template name="rafce" value="import type { ReactElement, ReactNode } from &quot;react&quot;;&#xA;&#xA;interface $NAME$Props {&#xA;  children?: ReactNode;&#xA;}&#xA;&#xA;/**&#xA; * $NAME$ component.&#xA; */&#xA;export const $NAME$ = ({ children }: $NAME$Props): ReactElement =&gt; {&#xA;  return &lt;div&gt;{children}&lt;/div&gt;;&#xA;};&#xA;&#xA;export default $NAME$;" description="React Arrow Function Component"></template>';
    const result = runFixture([{ name: "react.xml", xml: xmlOf("React", [rafce]) }]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /\[OK\] react\/rafce.*(eslint|tsc)/);
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

  it("неизвестная переменная рендерится с fallback, чекер не падает", { timeout: 120000 }, () => {
    const tpl = '<template name="fallback" value="const u = $UNKNOWN$;"></template>';
    const result = runFixture([{ name: "typescript.xml", xml: xmlOf("TSx", [tpl]) }]);
    assert.equal(result.status, 0);
  });

  it("шаблоны живого репозитория проходят рендер, eslint и tsc", { timeout: 120000 }, () => {
    const result = run(REPO_TEMPLATES);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /\[OK\] react\/rafce/);
    assert.match(result.stdout, /\[OK\] templates checked/);
  });
});
