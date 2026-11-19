<template>
  <div :class="isDashboard ? 'space-y-6' : 'py-10 lg:py-12'">
    <component :is="isDashboard ? 'div' : UContainerComponent" :class="isDashboard ? 'space-y-6' : 'space-y-6'">
      <!-- Header -->
      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <UBadge color="primary" variant="subtle" size="sm" class="mb-2">
            F4 &bull; Botanical Encyclopedia
          </UBadge>
          <h1 class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
            Botanical Plant Catalog
          </h1>
          <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Browse {{ displayTotal }} reference species with moisture/temperature ideals, spacing footprints, and companion compatibility.
          </p>
        </div>

        <UButton
          v-if="!authStore.isAuthenticated"
          :to="`/login?redirect=${encodeURIComponent($route.fullPath)}`"
          color="primary"
          variant="soft"
          icon="i-lucide-log-in"
          size="sm"
        >
          Sign in for full 32+ species
        </UButton>
      </div>

      <!-- Public Preview Banner when Unauthenticated -->
      <UAlert
        v-if="!authStore.isAuthenticated || fallbackMode"
        color="primary"
        variant="subtle"
        icon="i-lucide-sparkles"
        title="Showing Public Reference Preview"
        description="Sign in to access all 32+ seeded botanical profiles, filter the live database, and assign plants directly to your garden zones."
      >
        <template #actions>
          <div class="flex items-center gap-2">
            <UButton to="/login" size="xs" color="primary">
              Sign in
            </UButton>
            <UButton to="/register" size="xs" color="neutral" variant="outline">
              Create account
            </UButton>
          </div>
        </template>
      </UAlert>

      <!-- Filters Card -->
      <UCard>
        <div class="space-y-4">
          <div class="flex flex-col gap-3 md:flex-row md:items-center">
            <UInput
              v-model="searchQuery"
              icon="i-lucide-search"
              placeholder="Search by common or scientific name (e.g. Tomato, Solanum, Basil)..."
              class="flex-1"
              @keyup.enter="applyFilters(1)"
            />
            <USelect
              v-model="selectedSunlight"
              :items="sunlightItems"
              value-key="value"
              placeholder="All Sunlight Levels"
              class="w-full md:w-56"
              @update:model-value="applyFilters(1)"
            />
            <div class="flex items-center gap-2">
              <UButton color="primary" icon="i-lucide-search" @click="applyFilters(1)">
                Search
              </UButton>
              <UButton color="neutral" variant="outline" @click="resetFilters">
                Reset
              </UButton>
            </div>
          </div>

          <!-- Category Tabs / Chips -->
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="cat in categories"
              :key="cat.value"
              size="xs"
              :color="selectedCategory === cat.value ? 'primary' : 'neutral'"
              :variant="selectedCategory === cat.value ? 'solid' : 'soft'"
              :icon="cat.icon"
              @click="selectCategory(cat.value)"
            >
              {{ cat.label }}
            </UButton>
          </div>
        </div>
      </UCard>

      <!-- Error Alert (non-401) -->
      <UAlert
        v-if="loadError"
        color="error"
        variant="soft"
        icon="i-lucide-alert-triangle"
        :title="loadError"
      />

      <!-- Loading Skeleton -->
      <div v-if="isLoading" class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <UCard v-for="n in 6" :key="n">
          <USkeleton class="mb-2 h-5 w-1/2" />
          <USkeleton class="mb-4 h-3 w-1/3" />
          <USkeleton class="mb-4 h-12 w-full" />
          <USkeleton class="h-16 w-full" />
        </UCard>
      </div>

      <!-- Empty State -->
      <UEmpty
        v-else-if="displayedPlants.length === 0"
        icon="i-lucide-sprout"
        title="No matching plant species"
        description="Try clearing your search term or switching sunlight and category filters."
        :actions="[{ label: 'Reset filters', color: 'primary', variant: 'soft', onClick: resetFilters }]"
      />

      <!-- Plant Cards Grid -->
      <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <UPageCard
          v-for="plant in displayedPlants"
          :key="plant.id || plant.scientific_name"
          :title="plant.common_name"
          :description="plant.description"
          variant="outline"
          spotlight
          spotlight-color="primary"
          class="cursor-pointer"
          @click="openPlantDetail(plant)"
        >
          <template #header>
            <div class="flex items-start justify-between gap-2">
              <span class="text-xs italic text-zinc-500 dark:text-zinc-400">
                {{ plant.scientific_name }}
              </span>
              <UBadge color="primary" variant="soft" size="xs">
                {{ plant.category }}
              </UBadge>
            </div>
          </template>

          <template #footer>
            <div class="w-full space-y-3">
              <div class="grid grid-cols-2 gap-2 rounded-lg bg-zinc-50 p-2.5 text-xs text-zinc-600 dark:bg-zinc-900/70 dark:text-zinc-300">
                <div class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-sun" class="size-3.5 text-amber-500" />
                  <span>{{ formatSunlight(plant.sunlight_req) }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-droplets" class="size-3.5 text-sky-500" />
                  <span>{{ plant.ideal_moisture_min }}&ndash;{{ plant.ideal_moisture_max }}%</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-thermometer" class="size-3.5 text-rose-500" />
                  <span>{{ plant.ideal_temp_min }}&ndash;{{ plant.ideal_temp_max }}&deg;C</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-ruler" class="size-3.5 text-emerald-500" />
                  <span>{{ plant.spacing_cm }} &times; {{ plant.row_spacing_cm }} cm</span>
                </div>
              </div>

              <div
                v-if="plant.good_companions && plant.good_companions.length"
                class="flex items-center gap-1.5 truncate text-xs text-zinc-500 dark:text-zinc-400"
              >
                <UIcon name="i-lucide-heart-handshake" class="size-3.5 shrink-0 text-emerald-500" />
                <span class="truncate">Companions: {{ plant.good_companions.slice(0, 3).join(', ') }}</span>
              </div>

              <div v-if="canAddToZone" class="flex items-center justify-end pt-1">
                <UButton
                  size="xs"
                  color="primary"
                  variant="soft"
                  icon="i-lucide-plus"
                  @click.stop="openAddToZoneModal(plant)"
                >
                  Add to zone
                </UButton>
              </div>
            </div>
          </template>
        </UPageCard>
      </div>

      <!-- Pagination -->
      <div v-if="displayTotal > pageLimit" class="flex flex-col items-center justify-between gap-3 pt-2 sm:flex-row">
        <p class="text-xs text-zinc-500 dark:text-zinc-400">
          Page <strong>{{ currentPage }}</strong> of <strong>{{ displayTotalPages }}</strong> ({{ displayTotal }} species)
        </p>
        <UPagination
          v-model:page="currentPage"
          :total="displayTotal"
          :items-per-page="pageLimit"
          @update:page="handlePageChange"
        />
      </div>
    </component>

    <!-- Plant Detail Modal -->
    <UModal
      v-model:open="isDetailOpen"
      :title="selectedPlant?.common_name || 'Plant Details'"
      :description="selectedPlant?.scientific_name || ''"
    >
      <template #body>
        <div v-if="selectedPlant" class="space-y-4">
          <div class="flex flex-wrap items-center gap-2">
            <UBadge color="primary" variant="soft">{{ selectedPlant.category }}</UBadge>
            <UBadge color="neutral" variant="subtle">{{ formatSunlight(selectedPlant.sunlight_req) }}</UBadge>
          </div>

          <p v-if="selectedPlant.description" class="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            {{ selectedPlant.description }}
          </p>

          <div class="grid grid-cols-1 gap-2.5 rounded-xl bg-zinc-50 p-4 text-xs dark:bg-zinc-900 sm:grid-cols-2">
            <div><strong class="text-zinc-700 dark:text-zinc-200">Watering Cadence:</strong> Every {{ selectedPlant.watering_freq_days }} days</div>
            <div><strong class="text-zinc-700 dark:text-zinc-200">Fertilizing Cadence:</strong> Every {{ selectedPlant.fertilizing_freq_days }} days</div>
            <div><strong class="text-zinc-700 dark:text-zinc-200">Ideal Moisture:</strong> {{ selectedPlant.ideal_moisture_min }}% &ndash; {{ selectedPlant.ideal_moisture_max }}%</div>
            <div><strong class="text-zinc-700 dark:text-zinc-200">Ideal Temp:</strong> {{ selectedPlant.ideal_temp_min }}&deg;C &ndash; {{ selectedPlant.ideal_temp_max }}&deg;C</div>
            <div><strong class="text-zinc-700 dark:text-zinc-200">Plant / Row Spacing:</strong> {{ selectedPlant.spacing_cm }} cm / {{ selectedPlant.row_spacing_cm }} cm</div>
            <div><strong class="text-zinc-700 dark:text-zinc-200">Min Soil Depth:</strong> {{ selectedPlant.min_soil_depth_cm }} cm</div>
            <div class="sm:col-span-2"><strong class="text-zinc-700 dark:text-zinc-200">Soil Preference:</strong> {{ selectedPlant.soil_pref }}</div>
          </div>

          <div class="space-y-2.5 text-sm">
            <div>
              <div class="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                <UIcon name="i-lucide-check-circle-2" class="size-4" />
                <span>Synergistic Companions</span>
              </div>
              <p class="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                {{ (selectedPlant.good_companions || []).join(', ') || 'None listed' }}
              </p>
            </div>
            <div>
              <div class="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                <UIcon name="i-lucide-alert-triangle" class="size-4" />
                <span>Antagonistic Plants (Avoid)</span>
              </div>
              <p class="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                {{ (selectedPlant.bad_companions || []).join(', ') || 'None listed' }}
              </p>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full items-center justify-end gap-2">
          <UButton color="neutral" variant="outline" @click="isDetailOpen = false">
            Close
          </UButton>
          <UButton
            v-if="canAddToZone && selectedPlant"
            color="primary"
            icon="i-lucide-plus"
            @click="switchToAddZone(selectedPlant)"
          >
            Add to zone
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Add to Zone Modal (Dashboard / Authenticated) -->
    <UModal
      v-model:open="isAddZoneOpen"
      :title="`Add ${plantToAssign?.common_name || 'Plant'} to Zone`"
      description="Choose a garden and microclimate zone to allocate this species."
    >
      <template #body>
        <div class="space-y-4">
          <UAlert
            v-if="assignError"
            color="error"
            variant="soft"
            icon="i-lucide-alert-circle"
            :title="assignError"
          />

          <div v-if="loadingGardens" class="space-y-2">
            <USkeleton class="h-9 w-full" />
            <USkeleton class="h-9 w-full" />
          </div>

          <UAlert
            v-else-if="gardenOptions.length === 0"
            color="warning"
            variant="soft"
            icon="i-lucide-trees"
            title="No gardens found"
            description="Create a garden and microclimate zone first before assigning crops."
          >
            <template #actions>
              <UButton to="/dashboard/gardens" size="xs" color="primary" @click="isAddZoneOpen = false">
                Go to Gardens
              </UButton>
            </template>
          </UAlert>

          <template v-else>
            <UFormField label="Garden" required>
              <USelect
                v-model="selectedGardenId"
                :items="gardenOptions"
                value-key="value"
                placeholder="Select a garden"
                class="w-full"
                @update:model-value="handleGardenChange"
              />
            </UFormField>

            <UFormField label="Zone" required>
              <USelect
                v-model="selectedZoneId"
                :items="zoneOptions"
                value-key="value"
                :placeholder="loadingZones ? 'Loading zones...' : 'Select a zone'"
                :disabled="loadingZones || zoneOptions.length === 0"
                class="w-full"
              />
            </UFormField>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UFormField label="Quantity" required>
                <UInput
                  v-model.number="assignQuantity"
                  type="number"
                  min="1"
                  max="500"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Nickname (Optional)">
                <UInput
                  v-model="assignNickname"
                  placeholder="e.g. South Bed Tomatoes"
                  class="w-full"
                />
              </UFormField>
            </div>

            <UFormField label="Notes (Optional)">
              <UTextarea
                v-model="assignNotes"
                placeholder="Seed packet lot, trellis notes..."
                :rows="2"
                class="w-full"
              />
            </UFormField>
          </template>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full items-center justify-end gap-2">
          <UButton color="neutral" variant="outline" @click="isAddZoneOpen = false">
            Cancel
          </UButton>
          <UButton
            color="primary"
            icon="i-lucide-check"
            :loading="gardensStore.actionLoading"
            :disabled="!selectedZoneId || assignQuantity < 1 || gardensStore.actionLoading"
            @click="submitAddToZone"
          >
            Add to Zone
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, resolveComponent } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { useCatalogStore } from '../../stores/catalog.js';
import { useAuthStore } from '../../stores/auth.js';
import { useGardensStore } from '../../stores/gardens.js';

