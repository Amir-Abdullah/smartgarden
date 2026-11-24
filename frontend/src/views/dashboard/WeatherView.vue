<template>
  <UDashboardPanel id="weather-view">
    <template #header>
      <UDashboardNavbar title="Weather-Aware Planning & Spatial Cache">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <AlertBellButton />
          <UColorModeButton />
          <UButton
            v-if="selectedGardenId"
            data-testid="refresh-weather-btn"
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-refresh-cw"
            :loading="horticultureStore.weatherLoading"
            @click="loadWeather(true)"
          >
            Refresh Forecast
          </UButton>
          <UButton
            v-if="canMutate && selectedGardenId"
            data-testid="apply-rain-skip-btn"
            color="primary"
            size="sm"
            icon="i-lucide-cloud-rain"
            :loading="horticultureStore.weatherLoading"
            @click="handleApplyRainSkip"
          >
            Evaluate &amp; Apply Rain-Skip
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <UCard>
          <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <UFormField label="Garden Location" class="w-full sm:max-w-sm" data-testid="weather-garden-select">
              <USelect
                v-model="selectedGardenId"
                :items="gardenOptions"
                value-key="value"
                placeholder="Select a garden"
                class="w-full"
              />
            </UFormField>

            <div v-if="forecast" class="flex flex-wrap items-center gap-2 text-xs">
              <UBadge color="primary" variant="subtle" icon="i-lucide-map-pin">
                Grid: {{ forecast.grid_key }}
              </UBadge>
              <UBadge :color="forecast.cached ? 'success' : 'info'" variant="soft">
                {{ forecast.cached ? '30m Spatial Cache Hit' : `Live (${forecast.provider})` }}
              </UBadge>
              <UBadge
                v-if="forecast.rain_summary?.rain_likely"
                color="warning"
                variant="solid"
                icon="i-lucide-umbrella"
              >
                Rain-Skip Active ({{ forecast.rain_summary.max_precip_prob_12h }}% in 12h)
              </UBadge>
            </div>
          </div>
        </UCard>

        <UAlert
          v-if="horticultureStore.error"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="horticultureStore.error"
        />

        <UAlert
          v-if="rainSkipSummary"
          data-testid="rain-skip-summary"
          :color="rainSkipSummary.rain_likely ? 'warning' : 'success'"
          variant="soft"
          icon="i-lucide-cloud-rain"
          :title="rainSkipSummary.rain_likely ? `Rain-Skip Evaluated: ${rainSkipSummary.max_precip_prob_12h}% Precip Probability` : 'Dry Window: No Outdoor Rain-Skip Needed'"
          :description="`Postponed ${rainSkipSummary.postponed_tasks?.length || 0} outdoor watering task(s) by 24h; exempted ${rainSkipSummary.exempt_indoor_zones?.length || 0} indoor/protected zone(s).`"
        />

        <template v-if="weatherPayload && !weatherPayload.has_coordinates">
          <UAlert
            color="info"
            variant="soft"
            icon="i-lucide-map-pin-off"
            title="Coordinates Not Set for This Garden"
            description="Add latitude & longitude in Garden Settings to unlock spatial grid forecasts, frost alerts, and automatic rain-skip."
          />
        </template>

        <template v-else-if="forecast">
          <!-- Hazards -->
          <div v-if="forecast.hazards?.length" class="space-y-3">
            <UAlert
              v-for="(h, idx) in forecast.hazards"
              :key="idx"
              :color="h.severity === 'CRITICAL' ? 'error' : (h.severity === 'WARNING' ? 'warning' : 'info')"
              variant="subtle"
              icon="i-lucide-alert-triangle"
              :title="`${h.type} Advisory`"
              :description="h.message"
            />
          </div>

          <!-- Current KPIs -->
          <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <UCard>
              <p class="text-xs font-medium text-zinc-500 uppercase">Current Temp</p>
              <p class="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
                {{ forecast.current?.temperature_c ?? '—' }} &deg;C
              </p>
              <p class="mt-0.5 text-xs text-zinc-500">{{ forecast.current?.condition || 'Fair' }}</p>
            </UCard>
            <UCard>
              <p class="text-xs font-medium text-zinc-500 uppercase">12h Rain Probability</p>
              <p class="mt-1 text-2xl font-bold text-sky-600 dark:text-sky-400">
                {{ forecast.rain_summary?.max_precip_prob_12h ?? 0 }}%
              </p>
              <p class="mt-0.5 text-xs text-zinc-500">{{ forecast.rain_summary?.total_precip_mm_12h ?? 0 }} mm expected</p>
            </UCard>
            <UCard>
              <p class="text-xs font-medium text-zinc-500 uppercase">Wind Speed</p>
              <p class="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
                {{ forecast.current?.wind_speed_kmh ?? 0 }} km/h
              </p>
              <p class="mt-0.5 text-xs text-zinc-500">10m surface gust</p>
            </UCard>
            <UCard>
              <p class="text-xs font-medium text-zinc-500 uppercase">UV Index</p>
              <p class="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
                {{ forecast.current?.uv_index ?? 0 }}
              </p>
              <p class="mt-0.5 text-xs text-zinc-500">Humidity {{ forecast.current?.humidity_percent ?? 58 }}%</p>
            </UCard>
          </div>

          <!-- 7-Day Forecast -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="text-base font-semibold text-zinc-900 dark:text-white">7-Day Microclimate Outlook</h3>
                <span class="text-xs text-zinc-500">Evapotranspiration (ET0) &amp; Growing Degree Days (GDD Base 10&deg;C)</span>
              </div>
            </template>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
              <div
                v-for="day in forecast.daily"
                :key="day.date"
                class="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <div class="font-semibold text-zinc-900 dark:text-white">{{ day.date }}</div>
                <div class="mt-1 text-zinc-500">{{ day.condition }}</div>
                <div class="mt-2 font-bold text-emerald-600 dark:text-emerald-400">
                  {{ day.temp_min_c }}&deg; / {{ day.temp_max_c }}&deg;C
                </div>
                <div class="mt-1 text-sky-600 dark:text-sky-400">
                  Rain: {{ day.precipitation_prob_max }}% ({{ day.precipitation_sum_mm }} mm)
                </div>
                <div class="mt-1 text-zinc-500">ET0 {{ day.et0_mm }} mm · GDD {{ day.gdd_base10 }}</div>
              </div>
            </div>
          </UCard>

          <!-- Zone Rain-Skip Eligibility -->
          <UCard>
            <template #header>
              <h3 class="text-base font-semibold text-zinc-900 dark:text-white">Zone Rain-Skip Policy Status</h3>
            </template>

            <div class="space-y-2">
              <div
                v-for="z in weatherPayload.zone_rain_skip_status"
                :key="z.zone_id"
                class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200/80 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <div class="flex items-center gap-2">
                  <span class="font-medium text-zinc-900 dark:text-white">{{ z.zone_name }}</span>
                  <UBadge :color="z.is_outdoor ? 'warning' : 'info'" variant="subtle" size="xs">
                    {{ z.is_outdoor ? 'Outdoor' : 'Indoor / Protected' }}
                  </UBadge>
                </div>
                <UBadge
                  :color="z.status === 'EXEMPT_INDOOR' ? 'neutral' : (z.status === 'RAIN_SKIP_ACTIVE' ? 'warning' : 'success')"
                  variant="soft"
                  size="xs"
                >
                  {{ z.status === 'EXEMPT_INDOOR' ? 'Exempt (Relies on Soil Sensors)' : (z.status === 'RAIN_SKIP_ACTIVE' ? '24h Rain-Skip Eligible' : 'Normal Schedule') }}
                </UBadge>
              </div>
            </div>
          </UCard>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { useGardensStore } from '../../stores/gardens.js';
