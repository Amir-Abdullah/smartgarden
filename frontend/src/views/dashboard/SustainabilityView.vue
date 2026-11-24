<template>
  <UDashboardPanel id="sustainability-view">
    <template #header>
      <UDashboardNavbar title="Water & Sustainability Metrics">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <AlertBellButton />
          <UColorModeButton />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <UCard>
          <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <UFormField label="Garden Workspace" class="w-full sm:max-w-sm">
              <USelect
                v-model="selectedGardenId"
                :items="gardenOptions"
                value-key="value"
                placeholder="Select a garden"
                class="w-full"
              />
            </UFormField>

            <div v-if="scorecard" class="flex items-center gap-3">
              <UBadge color="success" variant="solid" size="lg" icon="i-lucide-award">
                Sustainability Grade: {{ scorecard.grade }} ({{ scorecard.score }}/100)
              </UBadge>
            </div>
          </div>
        </UCard>

        <!-- KPI Summary Cards -->
        <div v-if="scorecard" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <UCard>
            <p class="text-xs font-medium tracking-wide text-zinc-500 uppercase">Total Water Saved</p>
            <p class="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {{ scorecard.total_water_saved_l }} L
            </p>
            <p class="mt-0.5 text-xs text-zinc-500">Drip efficiency + rainwater &amp; mulch</p>
          </UCard>

          <UCard>
            <p class="text-xs font-medium tracking-wide text-zinc-500 uppercase">Rainwater Harvested</p>
            <p class="mt-1 text-2xl font-bold text-sky-600 dark:text-sky-400">
              {{ scorecard.rainwater_harvested_l }} L
            </p>
            <p class="mt-0.5 text-xs text-zinc-500">Captured barrel &amp; cistern supply</p>
          </UCard>

          <UCard>
            <p class="text-xs font-medium tracking-wide text-zinc-500 uppercase">CO₂ Carbon Offset</p>
            <p class="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
              {{ scorecard.total_co2_offset_kg }} kg
            </p>
            <p class="mt-0.5 text-xs text-zinc-500">Compost, mulch &amp; solar savings</p>
          </UCard>

          <UCard>
            <p class="text-xs font-medium tracking-wide text-zinc-500 uppercase">Precision Irrigation</p>
            <p class="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
              {{ scorecard.precision_irrigation_pct }}%
            </p>
            <p class="mt-0.5 text-xs text-zinc-500">Drip savings vs overhead: {{ scorecard.drip_savings_l }} L</p>
          </UCard>
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <!-- Log New Sustainability Action -->
          <UCard class="lg:col-span-5" data-testid="sustainability-log-form">
            <template #header>
              <h3 class="text-sm font-semibold text-zinc-900 dark:text-white">
                Log Conservation Activity
              </h3>
            </template>

            <form class="space-y-3" @submit.prevent="handleAddLog">
              <UFormField label="Activity Type" required>
                <USelect v-model="form.log_type" :items="logTypeOptions" value-key="value" class="w-full" />
              </UFormField>

              <div class="grid grid-cols-2 gap-3">
                <UFormField label="Quantity" required>
                  <UInput v-model="form.quantity" type="number" step="0.1" min="0.1" placeholder="e.g. 120" class="w-full" required />
                </UFormField>
                <UFormField label="Unit">
                  <UInput v-model="form.unit" placeholder="liters / kg / sq_m" class="w-full" />
                </UFormField>
              </div>

              <UFormField label="Notes">
                <UInput v-model="form.notes" placeholder="e.g. Spring storm cistern capture" class="w-full" />
              </UFormField>

              <UButton type="submit" color="primary" block icon="i-lucide-droplets" :loading="submitting">
                Log Conservation Impact
              </UButton>
            </form>
          </UCard>

          <!-- Recorded History -->
          <UCard class="lg:col-span-7">
            <template #header>
              <h3 class="text-sm font-semibold text-zinc-900 dark:text-white">
                Sustainability Audit Log
              </h3>
            </template>

            <UEmpty
              v-if="logs.length === 0"
              icon="i-lucide-leaf"
              title="No sustainability entries logged yet"
              description="Record rainwater harvesting, compost applications, or mulching to track ecological savings."
            />
            <div v-else class="divide-y divide-zinc-200 dark:divide-zinc-800">
              <div
                v-for="item in logs"
                :key="item.id"
                class="flex items-center justify-between gap-3 py-3 text-xs"
              >
                <div class="space-y-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <UBadge color="primary" variant="soft" size="xs">{{ item.log_type }}</UBadge>
                    <span class="font-semibold text-zinc-900 dark:text-white">
                      {{ item.quantity }} {{ item.unit }}
                    </span>
                    <span class="text-zinc-500">{{ item.recorded_date }}</span>
                  </div>
                  <p v-if="item.notes" class="text-zinc-600 dark:text-zinc-300">{{ item.notes }}</p>
                  <p class="text-[11px] text-emerald-700 dark:text-emerald-400">
                    Saved {{ item.estimated_water_saved_l }} L water &bull; Offset {{ item.estimated_co2_offset_kg }} kg CO₂
                  </p>
                </div>

                <UButton
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  aria-label="Delete sustainability log"
                  @click="handleDelete(item.id)"
                />
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useToast } from '@nuxt/ui/composables';
import { useGardensStore } from '../../stores/gardens.js';
import { useSprint5Store } from '../../stores/sprint5.js';
import AlertBellButton from '../../components/AlertBellButton.vue';

