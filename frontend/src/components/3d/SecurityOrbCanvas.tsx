import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface SecurityOrbCanvasProps {
  className?: string;
  isHealthy?: boolean;
}

export const SecurityOrbCanvas: React.FC<SecurityOrbCanvasProps> = ({
  className = '',
  isHealthy = true,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webGLSupported, setWebGLSupported] = useState(true);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. WebGL Support Check
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

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 2. Setup Three.js
    const width = container.clientWidth || 140;
    const height = container.clientHeight || 140;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50);
    camera.position.set(0, 0, 4.5);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Explicit sizing for layout safety
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    container.appendChild(renderer.domElement);

    const orbGroup = new THREE.Group();
    scene.add(orbGroup);

    // Color definitions
    const primaryColor = isHealthy ? 0x00f2fe : 0xf59e0b;
    const coreColor = isHealthy ? 0x10b981 : 0xef4444;

    // 3. Faceted Outer Holographic Icosahedron Cage
    const cageGeo = new THREE.IcosahedronGeometry(1.25, 1);
    const cageMat = new THREE.MeshBasicMaterial({
      color: primaryColor,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
    });
    const cageMesh = new THREE.Mesh(cageGeo, cageMat);
    orbGroup.add(cageMesh);

    // 3b. Semi-translucent inner crystal faces
    const crystalGeo = new THREE.IcosahedronGeometry(1.18, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x061838,
      emissive: primaryColor,
      emissiveIntensity: 0.35,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: 0.5,
    });
    const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
    orbGroup.add(crystalMesh);

    // 4. Glowing Internal Energy Core
    const coreGeo = new THREE.SphereGeometry(0.68, 20, 20);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x051329,
      emissive: coreColor,
      emissiveIntensity: 0.85,
      roughness: 0.15,
      metalness: 0.6,
      transparent: true,
      opacity: 0.9,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    orbGroup.add(coreMesh);

    // 5. Dual Orbital Rings
    // Ring 1 (tilted forward)
    const ringGeo1 = new THREE.TorusGeometry(1.68, 0.02, 12, 64);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: primaryColor,
      transparent: true,
      opacity: 0.75,
    });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ring1.rotation.x = Math.PI / 3;
    orbGroup.add(ring1);

    // Data beacon node on Ring 1
    const beaconGeo1 = new THREE.SphereGeometry(0.09, 10, 10);
    const beaconMat1 = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const beacon1 = new THREE.Mesh(beaconGeo1, beaconMat1);
    ring1.add(beacon1);

    // Ring 2 (tilted counter)
    const ringGeo2 = new THREE.TorusGeometry(1.85, 0.015, 12, 64);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: isHealthy ? 0xa855f7 : 0xf97316,
      transparent: true,
      opacity: 0.5,
    });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.x = -Math.PI / 3.5;
    ring2.rotation.y = Math.PI / 4;
    orbGroup.add(ring2);

    // Data beacon node on Ring 2
    const beaconGeo2 = new THREE.SphereGeometry(0.07, 10, 10);
    const beaconMat2 = new THREE.MeshBasicMaterial({ color: primaryColor });
    const beacon2 = new THREE.Mesh(beaconGeo2, beaconMat2);
    ring2.add(beacon2);

    // 6. Lighting
    const ambLight = new THREE.AmbientLight(0x0e244d, 2.5);
    scene.add(ambLight);

    const dirLight1 = new THREE.DirectionalLight(primaryColor, 3.0);
    dirLight1.position.set(2, 3, 4);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xa855f7, 2.0);
    dirLight2.position.set(-3, -2, 2);
    scene.add(dirLight2);

    const coreLight = new THREE.PointLight(coreColor, 3.0, 5);
    coreLight.position.set(0, 0, 0);
    scene.add(coreLight);

    // 7. Interactive Hover Acceleration
    let speedMultiplier = 1.0;
    const handleMouseEnter = () => {
      speedMultiplier = 2.4;
    };
    const handleMouseLeave = () => {
      speedMultiplier = 1.0;
    };
    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);

    // 8. Visibility Checking
    let isVisible = !document.hidden;
    const handleVisibility = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // 9. Animation Loop
    let animationId: number;
    const startTime = performance.now();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (!isVisible) return;

      const elapsedTime = (performance.now() - startTime) * 0.001;

      if (!prefersReducedMotion) {
        // Continuous dual-axis 3D rotation
        orbGroup.rotation.y += 0.015 * speedMultiplier;
        orbGroup.rotation.x += 0.008 * speedMultiplier;

        // Satellite beacons orbiting along rings
        beacon1.position.set(
          Math.cos(elapsedTime * 1.8 * speedMultiplier) * 1.68,
          Math.sin(elapsedTime * 1.8 * speedMultiplier) * 1.68,
          0
        );
        beacon2.position.set(
          Math.cos(-elapsedTime * 1.4 * speedMultiplier) * 1.85,
          Math.sin(-elapsedTime * 1.4 * speedMultiplier) * 1.85,
          0
        );

        // Core pulsating glow
        const pulse = Math.sin(elapsedTime * 3.0) * 0.15 + 0.85;
        coreMesh.scale.set(pulse, pulse, pulse);
        coreMat.emissiveIntensity = 0.7 + Math.sin(elapsedTime * 4.0) * 0.3;
      }

      renderer.render(scene, camera);
    };

    animate();

    // 10. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    // 11. Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('visibilitychange', handleVisibility);
      resizeObserver.disconnect();

      cageGeo.dispose();
      cageMat.dispose();
      crystalGeo.dispose();
      crystalMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      ringGeo1.dispose();
      ringMat1.dispose();
      beaconGeo1.dispose();
      beaconMat1.dispose();
      ringGeo2.dispose();
      ringMat2.dispose();
      beaconGeo2.dispose();
      beaconMat2.dispose();
      renderer.dispose();

      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isHealthy]);

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-full min-w-[80px] min-h-[80px] flex items-center justify-center select-none ${className}`}
      title="Rakshak Autonomous Security Core"
    >
      {!webGLSupported && (
        <div className="w-16 h-16 rounded-full border-2 border-cyan-400 flex items-center justify-center bg-cyan-500/10 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-cyan-400/40" />
        </div>
      )}
    </div>
  );
};
