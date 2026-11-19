<template>
  <UDashboardPanel id="overview">
    <template #header>
      <UDashboardNavbar title="Overview">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UColorModeButton />
          <UButton
            to="/dashboard/catalog"
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-book-open"
            class="hidden sm:inline-flex"
          >
            Plant Catalog
          </UButton>
          <UButton
            color="primary"
            size="sm"
            icon="i-lucide-plus"
            @click="openCreateModal"
          >
            Create Garden
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- Welcome & Quick Actions Banner -->
        <UCard class="overflow-hidden border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/70 dark:border-emerald-900/60 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-teal-950/30">
          <div class="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div class="space-y-1.5">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge color="primary" variant="subtle" size="sm" icon="i-lucide-sprout">
                  Workspace Live &bull; F1&ndash;F5
                </UBadge>
                <UBadge v-if="authStore.user?.location_region" color="neutral" variant="outline" size="sm" icon="i-lucide-map-pin">
                  {{ authStore.user.location_region }}
                </UBadge>
              </div>
              <h2 class="text-xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
                Welcome back, {{ displayName }}
              </h2>
              <p class="max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
                Manage your microclimate beds, monitor crop capacity utilization, analyze companion synergies, and collaborate with your garden team.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2.5">
              <UButton color="primary" icon="i-lucide-plus" @click="openCreateModal">
                Create Garden
              </UButton>
              <UButton to="/dashboard/gardens" color="neutral" variant="outline" icon="i-lucide-trees">
                All Gardens
              </UButton>
              <UButton to="/dashboard/catalog" color="neutral" variant="soft" icon="i-lucide-book-open">
                Browse Catalog
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Error Banner -->
        <UAlert
          v-if="gardensStore.error"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="gardensStore.error"
        />

        <!-- Live Stat Cards -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <UCard v-for="stat in statCards" :key="stat.label">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                  {{ stat.label }}
                </p>
                <p class="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
                  {{ stat.value }}
                </p>
                <p class="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {{ stat.hint }}
                </p>
              </div>
              <div class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <UIcon :name="stat.icon" class="size-5" />
              </div>
            </div>
          </UCard>
        </div>

        <!-- My Gardens Table -->
        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="text-base font-semibold text-zinc-900 dark:text-white">
                  My Gardens
                </h3>
                <p class="text-xs text-zinc-500 dark:text-zinc-400">
                  Live plots and shared workspaces you belong to
                </p>
              </div>
              <UButton to="/dashboard/gardens" color="neutral" variant="ghost" size="sm" trailing-icon="i-lucide-arrow-right">
                Manage all
              </UButton>
            </div>
          </template>

          <div v-if="gardensStore.loading" class="space-y-3 py-2">
            <USkeleton class="h-10 w-full" />
            <USkeleton class="h-10 w-full" />
            <USkeleton class="h-10 w-full" />
          </div>

          <UEmpty
            v-else-if="gardensStore.gardens.length === 0"
            icon="i-lucide-trees"
            title="No gardens registered yet"
            description="Create your first garden to configure microclimate beds, track crop spacing, and invite collaborators."
            :actions="[
              { label: 'Create First Garden', color: 'primary', icon: 'i-lucide-plus', onClick: openCreateModal },
              { label: 'Browse Plant Catalog', color: 'neutral', variant: 'outline', to: '/dashboard/catalog' }
            ]"
          />

          <UTable v-else :data="gardensStore.gardens" :columns="gardenColumns">
            <template #name-cell="{ row }">
              <div class="min-w-0">
                <RouterLink
                  :to="`/dashboard/gardens/${row.original.id}`"
                  class="font-semibold text-zinc-900 hover:text-emerald-600 dark:text-white dark:hover:text-emerald-400"
                >
                  {{ row.original.name }}
                </RouterLink>
                <p v-if="row.original.location_address" class="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {{ row.original.location_address }}
                </p>
              </div>
            </template>

            <template #role-cell="{ row }">
              <UBadge :color="roleColor(row.original.role)" variant="soft" size="xs">
                {{ row.original.role || 'OWNER' }}
              </UBadge>
            </template>

            <template #area_sq_m-cell="{ row }">
              <span class="text-sm text-zinc-700 dark:text-zinc-300">
                {{ Number(row.original.area_sq_m || 0).toFixed(1) }} m&sup2;
              </span>
            </template>

            <template #counts-cell="{ row }">
              <div class="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <UBadge color="neutral" variant="subtle" size="xs">
                  {{ row.original.zone_count || 0 }} zones
                </UBadge>
                <UBadge color="neutral" variant="subtle" size="xs">
                  {{ row.original.plant_count || 0 }} plantings
                </UBadge>
              </div>
            </template>

            <template #actions-cell="{ row }">
              <div class="flex justify-end">
                <UButton
                  :to="`/dashboard/gardens/${row.original.id}`"
                  size="xs"
                  color="primary"
                  variant="soft"
                  trailing-icon="i-lucide-arrow-right"
                >
                  Open
                </UButton>
              </div>
            </template>
          </UTable>
        </UCard>

        <!-- Upcoming Sprint Preview Widgets (F6, F7, F8, F10) -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-base font-semibold text-zinc-900 dark:text-white">
                Upcoming Operational Widgets
              </h3>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">
                Preview upcoming modules arriving in Sprints 2&ndash;3. Click any widget to view upcoming scope.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <UCard
              v-for="widget in previewWidgets"
              :key="widget.featureId"
              class="group relative cursor-pointer overflow-hidden transition-colors hover:border-emerald-400 dark:hover:border-emerald-700"
              @click="open(widget.featureId)"
            >
              <template #header>
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <UIcon :name="widget.icon" class="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span class="text-sm font-semibold text-zinc-900 dark:text-white">
                      {{ widget.title }}
                    </span>
                  </div>
                  <UBadge color="primary" variant="subtle" size="xs" icon="i-lucide-clock">
                    Coming in Sprint {{ widget.sprint }}
                  </UBadge>
                </div>
              </template>

              <div class="relative">
                <div class="space-y-2 opacity-65 transition-opacity group-hover:opacity-40">
                  <div
                    v-for="(item, idx) in widget.previewRows"
                    :key="idx"
                    class="flex items-center justify-between rounded-lg border border-zinc-200/70 bg-zinc-50/70 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/50"
                  >
                    <span class="font-medium text-zinc-700 dark:text-zinc-300">{{ item.label }}</span>
                    <span class="text-zinc-500 dark:text-zinc-400">{{ item.value }}</span>
                  </div>
                </div>

                <div class="mt-3 flex items-center justify-between text-xs">
                  <span class="text-zinc-500 dark:text-zinc-400">{{ widget.caption }}</span>
                  <span class="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    Preview Sprint {{ widget.sprint }}
                    <UIcon name="i-lucide-arrow-up-right" class="size-3.5" />
                  </span>
                </div>
              </div>
            </UCard>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Quick Create Garden Modal -->
  <UModal
    v-model:open="isCreateOpen"
    title="Create New Garden"
    description="Set up a garden workspace with timezone and bed dimensions."
  >
    <template #body>
      <form id="overview-create-garden-form" class="space-y-4" @submit.prevent="handleCreateGarden">
        <UAlert
          v-if="createError"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="createError"
        />

        <UFormField label="Garden Name" required>
          <UInput v-model="gardenForm.name" placeholder="e.g. Backyard Herb & Tomato Plot" class="w-full" required />
        </UFormField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Timezone" required>
            <USelect
              v-model="gardenForm.timezone"
              :items="timezoneOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Total Area (m²)">
            <UInput v-model.number="gardenForm.area_sq_m" type="number" min="0" step="0.1" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Location Address">
          <UInput v-model="gardenForm.location_address" placeholder="e.g. Portland, OR" class="w-full" />
        </UFormField>

        <UFormField label="Description">
          <UTextarea v-model="gardenForm.description" :rows="2" placeholder="Sun exposure, soil notes, goals..." class="w-full" />
        </UFormField>
      </form>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="isCreateOpen = false">
          Cancel
        </UButton>
        <UButton
          type="submit"
          form="overview-create-garden-form"
          color="primary"
          icon="i-lucide-check"
          :loading="gardensStore.actionLoading"
        >
          Create Garden
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { useAuthStore } from '../../stores/auth.js';
import { useGardensStore } from '../../stores/gardens.js';
import { useComingSoon } from '../../composables/useComingSoon.js';

