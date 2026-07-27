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

# Parse the payload from a SINGLE stdin source.
#
# The previous form fed node through both a pipe and a here-string
# (`echo "$INPUT" | node -e "..." <<< "$INPUT"`). The here-string won as
# node's stdin, so nothing ever read the pipe: small payloads fit the pipe
# buffer and passed, but a real Write — whose payload carries the entire
# file content — blocked, then died of SIGPIPE (exit 141) the moment node
# exited and closed the read end. Under `set -o pipefail` that aborted the
# hook before it linted anything, which is why nearly every file write
# reported a non-blocking hook failure.
FILE_PATH=$(node -e "
  let data = '';
  process.stdin.on('data', d => data += d);
  process.stdin.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log(json.tool_input?.file_path || '');
    } catch { console.log(''); }
  });
" <<< "$INPUT")

# Claude Code reports Windows paths with backslashes
# (C:\ASTRA-NET\apps\api\src\...), which never matched the */apps/* globs
# below — so even when the hook survived, it exited 0 without linting
# anything. Normalise separators before matching.
FILE_PATH="${FILE_PATH//\\//}"

# Only act on files we actually care about
if [[ "$FILE_PATH" != *"/apps/"* && "$FILE_PATH" != *"/packages/shared/"* ]]; then
  exit 0
fi

if [[ "$FILE_PATH" != *.ts && "$FILE_PATH" != *.tsx ]]; then
  exit 0
fi

echo "[post-edit-check] Linting $FILE_PATH ..."
LINT_STATUS=0
LINT_OUTPUT=$(npx eslint "$FILE_PATH" --max-warnings=0 2>&1) || LINT_STATUS=$?

# A file covered by .eslintrc.json's ignorePatterns (*.config.ts, dist,
# coverage…) is *reported* as a warning when passed explicitly, which
# --max-warnings=0 turns into a failure. That is the ignore config working
# as intended, not a lint error, so it must not fail the hook.
if [[ "$LINT_OUTPUT" == *"File ignored because of a matching ignore pattern"* ]]; then
  echo "[post-edit-check] $FILE_PATH is eslint-ignored — skipping."
  exit 0
fi

if [[ $LINT_STATUS -ne 0 ]]; then
  echo "$LINT_OUTPUT"
  echo "[post-edit-check] Lint failed on $FILE_PATH" >&2
  exit 2
fi

# `packages/shared` is the 100%-coverage CI-gated package, so an edit there
# runs its related tests immediately. Scoped with --root: `npx vitest` from
# the repo root finds no config there and would collect nothing.
if [[ "$FILE_PATH" == *"/packages/shared/"* ]]; then
  echo "[post-edit-check] Running related tests for $FILE_PATH ..."
  if ! npx vitest related "$FILE_PATH" --run --root packages/shared; then
    echo "[post-edit-check] Tests failed for $FILE_PATH" >&2
    exit 2
  fi
fi

echo "[post-edit-check] Clean."
exit 0
