/**
 * Derives the machine-level scheme files from the project-level sources in
 * `.idea/`. The project files are the single place where values are edited by
 * hand; both the repository reference (`generated/ide-reference/`) and the
 * machine copy (`%APPDATA%`) are derived from them.
 *
 * Transforms, verified byte for byte against the machine copies:
 * - code style: the `<code_scheme>` element of `.idea/codeStyles/Project.xml`,
 *   renamed to the machine scheme name and dedented one level (2 spaces);
 * - inspections: the `<profile>` element of
 *   `.idea/inspectionProfiles/Project_Default.xml`, renamed, dedented, with
 *   every `<scope>` element removed (project scopes do not exist on the
 *   machine level) and tools left empty by that removal collapsed to
 *   self-closing tags.
 */

import type { SchemeGroup } from "./ide-state.ts";
import { SCHEME_NAME } from "./ide-state.ts";

/** Project-level source file per scheme group, relative to the repository root. */
export const IDEA_SOURCES: Record<SchemeGroup, string> = {
  codestyles: ".idea/codeStyles/Project.xml",
  inspection: ".idea/inspectionProfiles/Project_Default.xml",
};

/**
 * Extract the first balanced element with the given tag name.
 * @param content - XML document text
 * @param tag - element name without brackets
 * @returns the element text from the opening tag through the closing tag
 */
const extractElement = (content: string, tag: string): string => {
  const match = new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`).exec(content);
  if (match === null) {
    throw new Error(`<${tag}> element not found`);
  }
  return match[0];
};

/**
 * Remove one indentation level (2 spaces) from every line that has it.
 * @param content - extracted element text
 * @returns text with children moved one level up
 */
const dedent = (content: string): string =>
  content
    .split("\n")
    .map((line) => (line.startsWith("  ") ? line.slice(2) : line))
    .join("\n");

/**
 * Drop `<scope>` elements line by line, both self-closing and paired forms.
 * @param content - extracted element text
 * @returns text without scope elements
 */
const stripScopes = (content: string): string => {
  const kept: string[] = [];
  let insideScope = false;
  for (const line of content.split("\n")) {
    const trimmed = line.trimStart();
    if (insideScope) {
      if (trimmed === "</scope>") {
        insideScope = false;
      }
      continue;
    }
    if (trimmed.startsWith("<scope")) {
      if (!trimmed.endsWith("/>")) {
        insideScope = true;
      }
      continue;
    }
    kept.push(line);
  }
  return kept.join("\n");
};

/**
 * Collapse tools left without a body by the scope removal into self-closing
 * tags, the form the IDE itself writes for tools without overrides.
 * @param content - extracted element text
 * @returns text with empty `<inspection_tool>` bodies collapsed
 */
const collapseEmptyTools = (content: string): string => {
  const lines = content.split("\n");
  const kept: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1]?.trimStart();
    if (/^<inspection_tool\b.*[^/]>$/.test(line.trimStart()) && next === "</inspection_tool>") {
      kept.push(`${line.trimEnd().replace(/>$/, "")} />`);
      index += 1;
      continue;
    }
    kept.push(line);
  }
  return kept.join("\n");
};

/**
 * Build the machine code style scheme from the project `Project.xml`.
 * @param projectXml - content of `.idea/codeStyles/Project.xml`
 * @returns content of the machine `codestyles/<scheme>.xml` file
 */
export const buildCodeStyleScheme = (projectXml: string): string => {
  const source = projectXml.replace(/\r\n/g, "\n");
  const scheme = extractElement(source, "code_scheme");
  const renamed = scheme.replace(/(<code_scheme\b[^>]*\bname=")Project(")/, `$1${SCHEME_NAME}$2`);
  if (renamed === scheme) {
    throw new Error(`code_scheme name="Project" not found in .idea/codeStyles/Project.xml`);
  }
  return `${dedent(renamed).replace(/\n+$/, "")}\n`;
};

/**
 * Build the machine inspection profile from the project `Project_Default.xml`.
 * @param projectXml - content of `.idea/inspectionProfiles/Project_Default.xml`
 * @returns content of the machine `inspection/<scheme>.xml` file
 */
export const buildInspectionProfile = (projectXml: string): string => {
  const source = projectXml.replace(/\r\n/g, "\n");
  const profile = extractElement(source, "profile");
  const renamed = profile.replace(/(<option name="myName" value=")Project Default(")/, `$1${SCHEME_NAME}$2`);
  if (renamed === profile) {
    throw new Error(`profile name "Project Default" not found in .idea/inspectionProfiles/Project_Default.xml`);
  }
  return `${dedent(collapseEmptyTools(stripScopes(renamed))).replace(/\n+$/, "")}\n`;
};

/** Per-group builder from the project source file to the machine file content. */
export const BUILDERS: Record<SchemeGroup, (projectXml: string) => string> = {
  codestyles: buildCodeStyleScheme,
  inspection: buildInspectionProfile,
};
