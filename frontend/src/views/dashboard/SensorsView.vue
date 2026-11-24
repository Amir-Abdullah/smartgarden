<template>
  <UDashboardPanel id="sensors">
    <template #header>
      <UDashboardNavbar title="IoT Sensors & Telemetry">
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
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- Garden & Zone Selector Bar -->
        <UCard>
          <div class="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div class="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
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

            <div v-if="isOwner && selectedZoneId" class="flex flex-wrap items-center gap-2">
              <UButton
                data-testid="register-device-btn"
                color="primary"
                size="sm"
                icon="i-lucide-plus"
                @click="openRegisterModal"
              >
                Add Device
              </UButton>
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-qr-code"
                @click="openClaimModal"
              >
                Claim Device
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- One-Time Raw API Key Banner -->
        <UAlert
          v-if="sensorsStore.lastCreatedApiKey"
          data-testid="device-key-banner"
          color="warning"
          variant="subtle"
          icon="i-lucide-key-round"
          title="Device API Key Generated — Copy Now (Shown Once)"
          description="Store this sg_live_ key securely on your hardware or simulator. It cannot be retrieved again after closing this notice."
        >
          <template #actions>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <code class="rounded bg-zinc-900 px-2.5 py-1 font-mono text-xs text-emerald-300 dark:bg-zinc-950">
                {{ sensorsStore.lastCreatedApiKey }}
              </code>
              <UButton
                data-testid="copy-device-key-btn"
                size="xs"
                color="primary"
                variant="solid"
                icon="i-lucide-copy"
                @click="copyDeviceKey"
              >
                Copy Key
              </UButton>
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                @click="sensorsStore.clearLastCreatedApiKey()"
              >
                Dismiss
              </UButton>
            </div>
          </template>
        </UAlert>

        <UAlert
          v-if="sensorsStore.error"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="sensorsStore.error"
        />

        <UEmpty
          v-if="!selectedZoneId"
          icon="i-lucide-activity"
          title="No growing zone selected"
          description="Select a garden with at least one growing zone to view live sensor telemetry and device status."
        />

        <template v-else>
          <!-- Live Metric Gauges -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <UCard v-for="gauge in liveGauges" :key="gauge.key">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                    {{ gauge.label }}
                  </p>
                  <p class="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
                    {{ gauge.display }}
                  </p>
                  <p class="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {{ gauge.hint }}
                  </p>
                </div>
                <div class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <UIcon :name="gauge.icon" class="size-5" />
                </div>
              </div>
            </UCard>
          </div>

          <!-- Telemetry Chart Card -->
          <UCard>
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 class="text-base font-semibold text-zinc-900 dark:text-white">
                    Zone Telemetry History
                  </h3>
                  <p class="text-xs text-zinc-500 dark:text-zinc-400">
                    {{ latestReading ? `Last sample: ${formatDateTime(latestReading.recorded_at)}` : 'Awaiting first sensor sample' }}
                  </p>
                </div>

                <div class="flex flex-wrap items-center gap-1.5">
                  <UButton
                    v-for="tf in timeframeOptions"
                    :key="tf.value"
                    size="xs"
                    :color="timeframe === tf.value ? 'primary' : 'neutral'"
                    :variant="timeframe === tf.value ? 'solid' : 'outline'"
                    @click="selectTimeframe(tf.value)"
                  >
                    {{ tf.label }}
                  </UButton>
                </div>
              </div>
            </template>

            <TelemetryChart
              v-model:metric="chartMetric"
              :readings="timeframe === '30d' ? zoneDailyStats : zoneReadings"
              :is-daily-stats="timeframe === '30d'"
              :min-threshold="activeMetricThreshold.min"
              :max-threshold="activeMetricThreshold.max"
            />
          </UCard>

          <!-- Device Roster -->
          <UCard>
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 class="text-base font-semibold text-zinc-900 dark:text-white">
                    Zone Sensor Devices
                  </h3>
                  <p class="text-xs text-zinc-500 dark:text-zinc-400">
                    Registered ESP32, SG Pro, and simulator hardware nodes bound to this zone
                  </p>
                </div>
                <UBadge color="neutral" variant="subtle" size="xs">
                  {{ zoneDevices.length }} device{{ zoneDevices.length === 1 ? '' : 's' }}
                </UBadge>
              </div>
            </template>

            <UEmpty
              v-if="zoneDevices.length === 0"
              icon="i-lucide-cpu"
              title="No devices registered in this zone"
              description="Owners can register a simulator or hardware node or claim a provisioned device."
              :actions="
                isOwner
                  ? [{ label: 'Add Device', color: 'primary', icon: 'i-lucide-plus', onClick: openRegisterModal }]
                  : []
              "
            />

            <UTable v-else :data="zoneDevices" :columns="deviceColumns">
              <template #device_name-cell="{ row }">
                <div>
                  <div class="font-semibold text-zinc-900 dark:text-white">
                    {{ row.original.device_name }}
                  </div>
                  <div class="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {{ row.original.device_uid }} &bull; {{ row.original.device_type }}
                  </div>
                </div>
              </template>

              <template #connectivity_status-cell="{ row }">
                <UBadge
                  :color="connectivityColor(row.original.connectivity_status)"
                  variant="soft"
                  size="xs"
                >
                  {{ row.original.connectivity_status || (row.original.is_active ? 'OFFLINE' : 'REVOKED') }}
                </UBadge>
              </template>

              <template #telemetry-cell="{ row }">
                <div class="flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                  <span v-if="latestDeviceTelemetry(row.original.id)?.battery_percent !== null && latestDeviceTelemetry(row.original.id)?.battery_percent !== undefined">
                    Bat: {{ Number(latestDeviceTelemetry(row.original.id).battery_percent).toFixed(0) }}%
                  </span>
                  <span v-if="latestDeviceTelemetry(row.original.id)?.signal_rssi !== null && latestDeviceTelemetry(row.original.id)?.signal_rssi !== undefined">
                    RSSI: {{ latestDeviceTelemetry(row.original.id).signal_rssi }} dBm
                  </span>
                  <span v-if="!latestDeviceTelemetry(row.original.id)" class="text-zinc-400">
                    No signal data
                  </span>
                </div>
              </template>

              <template #firmware_version-cell="{ row }">
                <span class="font-mono text-xs text-zinc-600 dark:text-zinc-300">
                  {{ row.original.firmware_version || '—' }}
                </span>
              </template>

              <template #last_seen_at-cell="{ row }">
                <span class="text-xs text-zinc-500 dark:text-zinc-400">
                  {{ row.original.last_seen_at ? formatDateTime(row.original.last_seen_at) : 'Never' }}
                </span>
              </template>

              <template #actions-cell="{ row }">
                <div v-if="isOwner" class="flex justify-end gap-1.5">
                  <UButton
                    data-testid="rotate-key-btn"
                    size="xs"
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-refresh-cw"
                    :loading="sensorsStore.actionLoading"
                    @click="handleRotateKey(row.original)"
                  >
                    Rotate Key
                  </UButton>
                  <UButton
                    v-if="row.original.is_active"
                    data-testid="revoke-device-btn"
                    size="xs"
                    color="error"
                    variant="soft"
                    icon="i-lucide-ban"
                    :loading="sensorsStore.actionLoading"
                    @click="confirmRevokeDevice(row.original)"
                  >
                    Revoke
                  </UButton>
                </div>
              </template>
            </UTable>
          </UCard>

          <!-- Recent Readings / 30d Daily Stats Table -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-base font-semibold text-zinc-900 dark:text-white">
                  {{ timeframe === '30d' ? '30-Day Daily Aggregates' : 'Recent Sensor Readings' }}
                </h3>
                <UBadge color="neutral" variant="subtle" size="xs">
                  {{ timeframe === '30d' ? zoneDailyStats.length : zoneReadings.length }} rows
                </UBadge>
              </div>
            </template>

            <div v-if="timeframe === '30d'">
              <UEmpty
                v-if="zoneDailyStats.length === 0"
                icon="i-lucide-calendar"
                title="No daily aggregates yet"
                description="Daily rollups appear once historical readings are aggregated."
              />
              <div v-else class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                  <thead class="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <tr>
                      <th class="py-2 pr-3">Date</th>
                      <th class="py-2 pr-3">Moisture (Min/Avg/Max)</th>
                      <th class="py-2 pr-3">Temp (Min/Avg/Max)</th>
                      <th class="py-2 pr-3">Humidity Avg</th>
                      <th class="py-2 pr-3">Light Peak</th>
                      <th class="py-2">Samples</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
                    <tr v-for="stat in zoneDailyStats" :key="stat.id || stat.aggregate_date" data-testid="sensor-reading-row">
                      <td class="py-2 pr-3 font-medium text-zinc-900 dark:text-white">{{ stat.aggregate_date }}</td>
                      <td class="py-2 pr-3">{{ fmt(stat.min_soil_moisture) }} / {{ fmt(stat.avg_soil_moisture) }} / {{ fmt(stat.max_soil_moisture) }}%</td>
                      <td class="py-2 pr-3">{{ fmt(stat.min_temperature) }} / {{ fmt(stat.avg_temperature) }} / {{ fmt(stat.max_temperature) }}°C</td>
                      <td class="py-2 pr-3">{{ fmt(stat.avg_humidity) }}%</td>
                      <td class="py-2 pr-3">{{ stat.peak_light_lux !== null && stat.peak_light_lux !== undefined ? `${Number(stat.peak_light_lux).toLocaleString()} lx` : '—' }}</td>
                      <td class="py-2">{{ stat.sample_count }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div v-else>
              <UEmpty
                v-if="zoneReadings.length === 0"
                icon="i-lucide-activity"
                title="No readings recorded"
                description="Send telemetry to POST /api/sensors/ingest with a device sg_live_ key."
              />
              <div v-else class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                  <thead class="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <tr>
                      <th class="py-2 pr-3">Timestamp</th>
                      <th class="py-2 pr-3">Moisture</th>
                      <th class="py-2 pr-3">Temp</th>
                      <th class="py-2 pr-3">Humidity</th>
                      <th class="py-2 pr-3">Light</th>
                      <th class="py-2 pr-3">Battery</th>
                      <th class="py-2">RSSI</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
                    <tr v-for="r in zoneReadings.slice(0, 25)" :key="String(r.id)" data-testid="sensor-reading-row">
                      <td class="py-2 pr-3 font-medium text-zinc-900 dark:text-white">{{ formatDateTime(r.recorded_at) }}</td>
                      <td class="py-2 pr-3">{{ fmt(r.soil_moisture) }}%</td>
                      <td class="py-2 pr-3">{{ fmt(r.temperature) }}°C</td>
                      <td class="py-2 pr-3">{{ fmt(r.humidity) }}%</td>
                      <td class="py-2 pr-3">{{ r.light_lux !== null && r.light_lux !== undefined ? `${Number(r.light_lux).toLocaleString()} lx` : '—' }}</td>
                      <td class="py-2 pr-3">{{ r.battery_percent !== null && r.battery_percent !== undefined ? `${fmt(r.battery_percent)}%` : '—' }}</td>
                      <td class="py-2">{{ r.signal_rssi !== null && r.signal_rssi !== undefined ? `${r.signal_rssi} dBm` : '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </UCard>
        </template>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Register Device Modal -->
  <UModal
    v-model:open="isRegisterOpen"
    title="Add Sensor Device"
    description="Provision a new IoT sensor node and receive its sg_live_ API key once."
  >
    <template #body>
      <form id="register-device-form" class="space-y-4" @submit.prevent="handleRegisterDevice">
        <UAlert
          v-if="deviceModalError"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="deviceModalError"
        />

        <UFormField label="Device Name" required>
          <UInput
            v-model="registerForm.device_name"
            placeholder="e.g. South Bed Moisture Probe"
            class="w-full"
            required
          />
        </UFormField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Device Type">
            <USelect
              v-model="registerForm.device_type"
              :items="deviceTypeOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Firmware Version">
            <UInput v-model="registerForm.firmware_version" placeholder="v1.0.0" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Custom Device UID (Optional)">
          <UInput
            v-model="registerForm.device_uid"
            placeholder="Auto-generated if left blank"
            class="w-full"
          />
        </UFormField>
      </form>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="isRegisterOpen = false">
          Cancel
        </UButton>
        <UButton
          type="submit"
          form="register-device-form"
          color="primary"
          icon="i-lucide-check"
          :loading="sensorsStore.actionLoading"
        >
          Register Device
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- Claim Device Modal -->
  <UModal
    v-model:open="isClaimOpen"
    title="Claim Provisioned Device"
    description="Bind a pre-flashed SmartGarden device using its UID and 4–12 character claim PIN."
  >
    <template #body>
      <form id="claim-device-form" class="space-y-4" @submit.prevent="handleClaimDevice">
        <UAlert
          v-if="claimModalError"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="claimModalError"
        />

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Device UID" required>
            <UInput v-model="claimForm.deviceUid" placeholder="SG-PRO-0042" class="w-full" required />
          </UFormField>
          <UFormField label="Claim PIN" required>
            <UInput v-model="claimForm.pin" placeholder="4-12 alphanumeric chars" class="w-full" required />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Display Name">
            <UInput v-model="claimForm.name" placeholder="Optional friendly name" class="w-full" />
          </UFormField>
          <UFormField label="Device Type">
            <USelect
              v-model="claimForm.deviceType"
              :items="deviceTypeOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
        </div>
      </form>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="isClaimOpen = false">
          Cancel
        </UButton>
        <UButton
          type="submit"
          form="claim-device-form"
          color="primary"
          icon="i-lucide-check"
          :loading="sensorsStore.actionLoading"
        >
          Claim Device
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- Revoke Device Confirmation Modal -->
  <UModal
    v-model:open="isRevokeOpen"
    title="Revoke Device Key"
    :description="`Revoke '${deviceToRevoke?.device_name || ''}'? Telemetry sent with its current sg_live_ key will immediately fail with 401 until rotated.`"
  >
    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="isRevokeOpen = false">
          Cancel
        </UButton>
        <UButton
          color="error"
          icon="i-lucide-ban"
          :loading="sensorsStore.actionLoading"
          @click="handleRevokeDevice"
        >
          Revoke Device
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { useGardensStore } from '../../stores/gardens.js';
import { useMembersStore } from '../../stores/members.js';
import { useAuthStore } from '../../stores/auth.js';
import { useSensorsStore } from '../../stores/sensors.js';
import { useAlertsStore } from '../../stores/alerts.js';
import realtimeService from '../../services/realtime.js';
import AlertBellButton from '../../components/AlertBellButton.vue';
import TelemetryChart from '../../components/charts/TelemetryChart.vue';

const route = useRoute();
const toast = useToast();
const gardensStore = useGardensStore();
const membersStore = useMembersStore();
const authStore = useAuthStore();
const sensorsStore = useSensorsStore();
const alertsStore = useAlertsStore();

const selectedGardenId = ref(null);
const selectedZoneId = ref(null);
const chartMetric = ref('soil_moisture');
const timeframe = ref('24h');

const isRegisterOpen = ref(false);
const deviceModalError = ref('');
const registerForm = reactive({
  device_name: '',
  device_type: 'SIMULATOR',
  device_uid: '',
  firmware_version: 'v1.0.0'
});

const isClaimOpen = ref(false);
const claimModalError = ref('');
const claimForm = reactive({
  deviceUid: '',
  pin: '',
  name: '',
  deviceType: 'SG_PRO_V1'
});

const isRevokeOpen = ref(false);
const deviceToRevoke = ref(null);

const deviceTypeOptions = [
  { label: 'Simulator (SIMULATOR)', value: 'SIMULATOR' },
  { label: 'ESP32 WROOM (ESP32_WROOM)', value: 'ESP32_WROOM' },
  { label: 'SmartGarden Pro v1 (SG_PRO_V1)', value: 'SG_PRO_V1' },
  { label: 'Generic IoT (GENERIC_IOT)', value: 'GENERIC_IOT' }
];

const timeframeOptions = [
  { label: '24h', value: '24h', hours: 24 },
  { label: '48h', value: '48h', hours: 48 },
  { label: '7d', value: '7d', hours: 168 },
  { label: '30d Daily', value: '30d', days: 30 }
];

const deviceColumns = [
  { accessorKey: 'device_name', header: 'Device' },
  { accessorKey: 'connectivity_status', header: 'Status' },
  { id: 'telemetry', header: 'Battery & Signal' },
  { accessorKey: 'firmware_version', header: 'Firmware' },
  { accessorKey: 'last_seen_at', header: 'Last Seen' },
  { id: 'actions', header: '' }
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
const isOwner = computed(() => currentRole.value === 'OWNER' || currentRole.value === 'ADMIN' || authStore.isAdmin);

const zoneDevices = computed(() =>
  selectedZoneId.value ? sensorsStore.devicesByZone[Number(selectedZoneId.value)] || [] : []
);
const zoneReadings = computed(() =>
  selectedZoneId.value ? sensorsStore.readingsByZone[Number(selectedZoneId.value)] || [] : []
);
const zoneDailyStats = computed(() =>
  selectedZoneId.value ? sensorsStore.dailyStatsByZone[Number(selectedZoneId.value)] || [] : []
);
const latestReading = computed(() =>
  selectedZoneId.value ? sensorsStore.latestByZone[Number(selectedZoneId.value)] || zoneReadings.value[0] || null : null
);

const activeMetricThreshold = computed(() => {
  if (!selectedZoneId.value) return { min: null, max: null };
  const cfgData = alertsStore.configsByZone[Number(selectedZoneId.value)];
  if (!cfgData) return { min: null, max: null };
  const metricEnum = chartMetric.value.toUpperCase();
  const cfg = (cfgData.configs || []).find((c) => c.metric === metricEnum && c.is_active);
  if (cfg) {
    return {
      min: cfg.min_threshold !== null && cfg.min_threshold !== undefined ? Number(cfg.min_threshold) : null,
      max: cfg.max_threshold !== null && cfg.max_threshold !== undefined ? Number(cfg.max_threshold) : null
    };
  }
  const def = cfgData.catalog_defaults?.[metricEnum];
  return {
    min: def?.min_threshold ?? null,
    max: def?.max_threshold ?? null
  };
});

const liveGauges = computed(() => {
  const r = latestReading.value;
  return [
    {
      key: 'soil_moisture',
      label: 'Soil Moisture',
      display: r && r.soil_moisture !== null && r.soil_moisture !== undefined ? `${Number(r.soil_moisture).toFixed(1)}%` : '—',
      hint: 'Target 35–80% by species',
      icon: 'i-lucide-droplets'
    },
    {
      key: 'temperature',
      label: 'Temperature',
      display: r && r.temperature !== null && r.temperature !== undefined ? `${Number(r.temperature).toFixed(1)}°C` : '—',
      hint: 'Ambient microclimate',
      icon: 'i-lucide-thermometer'
    },
    {
      key: 'humidity',
      label: 'Relative Humidity',
      display: r && r.humidity !== null && r.humidity !== undefined ? `${Number(r.humidity).toFixed(1)}%` : '—',
      hint: 'Canopy air moisture',
      icon: 'i-lucide-wind'
    },
    {
      key: 'light_lux',
      label: 'Light Intensity',
      display: r && r.light_lux !== null && r.light_lux !== undefined ? `${Number(r.light_lux).toLocaleString()} lx` : '—',
      hint: 'Photosynthetic irradiance',
      icon: 'i-lucide-sun'
    }
  ];
});

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
  const mode = realtimeService.transportMode.value === 'sse' ? 'SSE' : 'WS';
  if (st === 'connected') return `Live (${mode})`;
  if (st === 'reconnecting') return 'Reconnecting';
  if (st === 'connecting') return 'Connecting';
  return 'Offline';
});

function connectivityColor(status) {
  if (status === 'ONLINE') return 'success';
  if (status === 'STALE') return 'warning';
  if (status === 'REVOKED') return 'error';
  return 'neutral';
}

function latestDeviceTelemetry(deviceId) {
  return zoneReadings.value.find((r) => Number(r.device_id) === Number(deviceId)) || null;
}

function fmt(v) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return '—';
  return Number(v).toFixed(1);
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

async function loadZoneTelemetry(zoneId) {
  const zid = Number(zoneId);
  if (!zid) return;
  const tf = timeframeOptions.find((t) => t.value === timeframe.value);
  await Promise.all([
    sensorsStore.fetchZoneDevices(zid).catch(() => {}),
    alertsStore.fetchZoneAlertConfig(zid).catch(() => {}),
    timeframe.value === '30d'
      ? sensorsStore.fetchZoneDailyStats(zid, { days: 30 }).catch(() => {})
      : sensorsStore.fetchZoneReadings(zid, { hours: tf?.hours || 24, limit: 200 }).catch(() => {})
  ]);
}

async function selectTimeframe(val) {
  timeframe.value = val;
  if (!selectedZoneId.value) return;
  if (val === '30d') {
    await sensorsStore.fetchZoneDailyStats(selectedZoneId.value, { days: 30 }).catch(() => {});
  } else {
    const tf = timeframeOptions.find((t) => t.value === val);
    await sensorsStore.fetchZoneReadings(selectedZoneId.value, { hours: tf?.hours || 24, limit: 200 }).catch(() => {});
  }
}

let syncingZoneSelection = false;

async function loadGarden(gardenId) {
  const gid = Number(gardenId);
  if (!gid) return;
  sensorsStore.clearMessages();
  sensorsStore.clearLastCreatedApiKey();
  alertsStore.setActiveGarden(gid);
  const [detail] = await Promise.all([
    gardensStore.fetchGardenDetail(gid).catch(() => null),
    membersStore.fetchMembers(gid).catch(() => {}),
    alertsStore.fetchGardenAlerts(gid).catch(() => {})
  ]);
  const zones = detail?.zones || gardenZones.value;
  const zoneIds = zones.map((z) => z.id);

  const queryZid = Number(route.query.zoneId);
  const nextZid =
    (queryZid && zones.some((z) => Number(z.id) === queryZid) && queryZid) ||
    zones[0]?.id ||
    null;

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
    await loadZoneTelemetry(nextZid);
  }

  realtimeService.connect(gid, {
    zoneIds,
    onAlertTriggered: (frameData) => {
      toast.add({
        title: `Alert: ${frameData.zoneName || 'Zone'}`,
        description: frameData.message,
        icon: 'i-lucide-bell-ring',
        color: frameData.severity === 'CRITICAL' ? 'error' : 'warning'
      });
    }
  });
}

function openRegisterModal() {
  deviceModalError.value = '';
  registerForm.device_name = '';
  registerForm.device_type = 'SIMULATOR';
  registerForm.device_uid = '';
  registerForm.firmware_version = 'v1.0.0';
  isRegisterOpen.value = true;
}

async function handleRegisterDevice() {
  deviceModalError.value = '';
  if (!registerForm.device_name.trim()) {
    deviceModalError.value = 'Device name is required.';
    return;
  }
  try {
    await sensorsStore.registerDevice(selectedZoneId.value, {
      device_name: registerForm.device_name.trim(),
      device_type: registerForm.device_type,
      device_uid: registerForm.device_uid.trim() || undefined,
      firmware_version: registerForm.firmware_version.trim() || undefined
    });
    isRegisterOpen.value = false;
    toast.add({
      title: 'Device registered',
      description: 'Copy the one-time sg_live_ key from the banner above.',
      icon: 'i-lucide-key-round',
      color: 'success'
    });
  } catch (err) {
    deviceModalError.value = sensorsStore.error || err.message || 'Failed to register device.';
  }
}

function openClaimModal() {
  claimModalError.value = '';
  claimForm.deviceUid = '';
  claimForm.pin = '';
  claimForm.name = '';
  claimForm.deviceType = 'SG_PRO_V1';
  isClaimOpen.value = true;
}

async function handleClaimDevice() {
  claimModalError.value = '';
  if (!claimForm.deviceUid.trim() || !claimForm.pin.trim()) {
    claimModalError.value = 'Device UID and claim PIN are required.';
    return;
  }
  try {
    await sensorsStore.claimDevice({
      deviceUid: claimForm.deviceUid.trim(),
      pin: claimForm.pin.trim(),
      zoneId: Number(selectedZoneId.value),
      name: claimForm.name.trim() || undefined,
      deviceType: claimForm.deviceType
    });
    isClaimOpen.value = false;
    toast.add({
      title: 'Device claimed',
      description: 'Copy the provisioned sg_live_ key from the banner above.',
      icon: 'i-lucide-check-circle-2',
      color: 'success'
    });
  } catch (err) {
    claimModalError.value = sensorsStore.error || err.message || 'Failed to claim device.';
  }
}

async function handleRotateKey(device) {
  try {
    await sensorsStore.rotateDeviceKey(device.id, selectedZoneId.value);
    toast.add({
      title: 'Device key rotated',
      description: 'Previous key invalidated. Copy the new key from the banner.',
      icon: 'i-lucide-refresh-cw',
      color: 'success'
    });
  } catch (err) {
    toast.add({
      title: 'Failed to rotate key',
      description: sensorsStore.error || err.message,
      icon: 'i-lucide-alert-circle',
      color: 'error'
    });
  }
}

function confirmRevokeDevice(device) {
  deviceToRevoke.value = device;
  isRevokeOpen.value = true;
}

async function handleRevokeDevice() {
  if (!deviceToRevoke.value) return;
  try {
    await sensorsStore.revokeDevice(deviceToRevoke.value.id, selectedZoneId.value);
    isRevokeOpen.value = false;
    deviceToRevoke.value = null;
    toast.add({
      title: 'Device revoked',
      icon: 'i-lucide-ban',
      color: 'success'
    });
  } catch (err) {
    toast.add({
      title: 'Revoke failed',
      description: sensorsStore.error || err.message,
      icon: 'i-lucide-alert-circle',
      color: 'error'
    });
  }
}

async function copyDeviceKey() {
  if (!sensorsStore.lastCreatedApiKey || typeof navigator === 'undefined' || !navigator.clipboard) return;
  try {
    await navigator.clipboard.writeText(sensorsStore.lastCreatedApiKey);
    toast.add({
      title: 'API key copied to clipboard',
      icon: 'i-lucide-clipboard-check',
      color: 'success'
    });
  } catch {
    // ignore clipboard failures
  }
}

watch(selectedGardenId, (newId, oldId) => {
  if (newId && oldId && Number(newId) !== Number(oldId)) {
    loadGarden(newId);
  }
});

watch(selectedZoneId, (newZid, oldZid) => {
  if (syncingZoneSelection) return;
  if (newZid && Number(newZid) !== Number(oldZid)) {
    sensorsStore.clearLastCreatedApiKey();
    loadZoneTelemetry(newZid);
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
    await loadGarden(initialId);
  }
});

onUnmounted(() => {
  realtimeService.disconnect();
  sensorsStore.clearLastCreatedApiKey();
});
</script>
