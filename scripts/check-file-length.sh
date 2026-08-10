#!/usr/bin/env bash
set -euo pipefail
MAX_LINES=250
FAILED=0

while IFS= read -r file; do
  if [ -f "$file" ]; then
    LINES=$(wc -l < "$file")
    if [ "$LINES" -gt "$MAX_LINES" ]; then
      echo "[FAIL] Файл '$file' содержит $LINES строк. Лимит: $MAX_LINES."
      FAILED=1
    fi
  fi
done < <(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$')

if [ "$FAILED" -eq 1 ]; then
  echo "[Anti-Monolith] Коммит отменен."
  exit 1
fi
