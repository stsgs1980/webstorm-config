// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { join } from "node:path";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";
import { resolveJetbrainsRoot } from "../scripts/lib/ide-state.ts";

describe("resolveJetbrainsRoot", () => {
  it("win32 берёт APPDATA", () => {
    const root = resolveJetbrainsRoot({ APPDATA: "C:/Users/u/AppData/Roaming" }, "win32");
    assert.equal(root, join("C:/Users/u/AppData/Roaming", "JetBrains"));
  });

  it("win32 без APPDATA даёт понятную ошибку", () => {
    assert.throws(() => resolveJetbrainsRoot({}, "win32"), /APPDATA is not set/);
  });

  it("darwin берёт Library/Application Support", () => {
    const root = resolveJetbrainsRoot({ HOME: "/Users/u" }, "darwin");
    assert.equal(root, join("/Users/u", "Library", "Application Support", "JetBrains"));
  });

  it("darwin без HOME даёт понятную ошибку", () => {
    assert.throws(() => resolveJetbrainsRoot({}, "darwin"), /HOME is not set/);
  });

  it("linux предпочитает XDG_CONFIG_HOME", () => {
    const root = resolveJetbrainsRoot({ XDG_CONFIG_HOME: "/etc/xdg", HOME: "/Users/u" }, "linux");
    assert.equal(root, join("/etc/xdg", "JetBrains"));
  });

  it("linux без XDG_CONFIG_HOME падает на ~/.config", () => {
    const root = resolveJetbrainsRoot({ HOME: "/Users/u" }, "linux");
    assert.equal(root, join("/Users/u", ".config", "JetBrains"));
  });

  it("linux без XDG_CONFIG_HOME и HOME даёт понятную ошибку", () => {
    assert.throws(() => resolveJetbrainsRoot({}, "linux"), /Neither XDG_CONFIG_HOME nor HOME is set/);
  });
});
