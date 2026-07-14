---
description: Audit an engine file for fidelity against FORMULAS.md
---

## File to audit
$ARGUMENTS

## Reference

!`cat FORMULAS.md`

## Task

Read the file given in $ARGUMENTS. For every constant, threshold, and formula it implements:

1. Identify which `FORMULAS.md` section it corresponds to.
2. Confirm the constant values match exactly (no rounding drift, no substituted defaults).
3. Confirm clamping/range rules are applied where `FORMULAS.md` requires them.
4. Confirm the function is pure — no `Date.now()`, no network/DB calls, `now` injected as a parameter.
5. List any mismatch as a specific line-by-line finding, not a general impression.
6. If everything matches, say so plainly — don't invent findings to seem thorough.

Do not modify the file. Report findings only. If a real mismatch is found, ask before fixing it, and log the finding in `DECISIONS.md` regardless of whether it turns out to be a bug in the code or an ambiguity in `FORMULAS.md` itself.