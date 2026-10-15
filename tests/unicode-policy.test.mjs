import { RuleTester } from "eslint";

import unicodePolicy from "../eslint-rules/unicode-policy.js";

const tester = new RuleTester();

describe("unicode-policy/emoji", () => {
  tester.run("emoji", unicodePolicy.rules.emoji, {
    valid: [
      "export const ok = '[OK]';",
      "const s = '->';",
      "const star = '★';",
      "const txt = '→ — …';",
      "const path = 'docs/live-templates/README.md';",
    ],
    invalid: [
      {
        name: "эмодзи ловится",
        code: "export const s = '⏰';",
        errors: [{ messageId: "noEmoji", line: 1 }],
      },
      {
        name: "эмодзи в комментарии",
        code: "// ⏰ behind the times",
        errors: [{ messageId: "noEmoji", line: 1 }],
      },
      {
        name: "два эмодзи в одной строке дают одну ошибку",
        code: "export const s = '⏰ ⭐';",
        errors: [{ messageId: "noEmoji", line: 1 }],
      },
      {
        name: "номер строки определяется верно",
        code: "export const ok = '[OK]';\nexport const bad = '⏰';",
        errors: [{ messageId: "noEmoji", line: 2 }],
      },
      {
        name: "текстовый copyright ловится",
        code: "const c = '©';",
        errors: [{ messageId: "noEmoji", line: 1 }],
      },
      {
        name: "буквенный бейдж U+1F170 ловится",
        code: "const badge = '🅰';",
        errors: [{ messageId: "noEmoji", line: 1 }],
      },
      {
        name: "column указывает на первый запрещённый символ",
        code: "const s = '⏰';",
        errors: [{ messageId: "noEmoji", line: 1, column: 12 }],
      },
    ],
  });
});

describe("unicode-policy/unicode-graphics", () => {
  tester.run("unicode-graphics", unicodePolicy.rules["unicode-graphics"], {
    valid: ["export const ok = 1;", "const frame = '+---+';", "const divider = '----';", "const marks = '★ ✔ ♥';"],
    invalid: [
      {
        code: "export const s = '─';",
        errors: [{ messageId: "noUnicodeGraphics", line: 1 }],
      },
      {
        name: "псевдографика в комментарии",
        code: "// █ progress bar",
        errors: [{ messageId: "noUnicodeGraphics", line: 1 }],
      },
    ],
  });
});
