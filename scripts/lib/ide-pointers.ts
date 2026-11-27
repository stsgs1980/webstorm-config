/**
 * Pointer repair for the machine-level scheme selection. The pointers are what
 * make WebStorm apply the global copies to new projects; restoring the scheme
 * bytes without them is the blind spot that leaves projects silently on stock
 * settings (defect N2 in `drafts/ide-profiles-verification.md`).
 *
 * The writers are surgical: they replace the known option/attribute values in
 * place, insert a missing option into its owning component, or append a
 * missing component - they never rebuild the whole file.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { EDITOR_POINTER, readComponentAttribute, readOptionValue, SCHEME_NAME, SCHEME_POINTERS } from "./ide-state.ts";

/** One pointer that selects a named scheme: an option or a component attribute. */
export type SchemePointer = (typeof SCHEME_POINTERS)[number] | typeof EDITOR_POINTER;

/**
 * Describe why a settings file does not select the repository scheme.
 * @param content - settings file content, or null when the file is absent
 * @param pointer - pointer descriptor
 * @returns problem text, or null when the pointer is correct
 */
export const pointerProblem = (content: string | null, pointer: SchemePointer): string | null => {
  if (content === null) {
    return "file is missing; run npm run sync:ide";
  }
  if ("option" in pointer) {
    const value = readOptionValue(content, pointer.option);
    if (value === null) {
      return pointer.option + " is missing; run npm run sync:ide";
    }
    return value === SCHEME_NAME
      ? null
      : pointer.option + ' is "' + value + '", expected "' + SCHEME_NAME + '"; run npm run sync:ide';
  }
  const value = readComponentAttribute(content, pointer.component, pointer.attribute);
  const label = pointer.component + " " + pointer.attribute;
  if (value === null) {
    return label + " is missing; run npm run sync:ide";
  }
  return value === SCHEME_NAME
    ? null
    : label + ' is "' + value + '", expected "' + SCHEME_NAME + '"; run npm run sync:ide';
};

/**
 * Return the content with one option value set, inserting the option into its
 * owning component when the component exists and appending the component
 * otherwise.
 * @param content - current file content
 * @param option - option name
 * @param owner - component that owns the option
 * @param value - desired value
 * @returns updated content
 */
export const withOptionValue = (content: string, option: string, owner: string, value: string): string => {
  const valuePattern = new RegExp(`(<option name="${option}" value=")[^"]*(")`);
  if (valuePattern.test(content)) {
    return content.replace(valuePattern, `$1${value}$2`);
  }
  const line = `<option name="${option}" value="${value}" />`;
  const ownerPattern = new RegExp(`(<component name="${owner}"[^>]*>\\s*\\n)`);
  if (ownerPattern.test(content)) {
    return content.replace(ownerPattern, `$1        ${line}\n`);
  }
  const block = `      <component name="${owner}">\n        ${line}\n      </component>\n`;
  if (/\n\s*<\/defaultProject>/.test(content)) {
    return content.replace(/(\n\s*<\/defaultProject>)/, `\n${block}$1`);
  }
  return content.replace(/\n\s*<\/application>/, `\n${block}</application>`);
};

/**
 * Return the content with one component attribute set, adding the attribute to
 * the component tag or appending the component when it is missing.
 * @param content - current file content
 * @param component - component name
 * @param attribute - attribute name
 * @param value - desired value
 * @returns updated content
 */
export const withComponentAttribute = (
  content: string,
  component: string,
  attribute: string,
  value: string,
): string => {
  const attrPattern = new RegExp(`(<component name="${component}"[^>]*?\\s${attribute}=")[^"]*(")`);
  if (attrPattern.test(content)) {
    return content.replace(attrPattern, `$1${value}$2`);
  }
  const tagPattern = new RegExp(`(<component name="${component}"[^>]*?)(/?>)`);
  if (tagPattern.test(content)) {
    return content.replace(tagPattern, `$1 ${attribute}="${value}"$2`);
  }
  const line = `  <component name="${component}" ${attribute}="${value}" />`;
  return content.replace(/\n\s*<\/application>\s*$/, `\n${line}\n</application>\n`);
};

/**
 * Write the pointer values into the options files, creating them when absent.
 * @param ideRoot - WebStorm config root
 * @param check - when true, report differences without writing
 * @returns number of pointer files that differ
 */
export const syncPointers = (ideRoot: string, check: boolean): number => {
  const targets = [
    {
      file: join(ideRoot, "options", "project.default.xml"),
      pointers: [...SCHEME_POINTERS],
      apply: (content: string): string =>
        SCHEME_POINTERS.reduce(
          (acc, pointer) => withOptionValue(acc, pointer.option, pointer.owner, SCHEME_NAME),
          content,
        ),
      template:
        `<application>\n  <component name="ProjectManager">\n    <defaultProject>\n` +
        `      <component name="InspectionProjectProfileManager">\n` +
        `        <option name="PROJECT_PROFILE" value="${SCHEME_NAME}" />\n` +
        `        <option name="USE_PROJECT_PROFILE" value="false" />\n` +
        `        <version value="1.0" />\n      </component>\n` +
        `      <component name="ProjectCodeStyleConfiguration">\n` +
        `        <option name="PREFERRED_SCHEME" value="${SCHEME_NAME}" />\n` +
        `      </component>\n    </defaultProject>\n  </component>\n</application>\n`,
    },
    {
      file: join(ideRoot, "options", "editor.xml"),
      pointers: [EDITOR_POINTER],
      apply: (content: string): string =>
        withComponentAttribute(content, EDITOR_POINTER.component, EDITOR_POINTER.attribute, SCHEME_NAME),
      template:
        `<application>\n  <component name="${EDITOR_POINTER.component}" ` +
        `${EDITOR_POINTER.attribute}="${SCHEME_NAME}" />\n</application>\n`,
    },
  ];
  let mismatches = 0;
  for (const target of targets) {
    const current = existsSync(target.file) ? readFileSync(target.file, "utf8") : null;
    const problems =
      current === null
        ? ["file is missing; run npm run sync:ide"]
        : target.pointers
            .map((pointer) => pointerProblem(current, pointer))
            .filter((problem): problem is string => problem !== null);
    if (problems.length === 0) {
      console.log(`[OK] ${target.file} pointers are correct`);
      continue;
    }
    mismatches += 1;
    if (check) {
      console.log(`[FAIL] ${target.file} pointer(s) drift: ${problems.join("; ")}`);
      continue;
    }
    const desired = current === null ? target.template : target.apply(current);
    mkdirSync(dirname(target.file), { recursive: true });
    writeFileSync(target.file, desired, "utf8");
    console.log(`[OK] ${current === null ? "created" : "repaired"} ${target.file}`);
  }
  return mismatches;
};
