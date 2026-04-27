import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const SpaceBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const bgCv = canvasRef.current;
    const rdr = new THREE.WebGLRenderer({ canvas: bgCv, antialias: true, alpha: true });
    rdr.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    rdr.setSize(window.innerWidth, window.innerHeight);
    
    const sc = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    cam.position.z = 5;

    // Stars
    const sCnt = 5000;
    const sGeo = new THREE.BufferGeometry();
    const sPos = new Float32Array(sCnt * 3);
    const sSz  = new Float32Array(sCnt);
    for (let i = 0; i < sCnt; i++) {
      sPos[i*3]   = (Math.random() - 0.5) * 280;
      sPos[i*3+1] = (Math.random() - 0.5) * 280;
      sPos[i*3+2] = (Math.random() - 0.5) * 280;
      sSz[i] = Math.random() * 1.7 + 0.3;
    }
    sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    sGeo.setAttribute('size',     new THREE.BufferAttribute(sSz, 1));
    
    const sMat = new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 } },
      vertexShader: `
        attribute float size; uniform float t; varying float vB;
        void main() {
          vB = 0.55 + 0.45 * sin(t * 1.4 + position.x * 7.0 + position.y * 3.5);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (280.0 / -mv.z) * vB;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vB;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(0.90 + vB * 0.08, 0.88, 1.0, (1.0 - d * 2.0) * vB);
        }`,
      transparent: true,
      depthWrite: false
    });
    const starPoints = new THREE.Points(sGeo, sMat);
    sc.add(starPoints);

    // Nebula clouds
    const nebGeo = new THREE.SphereGeometry(60, 6, 6);
    const nebMat = new THREE.MeshBasicMaterial({ color: 0x140828, transparent: true, opacity: 0.22, wireframe: true });
    sc.add(new THREE.Mesh(nebGeo, nebMat));

    const hazeGeo = new THREE.SphereGeometry(30, 6, 6);
    const hazeMat = new THREE.MeshBasicMaterial({ color: 0x2a0c5a, transparent: true, opacity: 0.12, wireframe: false });
    sc.add(new THREE.Mesh(hazeGeo, hazeMat));

    // Meteor class
    class Meteor {
      g: THREE.Group;
      sz: number;
      spd: number;
      x: number = 0;
      y: number = 0;
      z: number = 0;
      a: number = 0;

      constructor(sz: number, spd: number) {
        this.g = new THREE.Group();
        this.sz = sz;
        this.spd = spd;
        this.reset(true);
        
        this.g.add(new THREE.Mesh(
          new THREE.SphereGeometry(0.06 * sz, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        ));
        
        this.g.add(new THREE.Mesh(
          new THREE.SphereGeometry(0.22 * sz, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0x9966cc, transparent: true, opacity: 0.22 })
        ));
        
        const pts = [];
        for (let i = 0; i < 55; i++)
          pts.push(new THREE.Vector3(i * 0.13 * sz, (Math.random() - 0.5) * 0.015 * i * sz, 0));
        
        this.g.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: 0x7766cc, transparent: true, opacity: 0.30 })
        ));
        
        sc.add(this.g);
      }

      reset(init = false) {
        this.x = init ? (Math.random() - 0.5) * 40 : -55;
        this.y = 6 + Math.random() * 22;
        this.z = -28 - Math.random() * 15;
        this.a = -0.3 - Math.random() * 0.22;
      }

      tick(dt: number) {
        this.x += this.spd * Math.cos(this.a) * dt * 60;
        this.y += this.spd * Math.sin(this.a) * dt * 60;
        if (this.x > 65) this.reset();
        this.g.position.set(this.x, this.y, this.z);
        this.g.rotation.z = this.a + Math.PI;
      }
    }

    const mainMeteor = new Meteor(1.3, 0.044);
    const smallMeteors = Array.from({ length: 6 }, () => {
      const m = new Meteor(0.16, 0.2 + Math.random() * 0.28);
      m.x = (Math.random() - 0.5) * 70;
      m.y = 4 + Math.random() * 24;
      return m;
    });

    let prevT = 0;
    let requestRef: number;

    const animate = (ts: number) => {
      requestRef = requestAnimationFrame(animate);
      const dt = Math.min((ts - prevT) / 1000, 0.05);
      prevT = ts;
      
      sMat.uniforms.t.value = ts * 0.001;
      mainMeteor.tick(dt);
      smallMeteors.forEach(m => m.tick(dt));
      
      rdr.render(sc, cam);
    };

    requestRef = requestAnimationFrame(animate);

    const handleResize = () => {
      rdr.setSize(window.innerWidth, window.innerHeight);
      cam.aspect = window.innerWidth / window.innerHeight;
      cam.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(requestRef);
      window.removeEventListener('resize', handleResize);
      // Clean up Three.js resources
      sGeo.dispose();
      sMat.dispose();
      nebGeo.dispose();
      nebMat.dispose();
      hazeGeo.dispose();
      hazeMat.dispose();
      rdr.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none',
      }}
    />
  );
};

export default SpaceBackground;
