# Pre-push Changelog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pre-push hook that generates CHANGELOG.md on main branch pushes, blocking the push if the file was modified.

**Architecture:** Shell script `scripts/generate-changelog.sh` handles branch detection, changelog generation, and diff check. `.husky/pre-push` calls the script. `conventional-changelog-cli` provides the generation tool.

**Tech Stack:** Bash, conventional-changelog-cli, Husky

## Global Constraints

- Only runs on main branch (other branches pass through)
- Blocks push if CHANGELOG.md changed (exit 1)
- Human commits CHANGELOG (no amend, no auto-commit)
- Pattern follows existing `scripts/check-file-length.ts` in pre-commit

---

## File Structure

| File                            | Responsibility                                              |
| ------------------------------- | ----------------------------------------------------------- |
| `scripts/generate-changelog.sh` | Branch check, generate changelog, diff check, exit code     |
| `.husky/pre-push`               | Call the script                                             |
| `package.json`                  | Add `conventional-changelog-cli` devDep, `changelog` script |

---

### Task 1: Install conventional-changelog-cli

**Files:**

- Modify: `package.json`

**Interfaces:**

- Produces: `conventional-changelog-cli` in devDependencies

- [ ] **Step 1: Install the package**

```bash
npm install --save-dev conventional-changelog-cli
```

- [ ] **Step 2: Verify installation**

```bash
npx conventional-changelog --version
```

Expected: version number printed

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add conventional-changelog-cli"
```

---

### Task 2: Add npm changelog script

**Files:**

- Modify: `package.json`

**Interfaces:**

- Produces: `"changelog"` script in package.json

- [ ] **Step 1: Add script to package.json**

In `package.json`, add to `"scripts"`:

```json
"changelog": "conventional-changelog -p angular -i CHANGELOG.md -s"
```

- [ ] **Step 2: Verify script works**

```bash
npm run changelog
```

Expected: CHANGELOG.md created/updated (or no output if no commits)

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add changelog npm script"
```

---

### Task 3: Create generate-changelog.sh

**Files:**

- Create: `scripts/generate-changelog.sh`

**Interfaces:**

- Produces: Exit 0 if no changes, Exit 1 if CHANGELOG.md changed

- [ ] **Step 1: Create the script**

Create `scripts/generate-changelog.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "Not on main branch ($CURRENT_BRANCH), skipping changelog generation."
  exit 0
fi

echo "Generating CHANGELOG.md..."
npx conventional-changelog -p angular -i CHANGELOG.md -s

if git diff --quiet CHANGELOG.md 2>/dev/null; then
  echo "CHANGELOG.md is up to date."
  exit 0
else
  echo ""
  echo "CHANGELOG.md updated."
  echo "Please commit: git add CHANGELOG.md && git commit -m \"docs: update changelog\""
  echo "Then push again."
  exit 1
fi
```

- [ ] **Step 2: Make script executable (Unix)**

```bash
chmod +x scripts/generate-changelog.sh
```

Note: On Windows, Git Bash handles this. `chmod` is not needed but harmless.

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-changelog.sh
git commit -m "chore: add generate-changelog.sh"
```

---

### Task 4: Create pre-push hook

**Files:**

- Create: `.husky/pre-push`

**Interfaces:**

- Consumes: `scripts/generate-changelog.sh`

- [ ] **Step 1: Create the hook**

Create `.husky/pre-push`:

```bash
#!/usr/bin/env bash
bash scripts/generate-changelog.sh
```

- [ ] **Step 2: Verify hook is executable**

```bash
ls -la .husky/pre-push
```

Expected: `-rwxr-xr-x` or similar (executable bit set)

- [ ] **Step 3: Commit**

```bash
git add .husky/pre-push
git commit -m "chore: add pre-push hook for changelog"
```

---

### Task 5: Test the workflow

**Files:**

- Verify: `scripts/generate-changelog.sh`
- Verify: `.husky/pre-push`
- Verify: `package.json`

- [ ] **Step 1: Test on non-main branch**

```bash
git checkout -b test-changelog
bash scripts/generate-changelog.sh
```

Expected: "Not on main branch (test-changelog), skipping changelog generation." + exit 0

- [ ] **Step 2: Switch to main and test**

```bash
git checkout main
bash scripts/generate-changelog.sh
```

Expected: CHANGELOG.md updated message, exit 1 (if there are new commits since last tag)

- [ ] **Step 3: Verify CHANGELOG.md exists**

```bash
cat CHANGELOG.md
```

Expected: Content with conventional commit entries

- [ ] **Step 4: Test up-to-date scenario**

```bash
git add CHANGELOG.md && git commit -m "docs: update changelog"
bash scripts/generate-changelog.sh
```

Expected: "CHANGELOG.md is up to date." + exit 0

- [ ] **Step 5: Clean up test branch and commit**

```bash
git branch -D test-changelog
```

- [ ] **Step 6: Delete spec file**

```bash
rm docs/superpowers/specs/2026-09-05-pre-push-changelog.md
git add docs/superpowers/specs/2026-09-05-pre-push-changelog.md
git commit -m "chore: remove temporary spec file"
```
