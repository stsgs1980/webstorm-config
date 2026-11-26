// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { join } from "node:path";
// noinspection NpmUsedModulesInstalled
import { beforeEach, describe, it, vi } from "vitest";

const state = vi.hoisted(() => ({ platform: "win32" }));
vi.mock("node:os", () => ({ platform: () => state.platform }));

const { jetbrainsEnv, jetbrainsRoot } = await import("./lib/ide-env.mjs");

const BASE = join("tmp", "fixture");

describe("ide-env fixture helpers", () => {
  beforeEach(() => {
    state.platform = "win32";
  });

  it("win32 uses APPDATA and the JetBrains folder under it", () => {
    assert.deepEqual(jetbrainsEnv(BASE), { APPDATA: BASE });
    assert.equal(jetbrainsRoot(BASE), join(BASE, "JetBrains"));
  });

  it("darwin uses HOME and the macOS support folder", () => {
    state.platform = "darwin";
    assert.deepEqual(jetbrainsEnv(BASE), { HOME: BASE });
    assert.equal(jetbrainsRoot(BASE), join(BASE, "Library", "Application Support", "JetBrains"));
  });

  it("linux uses XDG_CONFIG_HOME with a HOME/.config fallback", () => {
    state.platform = "linux";
    assert.deepEqual(jetbrainsEnv(BASE), { HOME: BASE, XDG_CONFIG_HOME: join(BASE, ".config") });
    assert.equal(jetbrainsRoot(BASE), join(BASE, ".config", "JetBrains"));
  });
});
