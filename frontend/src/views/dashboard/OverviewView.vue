<template>
  <UDashboardPanel id="overview">
    <template #header>
      <UDashboardNavbar title="Overview">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UBadge
            data-testid="realtime-status-badge"
            :color="realtimeBadgeColor"
            variant="soft"
            size="sm"
            :icon="realtimeBadgeIcon"
          >
            {{ realtimeBadgeLabel }}
          </UBadge>
          <AlertBellButton />
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
                  Workspace Live &bull; F1&ndash;F10
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

        <!-- Live Operational Widgets (F6, F7, F8, F9) & Sprint 3 Weather Preview (F11) -->
        <div class="space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-base font-semibold text-zinc-900 dark:text-white">
                Live Garden Operations
              </h3>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">
                Real-time zone telemetry, open care tasks, unread alerts, and upcoming Sprint 3 weather preview.
              </p>
            </div>
            <USelect
              v-if="gardenSelectOptions.length > 1"
              v-model="selectedLiveGardenId"
              :items="gardenSelectOptions"
              value-key="value"
              size="xs"
              class="w-56"
            />
          </div>

          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <!-- Live Zone Telemetry (F7/F8) -->
            <UCard data-testid="overview-live-sensors">
              <template #header>
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-activity" class="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span class="text-sm font-semibold text-zinc-900 dark:text-white">
                      Live Sensor Readings
                    </span>
                  </div>
                  <UButton to="/dashboard/sensors" size="xs" color="primary" variant="soft" trailing-icon="i-lucide-arrow-right">
                    Sensors Console
                  </UButton>
                </div>
              </template>

              <div v-if="liveZones.length === 0" class="py-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
                Select or create a garden with growing zones to stream live soil &amp; climate metrics.
              </div>
              <div v-else class="space-y-2.5">
                <div
                  v-for="z in liveZones.slice(0, 4)"
                  :key="z.id"
                  class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200/70 bg-zinc-50/70 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/50"
                >
                  <span class="font-semibold text-zinc-800 dark:text-zinc-200">{{ z.name }}</span>
                  <div v-if="latestByZone(z.id)" class="flex flex-wrap items-center gap-2.5 text-zinc-600 dark:text-zinc-300">
                    <span>{{ latestByZone(z.id).soil_moisture !== null && latestByZone(z.id).soil_moisture !== undefined ? `${Number(latestByZone(z.id).soil_moisture).toFixed(1)}%` : '—' }} Moisture</span>
                    <span>{{ latestByZone(z.id).temperature !== null && latestByZone(z.id).temperature !== undefined ? `${Number(latestByZone(z.id).temperature).toFixed(1)}°C` : '—' }}</span>
                    <span>{{ latestByZone(z.id).humidity !== null && latestByZone(z.id).humidity !== undefined ? `${Number(latestByZone(z.id).humidity).toFixed(0)}%` : '—' }} RH</span>
                    <span>{{ latestByZone(z.id).light_lux !== null && latestByZone(z.id).light_lux !== undefined ? `${Number(latestByZone(z.id).light_lux).toLocaleString()} lx` : '—' }}</span>
                  </div>
                  <span v-else class="text-zinc-400">Awaiting sensor sample</span>
                </div>
              </div>
            </UCard>

            <!-- Active Care Tasks Queue (F6) -->
            <UCard data-testid="overview-live-tasks">
              <template #header>
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-check-square" class="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span class="text-sm font-semibold text-zinc-900 dark:text-white">
                      Active Care Tasks
                    </span>
                  </div>
                  <UButton to="/dashboard/care-tasks" size="xs" color="primary" variant="soft" trailing-icon="i-lucide-arrow-right">
                    Manage Tasks
                  </UButton>
                </div>
              </template>

              <div v-if="openGardenTasks.length === 0" class="py-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
                No open care tasks queued for this garden.
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="task in openGardenTasks.slice(0, 4)"
                  :key="task.id"
                  class="flex items-center justify-between gap-2 rounded-lg border border-zinc-200/70 bg-zinc-50/70 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/50"
                >
                  <div class="min-w-0">
                    <span class="font-semibold text-zinc-800 dark:text-zinc-200">{{ task.task_type }}</span>
                    <span class="mx-1 text-zinc-400">&bull;</span>
                    <span class="text-zinc-600 dark:text-zinc-300">{{ task.zone_name || `Zone #${task.zone_id}` }}</span>
                    <p class="truncate text-[11px] text-zinc-500">{{ task.notes || `Due ${task.due_date}` }}</p>
                  </div>
                  <UBadge color="neutral" variant="subtle" size="xs">{{ task.due_date }}</UBadge>
                </div>
              </div>
            </UCard>

            <!-- Recent Unread Alerts (F9) -->
            <UCard data-testid="overview-live-alerts">
              <template #header>
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-bell-ring" class="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span class="text-sm font-semibold text-zinc-900 dark:text-white">
                      Recent Alerts
                    </span>
                    <UBadge v-if="alertsStore.unreadCount > 0" color="error" variant="soft" size="xs">
                      {{ alertsStore.unreadCount }} unread
                    </UBadge>
                  </div>
                  <UButton to="/dashboard/alerts" size="xs" color="primary" variant="soft" trailing-icon="i-lucide-arrow-right">
                    View Alerts
                  </UButton>
                </div>
              </template>

              <div v-if="recentGardenAlerts.length === 0" class="py-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
                All zones within configured threshold bounds.
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="alert in recentGardenAlerts.slice(0, 4)"
                  :key="String(alert.id)"
                  class="flex items-center justify-between gap-2 rounded-lg border border-zinc-200/70 bg-zinc-50/70 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/50"
                >
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5">
                      <UBadge :color="alert.severity === 'CRITICAL' ? 'error' : alert.severity === 'WARNING' ? 'warning' : 'info'" variant="soft" size="xs">
                        {{ alert.severity }}
                      </UBadge>
                      <span class="truncate font-medium text-zinc-800 dark:text-zinc-200">{{ alert.zone_name || alert.metric }}</span>
                    </div>
                    <p class="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">{{ alert.message }}</p>
                  </div>
                  <UButton
                    v-if="!alert.is_read"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-check"
                    aria-label="Mark alert read"
                    @click="alertsStore.markAlertRead(alert.id)"
                  />
                </div>
              </div>
            </UCard>

            <!-- Weather Forecast Preview (F11, Sprint 3) -->
            <UCard
              class="group relative cursor-pointer overflow-hidden transition-colors hover:border-emerald-400 dark:hover:border-emerald-700"
              @click="open('F11')"
            >
              <template #header>
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-cloud-sun" class="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span class="text-sm font-semibold text-zinc-900 dark:text-white">
                      Weather Forecast
                    </span>
                  </div>
                  <UBadge color="primary" variant="subtle" size="xs" icon="i-lucide-clock">
                    Coming in Sprint 3
                  </UBadge>
                </div>
              </template>

              <div class="relative">
                <div class="space-y-2 opacity-65 transition-opacity group-hover:opacity-40">
                  <div class="flex items-center justify-between rounded-lg border border-zinc-200/70 bg-zinc-50/70 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
                    <span class="font-medium text-zinc-700 dark:text-zinc-300">7-Day Precipitation Outlook</span>
                    <span class="text-zinc-500 dark:text-zinc-400">Rain-delay integration</span>
                  </div>
                  <div class="flex items-center justify-between rounded-lg border border-zinc-200/70 bg-zinc-50/70 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
                    <span class="font-medium text-zinc-700 dark:text-zinc-300">Overnight Frost Risk</span>
                    <span class="text-zinc-500 dark:text-zinc-400">24h early alert</span>
                  </div>
                </div>

                <div class="mt-3 flex items-center justify-between text-xs">
                  <span class="text-zinc-500 dark:text-zinc-400">Coordinate-accurate rainfall &amp; frost tracking</span>
                  <span class="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    Preview Sprint 3
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
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { useAuthStore } from '../../stores/auth.js';
import { useGardensStore } from '../../stores/gardens.js';
import { useTasksStore } from '../../stores/tasks.js';
import { useSensorsStore } from '../../stores/sensors.js';
import { useAlertsStore } from '../../stores/alerts.js';
import { useComingSoon } from '../../composables/useComingSoon.js';
import realtimeService from '../../services/realtime.js';
import AlertBellButton from '../../components/AlertBellButton.vue';

