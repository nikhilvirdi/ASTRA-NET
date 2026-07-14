# AGENTS.md

Shared instructions for **any** coding agent working on ASTRANET (Codex, Cursor, Antigravity, and others). Claude Code is the primary/lead agent on this project and has its own extended instructions in `CLAUDE.md` — but everything in this file applies to it too. If `CLAUDE.md` and this file ever conflict, `CLAUDE.md` wins for Claude Code; this file is the floor everyone stands on.

---

## Project

**ASTRANET** — Adaptive Sky Telemetry and Realtime Analysis Network. A live, personalized 3D sky companion. Full product context: `README.md`.

## Read Before Writing Any Code

1. `WORKPLAN.md` — **the single source of truth for build order.** Find the `Current Phase` marker at the top and work only within that phase unless told otherwise.
2. `ARCHITECTURE.md` — locked stack, poller design, degradation contract, page layout.
3. `FORMULAS.md` — every formula/constant, **frozen and verbatim.**
4. `API_SOURCES.md` — external APIs: endpoint, key, rate limit, fallback per source.
5. `SCHEMA.md` — data model reasoning (`prisma/schema.prisma` is the literal source of truth).

Do not start writing code from memory or general knowledge of "what a space app needs." These five files are authoritative over any assumption.

---

## Non-Negotiable Rules

- **Phase order is law.** Don't jump ahead to a later phase to "unblock" something — fix the blocker in the current phase.
- **Formulas are frozen.** Implement `FORMULAS.md` exactly. If something looks wrong, log it in `DECISIONS.md` and ask — never silently substitute a different constant or formula.
- **Pure engines stay pure.** Math/prediction code (`packages/shared`) takes explicit inputs and returns outputs — no network calls, no DB reads, no `Date.now()` inside the function; inject `now` as a parameter.
- **Validate all external data with Zod** at the boundary. Never trust an upstream API's shape.
- **Fail gracefully, per the degradation contract** (`ARCHITECTURE.md` §5): one bad source blanks its own card only, never the whole response.
- **Every non-trivial function ships with tests**, including the edge cases listed in `FORMULAS.md`.
- **No new datastore, no new major dependency, no architectural deviation** without logging it in `DECISIONS.md` first.
- **Small, single-purpose commits** with clear messages.
- **No procedurally generated / invented data.** Every object traces to a real source.

## Definition of Done (every task)

Implemented → typed (no `any`) → validated → unit-tested → lint/format clean → committed → `PROGRESS.md` updated.

---

## Shared Code

`packages/shared` holds cross-cutting TypeScript types **and the pure math engines** (Phase 2). Both `apps/api` and `apps/web` import from here — never duplicate a formula or type in either app. If you need a calculation that already exists in `packages/shared`, import it; don't re-derive it.

---

## Working Across Multiple Agents

Several agents may work on this repo in parallel. To avoid collisions:

- Stay inside your assigned task/phase scope — don't opportunistically refactor files outside it.
- Before starting, check `PROGRESS.md` for what's already done or in flight.
- After finishing a task, update `PROGRESS.md` immediately — this is how other agents (and the human) know the current state.
- If you must deviate from a locked doc (`ARCHITECTURE.md`, `FORMULAS.md`, `SCHEMA.md`), stop and record the proposed change in `DECISIONS.md` rather than just doing it — these files are shared contracts, not suggestions.
- Ideas outside current scope go in `NOTES.md`, not into code.

---

## Tone of the Codebase

Quality over quantity. One correct, tested, reviewed component beats five half-built ones. Don't batch-generate an entire phase in one pass — build, test, and commit incrementally within it.