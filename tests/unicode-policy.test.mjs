import { RuleTester } from "eslint";

import unicodePolicy from "../eslint-rules/unicode-policy.js";

const tester = new RuleTester();

describe("unicode-policy/emoji", () => {
  tester.run("emoji", unicodePolicy.rules.emoji, {
    valid: ["export const ok = '[OK]';", "const s = '->';"],
    invalid: [
      {
        code: "export const s = '★';",
        errors: [{ messageId: "noEmoji" }],
      },
    ],
  });
});

describe("unicode-policy/unicode-graphics", () => {
  tester.run("unicode-graphics", unicodePolicy.rules["unicode-graphics"], {
    valid: ["export const ok = 1;"],
    invalid: [
      {
        code: "export const s = '─';",
        errors: [{ messageId: "noUnicodeGraphics" }],
      },
    ],
  });
});
