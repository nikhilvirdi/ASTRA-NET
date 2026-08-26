-- Promotes `cmeActivityId` from the JSONB `context` blob to a real, indexed,
-- unique column. This is what turns the brief route's create-if-absent
-- write into a race-safe atomic upsert instead of a check-then-act
-- (findFirst-then-create) against an unindexed JSONB path — see
-- DECISIONS.md's entry on the prediction-dedup race condition.

-- 1. Add the column nullable first — a NOT NULL column can't be added
--    directly to a table that already has rows without a default.
ALTER TABLE "Prediction" ADD COLUMN     "cmeActivityId" TEXT;

-- 2. Backfill from the existing JSONB path so no historical row loses its
--    CME identity.
UPDATE "Prediction"
SET "cmeActivityId" = "context" ->> 'cmeActivityId'
WHERE "cmeActivityId" IS NULL;

-- 3. Defensive de-duplication: this migration exists precisely because the
--    old check-then-act write could double-insert a row for the same CME.
--    Keep exactly one row per activity id — prefer an already-scored row
--    (real accuracy-loop signal), else the earliest-created row — and
--    delete the rest. A no-op today (verified: zero duplicate
--    cmeActivityId values in the current table) but makes this migration
--    safe to run again anywhere duplicates do exist.
DELETE FROM "Prediction" p
WHERE p."cmeActivityId" IS NOT NULL
  AND p."id" NOT IN (
    SELECT DISTINCT ON ("cmeActivityId") "id"
    FROM "Prediction"
    WHERE "cmeActivityId" IS NOT NULL
    ORDER BY "cmeActivityId", "scored" DESC, "createdAt" ASC
  );

-- 4. Any remaining row with no recoverable activity id (should not happen —
--    every row is created only when DONKI's `activityId` is a real
--    non-null string, see `routes/brief.ts`) cannot satisfy the NOT NULL
--    constraint below and cannot be honestly backfilled, so it is dropped
--    rather than filled with an invented placeholder id.
DELETE FROM "Prediction" WHERE "cmeActivityId" IS NULL;

-- 5. Now safe to enforce NOT NULL + UNIQUE.
ALTER TABLE "Prediction" ALTER COLUMN "cmeActivityId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Prediction_cmeActivityId_key" ON "Prediction"("cmeActivityId");
