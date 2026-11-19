<template>
  <UDashboardPanel id="zone-plants">
    <template #header>
      <UDashboardNavbar :title="zone?.name || 'Zone Crop Inventory'">
        <template #leading>
          <UDashboardSidebarCollapse />
          <UBreadcrumb :items="breadcrumbItems" class="hidden sm:flex" />
        </template>
        <template #right>
          <UColorModeButton />
          <UButton
            v-if="canEditPlants"
            color="primary"
            size="sm"
            icon="i-lucide-plus"
            @click="openAddPlantModal"
          >
            Assign Plant
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <div class="sm:hidden">
          <UBreadcrumb :items="breadcrumbItems" />
        </div>

        <UAlert
          v-if="gardensStore.error"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="gardensStore.error"
        />

        <!-- Capacity Overcrowded Warning Banner -->
        <UAlert
          v-if="isOvercrowded"
          color="error"
          variant="subtle"
          icon="i-lucide-alert-triangle"
          :title="`ZONE_OVERCROWDED (${utilizationPct}% Bed Capacity)`"
          :description="overcrowdedMessage"
        />

        <!-- Zone Summary & Spatial Utilization -->
        <UCard v-if="zone">
          <div class="space-y-5">
            <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div class="space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                    {{ zone.name }}
                  </h2>
                  <UBadge :color="zone.is_outdoor ? 'warning' : 'info'" variant="subtle" size="sm">
                    {{ zone.is_outdoor ? 'Outdoor' : 'Indoor' }}
                  </UBadge>
                  <UBadge color="neutral" variant="outline" size="sm">
                    {{ formatEnum(zone.zone_type) }}
                  </UBadge>
                </div>
                <div class="flex flex-wrap gap-2 text-xs">
                  <UBadge color="neutral" variant="subtle" size="xs" icon="i-lucide-layers">
                    Soil: {{ formatEnum(zone.soil_type) }}
                  </UBadge>
                  <UBadge color="neutral" variant="subtle" size="xs" icon="i-lucide-sun">
                    Light: {{ formatEnum(zone.sunlight_level) }}
                  </UBadge>
                  <UBadge color="neutral" variant="subtle" size="xs" icon="i-lucide-ruler">
                    Area: {{ Number(zone.area_sq_m || 0).toFixed(2) }} m&sup2;
                  </UBadge>
                </div>
              </div>

              <UButton
                v-if="canEditPlants"
                color="primary"
                icon="i-lucide-plus"
                @click="openAddPlantModal"
              >
                Assign Plant to Zone
              </UButton>
            </div>

            <!-- Spatial Utilization UProgress -->
            <div v-if="utilization" class="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div class="text-zinc-700 dark:text-zinc-300">
                  <strong class="text-zinc-900 dark:text-white">Bed Space Utilization:</strong>
                  {{ utilization.occupied_area_sq_m }} m&sup2; / {{ utilization.zone_area_sq_m }} m&sup2;
                  ({{ utilizationPct }}%)
                </div>
                <UBadge
                  :color="isOvercrowded ? 'error' : isDense ? 'warning' : 'success'"
                  variant="soft"
                  size="sm"
                >
                  {{ utilization.status || 'OPTIMAL' }}
                </UBadge>
              </div>

              <UProgress
                :model-value="Math.min(100, utilizationPct)"
                :max="100"
                :color="isOvercrowded ? 'error' : isDense ? 'warning' : 'primary'"
                size="md"
              />
            </div>
          </div>
        </UCard>

        <!-- Companion Analysis Cards -->
        <div v-if="companions" class="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <UCard>
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                  Guild Compatibility Score
                </p>
                <p class="mt-1 text-3xl font-bold text-zinc-900 dark:text-white">
                  {{ companions.overallCompatibilityScore }}<span class="text-base font-normal text-zinc-400">/100</span>
                </p>
              </div>
              <div class="flex size-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <UIcon name="i-lucide-heart-handshake" class="size-5" />
              </div>
            </div>
            <UProgress
              class="mt-3"
              :model-value="companions.overallCompatibilityScore"
              :max="100"
              :color="companions.overallCompatibilityScore >= 70 ? 'primary' : companions.overallCompatibilityScore >= 40 ? 'warning' : 'error'"
              size="sm"
            />
          </UCard>

          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  <UIcon name="i-lucide-check-circle-2" class="size-4" />
                  <span>Companion Synergies</span>
                </div>
                <UBadge color="success" variant="soft" size="xs">
                  {{ companions.synergies?.length || 0 }}
                </UBadge>
              </div>
            </template>

            <ul v-if="companions.synergies && companions.synergies.length" class="space-y-2 text-xs">
              <li
                v-for="(syn, idx) in companions.synergies"
                :key="idx"
                class="rounded-lg bg-emerald-50/70 p-2.5 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
              >
                <strong>{{ syn.plantA }} + {{ syn.plantB }}</strong>
                <p v-if="syn.reason" class="mt-0.5 text-emerald-700 dark:text-emerald-300">{{ syn.reason }}</p>
              </li>
            </ul>
            <p v-else class="text-xs text-zinc-500 dark:text-zinc-400">
              No companion synergies detected yet. Add complementary herbs or flowers to boost guild score.
            </p>
          </UCard>

          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-400">
                  <UIcon name="i-lucide-alert-triangle" class="size-4" />
                  <span>Antagonistic Conflicts</span>
                </div>
                <UBadge :color="companions.conflicts?.length ? 'error' : 'neutral'" variant="soft" size="xs">
                  {{ companions.conflicts?.length || 0 }}
                </UBadge>
              </div>
            </template>

            <ul v-if="companions.conflicts && companions.conflicts.length" class="space-y-2 text-xs">
              <li
                v-for="(con, idx) in companions.conflicts"
                :key="idx"
                class="rounded-lg bg-rose-50/80 p-2.5 text-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
              >
                <strong>{{ con.plantA }} vs {{ con.plantB }}</strong>
                <p v-if="con.reason" class="mt-0.5 text-rose-700 dark:text-rose-300">{{ con.reason }}</p>
              </li>
            </ul>
            <p v-else class="text-xs text-zinc-500 dark:text-zinc-400">
              No antagonistic plant pairings detected in this bed.
            </p>
          </UCard>
        </div>

        <!-- Crop Inventory Table -->
        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 class="text-base font-semibold text-zinc-900 dark:text-white">
                  Zone Crop Inventory
                </h3>
                <p class="text-xs text-zinc-500 dark:text-zinc-400">
                  Active plant allocations, growth stages, and expected harvest windows
                </p>
              </div>
              <UButton
                v-if="canEditPlants"
                size="xs"
                color="primary"
                variant="soft"
                icon="i-lucide-plus"
                @click="openAddPlantModal"
              >
                Assign Plant
              </UButton>
            </div>
          </template>

          <div v-if="gardensStore.loading" class="space-y-3 py-2">
            <USkeleton class="h-10 w-full" />
            <USkeleton class="h-10 w-full" />
          </div>

          <UEmpty
            v-else-if="gardensStore.zonePlants.length === 0"
            icon="i-lucide-sprout"
            title="No plants assigned to this zone yet"
            description="Select species from the botanical catalog to track growth status, spacing utilization, and harvest countdowns."
            :actions="
              canEditPlants
                ? [{ label: 'Assign First Crop', color: 'primary', icon: 'i-lucide-plus', onClick: openAddPlantModal }]
                : []
            "
          />

          <UTable v-else :data="gardensStore.zonePlants" :columns="inventoryColumns">
            <template #species-cell="{ row }">
              <div class="min-w-0">
                <div class="font-semibold text-zinc-900 dark:text-white">
                  {{ row.original.custom_nickname || row.original.common_name || `Plant #${row.original.plant_catalog_id}` }}
                </div>
                <div class="text-xs text-zinc-500 dark:text-zinc-400">
                  {{ row.original.common_name }}
                  <span v-if="row.original.scientific_name" class="italic">({{ row.original.scientific_name }})</span>
                </div>
                <p v-if="row.original.notes" class="mt-0.5 truncate text-xs text-zinc-400">
                  {{ row.original.notes }}
                </p>
              </div>
            </template>

            <template #quantity-cell="{ row }">
              <span class="font-medium text-zinc-800 dark:text-zinc-200">{{ row.original.quantity }}</span>
            </template>

            <template #status-cell="{ row }">
              <UBadge :color="plantStatusColor(row.original.status)" variant="soft" size="xs">
                {{ row.original.status || 'GROWING' }}
              </UBadge>
            </template>

            <template #health_status-cell="{ row }">
              <UBadge :color="healthColor(row.original.health_status)" variant="subtle" size="xs">
                {{ row.original.health_status || 'HEALTHY' }}
              </UBadge>
            </template>

            <template #dates-cell="{ row }">
              <div class="text-xs text-zinc-600 dark:text-zinc-300">
                <div>Planted: {{ toDateInputValue(row.original.planted_date) || '—' }} ({{ row.original.days_since_planted || 0 }}d)</div>
                <div
                  v-if="row.original.expected_harvest_date"
                  class="text-zinc-500 dark:text-zinc-400"
                >
                  Harvest: {{ toDateInputValue(row.original.expected_harvest_date) }}
                  <span v-if="row.original.days_until_harvest !== null && row.original.days_until_harvest !== undefined">
                    ({{ row.original.days_until_harvest >= 0 ? `in ${row.original.days_until_harvest}d` : `${Math.abs(row.original.days_until_harvest)}d overdue` }})
                  </span>
                </div>
              </div>
            </template>

            <template #actions-cell="{ row }">
              <div v-if="canEditPlants" class="flex justify-end gap-1.5">
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-pencil"
                  aria-label="Edit plant"
                  @click="openEditPlantModal(row.original)"
                />
                <UButton
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  aria-label="Remove plant"
                  @click="confirmRemovePlant(row.original)"
                />
              </div>
            </template>
          </UTable>
        </UCard>

        <!-- Coming Soon Widgets: Care Schedule (F6) & Sensor Readings (F7) -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <UCard
            class="cursor-pointer transition-colors hover:border-emerald-400 dark:hover:border-emerald-700"
            @click="open('F6')"
          >
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-check-square" class="size-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 class="text-sm font-semibold text-zinc-900 dark:text-white">
                    Zone Care Schedule
                  </h3>
                </div>
                <UBadge color="primary" variant="subtle" size="xs" icon="i-lucide-clock">
                  Coming in Sprint 2
                </UBadge>
              </div>
            </template>
            <p class="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Automated watering, fertilizing, and pruning schedules tailored to the species assigned to {{ zone?.name || 'this zone' }}.
            </p>
          </UCard>

          <UCard
            class="cursor-pointer transition-colors hover:border-emerald-400 dark:hover:border-emerald-700"
            @click="open('F7')"
          >
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-activity" class="size-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 class="text-sm font-semibold text-zinc-900 dark:text-white">
                    Zone Sensor Readings
                  </h3>
                </div>
                <UBadge color="primary" variant="subtle" size="xs" icon="i-lucide-clock">
                  Coming in Sprint 2
                </UBadge>
              </div>
            </template>
            <p class="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Live soil moisture, temperature, humidity, and PAR light streams calibrated to {{ formatEnum(zone?.soil_type) }} beds.
            </p>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Add / Edit Plant Modal -->
  <UModal
    v-model:open="isPlantModalOpen"
    :title="editingPlantId ? 'Update Zone Plant' : 'Assign Catalog Plant to Zone'"
    description="Search the botanical catalog and configure quantity, growth stage, and harvest targets."
  >
    <template #body>
      <form id="zone-plant-form" class="space-y-4" @submit.prevent="handleSavePlant">
        <UAlert
          v-if="plantModalError"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="plantModalError"
        />

        <UFormField v-if="!editingPlantId" label="Catalog Species (Live Search)" required>
          <USelectMenu
            v-model="plantForm.plant_catalog_id"
            v-model:search-term="catalogSearch"
            :items="catalogSelectItems"
            value-key="value"
            :loading="catalogStore.loading"
            placeholder="Search by common or scientific name..."
            :search-input="{ placeholder: 'Type e.g. Tomato, Basil, Marigold...' }"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Custom Nickname">
            <UInput
              v-model="plantForm.custom_nickname"
              placeholder="e.g. Heirloom Row A"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Quantity" required>
            <UInput
              v-model.number="plantForm.quantity"
              type="number"
              min="1"
              class="w-full"
              required
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Lifecycle Status">
            <USelect
              v-model="plantForm.status"
              :items="plantStatusOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Health Status">
            <USelect
              v-model="plantForm.health_status"
              :items="healthStatusOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Planted Date" required>
            <UInput v-model="plantForm.planted_date" type="date" class="w-full" required />
          </UFormField>
          <UFormField label="Expected Harvest Date">
            <UInput v-model="plantForm.expected_harvest_date" type="date" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Notes">
          <UTextarea
            v-model="plantForm.notes"
            :rows="2"
            placeholder="Soil amendments, trellising, or pruning notes..."
            class="w-full"
          />
        </UFormField>
      </form>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="isPlantModalOpen = false">
          Cancel
        </UButton>
        <UButton
          type="submit"
          form="zone-plant-form"
          color="primary"
          icon="i-lucide-check"
          :loading="gardensStore.actionLoading"
        >
          {{ editingPlantId ? 'Save Changes' : 'Add to Zone' }}
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- Remove Plant Confirmation Modal -->
  <UModal
    v-model:open="isRemovePlantOpen"
    title="Remove Plant from Zone"
    :description="`Remove '${plantToRemove?.custom_nickname || plantToRemove?.common_name || 'this crop'}' from ${zone?.name || 'the zone'}?`"
  >
    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="isRemovePlantOpen = false">
          Cancel
        </UButton>
        <UButton
          color="error"
          icon="i-lucide-trash-2"
          :loading="gardensStore.actionLoading"
          @click="handleRemovePlant"
        >
          Remove Plant
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { useGardensStore } from '../../stores/gardens.js';
import { useCatalogStore } from '../../stores/catalog.js';
import { useAuthStore } from '../../stores/auth.js';
import { useComingSoon } from '../../composables/useComingSoon.js';

