<template>
  <UDashboardPanel id="alerts">
    <template #header>
      <UDashboardNavbar title="Smart Threshold Alerts">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <AlertBellButton />
          <UColorModeButton />
          <UButton
            v-if="alertsStore.unreadCount > 0 && selectedGardenId"
            data-testid="mark-all-read-btn"
            color="primary"
            variant="soft"
            size="sm"
            icon="i-lucide-check-check"
            :loading="alertsStore.actionLoading"
            @click="handleMarkAllRead"
          >
            Mark All Read
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- Garden Selector & Feed Filters -->
        <UCard>
          <div class="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <UFormField label="Garden" class="w-full md:w-72">
              <USelect
                v-model="selectedGardenId"
                :items="gardenOptions"
                value-key="value"
                placeholder="Select garden"
                class="w-full"
              />
            </UFormField>

            <div class="flex flex-wrap items-center gap-2">
              <UButton
                v-for="f in filterOptions"
                :key="f.value"
                size="xs"
                :color="feedFilter === f.value ? 'primary' : 'neutral'"
                :variant="feedFilter === f.value ? 'solid' : 'outline'"
                @click="feedFilter = f.value"
              >
                {{ f.label }}
              </UButton>
            </div>
          </div>
        </UCard>

        <UAlert
          v-if="alertsStore.error"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="alertsStore.error"
        />

        <div class="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <!-- Alert Feed (Left 7 cols) -->
          <div class="space-y-4 xl:col-span-7">
            <UCard>
              <template #header>
                <div class="flex items-center justify-between gap-2">
                  <div>
                    <h3 class="text-base font-semibold text-zinc-900 dark:text-white">
                      Alert History &amp; Watchdog Feed
                    </h3>
                    <p class="text-xs text-zinc-500 dark:text-zinc-400">
                      Ranked by severity (CRITICAL &rarr; WARNING &rarr; INFO) and recency
                    </p>
                  </div>
                  <UBadge :color="alertsStore.unreadCount > 0 ? 'error' : 'success'" variant="soft" size="xs">
                    {{ alertsStore.unreadCount }} unread
                  </UBadge>
                </div>
              </template>

              <div v-if="alertsStore.loading && gardenAlerts.length === 0" class="space-y-3 py-2">
                <USkeleton class="h-16 w-full" />
                <USkeleton class="h-16 w-full" />
              </div>

              <UEmpty
                v-else-if="filteredAlerts.length === 0"
                icon="i-lucide-bell-off"
                title="No alerts match the current filter"
                description="Threshold breaches and offline device watchdog alerts will appear here."
              />

              <div v-else class="divide-y divide-zinc-200 dark:divide-zinc-800">
                <div
                  v-for="alert in filteredAlerts"
                  :key="String(alert.id)"
                  data-testid="alert-log-row"
                  class="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-start"
                  :class="alert.is_read ? 'opacity-70' : ''"
                >
                  <div class="min-w-0 flex-1 space-y-1.5">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <UBadge :color="severityColor(alert.severity)" variant="soft" size="xs">
                        {{ alert.severity || 'WARNING' }}
                      </UBadge>
                      <UBadge color="neutral" variant="outline" size="xs">
                        {{ alert.metric }}
                      </UBadge>
                      <UBadge
                        v-if="alert.alert_source === 'WATCHDOG'"
                        color="warning"
                        variant="subtle"
                        size="xs"
                      >
                        Watchdog
                      </UBadge>
                      <UBadge
                        v-if="alert.is_suppressed"
                        color="info"
                        variant="subtle"
                        size="xs"
                        icon="i-lucide-moon"
                      >
                        Quiet Hours Suppressed
                      </UBadge>
                      <UBadge
                        v-if="alert.email_sent"
                        color="success"
                        variant="subtle"
                        size="xs"
                        icon="i-lucide-mail"
                      >
                        Email Sent
                      </UBadge>
                    </div>

                    <p class="text-sm font-medium text-zinc-900 dark:text-white">
                      {{ alert.message }}
                    </p>

                    <div class="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                      <span v-if="alert.zone_name">{{ alert.zone_name }}</span>
                      <span v-if="alert.triggered_value !== null && alert.triggered_value !== undefined">
                        Triggered: {{ alert.triggered_value }}
                        <template v-if="alert.threshold_value !== null && alert.threshold_value !== undefined">
                          (Threshold: {{ alert.threshold_value }})
                        </template>
                      </span>
                      <span>{{ formatDateTime(alert.triggered_at) }}</span>
                    </div>
                  </div>

                  <div class="flex shrink-0 items-center gap-2">
                    <UBadge v-if="alert.is_read" color="neutral" variant="subtle" size="xs">
                      Read
                    </UBadge>
                    <UButton
                      v-else
                      data-testid="mark-alert-read-btn"
                      size="xs"
                      color="primary"
                      variant="soft"
                      icon="i-lucide-check"
                      :loading="alertsStore.actionLoading"
                      @click="handleMarkRead(alert.id)"
                    >
                      Mark Read
                    </UButton>
                  </div>
                </div>
              </div>
            </UCard>
          </div>

          <!-- Per-Zone Threshold & Quiet Hours Config Editor (Right 5 cols) -->
          <div class="xl:col-span-5">
            <UCard>
              <template #header>
                <div>
                  <h3 class="text-base font-semibold text-zinc-900 dark:text-white">
                    Zone Thresholds &amp; Quiet Hours
                  </h3>
                  <p class="text-xs text-zinc-500 dark:text-zinc-400">
                    Configure per-zone bounds, cooldowns, and overnight email suppression
                  </p>
                </div>
              </template>

              <UAlert
                v-if="!isOwner"
                color="info"
                variant="soft"
                icon="i-lucide-lock"
                class="mb-4"
                title="Owner Permissions Required to Edit"
                description="Only garden Owners can modify alert thresholds and quiet hours. Family and Guest members see read-only settings."
              />

              <UEmpty
                v-if="!selectedZoneId"
                icon="i-lucide-sliders"
                title="No zones available"
                description="Add a growing zone to this garden to configure alert thresholds."
              />

              <form
                v-else
                data-testid="alert-config-form"
                class="space-y-4"
                @submit.prevent="handleSaveConfig"
              >
                <UAlert
                  v-if="configError"
                  color="error"
                  variant="soft"
                  icon="i-lucide-alert-circle"
                  :title="configError"
                />

                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <UFormField label="Zone">
                    <USelect
                      v-model="selectedZoneId"
                      :items="zoneOptions"
                      value-key="value"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField label="Metric">
                    <USelect
                      v-model="configForm.metric"
                      :items="metricOptions"
                      value-key="value"
                      class="w-full"
                    />
                  </UFormField>
                </div>

                <div
                  v-if="activeCatalogDefault"
                  class="rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                >
                  Catalog plant baseline for {{ configForm.metric }}:
                  <strong>{{ activeCatalogDefault.min_threshold }} &ndash; {{ activeCatalogDefault.max_threshold }}</strong>
                </div>

                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <UFormField label="Min Threshold">
                    <UInput
                      v-model="configForm.min_threshold"
                      type="number"
                      step="0.1"
                      :disabled="!isOwner"
                      placeholder="Optional"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField label="Max Threshold">
                    <UInput
                      v-model="configForm.max_threshold"
                      type="number"
                      step="0.1"
                      :disabled="!isOwner"
                      placeholder="Optional"
                      class="w-full"
                    />
                  </UFormField>
                </div>

                <UFormField label="Cooldown (Minutes)">
                  <UInput
                    v-model.number="configForm.cooldown_minutes"
                    type="number"
                    min="1"
                    :disabled="!isOwner"
                    class="w-full"
                  />
                </UFormField>

                <div class="space-y-3 rounded-xl border border-zinc-200/80 p-3 dark:border-zinc-800">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-xs font-semibold text-zinc-900 dark:text-white">Rule Active</p>
                      <p class="text-[11px] text-zinc-500">Evaluate incoming readings against these bounds</p>
                    </div>
                    <USwitch v-model="configForm.is_active" :disabled="!isOwner" />
                  </div>

                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-xs font-semibold text-zinc-900 dark:text-white">In-App Alerts</p>
                      <p class="text-[11px] text-zinc-500">Show in alert inbox and real-time bell</p>
                    </div>
                    <USwitch v-model="configForm.is_in_app_enabled" :disabled="!isOwner" />
                  </div>

                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-xs font-semibold text-zinc-900 dark:text-white">Email Notifications</p>
                      <p class="text-[11px] text-zinc-500">Send SMTP alert email outside quiet hours</p>
                    </div>
                    <USwitch v-model="configForm.is_email_enabled" :disabled="!isOwner" />
                  </div>

                  <div class="flex items-center justify-between border-t border-zinc-200 pt-2.5 dark:border-zinc-800">
                    <div>
                      <p class="text-xs font-semibold text-zinc-900 dark:text-white">Quiet Hours Suppression</p>
                      <p class="text-[11px] text-zinc-500">Suppress email &amp; push alerts overnight (IANA timezone)</p>
                    </div>
                    <USwitch
                      v-model="configForm.quiet_hours_enabled"
                      data-testid="quiet-hours-toggle"
                      :disabled="!isOwner"
                    />
                  </div>

                  <div v-if="configForm.quiet_hours_enabled" class="grid grid-cols-2 gap-3 pt-1">
                    <UFormField label="Quiet Start (HH:mm)">
                      <UInput
                        v-model="configForm.quiet_hours_start"
                        type="time"
                        :disabled="!isOwner"
                        class="w-full"
                      />
                    </UFormField>
                    <UFormField label="Quiet End (HH:mm)">
                      <UInput
                        v-model="configForm.quiet_hours_end"
                        type="time"
                        :disabled="!isOwner"
                        class="w-full"
                      />
                    </UFormField>
                  </div>
                </div>

                <UButton
                  v-if="isOwner"
                  type="submit"
                  color="primary"
                  block
                  icon="i-lucide-save"
                  :loading="alertsStore.actionLoading"
                >
                  Save Alert Configuration
                </UButton>
              </form>
            </UCard>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { useGardensStore } from '../../stores/gardens.js';
