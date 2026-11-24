<template>
  <div class="space-y-3" data-testid="garden-plot-3d-wrapper">
    <!-- Controls Toolbar -->
    <div v-if="!compact" class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <UBadge color="primary" variant="soft" size="xs" icon="i-lucide-box">
          3D Garden Twin &bull; {{ gardenName || 'Workspace' }}
        </UBadge>
        <UBadge color="neutral" variant="outline" size="xs">
          {{ zones.length }} {{ zones.length === 1 ? 'Zone' : 'Zones' }} Mapped
        </UBadge>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <UIcon name="i-lucide-sun" class="size-3.5 text-amber-500" />
          <span>Sun Hour: {{ sunHour }}:00</span>
          <input
            v-model.number="sunHour"
            type="range"
            min="6"
            max="22"
            step="1"
            class="h-1.5 w-24 accent-emerald-600"
          />
        </label>

        <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-zoom-in" @click="zoomBy(-1.4)">
          Zoom In
        </UButton>
        <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-zoom-out" @click="zoomBy(1.4)">
          Zoom Out
        </UButton>
      </div>
    </div>

    <!-- Interactive 3D Viewport -->
    <div
      ref="containerRef"
      :class="[
        'relative w-full overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 select-none',
        compact ? 'h-56' : 'h-[400px]'
      ]"
    >
      <canvas
        ref="canvasRef"
        data-testid="garden-plot-3d-canvas"
        class="block h-full w-full cursor-grab active:cursor-grabbing"
        aria-label="Interactive 3D digital twin of garden microclimate zones"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointerleave="onPointerUp"
      />

      <!-- Floating HUD for Selected Zone -->
      <div
        v-if="selectedZone"
        class="absolute bottom-3 left-3 max-w-xs rounded-xl border border-zinc-200/80 bg-white/90 p-3 text-xs shadow-md backdrop-blur-md dark:border-zinc-700/80 dark:bg-zinc-900/90"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="font-bold text-zinc-900 dark:text-white">{{ selectedZone.name }}</span>
          <UBadge color="primary" variant="soft" size="xs">{{ selectedZone.zone_type }}</UBadge>
        </div>
        <p class="mt-1 text-zinc-600 dark:text-zinc-300">
          Soil: {{ selectedZone.soil_type }} &bull; Sun: {{ selectedZone.sunlight_level }} &bull; {{ selectedZone.area_sq_m }} m²
        </p>
        <p v-if="readingFor(selectedZone.id)" class="mt-1 font-medium text-emerald-700 dark:text-emerald-400">
          Moisture: {{ Number(readingFor(selectedZone.id).soil_moisture).toFixed(1) }}% &bull;
          Temp: {{ Number(readingFor(selectedZone.id).temperature).toFixed(1) }}°C
        </p>
      </div>

      <!-- Quick Zone Chips -->
      <div
        v-if="zones.length > 0 && !compact"
        class="absolute top-3 left-3 flex flex-wrap gap-1.5"
      >
        <button
          v-for="z in zones"
          :key="z.id"
          type="button"
          class="rounded-lg border px-2 py-1 text-[11px] font-medium backdrop-blur-md transition-colors"
          :class="selectedZone?.id === z.id
            ? 'border-emerald-500 bg-emerald-600 text-white'
            : 'border-zinc-200/80 bg-white/85 text-zinc-700 hover:bg-white dark:border-zinc-700/80 dark:bg-zinc-900/85 dark:text-zinc-200'"
          @click="focusZone(z)"
        >
          {{ z.name }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';

const props = defineProps({
  zones: { type: Array, default: () => [] },
  latestReadingsByZone: { type: Object, default: () => ({}) },
  gardenName: { type: String, default: '' },
  compact: { type: Boolean, default: false }
});

const emit = defineEmits(['select-zone']);

const containerRef = ref(null);
const canvasRef = ref(null);
const sunHour = ref(15);
const selectedZone = ref(null);

let renderer = null;
let scene = null;
let camera = null;
let sunLight = null;
let hemiLight = null;
let zonesRoot = null;
let rafId = null;
let resizeObserver = null;
let isFallback2D = false;

const raycaster = new THREE.Raycaster();
const zoneMeshes = [];
const haloRings = [];

let theta = 0.58;
let phi = 0.86;
let radius = 12.5;
let dragging = false;
let dragMoved = false;
let downX = 0;
let downY = 0;

function readingFor(zoneId) {
  return props.latestReadingsByZone?.[Number(zoneId)] || null;
}

function soilHexForType(soil) {
  if (soil === 'SANDY') return 0xb48a5a;
  if (soil === 'CLAY') return 0x8b4528;
  if (soil === 'PEAT') return 0x2f241c;
  if (soil === 'CHALKY') return 0x9e9585;
  return 0x4b3322; // LOAM / SILT
}

function zoomBy(delta) {
  radius = Math.max(6.5, Math.min(22, radius + delta));
  updateCamera();
}

function focusZone(z) {
  selectedZone.value = z;
  emit('select-zone', z);
}

function updateCamera() {
  if (!camera) return;
  const cPhi = Math.max(0.4, Math.min(1.3, phi));
  camera.position.set(
    radius * Math.sin(cPhi) * Math.sin(theta),
    radius * Math.cos(cPhi) + 0.5,
    radius * Math.sin(cPhi) * Math.cos(theta)
  );
  camera.lookAt(0, 0.4, 0);
}

function applySunHourLighting() {
  if (!scene || !sunLight || !hemiLight) return;
  const h = sunHour.value;
  const normalized = (h - 6) / 16; // 0 (6am) -> 1 (10pm)
  const isNight = h >= 20 || h <= 6;
  const isGolden = (h >= 17 && h < 20) || (h > 6 && h <= 8);

  if (isNight) {
    scene.background = new THREE.Color(0x0b1220);
    sunLight.color.setHex(0x93c5fd);
    sunLight.intensity = 0.9;
    hemiLight.intensity = 0.55;
  } else if (isGolden) {
    scene.background = new THREE.Color(0x272030);
    sunLight.color.setHex(0xfbbf24);
    sunLight.intensity = 2.2;
    hemiLight.intensity = 0.95;
  } else {
    scene.background = new THREE.Color(0xeaf7ef);
    sunLight.color.setHex(0xfffbeb);
    sunLight.intensity = 2.1;
    hemiLight.intensity = 1.15;
  }

  const angle = normalized * Math.PI;
  sunLight.position.set(Math.cos(angle) * 10, Math.max(2, Math.sin(angle) * 11), 6);
}

function rebuildZonesGeometry() {
  if (!scene) return;
  if (zonesRoot) {
    zonesRoot.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    scene.remove(zonesRoot);
  }
  zoneMeshes.length = 0;
  haloRings.length = 0;

  zonesRoot = new THREE.Group();
  const list = props.zones || [];
  const cols = Math.max(1, Math.min(3, Math.ceil(Math.sqrt(list.length || 1))));
  const spacing = 4.2;

  list.forEach((z, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const totalRows = Math.ceil(list.length / cols);
    const px = (col - (cols - 1) / 2) * spacing;
    const pz = (row - (totalRows - 1) / 2) * spacing;

    const grp = new THREE.Group();
    grp.position.set(px, 0, pz);

    const scale = Math.max(0.8, Math.min(1.35, Math.sqrt(Number(z.area_sq_m || 4)) / 2.2));
    const width = 2.8 * scale;
    const depth = 2.2 * scale;

    if (z.zone_type === 'GREENHOUSE') {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(width, 1.4, depth),
        new THREE.MeshStandardMaterial({ color: 0xa7f3d0, transparent: true, opacity: 0.28, roughness: 0.15 })
      );
      box.position.y = 0.72;
      box.userData = { zone: z };
      grp.add(box);
      zoneMeshes.push(box);

      const soil = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.88, 0.28, depth * 0.88),
        new THREE.MeshStandardMaterial({ color: soilHexForType(z.soil_type), roughness: 0.9 })
      );
      soil.position.y = 0.16;
      grp.add(soil);
    } else if (z.zone_type === 'HYDROPONIC') {
      const tray = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.35, depth * 0.75),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.25, metalness: 0.35 })
      );
      tray.position.y = 0.24;
      tray.userData = { zone: z };
      grp.add(tray);
      zoneMeshes.push(tray);
    } else if (z.zone_type === 'INDOOR_POTS') {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.1, depth),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8 })
      );
      base.position.y = 0.05;
      base.userData = { zone: z };
      grp.add(base);
      zoneMeshes.push(base);

      for (const offset of [-0.55, 0, 0.55]) {
        const pot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.2, 0.45, 12),
          new THREE.MeshStandardMaterial({ color: 0xc26a4a, roughness: 0.75 })
        );
        pot.position.set(offset, 0.3, 0);
        grp.add(pot);
      }
    } else {
      // RAISED_BED or OUTDOOR_BED
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.45, depth),
        new THREE.MeshStandardMaterial({
          color: z.zone_type === 'RAISED_BED' ? 0x9c5a32 : 0x52525b,
          roughness: 0.82
        })
      );
      frame.position.y = 0.24;
      frame.userData = { zone: z };
      grp.add(frame);
      zoneMeshes.push(frame);

      const soil = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.9, 0.48, depth * 0.9),
        new THREE.MeshStandardMaterial({ color: soilHexForType(z.soil_type), roughness: 0.95 })
      );
      soil.position.y = 0.26;
      grp.add(soil);
    }

    // Crop foliage clusters
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.7 });
    for (let k = -1; k <= 1; k++) {
      const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 1), foliageMat);
      bush.position.set(k * 0.55, 0.65, (k % 2) * 0.2);
      grp.add(bush);
    }

    // Sensor moisture halo indicator ring
    const reading = readingFor(z.id);
    const moist = reading && reading.soil_moisture !== null ? Number(reading.soil_moisture) : 55;
    const haloColor = moist < 35 ? 0xf43f5e : moist > 80 ? 0x3b82f6 : 0x10b981;
    const ringMat = new THREE.MeshBasicMaterial({ color: haloColor, transparent: true, opacity: 0.78 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(width * 0.58, width * 0.63, 28), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    grp.add(ring);
    haloRings.push({ mesh: ring, mat: ringMat });

    zonesRoot.add(grp);
  });

  scene.add(zonesRoot);
}