const route = useRoute();
const toast = useToast();
const gardensStore = useGardensStore();
const catalogStore = useCatalogStore();
const authStore = useAuthStore();
const { open } = useComingSoon();

const isPlantModalOpen = ref(false);
const editingPlantId = ref(null);
const plantModalError = ref('');
const catalogSearch = ref('');
let catalogSearchTimer = null;

const isRemovePlantOpen = ref(false);
const plantToRemove = ref(null);

const plantForm = reactive({
  plant_catalog_id: undefined,
  custom_nickname: '',
  quantity: 4,
  planted_date: new Date().toISOString().slice(0, 10),
  expected_harvest_date: '',
  status: 'SEEDLING',
  health_status: 'HEALTHY',
  notes: ''
});

const plantStatusOptions = [
  { label: 'SEEDLING', value: 'SEEDLING' },
  { label: 'GROWING', value: 'GROWING' },
  { label: 'HARVEST_READY', value: 'HARVEST_READY' },
  { label: 'HARVESTED', value: 'HARVESTED' },
  { label: 'DEAD', value: 'DEAD' }
];

const healthStatusOptions = [
  { label: 'HEALTHY', value: 'HEALTHY' },
  { label: 'NEEDS_ATTENTION', value: 'NEEDS_ATTENTION' },
  { label: 'CRITICAL', value: 'CRITICAL' },
  { label: 'DORMANT', value: 'DORMANT' }
];

