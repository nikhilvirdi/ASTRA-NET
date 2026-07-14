#!/usr/bin/env bash
# ASTRANET — Claude Code PostToolUse hook
# Fires after Edit/Write/MultiEdit. Reads the tool payload from stdin,
# and if the touched file is in apps/* or packages/shared, runs lint
# and the related test(s) immediately — instant feedback instead of
# catching problems three files (or one review) later.
#
# Wired up in .claude/settings.json under "hooks" -> "PostToolUse".

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | node -e "
  let data = '';
  process.stdin.on('data', d => data += d);
  process.stdin.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log(json.tool_input?.file_path || '');
    } catch { console.log(''); }
  });
" <<< "$INPUT")

# Only act on files we actually care about
if [[ "$FILE_PATH" != *"/apps/"* && "$FILE_PATH" != *"/packages/shared/"* ]]; then
  exit 0
fi

if [[ "$FILE_PATH" != *.ts && "$FILE_PATH" != *.tsx ]]; then
  exit 0
fi

echo "[post-edit-check] Linting $FILE_PATH ..."
if ! npx eslint "$FILE_PATH" --max-warnings=0; then
  echo "[post-edit-check] Lint failed on $FILE_PATH" >&2
  exit 2
fi

if [[ "$FILE_PATH" == *"/packages/shared/"* ]]; then
  echo "[post-edit-check] Running related tests for $FILE_PATH ..."
  if ! npx vitest related "$FILE_PATH" --run; then
    echo "[post-edit-check] Tests failed for $FILE_PATH" >&2
    exit 2
  fi
fi

echo "[post-edit-check] Clean."
exit 0