const toast = useToast();
const gardensStore = useGardensStore();
const sprint5Store = useSprint5Store();

const selectedGardenId = ref(null);
const submitting = ref(false);

const form = reactive({
  log_type: 'RAINWATER_HARVEST',
  quantity: '',
  unit: 'liters',
  notes: ''
});

const logTypeOptions = [
  { label: 'Rainwater Harvest (liters)', value: 'RAINWATER_HARVEST' },
  { label: 'Compost Added (kg)', value: 'COMPOST_ADDED' },
  { label: 'Mulch Bed Coverage (sq_m)', value: 'MULCH_SAVINGS' },
  { label: 'Solar Pump Offset (kWh)', value: 'SOLAR_OFFSET' }
];

const gardenOptions = computed(() =>
  gardensStore.gardens.map((g) => ({ label: g.name, value: String(g.id) }))
);

const scorecard = computed(() => sprint5Store.sustainabilityData?.scorecard || null);
const logs = computed(() => sprint5Store.sustainabilityData?.logs || []);

watch(
  () => form.log_type,
  (val) => {
    if (val === 'RAINWATER_HARVEST') form.unit = 'liters';
    else if (val === 'COMPOST_ADDED') form.unit = 'kg';
    else if (val === 'MULCH_SAVINGS') form.unit = 'sq_m';
    else form.unit = 'kWh';
  }
);

watch(selectedGardenId, (gid) => {
  if (gid) sprint5Store.fetchSustainability(Number(gid)).catch(() => {});
});

async function handleAddLog() {
  if (!selectedGardenId.value || !form.quantity) return;
  submitting.value = true;
  try {
    await sprint5Store.addSustainabilityLog(Number(selectedGardenId.value), {
      log_type: form.log_type,
      quantity: Number(form.quantity),
      unit: form.unit,
      notes: form.notes.trim()
    });
    form.quantity = '';
    form.notes = '';
    toast.add({ title: 'Sustainability Log Recorded', color: 'success' });
  } catch (err) {
    toast.add({
      title: 'Failed to Record Log',
      description: err?.response?.data?.error?.message || 'Unable to log entry.',
      color: 'error'
    });
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(logId) {
  if (!selectedGardenId.value) return;
  await sprint5Store.deleteSustainabilityLog(Number(selectedGardenId.value), logId);
  toast.add({ title: 'Log Removed', color: 'neutral' });
}

onMounted(async () => {
  const gardens = await gardensStore.fetchGardens().catch(() => []);
  if (gardens.length > 0) {
    const primary = [...gardens].sort((a, b) => Number(a.id) - Number(b.id))[0];
    selectedGardenId.value = String(primary.id);
  }
});
</script>
