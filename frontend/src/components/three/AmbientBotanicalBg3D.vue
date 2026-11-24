<template>
  <canvas
    ref="canvasRef"
    class="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-35 dark:opacity-25"
    aria-hidden="true"
  />
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';

const canvasRef = ref(null);
let renderer = null;
let scene = null;
let camera = null;
let points = null;
let rafId = null;

function handleResize() {
  if (!renderer || !camera) return;
  const w = window.innerWidth || 1280;
  const h = window.innerHeight || 720;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

onMounted(() => {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value, alpha: true, antialias: false });
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, (window.innerWidth || 1280) / (window.innerHeight || 720), 0.1, 100);
    camera.position.z = 8;

    const count = 42;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x10b981, size: 0.12, transparent: true, opacity: 0.55 });
    points = new THREE.Points(geo, mat);
    scene.add(points);

    handleResize();
    window.addEventListener('resize', handleResize);

    const start = performance.now();
    const tick = (now) => {
      const t = (now - start) / 1000;
      if (points) {
        points.rotation.y = t * 0.04;
        points.position.y = Math.sin(t * 0.4) * 0.25;
      }
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  } catch {
    // Graceful no-op in WebGL-less environments
  }
});

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId);
  if (typeof window !== 'undefined') window.removeEventListener('resize', handleResize);
  if (scene) {
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  }
  if (renderer) renderer.dispose();
});
</script>
