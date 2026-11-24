const {
  Zone,
  CareTask,
  AlertLog,
  Garden,
  WeatherCache
} = require('../models');
const eventBus = require('./eventBus');
const {
  getLocalDateString,
  addDaysToIsoDate
} = require('../utils/dbHelpers');

const WEATHER_API_PROVIDER = () => process.env.WEATHER_API_PROVIDER || 'open-meteo';
const CACHE_TTL_MS = () => Number(process.env.WEATHER_CACHE_TTL_MINUTES || 30) * 60 * 1000;
const WATCHDOG_COOLDOWN_MS = 6 * 60 * 60 * 1000;

const pendingRequests = new Map();
const customProviders = new Map();
let customFetcherOverride = null;

function createHttpError(statusCode, code, message, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

/**
 * Quantize latitude/longitude to ~1.1 km grid (0.01 deg) and normalize -0.00 to 0.00.
 */
function computeGridKey(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (
    latitude === undefined || latitude === null || latitude === '' ||
    longitude === undefined || longitude === null || longitude === '' ||
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    lat < -90 || lat > 90 || lng < -180 || lng > 180
  ) {
    throw createHttpError(400, 'INVALID_COORDINATES', 'Valid latitude (-90..90) and longitude (-180..180) are required.');
  }
  const latGrid = (Math.round(lat * 100) / 100) || 0;
  const lngGrid = (Math.round(lng * 100) / 100) || 0;
  return {
    latGrid,
    lngGrid,
    gridKey: `grid_${latGrid.toFixed(2)}_${lngGrid.toFixed(2)}`
  };
}

function registerWeatherProvider(name, fn) {
  if (typeof name === 'string' && typeof fn === 'function') {
    customProviders.set(name.toLowerCase(), fn);
  }
}

function setWeatherFetcher(fn) {
  customFetcherOverride = typeof fn === 'function' ? fn : null;
}

function buildDeterministicForecast(latGrid, lngGrid, now = new Date()) {
  const seedBase = Math.abs(Math.round(latGrid * 100) * 31 + Math.round(lngGrid * 100) * 17);
  const absLat = Math.abs(latGrid);
  const baseTemp = Math.max(4, Math.min(34, Math.round((27 - absLat * 0.25) * 10) / 10));
  const precipBase = (seedBase % 5) * 12;

  const hourly = [];
  for (let i = 0; i < 24; i++) {
    const dt = new Date(now.getTime() + i * 3600000);
    const wave = Math.sin(((dt.getUTCHours() - 6) / 24) * 2 * Math.PI);
    const temp = Math.round((baseTemp + wave * 5.5) * 10) / 10;
    const precipProb = Math.min(95, Math.max(5, Math.round(precipBase + (i < 12 ? (seedBase % 20) : 10))));
    const precipMm = precipProb >= 60 ? Math.round(((precipProb - 50) / 15) * 10) / 10 : 0;
    hourly.push({
      time: dt.toISOString(),
      temperature_c: temp,
      precipitation_probability: precipProb,
      precipitation_mm: precipMm,
      wind_speed_kmh: 10 + ((seedBase + i) % 18),
      uv_index: Math.max(0, Math.round(Math.max(0, wave) * 80) / 10)
    });
  }

  const daily = [];
  const conditions = ['Clear Sky', 'Partly Cloudy', 'Light Showers', 'Sunny Intervals'];
  for (let d = 0; d < 7; d++) {
    const dt = new Date(now.getTime() + d * 86400000);
    const shift = ((seedBase + d * 7) % 5) - 2;
    const tMin = Math.round((baseTemp - 6 + shift) * 10) / 10;
    const tMax = Math.round((baseTemp + 6 + shift) * 10) / 10;
    const pProb = Math.min(95, Math.max(10, precipBase + ((seedBase + d * 13) % 30)));
    const pSum = pProb >= 60 ? Math.round((pProb / 12) * 10) / 10 : 0.4;
    const gdd = Math.max(0, Math.round((((tMax + tMin) / 2) - 10) * 10) / 10);
    daily.push({
      date: dt.toISOString().slice(0, 10),
      temp_min_c: tMin,
      temp_max_c: tMax,
      precipitation_prob_max: pProb,
      precipitation_sum_mm: pSum,
      uv_index_max: Math.max(2, Math.min(10, Math.round((8 - absLat * 0.06) * 10) / 10)),
      et0_mm: Math.round(Math.max(1.5, (tMax - 8) * 0.22) * 10) / 10,
      gdd_base10: gdd,
      wind_speed_max_kmh: 12 + ((seedBase + d * 3) % 22),
      condition: pProb >= 60 ? 'Rain Showers' : conditions[(seedBase + d) % conditions.length]
    });
  }

  return {
    provider: 'open-meteo-fallback',
    current: {
      temperature_c: hourly[0].temperature_c,
      humidity_percent: 58,
      wind_speed_kmh: hourly[0].wind_speed_kmh,
      precipitation_mm: hourly[0].precipitation_mm,
      uv_index: hourly[0].uv_index,
      condition: daily[0].condition
    },
    hourly,
    daily
  };
}

async function fetchOpenMeteo(latGrid, lngGrid, now = new Date()) {
  if (process.env.NODE_ENV === 'test' || process.env.WEATHER_OFFLINE_FALLBACK === 'true') {
    return buildDeterministicForecast(latGrid, lngGrid, now);
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latGrid}&longitude=${lngGrid}` +
    '&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m' +
    '&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,uv_index' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max,et0_fao_evapotranspiration,wind_speed_10m_max' +
    '&forecast_days=7&timezone=UTC';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      throw new Error(`Open-Meteo HTTP ${res.status}`);
    }
    const raw = await res.json();

    const hourlyTimes = (raw.hourly && raw.hourly.time) || [];
    const hourly = hourlyTimes.slice(0, 24).map((t, idx) => ({
      time: t.endsWith('Z') ? t : `${t}:00.000Z`,
      temperature_c: Number(raw.hourly.temperature_2m?.[idx] ?? 20),
      precipitation_probability: Number(raw.hourly.precipitation_probability?.[idx] ?? 0),
      precipitation_mm: Number(raw.hourly.precipitation?.[idx] ?? 0),
      wind_speed_kmh: Number(raw.hourly.wind_speed_10m?.[idx] ?? 10),
      uv_index: Number(raw.hourly.uv_index?.[idx] ?? 0)
    }));

    const dailyTimes = (raw.daily && raw.daily.time) || [];
    const daily = dailyTimes.slice(0, 7).map((dateStr, idx) => {
      const tMin = Number(raw.daily.temperature_2m_min?.[idx] ?? 12);
      const tMax = Number(raw.daily.temperature_2m_max?.[idx] ?? 24);
      const pProb = Number(raw.daily.precipitation_probability_max?.[idx] ?? 0);
      return {
        date: dateStr,
        temp_min_c: tMin,
        temp_max_c: tMax,
        precipitation_prob_max: pProb,
        precipitation_sum_mm: Number(raw.daily.precipitation_sum?.[idx] ?? 0),
        uv_index_max: Number(raw.daily.uv_index_max?.[idx] ?? 5),
        et0_mm: Number(raw.daily.et0_fao_evapotranspiration?.[idx] ?? 3.2),
        gdd_base10: Math.max(0, Math.round((((tMax + tMin) / 2) - 10) * 10) / 10),
        wind_speed_max_kmh: Number(raw.daily.wind_speed_10m_max?.[idx] ?? 14),
        condition: pProb >= 60 ? 'Rain Likely' : (tMax >= 30 ? 'Warm & Sunny' : 'Partly Cloudy')
      };
    });

    return {
      provider: 'open-meteo',
      current: {
        temperature_c: Number(raw.current?.temperature_2m ?? hourly[0]?.temperature_c ?? 20),
        humidity_percent: Number(raw.current?.relative_humidity_2m ?? 60),
        wind_speed_kmh: Number(raw.current?.wind_speed_10m ?? hourly[0]?.wind_speed_kmh ?? 10),
        precipitation_mm: Number(raw.current?.precipitation ?? 0),
        uv_index: hourly[0]?.uv_index ?? 3,
        condition: daily[0]?.condition || 'Fair'
      },
      hourly,
      daily
    };
  } catch (_) {
    return buildDeterministicForecast(latGrid, lngGrid, now);
  }
}

function deriveWeatherAnalytics(payload, latGrid, lngGrid, gridKey) {
  const hourly = Array.isArray(payload.hourly) ? payload.hourly : [];
  const daily = Array.isArray(payload.daily) ? payload.daily : [];

  const next12h = hourly.slice(0, 12);
  const next24h = hourly.slice(0, 24);

  const maxPrecipProb12h = next12h.reduce(
    (max, h) => Math.max(max, Number(h.precipitation_probability || 0)),
    0
  );
  const totalPrecipMm12h = Math.round(
    next12h.reduce((sum, h) => sum + Number(h.precipitation_mm || 0), 0) * 100
  ) / 100;

  const rainLikely = maxPrecipProb12h >= 60 || totalPrecipMm12h > 5.0;

  const minTemp24h = next24h.length
    ? Math.min(...next24h.map((h) => Number(h.temperature_c)))
    : (daily[0] ? Number(daily[0].temp_min_c) : 15);
  const maxTemp24h = next24h.length
    ? Math.max(...next24h.map((h) => Number(h.temperature_c)))
    : (daily[0] ? Number(daily[0].temp_max_c) : 22);
  const maxWind24h = next24h.length
    ? Math.max(...next24h.map((h) => Number(h.wind_speed_kmh || 0)))
    : (daily[0] ? Number(daily[0].wind_speed_max_kmh || 0) : 12);

  const hazards = [];
  if (minTemp24h < 2) {
    hazards.push({
      type: 'FROST',
      severity: minTemp24h <= 0 ? 'CRITICAL' : 'WARNING',
      metric: 'TEMPERATURE',
      value: minTemp24h,
      threshold: 2,
      message: `Frost advisory: forecast low of ${minTemp24h}°C (< 2°C) in the next 24h. Cover tender crops.`
    });
  }
  if (maxTemp24h > 38) {
    hazards.push({
      type: 'HEATWAVE',
      severity: 'CRITICAL',
      metric: 'TEMPERATURE',
      value: maxTemp24h,
      threshold: 38,
      message: `Heatwave advisory: forecast high of ${maxTemp24h}°C (> 38°C). Deploy shade cloth.`
    });
  }
  if (maxWind24h >= 50) {
    hazards.push({
      type: 'HIGH_WIND',
      severity: 'WARNING',
      metric: 'HUMIDITY',
      value: maxWind24h,
      threshold: 50,
      message: `High wind advisory: gusts up to ${maxWind24h} km/h. Secure trellises and cold frames.`
    });
  }
  if (rainLikely) {
    hazards.push({
      type: 'HEAVY_RAIN',
      severity: 'INFO',
      metric: 'SOIL_MOISTURE',
      value: maxPrecipProb12h,
      threshold: 60,
      message: `Rain-skip active: ${maxPrecipProb12h}% precipitation probability (${totalPrecipMm12h} mm expected in 12h).`
    });
  }

  return {
    provider: payload.provider || WEATHER_API_PROVIDER(),
    grid_key: gridKey,
    latitude: latGrid,
    longitude: lngGrid,
    current: payload.current || {},
    hourly,
    daily,
    rain_summary: {
      max_precip_prob_12h: maxPrecipProb12h,
      total_precip_mm_12h: totalPrecipMm12h,
      rain_likely: rainLikely
    },
    hazards
  };
}

function parseStoredJson(val) {
  if (!val) return {};
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return {};
    }
  }
  return val;
}

async function fetchFromActiveProvider(latGrid, lngGrid, now) {
  if (customFetcherOverride) {
    return customFetcherOverride(latGrid, lngGrid, now);
  }
  const providerName = String(WEATHER_API_PROVIDER()).toLowerCase();
  const custom = customProviders.get(providerName);
  if (custom) {
    return custom(latGrid, lngGrid, now);
  }
  return fetchOpenMeteo(latGrid, lngGrid, now);
}

/**
 * Spatial grid cache (30-min TTL) + in-memory single-flight request coalescing.
 */
async function getWeatherData(latitude, longitude, options = {}) {
  const { latGrid, lngGrid, gridKey } = computeGridKey(latitude, longitude);
  const now = options.now instanceof Date ? options.now : new Date();
  const forceRefresh = Boolean(options.forceRefresh);

  if (!forceRefresh) {
    const cachedRow = await WeatherCache.findOne({ where: { grid_key: gridKey } });
    if (cachedRow && cachedRow.expires_at && new Date(cachedRow.expires_at).getTime() > now.getTime()) {
      const parsed = parseStoredJson(cachedRow.weather_data);
      const enriched = deriveWeatherAnalytics(parsed, latGrid, lngGrid, gridKey);
      return {
        ...enriched,
        cached: true,
        fetched_at: new Date(cachedRow.fetched_at).toISOString(),
        expires_at: new Date(cachedRow.expires_at).toISOString()
      };
    }
  }

  const inflightKey = forceRefresh ? `${gridKey}:force` : gridKey;
  if (pendingRequests.has(inflightKey)) {
    return pendingRequests.get(inflightKey);
  }

  const work = (async () => {
    try {
      const freshRaw = await fetchFromActiveProvider(latGrid, lngGrid, now);
      const enriched = deriveWeatherAnalytics(freshRaw, latGrid, lngGrid, gridKey);
      const ttlMs = CACHE_TTL_MS();
      const expiresAt = new Date(now.getTime() + ttlMs);

      const existing = await WeatherCache.findOne({ where: { grid_key: gridKey } });
      if (existing) {
        await WeatherCache.update({
          latitude: latGrid,
          longitude: lngGrid,
          weather_data: enriched,
          forecast_timestamp: now,
          fetched_at: now,
          expires_at: expiresAt
        }, { where: { id: existing.id } });
      } else {
        await WeatherCache.create({
          latitude: latGrid,
          longitude: lngGrid,
          grid_key: gridKey,
          weather_data: enriched,
          forecast_timestamp: now,
          fetched_at: now,
          expires_at: expiresAt
        });
      }

      return {
        ...enriched,
        cached: false,
        fetched_at: now.toISOString(),
        expires_at: expiresAt.toISOString()
      };
    } finally {
      pendingRequests.delete(inflightKey);
    }
  })();

  pendingRequests.set(inflightKey, work);
  return work;
}

/**
 * Determines whether rain is likely for a garden/coordinate pair (>= 60% prob or > 5mm in next 12h).
 * Also consumed by F10 ruleEngineService for NO_RAIN guards.
 */
async function isRainLikely(gardenOrCoords, options = {}) {
  if (!gardenOrCoords) {
    return { rain_likely: false, max_precip_prob_12h: 0, total_precip_mm_12h: 0, forecast: null };
  }
  const lat = gardenOrCoords.latitude;
  const lng = gardenOrCoords.longitude;
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return { rain_likely: false, max_precip_prob_12h: 0, total_precip_mm_12h: 0, forecast: null };
  }

  const forecast = await getWeatherData(lat, lng, options);
  const summary = forecast.rain_summary || { max_precip_prob_12h: 0, total_precip_mm_12h: 0, rain_likely: false };
  return {
    rain_likely: Boolean(summary.rain_likely),
    max_precip_prob_12h: Number(summary.max_precip_prob_12h || 0),
    total_precip_mm_12h: Number(summary.total_precip_mm_12h || 0),
    forecast
  };
}

async function getGardenWeather(gardenId, options = {}) {
  const garden = await Garden.findByPk(gardenId);
  if (!garden) {
    throw createHttpError(404, 'GARDEN_NOT_FOUND', `Garden ${gardenId} not found.`);
  }

  const zones = await Zone.findAll({
    where: { garden_id: garden.id },
    order: [['id', 'ASC']]
  });

  if (garden.latitude === null || garden.latitude === undefined || garden.longitude === null || garden.longitude === undefined) {
    return {
      garden: {
        id: garden.id,
        name: garden.name,
        timezone: garden.timezone,
        latitude: null,
        longitude: null
      },
      has_coordinates: false,
      forecast: null,
      zone_rain_skip_status: zones.map((z) => ({
        zone_id: z.id,
        zone_name: z.name,
        is_outdoor: Boolean(z.is_outdoor),
        rain_skip_eligible: Boolean(z.is_outdoor),
        status: z.is_outdoor ? 'NEEDS_COORDINATES' : 'EXEMPT_INDOOR'
      }))
    };
  }

  const forecast = await getWeatherData(garden.latitude, garden.longitude, options);
  const rainLikely = Boolean(forecast.rain_summary && forecast.rain_summary.rain_likely);

  return {
    garden: {
      id: garden.id,
      name: garden.name,
      timezone: garden.timezone,
      latitude: Number(garden.latitude),
      longitude: Number(garden.longitude)
    },
    has_coordinates: true,
    forecast,
    zone_rain_skip_status: zones.map((z) => ({
      zone_id: z.id,
      zone_name: z.name,
      is_outdoor: Boolean(z.is_outdoor),
      zone_type: z.zone_type,
      rain_skip_eligible: Boolean(z.is_outdoor),
      status: !z.is_outdoor ? 'EXEMPT_INDOOR' : (rainLikely ? 'RAIN_SKIP_ACTIVE' : 'DRY_WINDOW')
    }))
  };
}

/**
 * Postpones due outdoor WATER tasks by 24h when precipitation probability >= 60% or > 5mm.
 * Strictly exempts indoor zones (is_outdoor = false).
 */
async function applyRainSkipForGarden(gardenId, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const garden = await Garden.findByPk(gardenId);
  if (!garden) {
    throw createHttpError(404, 'GARDEN_NOT_FOUND', `Garden ${gardenId} not found.`);
  }

  const zones = await Zone.findAll({ where: { garden_id: garden.id }, order: [['id', 'ASC']] });
  const outdoorZones = zones.filter((z) => Boolean(z.is_outdoor));
  const indoorZones = zones.filter((z) => !z.is_outdoor);

  if (garden.latitude === null || garden.latitude === undefined || garden.longitude === null || garden.longitude === undefined) {
    return {
      garden_id: garden.id,
      evaluated: false,
      reason: 'MISSING_COORDINATES',
      rain_likely: false,
      postponed_tasks: [],
      already_postponed_tasks: [],
      exempt_indoor_zones: indoorZones.map((z) => ({ id: z.id, name: z.name }))
    };
  }

  const { rain_likely, max_precip_prob_12h, total_precip_mm_12h, forecast } = await isRainLikely(garden, options);
  const todayLocal = getLocalDateString(garden.timezone || 'UTC', now);
  const tomorrowLocal = addDaysToIsoDate(todayLocal, 1);

  const postponedTasks = [];
  const alreadyPostponedTasks = [];

  if (rain_likely && outdoorZones.length > 0) {
    const marker = `[Rain-Skip ${todayLocal}]`;
    const noteText = `${marker} Postponed by 24h: ${max_precip_prob_12h}% rain forecasted (${total_precip_mm_12h} mm).`;

    for (const zone of outdoorZones) {
      const pendingWaterTasks = await CareTask.findAll({
        where: {
          zone_id: zone.id,
          task_type: 'WATER',
          is_completed: false
        }
      });

      for (const task of pendingWaterTasks) {
        const dueStr = String(task.due_date).slice(0, 10);
        if (dueStr > tomorrowLocal) continue;

        if (task.notes && task.notes.includes(marker)) {
          alreadyPostponedTasks.push({ id: task.id, zone_id: zone.id, due_date: dueStr });
          continue;
        }

        const nextDue = addDaysToIsoDate(dueStr, 1);
        const updatedNotes = task.notes ? `${task.notes}\n${noteText}` : noteText;

        await CareTask.update(
          { due_date: nextDue, notes: updatedNotes },
          { where: { id: task.id } }
        );

        postponedTasks.push({
          id: task.id,
          zone_id: zone.id,
          zone_name: zone.name,
          previous_due_date: dueStr,
          new_due_date: nextDue
        });

        eventBus.emitEvent(garden.id, 'TASK_UPDATED', {
          gardenId: garden.id,
          taskId: task.id,
          zoneId: zone.id,
          taskType: task.task_type,
          isCompleted: false,
          postponedByRainSkip: true,
          dueDate: nextDue,
          timestamp: now.toISOString()
        });
      }
    }
  }

  return {
    garden_id: garden.id,
    grid_key: forecast ? forecast.grid_key : null,
    evaluated: true,
    rain_likely,
    max_precip_prob_12h,
    total_precip_mm_12h,
    postponed_tasks: postponedTasks,
    already_postponed_tasks: alreadyPostponedTasks,
    exempt_indoor_zones: indoorZones.map((z) => ({ id: z.id, name: z.name }))
  };
}

/**
 * 6-hour severe weather watchdog scanning all gardens with coordinates for
 * frost (<2C), heatwaves (>38C), high wind (>=50 km/h), and outdoor rain-skip postponements.
 */
async function runSevereWeatherWatchdog(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const gardens = await Garden.findAll({ order: [['id', 'ASC']] });

  let checkedGardens = 0;
  let hazardsDetected = 0;
  let alertsCreated = 0;
  let tasksPostponed = 0;

  for (const garden of gardens) {
    if (garden.latitude === null || garden.latitude === undefined || garden.longitude === null || garden.longitude === undefined) {
      continue;
    }

    checkedGardens++;
    const forecast = await getWeatherData(garden.latitude, garden.longitude, options);
    const rainResult = await applyRainSkipForGarden(garden.id, { ...options, now });
    tasksPostponed += rainResult.postponed_tasks.length;

    const zones = await Zone.findAll({ where: { garden_id: garden.id }, order: [['id', 'ASC']] });
    const targetZone = zones.find((z) => Boolean(z.is_outdoor)) || zones[0];
    if (!targetZone) continue;

    for (const hazard of (forecast.hazards || [])) {
      if (hazard.type === 'HEAVY_RAIN' && rainResult.postponed_tasks.length === 0) {
        continue;
      }
      hazardsDetected++;

      const recentLogs = await AlertLog.findAll({
        where: { zone_id: targetZone.id, metric: hazard.metric },
        order: [['id', 'DESC']],
        limit: 5
      });

      const prefixTag = `[WeatherWatchdog:${hazard.type}]`;
      const inCooldown = recentLogs.some((log) => {
        if (!log.message || !log.message.startsWith(prefixTag)) return false;
        const ts = new Date(log.triggered_at).getTime();
        return Number.isFinite(ts) && (now.getTime() - ts) < WATCHDOG_COOLDOWN_MS;
      });
      if (inCooldown) continue;

      const msg = `${prefixTag} ${hazard.message}`.slice(0, 255);
      const alert = await AlertLog.create({
        alert_config_id: null,
        zone_id: targetZone.id,
        metric: hazard.metric,
        triggered_value: Number(hazard.value),
        threshold_value: Number(hazard.threshold),
        severity: hazard.severity || 'WARNING',
        message: msg,
        is_read: false,
        email_sent: false,
        is_suppressed: false,
        triggered_at: now
      });

      eventBus.emitEvent(garden.id, 'ALERT_TRIGGERED', {
        alertId: alert.id,
        zoneId: targetZone.id,
        zoneName: targetZone.name,
        metric: hazard.metric,
        severity: hazard.severity || 'WARNING',
        triggeredValue: Number(hazard.value),
        thresholdValue: Number(hazard.threshold),
        message: msg,
        timestamp: now.toISOString()
      });

      alertsCreated++;
    }
  }

  return {
    checked_gardens: checkedGardens,
    hazards_detected: hazardsDetected,
    alerts_created: alertsCreated,
    tasks_postponed: tasksPostponed
  };
}

module.exports = {
  computeGridKey,
  registerWeatherProvider,
  setWeatherFetcher,
  buildDeterministicForecast,
  getWeatherData,
  isRainLikely,
  getGardenWeather,
  applyRainSkipForGarden,
  runSevereWeatherWatchdog
};
