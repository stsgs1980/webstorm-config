# AGENTS.md - Workflow Rules (WebStorm + OpenCode.ai)

Canonical source of truth for agent and developer workflow rules. Agent engines read
this file as-is; other rule locations (`.aiassistant/rules/`, `.junie/`, per-IDE configs)
point here instead of duplicating it.

Related docs: `docs/markdown.md` (markdown style), `docs/webstorm.md` (IDE setup),
`docs/testing.md` (test conventions).

## 1. Language & Communication

- Always respond in Russian.
- Code, commands, file names, commit messages, and JSDoc stay in English.
- UI copy and user-facing error messages are English unless the feature spec says otherwise.
- Never use emoji or Unicode box/line drawing characters in responses or code.
  Use text tags like [OK], [FAIL], [TODO], [WARNING], [INFO] instead.

## 2. Rule Zero: Answer Before Act

Before any action, classify the user's request:

- Question: answer in text, do NOT create or modify files.
- Task: execute it.
- Unclear: ask for clarification.
- Confirmation ("yes", "go ahead", "continue"): execute the agreed plan. If no plan was
  stated in this conversation, ask what exactly is confirmed before touching files.

## 3. Code Style & Formatting

Automation first: if a style rule is not enforced by Prettier or ESLint, it is a
convention, not a requirement. The tsconfig flags in `tsconfig.base.json` are the
source of truth for strictness; do not restate them here.

- TypeScript strict mode. Explicit typing for all parameters and return values.
  ESLint checks return types only (`@typescript-eslint/explicit-function-return-type`
  with `allowExpressions`); parameter annotations are a convention, not a lint check.
- No `any`: prefer `unknown` and narrow. Avoid `as` casts and non-null assertions
  (`!`) without a comment explaining why the value cannot be absent.
- Semicolons required, strings use double quotes, trailing commas required,
  indentation is 2 spaces, max line length 120 characters.
- Max file length: 250 lines, hard gate. See Section 4.
- JSDoc required for public API (exported functions, methods, React components).
  In TS, `@param`/`@returns` are optional (explicit types are the source of truth);
  in plain JS files, a JSDoc block must include them.
- Markdown: follow `docs/markdown.md`: 120 chars per line, aligned tables,
  `npm run lint:md`. Fenced blocks must declare a language; JSX in fenced blocks
  uses `tsx`, not `typescript` (WebStorm injection).
- WebStorm IDE setup: `docs/webstorm.md` (code style import and on-save tools are manual).

## 4. Anti-Monolith

Two different things, do not mix them up.

### 4.1 Hard gate (blocks the commit and CI)

A TS/JS file over 250 lines blocks the commit: pre-commit checks staged files
via `scripts/check-file-length.ts`; CI runs `npm run check:file-length` (`--all`).
Exempt, each printed with its reason:

- tests (`*.test.*`, `*.spec.*`, `tests/`, `__tests__/`);
- type declarations (`*.d.ts`, `*.d.mts`, `*.d.cts`);
- barrel files named `index.*` that contain only `export` statements;
- tool configs (`*.config.*` - wired into their tool, not application logic);
- `vendor/` - vendored third-party code, copied whole;
- `generated/`, `__generated__/`, `codegen/` - generated code kept in git;
- `*.gen.*`, `*.generated.*` - codegen output;
- `dist/`, `build/`, `third_party/` - build output or vendored tree, not edited by hand;
- `components/ui/` - shadcn/ui components copied from the registry.

Escape hatch for a legitimately cohesive file: `// file-length-exempt: <reason>` as the
first line. The reason must also be justified in the PR description. Do not use it to
avoid splitting.

### 4.2 Advisory signals, two kinds

Machine-checked by `npm run lint:metrics` (a warning there never fails a run):

- a function or hook over 60 lines (comments and blank lines excluded);
- cyclomatic complexity over 15;
- more than 4 function parameters;
- nesting depth over 4.

Reviewer judgment only (not machine-checked; name them in the PR description):

- a small UI component (button, card) over 200 lines: almost always mixing jobs;
- a behavior component (form, widget) over 250 lines;
- page-level composition over 300 lines: check it does not own data or logic;
- a hook that bundles three or more unrelated jobs.

When a signal fires:

1. State the file's purpose in one sentence without "and". If it fits, leave the file
   as is.
2. If it does not fit, split by responsibility: UI separate from data fetching, state
   owned by the nearest parent. Do not create wrappers, hooks, or subcomponents to
   lower a line count.
3. If you deliberately keep the file, write one line naming the signal and why it
   is fine.

The number of `useState` calls is not evidence by itself: a page with six `useState`
calls can be healthy. Extract a hook for one coherent behavior with a clear contract;
prefer `useReducer` for complex transitions. A hook that mixes unrelated concerns is
the signal.

