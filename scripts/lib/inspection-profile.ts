/**
 * Mirror check for the JetBrains inspection profile: the IDE cannot import
 * `scripts/lib/thresholds.ts`, so `.idea/inspectionProfiles/Project_Default.xml`
 * carries a copy of every threshold. Without this check a threshold change
 * leaves the IDE inspecting a different number than the gates enforce.
 */

import {
  MAX_COMPLEXITY,
  MAX_FILE_LINES,
  MAX_FUNCTION_LINES,
  MAX_METHODS_PER_CLASS,
  MAX_NESTING_DEPTH,
  MAX_PARAMS,
  MAX_STATEMENTS_PER_FUNCTION,
} from "./thresholds.ts";

/** One inspection option that mirrors a threshold. */
export interface InspectionThreshold {
  /** JetBrains inspection class name. */
  inspection: string;
  /** Option name inside the inspection block. */
  option: string;
  /** Value owned by `scripts/lib/thresholds.ts`. */
  expected: number;
}

/** One mismatch between the inspection profile and the threshold owner. */
export interface InspectionFailure {
  /** JetBrains inspection class name. */
  inspection: string;
  /** Option name inside the inspection block. */
  option: string;
  /** Value owned by `scripts/lib/thresholds.ts`. */
  expected: number;
  /** Value found in the profile; null when the tool or option is absent. */
  actual: number | null;
}

/**
 * Every inspection option that mirrors a threshold, including the two
 * IDE-only limits (25 and 30) that no lint lane enforces.
 */
export const INSPECTION_THRESHOLDS: readonly InspectionThreshold[] = [
  { inspection: "FileLength", option: "limit", expected: MAX_FILE_LINES },
  { inspection: "OverlyLongFunctionJS", option: "m_limit", expected: MAX_FUNCTION_LINES },
  { inspection: "CyclomaticComplexityJS", option: "m_limit", expected: MAX_COMPLEXITY },
  { inspection: "ParametersPerFunction", option: "m_limit", expected: MAX_PARAMS },
  { inspection: "NestedFunctionDepthJS", option: "m_limit", expected: MAX_NESTING_DEPTH },
  { inspection: "MethodCount", option: "m_limit", expected: MAX_METHODS_PER_CLASS },
  { inspection: "StatementsPerFunctionJS", option: "m_limit", expected: MAX_STATEMENTS_PER_FUNCTION },
];

/** An inspection block: the class attribute and the body, empty when self-closing. */
const INSPECTION_BLOCK = /<inspection_tool class="([^"]+)"[^>]*?(?:\/>|>([\s\S]*?)<\/inspection_tool>)/g;

/**
 * Check the profile against the threshold owner.
 * @param xml - content of `.idea/inspectionProfiles/Project_Default.xml`
 * @returns one entry per missing tool, missing option or different value
 */
export function checkInspectionProfile(xml: string): InspectionFailure[] {
  const blocks = new Map<string, string>();
  for (const match of xml.matchAll(INSPECTION_BLOCK)) {
    blocks.set(match[1], match[2] ?? "");
  }

  const failures: InspectionFailure[] = [];
  for (const { inspection, option, expected } of INSPECTION_THRESHOLDS) {
    const body = blocks.get(inspection);
    const raw =
      body === undefined ? null : (new RegExp(`<option name="${option}" value="([^"]*)"`).exec(body)?.[1] ?? null);
    const parsed = raw === null ? Number.NaN : Number(raw);
    if (parsed !== expected) {
      failures.push({
        inspection,
        option,
        expected,
        actual: Number.isFinite(parsed) ? parsed : null,
      });
    }
  }
  return failures;
}
