import markdownPlugin from "@eslint/markdown";
import type { Linter } from "eslint";

const originalProcessor = markdownPlugin.processors.markdown;

/**
 * Filter out parsing error messages.
 * @param {Linter.LintMessage} message - ESLint message object.
 * @returns {boolean} True if message should be excluded.
 */
const EXCLUDE_PARSING_ERRORS = (message: Linter.LintMessage): boolean =>
  !(message.ruleId === null && message.message?.startsWith("Parsing error"));

/**
 * Post-process messages by filtering parsing errors.
 * @param {Linter.LintMessage[]} messages - ESLint messages.
 * @param {string} filename - File name being processed.
 * @returns {Linter.LintMessage[]} Filtered messages.
 */
const postprocess = (messages: Linter.LintMessage[][], filename: string): Linter.LintMessage[][] => {
  const originalMessages = originalProcessor.postprocess(messages, filename);
  return originalMessages.filter(EXCLUDE_PARSING_ERRORS) as unknown as Linter.LintMessage[][];
};

export default {
  meta: { name: "markdown-snippets-processor", version: "1.0.0" },
  preprocess: originalProcessor.preprocess,
  postprocess: postprocess,
  supportsAutofix: originalProcessor.supportsAutofix,
};
