<template>
  <ComingSoonView v-if="isF22Preview" />
  <UDashboardPanel v-else id="analytics-view">
    <template #header>
      <UDashboardNavbar title="Analytics & Data Export">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <AlertBellButton />
          <UColorModeButton />
          <UButton
            v-if="selectedGardenId"
            data-testid="export-csv-btn"
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-file-spreadsheet"
            :loading="sprint4Store.exportLoading"
            @click="handleExport('csv')"
          >
            Export CSV
          </UButton>
          <UButton
            v-if="selectedGardenId"
            data-testid="export-pdf-btn"
            color="primary"
            size="sm"
            icon="i-lucide-file-text"
            :loading="sprint4Store.exportLoading"
            @click="handleExport('pdf')"
          >
            Export PDF
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- Filters Bar -->
        <UCard>
          <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:flex-1">
              <UFormField label="Garden Workspace">
                <USelect
                  v-model="selectedGardenId"
                  :items="gardenOptions"
                  value-key="value"
                  placeholder="Select garden"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Zone Filter">
                <USelect
                  v-model="selectedZoneId"
                  :items="zoneOptions"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>
            </div>

            <div class="flex items-center gap-1.5">
              <UButton
                v-for="r in ['7d', '30d', '90d']"
                :key="r"
                size="xs"
                :color="selectedRange === r ? 'primary' : 'neutral'"
                :variant="selectedRange === r ? 'solid' : 'outline'"
                @click="selectedRange = r"
              >
                {{ r.toUpperCase() }}
              </UButton>
            </div>
          </div>
        </UCard>

        <UAlert
          v-if="sprint4Store.error"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="sprint4Store.error"
        />

        <!-- KPI Stat Cards -->
        <div v-if="analytics" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <UCard>
            <p class="text-xs font-medium tracking-wide text-zinc-500 uppercase">Water Applied ({{ selectedRange }})</p>
            <p class="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {{ analytics.kpis.total_water_liters }} L
            </p>
            <p class="mt-0.5 text-xs text-zinc-500">{{ analytics.kpis.watering_events }} logged events</p>
          </UCard>

          <UCard>
            <p class="text-xs font-medium tracking-wide text-zinc-500 uppercase">Task Completion</p>
            <p class="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
              {{ analytics.kpis.task_completion_rate_pct }}%
            </p>
            <p class="mt-0.5 text-xs text-zinc-500">
              {{ analytics.kpis.completed_tasks }} / {{ analytics.kpis.total_tasks }} care tasks done
            </p>
          </UCard>

          <UCard>
            <p class="text-xs font-medium tracking-wide text-zinc-500 uppercase">Avg Soil Moisture</p>
            <p class="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
              {{ analytics.kpis.avg_soil_moisture !== null ? `${analytics.kpis.avg_soil_moisture}%` : '—' }}
            </p>
            <p class="mt-0.5 text-xs text-zinc-500">
              Avg Temp: {{ analytics.kpis.avg_temperature !== null ? `${analytics.kpis.avg_temperature}°C` : '—' }}
            </p>
          </UCard>

          <UCard>
            <p class="text-xs font-medium tracking-wide text-zinc-500 uppercase">Field Observations</p>
            <p class="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
              {{ analytics.kpis.journal_entries_count }}
            </p>
            <p class="mt-0.5 text-xs text-zinc-500">{{ analytics.kpis.unread_alerts }} unread alerts</p>
          </UCard>
        </div>

        <!-- Daily Sensor Trend & Water Breakdown -->
        <div v-if="analytics" class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-zinc-900 dark:text-white">
                  Daily Moisture &amp; Temperature Rollup
                </h3>
                <UBadge color="neutral" variant="soft" size="xs">
                  {{ analytics.daily_telemetry.length }} days
                </UBadge>
              </div>
            </template>

            <div v-if="analytics.daily_telemetry.length === 0" class="py-8 text-center text-xs text-zinc-500">
              No daily sensor rollups recorded inside this time window.
            </div>
            <div v-else class="space-y-3">
              <svg viewBox="0 0 480 140" class="h-36 w-full rounded-lg bg-zinc-50 p-2 dark:bg-zinc-900/60">
                <polyline
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  class="text-sky-500"
                  :points="moistureSparkPoints"
                />
              </svg>
              <div class="max-h-40 space-y-1.5 overflow-y-auto text-xs">
                <div
                  v-for="d in analytics.daily_telemetry"
                  :key="d.date"
                  class="flex items-center justify-between rounded-md bg-zinc-50 px-2.5 py-1.5 dark:bg-zinc-900/50"
                >
                  <span class="font-mono text-zinc-600 dark:text-zinc-300">{{ d.date }}</span>
                  <span>Moisture: <strong>{{ d.avg_soil_moisture ?? '—' }}%</strong></span>
                  <span>Temp: <strong>{{ d.avg_temperature ?? '—' }}°C</strong></span>
                  <span class="text-zinc-400">{{ d.sample_count }} pts</span>
                </div>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="text-sm font-semibold text-zinc-900 dark:text-white">
                Irrigation Method Breakdown
              </h3>
            </template>

            <div v-if="analytics.water_by_method.length === 0" class="py-8 text-center text-xs text-zinc-500">
              No water usage logs in this window.
            </div>
            <div v-else class="space-y-3">
              <div
                v-for="m in analytics.water_by_method"
                :key="m.method"
                class="space-y-1"
              >
                <div class="flex items-center justify-between text-xs">
                  <span class="font-medium text-zinc-800 dark:text-zinc-200">{{ m.method }}</span>
                  <span class="text-zinc-500">{{ m.liters }} L ({{ m.events }} logs)</span>
                </div>
                <div class="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    class="h-full rounded-full bg-emerald-500"
                    :style="{ width: `${Math.min(100, Math.round((m.liters / Math.max(analytics.kpis.total_water_liters, 1)) * 100))}%` }"
                  />
                </div>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Zone Comparison Table -->
        <UCard v-if="analytics">
          <template #header>
            <h3 class="text-sm font-semibold text-zinc-900 dark:text-white">
              Microclimate Zone Comparison
            </h3>
          </template>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="border-b border-zinc-200 text-zinc-500 uppercase dark:border-zinc-800">
                <tr>
                  <th class="py-2 pr-4">Zone</th>
                  <th class="py-2 pr-4">Area (m²)</th>
                  <th class="py-2 pr-4">Plants</th>
                  <th class="py-2 pr-4">Water Applied</th>
                  <th class="py-2 pr-4">Avg Moisture</th>
                  <th class="py-2">Tasks</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-200 dark:divide-zinc-800">
                <tr v-for="z in analytics.zone_summary" :key="z.zone_id">
                  <td class="py-2.5 pr-4 font-semibold text-zinc-900 dark:text-white">{{ z.zone_name }}</td>
                  <td class="py-2.5 pr-4">{{ z.area_sqm }}</td>
                  <td class="py-2.5 pr-4">{{ z.plant_count }}</td>
                  <td class="py-2.5 pr-4">{{ z.water_liters }} L</td>
                  <td class="py-2.5 pr-4">{{ z.avg_soil_moisture !== null ? `${z.avg_soil_moisture}%` : '—' }}</td>
                  <td class="py-2.5">{{ z.tasks_completed }} / {{ z.tasks_total }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { useGardensStore } from '../../stores/gardens.js';
import { useSprint4Store } from '../../stores/sprint4.js';
import AlertBellButton from '../../components/AlertBellButton.vue';
import ComingSoonView from '../ComingSoonView.vue';

const route = useRoute();
const toast = useToast();
const gardensStore = useGardensStore();
const sprint4Store = useSprint4Store();

const isF22Preview = computed(() => route.query.feature === 'F22');

const selectedGardenId = ref(null);
const selectedZoneId = ref('ALL');
const selectedRange = ref('30d');

const gardenOptions = computed(() =>
  gardensStore.gardens.map((g) => ({ label: g.name, value: String(g.id) }))
);

const zoneOptions = computed(() => [
  { label: 'All Zones', value: 'ALL' },
  ...gardensStore.zones.map((z) => ({ label: z.name, value: String(z.id) }))
]);

const analytics = computed(() => sprint4Store.analyticsData);

const moistureSparkPoints = computed(() => {
  const days = analytics.value?.daily_telemetry || [];
  if (days.length === 0) return '';
  const vals = days.map((d) => Number(d.avg_soil_moisture ?? 50));
  return vals
    .map((v, idx) => {
      const x = vals.length === 1 ? 240 : 20 + (idx / (vals.length - 1)) * 440;
      const y = 120 - (Math.max(0, Math.min(100, v)) / 100) * 100;
      return `${x},${y}`;
    })
    .join(' ');
});

async function refreshAnalytics() {
  if (isF22Preview.value || !selectedGardenId.value) return;
  await sprint4Store.fetchAnalytics(Number(selectedGardenId.value), {
    range: selectedRange.value,
    zoneId: selectedZoneId.value
  }).catch(() => {});
}

async function handleExport(format) {
  if (!selectedGardenId.value) return;
  try {
    const res = await sprint4Store.downloadExport(Number(selectedGardenId.value), format, {
      range: selectedRange.value,
      zoneId: selectedZoneId.value
    });
    toast.add({
      title: `${format.toUpperCase()} Report Ready`,
      description: `Downloaded ${res.filename}`,
      color: 'success'
    });
  } catch {
    toast.add({ title: `Export ${format.toUpperCase()} Failed`, color: 'error' });
  }
}

watch(selectedGardenId, async (gid) => {
  if (!gid || isF22Preview.value) return;
  selectedZoneId.value = 'ALL';
  await gardensStore.fetchGardenDetail(Number(gid)).catch(() => {});
  await refreshAnalytics();
});

watch([selectedZoneId, selectedRange], refreshAnalytics);

onMounted(async () => {
  if (isF22Preview.value) return;
  const gardens = await gardensStore.fetchGardens().catch(() => []);
  if (gardens.length > 0) {
    const primary = [...gardens].sort((a, b) => Number(a.id) - Number(b.id))[0];
    selectedGardenId.value = String(primary.id);
  }
});
</script>
