import markdownPlugin from "@eslint/markdown";

const originalProcessor = markdownPlugin.processors.markdown;

const EXCLUDE_PARSING_ERRORS = (message) => {
  if (
    message &&
    message.ruleId === null &&
    message.message &&
    message.message.startsWith("Parsing error")
  ) {
    return false;
  }
  return true;
};

export default {
  meta: { name: "markdown-snippets-processor", version: "1.0.0" },
  preprocess: originalProcessor.preprocess,
  postprocess(messages, filename) {
    const originalMessages = originalProcessor.postprocess(messages, filename);
    return originalMessages.filter(EXCLUDE_PARSING_ERRORS);
  },
  supportsAutofix: originalProcessor.supportsAutofix,
};
