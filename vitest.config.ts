import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Explicit false: a suite with zero tests must not look green even if a
    // future Vitest major changes its default. scripts/check-test-files.ts
    // runs first through pretest and prints the actionable message.
    passWithNoTests: false,
    // Fixture tests spawn git, npx, eslint and tsc. On a loaded machine a
    // single spawn regularly exceeds the 5 s default and fails a green run.
    testTimeout: 30_000,
    // Test files: src/**/*.test.ts(x) — create src/ per docs/getting-started.md Step 4.
    // tests/** — tooling tests shipped with the template itself.
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "tests/**/*.{test,spec}.{ts,tsx,mjs}",
      "scripts/**/*.{test,spec}.{ts,mjs}",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Scripts run in child processes (execFileSync), so v8 cannot instrument
      // them; their behaviour is covered by fixture tests, not line coverage.
      include: ["eslint-rules/**", "eslint-parsers/**", "eslint-processors/**", "tests/lib/**"],
    },
  },
});
