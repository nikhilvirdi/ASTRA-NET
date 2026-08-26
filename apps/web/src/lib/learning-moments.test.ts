import { describe, expect, it } from 'vitest';
import type { HeadlineKind } from './brief-headline';
import {
  factsForCategory,
  LEARNING_MOMENT_BUCKET_MS,
  LEARNING_MOMENTS,
  learningMomentBucket,
  selectLearningMoment,
  type FactCategory,
} from './learning-moments';

const ALL_CATEGORIES: FactCategory[] = ['aurora', 'iss', 'moon', 'planets', 'neo', 'sky-mechanics'];

const atBucket = (bucket: number): Date => new Date(bucket * LEARNING_MOMENT_BUCKET_MS);

describe('the fact bank', () => {
  it('holds enough facts to rotate meaningfully', () => {
    expect(LEARNING_MOMENTS.length).toBeGreaterThanOrEqual(20);
  });

  it('has no duplicate facts', () => {
    const texts = LEARNING_MOMENTS.map((f) => f.text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('gives every category something to draw from', () => {
    for (const category of ALL_CATEGORIES) {
      expect(factsForCategory(category).length, `${category} is empty`).toBeGreaterThan(0);
    }
  });

  it('uses only known categories', () => {
    for (const fact of LEARNING_MOMENTS) {
      expect(ALL_CATEGORIES).toContain(fact.category);
    }
  });

  it('has substantive text in every entry', () => {
    for (const fact of LEARNING_MOMENTS) {
      expect(fact.text.trim().length).toBeGreaterThan(40);
      expect(fact.text.trim()).toBe(fact.text);
    }
  });
});

describe('learningMomentBucket', () => {
  it('is stable across a whole 10-minute window', () => {
    const base = atBucket(12345).getTime();
    expect(learningMomentBucket(new Date(base))).toBe(12345);
    expect(learningMomentBucket(new Date(base + 1))).toBe(12345);
    expect(learningMomentBucket(new Date(base + LEARNING_MOMENT_BUCKET_MS - 1))).toBe(12345);
  });

  it('advances exactly at the boundary', () => {
    const base = atBucket(12345).getTime();
    expect(learningMomentBucket(new Date(base + LEARNING_MOMENT_BUCKET_MS))).toBe(12346);
  });

  it('buckets are ten minutes wide', () => {
    expect(LEARNING_MOMENT_BUCKET_MS).toBe(10 * 60 * 1000);
  });
});

describe('selectLearningMoment — category matching', () => {
  const expected: Record<HeadlineKind, FactCategory | null> = {
    'aurora-chance': 'aurora',
    'cme-inbound': 'aurora',
    'iss-pass': 'iss',
    'neo-approach': 'neo',
    'planet-high': 'planets',
    'moon-phase': 'moon',
    quiet: null,
  };

  it('draws from the category the headline is reporting', () => {
    for (const [kind, category] of Object.entries(expected)) {
      if (category === null) continue;
      // Sweep a full rotation so this is not a lucky single bucket.
      for (let bucket = 0; bucket < 40; bucket++) {
        const fact = selectLearningMoment(kind as HeadlineKind, atBucket(bucket));
        expect(fact.category, `${kind} at bucket ${bucket}`).toBe(category);
      }
    }
  });

  it('draws from the whole bank when nothing notable is happening', () => {
    const seen = new Set<FactCategory>();
    for (let bucket = 0; bucket < LEARNING_MOMENTS.length; bucket++) {
      seen.add(selectLearningMoment('quiet', atBucket(bucket)).category);
    }
    // A full sweep of the bank must touch every category, which it only can if
    // the quiet branch is rotating the whole bank rather than one slice.
    for (const category of ALL_CATEGORIES) {
      expect(seen).toContain(category);
    }
  });

  it('pairs both space-weather headline kinds with aurora facts', () => {
    const now = atBucket(7);
    expect(selectLearningMoment('aurora-chance', now).category).toBe('aurora');
    expect(selectLearningMoment('cme-inbound', now).category).toBe('aurora');
  });
});

describe('selectLearningMoment — time-bucketed rotation', () => {
  it('returns the same fact everywhere inside one bucket', () => {
    const base = atBucket(500).getTime();
    const first = selectLearningMoment('quiet', new Date(base));
    expect(selectLearningMoment('quiet', new Date(base + 1))).toEqual(first);
    expect(selectLearningMoment('quiet', new Date(base + 60_000))).toEqual(first);
    expect(selectLearningMoment('quiet', new Date(base + LEARNING_MOMENT_BUCKET_MS - 1))).toEqual(
      first,
    );
  });

  it('changes at the bucket boundary', () => {
    const base = atBucket(500).getTime();
    const before = selectLearningMoment('quiet', new Date(base + LEARNING_MOMENT_BUCKET_MS - 1));
    const after = selectLearningMoment('quiet', new Date(base + LEARNING_MOMENT_BUCKET_MS));
    expect(after).not.toEqual(before);
  });

  it('steps through consecutive facts rather than re-rolling', () => {
    for (let bucket = 0; bucket < 5; bucket++) {
      const here = selectLearningMoment('quiet', atBucket(bucket));
      const next = selectLearningMoment('quiet', atBucket(bucket + 1));
      const hereIndex = LEARNING_MOMENTS.indexOf(here);
      const nextIndex = LEARNING_MOMENTS.indexOf(next);
      expect(nextIndex).toBe((hereIndex + 1) % LEARNING_MOMENTS.length);
    }
  });

  it('visits every fact in the bank across one full rotation', () => {
    const seen = new Set<string>();
    for (let bucket = 0; bucket < LEARNING_MOMENTS.length; bucket++) {
      seen.add(selectLearningMoment('quiet', atBucket(bucket)).text);
    }
    expect(seen.size).toBe(LEARNING_MOMENTS.length);
  });

  it('wraps cleanly after a full rotation', () => {
    const start = selectLearningMoment('quiet', atBucket(0));
    const wrapped = selectLearningMoment('quiet', atBucket(LEARNING_MOMENTS.length));
    expect(wrapped).toEqual(start);
  });

  it('rotates within a matched category too, not just the general bank', () => {
    const auroraFacts = factsForCategory('aurora');
    const seen = new Set<string>();
    for (let bucket = 0; bucket < auroraFacts.length; bucket++) {
      seen.add(selectLearningMoment('aurora-chance', atBucket(bucket)).text);
    }
    expect(seen.size).toBe(auroraFacts.length);
  });

  it('is deterministic — repeated calls at one instant never differ', () => {
    const now = new Date(Date.UTC(2026, 7, 26, 22, 3, 17));
    const first = selectLearningMoment('iss-pass', now);
    for (let i = 0; i < 20; i++) {
      expect(selectLearningMoment('iss-pass', now)).toEqual(first);
    }
  });

  it('handles pre-epoch instants without a negative index', () => {
    const beforeEpoch = new Date(-5 * LEARNING_MOMENT_BUCKET_MS - 1);
    const fact = selectLearningMoment('quiet', beforeEpoch);
    expect(LEARNING_MOMENTS).toContain(fact);
  });
});
