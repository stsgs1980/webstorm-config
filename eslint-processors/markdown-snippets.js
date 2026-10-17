// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import markdownPlugin from "@eslint/markdown";

const originalProcessor = markdownPlugin.processors.markdown;

export default {
  meta: { name: "markdown-snippets-processor", version: "1.0.0" },
  preprocess: originalProcessor.preprocess,
  postprocess: originalProcessor.postprocess,
  supportsAutofix: originalProcessor.supportsAutofix,
};
