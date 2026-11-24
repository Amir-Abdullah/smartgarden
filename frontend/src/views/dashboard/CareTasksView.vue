<template>
  <UDashboardPanel id="care-tasks">
    <template #header>
      <UDashboardNavbar title="Care Tasks & Watering">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <AlertBellButton />
          <UColorModeButton />
          <UButton
            v-if="canEditTasks && selectedGardenId && gardenZones.length > 0"
            data-testid="create-task-btn"
            color="primary"
            size="sm"
            icon="i-lucide-plus"
            @click="openCreateModal"
          >
            New Task
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- Header Filters & Garden Selector -->
        <UCard>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
            <UFormField label="Garden" data-testid="tasks-garden-select">
              <USelect
                v-model="selectedGardenId"
                :items="gardenOptions"
                value-key="value"
                placeholder="Select garden"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Filter by Zone" data-testid="tasks-zone-select">
              <USelect
                v-model="filterZoneId"
                :items="zoneFilterOptions"
                value-key="value"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Task Type">
              <USelect
                v-model="filterTaskType"
                :items="taskTypeFilterOptions"
                value-key="value"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Assigned To">
              <USelect
                v-model="filterAssignee"
                :items="assigneeFilterOptions"
                value-key="value"
                class="w-full"
              />
            </UFormField>
          </div>
        </UCard>

        <UAlert
          v-if="tasksStore.error"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="tasksStore.error"
        />

        <UAlert
          v-if="isGuestRole"
          color="info"
          variant="soft"
          icon="i-lucide-eye"
          title="Read-Only Guest Access"
          description="Guests can inspect care task schedules and water logs, while Owners and Family members can create, complete, or delete tasks."
        />

        <!-- Tabs: Today, Upcoming, Overdue, Completed -->
        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <UTabs
                v-model="activeTab"
                :items="tabItems"
                variant="pill"
              />
              <div class="flex items-center gap-2">
                <UButton
                  v-if="canEditTasks && gardenZones.length > 0"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  icon="i-lucide-droplets"
                  @click="openWaterLogModal"
                >
                  Log Water Usage
                </UButton>
              </div>
            </div>
          </template>

          <div v-if="tasksStore.loading && gardenTasks.length === 0" class="space-y-3 py-2">
            <USkeleton class="h-12 w-full" />
            <USkeleton class="h-12 w-full" />
            <USkeleton class="h-12 w-full" />
          </div>

          <UEmpty
            v-else-if="filteredTasks.length === 0"
            icon="i-lucide-check-square"
            :title="emptyStateTitle"
            :description="emptyStateDescription"
            :actions="
              canEditTasks && gardenZones.length > 0 && activeTab !== 'completed'
                ? [{ label: 'Create Care Task', color: 'primary', icon: 'i-lucide-plus', onClick: openCreateModal }]
                : []
            "
          />

          <div v-else class="divide-y divide-zinc-200 dark:divide-zinc-800">
            <div
              v-for="task in filteredTasks"
              :key="task.id"
              data-testid="task-row"
              class="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center"
            >
              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <UBadge :color="taskTypeColor(task.task_type)" variant="soft" size="xs">
                    {{ task.task_type }}
                  </UBadge>
                  <span class="font-semibold text-zinc-900 dark:text-white">
                    {{ task.zone_name || zoneNameById(task.zone_id) }}
                  </span>
                  <UBadge
                    v-if="task.recurrence_days"
                    color="neutral"
                    variant="subtle"
                    size="xs"
                    icon="i-lucide-repeat"
                  >
                    Every {{ task.recurrence_days }}d
                  </UBadge>
                  <UBadge
                    v-if="task.source && task.source !== 'MANUAL'"
                    color="info"
                    variant="outline"
                    size="xs"
                  >
                    {{ task.source }}
                  </UBadge>
                  <UBadge
                    v-if="isOverdueTask(task)"
                    color="error"
                    variant="soft"
                    size="xs"
                  >
                    Overdue
                  </UBadge>
                </div>

                <p class="text-sm text-zinc-700 dark:text-zinc-300">
                  {{ task.notes || `${formatEnum(task.task_type)} care scheduled` }}
                </p>

                <div class="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                  <span class="inline-flex items-center gap-1">
                    <UIcon name="i-lucide-calendar" class="size-3.5" />
                    Due: {{ task.due_date }}
                  </span>
                  <span v-if="task.assigned_to" class="inline-flex items-center gap-1">
                    <UIcon name="i-lucide-user" class="size-3.5" />
                    {{ memberNameById(task.assigned_to) }}
                  </span>
                  <span v-if="task.is_completed && task.water_volume_liters" class="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400">
                    <UIcon name="i-lucide-droplets" class="size-3.5" />
                    {{ Number(task.water_volume_liters).toFixed(1) }} L applied
                  </span>
                </div>
              </div>

              <div v-if="canEditTasks" class="flex shrink-0 items-center gap-2">
                <UButton
                  v-if="!task.is_completed"
                  data-testid="complete-task-btn"
                  size="xs"
                  color="success"
                  variant="soft"
                  icon="i-lucide-check"
                  :loading="tasksStore.actionLoading"
                  @click="handleCompleteClick(task)"
                >
                  Complete
                </UButton>
                <UButton
                  v-else
                  size="xs"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-rotate-ccw"
                  :loading="tasksStore.actionLoading"
                  @click="handleReopenTask(task)"
                >
                  Reopen
                </UButton>
                <UButton
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  aria-label="Delete task"
                  :loading="tasksStore.actionLoading"
                  @click="handleDeleteTask(task)"
                />
              </div>
            </div>
          </div>
        </UCard>

        <!-- Water Usage Logs -->
        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 class="text-base font-semibold text-zinc-900 dark:text-white">
                  Water Usage Logs (Last 30 Days)
                </h3>
                <p class="text-xs text-zinc-500 dark:text-zinc-400">
                  Recorded automatically on completed watering tasks or via manual irrigation logs
                </p>
              </div>
              <UBadge color="info" variant="soft" size="sm" icon="i-lucide-droplets">
                Total: {{ totalLiters.toFixed(1) }} L
              </UBadge>
            </div>
          </template>

          <UEmpty
            v-if="waterLogs.length === 0"
            icon="i-lucide-droplets"
            title="No water usage logged yet"
            description="Complete a WATER task with volume in liters or log irrigation manually to track usage."
          />

          <UTable v-else :data="waterLogs" :columns="waterLogColumns">
            <template #zone_name-cell="{ row }">
              <span class="font-medium text-zinc-900 dark:text-white">
                {{ row.original.zone_name || zoneNameById(row.original.zone_id) }}
              </span>
            </template>
            <template #liters_applied-cell="{ row }">
              <UBadge color="info" variant="soft" size="xs">
                {{ Number(row.original.liters_applied || 0).toFixed(1) }} L
              </UBadge>
            </template>
            <template #method-cell="{ row }">
              <span class="text-xs text-zinc-600 dark:text-zinc-300">
                {{ formatEnum(row.original.method) }}
              </span>
            </template>
            <template #recorded_at-cell="{ row }">
              <span class="text-xs text-zinc-500 dark:text-zinc-400">
                {{ formatDateTime(row.original.recorded_at) }}
              </span>
            </template>
            <template #notes-cell="{ row }">
              <span class="text-xs text-zinc-500 dark:text-zinc-400">
                {{ row.original.notes || '—' }}
              </span>
            </template>
          </UTable>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Create Care Task Modal -->
  <UModal
    v-model:open="isCreateModalOpen"
    title="Create Care Task"
    description="Schedule a one-time or recurring garden care task."
  >
    <template #body>
      <form id="create-task-form" class="space-y-4" @submit.prevent="handleCreateTask">
        <UAlert
          v-if="createError"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="createError"
        />

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Zone" required>
            <USelect
              v-model="createForm.zone_id"
              :items="zoneSelectOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Task Type" required>
            <USelect
              v-model="createForm.task_type"
              :items="taskTypeOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Due Date" required>
            <UInput v-model="createForm.due_date" type="date" class="w-full" required />
          </UFormField>

          <UFormField label="Recurrence (Days)">
            <UInput
              v-model.number="createForm.recurrence_days"
              type="number"
              min="1"
              placeholder="Optional, e.g. 3"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField label="Assign To">
          <USelect
            v-model="createForm.assigned_to"
            :items="assigneeFormOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Notes">
          <UTextarea
            v-model="createForm.notes"
            :rows="2"
            placeholder="e.g. Deep soak tomato root zone in the morning"
            class="w-full"
          />
        </UFormField>
      </form>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="isCreateModalOpen = false">
          Cancel
        </UButton>
        <UButton
          type="submit"
          form="create-task-form"
          color="primary"
          icon="i-lucide-check"
          :loading="tasksStore.actionLoading"
        >
          Create Task
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- Complete Water Task Modal -->
  <UModal
    v-model:open="isCompleteModalOpen"
    title="Complete Watering Task"
    description="Optionally record water volume applied to automatically update your garden water logs."
  >
    <template #body>
      <form id="complete-task-form" class="space-y-4" @submit.prevent="submitCompleteWaterTask">
        <UAlert
          v-if="completeError"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="completeError"
        />

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Water Volume (Liters)">
            <UInput
              v-model.number="completeForm.water_volume_liters"
              data-testid="water-volume-input"
              type="number"
              min="0"
              step="0.1"
              placeholder="e.g. 8.5"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Irrigation Method">
            <USelect
              v-model="completeForm.irrigation_method"
              :items="irrigationMethodOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField label="Watering Notes">
          <UInput
            v-model="completeForm.water_notes"
            placeholder="Optional notes for water log"
            class="w-full"
          />
        </UFormField>
      </form>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="isCompleteModalOpen = false">
          Cancel
        </UButton>
        <UButton
          type="submit"
          form="complete-task-form"
          color="success"
          icon="i-lucide-check"
          :loading="tasksStore.actionLoading"
        >
          Complete &amp; Log
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- Manual Water Log Modal -->
  <UModal
    v-model:open="isWaterLogModalOpen"
    title="Log Water Usage"
    description="Record standalone irrigation volume for a zone."
  >
    <template #body>
      <form id="manual-water-log-form" class="space-y-4" @submit.prevent="handleCreateWaterLog">
        <UFormField label="Zone" required>
          <USelect
            v-model="waterLogForm.zone_id"
            :items="zoneSelectOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Liters Applied" required>
            <UInput
              v-model.number="waterLogForm.liters_applied"
              type="number"
              min="0.1"
              step="0.1"
              required
              class="w-full"
            />
          </UFormField>
          <UFormField label="Irrigation Method">
            <USelect
              v-model="waterLogForm.method"
              :items="irrigationMethodOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField label="Notes">
          <UInput v-model="waterLogForm.notes" placeholder="Morning drip cycle" class="w-full" />
        </UFormField>
      </form>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="isWaterLogModalOpen = false">
          Cancel
        </UButton>
        <UButton
          type="submit"
          form="manual-water-log-form"
          color="primary"
          icon="i-lucide-droplets"
          :loading="tasksStore.actionLoading"
        >
          Save Water Log
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { useGardensStore } from '../../stores/gardens.js';
import { useMembersStore } from '../../stores/members.js';
import { useAuthStore } from '../../stores/auth.js';
import { useTasksStore } from '../../stores/tasks.js';
import AlertBellButton from '../../components/AlertBellButton.vue';

