// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";
import { checkZoneCoverage, mentionsZone, WORKSPACE_ZONES } from "../scripts/lib/workspace-zones.ts";

describe("workspace zones", () => {
  it("mentionsZone ловит зону как сегмент пути", () => {
    assert.ok(mentionsZone("drafts/\n", "drafts"));
    assert.ok(mentionsZone("/drafts/\n", "drafts"));
    assert.ok(mentionsZone('  "drafts/**",\n', "drafts"));
    assert.ok(mentionsZone("node_modules/\n", "node_modules"));
  });

  it("mentionsZone не принимает зону за часть другого имени", () => {
    assert.ok(!mentionsZone("draftsman/\n", "drafts"));
    assert.ok(!mentionsZone("buildings/\n", "build"));
    assert.ok(!mentionsZone("without/\n", "out"));
  });

  it("зона, которую игнорируют все, не даёт нарушений", () => {
    const failures = checkZoneCoverage(["drafts"], [{ name: "tool", ignores: () => true }]);
    assert.deepEqual(failures, []);
  });

  it("зона, которую один инструмент не игнорирует, попадает в отчёт", () => {
    const failures = checkZoneCoverage(
      ["drafts"],
      [
        { name: "keeps", ignores: () => true },
        { name: "walks", ignores: () => false },
      ],
    );
    assert.equal(failures.length, 1);
    assert.equal(failures[0].zone, "drafts");
    assert.deepEqual(failures[0].tools, ["walks"]);
  });

  it("список зон покрывает каталоги агентов и сборки", () => {
    for (const zone of [".superpowers", ".opencode", ".agents", ".awb", "drafts", "coverage", "dev"]) {
      assert.ok(WORKSPACE_ZONES.includes(zone), `expected ${zone} in the zone list`);
    }
  });
});
