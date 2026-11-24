<template>
  <ComingSoonView v-if="isSeedVaultAlias" />
  <UDashboardPanel v-else id="planting-calendar-view">
    <template #header>
      <UDashboardNavbar title="Seasonal Planting Calendar">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <AlertBellButton />
          <UColorModeButton />
          <UButton
            data-testid="export-ics-btn"
            color="primary"
            size="sm"
            icon="i-lucide-download"
            @click="handleExportIcs"
          >
            Export .ics Calendar
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <UCard>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
            <UFormField label="Garden Context" data-testid="calendar-garden-select">
              <USelect
                v-model="selectedGardenKey"
                :items="gardenOptions"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Hemisphere Override" data-testid="calendar-hemisphere-select">
              <USelect
                v-model="selectedHemisphere"
                :items="hemisphereOptions"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Active Month" data-testid="calendar-month-select">
              <USelect
                v-model="selectedMonth"
                :items="monthOptions"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Category Filter">
              <USelect
                v-model="selectedCategory"
                :items="categoryOptions"
                value-key="value"
                class="w-full"
              />
            </UFormField>
          </div>
        </UCard>

        <template v-if="cal">
          <!-- Monthly Action Summary -->
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <UCard data-testid="calendar-indoor-card">
              <template #header>
                <div class="flex items-center justify-between">
                  <span class="font-semibold text-zinc-900 dark:text-white">Start Indoors ({{ cal.active_month_label }})</span>
                  <UBadge color="info" variant="soft">{{ cal.current_month_plan.indoor_sow.length }}</UBadge>
                </div>
              </template>
              <div v-if="cal.current_month_plan.indoor_sow.length" class="flex flex-wrap gap-1.5">
                <UBadge v-for="s in cal.current_month_plan.indoor_sow" :key="s.id" color="info" variant="subtle" size="xs">
                  {{ s.common_name }}
                </UBadge>
              </div>
              <p v-else class="text-xs text-zinc-500">No indoor seed-starts flagged for {{ cal.active_month_label }}.</p>
            </UCard>

            <UCard data-testid="calendar-sow-card">
              <template #header>
                <div class="flex items-center justify-between">
                  <span class="font-semibold text-zinc-900 dark:text-white">Direct Sow / Transplant</span>
                  <UBadge color="success" variant="soft">{{ cal.current_month_plan.direct_sow.length }}</UBadge>
                </div>
              </template>
              <div v-if="cal.current_month_plan.direct_sow.length" class="flex flex-wrap gap-1.5">
                <UBadge v-for="s in cal.current_month_plan.direct_sow" :key="s.id" color="success" variant="subtle" size="xs">
                  {{ s.common_name }}
                </UBadge>
              </div>
              <p v-else class="text-xs text-zinc-500">No direct outdoor sowing in {{ cal.active_month_label }}.</p>
            </UCard>

            <UCard data-testid="calendar-harvest-card">
              <template #header>
                <div class="flex items-center justify-between">
                  <span class="font-semibold text-zinc-900 dark:text-white">Peak Harvest Window</span>
                  <UBadge color="warning" variant="soft">{{ cal.current_month_plan.harvest_ready.length }}</UBadge>
                </div>
              </template>
              <div v-if="cal.current_month_plan.harvest_ready.length" class="flex flex-wrap gap-1.5">
                <UBadge v-for="s in cal.current_month_plan.harvest_ready" :key="s.id" color="warning" variant="subtle" size="xs">
                  {{ s.common_name }}
                </UBadge>
              </div>
              <p v-else class="text-xs text-zinc-500">No catalog harvests peak in {{ cal.active_month_label }}.</p>
            </UCard>
          </div>

          <!-- 12-Month Matrix -->
          <UCard>
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 class="text-base font-semibold text-zinc-900 dark:text-white">
                    12-Month Sowing &amp; Harvest Matrix
                  </h3>
                  <p class="text-xs text-zinc-500">
                    Active hemisphere: {{ cal.hemisphere }} · Legend: I = Indoor Start, S = Sow/Transplant, H = Harvest
                  </p>
                </div>
                <UBadge color="primary" variant="subtle">{{ cal.hemisphere }}</UBadge>
              </div>
            </template>

            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-zinc-200 text-xs dark:divide-zinc-800">
                <thead>
                  <tr class="text-left text-zinc-500">
                    <th class="py-2 pr-4 font-semibold">Species</th>
                    <th
                      v-for="(mLabel, mIdx) in cal.month_labels"
                      :key="mLabel"
                      class="px-1.5 py-2 text-center font-semibold"
                      :class="(mIdx + 1) === cal.active_month ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : ''"
                    >
                      {{ mLabel }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  <tr v-for="row in cal.matrix" :key="row.id">
                    <td class="py-2 pr-4 font-medium text-zinc-900 dark:text-white">
                      {{ row.common_name }}
                      <span class="ml-1 text-[10px] text-zinc-400">{{ row.category }}</span>
                    </td>
                    <td
                      v-for="m in 12"
                      :key="m"
                      class="px-1 py-1.5 text-center"
                      :class="m === cal.active_month ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''"
                    >
                      <span
                        v-if="row.direct_sow_months.includes(m) && row.harvest_months.includes(m)"
                        class="inline-block rounded bg-teal-100 px-1.5 py-0.5 font-semibold text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                      >
                        S/H
                      </span>
                      <span
                        v-else-if="row.direct_sow_months.includes(m)"
                        class="inline-block rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      >
                        S
                      </span>
                      <span
                        v-else-if="row.indoor_sow_months.includes(m)"
                        class="inline-block rounded bg-sky-100 px-1.5 py-0.5 font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                      >
                        I
                      </span>
                      <span
                        v-else-if="row.harvest_months.includes(m)"
                        class="inline-block rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      >
                        H
                      </span>
                      <span v-else class="text-zinc-300 dark:text-zinc-700">&middot;</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UCard>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { useGardensStore } from '../../stores/gardens.js';
import { useHorticultureStore } from '../../stores/horticulture.js';
import AlertBellButton from '../../components/AlertBellButton.vue';
import ComingSoonView from '../ComingSoonView.vue';

const route = useRoute();
const toast = useToast();
const gardensStore = useGardensStore();
const horticultureStore = useHorticultureStore();

const isSeedVaultAlias = computed(() => route.query.feature === 'F23');

const selectedGardenKey = ref('NONE');
const selectedHemisphere = ref('AUTO');
const selectedMonth = ref(new Date().getUTCMonth() + 1);
const selectedCategory = ref('ALL');

const gardenOptions = computed(() => [
  { label: 'Global Reference Calendar', value: 'NONE' },
  ...gardensStore.gardens.map((g) => ({ label: g.name, value: String(g.id) }))
]);

const hemisphereOptions = [
  { label: 'Auto (Garden Coordinates)', value: 'AUTO' },
  { label: 'Northern Hemisphere', value: 'NORTHERN' },
  { label: 'Southern Hemisphere (+6m)', value: 'SOUTHERN' }
];

const monthOptions = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
].map((label, idx) => ({ label, value: idx + 1 }));

