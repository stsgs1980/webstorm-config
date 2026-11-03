// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";
import { tscFailureText } from "../scripts/lib/tsc-output.ts";

describe("tscFailureText", () => {
  it("берёт stdout, когда tsc пишет ошибки типов туда", () => {
    const text = tscFailureText({ stdout: "a.ts(1,1): error TS2322", stderr: "" });
    assert.match(text, /TS2322/);
  });

  it("не теряет fatal-ошибку, которая есть только в stderr", () => {
    const text = tscFailureText({ stdout: "", stderr: "error TS5023: Unknown option" });
    assert.match(text, /TS5023/);
  });

  it("не возвращает пустую строку даже без потоков", () => {
    const text = tscFailureText(new Error("spawn failed"));
    assert.notEqual(text.trim(), "");
  });
});