const route = useRoute();
const toast = useToast();
const gardensStore = useGardensStore();
const membersStore = useMembersStore();
const authStore = useAuthStore();
const tasksStore = useTasksStore();

const selectedGardenId = ref(null);
const activeTab = ref('today');
const filterZoneId = ref('ALL');
const filterTaskType = ref('ALL');
const filterAssignee = ref('ALL');

const isCreateModalOpen = ref(false);
const createError = ref('');
const createForm = reactive({
  zone_id: null,
  task_type: 'WATER',
  due_date: new Date().toISOString().slice(0, 10),
  recurrence_days: '',
  assigned_to: 'UNASSIGNED',
  notes: ''
});

const isCompleteModalOpen = ref(false);
const completeError = ref('');
const completingTask = ref(null);
const completeForm = reactive({
  water_volume_liters: 5,
  irrigation_method: 'MANUAL_HOSE',
  water_notes: ''
});

const isWaterLogModalOpen = ref(false);
const waterLogForm = reactive({
  zone_id: null,
  liters_applied: 5,
  method: 'DRIP_IRRIGATION',
  notes: ''
});

const taskTypeOptions = [
  { label: 'WATER', value: 'WATER' },
  { label: 'FERTILIZE', value: 'FERTILIZE' },
  { label: 'PRUNE', value: 'PRUNE' },
  { label: 'REPOT', value: 'REPOT' },
  { label: 'HARVEST', value: 'HARVEST' },
  { label: 'PEST_INSPECTION', value: 'PEST_INSPECTION' }
];

