import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface HeroShieldCanvasProps {
  className?: string;
  isPulsing?: boolean;
  onShieldClick?: () => void;
}

export const HeroShieldCanvas: React.FC<HeroShieldCanvasProps> = ({
  className = '',
  isPulsing = false,
  onShieldClick,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webGLSupported, setWebGLSupported] = useState(true);
  const pulseTriggerRef = useRef(isPulsing);

  useEffect(() => {
    pulseTriggerRef.current = isPulsing;
  }, [isPulsing]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. WebGL Support Detection
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setWebGLSupported(false);
        return;
      }
    } catch {
      setWebGLSupported(false);
      return;
    }

    // 2. Reduced Motion Detection
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 3. Scene, Camera, Renderer Setup
    const width = container.clientWidth || 480;
    const height = container.clientHeight || 480;

    const scene = new THREE.Scene();
    // Camera positioned with ample vertical and horizontal field of view to prevent any clipping of rings
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 9.8);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;

    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.pointerEvents = 'auto';

    container.appendChild(renderer.domElement);

    // Root shield group for mouse parallax and 3D rotation
    const shieldGroup = new THREE.Group();
    scene.add(shieldGroup);

    // 4. Construct Contoured 3D Shield Geometry with Deep Bevels
    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(-1.65, 1.95);
    shieldShape.lineTo(-0.25, 2.12);
    shieldShape.lineTo(0, 2.0);
    shieldShape.lineTo(0.25, 2.12);
    shieldShape.lineTo(1.65, 1.95);
    shieldShape.bezierCurveTo(1.85, 0.65, 1.45, -0.65, 0, -2.35);
    shieldShape.bezierCurveTo(-1.45, -0.65, -1.85, 0.65, -1.65, 1.95);

    const extrudeSettings = {
      depth: 0.42,
      bevelEnabled: true,
      bevelSegments: 5,
      steps: 1,
      bevelSize: 0.15,
      bevelThickness: 0.15,
    };

    const shieldGeometry = new THREE.ExtrudeGeometry(shieldShape, extrudeSettings);
    shieldGeometry.center();

    // 4a. Outer Titanium/Cyan Metallic Shell
    const outerMaterial = new THREE.MeshStandardMaterial({
      color: 0x081e3d,
      emissive: 0x00c8f8,
      emissiveIntensity: 0.38,
      roughness: 0.22,
      metalness: 0.85,
      transparent: true,
      opacity: 0.94,
    });
    const outerShield = new THREE.Mesh(shieldGeometry, outerMaterial);
    shieldGroup.add(outerShield);

    // 4b. Vivid Cyan Edge Outline
    const edgesGeometry = new THREE.EdgesGeometry(shieldGeometry, 20);
    const edgesMaterial = new THREE.LineBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 1.0,
    });
    const edgeLines = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    shieldGroup.add(edgeLines);

    // 4c. Inner Shield Plate (Hexagonal Protective Core)
    const innerShape = new THREE.Shape();
    innerShape.moveTo(-1.15, 1.4);
    innerShape.lineTo(0, 1.55);
    innerShape.lineTo(1.15, 1.4);
    innerShape.bezierCurveTo(1.25, 0.35, 1.0, -0.45, 0, -1.6);
    innerShape.bezierCurveTo(-1.0, -0.45, -1.25, 0.35, -1.15, 1.4);

    const innerGeometry = new THREE.ShapeGeometry(innerShape);
    innerGeometry.center();
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0x002c66,
      transparent: true,
      opacity: 0.65,
      wireframe: true,
    });
    const innerMesh = new THREE.Mesh(innerGeometry, innerMaterial);
    innerMesh.position.z = 0.28;
    shieldGroup.add(innerMesh);

    // 4d. Central Holographic Core Crystal (Faceted Diamond)
    const chevronGeo = new THREE.OctahedronGeometry(0.52, 0);
    const chevronMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      wireframe: true,
      transparent: true,
      opacity: 0.95,
    });
    const chevronMesh = new THREE.Mesh(chevronGeo, chevronMat);
    chevronMesh.position.z = 0.45;
    shieldGroup.add(chevronMesh);

    // 5. Dual Concentric Orbital Rings
    const ringGeo1 = new THREE.TorusGeometry(3.0, 0.022, 16, 100);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.65,
    });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ring1.rotation.x = Math.PI / 3;
    ring1.rotation.y = Math.PI / 6;
    scene.add(ring1);

    // Satellite Beacon on Ring 1
    const beaconGeo1 = new THREE.SphereGeometry(0.08, 16, 16);
    const beaconMat1 = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
    const beacon1 = new THREE.Mesh(beaconGeo1, beaconMat1);
    ring1.add(beacon1);

    const ringGeo2 = new THREE.TorusGeometry(3.4, 0.018, 16, 100);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.55,
    });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.x = -Math.PI / 3.5;
    ring2.rotation.y = -Math.PI / 5;
    scene.add(ring2);

    // Satellite Beacon on Ring 2
    const beaconGeo2 = new THREE.SphereGeometry(0.07, 16, 16);
    const beaconMat2 = new THREE.MeshBasicMaterial({ color: 0xec4899 });
    const beacon2 = new THREE.Mesh(beaconGeo2, beaconMat2);
    ring2.add(beacon2);

    // 6. Laser Scanner Traversal Beam
    const scanLineGeo = new THREE.CylinderGeometry(0.018, 0.018, 4.8, 16);
    const scanLineMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.75,
    });
    const scanLine = new THREE.Mesh(scanLineGeo, scanLineMat);
    scanLine.rotation.z = Math.PI / 2;
    scanLine.position.z = 0.5;
    shieldGroup.add(scanLine);

    // 7. Interactive Pulse Expansion Ring
    const pulseRingGeo = new THREE.RingGeometry(0.3, 0.38, 48);
    const pulseRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    const pulseRing = new THREE.Mesh(pulseRingGeo, pulseRingMat);
    pulseRing.position.z = 0.55;
    shieldGroup.add(pulseRing);

    let pulseActive = false;
    let pulseScale = 0.5;

    // 8. Energy Particle Field (Ambient Defense Motes)
    const ambientCount = 75;
    const ambientPositions = new Float32Array(ambientCount * 3);
    const ambientVel = new Float32Array(ambientCount * 3);

    for (let i = 0; i < ambientCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const rad = 2.4 + Math.random() * 2.4;

      ambientPositions[i * 3] = rad * Math.sin(phi) * Math.cos(theta);
      ambientPositions[i * 3 + 1] = rad * Math.sin(phi) * Math.sin(theta);
      ambientPositions[i * 3 + 2] = rad * Math.cos(phi);

      ambientVel[i * 3] = (Math.random() - 0.5) * 0.007;
      ambientVel[i * 3 + 1] = (Math.random() - 0.5) * 0.007;
      ambientVel[i * 3 + 2] = (Math.random() - 0.5) * 0.007;
    }

    const ambientGeo = new THREE.BufferGeometry();
    ambientGeo.setAttribute('position', new THREE.BufferAttribute(ambientPositions, 3));
    const ambientMat = new THREE.PointsMaterial({
      color: 0x00f2fe,
      size: 0.065,
      transparent: true,
      opacity: 0.85,
    });
    const ambientPoints = new THREE.Points(ambientGeo, ambientMat);
    scene.add(ambientPoints);

    // 9. Cyber Threat Deflection Particles (Red/Crimson projectiles deflected upon impact)
    const threatCount = 18;
    const threatPositions = new Float32Array(threatCount * 3);
    const threatMeta = new Float32Array(threatCount * 4); // [speed, initialX, initialY, state: 0=approaching, 1=deflecting]

    const resetThreat = (i: number) => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 3.6 + Math.random() * 1.2;
      threatPositions[i * 3] = Math.cos(angle) * dist;
      threatPositions[i * 3 + 1] = Math.sin(angle) * dist;
      threatPositions[i * 3 + 2] = (Math.random() - 0.5) * 1.5;

      threatMeta[i * 4] = 0.025 + Math.random() * 0.025; // Speed
      threatMeta[i * 4 + 1] = threatPositions[i * 3];
      threatMeta[i * 4 + 2] = threatPositions[i * 3 + 1];
      threatMeta[i * 4 + 3] = 0; // 0 = approaching
    };

    for (let i = 0; i < threatCount; i++) {
      resetThreat(i);
    }

    const threatGeo = new THREE.BufferGeometry();
    threatGeo.setAttribute('position', new THREE.BufferAttribute(threatPositions, 3));
    const threatMat = new THREE.PointsMaterial({
      color: 0xff3366,
      size: 0.08,
      transparent: true,
      opacity: 0.9,
    });
    const threatPoints = new THREE.Points(threatGeo, threatMat);
    scene.add(threatPoints);

    // 10. Lighting Infrastructure
    const ambientLight = new THREE.AmbientLight(0x061226, 1.8);
    scene.add(ambientLight);

    const dirLightFront = new THREE.DirectionalLight(0x00f2fe, 3.2);
    dirLightFront.position.set(5, 4, 6);
    scene.add(dirLightFront);

    const dirLightSide = new THREE.DirectionalLight(0xa855f7, 2.8);
    dirLightSide.position.set(-5, -2, 4);
    scene.add(dirLightSide);

    // Core pulsing point light
    const pointLightCore = new THREE.PointLight(0x00f2fe, 3.5, 9);
    pointLightCore.position.set(0, 0, 1.6);
    scene.add(pointLightCore);

    // 11. Mouse Movement Parallax
    let targetRotationX = 0;
    let targetRotationY = 0;
    let currentRotationX = 0;
    let currentRotationY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      const normX = x / (rect.width / 2);
      const normY = y / (rect.height / 2);

      if (!prefersReducedMotion) {
        targetRotationY = normX * 0.35;
        targetRotationX = -normY * 0.25;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    // 12. Trigger Pulse Action
    const triggerPulse = () => {
      pulseActive = true;
      pulseScale = 0.5;
      pulseRingMat.opacity = 1.0;
      pointLightCore.intensity = 7.0;
    };

    // 13. Visibility Management
    let isTabVisible = !document.hidden;
    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 14. Main Animation Loop
    let animationFrameId: number;
    const startTime = performance.now();
    let lastTime = startTime;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (!isTabVisible) return;

      const currentTime = performance.now();
      const elapsedTime = (currentTime - startTime) * 0.001;
      const delta = Math.min((currentTime - lastTime) * 0.001, 0.1);
      lastTime = currentTime;

      // Check external trigger
      if (pulseTriggerRef.current && !pulseActive) {
        triggerPulse();
      }

      if (!prefersReducedMotion) {
        // Smooth lerped mouse parallax
        currentRotationX += (targetRotationX - currentRotationX) * 0.06;
        currentRotationY += (targetRotationY - currentRotationY) * 0.06;

        // Continuous multi-axis rotation
        const baseTurn = Math.sin(elapsedTime * 0.6) * 0.52;
        shieldGroup.rotation.y = baseTurn + currentRotationY;
        shieldGroup.rotation.x = Math.sin(elapsedTime * 0.8) * 0.09 + currentRotationX;

        // Vertical levitation float
        shieldGroup.position.y = Math.sin(elapsedTime * 1.6) * 0.12;

        // Rotate orbital rings
        ring1.rotation.z += 0.010;
        ring2.rotation.z -= 0.008;

        // Position beacon satellites along ring circumferences
        beacon1.position.set(Math.cos(elapsedTime * 1.5) * 3.0, Math.sin(elapsedTime * 1.5) * 3.0, 0);
        beacon2.position.set(Math.cos(-elapsedTime * 1.2) * 3.4, Math.sin(-elapsedTime * 1.2) * 3.4, 0);

        // Vertical scanning beam traversal
        scanLine.position.y = Math.sin(elapsedTime * 2.2) * 1.8;
        scanLineMat.opacity = 0.45 + Math.sin(elapsedTime * 4.0) * 0.35;

        // Center core diamond spin
        chevronMesh.rotation.y += 0.025;
        chevronMesh.rotation.z = Math.sin(elapsedTime * 2.0) * 0.15;

        // Subtle core light pulse
        if (!pulseActive) {
          pointLightCore.intensity = 3.5 + Math.sin(elapsedTime * 3.0) * 1.2;
        }
      }

      // Handle interactive pulse expansion
      if (pulseActive) {
        pulseScale += delta * 4.8;
        pulseRing.scale.set(pulseScale, pulseScale, 1);
        pulseRingMat.opacity = Math.max(0, 1.0 - (pulseScale - 0.5) / 3.0);
        pointLightCore.intensity = Math.max(3.5, 7.0 - pulseScale);

        if (pulseRingMat.opacity <= 0.02) {
          pulseActive = false;
          pulseRingMat.opacity = 0;
        }
      }

      // Update ambient particles
      const ambPositions = ambientGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < ambientCount; i++) {
        ambPositions[i * 3] += ambientVel[i * 3];
        ambPositions[i * 3 + 1] += ambientVel[i * 3 + 1];
        ambPositions[i * 3 + 2] += ambientVel[i * 3 + 2];

        const d = Math.sqrt(
          ambPositions[i * 3] ** 2 +
          ambPositions[i * 3 + 1] ** 2 +
          ambPositions[i * 3 + 2] ** 2
        );
        if (d > 5.0 || d < 2.0) {
          ambientVel[i * 3] *= -1;
          ambientVel[i * 3 + 1] *= -1;
          ambientVel[i * 3 + 2] *= -1;
        }
      }
      ambientGeo.attributes.position.needsUpdate = true;

      // Update threat particles with visual deflection
      const tPositions = threatGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < threatCount; i++) {
        const speed = threatMeta[i * 4];
        const state = threatMeta[i * 4 + 3];

        if (state === 0) {
          const px = tPositions[i * 3];
          const py = tPositions[i * 3 + 1];
          const pz = tPositions[i * 3 + 2];
          const distToOrigin = Math.sqrt(px * px + py * py + pz * pz);

          if (distToOrigin > 1.95) {
            tPositions[i * 3] -= (px / distToOrigin) * speed;
            tPositions[i * 3 + 1] -= (py / distToOrigin) * speed;
            tPositions[i * 3 + 2] -= (pz / distToOrigin) * speed;
          } else {
            // Deflected - switch state and reverse velocity
            threatMeta[i * 4 + 3] = 1;
            threatMeta[i * 4] = speed * 1.5; // Rebound speed
          }
        } else {
          // Rebound away from shield
          const px = tPositions[i * 3];
          const py = tPositions[i * 3 + 1];
          const pz = tPositions[i * 3 + 2];
          const distToOrigin = Math.sqrt(px * px + py * py + pz * pz);

          if (distToOrigin < 4.2) {
            tPositions[i * 3] += (px / distToOrigin) * threatMeta[i * 4];
            tPositions[i * 3 + 1] += (py / distToOrigin) * threatMeta[i * 4];
            tPositions[i * 3 + 2] += (pz / distToOrigin) * threatMeta[i * 4];
          } else {
            resetThreat(i);
          }
        }
      }
      threatGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    // 15. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        const newHeight = entry.contentRect.height;
        if (newWidth > 0 && newHeight > 0) {
          camera.aspect = newWidth / newHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(newWidth, newHeight);
        }
      }
    });
    resizeObserver.observe(container);

    // 16. Resource Disposal
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      resizeObserver.disconnect();

      shieldGeometry.dispose();
      outerMaterial.dispose();
      edgesGeometry.dispose();
      edgesMaterial.dispose();
      innerGeometry.dispose();
      innerMaterial.dispose();
      chevronGeo.dispose();
      chevronMat.dispose();
      ringGeo1.dispose();
      ringMat1.dispose();
      beaconGeo1.dispose();
      beaconMat1.dispose();
      ringGeo2.dispose();
      ringMat2.dispose();
      beaconGeo2.dispose();
      beaconMat2.dispose();
      scanLineGeo.dispose();
      scanLineMat.dispose();
      pulseRingGeo.dispose();
      pulseRingMat.dispose();
      ambientGeo.dispose();
      ambientMat.dispose();
      threatGeo.dispose();
      threatMat.dispose();

      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      onClick={() => {
        if (onShieldClick) onShieldClick();
      }}
      className={`relative w-full h-full flex items-center justify-center cursor-pointer select-none overflow-hidden ${className}`}
      title="Rakshak Autonomous Threat Shield — Click to pulse"
    >
      {!webGLSupported && (
        <div className="relative w-72 h-80 flex flex-col items-center justify-center rounded-3xl bg-gradient-to-b from-cyan-950/40 via-blue-950/30 to-purple-950/40 border border-cyan-500/40 shadow-[0_0_50px_rgba(0,242,254,0.25)] p-6 text-center animate-pulse">
          <div className="w-32 h-36 border-2 border-cyan-400 rounded-b-[40px] flex items-center justify-center bg-cyan-500/10 shadow-[0_0_30px_rgba(0,242,254,0.4)]">
            <span className="text-4xl font-black text-cyan-300">R</span>
          </div>
          <p className="mt-4 text-xs font-bold text-cyan-400 uppercase tracking-widest">
            Holographic Shield Active
          </p>
          <p className="text-[11px] text-zinc-400 mt-1">DevSecOps Defense Grid Online</p>
        </div>
      )}
    </div>
  );
};
