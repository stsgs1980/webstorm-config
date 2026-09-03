import markdown from "@eslint/markdown";
import tsParser from "@typescript-eslint/parser";
import jsdoc from "eslint-plugin-jsdoc";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import markdownSnippetsProcessor from "./eslint-processors/markdown-snippets.ts";
import codeBlockLanguage from "./eslint-rules/code-block-language.js";
import unicodePolicy from "./eslint-rules/unicode-policy.js";

const codeBlockLanguagePlugin = {
  meta: { name: "code-block-language", version: "1.0.0" },
  rules: { "require-language": codeBlockLanguage },
};

export default [
  {
    ignores: ["node_modules/**", "dist/**", "build/**"],
  },
  ...markdown.configs.recommended,
  {
    files: ["**/*.md"],
    processor: markdownSnippetsProcessor,
  },
  {
    files: ["**/*.md/**"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    linterOptions: { reportUnusedDisableDirectives: false },
    plugins: { "unicode-policy": unicodePolicy },
    rules: {
      "unicode-policy/emoji": "error",
      "unicode-policy/unicode-graphics": "error",
    },
  },
  {
    files: ["**/*.md"],
    plugins: {
      "unicode-policy": unicodePolicy,
      "code-block-language": codeBlockLanguagePlugin,
    },
    rules: {
      "unicode-policy/emoji-in-md": "error",
      "unicode-policy/unicode-graphics-in-md": "error",
      "code-block-language/require-language": "error",
    },
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
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
      "jsdoc/require-jsdoc": "warn",
      "jsdoc/require-param": "warn",
      "jsdoc/require-returns": "warn",
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
];
