<template>
  <div data-testid="telemetry-chart" class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div v-if="showMetricSelector" class="flex flex-wrap items-center gap-1.5">
        <UButton
          v-for="opt in metricOptions"
          :key="opt.value"
          size="xs"
          :color="activeMetric === opt.value ? 'primary' : 'neutral'"
          :variant="activeMetric === opt.value ? 'solid' : 'outline'"
          :icon="opt.icon"
          @click="selectMetric(opt.value)"
        >
          {{ opt.label }}
        </UButton>
      </div>
      <div v-else class="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
        <UIcon :name="currentMetricMeta.icon" class="size-4 text-emerald-500" />
        <span>{{ currentMetricMeta.label }}</span>
      </div>

      <div v-if="stats" class="flex flex-wrap items-center gap-3 text-xs text-zinc-600 dark:text-zinc-300">
        <span>
          Min: <strong class="text-zinc-900 dark:text-white">{{ formatVal(stats.min) }}{{ currentMetricMeta.unit }}</strong>
        </span>
        <span>
          Avg: <strong class="text-zinc-900 dark:text-white">{{ formatVal(stats.avg) }}{{ currentMetricMeta.unit }}</strong>
        </span>
        <span>
          Max: <strong class="text-zinc-900 dark:text-white">{{ formatVal(stats.max) }}{{ currentMetricMeta.unit }}</strong>
        </span>
      </div>
    </div>

    <div
      v-if="points.length < 2"
      class="flex h-52 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <UIcon name="i-lucide-line-chart" class="mb-2 size-7 text-zinc-400" />
      <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Not enough telemetry samples yet
      </p>
      <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {{ points.length === 1 ? '1 reading recorded — awaiting a second sample to plot trend.' : 'Ingest sensor readings to visualize historical telemetry.' }}
      </p>
    </div>

    <div v-else class="relative rounded-xl border border-zinc-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      <svg
        :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
        class="h-56 w-full overflow-visible select-none"
        role="img"
        :aria-label="`${currentMetricMeta.label} telemetry chart`"
        @mouseleave="hoveredIndex = null"
      >
        <defs>
          <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.32" />
            <stop offset="100%" stop-color="#10b981" stop-opacity="0.02" />
          </linearGradient>
        </defs>

        <!-- Horizontal Grid Lines -->
        <g v-for="tick in yTicks" :key="tick.y">
          <line
            :x1="PAD_L"
            :x2="VIEW_W - PAD_R"
            :y1="tick.y"
            :y2="tick.y"
            stroke="currentColor"
            class="text-zinc-200 dark:text-zinc-800"
            stroke-dasharray="3 3"
            stroke-width="1"
          />
          <text
            :x="PAD_L - 8"
            :y="tick.y + 4"
            text-anchor="end"
            class="fill-zinc-400 text-[10px]"
          >
            {{ formatTick(tick.val) }}
          </text>
        </g>

        <!-- Min/Max Threshold Dashed Lines -->
        <g v-if="minThresholdY !== null">
          <line
            :x1="PAD_L"
            :x2="VIEW_W - PAD_R"
            :y1="minThresholdY"
            :y2="minThresholdY"
            stroke="#f59e0b"
            stroke-dasharray="5 4"
            stroke-width="1.5"
          />
          <text
            :x="VIEW_W - PAD_R"
            :y="minThresholdY - 4"
            text-anchor="end"
            class="fill-amber-600 text-[10px] font-medium dark:fill-amber-400"
          >
            Min {{ parsedMinThreshold }}{{ currentMetricMeta.unit }}
          </text>
        </g>

        <g v-if="maxThresholdY !== null">
          <line
            :x1="PAD_L"
            :x2="VIEW_W - PAD_R"
            :y1="maxThresholdY"
            :y2="maxThresholdY"
            stroke="#ef4444"
            stroke-dasharray="5 4"
            stroke-width="1.5"
          />
          <text
            :x="VIEW_W - PAD_R"
            :y="maxThresholdY - 4"
            text-anchor="end"
            class="fill-rose-600 text-[10px] font-medium dark:fill-rose-400"
          >
            Max {{ parsedMaxThreshold }}{{ currentMetricMeta.unit }}
          </text>
        </g>

        <!-- Area Fill -->
        <path :d="areaPath" :fill="`url(#${gradientId})`" />

        <!-- Primary Line -->
        <path
          :d="linePath"
          fill="none"
          stroke="#10b981"
          stroke-width="2.25"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <!-- Hover Crosshair -->
        <line
          v-if="hoveredPoint"
          :x1="hoveredPoint.x"
          :x2="hoveredPoint.x"
          :y1="PAD_T"
          :y2="VIEW_H - PAD_B"
          stroke="#10b981"
          stroke-dasharray="2 2"
          stroke-width="1"
          opacity="0.7"
        />

        <!-- Interactive Data Points -->
        <g v-for="(pt, idx) in svgPoints" :key="idx">
          <circle
            :cx="pt.x"
            :cy="pt.y"
            :r="hoveredIndex === idx ? 5 : 2.8"
            :fill="hoveredIndex === idx ? '#059669' : '#10b981'"
            stroke="#ffffff"
            stroke-width="1.5"
            class="transition-all duration-100"
          />
          <circle
            :cx="pt.x"
            :cy="pt.y"
            r="12"
            fill="transparent"
            class="cursor-pointer"
            @mouseenter="hoveredIndex = idx"
          />
        </g>

        <!-- X-axis Labels -->
        <g v-for="(lbl, idx) in xLabels" :key="idx">
          <text
            :x="lbl.x"
            :y="VIEW_H - 6"
            :text-anchor="lbl.anchor"
            class="fill-zinc-400 text-[10px]"
          >
            {{ lbl.label }}
          </text>
        </g>
      </svg>

      <!-- Hover Tooltip -->
      <div
        v-if="hoveredPoint"
        class="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-3 py-1.5 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/40"
      >
        <span class="font-medium text-zinc-700 dark:text-zinc-200">
          {{ hoveredPoint.fullLabel }}
        </span>
        <span class="font-semibold text-emerald-700 dark:text-emerald-300">
          {{ formatVal(hoveredPoint.value) }}{{ currentMetricMeta.unit }}
          <template v-if="isDailyStats && hoveredPoint.raw">
            (Min {{ formatVal(hoveredPoint.rawMin) }} / Max {{ formatVal(hoveredPoint.rawMax) }})
          </template>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  readings: {
    type: Array,
    default: () => []
  },
  metric: {
    type: String,
    default: 'soil_moisture'
  },
  minThreshold: {
    type: [Number, String],
    default: null
  },
  maxThreshold: {
    type: [Number, String],
    default: null
  },
  showMetricSelector: {
    type: Boolean,
    default: true
  },
  isDailyStats: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:metric']);

