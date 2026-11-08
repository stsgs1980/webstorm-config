// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import js from "@eslint/js";
// noinspection NpmUsedModulesInstalled
import markdown from "@eslint/markdown";
// noinspection NpmUsedModulesInstalled
import tsParser from "@typescript-eslint/parser";
// noinspection NpmUsedModulesInstalled
import eslintConfigPrettier from "eslint-config-prettier/flat";
// noinspection NpmUsedModulesInstalled
import jsdoc from "eslint-plugin-jsdoc";
// noinspection NpmUsedModulesInstalled
import jsxA11y from "eslint-plugin-jsx-a11y";
// noinspection NpmUsedModulesInstalled
import react from "eslint-plugin-react";
// noinspection NpmUsedModulesInstalled
import reactHooks from "eslint-plugin-react-hooks";
// noinspection NpmUsedModulesInstalled
import globals from "globals";
import { fileURLToPath } from "node:url";
// noinspection NpmUsedModulesInstalled
import tseslint from "typescript-eslint";
import plainTextParser from "./eslint-parsers/plain-text.js";
import markdownSnippetsProcessor from "./eslint-processors/markdown-snippets.js";
import unicodePolicy from "./eslint-rules/unicode-policy.js";

export default [
  {
    ignores: [
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
      // File templates use ${NAME} placeholders, they are not valid source files.
      ".idea/**",
      // Agent workspace (superpowers briefs/ledger; never present in CI).
      ".superpowers/**",
      // Draft workspace: reports and working notes outside every gate.
      "drafts/**",
      // Agent workspace: local state of the IDE agent, never committed.
      ".opencode/**",
      ".agents/**",
    ],
  },
  ...markdown.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}"],
    ...js.configs.recommended,
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.md"],
    processor: markdownSnippetsProcessor,
  },
  {
    // Non-JS fenced snippets: the policy works on raw text, the parser returns an
    // empty Program for any content. The pattern must stay specific: patterns that
    // end in /* or /** are "universal" for ESLint, and code blocks matching only
    // those are silently skipped. JS/TS snippets are excluded here: the block below
    // keeps tsParser and the full rule set for them.
    files: ["**/*.md/*.*"],
    ignores: ["**/*.md/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}", "**/*.md/*.md"],
    languageOptions: { parser: plainTextParser },
    linterOptions: { reportUnusedDisableDirectives: false },
    plugins: { "unicode-policy": unicodePolicy },
    rules: {
      "unicode-policy/emoji": "error",
      "unicode-policy/unicode-graphics": "error",
    },
  },
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}"],
    // Keep unused-disable reporting off for all JS/TS linting (sources and snippets):
    // the flat-config default is warn, docs snippets show illustrative disable lines,
    // and --max-warnings=0 would turn those warnings into failures.
    linterOptions: { reportUnusedDisableDirectives: false },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      jsdoc,
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
      "unicode-policy": unicodePolicy,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      "unicode-policy/emoji": "error",
      "unicode-policy/unicode-graphics": "error",
      "no-irregular-whitespace": "error",
      "no-var": "error",
      "prefer-const": "error",
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            ArrowFunctionExpression: true,
            MethodDefinition: true,
          },
        },
      ],
      "jsdoc/require-param": "off",
      "jsdoc/require-returns": "off",
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error",
      "react-hooks/rules-of-hooks": "error",
      // No warn level in this config: --max-warnings=0 makes "warn" identical
      // to "error", so a name that reads as advisory would still block CI.
      // Real defects are named "error"; advisory metrics live in the
      // separate non-blocking lane: npm run lint:metrics.
      "react-hooks/exhaustive-deps": "error",
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-has-content": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/no-redundant-roles": "error",
    },
  },
  {
    // Custom ESLint rules and other tooling run in plain Node: TS annotations are
    // not parseable there. Return documentation is enforced by jsdoc/require-returns.
    files: ["**/*.{js,mjs,cjs}"],
    rules: {
      "@typescript-eslint/explicit-function-return-type": "off",
      "jsdoc/require-param": "error",
      "jsdoc/require-returns": "error",
    },
  },
  {
    // Console policy by context (guide 5.2, item 7): in application code a
    // console call is a forgotten debug leftover; on the server and in
    // scripts logging is the tool of the trade, so it stays allowed.
    files: ["scripts/**", "server/**"],
    rules: {
      "no-console": "off",
    },
  },
  {
    // Promise rules need type information (guide 5.2, item 6): syntax-only
    // linting sees no difference between a returned Promise and a void call.
    // projectService picks the nearest tsconfig from the file; Markdown
    // snippets are virtual files that exist only in the processor, and the
    // type service cannot resolve a file that is not on disk, so they are
    // excluded here and keep the syntax-only parserOptions of the main block.
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["**/*.md/*"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
        projectService: true,
        tsconfigRootDir: fileURLToPath(new URL(".", import.meta.url)),
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },
  {
    // Node environment: tooling, tests and the server. Globals are declared
    // per path on purpose: a browser name in a Node file must stay an error.
    files: ["scripts/**", "server/**", "tests/**", "*.config.*"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // Browser environment: application code only.
    files: ["src/**"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    // no-undef is off for TypeScript, so globals alone cannot enforce the
    // boundary there: restrict the browser names explicitly in Node code.
    files: ["scripts/**", "server/**", "*.config.*"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "window", message: "Browser globals belong to src/**." },
        { name: "document", message: "Browser globals belong to src/**." },
        { name: "navigator", message: "Browser globals belong to src/**." },
        { name: "localStorage", message: "Browser globals belong to src/**." },
      ],
    },
  },
  {
    // The inverse boundary: application code must not reach into Node.
    files: ["src/**"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "process", message: "Node globals belong to scripts/ and server/." },
        { name: "Buffer", message: "Node globals belong to scripts/ and server/." },
        { name: "__dirname", message: "Node globals belong to scripts/ and server/." },
        { name: "__filename", message: "Node globals belong to scripts/ and server/." },
      ],
    },
  },
  {
    // Template's own tooling tests: Vitest globals + intentional fixtures.
    // Must stay last: overrides the code rules above for tests/**.
    files: ["tests/**"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
      },
    },
    rules: {
      "unicode-policy/emoji": "off",
      "unicode-policy/unicode-graphics": "off",
    },
  },
  // Prettier owns formatting: turn off every rule that could fight it. Last
  // entry on purpose - it must override earlier configs, not be overridden.
  eslintConfigPrettier,
];
