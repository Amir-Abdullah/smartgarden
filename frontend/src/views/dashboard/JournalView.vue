<template>
  <UDashboardPanel id="journal-view">
    <template #header>
      <UDashboardNavbar title="Growth Journal & Photo Timeline">
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
        <!-- Context Controls -->
        <UCard>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <UFormField label="Garden Plot">
              <USelect
                v-model="selectedGardenId"
                :items="gardenOptions"
                value-key="value"
                placeholder="Select garden"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Tracked Crop">
              <USelect
                v-model="selectedPlantId"
                :items="plantOptions"
                value-key="value"
                placeholder="Select planted crop"
                class="w-full"
              />
            </UFormField>
          </div>
        </UCard>

        <UAlert
          v-if="sprint4Store.error"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="sprint4Store.error"
        />

        <!-- Height Progression Sparkline + Before/After -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <UCard class="lg:col-span-2">
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <div>
                  <h3 class="text-sm font-semibold text-zinc-900 dark:text-white">
                    Plant Height Progression (cm)
                  </h3>
                  <p class="text-xs text-zinc-500 dark:text-zinc-400">
                    {{ plantMeta ? `${plantMeta.common_name} in ${plantMeta.zone_name}` : 'Select a planted crop' }}
                  </p>
                </div>
                <UBadge v-if="heightSeries.length > 0" color="success" variant="soft" size="xs">
                  Latest: {{ heightSeries[heightSeries.length - 1].height_cm }} cm
                </UBadge>
              </div>
            </template>

            <div v-if="heightSeries.length === 0" class="py-8 text-center text-xs text-zinc-500">
              Log entries with plant height measurements to render your growth curve.
            </div>
            <div v-else class="space-y-3">
              <svg viewBox="0 0 560 150" class="h-36 w-full overflow-visible rounded-lg bg-zinc-50 p-2 dark:bg-zinc-900/60">
                <polyline
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="text-emerald-500"
                  :points="chartPoints"
                />
                <g v-for="(pt, idx) in chartDots" :key="idx">
                  <circle :cx="pt.x" :cy="pt.y" r="5" class="fill-emerald-600 stroke-white dark:stroke-zinc-900" stroke-width="2" />
                  <text :x="pt.x" :y="pt.y - 10" text-anchor="middle" class="fill-zinc-600 text-[10px] dark:fill-zinc-300">
                    {{ pt.height }}cm
                  </text>
                </g>
              </svg>
              <div class="flex flex-wrap justify-between gap-2 text-[11px] text-zinc-500">
                <span v-for="pt in heightSeries" :key="pt.entry_id">
                  {{ pt.entry_date }}: <strong>{{ pt.height_cm }} cm</strong>
                </span>
              </div>
            </div>
          </UCard>

          <!-- Log Entry Form -->
          <UCard data-testid="journal-entry-card">
            <template #header>
              <h3 class="text-sm font-semibold text-zinc-900 dark:text-white">
                Log Field Observation
              </h3>
            </template>

            <form class="space-y-3" @submit.prevent="handleCreateEntry">
              <div class="grid grid-cols-2 gap-2.5">
                <UFormField label="Observation Date" required>
                  <UInput v-model="form.entry_date" type="date" class="w-full" required />
                </UFormField>
                <UFormField label="Height (cm)">
                  <UInput v-model="form.height_cm" type="number" step="0.1" min="0" placeholder="e.g. 46.5" class="w-full" />
                </UFormField>
              </div>

              <UFormField label="Field Notes" required>
                <UTextarea
                  v-model="form.note"
                  :rows="3"
                  placeholder="Describe leaf vigor, flowering, moisture or pruning updates..."
                  class="w-full"
                  required
                />
              </UFormField>

              <UFormField label="Photo Snapshot (JPEG / PNG / WEBP)">
                <input
                  ref="fileInputRef"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  class="block w-full text-xs text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100 dark:text-zinc-300 dark:file:bg-emerald-950 dark:file:text-emerald-300"
                  @change="onFileSelected"
                />
              </UFormField>

              <UButton
                type="submit"
                color="primary"
                block
                icon="i-lucide-plus"
                :disabled="!selectedPlantId || submitting"
                :loading="submitting"
              >
                Save Journal Entry
              </UButton>
            </form>
          </UCard>
        </div>

        <!-- Timeline Cards -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-zinc-900 dark:text-white">
                Chronological Growth Timeline
              </h3>
              <UBadge color="neutral" variant="soft" size="xs">
                {{ entries.length }} {{ entries.length === 1 ? 'Entry' : 'Entries' }}
              </UBadge>
            </div>
          </template>

          <div v-if="sprint4Store.journalLoading" class="py-8 text-center text-xs text-zinc-500">
            Loading growth timeline...
          </div>
          <UEmpty
            v-else-if="entries.length === 0"
            icon="i-lucide-notebook-pen"
            title="No observations logged for this crop yet"
            description="Record your first height measurement, pruning note, or photo snapshot above."
          />
          <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div
              v-for="entry in entries"
              :key="entry.id"
              class="flex flex-col justify-between gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div class="space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <UBadge color="primary" variant="soft" size="xs">
                      {{ entry.entry_date }}
                    </UBadge>
                    <UBadge v-if="entry.height_cm !== null" color="success" variant="subtle" size="xs">
                      {{ entry.height_cm }} cm
                    </UBadge>
                  </div>
                  <UButton
                    size="xs"
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    aria-label="Delete entry"
                    @click="handleDelete(entry.id)"
                  />
                </div>

                <img
                  v-if="entry.photo_url"
                  :src="entry.photo_url"
                  alt="Growth snapshot"
                  class="h-44 w-full rounded-lg object-cover border border-zinc-200 dark:border-zinc-800"
                />

                <p class="text-sm text-zinc-700 dark:text-zinc-200">
                  {{ entry.note }}
                </p>
              </div>

              <div class="text-[11px] text-zinc-500">
                Logged by {{ entry.author_name }}
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useToast } from '@nuxt/ui/composables';
import api from '../../services/api.js';
import { useGardensStore } from '../../stores/gardens.js';
import { useSprint4Store } from '../../stores/sprint4.js';
import AlertBellButton from '../../components/AlertBellButton.vue';