## 5. Clean Code & Architecture

- Never hardcode absolute paths, URLs, ports, tokens, or credentials. Use env vars;
  secrets live in `.env` (git-ignored) with `.env.example` committed and documented.
- Always read a file before editing it, and quote the relevant fragment in the
  response so the user sees what was read.
- Errors are handled, not swallowed: no empty `catch`, no silent `Promise` rejections.
  Rethrow or log with the project logger.
- One module, one reason to change. Dependencies point inward: UI does not import
  data-layer internals; the data layer does not import UI components.

## 6. Git & Commits

- All commits MUST follow Conventional Commits: `type(scope): short description`.
- Allowed types: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert.
- Breaking changes use `type(scope)!: description` plus a `BREAKING CHANGE:` footer.
  They bump the major version and land under "Breaking Changes" in the changelog.
- Do not commit directly to main. "Verified" means: approved PR, pre-commit hooks
  pass, CI is green. Direct pushes to main are only allowed for the release commit
  described below.
- Pre-commit hooks (Husky + lint-staged) must pass. `--no-verify` is allowed only when
  a hook fails for reasons unrelated to the change; state the reason in the commit
  body. CI re-runs every check, so skipping locally never bypasses the gate.
- CHANGELOG.md is generated by `npm run changelog` from conventional commits. Never
  edit it by hand; commit changes as `docs: update changelog`.
- Changelog freshness: CI on main fails if unreleased `fix` / `feat` / `perf` /
  breaking commits are missing from the changelog; `chore` / `docs` / `ci` merges do
  not require an entry.
- Release flow: run `npm run changelog`, commit as `docs: update changelog`, then tag
  the same commit `git tag -a vX.Y.Z -m "..."` and push the tag. The untagged chunk is
  re-dated on every regeneration, so the tag must point at the changelog commit, not
  later.

## 7. Systematic Debugging & Work Cycle

- Work Cycle: Read, Plan, Execute, Record, Commit.
- When debugging: reproduce locally, identify root cause (do not patch symptoms),
  write a test that fails before the fix and passes after.
- Never delete or weaken an existing test to make it pass.
- Do not skip pre-commit checks (see the `--no-verify` policy in Section 6).
- Record the outcome: root cause, fix, and the test that guards it, in the commit
  body or the PR description.

## 8. Testing

- Framework: Vitest for unit and integration tests. E2E for browser-based projects
  uses Playwright under `tests/e2e/` (commit reminder in docs; only where a UI exists).
- Every bug fix ships with a regression test. Every exported function with branching
  logic gets a unit test. Do not add tests without assertions.
- No network in unit tests: mock at the module boundary, not by patching globals.
- Coverage gate (decided, not yet wired into CI): 80% lines per changed file, from
  `vitest related --coverage`; do not chase global coverage meanwhile. The scheme
  and its status are recorded in `docs/testing.md`.

## 9. Security & Dependencies

- Secrets never enter the repository, logs, error messages, or tests. `.env.example`
  lists keys with placeholder values only.
- `npm audit --omit=dev --audit-level=high` runs in CI. A high or critical advisory
  fails the build unless documented in `SECURITY.md` with a mitigation plan.
- New dependencies require a reason in the PR description: what it replaces, bundle
  cost, maintenance status. Prefer the platform and existing dependencies.
- Lockfile is committed and updated only by `npm install` / `npm update`, never
  hand-edited.

## 10. Pull Requests

- One logical change per PR. Target under 400 changed lines; larger changes need a
  reason in the description.
- PR description: what changed, why, how it was verified, and any fired advisory
  signal from Section 4.
- Draft PRs are fine for early feedback. Merging requires green CI and one approval.

## 11. Project-specific entries

Fork note: when this template lands in a new project, keep only the entries that
actually exist there.

- `npm run check:file-length` - 250-line hard gate (`scripts/check-file-length.ts`).
- `npm run check:templates` - live templates renderer (`scripts/check-templates.ts`).
- `npm run check:docs` - docs/config cross-check (`scripts/check-docs.ts`).
- Live templates live in `.idea/liveTemplates/`.
- Docs that travel with the fork: `docs/webstorm.md` (IDE), `docs/testing.md` (tests),
  `docs/markdown.md` (markdown style), `docs/architecture.md` (module boundaries),
  `docs/security.md` (secrets, auth), `docs/api.md` (HTTP conventions), `SECURITY.md`
  (vulnerability policy).
- `docs/kickoff.md` is template-only: the starter prompt runs once, before the
  project exists. In a fork, delete it at Step 1 (getting-started.md).
