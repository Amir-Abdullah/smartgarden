<template>
  <UDashboardPanel id="companions-view">
    <template #header>
      <UDashboardNavbar title="Companion Planting Advisor">
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
            <UFormField label="Garden" data-testid="comp-garden-select">
              <USelect v-model="selectedGardenId" :items="gardenOptions" value-key="value" class="w-full" />
            </UFormField>
            <UFormField label="Target Zone" data-testid="comp-zone-select">
              <USelect v-model="selectedZoneId" :items="zoneOptions" value-key="value" class="w-full" />
            </UFormField>
            <UFormField label="What-If Candidate Crop" data-testid="comp-candidate-select">
              <USelect v-model="selectedCandidateId" :items="candidateOptions" value-key="value" class="w-full" />
            </UFormField>
          </div>
        </UCard>

        <template v-if="compData">
          <!-- Guild Score Summary -->
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            <UCard data-testid="companion-score-card">
              <p class="text-xs font-medium text-zinc-500 uppercase">Zone Guild Score</p>
              <div class="mt-2 flex items-baseline gap-3">
                <span class="text-3xl font-bold text-zinc-900 dark:text-white">{{ compData.overall_score }} / 100</span>
                <UBadge
                  :color="compData.guild_status === 'OPTIMAL_GUILD' ? 'success' : (compData.guild_status === 'BALANCED' ? 'primary' : 'error')"
                  variant="soft"
                >
                  {{ compData.guild_status }}
                </UBadge>
              </div>
              <p v-if="compData.simulated_delta !== 0" class="mt-1 text-xs font-medium" :class="compData.simulated_delta > 0 ? 'text-emerald-600' : 'text-rose-600'">
                What-If Delta: {{ compData.simulated_delta > 0 ? '+' : '' }}{{ compData.simulated_delta }} pts vs baseline ({{ compData.baseline_score }})
              </p>
            </UCard>

            <UCard>
              <p class="text-xs font-medium text-zinc-500 uppercase">Beneficial Synergies</p>
              <p class="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">{{ compData.synergies.length }}</p>
              <p class="mt-1 text-xs text-zinc-500">Pest-masking &amp; nutrient-sharing pairs</p>
            </UCard>

            <UCard>
              <p class="text-xs font-medium text-zinc-500 uppercase">Allelopathic Conflicts</p>
              <p class="mt-2 text-3xl font-bold text-rose-600 dark:text-rose-400">{{ compData.conflicts.length }}</p>
              <p class="mt-1 text-xs text-zinc-500">Pairs requiring separation</p>
            </UCard>
          </div>

          <!-- Pairwise Matrix Heatmap -->
          <UCard v-if="compData.matrix.length">
            <template #header>
              <h3 class="text-base font-semibold text-zinc-900 dark:text-white">Pairwise Compatibility Matrix</h3>
            </template>

            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-zinc-200 text-xs dark:divide-zinc-800">
                <thead>
                  <tr>
                    <th class="py-2 pr-4 text-left font-semibold text-zinc-500">Crop</th>
                    <th v-for="col in compData.species" :key="col.id" class="px-2 py-2 text-center font-semibold text-zinc-700 dark:text-zinc-300">
                      {{ col.common_name }}
                      <span v-if="col.is_candidate" class="text-sky-500">(Sim)</span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  <tr v-for="row in compData.matrix" :key="row.plant_id">
                    <td class="py-2 pr-4 font-semibold text-zinc-900 dark:text-white">
                      {{ row.common_name }}
                      <UBadge v-if="row.is_candidate" color="info" variant="subtle" size="xs" class="ml-1">Sim</UBadge>
                    </td>
                    <td v-for="cell in row.cells" :key="cell.target_id" class="px-2 py-2 text-center">
                      <UBadge
                        v-if="cell.relation === 'SYNERGY'"
                        color="success"
                        variant="soft"
                        size="xs"
                      >
                        +10 Synergy
                      </UBadge>
                      <UBadge
                        v-else-if="cell.relation === 'CONFLICT'"
                        color="error"
                        variant="solid"
                        size="xs"
                      >
                        -25 Conflict
                      </UBadge>
                      <span v-else-if="cell.relation === 'SELF'" class="text-zinc-300 dark:text-zinc-700">&mdash;</span>
                      <span v-else class="text-zinc-500">Neutral</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UCard>

          <!-- Synergies & Conflicts Details -->
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <UCard>
              <template #header>
                <h3 class="text-base font-semibold text-emerald-700 dark:text-emerald-400">Active Synergies</h3>
              </template>
              <div v-if="compData.synergies.length" class="space-y-2 text-xs">
                <div v-for="(s, i) in compData.synergies" :key="i" class="rounded-lg bg-emerald-50/70 p-2.5 dark:bg-emerald-950/40">
                  <div class="font-semibold text-zinc-900 dark:text-white">{{ s.plantA }} + {{ s.plantB }}</div>
                  <div class="text-zinc-600 dark:text-zinc-300">{{ s.reason }}</div>
                </div>
              </div>
              <p v-else class="text-xs text-zinc-500">Add a beneficial companion from the suggestions below to boost your guild score.</p>
            </UCard>

            <UCard>
              <template #header>
                <h3 class="text-base font-semibold text-rose-700 dark:text-rose-400">Conflicts &amp; Relocation Advice</h3>
              </template>
              <div v-if="compData.conflicts.length" class="space-y-2 text-xs">
                <div v-for="(c, i) in compData.conflicts" :key="i" class="rounded-lg bg-rose-50/70 p-2.5 dark:bg-rose-950/40">
                  <div class="font-semibold text-rose-900 dark:text-rose-200">{{ c.plantA }} × {{ c.plantB }}</div>
                  <div class="text-zinc-700 dark:text-zinc-300">{{ c.reason }}</div>
                  <div v-if="c.recommendation" class="mt-1 font-medium text-rose-700 dark:text-rose-300">{{ c.recommendation }}</div>
                </div>
              </div>
              <p v-else class="text-xs text-zinc-500">Zero antagonistic pairings detected in this bed.</p>
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
import api from '../../services/api.js';
import { useGardensStore } from '../../stores/gardens.js';
import { useHorticultureStore } from '../../stores/horticulture.js';
import AlertBellButton from '../../components/AlertBellButton.vue';

