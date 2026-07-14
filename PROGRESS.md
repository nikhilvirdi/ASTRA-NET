# PROGRESS.md

Running log of what's done, what's blocked, what's next. Updated by whoever (human or agent) finishes a task — immediately, not in a batch. This is the proof-of-momentum file and the way parallel agents know current state without re-reading everything.

**Current Phase:** `Phase 1 — Data Source Clients` (Antigravity, in progress) + `Phase 2 — Core Math Engines` (Claude Code, in progress in parallel — fully isolated from Phase 1, explicitly authorized by human)

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
- ✅ Done: Caught Prisma v7 incompatibility pre-install; pinned `prisma@^6` + `@prisma/client@^6` in `apps/api/package.json`; schema verified clean (no `prisma.config.ts`, no adapter refs) — by Antigravity

## 2026-07-15 (Phase 0 environment issues resolved — DoD now genuinely met)

- ✅ Done: Docker Desktop was not running; started it, confirmed `docker info` returns a populated `Server:` section — by Claude Code
- ✅ Done: Found port 5432 already bound by native Windows service `postgresql-x64-18` (PID 7392), unrelated to our stack; remapped our container to host port 5433 in `docker-compose.yml` + `.env` + `.env.example` (see `DECISIONS.md`) — by Claude Code
- ✅ Done: `docker compose down -v` / `up -d` — `astranet-postgres` up and **healthy** on `5433` — by Claude Code
- ✅ Done: `npx prisma migrate dev --name init` — applied `20260714185748_init` cleanly, no P1000/errors — by Claude Code
- ✅ Done: `npm test` — 1/1 passing (`packages/shared`) — by Claude Code
- ✅ Done: `npm run lint` and `npm run typecheck` clean across all workspaces (local proxy for CI) — by Claude Code
- ✅ Done: Ran `/phase-check` against `WORKPLAN.md` Phase 0 Definition of Done — all criteria verified with real command output, phase genuinely closed — by Claude Code
- ✅ Done: Phase 1 — NOAA SWPC client (Kp, 3-day forecast, solar wind, RTSW plasma) with Zod validation, retry-with-backoff, and unit tests against real fixtures — by Antigravity
- ✅ Done: Phase 1 — CelesTrak client (JSON OMM) with Zod validation, retry-with-backoff, and unit tests — by Antigravity
- ✅ Done: Phase 1 — N2YO client (Positions, Visual Passes) with Zod validation, retry-with-backoff, and unit tests — by Antigravity
- ⏭️ Next: **Phase 1** — NASA DONKI and NASA NeoWs clients

## 2026-07-15 (Phase 2 — Core Math Engines, started by Claude Code)

- ✅ Done: `packages/shared/src/constants.ts` (§0 frozen constants) + `math-utils.ts` (deg/rad, mod, clamp, bisection solver) + `vector.ts` helpers — 100% coverage — by Claude Code
- ✅ Done: `engines/star-position.ts` (§1 parallax→distance/Cartesian/years_ago, §2 brightness/point-size/B-V/color-temp) — 100% coverage incl. `handles_negative_parallax`, `handles_parallax_below_0.2mas` — by Claude Code
- ✅ Done: `/formula-audit` run against `star-position.ts` — clean, no mismatches — by Claude Code
- ✅ Done: `engines/sky-dome.ts` (§3 JD/LST/hour-angle/alt-az) + `engines/sun-position.ts` (§4 Meeus low-precision Sun RA/Dec, twilight checks) — 100% coverage, real-anchor test at J2000.0 (RA≈281.3°/Dec≈-23.0°, matches known ephemeris) — audit clean — by Claude Code
- ✅ Done: `engines/satellite-pass.ts` (§5 elevation + darkness + sunlit shadow-cylinder test, all three AND-ed) — 100% coverage — audit clean — by Claude Code
- ✅ Done: `engines/cme-arrival.ts` (§6 DBM bisection solver + arrival-uncertainty propagation) — required tests `solves_when_v0_greater_than_w`, `solves_when_v0_less_than_w`, `arrival_uncertainty_widens_with_speed_error` all present and hand-verified against manual DBM derivation — audit clean — by Claude Code
- ✅ Done: `engines/aurora.ts` (§7 geomagnetic latitude, oval boundary, horizon margin, strength) — required tests `kp_zero_no_aurora_at_equator`, `kp_nine_aurora_visible_at_mid_latitude`, `observer_at_geomagnetic_pole` all present — audit clean — by Claude Code
- ✅ Done: `engines/causal-engine.ts` (§8 lead × agreement × history confidence, Kp_cme heuristic, confidence bands, composite prediction) — required tests `lead_factor_approaches_0.3_at_long_horizon`, `agreement_factor_penalizes_kp_mismatch`, `history_factor_neutral_with_no_trials` all present; verified §7's binding rule (CME-Kp never used as primary) holds in the output — audit clean after fixing a missing DECISIONS.md cross-reference — by Claude Code
- ✅ Done: `engines/neo.ts` (§10 diameter/miss-distance) + `engines/best-spot.ts` (§11 clarity×darkness×travel) — required tests `diameter_from_h_matches_reference_value`, `zero_clarity_kills_score`, `zero_darkness_kills_score`, `travel_decay_at_large_distance` all present — audit clean — by Claude Code
- ✅ Done: full `packages/shared` suite — 12 test files, 93 tests, **100% lines/branches/functions/statements coverage**; `npx eslint packages/shared/src` and `tsc --noEmit` both clean — by Claude Code
- ✅ Done: Phase 2 Core Math Engines — **all 7 engines complete, tested, audited** — by Claude Code
- ✅ Done: Both flagged Phase 2 gaps resolved by human — `FORMULAS.md` §2 updated to confirm RGB rendering stays out of `packages/shared` (belongs in `apps/web`, Phase 8, Tanner Helland approximation), §11 updated with `AURORA_STRENGTH_SATURATION_DEG = 20` normalization; `DECISIONS.md` entries marked resolved — by Claude Code
- ✅ Done: `auroraStrengthToFactor()` added to `engines/aurora.ts` (§11 normalization: `clamp(strengthDeg / 20, 0, 1)`), with tests at strength=0, 20, 10, 30 (saturation), and negative input — `/formula-audit` clean — by Claude Code
- ✅ Done: Phase 2 — **fully closed, zero open questions** — full `packages/shared` suite green, 100% coverage maintained — by Claude Code
- ⏭️ Next: Phase 1 (Antigravity) continues; Phase 3 (Poller) now unblocked on Phase 2