const categoryOptions = [
  { label: 'All Categories', value: 'ALL' },
  { label: 'Vegetable', value: 'VEGETABLE' },
  { label: 'Herb', value: 'HERB' },
  { label: 'Fruit', value: 'FRUIT' },
  { label: 'Flower', value: 'FLOWER' }
];

const cal = computed(() => horticultureStore.calendarData);

function buildParams() {
  return {
    garden_id: selectedGardenKey.value !== 'NONE' ? selectedGardenKey.value : undefined,
    hemisphere: selectedHemisphere.value !== 'AUTO' ? selectedHemisphere.value : undefined,
    month: selectedMonth.value,
    category: selectedCategory.value
  };
}

async function loadCalendar() {
  if (isSeedVaultAlias.value) return;
  try {
    await horticultureStore.fetchCalendar(buildParams());
  } catch {
    // surfaced via store
  }
}

async function handleExportIcs() {
  try {
    const icsText = await horticultureStore.fetchIcsExport(buildParams());
    const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smartgarden-planting-calendar.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.add({
      title: 'Calendar Exported',
      description: 'Downloaded RFC 5545 .ics planting schedule.',
      color: 'success',
      icon: 'i-lucide-check-circle-2'
    });
  } catch {
    toast.add({
      title: 'Export failed',
      description: 'Could not download .ics file.',
      color: 'error'
    });
  }
}

watch([selectedGardenKey, selectedHemisphere, selectedMonth, selectedCategory, isSeedVaultAlias], () => {
  loadCalendar();
});

onMounted(async () => {
  if (!gardensStore.gardens.length) {
    await gardensStore.fetchGardens();
  }
  if (gardensStore.gardens.length) {
    selectedGardenKey.value = String(gardensStore.gardens[0].id);
  } else {
    await loadCalendar();
  }
});
</script>