const VIEW_W = 640;
const VIEW_H = 220;
const PAD_L = 48;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 26;

const gradientId = `sg-chart-grad-${Math.random().toString(36).slice(2, 9)}`;
const activeMetric = ref(props.metric || 'soil_moisture');
const hoveredIndex = ref(null);

watch(
  () => props.metric,
  (val) => {
    if (val) activeMetric.value = val;
  }
);

function selectMetric(val) {
  activeMetric.value = val;
  hoveredIndex.value = null;
  emit('update:metric', val);
}

const metricOptions = [
  { value: 'soil_moisture', label: 'Soil Moisture', unit: '%', icon: 'i-lucide-droplets' },
  { value: 'temperature', label: 'Temperature', unit: '°C', icon: 'i-lucide-thermometer' },
  { value: 'humidity', label: 'Humidity', unit: '%', icon: 'i-lucide-wind' },
  { value: 'light_lux', label: 'Light Lux', unit: ' lx', icon: 'i-lucide-sun' }
];

const currentMetricMeta = computed(
  () => metricOptions.find((m) => m.value === activeMetric.value) || metricOptions[0]
);

function toFiniteNumber(v) {
  if (v === null || v === undefined || typeof v === 'boolean') return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  const num = Number(v);
  return Number.isFinite(num) ? num : null;
}

function extractMetricValue(row, metricKey, daily) {
  if (!row) return null;
  if (daily) {
    const avgKey = `avg_${metricKey}`;
    const v = row[avgKey] ?? row[metricKey];
    return toFiniteNumber(v);
  }
  return toFiniteNumber(row[metricKey]);
}

const points = computed(() => {
  const list = Array.isArray(props.readings) ? [...props.readings] : [];
  // Sort ascending chronologically for plotting left-to-right
  list.sort((a, b) => {
    const tA = new Date(a.recorded_at || a.aggregate_date).getTime();
    const tB = new Date(b.recorded_at || b.aggregate_date).getTime();
    return tA - tB;
  });

  const mapped = [];
  for (const row of list) {
    const val = extractMetricValue(row, activeMetric.value, props.isDailyStats);
    if (val === null) continue;
    const dateSrc = row.recorded_at || row.aggregate_date;
    const d = new Date(dateSrc);
    const shortLabel = props.isDailyStats
      ? String(row.aggregate_date || '').slice(5)
      : Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fullLabel = props.isDailyStats
      ? String(row.aggregate_date || '')
      : Number.isNaN(d.getTime())
        ? String(dateSrc || '')
        : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    mapped.push({
      value: val,
      shortLabel,
      fullLabel,
      raw: row,
      rawMin: row[`min_${activeMetric.value}`],
      rawMax: row[`max_${activeMetric.value}`] ?? row[`peak_${activeMetric.value}`]
    });
  }
  return mapped;
});