const zone = computed(() => gardensStore.activeZone);
const utilization = computed(() => gardensStore.zoneUtilization);
const companions = computed(() => gardensStore.companionAnalysis);

const utilizationPct = computed(() =>
  Math.round(Number(utilization.value?.utilization_ratio || 0) * 100)
);

const isOvercrowded = computed(() => {
  return (
    utilizationPct.value > 100 ||
    utilization.value?.status === 'OVERCROWDED' ||
    gardensStore.lastCapacityWarning?.warning === 'ZONE_OVERCROWDED'
  );
});

const isDense = computed(() => !isOvercrowded.value && (utilizationPct.value > 85 || utilization.value?.status === 'DENSE'));

const overcrowdedMessage = computed(() => {
  if (gardensStore.lastCapacityWarning?.message) {
    return gardensStore.lastCapacityWarning.message;
  }
  return `Zone capacity exceeded (${utilizationPct.value}%). Reduce plant quantities or expand bed area to prevent stunted growth and fungal blight.`;
});

const parentGarden = computed(() => {
  if (!zone.value?.garden_id) return gardensStore.activeGarden;
  if (gardensStore.activeGarden?.id === zone.value.garden_id) {
    return gardensStore.activeGarden;
  }
  return gardensStore.gardens.find((g) => g.id === zone.value.garden_id) || null;
});