function onPointerDown(e) {
  dragging = true;
  dragMoved = false;
  downX = e.clientX;
  downY = e.clientY;
}

function onPointerMove(e) {
  if (!dragging) return;
  const dx = e.clientX - downX;
  const dy = e.clientY - downY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
  downX = e.clientX;
  downY = e.clientY;
  theta -= dx * 0.008;
  phi -= dy * 0.006;
  updateCamera();
}

function onPointerUp(e) {
  if (!dragMoved && camera && zoneMeshes.length > 0 && canvasRef.value) {
    const rect = canvasRef.value.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(zoneMeshes, false);
    if (hits.length > 0 && hits[0].object?.userData?.zone) {
      focusZone(hits[0].object.userData.zone);
    }
  }
  dragging = false;
}

function draw2DFallback() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);

  const list = props.zones || [];
  list.slice(0, 4).forEach((z, idx) => {
    const x = 40 + idx * Math.min(140, (w - 80) / Math.max(1, list.length));
    ctx.fillStyle = '#065f46';
    ctx.fillRect(x, h * 0.42, 95, 56);
    ctx.fillStyle = '#ecfdf5';
    ctx.font = '11px sans-serif';
    ctx.fillText(String(z.name || '').slice(0, 13), x + 6, h * 0.42 + 24);
  });
}

