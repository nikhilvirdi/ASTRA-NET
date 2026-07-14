# DECISIONS.md

Short log of real decisions made on ASTRANET, with a one-line "why." Purpose: six weeks in, don't re-litigate a settled call. New entries go at the bottom, newest last, each dated.

**When to add an entry:** any deviation from a locked doc, any new dependency/service, any time an agent flags something in `FORMULAS.md`/`ARCHITECTURE.md`/`SCHEMA.md` that seems wrong. Log the concern here before changing anything.

---

## 2026-07-14 — Project scope: merge original + 34-feature ASTRANET concepts
**Why:** original idea was too plain, the 34-feature version was spectacle with no return-loop. Merged into one product built around personalization + causal explanation, with deep-sky features deferred to `NOTES.md`.

## 2026-07-14 — No versioning / no phased "V1, V2"
**Why:** building the complete, final-scope product from the start — phases in `WORKPLAN.md` are build order, not feature-completeness tiers.

## 2026-07-14 — Cut Constellation Symphony, Apollo Echoes, Fluid Time Machine, Magnetic Shield Stress Test
**Why:** visually impressive but none feed the personalization/return loop. Parked in `NOTES.md`.

## 2026-07-14 — Real-time: two-tier polling, not pure SSE-everywhere or pure cron
**Why:** fast tier (30–60s, ISS/solar wind) needs to feel live; slow tier (5–15min, DONKI/NeoWs/imagery) doesn't need more. Being honest about which is which (live pulse vs. "updated Xm ago") matters more than faking uniform real-time.

## 2026-07-14 — No MongoDB; single Postgres with JSONB
**Why:** dual-database was unjustified — no query pattern that Postgres + JSONB can't serve. One less system to operate, one less free-tier pause to babysit.

## 2026-07-14 — Causal Engine confidence = three multiplicative factors (lead × agreement × history)
**Why:** avoids a fabricated "vibes" percentage; each factor is independently reasoned and testable. See `FORMULAS.md` §8.

## 2026-07-14 — Dropped Supabase; self-hosted PostgreSQL via Docker
**Why:** removes the 7-day free-tier pause entirely; user prefers full control and already runs Docker locally.

## 2026-07-14 — Auth: custom JWT (access + rotated refresh), not Supabase Auth
**Why:** direct consequence of dropping Supabase. Refresh tokens stored hashed in `Session` table for revocability. Google OAuth 2.0 added as an additive path, not a dependency.

## 2026-07-14 — Backend hosting: always-on VPS (Hetzner or Oracle Free ARM), not Render free tier
**Why:** self-hosted Postgres can't live on Render's free web service; owning a box also removes Render's 15-min spin-down/cold-start problem and makes the poller a simple long-running process instead of a GitHub-Actions-cron workaround.

## 2026-07-14 — ORM: Prisma, not Drizzle
**Why:** user's existing familiarity; equivalent capability for this project's needs.

## 2026-07-14 — Project name kept: ASTRANET
**Why:** three rounds of refinement built real name equity; renaming now would be restart-disguised-as-progress. Backronym updated instead (see next entry).

## 2026-07-14 — Backronym changed: "Adaptive Sky Telemetry and Realtime Analysis Network"
**Why:** original expansion ("...Atlas Network") implied comprehensive celestial cataloging — exactly what was cut. New expansion matches what the product actually is: adaptive, personalized, analytical.

## 2026-07-14 — Skipped `ROADMAP.md` as a separate file
**Why:** fully redundant with `WORKPLAN.md`, which already owns milestone order and the `Current Phase` marker.

## 2026-07-14 — Dropped `TECH_STACK.md` as a separate doc
**Why:** overlapped `ARCHITECTURE.md` §2 and the README badges; decided not to maintain two sources of truth for stack info. `ARCHITECTURE.md` is authoritative.

## 2026-07-14 — Data-integrity: `prisma/schema.prisma` found truncated, rewritten to match `SCHEMA.md`
**Why:** a pre-Phase-0 repo audit found the schema file cut off mid-declaration inside the `Prediction` model — missing the rest of `Prediction` (`actualKp`, `scored`, `hit`, its indexes) and the entire `Cache` model. Root cause not determined (likely an interrupted write during initial scaffolding); flagged rather than silently patched since Phase 5/6 work would otherwise have built on a schema missing the accuracy-loop and cache tables without anyone noticing until migration. Rewritten in full against `SCHEMA.md` §Prediction/§Cache and verified at 87 lines (was 66). No downstream code depended on it yet, so no migration cleanup was needed — caught before Phase 6.

## 2026-07-14 — Data-integrity: encoding check on `ARCHITECTURE.md` / `FORMULAS.md` — clean, no action taken
**Why:** same audit asked to check for mojibake (wrong-encoding save) in the ARCHITECTURE.md §1 box-drawing system diagram and the Greek letters (φ, λ, θ) in FORMULAS.md §3/§7, given the schema truncation raised suspicion about file-write integrity generally. Verified via `file` (reports valid UTF-8 for both) and a targeted grep for common mojibake byte patterns (none found) plus presence-count of the actual glyphs (9 Greek letters in FORMULAS.md, 29 box-drawing chars in ARCHITECTURE.md). Logging the clean result so this isn't re-checked from scratch later.

## 2026-07-14 — Husky pinned to v9+ (no `_/husky.sh` shim)
**Why:** `.husky/pre-commit` still had the Husky v8-style shim line (`. "$(dirname -- "$0")/_/husky.sh"`) left over from scaffolding, which errors at commit time under Husky v9+ (the shim file no longer exists in v9's install layout). Since Phase 0 tooling installs Husky fresh, pinned `package.json` to `husky@^9.1.7` (latest at time of writing) and simplified `pre-commit` to just `npx lint-staged`, matching v9's format.
