// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);

/**
 * Resolve the file list of the project tsconfig through the TypeScript API.
 * @returns {string[]} repo-relative file names, with forward slashes
 */
const programFiles = () => {
  const ts = require("typescript");
  const read = ts.readConfigFile(join(REPO, "tsconfig.json"), ts.sys.readFile);
  assert.ok(read.config, "tsconfig.json must parse");
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, REPO);
  return parsed.fileNames.map((file) => {
    const normalized = file.replace(/\\/g, "/");
    const root = REPO.replace(/\\/g, "/").replace(/\/$/, "");
    return normalized.startsWith(root + "/") ? normalized.slice(root.length + 1) : normalized;
  });
};

/**
 * Write a scratch TypeScript file and return its cleanup function.
 * @param {string} relPath - repo-relative file path
 * @returns {() => void} cleanup that removes the file
 */
const writeScratch = (relPath) => {
  const path = join(REPO, relPath);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, "export const probe = 1;\n");
  return () => rmSync(path, { force: true });
};

describe("tsconfig program scope", () => {
  it("не включает посторонние .ts в корне репозитория", () => {
    const cleanup = writeScratch("scratch-probe.ts");
    try {
      const files = programFiles();
      assert.ok(
        !files.includes("scratch-probe.ts"),
        `expected scratch-probe.ts outside the program, got: ${files.join(", ")}`,
      );
    } finally {
      cleanup();
    }
  });

  it("не включает рабочие зоны drafts/ и coverage/", () => {
    const cleanups = ["drafts/scratch-probe.ts", "coverage/scratch-probe.ts"].map(writeScratch);
    try {
      const files = programFiles();
      for (const scratch of ["drafts/scratch-probe.ts", "coverage/scratch-probe.ts"]) {
        assert.ok(!files.includes(scratch), `expected ${scratch} outside the program, got: ${files.join(", ")}`);
      }
    } finally {
      for (const cleanup of cleanups) cleanup();
    }
  });

  it("включает исходники форка: src/ и server/", () => {
    const cleanups = ["src/scratch-probe.tsx", "server/scratch-probe.ts"].map(writeScratch);
    try {
      const files = programFiles();
      assert.ok(files.includes("src/scratch-probe.tsx"), `expected src in the program, got: ${files.join(", ")}`);
      assert.ok(files.includes("server/scratch-probe.ts"), `expected server in the program, got: ${files.join(", ")}`);
    } finally {
      for (const cleanup of cleanups) cleanup();
    }
  });

  it("включает скрипты и конфиг тестов", () => {
    const files = programFiles();
    assert.ok(files.includes("vitest.config.ts"), `expected vitest.config.ts, got: ${files.join(", ")}`);
    assert.ok(
      files.some((file) => file.startsWith("scripts/")),
      `expected scripts/ in the program, got: ${files.join(", ")}`,
    );
  });
  it("type-aware scope ESLint покрывает те же корни, что и программа tsc", () => {
    const eslintConfig = readFileSync(join(REPO, "eslint.config.js"), "utf8");
    // The type-aware block matches the roots of the tsconfig program. A file
    // outside them reaches the type service, which then fails to parse it
    // with "was not found by the project service" instead of linting it.
    const roots = [...eslintConfig.matchAll(/"([\w./-]+\/\*\*\/\*\.\{ts,tsx\})"/g)].map((match) => match[1]);
    assert.ok(roots.length > 0, "expected a type-aware files entry in eslint.config.js");
    for (const root of ["src/", "server/", "scripts/", "tests/"]) {
      assert.ok(
        roots.some((entry) => entry.startsWith(root)),
        `expected ${root} in the type-aware scope, got: ${roots.join(", ")}`,
      );
    }
  });
});