const irrigationMethodOptions = [
  { label: 'Manual Hose', value: 'MANUAL_HOSE' },
  { label: 'Drip Irrigation', value: 'DRIP_IRRIGATION' },
  { label: 'Sprinkler', value: 'SPRINKLER' },
  { label: 'Watering Can', value: 'WATERING_CAN' },
  { label: 'Automated Valve', value: 'AUTOMATED_VALVE' }
];

const waterLogColumns = [
  { accessorKey: 'zone_name', header: 'Zone' },
  { accessorKey: 'liters_applied', header: 'Volume' },
  { accessorKey: 'method', header: 'Method' },
  { accessorKey: 'recorded_at', header: 'Recorded' },
  { accessorKey: 'notes', header: 'Notes' }
];

const gardenOptions = computed(() =>
  gardensStore.gardens.map((g) => ({ label: g.name, value: g.id }))
);

const activeGarden = computed(() =>
  gardensStore.gardens.find((g) => Number(g.id) === Number(selectedGardenId.value)) || gardensStore.activeGarden
);

const gardenZones = computed(() => {
  if (gardensStore.activeGarden && Number(gardensStore.activeGarden.id) === Number(selectedGardenId.value)) {
    return gardensStore.zones;
  }
  return gardensStore.zones.filter((z) => Number(z.garden_id) === Number(selectedGardenId.value));
});

