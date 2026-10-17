// The pattern is assembled at runtime: WebStorm's RegExp analysis flags
// \p{Extended_Pictographic} in literals as "Unknown character category"
// (IJPL-101766) and reports a duplicate branch for new RegExp templates with
// substitutions. U+20E3 covers keycap emoji: 1, # and *.
const emojiBranches = [String.raw`\p{Extended_Pictographic}`, String.raw`\p{Regional_Indicator}`, String.raw`\u20E3`];

const emojiPattern = new RegExp(emojiBranches.join("|"), "u");

const unicodeGraphicsPattern = /[\u{2500}-\u{257F}\u{2580}-\u{259F}\u{25A0}-\u{25FF}\u{2800}-\u{28FF}]/u;

const formatCodePoint = (character) => `U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;

const createRule = ({ description, message, messageId, pattern }) => {
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
              data: { codePoint: formatCodePoint(match[0]) },
              loc: { line: index + 1, column: match.index },
              messageId,
            });
          }
        });
      },
    };
  };
  return {
    meta: { type: "problem", docs: { description }, schema: [], messages: { [messageId]: message } },
    create,
  };
};

const emoji = createRule({
  description: "Disallow emoji; use text tags like [OK] or [FAIL].",
  message: "Emoji are prohibited. Use text tags like [OK], [FAIL] instead. Found {{codePoint}}.",
  messageId: "noEmoji",
  pattern: emojiPattern,
});

const unicodeGraphics = createRule({
  description: "Disallow Unicode box/line drawing characters; use ASCII.",
  message: "Unicode box/line drawing characters are prohibited. Use ASCII. Found {{codePoint}}.",
  messageId: "noUnicodeGraphics",
  pattern: unicodeGraphicsPattern,
});

export default {
  rules: {
    emoji,
    "unicode-graphics": unicodeGraphics,
  },
};
