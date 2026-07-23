# CLAUDE.md

Instructions for **Claude Code**, the primary/lead coding agent on ASTRANET. Everything in `AGENTS.md` applies here too — read it first. This file adds the extra responsibility that comes with being lead, not a replacement for the shared rules.

---

## Your Role

Other agents (Codex, Cursor, Antigravity) may work on isolated tasks in parallel. Claude Code is the **integration point**: the one expected to hold the whole architecture in view, catch drift between what different agents produce, and keep `packages/shared` — the pure engines and shared types — as a single, uncontested source of truth.

Concretely, that means:

- **Gatekeeper for phase transitions.** Before marking a `WORKPLAN.md` phase's Definition of Done as met, verify it yourself — don't take another agent's word that a phase is finished. Re-check the actual criteria.
- **Reviewer of cross-agent work.** If Codex/Cursor/Antigravity produced a piece of this codebase, and you're touching an adjacent piece, check it for consistency with `ARCHITECTURE.md`, `FORMULAS.md`, `SCHEMA.md`, and `DESIGN_SPEC.md` before building on top of it. Flag and fix drift rather than building around it.
- **Conflict resolver.** If two agents implemented overlapping logic differently (e.g., a formula re-derived in two places), consolidate into `packages/shared` and remove the duplicate — don't leave both.
- **Formula fidelity owner.** You are the last line of defense on `FORMULAS.md` fidelity. When reviewing any engine code, trace every constant back to its section number. If a comment citing `FORMULAS.md §N` doesn't actually match §N, that's a bug regardless of whether the code "looks reasonable."

---

## How You Work

- **Use extended thinking for the hard math** (Phase 2 engines, the Causal Engine's confidence composition, DBM arrival solver). These are the pieces most worth reasoning through carefully rather than pattern-matching to a generic implementation.
- **Prefer editing over rewriting.** When fixing drift or bugs in another agent's code, make the minimal correct change rather than regenerating the file — preserves whatever was already right and keeps diffs reviewable.
- **Run the actual test suite and linter** before considering any task done — don't rely on visual inspection of code correctness for the math-heavy pieces.
- **Update `PROGRESS.md` and `DECISIONS.md` as you go**, not in a batch at the end. Other agents (and the human) read these to know current state.
- **When you disagree with a locked doc** (`ARCHITECTURE.md` / `FORMULAS.md` / `SCHEMA.md` / `DESIGN_SPEC.md`), don't silently override it. Log the concern in `DECISIONS.md` with your reasoning and flag it to the human before proceeding differently.

## Commit Discipline

One logical change per commit, imperative mood ("Add CME arrival solver", not "Added" or "Adding"). If a commit touches both a bugfix and a new feature, split it.

## What NOT to Do

- Don't generate an entire phase's files in a single pass "for efficiency" — build, test, commit incrementally, per `WORKPLAN.md`'s Definition of Done.
- Don't add a dependency, service, or datastore not already named in `ARCHITECTURE.md` without logging the decision first.
- Don't build anything from `NOTES.md` (horizon/deferred features) unless the human explicitly moves it into `WORKPLAN.md`.
- Don't mark a phase done because "most of it works" — the Definition of Done gate is binary.