const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const gardensStore = useGardensStore();
const { open } = useComingSoon();

const isCreateOpen = ref(false);
const createError = ref('');

const gardenForm = reactive({
  name: '',
  description: '',
  location_address: '',
  timezone: 'UTC',
  area_sq_m: 25
});

const timezoneOptions = [
  { label: 'UTC', value: 'UTC' },
  { label: 'America/New_York', value: 'America/New_York' },
  { label: 'America/Chicago', value: 'America/Chicago' },
  { label: 'America/Denver', value: 'America/Denver' },
  { label: 'America/Los_Angeles', value: 'America/Los_Angeles' },
  { label: 'Europe/London', value: 'Europe/London' },
  { label: 'Europe/Berlin', value: 'Europe/Berlin' },
  { label: 'Asia/Dhaka', value: 'Asia/Dhaka' },
  { label: 'Asia/Tokyo', value: 'Asia/Tokyo' },
  { label: 'Australia/Sydney', value: 'Australia/Sydney' }
];

const displayName = computed(() => authStore.userName || authStore.userEmail || 'Gardener');

const totalZones = computed(() =>
  gardensStore.gardens.reduce((acc, g) => acc + Number(g.zone_count || 0), 0)
);

const totalPlants = computed(() =>
  gardensStore.gardens.reduce((acc, g) => acc + Number(g.plant_count || 0), 0)
);