const UContainerComponent = resolveComponent('UContainer');

const route = useRoute();
const toast = useToast();
const catalogStore = useCatalogStore();
const authStore = useAuthStore();
const gardensStore = useGardensStore();

const ALL_SUNLIGHT = 'ALL';

const searchQuery = ref('');
const selectedCategory = ref('');
const selectedSunlight = ref(ALL_SUNLIGHT);
const currentPage = ref(1);
const pageLimit = 12;

const selectedPlant = ref(null);
const isDetailOpen = ref(false);
const fallbackMode = ref(false);
const loadError = ref('');

// Add-to-zone modal state
const isAddZoneOpen = ref(false);
const plantToAssign = ref(null);
const loadingGardens = ref(false);
const loadingZones = ref(false);
const selectedGardenId = ref(null);
const selectedZoneId = ref(null);
const assignQuantity = ref(1);
const assignNickname = ref('');
const assignNotes = ref('');
const assignError = ref('');

const isDashboard = computed(() => route.path.startsWith('/dashboard'));
const canAddToZone = computed(() => authStore.isAuthenticated && !fallbackMode.value);

const PUBLIC_PREVIEW_PLANTS = [
  {
    id: 1,
    common_name: 'Roma Tomato',
    scientific_name: 'Solanum lycopersicum',
    category: 'VEGETABLE',
    description: 'Compact determinate paste tomato prized for dense sauces and reliable yields.',
    sunlight_req: 'FULL_SUN',
    ideal_moisture_min: 55,
    ideal_moisture_max: 75,
    ideal_temp_min: 18,
    ideal_temp_max: 29,
    watering_freq_days: 2,
    fertilizing_freq_days: 14,
    soil_pref: 'Rich, well-draining loamy soil',
    spacing_cm: 45,
    row_spacing_cm: 60,
    min_soil_depth_cm: 30,
    good_companions: ['Sweet Basil', 'French Marigold', 'Nantes Carrot'],
    bad_companions: ['Fennel', 'Cabbage']
  },
  {
    id: 2,
    common_name: 'Sweet Basil',
    scientific_name: 'Ocimum basilicum',
    category: 'HERB',
    description: 'Aromatic culinary herb that enhances tomato vigor and repels aphids.',
    sunlight_req: 'FULL_SUN',
    ideal_moisture_min: 50,
    ideal_moisture_max: 70,
    ideal_temp_min: 18,
    ideal_temp_max: 30,
    watering_freq_days: 2,
    fertilizing_freq_days: 21,
    soil_pref: 'Moist, fertile sandy loam',
    spacing_cm: 25,
    row_spacing_cm: 30,
    min_soil_depth_cm: 20,
    good_companions: ['Roma Tomato', 'Bell Pepper'],
    bad_companions: ['Rue', 'Sage']
  },
  {
    id: 3,
    common_name: 'Nantes Carrot',
    scientific_name: 'Daucus carota',
    category: 'VEGETABLE',
    description: 'Sweet cylindrical root crop suited to deep, loose sandy loam beds.',
    sunlight_req: 'FULL_SUN',
    ideal_moisture_min: 45,
    ideal_moisture_max: 65,
    ideal_temp_min: 10,
    ideal_temp_max: 24,
    watering_freq_days: 3,
    fertilizing_freq_days: 28,
    soil_pref: 'Deep, stone-free sandy loam',
    spacing_cm: 8,
    row_spacing_cm: 25,
    min_soil_depth_cm: 30,
    good_companions: ['Roma Tomato', 'Chives', 'Butterhead Lettuce'],
    bad_companions: ['Dill', 'Parsnip']
  },
  {
    id: 4,
    common_name: 'English Lavender',
    scientific_name: 'Lavandula angustifolia',
    category: 'HERB',
    description: 'Drought-tolerant perennial pollinator magnet with fragrant purple spikes.',
    sunlight_req: 'FULL_SUN',
    ideal_moisture_min: 25,
    ideal_moisture_max: 45,
    ideal_temp_min: 12,
    ideal_temp_max: 28,
    watering_freq_days: 7,
    fertilizing_freq_days: 45,
    soil_pref: 'Lean, fast-draining alkaline soil',
    spacing_cm: 40,
    row_spacing_cm: 50,
    min_soil_depth_cm: 25,
    good_companions: ['Rosemary', 'Alpine Strawberry'],
    bad_companions: ['Mint']
  },
  {
    id: 5,
    common_name: 'Alpine Strawberry',
    scientific_name: 'Fragaria vesca',
    category: 'FRUIT',
    description: 'Compact, runner-free strawberry thriving in bright morning sun and partial afternoon shade.',
    sunlight_req: 'PART_SHADE',
    ideal_moisture_min: 55,
    ideal_moisture_max: 75,
    ideal_temp_min: 12,
    ideal_temp_max: 24,
    watering_freq_days: 2,
    fertilizing_freq_days: 21,
    soil_pref: 'Slightly acidic, humus-rich loam',
    spacing_cm: 25,
    row_spacing_cm: 35,
    min_soil_depth_cm: 20,
    good_companions: ['Borage', 'Chives', 'Spinach'],
    bad_companions: ['Cabbage', 'Broccoli']
  },
  {
    id: 6,
    common_name: 'French Marigold',
    scientific_name: 'Tagetes patula',
    category: 'FLOWER',
    description: 'Vibrant border flower that deters root-knot nematodes and attracts beneficial hoverflies.',
    sunlight_req: 'FULL_SUN',
    ideal_moisture_min: 40,
    ideal_moisture_max: 60,
    ideal_temp_min: 15,
    ideal_temp_max: 30,
    watering_freq_days: 3,
    fertilizing_freq_days: 30,
    soil_pref: 'Moderately fertile, well-draining loam',
    spacing_cm: 20,
    row_spacing_cm: 25,
    min_soil_depth_cm: 18,
    good_companions: ['Roma Tomato', 'Bell Pepper', 'Cucumber'],
    bad_companions: ['Pole Bean']
  },
  {
    id: 7,
    common_name: 'Boston Fern',
    scientific_name: 'Nephrolepis exaltata',
    category: 'FOLIAGE',
    description: 'Lush shade-loving foliage plant ideal for humid indoor corners and shaded patios.',
    sunlight_req: 'FULL_SHADE',
    ideal_moisture_min: 60,
    ideal_moisture_max: 80,
    ideal_temp_min: 16,
    ideal_temp_max: 25,
    watering_freq_days: 2,
    fertilizing_freq_days: 30,
    soil_pref: 'Peat-rich, moisture-retentive potting mix',
    spacing_cm: 35,
    row_spacing_cm: 40,
    min_soil_depth_cm: 20,
    good_companions: ['Peace Lily'],
    bad_companions: ['Aloe Vera']
  },
  {
    id: 8,
    common_name: 'Aloe Vera',
    scientific_name: 'Aloe barbadensis miller',
    category: 'SUCCULENT',
    description: 'Hardy medicinal succulent storing water in thick leaves; requires minimal irrigation.',
    sunlight_req: 'FULL_SUN',
    ideal_moisture_min: 15,
    ideal_moisture_max: 35,
    ideal_temp_min: 15,
    ideal_temp_max: 32,
    watering_freq_days: 10,
    fertilizing_freq_days: 60,
    soil_pref: 'Coarse cactus and succulent grit',
    spacing_cm: 30,
    row_spacing_cm: 35,
    min_soil_depth_cm: 18,
    good_companions: ['Echeveria'],
    bad_companions: ['Boston Fern']
  }
];

