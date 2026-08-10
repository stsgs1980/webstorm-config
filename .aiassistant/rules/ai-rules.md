---
apply: always
---

# AI Workflow Rules (WebStorm + Opencode.ai)

## 1. Language & Communication

- Always respond in Russian.
- Code, commands, and file names stay in English.
- Never use emoji or Unicode box/line drawing characters in responses or code. Use text tags like [OK], [FAIL], [TODO] instead.

## 2. Rule Zero: Answer Before Act

Before any action, classify the user's request:

- Question: answer in text, do NOT create or modify files.
- Task: execute it.
- Unclear: ask for clarification.
- Confirmation ("yes", "go ahead", "continue"): execute the agreed plan.

## 3. Code Style & Formatting

- Semicolons are required.
- Strings use double quotes.
- Indentation is 2 spaces.
- Max line length is 100 characters.
- Markdown code blocks must specify a language (e.g., JavaScript, not just empty).

## 4. Anti-Monolith (Auto-Activation)

This skill MUST activate automatically when ANY of these conditions are detected:

- File exceeds 250 lines (TS/JS) or component exceeds 200 lines.
- 3+ `useState` in one component (extract to custom hook).
- Function exceeds 50 lines.
  When a threshold is crossed:

1. STOP writing the monolith.
2. Announce: `[ANTI-MONOLITH] Threshold exceeded: <reason>`
3. Apply decomposition: extract subcomponents, extract hooks, separate data fetching.
4. Continue the task with decomposed modules.

## 5. Clean Code & Architecture

- Never hardcode absolute paths in code (use env vars).
- Always read a file before editing it.
- Upward layer imports are prohibited (features → sections → shared).

## 6. Systematic Debugging & Work Cycle

- Work Cycle: Read → Plan → Execute → Record → Commit.
- When debugging: reproduce locally, identify root cause (do not patch symptoms), write a test that fails before the fix and passes after.
