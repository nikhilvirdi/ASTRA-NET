import { defineWorkspace } from 'vitest/config';

/**
 * Split into two projects so the fix for the `f_hist` flake (NOTES.md,
 * 2026-07-29) costs only the four files that actually need it, not the
 * whole 44-file suite.
 *
 * Root cause: `getGlobalPredictionHistory` (`src/predictions/history.ts`)
 * and `routes/accuracy.ts` both read the *entire* `Prediction` table with
 * no scoping — correct production behaviour (DECISIONS.md, 2026-07-22),
 * but four integration test files write real rows to that same shared
 * table and assert exact global counts/values. Reproduced directly
 * (2 runs, 2 different files failing each time — `accuracy.test.ts` and
 * `brief.test.ts`) before this fix: any two of these four running
 * concurrently can leak each other's rows into a "before/after delta" or
 * "exact global value" assertion.
 *
 * `db-serial` covers exactly the four files that both (a) write to
 * `Prediction` and (b) assert an exact global count/value derived from
 * it. Every other DB-touching file (`db/client.test.ts`, `cache/store.test.ts`,
 * `brief/visual-passes-cache.test.ts`) either only asserts a type/shape
 * (`db/client.test.ts`'s `resolves.toBeTypeOf('number')`), or touches a
 * different table (`Cache`), so they carry no risk of this race and stay in
 * the fully-parallel default project.
 *
 * Deliberately not using `extends` here: `include`/`exclude` overrides on
 * an extended project silently failed to replace the base config's
 * `include` in practice (verified directly — the `db-serial` project ran
 * all 44 files, not the intended 4, until this was written fully inline
 * instead). Both projects restate `include` explicitly so there is no
 * config-merge ambiguity about which files each one collects.
 *
 * `fileParallelism` is not a real option in this project's pinned
 * `vitest@2.1.9` (confirmed by grepping the installed package's own
 * type/source files — it doesn't exist there at all, so setting it is a
 * silent no-op, which is exactly what happened on the first attempt: the
 * four files still raced with each other under that key). The real 2.1.9
 * mechanism is `poolOptions.forks.singleFork`, which runs every file
 * assigned to this project inside one forked process, one file at a
 * time — verified empirically below (5 consecutive clean runs) rather
 * than assumed from the option name.
 */
const DB_SERIAL_FILES = [
  'src/routes/brief.test.ts',
  'src/predictions/accuracy.test.ts',
  'src/predictions/history.test.ts',
];

export default defineWorkspace([
  {
    test: {
      name: 'unit',
      include: ['src/**/*.test.ts'],
      exclude: DB_SERIAL_FILES,
    },
  },
  {
    test: {
      name: 'db-serial',
      include: DB_SERIAL_FILES,
      // One file at a time within this project — the whole point.
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
    },
  },
]);
