/**
 * "60-sec learning moment" line (ARCHITECTURE.md §8's Daily Brief
 * description). Static content, not data-driven — no external source, so
 * it trivially always resolves, same as the Sky Anchor card. Rotates
 * deterministically by day so the same request returns the same fact
 * within a day but the Brief doesn't repeat itself day to day.
 */

const LEARNING_MOMENTS: readonly string[] = [
  'The ISS orbits Earth roughly every 90 minutes — about 16 sunrises a day for the crew aboard it.',
  "Aurorae appear when charged solar-wind particles are funneled by Earth's magnetic field toward the poles, exciting oxygen and nitrogen in the upper atmosphere.",
  'A coronal mass ejection can carry a billion tons of solar plasma outward at over 1,000 km/s.',
  'Stellar distance is measured by parallax: the tiny apparent shift of a nearby star against the background sky as Earth orbits the Sun.',
  'The Kp index summarizes global geomagnetic disturbance on a 0-9 scale — higher values push the auroral oval toward the equator.',
  "A near-Earth object's size is estimated from how bright it appears (absolute magnitude) combined with an assumed surface reflectivity.",
  'Sunlight takes about 8 minutes and 20 seconds to reach Earth, but the solar wind that drives geomagnetic storms takes 1 to 3 days.',
  'The ISS is only visible to the naked eye when it is sunlit but the sky below is dark — a narrow window around dawn and dusk.',
  'A lunar distance (~384,400 km) is a common yardstick for near-Earth object flybys — most pass many lunar distances away.',
  'The Drag-Based Model treats a coronal mass ejection like a solar-wind-immersed object: it accelerates if slower than the ambient wind, decelerates if faster.',
] as const;

export function selectLearningMoment(now: Date): string {
  const daysSinceEpoch = Math.floor(now.getTime() / 86_400_000);
  const index =
    ((daysSinceEpoch % LEARNING_MOMENTS.length) + LEARNING_MOMENTS.length) %
    LEARNING_MOMENTS.length;
  return LEARNING_MOMENTS[index]!;
}