const zoneSelectOptions = computed(() =>
  gardenZones.value.map((z) => ({ label: z.name, value: z.id }))
);

const zoneFilterOptions = computed(() => [
  { label: 'All Zones', value: 'ALL' },
  ...gardenZones.value.map((z) => ({ label: z.name, value: String(z.id) }))
]);

const taskTypeFilterOptions = [
  { label: 'All Types', value: 'ALL' },
  ...taskTypeOptions
];

const assigneeFilterOptions = computed(() => [
  { label: 'Anyone', value: 'ALL' },
  ...membersStore.members.map((m) => ({
    label: m.user?.name || m.user?.email || `Member #${m.user_id}`,
    value: String(m.user_id)
  }))
]);

const assigneeFormOptions = computed(() => [
  { label: 'Unassigned', value: 'UNASSIGNED' },
  ...membersStore.members.map((m) => ({
    label: m.user?.name || m.user?.email || `Member #${m.user_id}`,
    value: String(m.user_id)
  }))
]);

const currentRole = computed(
  () => activeGarden.value?.role || membersStore.currentUserRole || 'GUEST'
);
const isGuestRole = computed(() => currentRole.value === 'GUEST' && !authStore.isAdmin);
const canEditTasks = computed(
  () => ['OWNER', 'FAMILY', 'ADMIN'].includes(currentRole.value) || authStore.isAdmin
);

