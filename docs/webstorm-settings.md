# WebStorm: setup division, base and floating rules

Study of WebStorm settings from the repository `webstorm-config` and the folder
`C:\Users\stsgr\Desktop\Webstorm Config local or Global`.

## 1. Division of settings

### 1.1 Global (global)

Personal IDE settings of one machine and one user.

| Area           | What        | Where stored | Note                    |
| -------------- | ----------- | ------------ | ----------------------- |
| Live Templates | 4 groups    | IDE global   | React group has fixes   |
| Code Style     | default     | IDE global   | Project scheme wins     |
| Inspection     | IDE Default | IDE global   | Copy of profile         |
| File Templates | IDE scope   | IDE global   | Copy from fileTemplates |
| Dictionary     | Accepted    | IDE global   | Global dictionary       |

Global status notes (checked 29.10.2026):

- Live Templates: done 24.10.2026 — 4 groups imported to `templates\`; global `rafce` fixed
  (NAME expression, ReactElement return type).
- Code Style: done 24.10.2026 — scheme `webstorm-config` saved globally; drift vs Project.xml:
  no USE_DOUBLE_QUOTES / ENFORCE_TRAILING_COMMA.
- Inspection: done 26.10.2026 — profile `webstorm-config` is the analyzer profile, but it still
  contains FileLength 250 and `generated_changelog` scope (deviates from planned step 4).
- File Templates: done — 5 files in IDE scope; Vitest stored as `Vitest Test.ts`
  (repo name: `Vitest Test.test.ts`, content identical).
- Dictionary: partial — 5 of 9 project words (Groq, commitlint, markdownlint, stsgs + 1 Cyrillic).

### 1.2 Project (project)

| Category       | Files                      | Status       |
| -------------- | -------------------------- | ------------ |
| Code Style     | .idea/codeStyles/          | OK           |
| ESLint         | .idea/jsLinters/eslint.xml | OK           |
| Prettier       | .idea/prettier.xml         | OK           |
| Inspections    | .idea/inspectionProfiles/  | OK           |
| Dictionaries   | .idea/dictionaries/        | OK           |
| Scopes         | .idea/scopes/              | OK           |
| File Templates | .idea/fileTemplates/       | OK           |
| Live Templates | .idea/liveTemplates/       | Storage only |
| Tool configs   | Linters, prettier, tests   | OK           |
| Personal       | .idea/workspace.xml        | Ignored      |

### 1.3 Situational (situational)

- React vs non-React.
- UI vs no UI (e2e, jsdom, Tailwind).
- Server vs client (no-console, JSDoc, strictness).
- AI (Grazie, MCP).
- Git commit checks.
- Docs scope.

## 2. Base vs floating rules

### 2.1 Base

- Strict TypeScript.
- Semicolon, double quotes, trailing comma, 2 spaces, 120 chars.
- Accessibility, editorconfig, gitattributes, Conventional Commits, JSDoc for
  public API, anti-monolith concept.

### 2.2 Floating

- explicit-function-return-type -> allowExpressions / warn.
- Emoji policy -> error only for code snippets, warn for logs, product, prototype.
- File length 250 -> warn + code review.
- Cyclomatic complexity, useState thresholds -> per layer.

## 3. Known problems

| Nr  | Problem                             | Severity | Where                                        | Status        |
| --- | ----------------------------------- | -------- | -------------------------------------------- | ------------- |
| 1   | Save Actions vs Actions on Save     | HIGH     | .idea/workspace.xml, docs/webstorm.md        | Open          |
| 2   | Live Templates not project-read     | HIGH     | .idea/liveTemplates/                         | Mitigated     |
| 3   | React template not fixed in repo    | MEDIUM   | .idea/liveTemplates/react.xml                | Closed 02.11  |
| 4   | React Buddy docs mismatch           | MEDIUM   | docs/webstorm.md, .idea/workspace.xml        | Closed 29.10  |
| 5   | Profile pProject Default            | MEDIUM   | .idea/workspace.xml                          | Closed 29.10  |
| 6   | Hard inspection thresholds          | MEDIUM   | .idea/inspectionProfiles/Project_Default.xml | Decision      |
| 7   | explicit-function-return-type error | MEDIUM   | AI Rules                                     | Decided 02.11 |
| 8   | Emoji policy, keycaps               | LOW      | webstorm-config and false positive.md        | Closed        |

Status notes (checked 29.10.2026 against revision 8393b57, re-checked 02.11.2026
against revision 251aa7d and the global config):

1. Still open: `SaveActionsConfiguration` in workspace.xml is active with
   `reformat`, `optimizeImports`, `compile`; native Reformat on Save is also
   enabled (application `options/editor.xml`), Prettier run-on-save per project
   (`.idea/prettier.xml`) — triple formatting on save. Plugin installed
   (`intellij-plugin-save-actions`). docs/webstorm.md §13 documents the conflict.
2. Limitation remains (IDEABKL-5033), but workaround is done: 4 groups imported
   to `%APPDATA%\JetBrains\WebStorm2026.2\templates\` on 24.10.2026.
3. Closed 02.11.2026: repo `rafce` renders and passes `check:templates`
   (14/14); the render test covers the return type and the computed `NAME`.
4. Closed: plugin `reactbuddy` present in `%APPDATA%\JetBrains\WebStorm2026.2\plugins\`;
   docs/webstorm.md §9 rewritten on 24.10.2026 (commit 8393b57).
5. Closed: workspace.xml `CommitConfigs` references "Project Default"; profile
   `myName` in `.idea/inspectionProfiles/Project_Default.xml` is "Project Default" — names match.
6. Decision recorded (§4.4): keep thresholds for the template, tune per app.
   Deviation: global profile copy still carries FileLength 250 + scope — see §1.1.
7. Decided 02.11.2026: `error` with `allowExpressions` stays final. `warn`
   would be blocking anyway because every run uses `--max-warnings=0`;
   advisory metrics live in the separate `lint:metrics` lane.
8. Closed in repo: `\u20E3` added to keycap alternation in `eslint-rules/unicode-policy.js`
   (runtime-built pattern). Prose in Markdown remains unchecked (policy by discipline).

## 4. Plan: what and how to adjust

### 4.1 Immediate

1. Save Actions: disable formatting actions, keep native Actions on Save. —
   Open (plugin still active, checked 29.10.2026)
2. Sync React live template fixes into .idea/liveTemplates/react.xml. —
   Done 02.11.2026 (repo copy matches the fixed global one; `check:templates`
   covers it)

### 4.2 Follow-up

1. React Buddy: install or update docs. — Done 24.10.2026: plugin installed,
   docs §9 rewritten (commit 8393b57)
2. Fix profile name in .idea/workspace.xml. — Done (checked 29.10.2026:
   "Project Default" matches profile name)

### 4.3 Rules tuning

1. explicit-function-return-type -> allowExpressions / warn. — Decided
   02.11.2026: keep `error` with `allowExpressions`; `warn` is indistinguishable
   from `error` under `--max-warnings=0`
2. Emoji policy -> error for code and snippets, warn for prose and logs. — Keycaps closed; prose part open

### 4.4 Thresholds

1. Keep inspection thresholds for the template, tune per app. — Decision
   recorded 29.10.2026 (global `webstorm-config` profile copy still carries
   250 + scope)

Checks: npm run lint, npm run lint:md, npm run format:check, npm test, npm run check:docs, npm run check:file-length.

Last cross-check: 02.11.2026, revision 251aa7d — items 3 and 7 updated, the
inspection profile now matches the metrics lane (60/15/4/4); the rest is
unchanged from 29.10.2026.
