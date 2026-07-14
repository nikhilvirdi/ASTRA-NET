# PROGRESS.md

Running log of what's done, what's blocked, what's next. Updated by whoever (human or agent) finishes a task — immediately, not in a batch. This is the proof-of-momentum file and the way parallel agents know current state without re-reading everything.

**Current Phase:** `Phase 0 — Foundation & Tooling` (not yet started)

---

## How to log an entry

```
## YYYY-MM-DD
- ✅ Done: <task>, by <agent/human>
- 🚧 In progress: <task>, by <agent/human>
- ⛔ Blocked: <task> — <why> — <who's unblocking>
- ⏭️ Next: <task>
```

Keep entries short — one line per item. Detail belongs in commit messages, not here.

---

## 2026-07-14
- ✅ Done: Full planning/reference doc set — `README.md`, `LICENSE`, `WORKPLAN.md`, `ARCHITECTURE.md`, `FORMULAS.md`, `API_SOURCES.md`, `SCHEMA.md`, `AGENTS.md`, `CLAUDE.md`.
- ✅ Done: Repo scaffold folders + placeholder files created.
- ⏭️ Next: Fill `PROGRESS.md`/`DECISIONS.md`/`NOTES.md`, then begin **Phase 0** — repo init, Docker Postgres, Prisma scaffold, CI, lint/format config.