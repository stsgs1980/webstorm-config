// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction,NpmUsedModulesInstalled
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
// noinspection NpmUsedModulesInstalled
import { describe, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("../scripts/check-style-consistency.ts", import.meta.url));
const REPO = fileURLToPath(new URL("..", import.meta.url));

/**
 * Run the style checker against a fixture root.
 * @param {string} root - fixture directory
 * @returns {{status: number, stdout: string, stderr: string}}
 */
const run = (root) => {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, root], { encoding: "utf8" });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return { status: error.status ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
};

/**
 * Copy the three source files into a temp root.
 * @returns {string} fixture root
 */
const makeFixture = () => {
  const root = mkdtempSync(join(tmpdir(), "wsc-style-"));
  cpSync(join(REPO, ".editorconfig"), join(root, ".editorconfig"));
  cpSync(join(REPO, ".prettierrc"), join(root, ".prettierrc"));
  mkdirSync(join(root, ".idea", "codeStyles"), { recursive: true });
  cpSync(join(REPO, ".idea", "codeStyles", "Project.xml"), join(root, ".idea", "codeStyles", "Project.xml"));
  mkdirSync(join(root, ".idea", "inspectionProfiles"), { recursive: true });
  cpSync(
    join(REPO, ".idea", "inspectionProfiles", "Project_Default.xml"),
    join(root, ".idea", "inspectionProfiles", "Project_Default.xml"),
  );
  return root;
};

