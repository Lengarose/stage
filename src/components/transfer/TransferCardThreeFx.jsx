import { useEffect, useRef } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";

/**
 * Lightweight Three.js frame animation for transfer carousel cards.
 * Renders inside each slide — not on the page background.
 */
export default function TransferCardThreeFx({ active = false, className }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const accent = active ? 0xf5c542 : 0x00e5ff;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.z = 3.4;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = "pointer-events-none absolute inset-0 h-full w-full";
    host.appendChild(renderer.domElement);

    const root = new THREE.Group();
    scene.add(root);

    const ringGeo = new THREE.TorusGeometry(0.94, 0.016, 10, 72);
    const ringMat = new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: active ? 0.9 : 0.35,
      metalness: 0.85,
      roughness: 0.22,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI * 0.06;
    root.add(ring);

    const innerRingGeo = new THREE.TorusGeometry(0.78, 0.008, 8, 48);
    const innerRingMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: active ? 0.55 : 0.2,
      metalness: 0.7,
      roughness: 0.35,
      transparent: true,
      opacity: 0.85,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = Math.PI * 0.12;
    innerRing.rotation.y = Math.PI * 0.25;
    root.add(innerRing);

    const scanGeo = new THREE.PlaneGeometry(1.42, 1.92);
    const scanMat = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: active ? 0.1 : 0.04,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const scanPlane = new THREE.Mesh(scanGeo, scanMat);
    scanPlane.position.z = -0.06;
    root.add(scanPlane);

    const cornerGeo = new THREE.BoxGeometry(0.09, 0.09, 0.06);
    const cornerMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: active ? 0.75 : 0.3,
      metalness: 0.9,
      roughness: 0.15,
    });
    const corners = [];
    for (const [x, y] of [[-0.64, 0.88], [0.64, 0.88], [-0.64, -0.88], [0.64, -0.88]]) {
      const corner = new THREE.Mesh(cornerGeo, cornerMat);
      corner.position.set(x, y, 0.06);
      root.add(corner);
      corners.push(corner);
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const keyLight = new THREE.PointLight(accent, active ? 1.5 : 0.55, 10);
    keyLight.position.set(0.4, 0.9, 2.2);
    scene.add(keyLight);

    let raf = 0;
    let pointerX = 0;
    let pointerY = 0;

    function onPointerMove(event) {
      const rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    }

    if (active) {
      const button = host.closest("button");
      if (button) button.addEventListener("pointermove", onPointerMove);
    }

    function resize() {
      const width = host.clientWidth || 200;
      const height = host.clientHeight || 280;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    function tick(now) {
      const pulse = active ? 1 : 0.4;
      if (!prefersReduced) {
        ring.rotation.z += 0.014 * pulse;
        innerRing.rotation.z -= 0.02 * pulse;
        root.position.y = Math.sin(now * 0.0016) * 0.045 * pulse;
        root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, pointerX * 0.12 * pulse, 0.08);
        root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, -pointerY * 0.08 * pulse, 0.08);
        scanPlane.material.opacity = (active ? 0.08 : 0.03) + Math.sin(now * 0.0035) * 0.05 * pulse;
        corners.forEach((corner, index) => {
          corner.rotation.z += 0.018 * (index % 2 === 0 ? 1 : -1) * pulse;
        });
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      if (active) {
        const button = host.closest("button");
        if (button) button.removeEventListener("pointermove", onPointerMove);
      }
      ringGeo.dispose();
      ringMat.dispose();
      innerRingGeo.dispose();
      innerRingMat.dispose();
      scanGeo.dispose();
      scanMat.dispose();
      cornerGeo.dispose();
      cornerMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [active]);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 z-[1] overflow-hidden", className)}
    />
  );
}
