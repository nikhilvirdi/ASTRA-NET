import React, { useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { DiegeticText } from './DiegeticText';
import {
  filterVisibleCardinalMarks,
  hasCardinalMarksChanged,
  type CardinalMarkInput,
} from '@/lib/explore-interaction';

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

const CARDINAL_MARK_INPUTS: CardinalMarkInput[] = DIRECTIONS.map((d) => ({
  label: d.label,
  azimuthRad: d.azimuthRad,
  position: [
    MARK_RADIUS * Math.cos(MARK_ALTITUDE_RAD) * Math.sin(d.azimuthRad),
    MARK_RADIUS * Math.sin(MARK_ALTITUDE_RAD),
    -MARK_RADIUS * Math.cos(MARK_ALTITUDE_RAD) * Math.cos(d.azimuthRad),
  ],
}));

export function CardinalMarks(): React.ReactElement {
  const { camera } = useThree();
  const [visibleMarks, setVisibleMarks] = useState<CardinalMarkInput[]>(CARDINAL_MARK_INPUTS);

  useFrame(() => {
    const yaw = camera.rotation.y;
    const pitch = camera.rotation.x;
    const filtered = filterVisibleCardinalMarks(CARDINAL_MARK_INPUTS, yaw, pitch);
    if (hasCardinalMarksChanged(visibleMarks, filtered)) {
      setVisibleMarks(filtered);
    }
  });

  return (
    <>
      {visibleMarks.map((d) => (
        <DiegeticText
          key={d.label}
          text={d.label}
          position={d.position}
          fontSize={22}
          opacity={0.55}
        />
      ))}
    </>
  );
}
