// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import stylelint from "stylelint";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";

const CONFIG = fileURLToPath(new URL("../.stylelintrc.json", import.meta.url));
const TW_V4_DIRECTIVES = [
  "@tailwind utilities;",
  '@source "./src";',
  "",
  "@theme {",
  "  --color-brand: #369;",
  "}",
  "",
  "@custom-variant dark (&:where(.dark, .dark *));",
  "",
  "@utility tab-4 {",
  "  tab-size: 4;",
  "}",
  "",
].join("\n");

/**
 * Lint a snippet against the template stylelint config.
 * @param {string} code - stylesheet source
 * @param {string} codeFilename - virtual file name that selects css or scss syntax
 * @returns {Promise<Array<{ rule: string }>>} warnings reported by stylelint
 */
const lint = async (code, codeFilename) => {
  const result = await stylelint.lint({ code, codeFilename, configFile: CONFIG });
  return result.results.flatMap((entry) => entry.warnings);
};

describe("stylelint-config", () => {
  it("Tailwind v4 at-rules приняты в CSS", async () => {
    const warnings = await lint(TW_V4_DIRECTIVES, "fixture.css");
    assert.equal(warnings.length, 0, JSON.stringify(warnings));
  });

  it("Tailwind v4 at-rules приняты в SCSS", async () => {
    const warnings = await lint(TW_V4_DIRECTIVES, "fixture.scss");
    assert.equal(warnings.length, 0, JSON.stringify(warnings));
  });

  it("неизвестный at-rule по-прежнему отклоняется", async () => {
    const warnings = await lint('@totally-unknown "x";\n', "fixture.css");
    assert.ok(warnings.some((warning) => warning.rule === "at-rule-no-unknown"));
    assert.ok(warnings.some((warning) => warning.rule === "scss/at-rule-no-unknown"));
  });
});