import { useHorticultureStore } from '../../stores/horticulture.js';
import AlertBellButton from '../../components/AlertBellButton.vue';

const route = useRoute();
const toast = useToast();
const gardensStore = useGardensStore();
const horticultureStore = useHorticultureStore();

const selectedGardenId = ref(null);

const gardenOptions = computed(() =>
  gardensStore.gardens.map((g) => ({ label: g.name, value: g.id }))
);

const activeGarden = computed(() =>
  gardensStore.gardens.find((g) => Number(g.id) === Number(selectedGardenId.value)) || null
);

const canMutate = computed(() => {
  const role = activeGarden.value?.role || 'OWNER';
  return role === 'OWNER' || role === 'FAMILY';
});

const weatherPayload = computed(() => horticultureStore.gardenWeather);
const forecast = computed(() => weatherPayload.value?.forecast || null);
const rainSkipSummary = computed(() => horticultureStore.lastRainSkipResult);

async function loadWeather(forceRefresh = false) {
  if (!selectedGardenId.value) return;
  try {
    await horticultureStore.fetchGardenWeather(selectedGardenId.value, { forceRefresh });
  } catch {
    // surfaced via store
  }
}

async function handleApplyRainSkip() {
  if (!selectedGardenId.value) return;
  try {
    const res = await horticultureStore.triggerRainSkip(selectedGardenId.value);
    toast.add({
      title: 'Rain-skip evaluation complete',
      description: `Postponed ${res?.postponed_tasks?.length || 0} outdoor WATER task(s).`,
      color: 'success',
      icon: 'i-lucide-cloud-rain'
    });
  } catch {
    toast.add({
      title: 'Rain-skip failed',
      description: horticultureStore.error || 'Unable to run rain-skip evaluation.',
      color: 'error'
    });
  }
}

watch(selectedGardenId, () => {
  horticultureStore.lastRainSkipResult = null;
  loadWeather(false);
});

onMounted(async () => {
  if (!gardensStore.gardens.length) {
    await gardensStore.fetchGardens();
  }
  const qId = Number(route.query.gardenId);
  if (qId && gardensStore.gardens.some((g) => Number(g.id) === qId)) {
    selectedGardenId.value = qId;
  } else if (gardensStore.gardens.length) {
    selectedGardenId.value = gardensStore.gardens[0].id;
  }
});
</script>
