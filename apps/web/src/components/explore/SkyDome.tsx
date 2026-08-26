import React, { useMemo } from 'react';
import { cssColorToken } from '@/lib/color';

export function SkyDome(): React.ReactElement {
  const horizonColor = useMemo(() => cssColorToken('--color-sky-600', '#3e4a4a'), []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      {/* 
        A very thin ring geometry lying flat at y=0, radius 998-1000 
        This acts as the faint 2px horizon rule mandated by DESIGN_SPEC.md §11
      */}
      <ringGeometry args={[998, 1000, 128]} />
      {/* 
        Color sky-600 (--color-sky-600) at 40% opacity 
        to match the "hairline rules" specification for depth
      */}
      <meshBasicMaterial
        color={horizonColor}
        transparent
        opacity={0.4}
        side={2}
        depthWrite={false}
      />
    </mesh>
  );
}