const totalArea = computed(() =>
  gardensStore.gardens.reduce((acc, g) => acc + Number(g.area_sq_m || 0), 0).toFixed(1)
);

const statCards = computed(() => [
  {
    label: 'Active Gardens',
    value: gardensStore.gardens.length,
    hint: 'Owned & shared plots',
    icon: 'i-lucide-trees'
  },
  {
    label: 'Microclimate Zones',
    value: totalZones.value,
    hint: 'Raised beds, greenhouses & pots',
    icon: 'i-lucide-map-pin'
  },
  {
    label: 'Tracked Plantings',
    value: totalPlants.value,
    hint: 'Allocated crop records',
    icon: 'i-lucide-sprout'
  },
  {
    label: 'Total Plot Area',
    value: `${totalArea.value} m²`,
    hint: 'Configured growing footprint',
    icon: 'i-lucide-ruler'
  }
]);

const gardenColumns = [
  { accessorKey: 'name', header: 'Garden' },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'timezone', header: 'Timezone' },
  { accessorKey: 'area_sq_m', header: 'Area' },
  { id: 'counts', header: 'Inventory' },
  { id: 'actions', header: '' }
];

const previewWidgets = [
  {
    featureId: 'F7',
    title: 'Live Sensor Readings',
    sprint: 2,
    icon: 'i-lucide-activity',
    caption: 'Real-time MQTT & ESP32 soil moisture telemetry',
    previewRows: [
      { label: 'South Raised Bed — Soil Moisture', value: 'Sample: 62% (Optimal)' },
      { label: 'Greenhouse — Ambient Temp', value: 'Sample: 23.4°C • 58% RH' }
    ]
  },
  {
    featureId: 'F6',
    title: "Today's Care Tasks",
    sprint: 2,
    icon: 'i-lucide-check-square',
    caption: 'Botanical watering & fertilizing queues',
    previewRows: [
      { label: 'Water Roma Tomatoes (Every 2d)', value: 'Scheduled queue' },
      { label: 'Feed Sweet Basil Guild (Every 21d)', value: 'Scheduled queue' }
    ]
  },
  {
    featureId: 'F10',
    title: 'Weather Forecast',
    sprint: 3,
    icon: 'i-lucide-cloud-sun',
    caption: 'Coordinate-accurate rainfall & frost tracking',
    previewRows: [
      { label: '7-Day Precipitation Outlook', value: 'Rain-delay integration' },
      { label: 'Overnight Frost Risk', value: '24h early alert' }
    ]
  },
  {
    featureId: 'F8',
    title: 'Recent Alerts',
    sprint: 2,
    icon: 'i-lucide-bell-ring',
    caption: 'Automated threshold drift notifications',
    previewRows: [
      { label: 'Moisture Drift Watch', value: 'Per-species bounds' },
      { label: 'Heat Stress Guardrail', value: 'Severity-ranked feed' }
    ]
  }
];

function roleColor(role) {
  if (role === 'OWNER') return 'success';
  if (role === 'FAMILY') return 'primary';
  if (role === 'ADMIN') return 'info';
  return 'warning';
}

function openCreateModal() {
  createError.value = '';
  gardenForm.name = '';
  gardenForm.description = '';
  gardenForm.location_address = '';
  gardenForm.timezone = 'UTC';
  gardenForm.area_sq_m = 25;
  isCreateOpen.value = true;
}

async function handleCreateGarden() {
  createError.value = '';
  if (!gardenForm.name.trim()) {
    createError.value = 'Garden name is required.';
    return;
  }
  try {
    const created = await gardensStore.createGarden({
      name: gardenForm.name.trim(),
      description: gardenForm.description.trim() || undefined,
      location_address: gardenForm.location_address.trim() || undefined,
      timezone: gardenForm.timezone,
      area_sq_m: Number(gardenForm.area_sq_m || 0)
    });
    isCreateOpen.value = false;
    toast.add({
      title: 'Garden created',
      description: `"${created?.name || gardenForm.name}" is ready for zones.`,
      icon: 'i-lucide-check-circle-2',
      color: 'success'
    });
    if (created?.id) {
      router.push(`/dashboard/gardens/${created.id}`);
    }
  } catch (err) {
    createError.value = gardensStore.error || err.message || 'Failed to create garden.';
  }
}

onMounted(() => {
  gardensStore.clearMessages();
  gardensStore.fetchGardens().catch(() => {});
});
</script>
