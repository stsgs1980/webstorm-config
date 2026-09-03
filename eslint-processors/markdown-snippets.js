import markdownPlugin from "@eslint/markdown";

const originalProcessor = markdownPlugin.processors.markdown;

/**
 * Filter out parsing error messages.
 * @param {Object} message - ESLint message object.
 * @returns {boolean} True if message should be excluded.
 */
const EXCLUDE_PARSING_ERRORS = (message) =>
  !(message?.ruleId === null && message?.message?.startsWith("Parsing error"));

/**
 * Post-process messages by filtering parsing errors.
 * @param {Array<Array<Object>>} messages - ESLint messages.
 * @param {string} filename - File name being processed.
 * @returns {Array<Array<Object>>} Filtered messages.
 */
const postprocess = (messages, filename) => {
  const originalMessages = originalProcessor.postprocess(messages, filename);
  return originalMessages.filter(EXCLUDE_PARSING_ERRORS);
};

export default {
  meta: { name: "markdown-snippets-processor", version: "1.0.0" },
  preprocess: originalProcessor.preprocess,
  postprocess,
  supportsAutofix: originalProcessor.supportsAutofix,
};
