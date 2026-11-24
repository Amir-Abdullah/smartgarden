<template>
  <div
    ref="wrapperRef"
    data-testid="hero-3d-canvas-container"
    class="relative h-[340px] w-full overflow-hidden rounded-2xl border border-zinc-200/80 shadow-lg select-none dark:border-zinc-800 sm:h-[380px]"
  >
    <canvas
      ref="canvasRef"
      data-testid="hero-3d-canvas"
      class="block h-full w-full cursor-grab active:cursor-grabbing"
      aria-label="Interactive 3D SmartGarden cedar raised bed diorama"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
    />

    <!-- Top Overlay Badges -->
    <div class="pointer-events-none absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
      <UBadge color="primary" variant="solid" size="xs" icon="i-lucide-box">
        Interactive 3D Bed Diorama
      </UBadge>
      <UBadge color="neutral" variant="soft" size="xs" class="bg-white/85 backdrop-blur-xs dark:bg-zinc-900/85">
        Drag to Orbit
      </UBadge>
    </div>

    <!-- Bottom Right Lighting & Motion Controls -->
    <div class="absolute right-3 bottom-3 left-3 flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-1 rounded-xl border border-zinc-200/80 bg-white/85 p-1 shadow-xs backdrop-blur-md dark:border-zinc-700/80 dark:bg-zinc-900/85">
        <button
          v-for="mode in lightModes"
          :key="mode.id"
          type="button"
          class="rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors"
          :class="activeLight === mode.id
            ? 'bg-emerald-600 text-white'
            : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'"
          @click="setLighting(mode.id)"
        >
          {{ mode.label }}
        </button>
      </div>

      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-xl border border-zinc-200/80 bg-white/85 px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 shadow-xs backdrop-blur-md transition-colors hover:bg-white dark:border-zinc-700/80 dark:bg-zinc-900/85 dark:text-zinc-200"
        @click="autoRotate = !autoRotate"
      >
        <UIcon :name="autoRotate ? 'i-lucide-pause' : 'i-lucide-play'" class="size-3.5" />
        {{ autoRotate ? 'Pause Spin' : 'Auto Spin' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';

const wrapperRef = ref(null);
const canvasRef = ref(null);
const activeLight = ref('golden');
const autoRotate = ref(true);

const lightModes = [
  { id: 'day', label: 'Daylight' },
  { id: 'golden', label: 'Golden Hour' },
  { id: 'night', label: 'Night Glow' }
];

let renderer = null;
let scene = null;
let camera = null;
let rafId = null;
let resizeObserver = null;
let isFallback2D = false;

let sunLight = null;
let hemiLight = null;
let sensorBeaconMat = null;
let foliageGroups = [];
let pollenPoints = null;

// Orbit state
let theta = 0.68;
let phi = 0.88;
const radius = 8.4;
let dragging = false;
let lastX = 0;
let lastY = 0;

const LIGHT_PRESETS = {
  day: {
    sky: 0xe6f4ea,
    fog: 0xe6f4ea,
    sunColor: 0xfff8e7,
    sunIntensity: 2.1,
    sunPos: [6, 9, 5],
    hemiSky: 0xdff5ff,
    hemiGround: 0x4b3f2f,
    hemiIntensity: 1.05
  },
  golden: {
    sky: 0x1e293b,
    fog: 0x1e293b,
    sunColor: 0xffb347,
    sunIntensity: 2.5,
    sunPos: [-7, 4.5, 5],
    hemiSky: 0xffd59e,
    hemiGround: 0x2a1f18,
    hemiIntensity: 0.95
  },
  night: {
    sky: 0x090f19,
    fog: 0x090f19,
    sunColor: 0x7dd3fc,
    sunIntensity: 1.1,
    sunPos: [4, 8, -4],
    hemiSky: 0x38bdf8,
    hemiGround: 0x0b1220,
    hemiIntensity: 0.65
  }
};

function setLighting(modeId) {
  activeLight.value = modeId;
  const preset = LIGHT_PRESETS[modeId] || LIGHT_PRESETS.golden;
  if (!scene || !sunLight || !hemiLight) return;
  scene.background = new THREE.Color(preset.sky);
  scene.fog = new THREE.FogExp2(preset.fog, 0.045);
  sunLight.color.setHex(preset.sunColor);
  sunLight.intensity = preset.sunIntensity;
  sunLight.position.set(...preset.sunPos);
  hemiLight.color.setHex(preset.hemiSky);
  hemiLight.groundColor.setHex(preset.hemiGround);
  hemiLight.intensity = preset.hemiIntensity;
}

function updateCameraPosition() {
  if (!camera) return;
  const clampedPhi = Math.max(0.45, Math.min(1.25, phi));
  camera.position.set(
    radius * Math.sin(clampedPhi) * Math.sin(theta),
    radius * Math.cos(clampedPhi) + 0.6,
    radius * Math.sin(clampedPhi) * Math.cos(theta)
  );
  camera.lookAt(0, 0.75, 0);
}

function onPointerDown(e) {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
}

function onPointerMove(e) {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  theta -= dx * 0.008;
  phi -= dy * 0.006;
  updateCameraPosition();
}

function onPointerUp() {
  dragging = false;
}

function buildDioramaScene() {
  scene = new THREE.Scene();

  const w = wrapperRef.value?.clientWidth || 640;
  const h = wrapperRef.value?.clientHeight || 360;
  camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
  updateCameraPosition();

  hemiLight = new THREE.HemisphereLight(0xffd59e, 0x2a1f18, 0.95);
  scene.add(hemiLight);

  sunLight = new THREE.DirectionalLight(0xffb347, 2.3);
  sunLight.castShadow = true;
  scene.add(sunLight);

  // Subtle green moss ground plinth
  const ground = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.6, 0.25, 48),
    new THREE.MeshStandardMaterial({ color: 0x1e3a29, roughness: 0.92 })
  );
  ground.position.y = -0.18;
  scene.add(ground);

  // Cedar timber raised bed frame
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x9c5a32, roughness: 0.78 });
  const plankDims = [
    { size: [4.2, 0.85, 0.18], pos: [0, 0.42, 1.45] },
    { size: [4.2, 0.85, 0.18], pos: [0, 0.42, -1.45] },
    { size: [0.18, 0.85, 3.0], pos: [-2.02, 0.42, 0] },
    { size: [0.18, 0.85, 3.0], pos: [2.02, 0.42, 0] }
  ];
  for (const p of plankDims) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...p.size), woodMat);
    m.position.set(...p.pos);
    scene.add(m);
  }

  // Soil volume
  const soil = new THREE.Mesh(
    new THREE.BoxGeometry(3.88, 0.72, 2.74),
    new THREE.MeshStandardMaterial({ color: 0x3b2618, roughness: 0.98 })
  );
  soil.position.set(0, 0.4, 0);
  scene.add(soil);

  // Tomato vines on wooden stakes
  const stakeMat = new THREE.MeshStandardMaterial({ color: 0xc28a56, roughness: 0.85 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x228b47, roughness: 0.7 });
  const fruitMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 });

  for (const x of [-1.15, 0, 1.15]) {
    const plantGroup = new THREE.Group();
    plantGroup.position.set(x, 0.76, -0.52);

    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.0, 8), stakeMat);
    stake.position.y = 0.95;
    plantGroup.add(stake);

    for (let layer = 0; layer < 4; layer++) {
      const y = 0.45 + layer * 0.38;
      const r = 0.42 - layer * 0.05;
      const canopy = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), leafMat);
      canopy.position.set((layer % 2 === 0 ? 1 : -1) * 0.08, y, 0.06);
      plantGroup.add(canopy);

      if (layer > 0) {
        const tomato = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), fruitMat);
        tomato.position.set((layer % 2 === 0 ? -0.22 : 0.22), y - 0.06, 0.24);
        plantGroup.add(tomato);
      }
    }
    scene.add(plantGroup);
    foliageGroups.push(plantGroup);
  }

  // Basil mounds + Marigold borders in front row
  const basilMat = new THREE.MeshStandardMaterial({ color: 0x34d399, roughness: 0.65 });
  const marigoldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });

  for (let i = 0; i < 4; i++) {
    const x = -1.35 + i * 0.9;
    const basil = new THREE.Group();
    basil.position.set(x, 0.76, 0.42);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), basilMat);
    dome.scale.y = 0.78;
    dome.position.y = 0.16;
    basil.add(dome);
    scene.add(basil);
    foliageGroups.push(basil);

    const flower = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.08, 0.12, 10), marigoldMat);
    flower.position.set(x, 0.92, 0.96);
    scene.add(flower);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), leafMat);
    stem.position.set(x, 0.82, 0.96);
    scene.add(stem);
  }

  // IoT Sensor Stake with pulsing LED halo
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.95, 12),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.35 })
  );
  pole.position.set(1.55, 1.1, 0.52);
  scene.add(pole);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.18, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 })
  );
  head.position.set(1.55, 1.56, 0.52);
  scene.add(head);

  sensorBeaconMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
  const beaconRing = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 8, 24), sensorBeaconMat);
  beaconRing.rotation.x = Math.PI / 2;
  beaconRing.position.set(1.55, 0.82, 0.52);
  scene.add(beaconRing);

  // Floating sunlit botanical motes
  const count = 48;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 6;
    positions[i * 3 + 1] = 0.6 + Math.random() * 2.8;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 5;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({ color: 0xfde68a, size: 0.08, transparent: true, opacity: 0.78 });
  pollenPoints = new THREE.Points(pGeo, pMat);
  scene.add(pollenPoints);

  setLighting(activeLight.value);
}

