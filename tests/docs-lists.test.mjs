// noinspection SpellCheckingInspection
// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";
import { checkBadges, checkDocsMap, checkInstallCoverage, collectConfigPackages } from "../scripts/lib/docs-lists.ts";
import { checkWiringTable, expectedWiring, parseCiSources, parseWiringTable } from "../scripts/lib/docs-wiring.ts";

const CI = `
jobs:
  lint:
    steps:
      - run: npm run lint
      - run: |
          npm run lint:css
          echo done
  test:
    steps:
      - run: npm test
`;

const SCRIPTS = {
  lint: "eslint . --max-warnings=0",
  "lint:css": 'stylelint "**/*.{css,scss}" --allow-empty-input',
  test: "vitest run",
  changelog: "node scripts/generate-changelog.ts",
};

describe("parseCiSources", () => {
  it("собирает inline- и блочные run-шаги по джобам", () => {
    const sources = parseCiSources(CI);
    assert.deepEqual(
      sources.map((source) => source.name),
      ["lint", "lint", "test"],
    );
    assert.match(sources[0].text, /npm run lint/);
    assert.match(sources[1].text, /npm run lint:css/);
    assert.match(sources[1].text, /echo done/);
    assert.match(sources[2].text, /npm test/);
  });
});

describe("expectedWiring", () => {
  it("маппит npm run, npm test и verbatim node-команды", () => {
    const wiring = expectedWiring(SCRIPTS, parseCiSources(CI));
    assert.deepEqual(wiring.get("lint"), new Set(["lint"]));
    assert.deepEqual(wiring.get("lint:css"), new Set(["lint"]));
    assert.deepEqual(wiring.get("test"), new Set(["test"]));
    assert.equal(wiring.has("changelog"), false);
  });
});

describe("checkWiringTable", () => {
  const table = (rows) => ["| Команда | Где | Что |", "| --- | --- | --- |", ...rows].join("\n");
  const row = (command, where) => `| \`${command}\` | ${where} | описание |`;

  it("сходящаяся таблица не даёт нарушений", () => {
    const failures = [];
    checkWiringTable(
      SCRIPTS,
      parseCiSources(CI),
      table([row("npm run lint", "lint"), row("npm run lint:css", "lint"), row("npm test", "test")]),
      failures,
    );
    assert.deepEqual(failures, []);
  });

  it("дрейф ci.yml (команда переехала в другую джобу) валит таблицу", () => {
    const drifted = CI.replace("      - run: npm test\n", "      - run: npm run lint:css\n");
    const failures = [];
    checkWiringTable(
      SCRIPTS,
      parseCiSources(drifted),
      table([row("npm run lint", "lint"), row("npm run lint:css", "lint"), row("npm test", "test")]),
      failures,
    );
    assert.equal(failures.length, 2);
    assert.match(failures[0], /wiring row for lint:css misses location test/);
    assert.match(failures[1], /wiring row for test lists unwired location test/);
  });

  it("строка, удалённая из таблицы, валит проверку", () => {
    const failures = [];
    checkWiringTable(
      SCRIPTS,
      parseCiSources(CI),
      table([row("npm run lint", "lint"), row("npm run lint:css", "lint")]),
      failures,
    );
    assert.match(failures.join("\n"), /wiring table has no row for test/);
  });

  it("место, которого нет ни в одной джобе, валит проверку", () => {
    const failures = [];
    checkWiringTable(
      SCRIPTS,
      parseCiSources(CI),
      table([row("npm run lint", "lint, floor"), row("npm run lint:css", "lint"), row("npm test", "test")]),
      failures,
    );
    assert.match(failures.join("\n"), /wiring row for lint lists unwired location floor/);
  });

  it("parseWiringTable читает npm test как скрипт test", () => {
    const rows = parseWiringTable(table([row("npm test", "test")]));
    assert.equal(rows[0].script, "test");
  });
});

