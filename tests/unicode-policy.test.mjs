// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import { RuleTester } from "eslint";
// noinspection NpmUsedModulesInstalled
import { describe } from "vitest";

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
      "const digit = '1\u{FE0F}';",
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
      {
        name: "keycap с цифрой (1 U+FE0F U+20E3) ловится",
        code: "const keycap = '1\u{FE0F}\u{20E3}';",
        errors: [{ messageId: "noEmoji", line: 1 }],
      },
      {
        name: "keycap с решёткой и звёздочкой ловится",
        code: "const hash = '#\u{FE0F}\u{20E3}';\nconst star = '*\u{FE0F}\u{20E3}';",
        errors: [
          { messageId: "noEmoji", line: 1 },
          { messageId: "noEmoji", line: 2 },
        ],
      },
      {
        name: "одиночный U+20E3 ловится",
        code: "const enclosing = '\u{20E3}';",
        errors: [{ messageId: "noEmoji", line: 1 }],
      },
      {
        name: "column указывает на U+20E3 внутри keycap",
        code: "const s = '1\u{FE0F}\u{20E3}';",
        errors: [{ messageId: "noEmoji", line: 1, column: 14 }],
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
