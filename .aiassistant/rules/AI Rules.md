---
apply: always
---

# AI Workflow Rules (WebStorm + Opencode.ai)

## 1. Language & Communication

- Always respond in Russian.
- Code, commands, and file names stay in English.
- Never use emoji or Unicode box/line drawing characters in responses or code.
  Use text tags like [OK], [FAIL], [TODO], [WARNING], [INFO] instead.

## 2. Rule Zero: Answer Before Act

Before any action, classify the user's request:

- Question: answer in text, do NOT create or modify files.
- Task: execute it.
- Unclear: ask for clarification.
- Confirmation ("yes", "go ahead", "continue"): execute the agreed plan.

## 3. Code Style & Formatting

- TypeScript strict mode. Explicit typing for all parameters and return values (no `any`).
  Checked by ESLint rule @typescript-eslint/explicit-function-return-type and no-console.
- Semicolons are required.
- Strings use double quotes.
- Trailing commas required in objects and arrays.
- Indentation is 2 spaces.
- Max line length is 120 characters.
- Max file length is 250 lines. If exceeded, split into modules (pre-commit checks
  staged files via `node scripts/check-file-length.ts`; CI runs `npm run check:file-length`).
  Test files (`*.test.*`, `*.spec.*`, files under `tests/` and `__tests__/`) are exempt.
- JSDoc required for public API (exported functions, methods, React components).
  In TS, `@param`/`@returns` are optional (explicit types are the source of truth);
  in plain JS files, a JSDoc block must include them.
- Markdown: follow `docs/markdown.md` — 120 chars per line, aligned tables, `npm run lint:md`.
- Markdown code blocks must specify a language (e.g., ```typescript, not empty).
- Markdown with JSX in fenced blocks must use `tsx`, not `typescript` (WebStorm injection).
- WebStorm IDE setup: `docs/webstorm.md` (code style import and on-save tools are manual).

## 4. Anti-Monolith

Hard rule, enforced by a script at pre-commit and in CI:

- A TS/JS file over 250 lines (tests exempt) blocks the commit:
  `node scripts/check-file-length.ts --all`. Generated and vendored paths
  are exempt; each exemption is reported with its reason.

Signals to analyze - guiding checks, not barriers (no auto-stop):

- small UI component (button, card) over 200 lines: almost always mixing jobs;
- behavior component (form, widget) over 250 lines;
- page-level composition over 300 lines: check it does not own data or logic;
- function or hook over 60 lines, or cyclomatic complexity over 15;
- a hook that bundles three or more unrelated jobs.

When a signal fires:

1. State the file's purpose in one sentence without "and". If it fits,
   leave the file as is and continue the task.
2. If it does not fit, split by responsibility: UI separate from data
   fetching, state owned by the nearest parent. Do not create wrappers,
   hooks, or subcomponents to lower a line count.
3. Continue the task normally: the counter is not the goal, cohesion is.

The number of `useState` calls is not evidence by itself: a page with
six `useState` calls can be healthy. Extract a hook for one coherent
behavior with a clear contract; prefer `useReducer` for complex
transitions. A hook that mixes unrelated concerns is the signal.

## 5. Clean Code & Architecture

- Never hardcode absolute paths in code (use env vars).
- Always read a file before editing it.

## 6. Git & Commits

- All commits MUST follow Conventional Commits format:
  type(scope): short description
- Allowed types: feat, fix, docs, style, refactor, test, chore, perf, ci, build.
- Do not commit directly to main without verification.
- Pre-commit hooks (Husky + lint-staged) must pass before commit.
- CHANGELOG.md is generated from conventional commits by `npm run changelog`
  (run it before pushing to main; CI verifies freshness on main).
  Commit changes as `git add CHANGELOG.md && git commit -m "docs: update changelog"`.
- Releases are anchored by semver git tags with a `v` prefix (`v1.0.0`):
  commit the changelog, then tag the release commit and push the tag
  (`git tag -a vX.Y.Z -m "..." && git push origin vX.Y.Z`). Without a new tag,
  only `fix`/`feat`/`perf` merges change the changelog; `chore`/`docs` merges
  keep CI green. The untagged (pending-release) chunk is re-dated on every
  regeneration, so tag the release right after its "docs: update changelog"
  commit.

## 7. Systematic Debugging & Work Cycle

- Work Cycle: Read, Plan, Execute, Record, Commit.
- When debugging: reproduce locally, identify root cause (do not patch symptoms),
  write a test that fails before the fix and passes after.
- Do not skip pre-commit checks.