const stats = computed(() => {
  if (!points.value.length) return null;
  const vals = points.value.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { min, max, avg };
});

const parsedMinThreshold = computed(() => toFiniteNumber(props.minThreshold));
const parsedMaxThreshold = computed(() => toFiniteNumber(props.maxThreshold));

const yDomain = computed(() => {
  const vals = points.value.map((p) => p.value);
  if (parsedMinThreshold.value !== null) {
    vals.push(parsedMinThreshold.value);
  }
  if (parsedMaxThreshold.value !== null) {
    vals.push(parsedMaxThreshold.value);
  }
  const rawMin = vals.length ? Math.min(...vals) : 0;
  let min = rawMin;
  let max = vals.length ? Math.max(...vals) : 100;
  if (min === max) {
    min = min - 5;
    max = max + 5;
  } else {
    const pad = (max - min) * 0.12;
    min -= pad;
    max += pad;
  }
  if (
    rawMin >= 0 &&
    (activeMetric.value === 'soil_moisture' ||
      activeMetric.value === 'humidity' ||
      activeMetric.value === 'light_lux')
  ) {
    min = Math.max(0, min);
  }
  if (max <= min) {
    max = min + 1;
  }
  return { min, max };
});

function valueToY(val) {
  const { min, max } = yDomain.value;
  const plotH = VIEW_H - PAD_T - PAD_B;
  const ratio = (val - min) / (max - min || 1);
  return PAD_T + plotH * (1 - ratio);
}

const svgPoints = computed(() => {
  const count = points.value.length;
  if (count === 0) return [];
  const plotW = VIEW_W - PAD_L - PAD_R;
  return points.value.map((pt, idx) => {
    const x = count === 1 ? PAD_L + plotW / 2 : PAD_L + (idx / (count - 1)) * plotW;
    const y = valueToY(pt.value);
    return { ...pt, x, y };
  });
});

const linePath = computed(() => {
  if (!svgPoints.value.length) return '';
  return svgPoints.value
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');
});

const areaPath = computed(() => {
  if (svgPoints.value.length < 2) return '';
  const baseLineY = VIEW_H - PAD_B;
  const first = svgPoints.value[0];
  const last = svgPoints.value[svgPoints.value.length - 1];
  return `${linePath.value} L ${last.x.toFixed(1)} ${baseLineY} L ${first.x.toFixed(1)} ${baseLineY} Z`;
});

const yTicks = computed(() => {
  const { min, max } = yDomain.value;
  const steps = 4;
  const ticks = [];
  for (let i = 0; i <= steps; i += 1) {
    const val = min + ((max - min) * i) / steps;
    ticks.push({ val, y: valueToY(val) });
  }
  return ticks;
});

const xLabels = computed(() => {
  const pts = svgPoints.value;
  if (pts.length < 2) return [];
  const midIdx = Math.floor((pts.length - 1) / 2);
  const items = [
    { x: pts[0].x, label: pts[0].shortLabel, anchor: 'start' }
  ];
  if (midIdx > 0 && midIdx < pts.length - 1) {
    items.push({ x: pts[midIdx].x, label: pts[midIdx].shortLabel, anchor: 'middle' });
  }
  items.push({ x: pts[pts.length - 1].x, label: pts[pts.length - 1].shortLabel, anchor: 'end' });
  return items;
});

const minThresholdY = computed(() => {
  if (parsedMinThreshold.value === null) {
    return null;
  }
  return valueToY(parsedMinThreshold.value);
});

const maxThresholdY = computed(() => {
  if (parsedMaxThreshold.value === null) {
    return null;
  }
  return valueToY(parsedMaxThreshold.value);
});

const hoveredPoint = computed(() => {
  if (hoveredIndex.value === null) return null;
  return svgPoints.value[hoveredIndex.value] || null;
});

function formatVal(val) {
  const num = toFiniteNumber(val);
  if (num === null) return '—';
  return activeMetric.value === 'light_lux' ? Math.round(num).toLocaleString() : num.toFixed(1);
}

function formatTick(val) {
  if (activeMetric.value === 'light_lux' && Math.abs(val) >= 1000) {
    return `${(val / 1000).toFixed(1)}k`;
  }
  return Number(val).toFixed(activeMetric.value === 'light_lux' ? 0 : 1);
}
</script>
