// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";

const REPO = fileURLToPath(new URL("..", import.meta.url));

describe("AI Rules section count", () => {
  it("указатель называет столько разделов, сколько их в AGENTS.md", () => {
    const agents = readFileSync(join(REPO, "AGENTS.md"), "utf8");
    const count = (agents.match(/^## \d+\./gm) ?? []).length;
    assert.ok(count > 0, "AGENTS.md must have numbered sections");
    const rules = readFileSync(join(REPO, ".aiassistant", "rules", "AI Rules.md"), "utf8");
    assert.match(rules, new RegExp(`все ${count} разделов \\(0-${count - 1}\\)`));
  });
});
