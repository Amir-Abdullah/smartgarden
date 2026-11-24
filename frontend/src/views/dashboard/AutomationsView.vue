<template>
  <UDashboardPanel id="automations">
    <template #header>
      <UDashboardNavbar title="Automation Rule Engine">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <AlertBellButton />
          <UColorModeButton />
          <UButton
            v-if="isOwner && selectedZoneId"
            data-testid="create-rule-btn"
            color="primary"
            size="sm"
            icon="i-lucide-plus"
            @click="openCreateModal"
          >
            New Rule
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- Garden & Zone Selector -->
        <UCard>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <UFormField label="Garden">
              <USelect
                v-model="selectedGardenId"
                :items="gardenOptions"
                value-key="value"
                placeholder="Select garden"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Growing Zone">
              <USelect
                v-model="selectedZoneId"
                :items="zoneOptions"
                value-key="value"
                placeholder="Select zone"
                class="w-full"
              />
            </UFormField>
          </div>
        </UCard>

        <!-- RBAC Notice for GUEST or FAMILY -->
        <UAlert
          v-if="isGuestDenied"
          color="warning"
          variant="soft"
          icon="i-lucide-shield-alert"
          title="Guest Access Restricted"
          description="Automation rules are restricted to Owners and Family members (GET /rules requires Owner or Family permissions)."
        />

        <UAlert
          v-else-if="isFamilyReadOnly"
          color="info"
          variant="soft"
          icon="i-lucide-eye"
          title="Read-Only Family View"
          description="You can view active automation rules for this zone. Only garden Owners can create, edit, toggle, or delete rules."
        />

        <UAlert
          v-if="rulesStore.error"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="rulesStore.error"
        />

        <UEmpty
          v-if="!selectedZoneId"
          icon="i-lucide-workflow"
          title="No growing zone selected"
          description="Select a garden with at least one zone to manage automation rules."
        />

        <UCard v-else-if="!isGuestDenied">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 class="text-base font-semibold text-zinc-900 dark:text-white">
                  Zone Automation Rules
                </h3>
                <p class="text-xs text-zinc-500 dark:text-zinc-400">
                  Evaluated every 15 minutes with open-task deduplication and atomic daily execution caps
                </p>
              </div>
              <UBadge color="neutral" variant="subtle" size="xs">
                {{ zoneRules.length }} rule{{ zoneRules.length === 1 ? '' : 's' }}
              </UBadge>
            </div>
          </template>

          <div v-if="rulesStore.loading && zoneRules.length === 0" class="space-y-3 py-2">
            <USkeleton class="h-16 w-full" />
            <USkeleton class="h-16 w-full" />
          </div>

          <UEmpty
            v-else-if="zoneRules.length === 0"
            icon="i-lucide-workflow"
            title="No automation rules configured"
            description="Create a rule like IF Soil Moisture < 35% AND No Rain THEN Create Water Task."
            :actions="
              isOwner
                ? [{ label: 'Create Automation Rule', color: 'primary', icon: 'i-lucide-plus', onClick: openCreateModal }]
                : []
            "
          />

          <div v-else class="divide-y divide-zinc-200 dark:divide-zinc-800">
            <div
              v-for="rule in zoneRules"
              :key="rule.id"
              data-testid="rule-row"
              class="flex flex-col justify-between gap-4 py-4 lg:flex-row lg:items-center"
            >
              <div class="min-w-0 flex-1 space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm font-semibold text-zinc-900 dark:text-white">
                    {{ rule.name }}
                  </span>
                  <UBadge
                    :color="rule.is_active ? 'success' : 'neutral'"
                    variant="soft"
                    size="xs"
                  >
                    {{ rule.is_active ? 'Active' : 'Paused' }}
                  </UBadge>
                  <UBadge
                    data-testid="rule-executions-badge"
                    color="info"
                    variant="subtle"
                    size="xs"
                  >
                    {{ rule.executions_today || 0 }} / {{ rule.max_daily_executions || 3 }} today
                  </UBadge>
                </div>

                <!-- Structured IF/THEN Sentence -->
                <div class="flex flex-wrap items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                  <UBadge color="neutral" variant="outline" size="xs">IF</UBadge>
                  <span class="font-medium">{{ rule.metric }}</span>
                  <span class="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {{ operatorSymbol(rule.operator) }}
                  </span>
                  <span class="font-semibold">{{ rule.threshold_value }}{{ metricUnit(rule.metric) }}</span>
                  <UBadge color="neutral" variant="outline" size="xs">AND</UBadge>
                  <span>{{ rule.weather_condition === 'NO_RAIN' ? 'No Rain Expected' : 'Any Weather' }}</span>
                  <UBadge color="primary" variant="subtle" size="xs">THEN</UBadge>
                  <span class="font-medium">
                    {{ rule.action_type === 'CREATE_TASK' ? `Create ${rule.task_type} Task` : 'Send Alert' }}
                  </span>
                </div>

                <div class="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>Cooldown: {{ rule.cooldown_minutes }}m</span>
                  <span>
                    Last triggered:
                    {{ rule.last_triggered_at ? formatDateTime(rule.last_triggered_at) : 'Never' }}
                  </span>
                </div>
              </div>

              <div v-if="isOwner" class="flex shrink-0 items-center gap-3">
                <USwitch
                  :model-value="Boolean(rule.is_active)"
                  data-testid="rule-toggle-switch"
                  :disabled="rulesStore.actionLoading"
                  @update:model-value="(val) => handleToggleRule(rule, val)"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-pencil"
                  aria-label="Edit rule"
                  @click="openEditModal(rule)"
                />
                <UButton
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  aria-label="Delete rule"
                  :loading="rulesStore.actionLoading"
                  @click="handleDeleteRule(rule)"
                />
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Create / Edit Rule Modal -->
  <UModal
    v-model:open="isRuleModalOpen"
    :title="editingRuleId ? 'Edit Automation Rule' : 'Create Automation Rule'"
    description="Build an IF / AND / THEN rule evaluated automatically by the SmartGarden rule engine."
  >
    <template #body>
      <form id="automation-rule-form" class="space-y-4" @submit.prevent="handleSaveRule">
        <UAlert
          v-if="ruleModalError"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="ruleModalError"
        />

        <!-- Live Rule Sentence Preview -->
        <div class="rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-3 text-xs leading-relaxed text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
          <strong>Rule Preview:</strong>
          IF <strong>{{ ruleForm.metric }}</strong>
          <strong>{{ operatorSymbol(ruleForm.operator) }}</strong>
          <strong>{{ ruleForm.threshold_value }}{{ metricUnit(ruleForm.metric) }}</strong>
          AND <strong>{{ ruleForm.weather_condition === 'NO_RAIN' ? 'No Rain' : 'Any Weather' }}</strong>
          THEN
          <strong>
            {{ ruleForm.action_type === 'CREATE_TASK' ? `Create ${ruleForm.task_type} Task` : 'Send Alert' }}
          </strong>
        </div>

        <UFormField label="Rule Name" required>
          <UInput
            v-model="ruleForm.name"
            placeholder="e.g. Auto-Schedule Watering When Dry"
            class="w-full"
            required
          />
        </UFormField>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <UFormField label="IF Metric">
            <USelect
              v-model="ruleForm.metric"
              :items="metricOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Operator">
            <USelect
              v-model="ruleForm.operator"
              :items="operatorOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Threshold Value" required>
            <UInput
              v-model.number="ruleForm.threshold_value"
              type="number"
              step="0.1"
              class="w-full"
              required
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <UFormField label="AND Weather Condition">
            <USelect
              v-model="ruleForm.weather_condition"
              :items="weatherOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="THEN Action">
            <USelect
              v-model="ruleForm.action_type"
              :items="actionOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField v-if="ruleForm.action_type === 'CREATE_TASK'" label="Task Type to Create">
          <USelect
            v-model="ruleForm.task_type"
            :items="taskTypeOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <UFormField label="Cooldown (Minutes)">
            <UInput
              v-model.number="ruleForm.cooldown_minutes"
              type="number"
              min="0"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Max Daily Executions">
            <UInput
              v-model.number="ruleForm.max_daily_executions"
              type="number"
              min="1"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <span class="text-xs font-medium text-zinc-700 dark:text-zinc-300">Enable rule immediately</span>
          <USwitch v-model="ruleForm.is_active" />
        </div>
      </form>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="isRuleModalOpen = false">
          Cancel
        </UButton>
        <UButton
          type="submit"
          form="automation-rule-form"
          color="primary"
          icon="i-lucide-check"
          :loading="rulesStore.actionLoading"
        >
          {{ editingRuleId ? 'Save Rule' : 'Create Rule' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { useGardensStore } from '../../stores/gardens.js';
import { useMembersStore } from '../../stores/members.js';
import { useAuthStore } from '../../stores/auth.js';
import { useRulesStore } from '../../stores/rules.js';
import AlertBellButton from '../../components/AlertBellButton.vue';

const route = useRoute();
const toast = useToast();
const gardensStore = useGardensStore();
const membersStore = useMembersStore();
const authStore = useAuthStore();
const rulesStore = useRulesStore();

const selectedGardenId = ref(null);
const selectedZoneId = ref(null);

const isRuleModalOpen = ref(false);
const editingRuleId = ref(null);
const ruleModalError = ref('');

const ruleForm = reactive({
  name: '',
  metric: 'SOIL_MOISTURE',
  operator: 'LT',
  threshold_value: 35,
  weather_condition: 'NO_RAIN',
  action_type: 'CREATE_TASK',
  task_type: 'WATER',
  cooldown_minutes: 180,
  max_daily_executions: 3,
  is_active: true
});

const metricOptions = [
  { label: 'Soil Moisture (%)', value: 'SOIL_MOISTURE' },
  { label: 'Temperature (°C)', value: 'TEMPERATURE' },
  { label: 'Humidity (%)', value: 'HUMIDITY' },
  { label: 'Light Intensity (lux)', value: 'LIGHT_LUX' }
];

const operatorOptions = [
  { label: 'Less Than (<)', value: 'LT' },
  { label: 'Greater Than (>)', value: 'GT' },
  { label: 'Equals (=)', value: 'EQ' }
];

const weatherOptions = [
  { label: 'Any Weather (ANY)', value: 'ANY' },
  { label: 'No Rain Expected (NO_RAIN)', value: 'NO_RAIN' }
];

const actionOptions = [
  { label: 'Create Care Task (CREATE_TASK)', value: 'CREATE_TASK' },
  { label: 'Send Alert (SEND_ALERT)', value: 'SEND_ALERT' }
];

const taskTypeOptions = [
  { label: 'WATER', value: 'WATER' },
  { label: 'FERTILIZE', value: 'FERTILIZE' },
  { label: 'PRUNE', value: 'PRUNE' },
  { label: 'REPOT', value: 'REPOT' },
  { label: 'HARVEST', value: 'HARVEST' },
  { label: 'PEST_INSPECTION', value: 'PEST_INSPECTION' }
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

const zoneOptions = computed(() =>
  gardenZones.value.map((z) => ({ label: z.name, value: z.id }))
);

const currentRole = computed(
  () => activeGarden.value?.role || membersStore.currentUserRole || 'GUEST'
);
const isOwner = computed(
  () => currentRole.value === 'OWNER' || currentRole.value === 'ADMIN' || authStore.isAdmin
);
const isGuestDenied = computed(
  () =>
    (!authStore.isAdmin && currentRole.value === 'GUEST') ||
    Boolean(selectedZoneId.value && rulesStore.forbiddenByZone[Number(selectedZoneId.value)])
);
const isFamilyReadOnly = computed(
  () => !isGuestDenied.value && !isOwner.value
);

const zoneRules = computed(() =>
  selectedZoneId.value ? rulesStore.rulesByZone[Number(selectedZoneId.value)] || [] : []
);

function operatorSymbol(op) {
  if (op === 'LT') return '<';
  if (op === 'GT') return '>';
  return '=';
}

function metricUnit(metric) {
  if (metric === 'SOIL_MOISTURE' || metric === 'HUMIDITY') return '%';
  if (metric === 'TEMPERATURE') return '°C';
  if (metric === 'LIGHT_LUX') return ' lx';
  return '';
}

function formatDateTime(iso) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

let syncingZoneSelection = false;

async function loadGardenRulesData(gardenId) {
  const gid = Number(gardenId);
  if (!gid) return;
  rulesStore.clearMessages();
  const [detail] = await Promise.all([
    gardensStore.fetchGardenDetail(gid).catch(() => null),
    membersStore.fetchMembers(gid).catch(() => {})
  ]);
  const zones = detail?.zones || gardenZones.value;
  const nextZid = zones[0]?.id || null;
  if (selectedZoneId.value !== nextZid) {
    syncingZoneSelection = true;
    try {
      selectedZoneId.value = nextZid;
      await nextTick();
    } finally {
      syncingZoneSelection = false;
    }
  }
  if (nextZid && !isGuestDenied.value) {
    await rulesStore.fetchZoneRules(nextZid).catch(() => {});
  }
}

function openCreateModal() {
  editingRuleId.value = null;
  ruleModalError.value = '';
  ruleForm.name = '';
  ruleForm.metric = 'SOIL_MOISTURE';
  ruleForm.operator = 'LT';
  ruleForm.threshold_value = 35;
  ruleForm.weather_condition = 'NO_RAIN';
  ruleForm.action_type = 'CREATE_TASK';
  ruleForm.task_type = 'WATER';
  ruleForm.cooldown_minutes = 180;
  ruleForm.max_daily_executions = 3;
  ruleForm.is_active = true;
  isRuleModalOpen.value = true;
}

function openEditModal(rule) {
  editingRuleId.value = rule.id;
  ruleModalError.value = '';
  ruleForm.name = rule.name || '';
  ruleForm.metric = rule.metric || 'SOIL_MOISTURE';
  ruleForm.operator = rule.operator || 'LT';
  ruleForm.threshold_value = Number(rule.threshold_value ?? 35);
  ruleForm.weather_condition = rule.weather_condition || 'ANY';
  ruleForm.action_type = rule.action_type || 'CREATE_TASK';
  ruleForm.task_type = rule.task_type || 'WATER';
  ruleForm.cooldown_minutes = Number(rule.cooldown_minutes ?? 180);
  ruleForm.max_daily_executions = Number(rule.max_daily_executions ?? 3);
  ruleForm.is_active = Boolean(rule.is_active);
  isRuleModalOpen.value = true;
}

async function handleSaveRule() {
  ruleModalError.value = '';
  if (!ruleForm.name.trim()) {
    ruleModalError.value = 'Rule name is required.';
    return;
  }

  const payload = {
    name: ruleForm.name.trim(),
    metric: ruleForm.metric,
    operator: ruleForm.operator,
    threshold_value: Number(ruleForm.threshold_value),
    weather_condition: ruleForm.weather_condition,
    action_type: ruleForm.action_type,
    task_type: ruleForm.task_type,
    cooldown_minutes: Number(ruleForm.cooldown_minutes ?? 180),
    max_daily_executions: Number(ruleForm.max_daily_executions ?? 3),
    is_active: Boolean(ruleForm.is_active)
  };

  try {
    if (editingRuleId.value) {
      await rulesStore.updateRule(selectedZoneId.value, editingRuleId.value, payload);
      toast.add({
        title: 'Automation rule updated',
        icon: 'i-lucide-check-circle-2',
        color: 'success'
      });
    } else {
      await rulesStore.createRule(selectedZoneId.value, payload);
      toast.add({
        title: 'Automation rule created',
        icon: 'i-lucide-check-circle-2',
        color: 'success'
      });
    }
    isRuleModalOpen.value = false;
  } catch (err) {
    ruleModalError.value = rulesStore.error || err.message || 'Failed to save rule.';
  }
}

async function handleToggleRule(rule, nextActive) {
  try {
    await rulesStore.toggleRule(selectedZoneId.value, rule.id, nextActive);
    toast.add({
      title: nextActive ? 'Rule enabled' : 'Rule paused',
      icon: 'i-lucide-workflow',
      color: 'success'
    });
  } catch (err) {
    toast.add({
      title: 'Failed to toggle rule',
      description: rulesStore.error || err.message,
      icon: 'i-lucide-alert-circle',
      color: 'error'
    });
  }
}

async function handleDeleteRule(rule) {
  try {
    await rulesStore.deleteRule(selectedZoneId.value, rule.id);
    toast.add({
      title: 'Automation rule deleted',
      icon: 'i-lucide-trash-2',
      color: 'success'
    });
  } catch (err) {
    toast.add({
      title: 'Failed to delete rule',
      description: rulesStore.error || err.message,
      icon: 'i-lucide-alert-circle',
      color: 'error'
    });
  }
}

watch(selectedGardenId, (newId, oldId) => {
  if (newId && oldId && Number(newId) !== Number(oldId)) {
    loadGardenRulesData(newId);
  }
});

watch(selectedZoneId, async (newZid, oldZid) => {
  if (syncingZoneSelection) return;
  if (newZid && Number(newZid) !== Number(oldZid) && (authStore.isAdmin || currentRole.value !== 'GUEST')) {
    await rulesStore.fetchZoneRules(newZid).catch(() => {});
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
    await loadGardenRulesData(initialId);
  }
});
</script>
