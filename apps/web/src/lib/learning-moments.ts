import type { HeadlineKind } from './brief-headline';

export type FactCategory = 'aurora' | 'iss' | 'moon' | 'planets' | 'neo' | 'sky-mechanics';

export interface LearningMoment {
  category: FactCategory;
  text: string;
}

/**
 * The Learning Moment fact bank. Every entry states something independently
 * checkable — a measured quantity, a standing definition, or a mechanism —
 * rather than a nice-sounding generality. Numbers are the conventionally cited
 * values (lunar distance 384,400 km; ISS inclination 51.6°; the Kp network's
 * 13 observatories; astronomical twilight at −18°), so a reader who looks one
 * up finds the same figure.
 *
 * Categories exist so the note can follow whatever the headline is reporting.
 * Keep at least a few entries in every category: `selectLearningMoment` picks
 * within a category once one is active, and an empty pool would fall back to
 * the whole bank and quietly lose the context match.
 */
export const LEARNING_MOMENTS: readonly LearningMoment[] = [
  // ── Aurora ────────────────────────────────────────────────────────────────
  {
    category: 'aurora',
    text: 'Aurora colours are atomic fingerprints. The familiar green is atomic oxygen emitting at 557.7 nm around 100–150 km up; the rarer deep red is the same element at 630.0 nm, higher still, above roughly 200 km.',
  },
  {
    category: 'aurora',
    text: 'The green auroral line is a "forbidden" transition: an excited oxygen atom sits on it for about seven tenths of a second before emitting. That only works where the air is thin enough that nothing collides with the atom first, which is why aurora has a floor and not just a ceiling.',
  },
  {
    category: 'aurora',
    text: 'Aurora happens at both poles at once. The northern and southern ovals are often near mirror images of each other, down to individual arcs — the two ends of the same magnetic field lines lighting up together.',
  },
  {
    category: 'aurora',
    text: 'The Kp index runs 0 to 9 and is not measured at your location. It is a planetary average assembled from 13 magnetic observatories, which is why a high Kp is a statement about Earth, not a promise about your sky.',
  },
  {
    category: 'aurora',
    text: 'Aurora is not weather. The light is emitted by Earth’s own upper atmosphere around 100 km up — five times higher than the tallest storm clouds — so cloud cover hides it rather than affecting it.',
  },

  // ── ISS ───────────────────────────────────────────────────────────────────
  {
    category: 'iss',
    text: 'The ISS orbits roughly 400 km up and laps the planet about every 90 minutes. The crew therefore sees around 16 sunrises and 16 sunsets in every 24 hours.',
  },
  {
    category: 'iss',
    text: 'A visible ISS pass needs two things at once: the station still in sunlight, and your sky already dark. That is why passes cluster into the couple of hours after dusk and before dawn, and vanish entirely in the middle of the night.',
  },
  {
    category: 'iss',
    text: 'The station carries no light you can see from the ground. What you are watching is reflected sunlight, most of it bouncing off the solar arrays — which is why a pass fades out mid-sky when the station flies into Earth’s shadow.',
  },
  {
    category: 'iss',
    text: 'The ISS never passes directly overhead north of about 51.6° latitude. That number is its orbital inclination, chosen to suit launches from Baikonur, and it fixes the northern limit of the ground it can fly over.',
  },
  {
    category: 'iss',
    text: 'An ISS pass runs at most about ten minutes horizon to horizon, moves steadily, and never blinks. Anything flashing is an aircraft; anything that stops is a star.',
  },

  // ── Moon ──────────────────────────────────────────────────────────────────
  {
    category: 'moon',
    text: 'The Moon retreats from Earth by about 3.8 centimetres a year. We know the figure that precisely because Apollo crews left retroreflectors on the surface and observatories still bounce lasers off them.',
  },
  {
    category: 'moon',
    text: 'The Moon rotates once every 27.3 days and orbits Earth in the same 27.3 days. That lock is why the same face has pointed at us for the whole of human history.',
  },
  {
    category: 'moon',
    text: 'A full Moon is more than ten times brighter than a half Moon, not twice. Near full, sunlight comes straight back at you and the shadows inside craters disappear; at half phase those shadows swallow much of the light.',
  },
  {
    category: 'moon',
    text: 'Moon phases have nothing to do with Earth’s shadow. They are just the changing angle between Sun, Earth and Moon. Earth’s shadow does fall on the Moon occasionally — that is a lunar eclipse, and it is rare precisely because it is a different thing.',
  },
  {
    category: 'moon',
    text: 'The faint glow filling in the dark part of a thin crescent Moon is earthshine: sunlight that hit Earth’s clouds and oceans, bounced to the Moon, and came back again.',
  },

  // ── Planets ───────────────────────────────────────────────────────────────
  {
    category: 'planets',
    text: 'Planets shine steadily while stars twinkle. A star is a point, so the atmosphere flings its single beam around; a planet is a small disc, and the wobbles of its many points average each other out.',
  },
  {
    category: 'planets',
    text: 'Venus never appears more than about 47° from the Sun, because its orbit is inside Earth’s. That geometry is the whole reason it is only ever a morning or an evening object and never rides the midnight sky.',
  },
  {
    category: 'planets',
    text: 'Saturn’s rings span roughly 280,000 km but are, in places, only about ten metres thick. Scaled to the width of a football pitch they would be far thinner than a sheet of paper.',
  },
  {
    category: 'planets',
    text: 'Jupiter is massive enough that it does not quite orbit the Sun. The two circle a shared centre of mass that sits just outside the Sun’s surface, so the Sun is genuinely wobbling around a point in open space.',
  },
  {
    category: 'planets',
    text: 'Mars is red for an ordinary reason: its surface dust is iron oxide. The planet is, chemically speaking, rusty.',
  },

  // ── Near-Earth objects ────────────────────────────────────────────────────
  {
    category: 'neo',
    text: 'One lunar distance is about 384,400 km — the Earth–Moon gap. Asteroid approaches are quoted in them because raw kilometres stop conveying anything useful at that scale.',
  },
  {
    category: 'neo',
    text: '"Potentially hazardous" is a filing category, not a forecast. It means an object bigger than roughly 140 metres whose orbit can bring it within 0.05 astronomical units of Earth’s — a description of the orbit, not a prediction about it.',
  },
  {
    category: 'neo',
    text: 'Near-Earth asteroids are found by photographing the same patch of sky repeatedly and looking for the dot that moved. Everything else in the frame stays put; the moving speck is the discovery.',
  },
  {
    category: 'neo',
    text: 'The object that exploded over Chelyabinsk in 2013 was only about 20 metres across, and nobody saw it coming. It approached from the direction of the Sun, where no ground telescope can look.',
  },

  // ── Sky mechanics ─────────────────────────────────────────────────────────
  {
    category: 'sky-mechanics',
    text: 'The sky turns 15° every hour — a full 360° in a day. That single number is why star positions are quoted against sidereal time instead of the clock on your wall.',
  },
  {
    category: 'sky-mechanics',
    text: 'A sidereal day is 23 hours 56 minutes 4 seconds, not 24. Earth has to turn a little past one full rotation for the Sun to come back to the same place, because it has also moved along its orbit.',
  },
  {
    category: 'sky-mechanics',
    text: 'Astronomical twilight ends when the Sun reaches 18° below the horizon. Past that point the sky itself stops contributing any glow, and what is left is as dark as your location allows.',
  },
  {
    category: 'sky-mechanics',
    text: 'The atmosphere lifts objects near the horizon by about half a degree. When you watch the Sun touch the horizon it has, geometrically, already set — you are seeing an image bent over the edge of the world.',
  },
  {
    category: 'sky-mechanics',
    text: 'Dark adaptation takes 20 to 30 minutes and one glance at a white screen undoes it. This is the entire reason observers use red light.',
  },
  {
    category: 'sky-mechanics',
    text: 'The magnitude scale runs backwards: smaller numbers are brighter, and each whole step is a factor of about 2.512. It is an inheritance from a Greek catalogue that ranked stars first and got quantified later.',
  },
];

