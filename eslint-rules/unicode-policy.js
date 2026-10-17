// noinspection Annotator
const emojiPattern = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

const unicodeGraphicsPattern = /[\u{2500}-\u{257F}\u{2580}-\u{259F}\u{25A0}-\u{25FF}\u{2800}-\u{28FF}]/u;

const createRule = (messages, pattern) => {
  const create = (context) => {
    const sourceCode = context.sourceCode || context.getSourceCode();
    const lines = sourceCode.getText().split("\n");
    // noinspection JSUnusedGlobalSymbols
    return {
      Program() {
        lines.forEach((line, index) => {
          const match = pattern.exec(line);
          if (match) {
            context.report({
              loc: { line: index + 1, column: match.index },
              messageId: Object.keys(messages)[0],
            });
          }
        });
      },
    };
  };
  return { meta: { type: "problem", messages }, create };
};

const emoji = createRule(
  {
    noEmoji: "Emoji are prohibited. Use text tags like [OK], [FAIL] instead.",
  },
  emojiPattern,
);

const unicodeGraphics = createRule(
  {
    noUnicodeGraphics: "Unicode box/line drawing characters are prohibited. Use ASCII.",
  },
  unicodeGraphicsPattern,
);

export default {
  rules: {
    emoji,
    "unicode-graphics": unicodeGraphics,
  },
};
