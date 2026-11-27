// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";
import {
  checkExtraZoneMentions,
  checkLintStagedPatterns,
  checkVitestIncludeRooting,
  checkZoneCoverage,
  collectZoneCandidates,
  mentionsZone,
  WORKSPACE_ZONES,
} from "../scripts/lib/workspace-zones.ts";

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

  it("список зон покрывает каталоги сборки фреймворков", () => {
    for (const zone of [".next", ".nuxt", ".svelte-kit", ".astro", ".output", ".vite", ".cache"]) {
      assert.ok(WORKSPACE_ZONES.includes(zone), `expected ${zone} in the zone list`);
    }
  });
});

describe("collectZoneCandidates", () => {
  it("ignoreFile: берёт только простые каталоги-записи", () => {
    const entries = collectZoneCandidates({
      name: "t",
      kind: "ignoreFile",
      content: "node_modules/\n/dist/\n.env\n*.log\n.husky/_/\n.idea/*\n/drafts/\n.DS_Store\n",
    });
    assert.deepEqual(entries, ["node_modules", "dist", "drafts"]);
  });

  it("globList: берёт токены до маркера и закрывающей скобки", () => {
    const entries = collectZoneCandidates({
      name: "t",
      kind: "globList",
      marker: "ignores: [",
      content:
        'export default [\n  {\n    ignores: [\n      "node_modules/**",\n' +
        '      ".next/**",\n    ],\n  },\n  {\n    files: ["src/**"],\n  },\n];\n',
    });
    assert.deepEqual(entries, ["node_modules", ".next"]);
  });

  it("nameList: читает JSON-массив имён", () => {
    const entries = collectZoneCandidates({ name: "t", kind: "nameList", content: '["dist", "drafts"]' });
    assert.deepEqual(entries, ["dist", "drafts"]);
  });
});

describe("checkExtraZoneMentions", () => {
  it("запись, которой нет у владельца, попадает в отчёт", () => {
    const failures = checkExtraZoneMentions(
      ["drafts"],
      [{ name: "list", kind: "ignoreFile", content: "node_modules/\ndrafts/\n" }],
    );
    assert.deepEqual(failures, [{ tool: "list", token: "node_modules" }]);
  });

  it("записи из владельца проходят", () => {
    const failures = checkExtraZoneMentions(["drafts"], [{ name: "list", kind: "ignoreFile", content: "drafts/\n" }]);
    assert.deepEqual(failures, []);
  });
});

describe("checkVitestIncludeRooting", () => {
  it("глобальные и безкорневые globs ловятся", () => {
    const failures = checkVitestIncludeRooting(
      'include: [\n  "**/*.test.ts",\n  "*.test.ts",\n  "src/**/*.{test,spec}.{ts,tsx}",\n],\n',
    );
    assert.equal(failures.length, 2);
    assert.match(failures[0], /\*\*\/\*\.test\.ts/);
  });

  it("корневые globs проходят", () => {
    const failures = checkVitestIncludeRooting('include: [\n  "src/**/*.{test,spec}.{ts,tsx}",\n],\n');
    assert.deepEqual(failures, []);
  });
});

describe("checkLintStagedPatterns", () => {
  it("паттерн, накрывающий зону, ловится", () => {
    const failures = checkLintStagedPatterns({ "drafts/**/*.md": ["markdownlint --fix"] }, ["drafts"]);
    assert.equal(failures.length, 1);
    assert.equal(failures[0].pattern, "drafts/**/*.md");
    assert.equal(failures[0].zone, "drafts");
  });

  it("паттерны по расширениям проходят", () => {
    const failures = checkLintStagedPatterns({ "*.{ts,tsx}": ["eslint --fix"] }, WORKSPACE_ZONES);
    assert.deepEqual(failures, []);
  });
});
