import React from 'react';

export function SkyDome(): React.ReactElement {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      {/* 
        A very thin ring geometry lying flat at y=0, radius 998-1000 
        This acts as the faint 2px horizon rule mandated by DESIGN_SPEC.md §11
      */}
      <ringGeometry args={[998, 1000, 128]} />
      {/* 
        Color sky-600 (#3E4A4A) at 40% opacity 
        to match the "hairline rules" specification for depth
      */}
      <meshBasicMaterial color="#3E4A4A" transparent opacity={0.4} side={2} depthWrite={false} />
    </mesh>
  );
}
