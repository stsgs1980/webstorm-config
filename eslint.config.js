// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import js from "@eslint/js";
// noinspection NpmUsedModulesInstalled
import markdown from "@eslint/markdown";
// noinspection NpmUsedModulesInstalled
import tsParser from "@typescript-eslint/parser";
// noinspection NpmUsedModulesInstalled
import jsdoc from "eslint-plugin-jsdoc";
// noinspection NpmUsedModulesInstalled
import jsxA11y from "eslint-plugin-jsx-a11y";
// noinspection NpmUsedModulesInstalled
import react from "eslint-plugin-react";
// noinspection NpmUsedModulesInstalled
import reactHooks from "eslint-plugin-react-hooks";
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
      "react-hooks/exhaustive-deps": "warn",
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
    // Template's own tooling tests: vitest globals + intentional fixtures.
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
];