const categories = [
  { label: 'All Plants', value: '', icon: 'i-lucide-layers' },
  { label: 'Vegetables', value: 'VEGETABLE', icon: 'i-lucide-carrot' },
  { label: 'Herbs', value: 'HERB', icon: 'i-lucide-leaf' },
  { label: 'Fruits', value: 'FRUIT', icon: 'i-lucide-cherry' },
  { label: 'Flowers', value: 'FLOWER', icon: 'i-lucide-flower-2' },
  { label: 'Foliage', value: 'FOLIAGE', icon: 'i-lucide-trees' },
  { label: 'Succulents', value: 'SUCCULENT', icon: 'i-lucide-sun' }
];

const sunlightItems = [
  { label: 'All Sunlight Levels', value: ALL_SUNLIGHT },
  { label: 'Full Sun (6+ hrs)', value: 'FULL_SUN' },
  { label: 'Part Shade (3–6 hrs)', value: 'PART_SHADE' },
  { label: 'Full Shade (< 3 hrs)', value: 'FULL_SHADE' }
];

const effectiveSunlight = computed(() =>
  selectedSunlight.value === ALL_SUNLIGHT ? '' : selectedSunlight.value
);

const isLoading = computed(() => catalogStore.loading);

const filteredPreviewPlants = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return PUBLIC_PREVIEW_PLANTS.filter((p) => {
    if (selectedCategory.value && p.category !== selectedCategory.value) return false;
    if (effectiveSunlight.value && p.sunlight_req !== effectiveSunlight.value) return false;
    if (q) {
      const match =
        p.common_name.toLowerCase().includes(q) ||
        p.scientific_name.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
});

const displayedPlants = computed(() => {
  if (!authStore.isAuthenticated || fallbackMode.value) {
    const start = (currentPage.value - 1) * pageLimit;
    return filteredPreviewPlants.value.slice(start, start + pageLimit);
  }
  return catalogStore.plants;
});

const displayTotal = computed(() => {
  if (!authStore.isAuthenticated || fallbackMode.value) {
    return filteredPreviewPlants.value.length;
  }
  return catalogStore.total || catalogStore.plants.length;
});

const displayTotalPages = computed(() => {
  if (!authStore.isAuthenticated || fallbackMode.value) {
    return Math.max(1, Math.ceil(filteredPreviewPlants.value.length / pageLimit));
  }
  return catalogStore.totalPages || 1;
});

const gardenOptions = computed(() =>
  gardensStore.gardens.map((g) => ({
    label: g.name,
    value: g.id
  }))
);

const zoneOptions = computed(() =>
  gardensStore.zones.map((z) => ({
    label: `${z.name} (${Number(z.area_sq_m || 0).toFixed(1)} m²)`,
    value: z.id
  }))
);

onMounted(() => {
  applyFilters(1);
});

async function applyFilters(targetPage = 1) {
  currentPage.value = targetPage;
  loadError.value = '';

  if (!authStore.isAuthenticated) {
    fallbackMode.value = true;
    return;
  }

  catalogStore.filters.q = searchQuery.value;
  catalogStore.filters.category = selectedCategory.value;
  catalogStore.filters.sunlight = effectiveSunlight.value;
  catalogStore.page = targetPage;
  catalogStore.limit = pageLimit;

  try {
    await catalogStore.fetchCatalog({
      page: targetPage,
      limit: pageLimit,
      q: searchQuery.value,
      category: selectedCategory.value,
      sunlight: effectiveSunlight.value
    });
    fallbackMode.value = false;
  } catch (err) {
    if (err.response?.status === 401) {
      fallbackMode.value = true;
      loadError.value = '';
    } else {
      loadError.value = catalogStore.error || 'Failed to load plant catalog.';
    }
  }
}

function selectCategory(cat) {
  selectedCategory.value = cat;
  applyFilters(1);
}

function resetFilters() {
  searchQuery.value = '';
  selectedCategory.value = '';
  selectedSunlight.value = ALL_SUNLIGHT;
  applyFilters(1);
}

function handlePageChange(page) {
  applyFilters(page);
}

function openPlantDetail(plant) {
  selectedPlant.value = plant;
  isDetailOpen.value = true;
}

function formatSunlight(val) {
  const map = {
    FULL_SUN: 'Full Sun',
    PART_SHADE: 'Part Shade',
    FULL_SHADE: 'Full Shade'
  };
  return map[val] || val;
}

async function openAddToZoneModal(plant) {
  plantToAssign.value = plant;
  assignError.value = '';
  assignQuantity.value = 1;
  assignNickname.value = '';
  assignNotes.value = '';
  selectedZoneId.value = null;
  isAddZoneOpen.value = true;

  loadingGardens.value = true;
  try {
    const gardens = await gardensStore.fetchGardens();
    if (gardens.length > 0) {
      selectedGardenId.value = gardens[0].id;
      await handleGardenChange(gardens[0].id);
    }
  } catch (err) {
    assignError.value = err.message || 'Unable to load gardens.';
  } finally {
    loadingGardens.value = false;
  }
}

function switchToAddZone(plant) {
  isDetailOpen.value = false;
  openAddToZoneModal(plant);
}

async function handleGardenChange(gardenId) {
  selectedZoneId.value = null;
  if (!gardenId) return;
  loadingZones.value = true;
  try {
    const detail = await gardensStore.fetchGardenDetail(gardenId);
    const zones = detail.zones || [];
    if (zones.length > 0) {
      selectedZoneId.value = zones[0].id;
    }
  } catch (err) {
    assignError.value = err.message || 'Unable to load zones for selected garden.';
  } finally {
    loadingZones.value = false;
  }
}

async function submitAddToZone() {
  if (!selectedZoneId.value || !plantToAssign.value) return;
  assignError.value = '';
  try {
    const { meta } = await gardensStore.addZonePlant(selectedZoneId.value, {
      plant_catalog_id: plantToAssign.value.id,
      quantity: Number(assignQuantity.value) || 1,
      custom_nickname: assignNickname.value.trim() || undefined,
      planted_date: new Date().toISOString().slice(0, 10),
      status: 'SEEDLING',
      health_status: 'HEALTHY',
      notes: assignNotes.value.trim() || undefined
    });

    isAddZoneOpen.value = false;
    if (meta && meta.warning) {
      toast.add({
        title: `${plantToAssign.value.common_name} added (${meta.warning})`,
        description: meta.message || 'Zone capacity exceeded 100%.',
        icon: 'i-lucide-alert-triangle',
        color: 'warning'
      });
    } else {
      toast.add({
        title: `${plantToAssign.value.common_name} added to zone`,
        description: `Allocated ${assignQuantity.value} plant(s) successfully.`,
        icon: 'i-lucide-check-circle-2',
        color: 'success'
      });
    }
  } catch (err) {
    assignError.value = gardensStore.error || err.message || 'Failed to add plant to zone.';
  }
}
</script>