function draw2DFallback(timeSec) {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const isNight = activeLight.value === 'night';
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, isNight ? '#0f172a' : activeLight.value === 'day' ? '#d1fae5' : '#1e293b');
  grad.addColorStop(1, isNight ? '#020617' : '#064e3b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Stylized isometric cedar bed fallback
  const cx = w / 2;
  const cy = h * 0.62;
  ctx.fillStyle = '#92400e';
  ctx.fillRect(cx - 140, cy - 25, 280, 62);
  ctx.fillStyle = '#451a03';
  ctx.fillRect(cx - 130, cy - 35, 260, 22);

  for (let i = -2; i <= 2; i++) {
    const sway = Math.sin(timeSec * 1.5 + i) * 3;
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(cx + i * 50 + sway, cy - 55, 22, 0, Math.PI * 2);
    ctx.fill();
  }
}

function resizeCanvas() {
  const wrap = wrapperRef.value;
  const canvas = canvasRef.value;
  if (!wrap || !canvas) return;
  const w = Math.max(240, wrap.clientWidth);
  const h = Math.max(240, wrap.clientHeight);
  if (isFallback2D) {
    canvas.width = w;
    canvas.height = h;
    return;
  }
  if (renderer && camera) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
}

onMounted(() => {
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) autoRotate.value = false;

  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.value,
      antialias: true,
      powerPreference: 'default'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    buildDioramaScene();
  } catch {
    isFallback2D = true;
  }

  resizeCanvas();
  if (typeof ResizeObserver !== 'undefined' && wrapperRef.value) {
    resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(wrapperRef.value);
  }

  const startMs = performance.now();
  const animate = (nowMs) => {
    const t = (nowMs - startMs) / 1000;
    if (isFallback2D) {
      draw2DFallback(t);
    } else if (renderer && scene && camera) {
      if (autoRotate.value && !dragging) {
        theta += 0.0035;
        updateCameraPosition();
      }
      foliageGroups.forEach((grp, idx) => {
        grp.rotation.z = Math.sin(t * 1.4 + idx) * 0.035;
      });
      if (sensorBeaconMat) {
        const pulse = 0.55 + 0.45 * Math.sin(t * 3.2);
        sensorBeaconMat.color.setRGB(0.06, pulse, 0.55);
      }
      if (pollenPoints) {
        pollenPoints.rotation.y = t * 0.05;
      }
      renderer.render(scene, camera);
    }
    rafId = requestAnimationFrame(animate);
  };
  rafId = requestAnimationFrame(animate);
});

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId);
  if (resizeObserver) resizeObserver.disconnect();
  if (scene) {
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }
  if (renderer) renderer.dispose();
});
</script>
