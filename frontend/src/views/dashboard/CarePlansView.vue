<template>
  <UDashboardPanel id="care-plans-view">
    <template #header>
      <UDashboardNavbar title="Personalized Care Plan Generator">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <AlertBellButton />
          <UColorModeButton />
          <UButton
            v-if="canEdit && selectedZoneId && preview?.planned_tasks?.length"
            data-testid="generate-care-plan-btn"
            color="primary"
            size="sm"
            icon="i-lucide-sparkles"
            :loading="horticultureStore.carePlanLoading"
            @click="handleGenerate"
          >
            Generate Care Plan Tasks
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <UCard>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <UFormField label="Garden" data-testid="careplan-garden-select">
              <USelect v-model="selectedGardenId" :items="gardenOptions" value-key="value" class="w-full" />
            </UFormField>
            <UFormField label="Target Zone" data-testid="careplan-zone-select">
              <USelect v-model="selectedZoneId" :items="zoneOptions" value-key="value" class="w-full" />
            </UFormField>
          </div>
        </UCard>

        <UAlert
          v-if="lastResult"
          data-testid="careplan-result-banner"
          color="success"
          variant="soft"
          icon="i-lucide-check-circle-2"
          :title="`Care Plan Sync Complete: Created ${lastResult.created_count} Task(s)`"
          :description="`Skipped ${lastResult.skipped_count} existing active CARE_PLAN task(s). View them under Care Tasks.`"
        />

        <template v-if="preview">
          <UCard>
            <div class="flex flex-wrap items-center gap-3 text-xs">
              <UBadge color="primary" variant="subtle">Zone: {{ preview.zone.name }}</UBadge>
              <UBadge color="neutral" variant="outline">
                Soil {{ preview.zone.soil_type }} (x{{ preview.zone.soil_water_multiplier }} water)
              </UBadge>
              <UBadge color="amber" variant="subtle">
                Sun {{ preview.zone.sunlight_level }} (x{{ preview.zone.sun_water_multiplier }} water)
              </UBadge>
              <UBadge color="info" variant="soft">
                {{ preview.active_plant_count }} active crop(s)
              </UBadge>
            </div>
          </UCard>

          <UEmpty
            v-if="!preview.planned_tasks.length"
            icon="i-lucide-sprout"
            title="No active plantings in this zone"
            description="Assign plants to this zone first to calibrate watering, fertilizing, and pruning schedules."
          />

          <UCard v-else>
            <template #header>
              <h3 class="text-base font-semibold text-zinc-900 dark:text-white">Calibrated Schedule Preview</h3>
            </template>

            <div class="space-y-3">
              <div
                v-for="(t, idx) in preview.planned_tasks"
                :key="idx"
                class="flex flex-col justify-between gap-2 rounded-xl border border-zinc-200/80 p-3 sm:flex-row sm:items-center dark:border-zinc-800"
              >
                <div class="space-y-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <UBadge :color="t.task_type === 'WATER' ? 'info' : (t.task_type === 'FERTILIZE' ? 'success' : 'warning')" size="xs">
                      {{ t.task_type }}
                    </UBadge>
                    <span class="font-semibold text-zinc-900 dark:text-white">{{ t.custom_nickname }}</span>
                    <span class="text-xs text-zinc-500">Every {{ t.recurrence_days }} day(s)</span>
                    <span v-if="t.recommended_liters" class="text-xs font-medium text-sky-600 dark:text-sky-400">
                      {{ t.recommended_liters }} L / session
                    </span>
                  </div>
                  <p class="text-xs text-zinc-500">{{ t.notes }}</p>
                </div>
                <div class="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  First Due: {{ t.due_date }}
                </div>
              </div>
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

const route = useRoute();
const toast = useToast();
const gardensStore = useGardensStore();
const horticultureStore = useHorticultureStore();

const selectedGardenId = ref(null);
const selectedZoneId = ref(null);

const gardenOptions = computed(() =>
  gardensStore.gardens.map((g) => ({ label: g.name, value: g.id }))
);
const activeGarden = computed(() =>
  gardensStore.gardens.find((g) => Number(g.id) === Number(selectedGardenId.value)) || null
);
const canEdit = computed(() => {
  const r = activeGarden.value?.role || 'OWNER';
  return r === 'OWNER' || r === 'FAMILY';
});
const zoneOptions = computed(() =>
  gardensStore.zones.map((z) => ({ label: `${z.name} (${z.soil_type}, ${z.sunlight_level})`, value: z.id }))
);

const preview = computed(() => horticultureStore.carePlanPreview);
const lastResult = computed(() => horticultureStore.lastCarePlanResult);

async function loadPreview() {
  if (!selectedZoneId.value) return;
  try {
    await horticultureStore.fetchCarePlanPreview(selectedZoneId.value);
  } catch {
    // surfaced via store
  }
}

async function handleGenerate() {
  if (!selectedZoneId.value) return;
  try {
    const res = await horticultureStore.generateZoneCarePlan(selectedZoneId.value);
    toast.add({
      title: 'Care Plan Generated',
      description: `Created ${res.created_count} recurring CARE_PLAN task(s).`,
      color: 'success',
      icon: 'i-lucide-sparkles'
    });
  } catch {
    toast.add({
      title: 'Generation failed',
      description: horticultureStore.error || 'Could not generate care plan.',
      color: 'error'
    });
  }
}

watch(selectedGardenId, async (gid) => {
  if (!gid) return;
  await gardensStore.fetchZones(gid);
  const qZoneId = Number(route.query.zoneId);
  if (qZoneId && gardensStore.zones.some((z) => Number(z.id) === qZoneId)) {
    selectedZoneId.value = qZoneId;
  } else {
    selectedZoneId.value = gardensStore.zones[0]?.id || null;
  }
});

watch(selectedZoneId, () => {
  horticultureStore.lastCarePlanResult = null;
  loadPreview();
});

onMounted(async () => {
  if (!gardensStore.gardens.length) {
    await gardensStore.fetchGardens();
  }
  const qGardenId = Number(route.query.gardenId);
  if (qGardenId && gardensStore.gardens.some((g) => Number(g.id) === qGardenId)) {
    selectedGardenId.value = qGardenId;
  } else if (gardensStore.gardens.length) {
    selectedGardenId.value = gardensStore.gardens[0].id;
  }
});
</script>