const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const gardensStore = useGardensStore();
const tasksStore = useTasksStore();
const sensorsStore = useSensorsStore();
const alertsStore = useAlertsStore();
const { open } = useComingSoon();

const selectedLiveGardenId = ref(null);

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

const gardenSelectOptions = computed(() =>
  gardensStore.gardens.map((g) => ({ label: g.name, value: g.id }))
);

const liveZones = computed(() => {
  if (!selectedLiveGardenId.value) return [];
  if (
    gardensStore.activeGarden &&
    Number(gardensStore.activeGarden.id) === Number(selectedLiveGardenId.value)
  ) {
    return gardensStore.zones;
  }
  return [];
});

const openGardenTasks = computed(() => {
  const gid = Number(selectedLiveGardenId.value);
  if (!gid) return [];
  return (tasksStore.tasksByGarden[gid] || []).filter((t) => !t.is_completed);
});

const recentGardenAlerts = computed(() => {
  const gid = Number(selectedLiveGardenId.value);
  if (!gid) return [];
  return (alertsStore.alertsByGarden[gid] || []).filter((a) => !a.is_read);
});

function latestByZone(zoneId) {
  return sensorsStore.latestByZone[Number(zoneId)] || null;
}

const realtimeBadgeColor = computed(() => {
  if (realtimeService.connectionStatus.value === 'connected') return 'success';
  if (realtimeService.connectionStatus.value === 'reconnecting' || realtimeService.connectionStatus.value === 'connecting') return 'warning';
  return 'neutral';
});

