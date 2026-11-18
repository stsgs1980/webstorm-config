/**
 * Which commits force a CHANGELOG.md update: the types the angular preset
 * renders plus any breaking-change footer. Kept as one module so the CI gate
 * and its tests cannot drift apart; chore, docs, ci and test commits produce
 * no section and need no entry.
 */

/** Conventional commit types whose unreleased change must be in CHANGELOG.md. */
export const ENTRY_REQUIRED_TYPES = ["feat", "fix", "perf", "revert"] as const;

// A conventional subject: type, optional scope, optional "!" and a colon.
const ENTRY_SUBJECT = new RegExp(`^(?:${ENTRY_REQUIRED_TYPES.join("|")})(?:\\([^)]*\\))?!?:`);
// conventional-changelog accepts both spellings of the footer.
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE:/m;

/**
 * Whether a commit range must change CHANGELOG.md: any subject with an
 * entry-required type, or a breaking-change footer in any body.
 * @param subjects - `git log --format=%s` output
 * @param bodies - `git log --format=%B` output
 * @returns true when the changelog freshness gate must run
 */
export function requiresChangelogEntry(subjects: string, bodies: string): boolean {
  return subjects.split(/\r?\n/).some((line) => ENTRY_SUBJECT.test(line)) || BREAKING_FOOTER.test(bodies);
}
