import { join } from "node:path";
import process from "node:process";

// Fixture tests spawn the IDE-state gate without --jetbrains-root, so the
// scripts under test resolve the JetBrains base from the environment
// (resolveJetbrainsRoot in scripts/lib/ide-state.ts). The contract is
// platform-dependent: APPDATA on Windows, HOME on macOS, XDG_CONFIG_HOME
// with a HOME/.config fallback on Linux. Injecting only APPDATA satisfied
// the pre-per-platform contract and broke CI on ubuntu/windows-floor jobs
// with "No JetBrains directory found"; every fixture must go through this
// module instead.

/**
 * Environment entries pointing scripts under test at a fixture base
 * directory, mirroring resolveJetbrainsRoot for the current platform.
 * @param {string} base - fixture directory the JetBrains config lives under
 * @returns {Record<string, string>} environment entries to inject
 */
export function jetbrainsEnv(base) {
  switch (process.platform) {
    case "win32":
      return { APPDATA: base };
    case "darwin":
      return { HOME: base };
    default:
      return { HOME: base, XDG_CONFIG_HOME: join(base, ".config") };
  }
}

/**
 * The JetBrains base directory a fixture resolves to on this platform, so
 * tests create WebStorm directories at the path the gate actually reads.
 * @param {string} base - fixture directory the JetBrains config lives under
 * @returns {string} resolved JetBrains base directory
 */
export function jetbrainsRoot(base) {
  switch (process.platform) {
    case "win32":
      return join(base, "JetBrains");
    case "darwin":
      return join(base, "Library", "Application Support", "JetBrains");
    default:
      return join(base, ".config", "JetBrains");
  }
}
