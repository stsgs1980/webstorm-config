// noinspection ES6UnusedImports,NpmUsedModulesInstalled,ES6UnusedDefaultExport
// Advisory metrics lane: run via `npm run lint:metrics`, never part of `npm run lint`,
// pre-commit or CI gates. A warning here does not fail the run: metrics answer
// "where is the code worth a responsibility check", they do not forbid anything.
// Plain Node file: TS annotations are not parseable there (see eslint.config.js).
import tsParser from "@typescript-eslint/parser";

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
  ".idea/**",
  ".superpowers/**",
  ".opencode/**",
  ".agents/**",
  // Metrics describe hand-edited source; vendored and generated trees answer to their tools.
  "**/vendor/**",
  "**/generated/**",
  "**/__generated__/**",
  "**/codegen/**",
  "**/.gen.*",
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
      // Thresholds from the anti-monolith section of .aiassistant/rules:
      // signals to analyze, not barriers.
      complexity: ["warn", 15],
      "max-lines-per-function": ["warn", { max: 60, skipBlankLines: true, skipComments: true }],
      "max-params": ["warn", { max: 4 }],
      "max-depth": ["warn", 4],
    },
  },
];
