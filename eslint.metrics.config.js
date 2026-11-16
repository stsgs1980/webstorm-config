// noinspection ES6UnusedImports,NpmUsedModulesInstalled,ES6UnusedDefaultExport
// Advisory metrics: run via `npm run lint:metrics` in the CI `lint` and
// `windows` jobs. Warnings are surfaced for review and never fail the run
// (AGENTS.md §4.2): they answer "where is the code worth a responsibility check".
// Plain Node file: TS annotations are not parseable there (see eslint.config.js).
// Threshold values are owned by scripts/lib/thresholds.ts; importing a .ts
// module from this config works (Node 24 strips the types when loading it).
import tsParser from "@typescript-eslint/parser";
import { MAX_COMPLEXITY, MAX_FUNCTION_LINES, MAX_NESTING_DEPTH, MAX_PARAMS } from "./scripts/lib/thresholds.ts";

/**
 * Directory and test exemptions for the metrics lane. File-level kinds
 * (.d.ts, *.config.*, generated suffixes, barrels, the file-length escape
 * hatch) are owned by scripts/check-file-length.ts; this list need not mirror it.
 */
const EXEMPT = [
  "node_modules/**",
  "dist/**",
  "build/**",
  "coverage/**",
  "dev/**",
  "out/**",
  ".next/**",
  ".nuxt/**",
  ".svelte-kit/**",
  ".astro/**",
  ".output/**",
  ".vite/**",
  ".cache/**",
  ".idea/**",
  ".superpowers/**",
  ".opencode/**",
  ".agents/**",
  // Draft workspace and JetBrains Air session data: scratch, never source.
  "drafts/**",
  ".awb/**",
  // Metrics describe hand-edited source; vendored and generated trees answer to their tools.
  "**/vendor/**",
  "**/generated/**",
  "**/__generated__/**",
  "**/codegen/**",
  "**/*.gen.*",
  "**/components/ui/**",
  // Tests measure coverage, not cohesion: exemption mirrors check-file-length.
  "**/*.test.*",
  "**/*.spec.*",
  "**/tests/**",
  "**/__tests__/**",
];

// ESLint loads this config; no project module imports it.
// noinspection JSUnusedGlobalSymbols
export default [
  {
    ignores: EXEMPT,
  },
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Threshold values come from scripts/lib/thresholds.ts (single owner).
      complexity: ["warn", MAX_COMPLEXITY],
      "max-lines-per-function": ["warn", { max: MAX_FUNCTION_LINES, skipBlankLines: true, skipComments: true }],
      "max-params": ["warn", { max: MAX_PARAMS }],
      "max-depth": ["warn", MAX_NESTING_DEPTH],
    },
  },
];
