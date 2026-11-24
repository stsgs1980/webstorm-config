// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
// noinspection NpmUsedModulesInstalled
import { readFileSync } from "node:fs";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";

const DOC = readFileSync("docs/testing.md", "utf8");
const CONFIG = readFileSync("vitest.config.ts", "utf8");

const HEADING = "**2. Обновите `vitest.config.ts`:**";

function extractFence(text, marker) {
  const heading = text.indexOf(marker);
  assert.ok(heading !== -1, `heading not found: ${marker}`);
  const start = text.indexOf("```typescript", heading);
  assert.ok(start !== -1, "typescript fence not found after heading");
  const end = text.indexOf("```", start + "```typescript".length);
  assert.ok(end !== -1, "closing fence not found");
  return text.slice(start, end);
}

function includeGlobs(block) {
  const section = block.slice(block.indexOf("include: ["));
  const close = section.indexOf("]");
  assert.ok(close !== -1, "include array not closed");
  return (section.slice(0, close).match(/"[^"]+"/g) ?? []).map((entry) => entry.slice(1, -1));
}

describe("vitest recipe in docs/testing.md", () => {
  it("сохраняет корни include тулчейна из vitest.config.ts", () => {
    const configRoots = includeGlobs(CONFIG);
    const recipeRoots = includeGlobs(extractFence(DOC, HEADING));
    for (const root of configRoots) {
      assert.ok(recipeRoots.includes(root), `recipe include misses ${root}`);
    }
  });

  it("сохраняет ключи шаблона testTimeout и passWithNoTests", () => {
    const block = extractFence(DOC, HEADING);
    assert.match(block, /testTimeout/);
    assert.match(block, /passWithNoTests/);
  });

  it("рядом с рецептом есть запрет на удаление тулчейн-набора", () => {
    const section = DOC.slice(DOC.indexOf(HEADING), DOC.indexOf("**3."));
    assert.match(section, /не удаляйте/iu);
  });
});