import { useMembersStore } from '../../stores/members.js';
import { useAuthStore } from '../../stores/auth.js';
import { useAlertsStore } from '../../stores/alerts.js';
import AlertBellButton from '../../components/AlertBellButton.vue';

const route = useRoute();
const toast = useToast();
const gardensStore = useGardensStore();
const membersStore = useMembersStore();
const authStore = useAuthStore();
const alertsStore = useAlertsStore();

const selectedGardenId = ref(null);
const selectedZoneId = ref(null);
const feedFilter = ref('all');
const configError = ref('');

const configForm = reactive({
  metric: 'SOIL_MOISTURE',
  min_threshold: '',
  max_threshold: '',
  cooldown_minutes: 60,
  is_active: true,
  is_in_app_enabled: true,
  is_email_enabled: true,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00'
});

const filterOptions = [
  { label: 'All Alerts', value: 'all' },
  { label: 'Unread Only', value: 'unread' },
  { label: 'Suppressed (Quiet Hours)', value: 'suppressed' }
];

const metricOptions = [
  { label: 'Soil Moisture (%)', value: 'SOIL_MOISTURE' },
  { label: 'Temperature (°C)', value: 'TEMPERATURE' },
  { label: 'Humidity (%)', value: 'HUMIDITY' },
  { label: 'Light Intensity (lux)', value: 'LIGHT_LUX' }
];