const route = useRoute();
const gardensStore = useGardensStore();
const horticultureStore = useHorticultureStore();

const selectedGardenId = ref(null);
const selectedZoneId = ref(null);
const selectedCandidateId = ref('NONE');
const catalogSpecies = ref([]);

const gardenOptions = computed(() =>
  gardensStore.gardens.map((g) => ({ label: g.name, value: g.id }))
);
const zoneOptions = computed(() =>
  gardensStore.zones.map((z) => ({ label: z.name, value: z.id }))
);
const candidateOptions = computed(() => [
  { label: 'No Candidate (Current Bed Only)', value: 'NONE' },
  ...catalogSpecies.value.map((c) => ({ label: `${c.common_name} (${c.category})`, value: String(c.id) }))
]);

const compData = computed(() => horticultureStore.companionsData);

async function loadCompanions() {
  if (!selectedZoneId.value) return;
  const candidateIds = selectedCandidateId.value !== 'NONE' ? [Number(selectedCandidateId.value)] : [];
  try {
    await horticultureStore.fetchZoneCompanions(selectedZoneId.value, candidateIds);
  } catch {
    // surfaced via store
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

watch([selectedZoneId, selectedCandidateId], () => {
  loadCompanions();
});

onMounted(async () => {
  if (!gardensStore.gardens.length) {
    await gardensStore.fetchGardens();
  }
  try {
    const catRes = await api.get('/catalog', { params: { page: 1, limit: 50 } });
    catalogSpecies.value = catRes.data?.data?.plants || [];
  } catch {
    catalogSpecies.value = [];
  }
  const qGardenId = Number(route.query.gardenId);
  if (qGardenId && gardensStore.gardens.some((g) => Number(g.id) === qGardenId)) {
    selectedGardenId.value = qGardenId;
  } else if (gardensStore.gardens.length) {
    selectedGardenId.value = gardensStore.gardens[0].id;
  }
});
</script>