const todayStr = computed(() => {
  const tz = activeGarden.value?.timezone || 'UTC';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
});

const gardenTasks = computed(() =>
  selectedGardenId.value ? tasksStore.tasksByGarden[Number(selectedGardenId.value)] || [] : []
);

const waterLogs = computed(() =>
  selectedGardenId.value ? tasksStore.waterLogsByGarden[Number(selectedGardenId.value)] || [] : []
);

const totalLiters = computed(() =>
  waterLogs.value.reduce((sum, l) => sum + Number(l.liters_applied || 0), 0)
);

const baseFilteredTasks = computed(() =>
  gardenTasks.value.filter((t) => {
    if (filterZoneId.value !== 'ALL' && String(t.zone_id) !== String(filterZoneId.value)) {
      return false;
    }
    if (filterTaskType.value !== 'ALL' && t.task_type !== filterTaskType.value) {
      return false;
    }
    if (filterAssignee.value !== 'ALL' && String(t.assigned_to || '') !== String(filterAssignee.value)) {
      return false;
    }
    return true;
  })
);

const tabCounts = computed(() => {
  const today = todayStr.value;
  let todayCnt = 0;
  let upcomingCnt = 0;
  let overdueCnt = 0;
  let completedCnt = 0;
  for (const t of baseFilteredTasks.value) {
    if (t.is_completed) {
      completedCnt += 1;
    } else if (t.due_date < today) {
      overdueCnt += 1;
    } else if (t.due_date === today) {
      todayCnt += 1;
    } else {
      upcomingCnt += 1;
    }
  }
  return { today: todayCnt, upcoming: upcomingCnt, overdue: overdueCnt, completed: completedCnt };
});

const tabItems = computed(() => [
  { label: 'Today', value: 'today', badge: String(tabCounts.value.today) },
  { label: 'Upcoming', value: 'upcoming', badge: String(tabCounts.value.upcoming) },
  { label: 'Overdue', value: 'overdue', badge: String(tabCounts.value.overdue) },
  { label: 'Completed', value: 'completed', badge: String(tabCounts.value.completed) }
]);

const filteredTasks = computed(() => {
  const today = todayStr.value;
  return baseFilteredTasks.value.filter((t) => {
    if (activeTab.value === 'completed') return Boolean(t.is_completed);
    if (t.is_completed) return false;
    if (activeTab.value === 'overdue') return t.due_date < today;
    if (activeTab.value === 'today') return t.due_date === today;
    return t.due_date > today;
  });
});

const emptyStateTitle = computed(() => {
  if (activeTab.value === 'today') return 'No tasks due today';
  if (activeTab.value === 'upcoming') return 'No upcoming tasks scheduled';
  if (activeTab.value === 'overdue') return 'No overdue tasks';
  return 'No completed tasks yet';
});

const emptyStateDescription = computed(() => {
  if (gardenZones.value.length === 0) {
    return 'Create a growing zone in this garden first before scheduling care tasks.';
  }
  return 'Adjust filters or schedule a recurring watering, fertilizing, or pruning task.';
});

function isOverdueTask(task) {
  return !task.is_completed && task.due_date < todayStr.value;
}

function taskTypeColor(type) {
  if (type === 'WATER') return 'info';
  if (type === 'FERTILIZE') return 'success';
  if (type === 'HARVEST') return 'warning';
  if (type === 'PEST_INSPECTION') return 'error';
  return 'primary';
}

