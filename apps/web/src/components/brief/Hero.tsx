import React, { useRef, useMemo, Suspense, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useTexture, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';

function measureInkBounds(text: string, font: string): { left: number; right: number } | null {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.font = font;
  const metrics = ctx.measureText(text);
  const estWidth = metrics.width + 200;
  canvas.width = Math.ceil(estWidth);
  canvas.height = 300;

  ctx.font = font;
  ctx.fillStyle = 'white';
  ctx.textBaseline = 'top';
  ctx.fillText(text, 100, 50);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const w = canvas.width;
  const h = canvas.height;

  let firstCol = w;
  let lastCol = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const alpha = data[(y * w + x) * 4 + 3];
      if (alpha !== undefined && alpha > 0) {
        // Check alpha channel
        if (x < firstCol) firstCol = x;
        if (x > lastCol) lastCol = x;
      }
    }
  }

  if (firstCol > lastCol) return null;
  return { left: firstCol - 100, right: lastCol - 100 };
}

const RADIUS = 2.0;

const RealisticMoon = ({ onClick }: { onClick?: () => void }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const colorMap = useTexture(
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg',
  );

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.05;
  });

  return (
    <mesh
      ref={meshRef}
      castShadow
      receiveShadow
      onClick={onClick}
      onPointerOver={() => {
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      <sphereGeometry args={[RADIUS, 64, 64]} />
      <meshStandardMaterial
        map={colorMap}
        bumpMap={colorMap}
        bumpScale={0.02}
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  );
};

const particlesCount = 60000;
const [ringPositions, ringColors, ringRandoms] = (() => {
  const pos = new Float32Array(particlesCount * 3);
  const col = new Float32Array(particlesCount * 3);
  const rnd = new Float32Array(particlesCount);

  for (let i = 0; i < particlesCount; i++) {
    const angle = Math.random() * Math.PI * 2;

    const rDist = Math.pow(Math.random(), 1.5);
    const radius = 2.2 + rDist * 2.2;

    const thickness = 0.4 - rDist * 0.2;
    const ySpread = Math.random() + Math.random() + Math.random() - 1.5;
    const y = ySpread * thickness;

    pos[i * 3] = Math.cos(angle) * radius;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = Math.sin(angle) * radius;

    const intensity = 1.0 - rDist;

    const paletteType = Math.random();
    let baseR, baseG, baseB;

    if (paletteType < 0.8) {
      baseR = 0.545;
      baseG = 0.596;
      baseB = 0.596;
    } else if (paletteType < 0.92) {
      baseR = 0.788;
      baseG = 0.694;
      baseB = 0.529;
    } else {
      baseR = 0.498;
      baseG = 0.658;
      baseB = 0.541;
    }

    baseR = Math.min(1.0, Math.max(0.0, baseR + (Math.random() - 0.5) * 0.1));
    baseG = Math.min(1.0, Math.max(0.0, baseG + (Math.random() - 0.5) * 0.1));
    baseB = Math.min(1.0, Math.max(0.0, baseB + (Math.random() - 0.5) * 0.1));

    const sparkle = Math.random() > 0.95 ? 2.5 : 1.0;

    col[i * 3] = baseR * intensity * sparkle;
    col[i * 3 + 1] = baseG * intensity * sparkle;
    col[i * 3 + 2] = baseB * intensity * sparkle;
    rnd[i] = Math.random();
  }
  return [pos, col, rnd];
})();

const ParticleRing = ({
  ringState,
  massiveAsteroidsRef,
}: {
  ringState: 'hidden' | 'animating' | 'visible';
  massiveAsteroidsRef: React.MutableRefObject<Float32Array>;
}) => {
  const pointsRef = useRef<THREE.Points>(null);

  const uniforms = useRef({
    uProgress: { value: ringState === 'visible' ? 1.0 : 0.0 },
    uAsteroids: { value: new Float32Array(75 * 4) },
    time: { value: 0 },
  });

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y -= delta * 0.02;
      pointsRef.current.updateMatrix();

      const invMat = new THREE.Matrix4().copy(pointsRef.current.matrix).invert();
      const localAsteroids = new Float32Array(75 * 4);
      for (let i = 0; i < 75; i++) {
        const ast = new THREE.Vector3(
          massiveAsteroidsRef.current[i * 4] ?? 0,
          massiveAsteroidsRef.current[i * 4 + 1] ?? 0,
          massiveAsteroidsRef.current[i * 4 + 2] ?? 0,
        );
        ast.applyMatrix4(invMat);
        localAsteroids[i * 4] = ast.x;
        localAsteroids[i * 4 + 1] = ast.y;
        localAsteroids[i * 4 + 2] = ast.z;
        localAsteroids[i * 4 + 3] = massiveAsteroidsRef.current[i * 4 + 3] ?? 0;
      }
      uniforms.current.uAsteroids.value = localAsteroids;
    }
    uniforms.current.time.value = state.clock.elapsedTime;

    if (ringState === 'animating') {
      uniforms.current.uProgress.value += delta * 0.35;
      if (uniforms.current.uProgress.value > 1.0) uniforms.current.uProgress.value = 1.0;
    } else if (ringState === 'visible') {
      uniforms.current.uProgress.value = 1.0;
    } else {
      uniforms.current.uProgress.value = 0.0;
    }
  });

  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
  const onBeforeCompile = (shader: any) => {
    shader.uniforms.uProgress = uniforms.current.uProgress;
    shader.uniforms.uAsteroids = uniforms.current.uAsteroids;
    shader.uniforms.time = uniforms.current.time;

    shader.vertexShader = `
      uniform float uProgress;
      uniform vec4 uAsteroids[75];
      uniform float time;
      attribute float aRandom;
      varying float vProgress; 
      ${shader.vertexShader}
    `;

    shader.vertexShader = shader.vertexShader.replace(
      `#include <begin_vertex>`,
      `
      vec3 transformed = vec3(position);

      float angle = atan(transformed.x, transformed.z);
      float normalizedAngle = abs(angle) / 3.14159265359;
      float spawnThreshold = 1.0 - normalizedAngle; 

      float progressValue = (uProgress * 1.4) - spawnThreshold;
      float particleProgress = smoothstep(0.0, 0.4, progressValue);
      vProgress = particleProgress;

      transformed.y += sin(angle * 10.0 + time) * 0.05 * aRandom;

      if (uProgress > 0.5) {
        for(int i = 0; i < 75; i++) {
          vec4 astData = uAsteroids[i];
          vec3 delta = transformed - astData.xyz;
          float dist = length(delta);

          float rad = astData.w * 2.0 + 0.15;

          if (dist < rad) {
             float force = pow((rad - dist) / rad, 2.0); 
             transformed += normalize(delta) * force * 0.4;
             transformed.y += force * 0.20 * (aRandom - 0.5);
          }
        }
      }

      float swirl = (1.0 - particleProgress) * 4.0; 
      float s = sin(swirl);
      float c = cos(swirl);
      transformed.xz = mat2(c, -s, s, c) * transformed.xz;

      transformed.y += (1.0 - particleProgress) * (transformed.y >= 0.0 ? 1.0 : -1.0);

      vec3 moonSurface = normalize(transformed) * 2.1;
      transformed = mix(moonSurface, transformed, particleProgress);
      `,
    );

    shader.fragmentShader = `
      varying float vProgress;
      ${shader.fragmentShader}
    `;

    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <color_fragment>`,
      `
      #include <color_fragment>

      diffuseColor.a *= vProgress;
      `,
    );
  };
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */

  return (
    <points ref={pointsRef} rotation={[-Math.PI / 2, 0, 0]}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particlesCount}
          array={ringPositions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={particlesCount}
          array={ringColors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aRandom"
          count={particlesCount}
          array={ringRandoms}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.008}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation={true}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        onBeforeCompile={onBeforeCompile}
      />
    </points>
  );
};

const generateAsteroids = (count: number) => {
  const data = [];
  for (let i = 0; i < count; i++) {
    const baseRadius = 2.8 + Math.random() * 2.0;
    const radialAmplitude = 0.5 + Math.random() * 1.5;
    const radialSpeed = 0.15 + Math.random() * 0.25;
    const phase = Math.random() * Math.PI * 2;

    const angle = Math.random() * Math.PI * 2;
    const zOffset = (Math.random() - 0.5) * 0.8;

    const speed = (0.04 + Math.random() * 0.08) * (Math.random() > 0.5 ? 1 : -1);

    const rotationSpeedX = (Math.random() - 0.5) * 0.05;
    const rotationSpeedY = (Math.random() - 0.5) * 0.05;
    const rotationSpeedZ = (Math.random() - 0.5) * 0.05;

    const scale = 0.02 + Math.pow(Math.random(), 4) * 0.18;

    data.push({
      angle,
      baseRadius,
      radialAmplitude,
      radialSpeed,
      phase,
      zOffset,
      speed,
      rx: Math.random() * Math.PI,
      ry: Math.random() * Math.PI,
      rz: Math.random() * Math.PI,
      rsx: rotationSpeedX,
      rsy: rotationSpeedY,
      rsz: rotationSpeedZ,
      scale,
    });
  }
  data.sort((a, b) => b.scale - a.scale);
  return data;
};

const AsteroidBelt = ({
  ringState,
  massiveAsteroidsRef,
}: {
  ringState: 'hidden' | 'animating' | 'visible';
  massiveAsteroidsRef: React.MutableRefObject<Float32Array>;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const [colorMap, bumpMap] = useTexture([
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg',
  ]);

  const count = 75;
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const [asteroids] = useState(() => generateAsteroids(count));

  const scaleRef = useRef(0);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const targetScale = ringState === 'hidden' ? 0 : 1;
    const lerpSpeed = ringState === 'hidden' ? 5 : 2;
    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, targetScale, delta * lerpSpeed);

    if (scaleRef.current < 0.01) {
      meshRef.current.visible = false;
      return;
    }
    meshRef.current.visible = true;

    asteroids.forEach((ast, i) => {
      ast.angle += ast.speed * delta;

      ast.phase += ast.radialSpeed * delta;
      let currentRadius = ast.baseRadius + Math.sin(ast.phase) * ast.radialAmplitude;

      if (currentRadius < 2.15) {
        const penetration = 2.15 - currentRadius;
        currentRadius = 2.15 + penetration * 0.85;
      }

      const x = Math.cos(ast.angle) * currentRadius;
      const y = Math.sin(ast.angle) * currentRadius;

      massiveAsteroidsRef.current[i * 4] = x;
      massiveAsteroidsRef.current[i * 4 + 1] = y;
      massiveAsteroidsRef.current[i * 4 + 2] = ast.zOffset;
      massiveAsteroidsRef.current[i * 4 + 3] = ast.scale;

      ast.rx += ast.rsx;
      ast.ry += ast.rsy;
      ast.rz += ast.rsz;

      dummy.position.set(x, y, ast.zOffset);
      dummy.rotation.set(ast.rx, ast.ry, ast.rz);
      dummy.scale.setScalar(ast.scale * scaleRef.current);
      dummy.updateMatrix();

      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        map={colorMap}
        bumpMap={bumpMap}
        bumpScale={0.08}
        color="#ffffff"
        roughness={0.7}
        metalness={0.1}
      />
    </instancedMesh>
  );
};

export default function Hero() {
  const [ringState, setRingState] = useState<'hidden' | 'animating' | 'visible'>('hidden');
  const massiveAsteroidsRef = useRef<Float32Array>(new Float32Array(75 * 4));
  const [mounted, setMounted] = useState(false);

  const astraRef = useRef<HTMLSpanElement>(null);
  const netRef = useRef<HTMLSpanElement>(null);
  const [netTransform, setNetTransform] = useState('translateX(0px) scaleX(1)');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const updateScale = () => {
      if (astraRef.current && netRef.current) {
        netRef.current.style.transform = 'translateX(0px) scaleX(1)';

        const aStyle = window.getComputedStyle(astraRef.current);
        const aFont = `${aStyle.fontWeight} ${aStyle.fontSize} ${aStyle.fontFamily}`;

        const nStyle = window.getComputedStyle(netRef.current);
        const nFont = `${nStyle.fontWeight} ${nStyle.fontSize} ${nStyle.fontFamily}`;

        const aInk = measureInkBounds('ASTRA', aFont);
        const nInk = measureInkBounds('NET', nFont);

        if (aInk && nInk) {
          const aWidth = aInk.right - aInk.left;
          const nWidth = nInk.right - nInk.left;

          if (aWidth > 0 && nWidth > 0) {
            const scaleX = aWidth / nWidth;
            const translateX = aInk.left - nInk.left * scaleX;
            setNetTransform(`translateX(${translateX}px) scaleX(${scaleX})`);
          }
        }
      }
    };

    if (document.fonts) {
      void document.fonts.ready.then(updateScale).catch(() => {});
    } else {
      updateScale();
    }

    const observer = new ResizeObserver(() => {
      updateScale();
    });

    if (astraRef.current) {
      observer.observe(astraRef.current);
    }
    if (netRef.current) {
      observer.observe(netRef.current);
    }

    window.addEventListener('resize', updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, []);

  return (
    <section className="relative w-full min-h-[100vh] md:min-h-0 md:h-[700px] bg-[#000000] overflow-hidden flex items-center justify-center">
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 w-full h-full z-0 pointer-events-auto cursor-grab active:cursor-grabbing">
        {mounted && (
          <Canvas shadows camera={{ position: [0, 4, 10], fov: 45 }} dpr={[1, 2]}>
            <Environment preset="city" />

            <ambientLight intensity={0.02} />
            <directionalLight
              position={[8, 5, 5]}
              intensity={1.5}
              color="#eef1f1"
              castShadow
              shadow-mapSize={[2048, 2048]}
            />
            <directionalLight position={[-5, -3, -5]} intensity={0.15} color="#8b9898" />

            <OrbitControls enableZoom={false} enablePan={false} autoRotate={false} />

            <group rotation={[Math.PI / 8, 0, 0]} position={[5, 0, 0]}>
              <Suspense fallback={null}>
                <RealisticMoon
                  onClick={() => {
                    if (ringState === 'hidden') setRingState('animating');
                  }}
                />
                <ParticleRing ringState={ringState} massiveAsteroidsRef={massiveAsteroidsRef} />
                <AsteroidBelt ringState={ringState} massiveAsteroidsRef={massiveAsteroidsRef} />
              </Suspense>
            </group>
          </Canvas>
        )}
      </div>

      {/* Gradient overlay to smoothly blend with the dark page content below */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[var(--surface)] to-transparent z-10 pointer-events-none" />

      {/* Text / Foreground Layer */}
      <div className="relative z-20 w-full max-w-[1200px] mx-auto px-8 flex items-center h-full pointer-events-none mt-12">
        <div className="flex flex-col w-full md:w-[50%] lg:w-[45%] pt-12 md:pt-0">
          <motion.h1
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1.5, ease: 'easeOut', delay: 0.2 }}
            className="text-sky-100 uppercase flex flex-col items-start text-left m-0 p-0"
            style={{
              fontFamily: "'Zen Dots', cursive",
              textShadow: '0 10px 40px rgba(0,0,0,0.8), 0 2px 10px rgba(0,0,0,0.9)',
            }}
          >
            <span
              ref={astraRef}
              className="inline-block m-0 p-0 text-[3.6rem] md:text-[6rem] lg:text-[7.2rem] leading-[0.85] tracking-normal text-sky-200"
            >
              ASTRA
            </span>
            <span
              ref={netRef}
              className="inline-block m-0 p-0 text-[6.2rem] md:text-[10.3rem] lg:text-[12.4rem] leading-[0.75] tracking-normal"
              style={{ transformOrigin: 'left', transform: netTransform }}
            >
              NET
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, ease: 'easeOut', delay: 1.0 }}
            className="mt-6 text-xl md:text-2xl font-sans font-medium text-brass-300 max-w-lg md:max-w-xl leading-snug"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}
          >
            What's overhead right now, from satellites to space weather to near-Earth objects, live
            and tuned to your location.
          </motion.p>
        </div>
      </div>
    </section>
  );
}