const SEVERITY_RANK = {
  CRITICAL: 0,
  WARNING: 1,
  INFO: 2
};

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

const gardenAlerts = computed(() =>
  selectedGardenId.value ? alertsStore.alertsByGarden[Number(selectedGardenId.value)] || [] : []
);

const filteredAlerts = computed(() => {
  const list = gardenAlerts.value.filter((a) => {
    if (feedFilter.value === 'unread') return !a.is_read;
    if (feedFilter.value === 'suppressed') return Boolean(a.is_suppressed);
    return true;
  });
  // Rank CRITICAL -> WARNING -> INFO, then newest first
  return [...list].sort((a, b) => {
    const rankDiff = (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3);
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime();
  });
});

const zoneConfigState = computed(() =>
  selectedZoneId.value ? alertsStore.configsByZone[Number(selectedZoneId.value)] || { configs: [], catalog_defaults: {} } : { configs: [], catalog_defaults: {} }
);

const activeCatalogDefault = computed(() =>
  zoneConfigState.value.catalog_defaults?.[configForm.metric] || null
);

function syncConfigForm() {
  configError.value = '';
  const existing = (zoneConfigState.value.configs || []).find((c) => c.metric === configForm.metric);
  if (existing) {
    configForm.min_threshold =
      existing.min_threshold !== null && existing.min_threshold !== undefined
        ? String(existing.min_threshold)
        : '';
    configForm.max_threshold =
      existing.max_threshold !== null && existing.max_threshold !== undefined
        ? String(existing.max_threshold)
        : '';
    configForm.cooldown_minutes = Number(existing.cooldown_minutes || 60);
    configForm.is_active = Boolean(existing.is_active);
    configForm.is_in_app_enabled = Boolean(existing.is_in_app_enabled);
    configForm.is_email_enabled = Boolean(existing.is_email_enabled);
    configForm.quiet_hours_enabled = Boolean(existing.quiet_hours_start && existing.quiet_hours_end);
    configForm.quiet_hours_start = existing.quiet_hours_start ? String(existing.quiet_hours_start).slice(0, 5) : '22:00';
    configForm.quiet_hours_end = existing.quiet_hours_end ? String(existing.quiet_hours_end).slice(0, 5) : '07:00';
  } else {
    const def = activeCatalogDefault.value;
    configForm.min_threshold = def?.min_threshold !== undefined && def?.min_threshold !== null ? String(def.min_threshold) : '';
    configForm.max_threshold = def?.max_threshold !== undefined && def?.max_threshold !== null ? String(def.max_threshold) : '';
    configForm.cooldown_minutes = 60;
    configForm.is_active = true;
    configForm.is_in_app_enabled = true;
    configForm.is_email_enabled = true;
    configForm.quiet_hours_enabled = false;
    configForm.quiet_hours_start = '22:00';
    configForm.quiet_hours_end = '07:00';
  }
}