function zoneNameById(zid) {
  const z = gardenZones.value.find((item) => Number(item.id) === Number(zid));
  return z ? z.name : `Zone #${zid}`;
}

function memberNameById(uid) {
  const m = membersStore.members.find((item) => Number(item.user_id) === Number(uid));
  return m?.user?.name || m?.user?.email || `User #${uid}`;
}

function formatEnum(val) {
  if (!val) return '—';
  return String(val)
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function loadGardenWorkspace(gardenId) {
  const gid = Number(gardenId);
  if (!gid) return;
  tasksStore.clearMessages();
  await Promise.all([
    gardensStore.fetchGardenDetail(gid).catch(() => {}),
    membersStore.fetchMembers(gid).catch(() => {}),
    tasksStore.fetchGardenTasks(gid).catch(() => {}),
    tasksStore.fetchGardenWaterLogs(gid).catch(() => {})
  ]);
}

function openCreateModal() {
  createError.value = '';
  createForm.zone_id =
    filterZoneId.value !== 'ALL' ? Number(filterZoneId.value) : gardenZones.value[0]?.id || null;
  createForm.task_type = 'WATER';
  createForm.due_date = todayStr.value;
  createForm.recurrence_days = '';
  createForm.assigned_to = 'UNASSIGNED';
  createForm.notes = '';
  isCreateModalOpen.value = true;
}

async function handleCreateTask() {
  createError.value = '';
  if (!createForm.zone_id) {
    createError.value = 'Please select a growing zone.';
    return;
  }
  if (!createForm.due_date) {
    createError.value = 'Due date is required.';
    return;
  }
  try {
    await tasksStore.createTask(
      createForm.zone_id,
      {
        task_type: createForm.task_type,
        due_date: createForm.due_date,
        recurrence_days: createForm.recurrence_days ? Number(createForm.recurrence_days) : null,
        assigned_to:
          createForm.assigned_to && createForm.assigned_to !== 'UNASSIGNED'
            ? Number(createForm.assigned_to)
            : null,
        notes: createForm.notes.trim() || undefined
      },
      selectedGardenId.value
    );
    isCreateModalOpen.value = false;
    toast.add({
      title: 'Care task created',
      icon: 'i-lucide-check-circle-2',
      color: 'success'
    });
  } catch (err) {
    createError.value = tasksStore.error || err.message || 'Failed to create care task.';
  }
}

function handleCompleteClick(task) {
  if (task.task_type === 'WATER') {
    completingTask.value = task;
    completeError.value = '';
    completeForm.water_volume_liters = task.water_volume_liters ?? 5;
    completeForm.irrigation_method = 'MANUAL_HOSE';
    completeForm.water_notes = '';
    isCompleteModalOpen.value = true;
  } else {
    completeNonWaterTask(task);
  }
}

async function completeNonWaterTask(task) {
  try {
    const res = await tasksStore.updateTask(
      task.zone_id,
      task.id,
      { is_completed: true },
      selectedGardenId.value
    );
    toast.add({
      title: 'Task completed',
      description: res.task?.next_scheduled_task_id
        ? `Next recurring task #${res.task.next_scheduled_task_id} scheduled.`
        : 'Marked as completed.',
      icon: 'i-lucide-check-circle-2',
      color: 'success'
    });
  } catch (err) {
    toast.add({
      title: 'Unable to complete task',
      description: tasksStore.error || err.message,
      icon: 'i-lucide-alert-circle',
      color: 'error'
    });
  }
}

async function submitCompleteWaterTask() {
  if (!completingTask.value) return;
  completeError.value = '';
  const payload = {
    is_completed: true,
    irrigation_method: completeForm.irrigation_method
  };
  if (
    completeForm.water_volume_liters !== '' &&
    completeForm.water_volume_liters !== null &&
    Number(completeForm.water_volume_liters) >= 0
  ) {
    payload.water_volume_liters = Number(completeForm.water_volume_liters);
  }
  if (completeForm.water_notes.trim()) {
    payload.water_notes = completeForm.water_notes.trim();
  }

  try {
    const res = await tasksStore.updateTask(
      completingTask.value.zone_id,
      completingTask.value.id,
      payload,
      selectedGardenId.value
    );
    isCompleteModalOpen.value = false;
    completingTask.value = null;
    const parts = [];
    if (res.water_log) parts.push(`${res.water_log.liters_applied}L logged`);
    if (res.task?.next_scheduled_task_id) {
      parts.push(`next task #${res.task.next_scheduled_task_id} scheduled`);
    }
    toast.add({
      title: 'Watering task completed',
      description: parts.join(' • ') || 'Completed successfully.',
      icon: 'i-lucide-droplets',
      color: 'success'
    });
  } catch (err) {
    completeError.value = tasksStore.error || err.message || 'Failed to complete task.';
  }
}

async function handleReopenTask(task) {
  try {
    await tasksStore.updateTask(
      task.zone_id,
      task.id,
      { is_completed: false },
      selectedGardenId.value
    );
    toast.add({
      title: 'Task reopened',
      icon: 'i-lucide-rotate-ccw',
      color: 'info'
    });
  } catch (err) {
    toast.add({
      title: 'Failed to reopen task',
      description: tasksStore.error || err.message,
      icon: 'i-lucide-alert-circle',
      color: 'error'
    });
  }
}

async function handleDeleteTask(task) {
  try {
    await tasksStore.deleteTask(task.zone_id, task.id);
    toast.add({
      title: 'Task deleted',
      icon: 'i-lucide-trash-2',
      color: 'success'
    });
  } catch (err) {
    toast.add({
      title: 'Failed to delete task',
      description: tasksStore.error || err.message,
      icon: 'i-lucide-alert-circle',
      color: 'error'
    });
  }
}

function openWaterLogModal() {
  waterLogForm.zone_id =
    filterZoneId.value !== 'ALL' ? Number(filterZoneId.value) : gardenZones.value[0]?.id || null;
  waterLogForm.liters_applied = 5;
  waterLogForm.method = 'DRIP_IRRIGATION';
  waterLogForm.notes = '';
  isWaterLogModalOpen.value = true;
}

async function handleCreateWaterLog() {
  if (!waterLogForm.zone_id) return;
  try {
    await tasksStore.createWaterLog(
      waterLogForm.zone_id,
      {
        liters_applied: Number(waterLogForm.liters_applied),
        method: waterLogForm.method,
        notes: waterLogForm.notes.trim() || undefined
      },
      selectedGardenId.value
    );
    isWaterLogModalOpen.value = false;
    toast.add({
      title: 'Water usage logged',
      description: `${waterLogForm.liters_applied}L recorded.`,
      icon: 'i-lucide-droplets',
      color: 'success'
    });
  } catch (err) {
    toast.add({
      title: 'Failed to log water',
      description: tasksStore.error || err.message,
      icon: 'i-lucide-alert-circle',
      color: 'error'
    });
  }
}

watch(selectedGardenId, (newId, oldId) => {
  if (newId && oldId && Number(newId) !== Number(oldId)) {
    filterZoneId.value = 'ALL';
    filterAssignee.value = 'ALL';
    loadGardenWorkspace(newId);
  }
});

onMounted(async () => {
  if (!gardensStore.gardens.length) {
    await gardensStore.fetchGardens().catch(() => {});
  }
  const queryGid = Number(route.query.gardenId);
  const initialId =
    (queryGid && gardensStore.gardens.some((g) => Number(g.id) === queryGid) && queryGid) ||
    gardensStore.activeGarden?.id ||
    gardensStore.gardens[0]?.id ||
    null;

  if (initialId) {
    selectedGardenId.value = Number(initialId);
    await loadGardenWorkspace(initialId);
  }
});
</script>