const toast = useToast();
const gardensStore = useGardensStore();
const sprint4Store = useSprint4Store();

const selectedGardenId = ref(null);
const selectedPlantId = ref(null);
const availablePlants = ref([]);
const submitting = ref(false);
const fileInputRef = ref(null);
const selectedFile = ref(null);

const form = reactive({
  entry_date: new Date().toISOString().slice(0, 10),
  height_cm: '',
  note: ''
});

const gardenOptions = computed(() =>
  gardensStore.gardens.map((g) => ({ label: g.name, value: String(g.id) }))
);

const plantOptions = computed(() =>
  availablePlants.value.map((p) => ({
    label: `${p.zoneName} — ${p.label}`,
    value: String(p.id)
  }))
);

const plantMeta = computed(() => sprint4Store.plantJournal?.plant || null);
const entries = computed(() => sprint4Store.plantJournal?.entries || []);
const heightSeries = computed(() => sprint4Store.plantJournal?.height_series || []);

const chartDots = computed(() => {
  const pts = heightSeries.value;
  if (pts.length === 0) return [];
  const width = 520;
  const height = 100;
  const maxH = Math.max(...pts.map((p) => p.height_cm), 10);
  const minH = Math.min(...pts.map((p) => p.height_cm), 0);
  const span = Math.max(maxH - minH, 1);

  return pts.map((p, idx) => {
    const x = pts.length === 1 ? width / 2 + 20 : 25 + (idx / (pts.length - 1)) * width;
    const y = 25 + height - ((p.height_cm - minH) / span) * height;
    return { x, y, height: p.height_cm, date: p.entry_date };
  });
});

const chartPoints = computed(() => chartDots.value.map((d) => `${d.x},${d.y}`).join(' '));

function onFileSelected(event) {
  selectedFile.value = event.target?.files?.[0] || null;
}

async function loadPlantsForGarden(gardenId) {
  if (!gardenId) return;
  const detail = await gardensStore.fetchGardenDetail(Number(gardenId));
  const zones = detail.zones || [];
  const all = [];
  for (const z of zones) {
    try {
      const res = await api.get(`/zones/${z.id}/plants`);
      const plants = res.data?.data?.plants || [];
      for (const p of plants) {
        all.push({
          id: p.id,
          zoneName: z.name,
          label: p.custom_nickname || p.catalog_plant?.common_name || p.catalogPlant?.common_name || `Crop #${p.id}`
        });
      }
    } catch {
      // ignore empty/unreadable zone
    }
  }
  availablePlants.value = all;
  if (all.length > 0) {
    selectedPlantId.value = String(all[0].id);
  } else {
    selectedPlantId.value = null;
    sprint4Store.plantJournal = null;
  }
}

async function handleCreateEntry() {
  if (!selectedPlantId.value || !form.note.trim()) return;
  submitting.value = true;
  try {
    let payload;
    if (selectedFile.value) {
      const fd = new FormData();
      fd.append('entry_date', form.entry_date);
      if (form.height_cm !== '') fd.append('height_cm', String(form.height_cm));
      fd.append('note', form.note.trim());
      fd.append('photo', selectedFile.value);
      payload = fd;
    } else {
      payload = {
        entry_date: form.entry_date,
        height_cm: form.height_cm !== '' ? Number(form.height_cm) : null,
        note: form.note.trim()
      };
    }

    await sprint4Store.createJournalEntry(Number(selectedPlantId.value), payload);
    form.note = '';
    form.height_cm = '';
    selectedFile.value = null;
    if (fileInputRef.value) fileInputRef.value.value = '';
    toast.add({
      title: 'Journal Entry Saved',
      description: 'Observation added to crop growth timeline.',
      color: 'success',
      icon: 'i-lucide-check-circle-2'
    });
  } catch (err) {
    toast.add({
      title: 'Save Failed',
      description: err?.response?.data?.error?.message || 'Unable to save journal entry.',
      color: 'error'
    });
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(entryId) {
  if (!selectedPlantId.value) return;
  try {
    await sprint4Store.deleteJournalEntry(Number(selectedPlantId.value), entryId);
    toast.add({ title: 'Journal Entry Removed', color: 'neutral' });
  } catch {
    toast.add({ title: 'Delete Failed', color: 'error' });
  }
}

watch(selectedGardenId, (val) => {
  if (val) loadPlantsForGarden(val);
});

watch(selectedPlantId, (val) => {
  if (val) sprint4Store.fetchPlantJournal(Number(val)).catch(() => {});
});

onMounted(async () => {
  const gardens = await gardensStore.fetchGardens().catch(() => []);
  if (gardens.length > 0) {
    const primary = [...gardens].sort((a, b) => Number(a.id) - Number(b.id))[0];
    selectedGardenId.value = String(primary.id);
  }
});
</script>
