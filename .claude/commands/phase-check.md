---
description: Verify whether the current WORKPLAN.md phase actually meets its Definition of Done
---

## Current workplan state

!`grep -A2 "Current Phase" WORKPLAN.md`

## Recent progress

!`tail -30 PROGRESS.md`

## Task

1. Identify the current phase from `WORKPLAN.md`.
2. Re-read that phase's atomic tasks and Definition of Done — don't rely on `PROGRESS.md` entries alone, verify against the actual codebase (run the relevant tests/build).
3. Report, task by task: done / not done / partially done, with evidence (test output, file existence, etc.).
4. Only if every task is genuinely done, confirm the phase can be closed and suggest updating the `Current Phase` marker in `WORKPLAN.md` plus a summary entry in `PROGRESS.md`.
5. If anything is incomplete, list exactly what's missing — do not round up "mostly done" to "done."