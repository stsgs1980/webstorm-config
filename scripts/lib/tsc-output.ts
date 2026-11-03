/**
 * Diagnostics of a failed tsc run. Type errors normally go to stdout, but a
 * fatal error may exist only on stderr; reading stdout alone could treat a
 * non-zero exit as a clean run when stdout is empty.
 * @param error - error thrown by execFileSync
 * @returns non-empty diagnostic text
 */
export function tscFailureText(error: unknown): string {
  const failure = error as { stdout?: string; stderr?: string };
  const text = `${failure.stdout ?? ""}\n${failure.stderr ?? ""}`.trim();
  return text === "" ? String(error) : text;
}
