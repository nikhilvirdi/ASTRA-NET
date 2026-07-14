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

## 2026-07-14 (Phase 0 complete)

- ✅ Done: Monorepo workspace structure (`apps/api`, `apps/web`, `packages/shared`) — by Antigravity
- ✅ Done: Root `package.json` with npm workspaces, Node ≥20 engine pin — by Antigravity
- ✅ Done: `tsconfig.base.json` (strict mode, no `any`), per-workspace `tsconfig.json` files — by Antigravity
- ✅ Done: `docker-compose.yml` with Postgres 16, healthcheck — by Antigravity
- ✅ Done: `prisma/schema.prisma` scaffold (User, Session, Location, SkyLogEntry, Prediction, Cache) — by Antigravity
- ✅ Done: `.env.example` with all keys documented — by Antigravity
- ✅ Done: ESLint (`@typescript-eslint/recommended`, `no-explicit-any` as error) + Prettier config — by Antigravity
- ✅ Done: Husky pre-commit hook (`lint-staged`) + `.lintstagedrc.json` — by Antigravity
- ✅ Done: Vitest configured in `packages/shared` with 100% coverage threshold; trivial `version()` test passes — by Antigravity
- ✅ Done: CI workflow (`.github/workflows/ci.yml`): install → lint → typecheck → Prisma generate → migrate → test → coverage gate → build — by Antigravity
- ✅ Done: Agent context files (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules`) — by Antigravity
- ✅ Done: `.env` created from `.env.example` for local dev — by Antigravity
- 🚧 Pending (needs user terminal): `npm install`, `docker compose up -d`, `npx prisma migrate dev --name init`, `npm test` — run locally to close Phase 0 DoD
- ⏭️ Next: **Phase 1** — Data Source Clients (CelesTrak, N2YO, NOAA SWPC, NASA DONKI, NASA NeoWs, JPL Horizons, Open-Meteo, GIBS)