const canEditPlants = computed(() => {
  if (authStore.isAdmin) return true;
  const role = parentGarden.value?.role;
  if (!role) return true; // fallback when role not loaded; backend enforces RBAC
  return role === 'OWNER' || role === 'FAMILY' || role === 'ADMIN';
});

const breadcrumbItems = computed(() => {
  const items = [{ label: 'Gardens', icon: 'i-lucide-trees', to: '/dashboard/gardens' }];
  if (zone.value?.garden_id) {
    items.push({
      label: parentGarden.value?.name || `Garden #${zone.value.garden_id}`,
      to: `/dashboard/gardens/${zone.value.garden_id}`
    });
  }
  items.push({ label: zone.value?.name || 'Zone Plants' });
  return items;
});

const catalogSelectItems = computed(() =>
  catalogStore.plants.map((cat) => ({
    label: `${cat.common_name} (${cat.scientific_name}) — ${cat.spacing_cm}×${cat.row_spacing_cm}cm`,
    value: cat.id
  }))
);

const inventoryColumns = [
  { id: 'species', header: 'Crop / Species' },
  { accessorKey: 'quantity', header: 'Qty' },
  { accessorKey: 'status', header: 'Stage' },
  { accessorKey: 'health_status', header: 'Health' },
  { id: 'dates', header: 'Timeline' },
  { id: 'actions', header: '' }
];