describe("checkBadges", () => {
  const DEPS = { eslint: "^10.14.0", stylelint: "^18.0.0", typescript: "^5.9.3" };
  const badge = (tool, major, link) => `[![${tool}](https://img.shields.io/badge/${tool}-${major}.x-000.svg)](${link})`;

  it("совпадающие мажоры и правильная ссылка проходят", () => {
    const failures = [];
    checkBadges(
      [
        {
          file: "README.template.md",
          text: [
            badge("TypeScript", "5", "https://www.typescriptlang.org/"),
            badge("ESLint", "10", "https://eslint.org/"),
            badge("Stylelint", "18", "https://stylelint.io/"),
          ].join("\n"),
        },
      ],
      DEPS,
      failures,
    );
    assert.deepEqual(failures, []);
  });

  it("чужой мажор ловится", () => {
    const failures = [];
    checkBadges(
      [
        {
          file: "README.template.md",
          text: [
            badge("TypeScript", "5", "https://www.typescriptlang.org/"),
            badge("ESLint", "9", "https://eslint.org/"),
          ].join("\n"),
        },
      ],
      DEPS,
      failures,
    );
    assert.match(failures.join("\n"), /ESLint badge says 9\.x, package\.json has 10\.x/);
  });

  it("мёртвая ссылка на typescript.org ловится", () => {
    const failures = [];
    checkBadges(
      [{ file: "README.template.md", text: badge("TypeScript", "5", "https://www.typescript.org/") }],
      DEPS,
      failures,
    );
    assert.match(failures.join("\n"), /TypeScript badge must link typescriptlang\.org/);
  });

  it("отсутствующий бейдж шаблона ловится", () => {
    const failures = [];
    checkBadges([{ file: "README.template.md", text: badge("ESLint", "10", "https://eslint.org/") }], DEPS, failures);
    assert.match(failures.join("\n"), /misses the (TypeScript|Stylelint) badge/);
  });

  it("README.md без бейджей не требует их", () => {
    const failures = [];
    checkBadges([{ file: "README.md", text: "# Title\n" }], DEPS, failures);
    assert.deepEqual(failures, []);
  });
});

describe("checkDocsMap", () => {
  it("нелинкованный файл ловится", () => {
    const failures = [];
    checkDocsMap("[x](docs/known.md)\n", ["docs/known.md", "docs/lost.md"], failures);
    assert.deepEqual(failures, ["[FAIL] README.md docs map misses docs/lost.md."]);
  });

  it("полная карта не даёт нарушений", () => {
    const failures = [];
    checkDocsMap("[a](docs/known.md) [b](docs/lost.md)\n", ["docs/known.md", "docs/lost.md"], failures);
    assert.deepEqual(failures, []);
  });
});

describe("checkInstallCoverage", () => {
  const getting =
    "### 2. Установите devDependencies\n\n```bash\nnpm install -D \\\n  eslint globals \\\n  vitest\n```\n";

  it("пакет из списка, которого нет в package.json, ловится", () => {
    const failures = [];
    checkInstallCoverage(getting, { devDependencies: { eslint: "^1" } }, ["eslint"], failures);
    assert.match(failures.join("\n"), /install list: globals is not in package\.json/);
  });

  it("пакет, импортируемый конфигом и отсутствующий в списке, ловится", () => {
    const failures = [];
    checkInstallCoverage(
      getting,
      { devDependencies: { eslint: "^1", globals: "^1", vitest: "^1" } },
      ["globals"],
      failures,
    );
    assert.deepEqual(failures, []);
  });

  it("импорт конфига без установки ловится", () => {
    const failures = [];
    checkInstallCoverage(
      getting,
      { devDependencies: { eslint: "^1", globals: "^1", vitest: "^1", typescript: "^5" } },
      ["typescript"],
      failures,
    );
    assert.match(failures.join("\n"), /install list misses typescript \(imported by a config\)/);
  });
});

describe("collectConfigPackages", () => {
  it("в реальном репозитории видит пакеты, известные как пропущенные", () => {
    const packages = collectConfigPackages();
    for (const name of [
      "@eslint/js",
      "eslint-config-prettier",
      "globals",
      "typescript-eslint",
      "stylelint-config-standard-scss",
    ]) {
      assert.ok(packages.includes(name), `expected ${name} in config imports`);
    }
  });
});
