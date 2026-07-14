# ASTRANET — Testing Standard

This is what "thoroughly tested" means on this project, made concrete and checkable — not a vibe, not a judgment call. Every phase in `WORKPLAN.md` is gated by this document.

---

## The Core Principle

**Quality is a binary, automated check, not a subjective read.** A function either passes its gate (coverage threshold, lint clean, tests green) or it doesn't. Nobody — human or agent — spends unbounded time "polishing" a file with no defined stopping point. When the gate is green, the task is done. Move on.

---

## Coverage Requirements by Layer

| Layer | Requirement | Why |
|---|---|---|
| `packages/shared` (pure engines) | **100%, non-negotiable** | Small, pure, no I/O — full coverage is actually achievable, and this is the scientifically load-bearing code (`FORMULAS.md`). A wrong constant here is wrong everywhere it's used. |
| `apps/api` (routes, poller, auth) | ≥85% | I/O-heavy; the missing 15% is acceptable boilerplate (server bootstrap, etc.), not core logic. |
| `apps/web` (React) | ≥70% on logic (hooks, stores); components tested via key interaction, not exhaustively | UI coverage numbers are a weak signal past a point — see E2E below for what actually matters. |

CI enforces the `packages/shared` threshold as a hard fail (see `ci.yml`). The other two are tracked but not yet hard-gated — revisit once the app has real usage patterns to test against.

---

## What Kind of Test, for What

**Unit tests (Vitest)** — every function in `packages/shared`. Pure in, pure out, no mocking needed because there's no I/O to mock. This is where `FORMULAS.md` fidelity gets proven.

**Integration tests (Vitest + supertest or similar)** — every API endpoint, with particular attention to the **degradation contract** (`ARCHITECTURE.md` §5). For `/api/brief` specifically, test:
- All sources healthy → full response
- One source down → only that card blanks, rest intact
- All sources down → still returns *something* (Sky Anchor never fails, it's static)

**E2E (Playwright)** — reserved for a short list of critical user flows, not everything:
- Sign up → log in → save a location → see a personalized Brief
- Drop into Ground Truth Sky Anchor, click the ISS, see its story
- Best-Spot Finder returns a ranked result for a real location
- Delete-my-data actually removes a user's rows

Adding more E2E tests than this list needs sign-off — they're slow and brittle relative to unit/integration; use them for what only a full browser can verify.

---

## Required Edge Cases (mapped from `FORMULAS.md` §"Implementation Notes")

Every engine test suite must include these, named explicitly so a reviewer (or `/formula-audit`) can check they exist by name, not infer they're "probably covered":

| Engine | Required test names |
|---|---|
| Star position (§1) | `handles_negative_parallax`, `handles_parallax_below_0.2mas` |
| CME arrival (§6) | `solves_when_v0_greater_than_w`, `solves_when_v0_less_than_w`, `arrival_uncertainty_widens_with_speed_error` |
| Aurora visibility (§7) | `kp_zero_no_aurora_at_equator`, `kp_nine_aurora_visible_at_mid_latitude`, `observer_at_geomagnetic_pole` |
| Causal confidence (§8) | `lead_factor_approaches_0.3_at_long_horizon`, `agreement_factor_penalizes_kp_mismatch`, `history_factor_neutral_with_no_trials` |
| Best-spot score (§11) | `zero_clarity_kills_score`, `zero_darkness_kills_score`, `travel_decay_at_large_distance` |
| NEO (§10) | `diameter_from_h_matches_reference_value` |

If a required test name is missing, the task is not done — this list is the literal Definition of Done for Phase 2, not a suggestion.

---

## Test Data & Fixtures

- Every Phase-1 API client is tested against a **recorded real sample response**, stored as a fixture — not a hand-written mock guessing at the shape. Update fixtures if a source's schema changes.
- Engine tests use **hand-picked, documented inputs** (e.g., "Kp=9, observer at 45°N — expected: visible, matches known October 2024 storm reports") where a real-world anchor exists, so a reviewer can sanity-check the expected value independently of the code.

---

## What "Near-Perfect" Actually Means Here

Not: infinite refinement, bikeshedding style choices, or hand-wringing over subjective code quality.
Is:
- The coverage gate is green.
- ESLint is clean (`no-explicit-any`, `no-floating-promises` — see `.eslintrc.json` — are errors, not warnings).
- Every required edge case from this document is a named, passing test.
- The pre-commit hook and `.claude/hooks/post-edit-check.sh` catch problems **immediately**, not three files later in review.

If all four hold, the code is done. Don't manufacture more work looking for a subjective "better."