function resizeCanvas() {
  const wrap = containerRef.value;
  const canvas = canvasRef.value;
  if (!wrap || !canvas) return;
  const w = Math.max(240, wrap.clientWidth);
  const h = Math.max(180, wrap.clientHeight);
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

watch(() => [props.zones, props.latestReadingsByZone], rebuildZonesGeometry, { deep: true });
watch(sunHour, applySunHourLighting);

onMounted(() => {
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene = new THREE.Scene();

    const w = containerRef.value?.clientWidth || 640;
    const h = containerRef.value?.clientHeight || 360;
    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    updateCamera();

    hemiLight = new THREE.HemisphereLight(0xdff5ff, 0x1e293b, 1.0);
    scene.add(hemiLight);
    sunLight = new THREE.DirectionalLight(0xfffbeb, 2.0);
    scene.add(sunLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 36),
      new THREE.MeshStandardMaterial({ color: 0x143326, roughness: 0.95 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    applySunHourLighting();
    rebuildZonesGeometry();
  } catch {
    isFallback2D = true;
  }

  resizeCanvas();
  if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
    resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(containerRef.value);
  }

  const startMs = performance.now();
  const loop = (nowMs) => {
    const t = (nowMs - startMs) / 1000;
    if (isFallback2D) {
      draw2DFallback();
    } else if (renderer && scene && camera) {
      if (props.compact && !dragging) {
        theta += 0.0025;
        updateCamera();
      }
      for (const h of haloRings) {
        h.mat.opacity = 0.55 + 0.35 * Math.sin(t * 2.6);
      }
      renderer.render(scene, camera);
    }
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
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
