// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import { RuleTester } from "eslint";
import assert from "node:assert/strict";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";

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
        name: "эмодзи ловится и сообщение содержит код поинта",
        code: "export const s = '⏰';",
        errors: [{ line: 1, message: "Emoji are prohibited. Use text tags like [OK], [FAIL] instead. Found U+23F0." }],
      },
      {
        name: "эмодзи в комментарии",
        code: "// ⏰ behind the times",
        errors: [{ messageId: "noEmoji", line: 1 }],
      },
      {
        name: "два эмодзи в одной строке дают две ошибки",
        code: "export const s = '⏰ ⭐';",
        errors: [
          { messageId: "noEmoji", line: 1, column: 19 },
          { messageId: "noEmoji", line: 1, column: 21 },
        ],
      },
      {
        name: "колонки считаются в UTF-16-единицах после суррогатной пары",
        code: "const s = '🅰⏰';",
        errors: [
          { messageId: "noEmoji", line: 1, column: 12 },
          { messageId: "noEmoji", line: 1, column: 14 },
        ],
      },
      {
        name: "номер строки определяется верно",
        code: "export const ok = '[OK]';\nexport const bad = '⏰';",
        errors: [{ messageId: "noEmoji", line: 2 }],
      },
      {
        name: "позиция верна при CRLF-переносах",
        code: "const ok = 1;\r\nconst s = '⏰';\r\n",
        errors: [{ messageId: "noEmoji", line: 2, column: 12 }],
      },
      {
        name: "текстовый copyright ловится",
        code: "const c = '©';",
        errors: [{ messageId: "noEmoji", line: 1, data: { codePoint: "U+00A9" } }],
      },
      {
        name: "буквенный бейдж U+1F170 ловится",
        code: "const badge = '🅰';",
        errors: [{ messageId: "noEmoji", line: 1, column: 16, data: { codePoint: "U+1F170" } }],
      },
      {
        name: "column указывает на первый запрещённый символ",
        code: "const s = '⏰';",
        errors: [{ messageId: "noEmoji", line: 1, column: 12 }],
      },
      {
        name: "keycap с цифрой (1 U+FE0F U+20E3) ловится",
        code: "const keycap = '1\u{FE0F}\u{20E3}';",
        errors: [{ messageId: "noEmoji", line: 1, data: { codePoint: "U+20E3" } }],
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
        errors: [{ messageId: "noUnicodeGraphics", line: 1, data: { codePoint: "U+2588" } }],
      },
      {
        name: "несколько символов псевдографики в строке дают несколько ошибок",
        code: "const bar = '───';",
        errors: [
          { messageId: "noUnicodeGraphics", line: 1, column: 14 },
          { messageId: "noUnicodeGraphics", line: 1, column: 15 },
          { messageId: "noUnicodeGraphics", line: 1, column: 16 },
        ],
      },
    ],
  });
});

describe("unicode-policy/meta", () => {
  it("у правил есть описание и схема для тулинга", () => {
    assert.equal(unicodePolicy.rules.emoji.meta.docs.description, "Disallow emoji; use text tags like [OK] or [FAIL].");
    assert.deepEqual(unicodePolicy.rules.emoji.meta.schema, []);
    assert.equal(
      unicodePolicy.rules["unicode-graphics"].meta.docs.description,
      "Disallow Unicode box/line drawing characters; use ASCII.",
    );
    assert.deepEqual(unicodePolicy.rules["unicode-graphics"].meta.schema, []);
  });
});
