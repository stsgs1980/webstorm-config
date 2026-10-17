// The pattern is assembled at runtime: WebStorm's RegExp analysis flags
// \p{Extended_Pictographic} in literals as "Unknown character category"
// (IJPL-101766) and reports a duplicate branch for new RegExp templates with
// substitutions. U+20E3 covers keycap emoji: 1, # and *.
const emojiBranches = [String.raw`\p{Extended_Pictographic}`, String.raw`\p{Regional_Indicator}`, String.raw`\u20E3`];

const emojiPattern = new RegExp(emojiBranches.join("|"), "u");

const unicodeGraphicsPattern = /[\u{2500}-\u{257F}\u{2580}-\u{259F}\u{25A0}-\u{25FF}\u{2800}-\u{28FF}]/u;

const createRule = (messages, pattern) => {
  const create = (context) => {
    const sourceCode = context.sourceCode || context.getSourceCode();
    const lines = sourceCode.getText().split("\n");
    const matcher = new RegExp(pattern.source, `${pattern.flags}g`);
    // noinspection JSUnusedGlobalSymbols
    return {
      Program() {
        lines.forEach((line, index) => {
          for (const match of line.matchAll(matcher)) {
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
