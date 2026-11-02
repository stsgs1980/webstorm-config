import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    passWithNoTests: true,
    // Fixture tests spawn git, npx, eslint and tsc. On a loaded machine a
    // single spawn regularly exceeds the 5 s default and fails a green run.
    testTimeout: 30_000,
    // Test files: src/**/*.test.ts(x) — create src/ per docs/getting-started.md Step 4.
    // tests/** — tooling tests shipped with the template itself.
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.{ts,tsx,mjs}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
