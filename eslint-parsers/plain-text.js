// Snippets in non-JS languages (json, python, bash, text, ...) are checked for the
// Unicode policy: the rules read the raw source text, so a minimal empty Program is
// enough and any snippet content stays parseable.
// noinspection JSUnusedGlobalSymbols
const plainTextParser = {
  meta: { name: "plain-text-parser", version: "1.0.0" },
  parse(text) {
    return {
      type: "Program",
      body: [],
      sourceType: "module",
      comments: [],
      tokens: [],
      range: [0, text.length],
      loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } },
    };
  },
};

export default plainTextParser;
