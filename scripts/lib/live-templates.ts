// Parsing and rendering for the .idea/liveTemplates sets. Kept separate from
// the checker so the CLI file stays under the anti-monolith limit.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { VAR_OVERRIDES, VAR_SAMPLES } from "../check-templates-tables.ts";

/** One live template expanded from a set file. */
export interface LiveTemplate {
  set: string;
  name: string;
  value: string;
}

// Attribute values may contain a bare `>` (for example an arrow `=>`), so the
// tag pattern must skip over quoted strings instead of stopping at the first `>`.
const TEMPLATE_TAG = /<template\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

/**
 * Read an XML attribute value; template values carry no raw quotes.
 * @param tag - attribute string of one template element
 * @param name - attribute name
 * @returns attribute value or undefined
 */
function attr(tag: string, name: string): string | undefined {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];
}

/**
 * Unescape XML entities that WebStorm writes into live template values.
 * @param raw - raw attribute value
 * @returns plain template text
 */
function unescape(raw: string): string {
  return raw
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&#xA;", "\n")
    .replaceAll("&#10;", "\n")
    .replaceAll("&amp;", "&");
}

/**
 * Render a template: variables replaced, identical everywhere - the rafce
 * drift (different value in different places) cannot pass unnoticed.
 * @param set - set key (file base name)
 * @param name - template name
 * @param value - raw template text with $VARS$
 * @returns rendered code
 */
export function render(set: string, name: string, value: string): string {
  return value.replaceAll(/\$([A-Z][A-Z0-9_]*)\$/g, (_whole, variable: string) => {
    const override = VAR_OVERRIDES[`${set}::${name}::${variable}`];
    return override ?? VAR_SAMPLES[variable] ?? "0";
  });
}

/**
 * Collect all templates of one set file.
 * @param file - path to the template set XML
 * @returns parsed templates with names and unescaped values
 */
export function parseSet(file: string): { name: string; value: string }[] {
  const raw = readFileSync(file, "utf8");
  const templates: { name: string; value: string }[] = [];
  for (const match of raw.matchAll(TEMPLATE_TAG)) {
    const name = attr(match[1], "name");
    const value = attr(match[1], "value");
    if (name !== undefined && value !== undefined) {
      templates.push({ name, value: unescape(value) });
    }
  }

  // A skipped template is worse than a failing one: the checker would report
  // green while never rendering it. Fail loudly when parsing loses any.
  const declared = (raw.match(/<template\b/g) ?? []).length;
  if (templates.length !== declared) {
    throw new Error(`${file}: parsed ${templates.length} of ${declared} templates`);
  }

  return templates;
}

/**
 * Every template a directory holds; flat list keyed by set name.
 * @param dir - directory with template set XML files
 * @returns list with set, name and unescaped value per template
 */
export function collectTemplates(dir: string): LiveTemplate[] {
  let entries: string[];
  try {
    entries = readdirSync(dir).filter((file) => file.endsWith(".xml"));
  } catch {
    return [];
  }
  return entries.flatMap((file) => parseSet(join(dir, file)).map((tpl) => ({ set: file.slice(0, -4), ...tpl })));
}
