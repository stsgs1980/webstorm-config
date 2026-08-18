import jsdoc from "eslint-plugin-jsdoc";
import markdown from "@eslint/markdown";
import tsParser from "@typescript-eslint/parser";
import unicodePolicy from "./eslint-rules/unicode-policy.js";
import codeBlockLanguage from "./eslint-rules/code-block-language.js";
import markdownSnippetsProcessor from "./eslint-processors/markdown-snippets.js";

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
    plugins: { jsdoc, "unicode-policy": unicodePolicy },
    rules: {
      "unicode-policy/emoji": "error",
      "unicode-policy/unicode-graphics": "error",
      "no-irregular-whitespace": "error",
      "jsdoc/require-jsdoc": "warn",
      "jsdoc/require-param": "warn",
      "jsdoc/require-returns": "warn",
    },
  },
];