describe("check-style-consistency", () => {
  it("согласованные файлы проходят", () => {
    const root = makeFixture();
    try {
      const result = run(root);
      assert.equal(result.status, 0, result.stderr);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("пропавшая опция языка ловится", () => {
    const root = makeFixture();
    try {
      const path = join(root, ".idea", "codeStyles", "Project.xml");
      writeFileSync(path, readFileSync(path, "utf8").replace(/<option name="INDENT_SIZE"[^>]*\/>\s*/g, ""));
      const result = run(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Project\.xml:HTML: INDENT_SIZE/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("пропавший язык ловится", () => {
    const root = makeFixture();
    try {
      const path = join(root, ".idea", "codeStyles", "Project.xml");
      const xml = readFileSync(path, "utf8").replace(
        /<codeStyleSettings language="HTML">[\s\S]*?<\/codeStyleSettings>/,
        "",
      );
      writeFileSync(path, xml);
      const result = run(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /language HTML = missing/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("расхождение Prettier ловится", () => {
    const root = makeFixture();
    try {
      const path = join(root, ".prettierrc");
      const value = JSON.parse(readFileSync(path, "utf8"));
      value.printWidth = 100;
      writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
      const result = run(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /\.prettierrc: printWidth/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("semi: false в .prettierrc ловится", () => {
    const root = makeFixture();
    try {
      const path = join(root, ".prettierrc");
      const value = JSON.parse(readFileSync(path, "utf8"));
      value.semi = false;
      writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
      const result = run(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /\.prettierrc: semi = false, expected true/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("bracketSpacing: false в .prettierrc ловится", () => {
    const root = makeFixture();
    try {
      const path = join(root, ".prettierrc");
      const value = JSON.parse(readFileSync(path, "utf8"));
      value.bracketSpacing = false;
      writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
      const result = run(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /\.prettierrc: bracketSpacing = false, expected true/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("end_of_line: crlf в .editorconfig ловится", () => {
    const root = makeFixture();
    try {
      const path = join(root, ".editorconfig");
      writeFileSync(path, readFileSync(path, "utf8").replace("end_of_line = lf", "end_of_line = crlf"));
      const result = run(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /\.editorconfig: end_of_line = crlf, expected lf/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("FORCE_SEMICOLON_STYLE: false в Project.xml ловится для JS и TS", () => {
    const root = makeFixture();
    try {
      const path = join(root, ".idea", "codeStyles", "Project.xml");
      const xml = readFileSync(path, "utf8").replaceAll(
        'name="FORCE_SEMICOLON_STYLE" value="true"',
        'name="FORCE_SEMICOLON_STYLE" value="false"',
      );
      writeFileSync(path, xml);
      const result = run(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Project\.xml:JS: FORCE_SEMICOLON_STYLE = false, expected true/);
      assert.match(result.stderr, /Project\.xml:TS: FORCE_SEMICOLON_STYLE = false, expected true/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("SPACES_WITHIN_IMPORTS: false в Project.xml ловится", () => {
    const root = makeFixture();
    try {
      const path = join(root, ".idea", "codeStyles", "Project.xml");
      const xml = readFileSync(path, "utf8").replaceAll(
        'name="SPACES_WITHIN_IMPORTS" value="true"',
        'name="SPACES_WITHIN_IMPORTS" value="false"',
      );
      writeFileSync(path, xml);
      const result = run(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Project\.xml:JS: SPACES_WITHIN_IMPORTS = false, expected true/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("зеркало FileLength в профиле инспекций ловится", () => {
    const root = makeFixture();
    try {
      const path = join(root, ".idea", "inspectionProfiles", "Project_Default.xml");
      const xml = readFileSync(path, "utf8").replace(
        '<option name="limit" value="250" />',
        '<option name="limit" value="200" />',
      );
      writeFileSync(path, xml);
      const result = run(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Project_Default\.xml: FileLength\.limit = 200, expected 250/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("IDE-only пороги 25/30 сверяются с thresholds.ts", () => {
    const root = makeFixture();
    try {
      const path = join(root, ".idea", "inspectionProfiles", "Project_Default.xml");
      const xml = readFileSync(path, "utf8")
        .replace('<option name="m_limit" value="25" />', '<option name="m_limit" value="24" />')
        .replace('<option name="m_limit" value="30" />', '<option name="m_limit" value="20" />');
      writeFileSync(path, xml);
      const result = run(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /MethodCount\.m_limit = 24, expected 25/);
      assert.match(result.stderr, /StatementsPerFunctionJS\.m_limit = 20, expected 30/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("USE_DOUBLE_QUOTES: false ловится для JS и TS", () => {
    const root = makeFixture();
    try {
      const path = join(root, ".idea", "codeStyles", "Project.xml");
      const xml = readFileSync(path, "utf8").replaceAll(
        'name="USE_DOUBLE_QUOTES" value="true"',
        'name="USE_DOUBLE_QUOTES" value="false"',
      );
      writeFileSync(path, xml);
      const result = run(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Project\.xml:JS: USE_DOUBLE_QUOTES = false, expected true/);
      assert.match(result.stderr, /Project\.xml:TS: USE_DOUBLE_QUOTES = false, expected true/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ENFORCE_TRAILING_COMMA: Never ловится для JS и TS", () => {
    const root = makeFixture();
    try {
      const path = join(root, ".idea", "codeStyles", "Project.xml");
      const xml = readFileSync(path, "utf8").replaceAll(
        'name="ENFORCE_TRAILING_COMMA" value="Always"',
        'name="ENFORCE_TRAILING_COMMA" value="Never"',
      );
      writeFileSync(path, xml);
      const result = run(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Project\.xml:JS: ENFORCE_TRAILING_COMMA = Never, expected Always/);
      assert.match(result.stderr, /Project\.xml:TS: ENFORCE_TRAILING_COMMA = Never, expected Always/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("A17: перезапись Project.xml глобальной схемой ловится, а не проходит молча", () => {
    const root = makeFixture();
    try {
      const path = join(root, ".idea", "codeStyles", "Project.xml");
      // The 09.11.2026 incident: the global scheme lacked the JS/TS quote and
      // comma options and part of the per-language options.
      const xml = readFileSync(path, "utf8")
        .replace(/<JSCodeStyleSettings[\s\S]*?<\/JSCodeStyleSettings>/, "")
        .replace(/<TypeScriptCodeStyleSettings[\s\S]*?<\/TypeScriptCodeStyleSettings>/, "")
        .replace(/<option name="SOFT_MARGINS"[^>]*\/>\s*/g, "");
      writeFileSync(path, xml);
      const result = run(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Project\.xml:JS: USE_DOUBLE_QUOTES = <missing>, expected true/);
      assert.match(result.stderr, /Project\.xml:TS: ENFORCE_TRAILING_COMMA = <missing>, expected Always/);
      assert.match(result.stderr, /Project\.xml:HTML: SOFT_MARGINS = <missing>, expected 120/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("значение из секции [*.md] не закрывает опцию секции [*]", () => {
    const root = makeFixture();
    try {
      const path = join(root, ".editorconfig");
      const moved = readFileSync(path, "utf8")
        .replace("max_line_length = 120\n", "")
        .replace("[*.md]\n", "[*.md]\nmax_line_length = 120\n");
      writeFileSync(path, moved);
      const result = run(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /\.editorconfig: max_line_length = <missing>, expected 120/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