function formatEnum(val) {
  if (!val) return '—';
  return String(val)
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function plantStatusColor(status) {
  if (status === 'HARVEST_READY') return 'success';
  if (status === 'GROWING') return 'primary';
  if (status === 'SEEDLING') return 'info';
  if (status === 'DEAD') return 'error';
  return 'neutral';
}

function healthColor(health) {
  if (health === 'HEALTHY') return 'success';
  if (health === 'NEEDS_ATTENTION') return 'warning';
  if (health === 'CRITICAL') return 'error';
  return 'neutral';
}

async function loadZoneData(zoneId) {
  gardensStore.clearMessages();
  gardensStore.lastCapacityWarning = null;
  const detail = await gardensStore.fetchZoneDetail(zoneId).catch(() => null);
  await gardensStore.fetchZonePlants(zoneId).catch(() => {});
  if (detail?.zone?.garden_id && gardensStore.activeGarden?.id !== detail.zone.garden_id) {
    await gardensStore.fetchGardenDetail(detail.zone.garden_id).catch(() => {});
  }
  await catalogStore.fetchCatalog({ limit: 100 }).catch(() => {});
}

function toDateInputValue(val) {
  if (!val) return '';
  const str = String(val);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = new Date(val);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return str.slice(0, 10);
}

function openAddPlantModal() {
  plantModalError.value = '';
  editingPlantId.value = null;
  catalogSearch.value = '';
  if (catalogStore.plants.length === 0) {
    catalogStore.fetchCatalog({ q: '', limit: 100 }).catch(() => {});
  }
  plantForm.plant_catalog_id = catalogStore.plants[0]?.id;
  plantForm.custom_nickname = '';
  plantForm.quantity = 4;
  plantForm.planted_date = new Date().toISOString().slice(0, 10);
  plantForm.expected_harvest_date = '';
  plantForm.status = 'SEEDLING';
  plantForm.health_status = 'HEALTHY';
  plantForm.notes = '';
  isPlantModalOpen.value = true;
}

function openEditPlantModal(zp) {
  plantModalError.value = '';
  editingPlantId.value = zp.id;
  plantForm.plant_catalog_id = zp.plant_catalog_id;
  plantForm.custom_nickname = zp.custom_nickname || '';
  plantForm.quantity = zp.quantity || 1;
  plantForm.planted_date = toDateInputValue(zp.planted_date) || new Date().toISOString().slice(0, 10);
  plantForm.expected_harvest_date = toDateInputValue(zp.expected_harvest_date);
  plantForm.status = zp.status || 'GROWING';
  plantForm.health_status = zp.health_status || 'HEALTHY';
  plantForm.notes = zp.notes || '';
  isPlantModalOpen.value = true;
}

async function handleSavePlant() {
  plantModalError.value = '';
  const zoneId = route.params.zoneId;
  if (!editingPlantId.value && !plantForm.plant_catalog_id) {
    plantModalError.value = 'Please select a catalog species.';
    return;
  }

  const payload = {
    ...(editingPlantId.value ? {} : { plant_catalog_id: Number(plantForm.plant_catalog_id) }),
    custom_nickname: plantForm.custom_nickname.trim() || null,
    quantity: Number(plantForm.quantity || 1),
    planted_date: plantForm.planted_date,
    expected_harvest_date: plantForm.expected_harvest_date || null,
    status: plantForm.status,
    health_status: plantForm.health_status,
    notes: plantForm.notes.trim() || null
  };

  try {
    const result = editingPlantId.value
      ? await gardensStore.updateZonePlant(zoneId, editingPlantId.value, payload)
      : await gardensStore.addZonePlant(zoneId, payload);

    isPlantModalOpen.value = false;

    if (result?.meta?.warning === 'ZONE_OVERCROWDED') {
      toast.add({
        title: 'ZONE_OVERCROWDED Warning',
        description: result.meta.message || 'Zone bed capacity exceeded 100%.',
        icon: 'i-lucide-alert-triangle',
        color: 'error'
      });
    } else {
      toast.add({
        title: editingPlantId.value ? 'Plant record updated' : 'Plant added to zone',
        icon: 'i-lucide-check-circle-2',
        color: 'success'
      });
    }
  } catch (err) {
    plantModalError.value = gardensStore.error || err.message || 'Failed to save plant record.';
  }
}

function confirmRemovePlant(zp) {
  plantToRemove.value = zp;
  isRemovePlantOpen.value = true;
}

async function handleRemovePlant() {
  if (!plantToRemove.value) return;
  const zoneId = route.params.zoneId;
  try {
    await gardensStore.removeZonePlant(zoneId, plantToRemove.value.id);
    isRemovePlantOpen.value = false;
    plantToRemove.value = null;
    toast.add({
      title: 'Plant removed from zone',
      icon: 'i-lucide-trash-2',
      color: 'success'
    });
  } catch (err) {
    toast.add({
      title: 'Remove failed',
      description: gardensStore.error || err.message,
      icon: 'i-lucide-alert-circle',
      color: 'error'
    });
  }
}

watch(catalogSearch, (term) => {
  if (catalogSearchTimer) clearTimeout(catalogSearchTimer);
  catalogSearchTimer = setTimeout(() => {
    catalogStore.fetchCatalog({ q: term, limit: 100 }).catch(() => {});
  }, 250);
});

onMounted(() => {
  loadZoneData(route.params.zoneId);
});

watch(
  () => route.params.zoneId,
  (newId) => {
    if (newId) loadZoneData(newId);
  }
);

onUnmounted(() => {
  if (catalogSearchTimer) {
    clearTimeout(catalogSearchTimer);
    catalogSearchTimer = null;
  }
});
</script>
