import React from 'react';
import { DiegeticText } from './DiegeticText';

/**
 * Cardinal direction labels sitting just above the horizon rule — instrument
 * furniture (like the SkyDome's horizon hairline), not scene objects: mono,
 * quiet, non-clickable, zero Rule-of-7 slots. First live consumer of the
 * diegetic-text system; also what makes the ground view orientable at all
 * before any clickable object exists. Flagged in DECISIONS.md — §11 doesn't
 * name compass marks explicitly.
 */

/** Just inside the aurora shell (950) so labels never intersect it. */
const MARK_RADIUS = 940;
/** Slightly above the horizon rule. */
const MARK_ALTITUDE_RAD = (2.5 * Math.PI) / 180;

const DIRECTIONS: { label: string; azimuthRad: number }[] = [
  { label: 'N', azimuthRad: 0 },
  { label: 'E', azimuthRad: Math.PI / 2 },
  { label: 'S', azimuthRad: Math.PI },
  { label: 'W', azimuthRad: (3 * Math.PI) / 2 },
];

export function CardinalMarks(): React.ReactElement {
  return (
    <>
      {DIRECTIONS.map((d) => (
        <DiegeticText
          key={d.label}
          text={d.label}
          position={[
            MARK_RADIUS * Math.cos(MARK_ALTITUDE_RAD) * Math.sin(d.azimuthRad),
            MARK_RADIUS * Math.sin(MARK_ALTITUDE_RAD),
            -MARK_RADIUS * Math.cos(MARK_ALTITUDE_RAD) * Math.cos(d.azimuthRad),
          ]}
          fontSize={22}
          opacity={0.55}
        />
      ))}
    </>
  );
}
