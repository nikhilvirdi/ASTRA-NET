/**
 * Shared TLE (two-line element) text parsing, used by every client that
 * returns the classic fixed-column NORAD format (CelesTrak's FORMAT=tle,
 * Space-Track's format/tle) — the same standard element-set format
 * regardless of distributor, so one parser/validator serves both rather
 * than being duplicated per client (mirrors this directory's
 * `fetch-with-retry.ts` consolidation — see DECISIONS.md).
 */

import { z } from 'zod';
import type { CelestrakTleRecord } from '../clients/celestrak/celestrak.types.js';

/**
 * Validated structurally (length, line-number marker, matching catalog
 * number between the two element lines) rather than by TLE checksum: every
 * Phase 1 client validates upstream *shape*, not upstream arithmetic, and
 * satellite.js's own `twoline2satrec` does not verify checksums either.
 */
export const TleRecordSchema = z
  .object({
    name: z.string().min(1),
    line1: z.string().length(69).startsWith('1 '),
    line2: z.string().length(69).startsWith('2 '),
  })
  .refine((r) => r.line1.slice(2, 7) === r.line2.slice(2, 7), {
    message: 'line1/line2 catalog number mismatch',
  });

export const TleRecordsSchema = z.array(TleRecordSchema);

export type TleRecordParsed = z.infer<typeof TleRecordSchema>;

/**
 * Splits a FORMAT=tle plain-text response into name/line1/line2 triples.
 * Each satellite is three lines (name, then the two fixed-column element
 * lines); trailing blank lines from the response are dropped before
 * chunking. Returns null if the text doesn't chunk evenly into triples, or
 * any triple fails schema validation — a truncated/corrupt response,
 * treated the same as any other parse failure.
 */
export function parseTleText(raw: string): CelestrakTleRecord[] | null {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0 || lines.length % 3 !== 0) return null;

  const candidates: unknown[] = [];
  for (let i = 0; i < lines.length; i += 3) {
    // If the first line is a '0 ' prefix (Space-Track 3LE), use it as the name.
    const nameCandidate = lines[i]?.trim() ?? '';
    const name = nameCandidate.startsWith('0 ') ? nameCandidate.slice(2) : nameCandidate;

    candidates.push({
      name: name,
      line1: lines[i + 1]?.trimEnd() ?? '',
      line2: lines[i + 2]?.trimEnd() ?? '',
    });
  }

  const result = TleRecordsSchema.safeParse(candidates);
  if (!result.success) return null;

  return result.data.map((entry) => ({
    name: entry.name,
    noradCatId: Number.parseInt(entry.line1.slice(2, 7), 10),
    line1: entry.line1,
    line2: entry.line2,
  }));
}
