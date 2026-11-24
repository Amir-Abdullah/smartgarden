<template>
  <UDashboardPanel id="recommendations-view">
    <template #header>
      <UDashboardNavbar title="Plant Recommendation Engine">
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
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            <UFormField label="Garden" data-testid="rec-garden-select">
              <USelect v-model="selectedGardenId" :items="gardenOptions" value-key="value" class="w-full" />
            </UFormField>
            <UFormField label="Target Zone" data-testid="rec-zone-select">
              <USelect v-model="selectedZoneId" :items="zoneOptions" value-key="value" class="w-full" />
            </UFormField>
            <UFormField label="Category">
              <USelect v-model="selectedCategory" :items="categoryOptions" value-key="value" class="w-full" />
            </UFormField>
          </div>
        </UCard>

        <template v-if="recData">
          <UCard>
            <div class="flex flex-wrap items-center gap-2 text-xs">
              <UBadge color="primary" variant="subtle">{{ recData.zone.name }}</UBadge>
              <UBadge color="neutral" variant="outline">{{ recData.zone.sunlight_level }}</UBadge>
              <UBadge color="neutral" variant="outline">{{ recData.zone.soil_type }}</UBadge>
              <UBadge color="success" variant="soft">
                Free Area: {{ recData.zone.free_area_sq_m }} / {{ recData.zone.total_area_sq_m }} m&sup2;
              </UBadge>
              <UBadge color="info" variant="soft">{{ recData.hemisphere }} (Month {{ recData.active_month }})</UBadge>
            </div>
          </UCard>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <UCard
              v-for="item in recData.recommendations"
              :key="item.plant_catalog_id"
              data-testid="recommendation-card"
            >
              <template #header>
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <h4 class="font-semibold text-zinc-900 dark:text-white">{{ item.common_name }}</h4>
                    <p class="text-xs italic text-zinc-500">{{ item.scientific_name }}</p>
                  </div>
                  <UBadge
                    :color="item.total_score >= 85 ? 'success' : (item.total_score >= 70 ? 'primary' : 'neutral')"
                    variant="solid"
                    size="sm"
                  >
                    {{ item.total_score }}% Match
                  </UBadge>
                </div>
              </template>

              <div class="space-y-3 text-xs">
                <p class="text-zinc-600 dark:text-zinc-300">{{ item.rationale }}</p>

                <div class="grid grid-cols-5 gap-1 text-center text-[10px]">
                  <div class="rounded bg-zinc-100 p-1 dark:bg-zinc-800">
                    <div class="text-zinc-500">Sun</div>
                    <div class="font-bold">{{ item.breakdown.sunlight }}/35</div>
                  </div>
                  <div class="rounded bg-zinc-100 p-1 dark:bg-zinc-800">
                    <div class="text-zinc-500">Season</div>
                    <div class="font-bold">{{ item.breakdown.season }}/25</div>
                  </div>
                  <div class="rounded bg-zinc-100 p-1 dark:bg-zinc-800">
                    <div class="text-zinc-500">Soil</div>
                    <div class="font-bold">{{ item.breakdown.soil }}/15</div>
                  </div>
                  <div class="rounded bg-zinc-100 p-1 dark:bg-zinc-800">
                    <div class="text-zinc-500">Space</div>
                    <div class="font-bold">{{ item.breakdown.space }}/15</div>
                  </div>
                  <div class="rounded bg-zinc-100 p-1 dark:bg-zinc-800">
                    <div class="text-zinc-500">Guild</div>
                    <div class="font-bold">{{ item.breakdown.companions }}/10</div>
                  </div>
                </div>
              </div>

              <template #footer>
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs text-zinc-500">
                    Max fit: {{ item.max_recommended_quantity }} plant(s)
                  </span>
                  <UButton
                    v-if="canEdit"
                    data-testid="add-recommended-plant-btn"
                    size="xs"
                    color="primary"
                    variant="soft"
                    icon="i-lucide-plus"
                    :disabled="item.already_in_zone"
                    @click="handleAddToZone(item)"
                  >
                    {{ item.already_in_zone ? 'In Zone' : 'Add to Zone' }}
                  </UButton>
                </div>
              </template>
            </UCard>
          </div>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import api from '../../services/api.js';
import { useGardensStore } from '../../stores/gardens.js';
import { useHorticultureStore } from '../../stores/horticulture.js';
import AlertBellButton from '../../components/AlertBellButton.vue';

const route = useRoute();
const toast = useToast();
const gardensStore = useGardensStore();
const horticultureStore = useHorticultureStore();

const selectedGardenId = ref(null);
const selectedZoneId = ref(null);
const selectedCategory = ref('ALL');

const categoryOptions = [
  { label: 'All Categories', value: 'ALL' },
  { label: 'Vegetable', value: 'VEGETABLE' },
  { label: 'Herb', value: 'HERB' },
  { label: 'Fruit', value: 'FRUIT' },
  { label: 'Flower', value: 'FLOWER' }
];

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
  gardensStore.zones.map((z) => ({ label: z.name, value: z.id }))
);
const recData = computed(() => horticultureStore.recommendationsData);

async function loadRecommendations() {
  if (!selectedZoneId.value) return;
  try {
    await horticultureStore.fetchZoneRecommendations(selectedZoneId.value, {
      category: selectedCategory.value
    });
  } catch {
    // surfaced via store
  }
}

async function handleAddToZone(item) {
  if (!selectedZoneId.value) return;
  try {
    await api.post(`/zones/${selectedZoneId.value}/plants`, {
      plant_catalog_id: item.plant_catalog_id,
      quantity: Math.max(1, Math.min(2, item.max_recommended_quantity || 1)),
      planted_date: new Date().toISOString().slice(0, 10),
      status: 'SEEDLING'
    });
    toast.add({
      title: `Added ${item.common_name}`,
      description: `Assigned to ${recData.value?.zone?.name || 'zone'}.`,
      color: 'success',
      icon: 'i-lucide-check-circle-2'
    });
    await loadRecommendations();
  } catch (err) {
    toast.add({
      title: 'Failed to assign plant',
      description: err?.response?.data?.error?.message || err.message,
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

watch([selectedZoneId, selectedCategory], () => {
  loadRecommendations();
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
