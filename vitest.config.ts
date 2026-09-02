import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    passWithNoTests: true,
    // Test files: src/**/*.test.ts(x) — create src/ per docs/getting-started.md Step 4.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
