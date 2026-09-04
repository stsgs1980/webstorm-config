#!/usr/bin/env bash
set -euo pipefail

CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "Not on main branch ($CURRENT_BRANCH), skipping changelog generation."
  exit 0
fi

echo "Generating CHANGELOG.md..."
rm -f CHANGELOG.md
npx conventional-changelog -p angular -i CHANGELOG.md -s

# Prepend markdownlint disable comment
TMPFILE=$(mktemp)
echo "<!-- markdownlint-disable -->" > "$TMPFILE"
cat CHANGELOG.md >> "$TMPFILE"
mv "$TMPFILE" CHANGELOG.md

# Convert asterisk to dash for consistency with prettier
sed -i 's/^\* /- /g' CHANGELOG.md

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