const realtimeBadgeIcon = computed(() => {
  if (realtimeService.connectionStatus.value === 'connected') return 'i-lucide-radio';
  if (realtimeService.connectionStatus.value === 'reconnecting' || realtimeService.connectionStatus.value === 'connecting') return 'i-lucide-refresh-cw';
  return 'i-lucide-wifi-off';
});

const realtimeBadgeLabel = computed(() => {
  const st = realtimeService.connectionStatus.value;
  if (st === 'connected') return 'Live';
  if (st === 'reconnecting') return 'Reconnecting';
  if (st === 'connecting') return 'Connecting';
  return 'Offline';
});

async function initLiveGarden(gardenId) {
  const gid = Number(gardenId);
  if (!gid) return;
  alertsStore.setActiveGarden(gid);
  const detail = await gardensStore.fetchGardenDetail(gid).catch(() => null);
  const zoneIds = (detail?.zones || []).map((z) => z.id);
  await Promise.all([
    tasksStore.fetchGardenTasks(gid, { is_completed: 'false' }).catch(() => {}),
    alertsStore.fetchGardenAlerts(gid).catch(() => {}),
    sensorsStore.reconcileZoneReadings(zoneIds).catch(() => {})
  ]);
  realtimeService.connect(gid, {
    zoneIds,
    onAlertTriggered: (frameData) => {
      toast.add({
        title: `Alert: ${frameData.zoneName || 'Garden'}`,
        description: frameData.message,
        icon: 'i-lucide-bell-ring',
        color: frameData.severity === 'CRITICAL' ? 'error' : 'warning'
      });
    }
  });
}

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

watch(selectedLiveGardenId, (newId, oldId) => {
  if (newId && oldId && Number(newId) !== Number(oldId)) {
    initLiveGarden(newId);
  }
});

onMounted(async () => {
  gardensStore.clearMessages();
  const gardens = await gardensStore.fetchGardens().catch(() => []);
  const firstId = gardens?.[0]?.id || gardensStore.activeGarden?.id;
  if (firstId) {
    selectedLiveGardenId.value = Number(firstId);
    await initLiveGarden(firstId);
  }
});

onUnmounted(() => {
  realtimeService.disconnect();
});
</script>
