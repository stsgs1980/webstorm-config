import markdownPlugin from "@eslint/markdown";

// noinspection JSUnresolvedVariable,JSUnresolvedFunction
const originalProcessor = markdownPlugin.processors.markdown;

/**
 * Filter out parsing error messages.
 * @param {Object} message - ESLint message object.
 * @returns {boolean} True if message should be excluded.
 */
const EXCLUDE_PARSING_ERRORS = (message) =>
  // noinspection JSUnresolvedVariable
  !(message?.ruleId === null && message?.message?.startsWith("Parsing error"));

/**
 * Post-process messages by filtering parsing errors.
 * @param {Array<Array<Object>>} messages - ESLint messages.
 * @param {string} filename - File name being processed.
 * @returns {Array<Array<Object>>} Filtered messages.
 */
const postprocess = (messages, filename) => {
  // noinspection JSUnresolvedFunction
  const originalMessages = originalProcessor.postprocess(messages, filename);
  return originalMessages.filter(EXCLUDE_PARSING_ERRORS);
};

export default {
  meta: { name: "markdown-snippets-processor", version: "1.0.0" },
  // noinspection JSUnresolvedVariable,JSUnresolvedFunction
  preprocess: originalProcessor.preprocess,
  postprocess,
  // noinspection JSUnresolvedVariable
  supportsAutofix: originalProcessor.supportsAutofix,
};