/** Which fact category each headline event calls for; null means no context match. */
const CATEGORY_FOR_HEADLINE: Record<HeadlineKind, FactCategory | null> = {
  'aurora-chance': 'aurora',
  'cme-inbound': 'aurora',
  'iss-pass': 'iss',
  'neo-approach': 'neo',
  'planet-high': 'planets',
  'moon-phase': 'moon',
  quiet: null,
};

/** How long one fact stays on screen before the bank advances. */
export const LEARNING_MOMENT_BUCKET_MS = 10 * 60 * 1000;

/**
 * The 10-minute window `now` falls in, counted from the epoch. Deterministic:
 * every reload inside the same window resolves to the same bucket, so the note
 * holds still instead of reshuffling on each render, and rolls over on its own
 * at the boundary.
 */
export function learningMomentBucket(now: Date): number {
  return Math.floor(now.getTime() / LEARNING_MOMENT_BUCKET_MS);
}

/** Every fact in one category, in bank order. */
export function factsForCategory(category: FactCategory): LearningMoment[] {
  return LEARNING_MOMENTS.filter((f) => f.category === category);
}

/**
 * The note to show alongside a given headline. When the headline is reporting
 * a real event, the note comes from that event's category, so an aurora
 * headline is paired with an aurora fact. With nothing notable to match
 * (`quiet`), it rotates the whole bank instead.
 *
 * Selection is the time bucket modulo the pool size — no randomness, so the
 * same instant always yields the same fact, and consecutive buckets step
 * through the pool rather than re-rolling it.
 */
export function selectLearningMoment(headlineKind: HeadlineKind, now: Date): LearningMoment {
  const category = CATEGORY_FOR_HEADLINE[headlineKind];
  const pool = category === null ? LEARNING_MOMENTS : factsForCategory(category);
  const index = ((learningMomentBucket(now) % pool.length) + pool.length) % pool.length;
  // pool is never empty — every category has entries and the bank is non-empty —
  // but index access is narrowed for noUncheckedIndexedAccess.
  return pool[index] ?? LEARNING_MOMENTS[0]!;
}
