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

## 4. Anti-Monolith (Auto-Activation)

This skill MUST activate automatically when ANY of these conditions are detected:

- File exceeds 250 lines (TS/JS; test files exempt) — enforced by `npm run check:file-length`.
- Component exceeds 200 lines (extract subcomponents).
- Function exceeds 50 lines or cyclomatic complexity > 15 — enforced by
  WebStorm inspections (`OverlyLongFunctionJS`, `CyclomaticComplexityJS`).
- 3+ `useState` in one component (extract to custom hook).

When a threshold is crossed:

1. STOP writing the monolith.
2. Announce: `[ANTI-MONOLITH] Threshold exceeded: <reason>`
3. Apply decomposition: extract subcomponents, extract hooks, separate data fetching.
4. Continue the task with decomposed modules.

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

## 7. Systematic Debugging & Work Cycle

- Work Cycle: Read, Plan, Execute, Record, Commit.
- When debugging: reproduce locally, identify root cause (do not patch symptoms),
  write a test that fails before the fix and passes after.
- Do not skip pre-commit checks.