function severityColor(severity) {
  if (severity === 'CRITICAL') return 'error';
  if (severity === 'WARNING') return 'warning';
  return 'info';
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

let syncingZoneSelection = false;

async function loadGardenAlertsData(gardenId) {
  const gid = Number(gardenId);
  if (!gid) return;
  alertsStore.setActiveGarden(gid);
  const [detail] = await Promise.all([
    gardensStore.fetchGardenDetail(gid).catch(() => null),
    membersStore.fetchMembers(gid).catch(() => {}),
    alertsStore.fetchGardenAlerts(gid).catch(() => {})
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
  if (nextZid) {
    await alertsStore.fetchZoneAlertConfig(nextZid).catch(() => {});
    syncConfigForm();
  }
}

async function handleMarkRead(alertId) {
  try {
    await alertsStore.markAlertRead(alertId);
  } catch (err) {
    toast.add({
      title: 'Failed to mark read',
      description: alertsStore.error || err.message,
      icon: 'i-lucide-alert-circle',
      color: 'error'
    });
  }
}

async function handleMarkAllRead() {
  if (!selectedGardenId.value) return;
  try {
    const res = await alertsStore.markAllRead(selectedGardenId.value);
    toast.add({
      title: 'All alerts marked as read',
      description: `${res.updated_count || 0} alert(s) cleared.`,
      icon: 'i-lucide-check-check',
      color: 'success'
    });
  } catch (err) {
    toast.add({
      title: 'Failed to mark all read',
      description: alertsStore.error || err.message,
      icon: 'i-lucide-alert-circle',
      color: 'error'
    });
  }
}

async function handleSaveConfig() {
  configError.value = '';
  if (!selectedZoneId.value) return;

  const minVal = configForm.min_threshold === '' || configForm.min_threshold === null ? null : Number(configForm.min_threshold);
  const maxVal = configForm.max_threshold === '' || configForm.max_threshold === null ? null : Number(configForm.max_threshold);

  if (minVal !== null && maxVal !== null && minVal >= maxVal) {
    configError.value = 'Min threshold must be strictly less than Max threshold.';
    return;
  }

  const payload = {
    metric: configForm.metric,
    min_threshold: minVal,
    max_threshold: maxVal,
    cooldown_minutes: Number(configForm.cooldown_minutes || 60),
    is_active: Boolean(configForm.is_active),
    is_in_app_enabled: Boolean(configForm.is_in_app_enabled),
    is_email_enabled: Boolean(configForm.is_email_enabled),
    quiet_hours_start: configForm.quiet_hours_enabled ? configForm.quiet_hours_start : null,
    quiet_hours_end: configForm.quiet_hours_enabled ? configForm.quiet_hours_end : null
  };

  try {
    await alertsStore.saveZoneAlertConfig(selectedZoneId.value, payload);
    toast.add({
      title: 'Alert configuration saved',
      description: `${configForm.metric} thresholds updated.`,
      icon: 'i-lucide-check-circle-2',
      color: 'success'
    });
  } catch (err) {
    configError.value = alertsStore.error || err.message || 'Failed to save alert configuration.';
  }
}

watch(selectedGardenId, (newId, oldId) => {
  if (newId && oldId && Number(newId) !== Number(oldId)) {
    loadGardenAlertsData(newId);
  }
});

watch(selectedZoneId, async (newZid, oldZid) => {
  if (syncingZoneSelection) return;
  if (newZid && Number(newZid) !== Number(oldZid)) {
    await alertsStore.fetchZoneAlertConfig(newZid).catch(() => {});
    syncConfigForm();
  }
});

watch(
  () => configForm.metric,
  () => {
    syncConfigForm();
  }
);

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
    await loadGardenAlertsData(initialId);
  }
});
</script>
