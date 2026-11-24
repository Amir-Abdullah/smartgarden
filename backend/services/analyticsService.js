const {
  Garden,
  Zone,
  ZonePlant,
  SensorReading,
  SensorAggregateDaily,
  WaterUsageLog,
  CareTask,
  AlertLog,
  GrowthJournal
} = require('../models');
const { Op } = require('sequelize');
const { toCsv } = require('../utils/csvGenerator');
const { generateAnalyticsPdf } = require('../utils/pdfGenerator');

const RANGE_DAYS = {
  '7d': 7,
  '30d': 30,
  '90d': 90
};

function createError(statusCode, code, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function round(val, digits = 2) {
  if (val === null || val === undefined || !Number.isFinite(Number(val))) return null;
  const factor = Math.pow(10, digits);
  return Math.round(Number(val) * factor) / factor;
}

function toIsoDate(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Aggregates raw sensor_readings into sensor_aggregates_daily and safely prunes
 * readings older than retentionDays only after their daily rollup is persisted.
 */
async function runDailyTelemetryRollup(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const retentionDays = Number.isFinite(Number(options.retentionDays))
    ? Number(options.retentionDays)
    : 30;
  const cutoffMs = now.getTime() - retentionDays * 86400000;

  const readings = await SensorReading.findAll({
    order: [['recorded_at', 'ASC'], ['id', 'ASC']]
  });

  if (readings.length === 0) {
    return { dates_rolled_up: 0, aggregates_written: 0, readings_purged: 0 };
  }

  const buckets = new Map();
  for (const r of readings) {
    const dateStr = toIsoDate(r.recorded_at || r.created_at || now);
    if (!dateStr) continue;
    const key = `${Number(r.zone_id)}:${Number(r.device_id)}:${dateStr}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        zone_id: Number(r.zone_id),
        device_id: Number(r.device_id),
        aggregate_date: dateStr,
        items: []
      });
    }
    buckets.get(key).items.push(r);
  }

  const confirmedBuckets = new Set();
  const uniqueDates = new Set();
  let aggregatesWritten = 0;

  for (const [key, group] of buckets.entries()) {
    const items = group.items;
    const calcStats = (field, fallback = 0) => {
      const vals = items
        .map((x) => (x[field] !== null && x[field] !== undefined ? Number(x[field]) : null))
        .filter((v) => v !== null && Number.isFinite(v));
      if (vals.length === 0) return { min: fallback, max: fallback, avg: fallback };
      let min = vals[0];
      let max = vals[0];
      let sum = 0;
      for (const v of vals) {
        if (v < min) min = v;
        if (v > max) max = v;
        sum += v;
      }
      return {
        min: round(min, 2),
        max: round(max, 2),
        avg: round(sum / vals.length, 2)
      };
    };

    const moisture = calcStats('soil_moisture', 0);
    const temp = calcStats('temperature', 0);
    const humidity = calcStats('humidity', 0);
    const light = calcStats('light_lux', 0);

    const payload = {
      zone_id: group.zone_id,
      device_id: group.device_id,
      aggregate_date: group.aggregate_date,
      min_soil_moisture: moisture.min,
      max_soil_moisture: moisture.max,
      avg_soil_moisture: moisture.avg,
      min_temperature: temp.min,
      max_temperature: temp.max,
      avg_temperature: temp.avg,
      min_humidity: humidity.min,
      max_humidity: humidity.max,
      avg_humidity: humidity.avg,
      peak_light_lux: light.max,
      avg_light_lux: light.avg,
      sample_count: items.length
    };

    const existing = await SensorAggregateDaily.findOne({
      where: {
        zone_id: group.zone_id,
        device_id: group.device_id,
        aggregate_date: group.aggregate_date
      }
    });

    if (existing) {
      await existing.update(payload);
    } else {
      await SensorAggregateDaily.create(payload);
    }

    confirmedBuckets.add(key);
    uniqueDates.add(group.aggregate_date);
    aggregatesWritten++;
  }

  let readingsPurged = 0;
  for (const r of readings) {
    const recTime = new Date(r.recorded_at || r.created_at).getTime();
    if (!Number.isFinite(recTime) || recTime >= cutoffMs) continue;
    const dateStr = toIsoDate(r.recorded_at || r.created_at);
    const key = `${Number(r.zone_id)}:${Number(r.device_id)}:${dateStr}`;
    if (confirmedBuckets.has(key)) {
      await r.destroy();
      readingsPurged++;
    }
  }

  return {
    dates_rolled_up: uniqueDates.size,
    aggregates_written: aggregatesWritten,
    readings_purged: readingsPurged
  };
}

async function getGardenAnalytics(gardenId, { range = '30d', zoneId = null } = {}) {
  const days = RANGE_DAYS[range] || 30;
  const normalizedRange = RANGE_DAYS[range] ? range : '30d';

  const garden = await Garden.findByPk(gardenId);
  if (!garden) {
    throw createError(404, 'GARDEN_NOT_FOUND', `Garden ${gardenId} not found.`);
  }

  const allZones = await Zone.findAll({
    where: { garden_id: garden.id },
    order: [['id', 'ASC']]
  });

  let selectedZones = allZones;
  if (zoneId !== null && zoneId !== undefined && zoneId !== '' && zoneId !== 'ALL') {
    const parsedZoneId = Number(zoneId);
    selectedZones = allZones.filter((z) => Number(z.id) === parsedZoneId);
    if (selectedZones.length === 0) {
      throw createError(404, 'ZONE_NOT_FOUND', `Zone ${zoneId} not found in garden ${garden.id}.`);
    }
  }

  const now = new Date();
  const endDateStr = now.toISOString().slice(0, 10);
  const startDt = new Date(now.getTime() - (days - 1) * 86400000);
  startDt.setUTCHours(0, 0, 0, 0);
  const startDateStr = startDt.toISOString().slice(0, 10);
  const startMs = startDt.getTime();

  const zoneIds = selectedZones.map((z) => Number(z.id));
  if (zoneIds.length === 0) {
    return {
      garden: { id: Number(garden.id), name: garden.name, location_address: garden.location_address },
      range: normalizedRange,
      window: { start_date: startDateStr, end_date: endDateStr, days },
      kpis: {
        total_water_liters: 0,
        watering_events: 0,
        total_tasks: 0,
        completed_tasks: 0,
        task_completion_rate_pct: 0,
        avg_soil_moisture: null,
        avg_temperature: null,
        avg_humidity: null,
        unread_alerts: 0,
        journal_entries_count: 0
      },
      water_by_day: [],
      water_by_method: [],
      daily_telemetry: [],
      zone_summary: []
    };
  }

  const [waterLogsAll, aggregatesAll, rawReadingsAll, tasksAll, alertsAll, zonePlantsAll] = await Promise.all([
    WaterUsageLog.findAll({ where: { zone_id: { [Op.in]: zoneIds } }, order: [['recorded_at', 'ASC']] }),
    SensorAggregateDaily.findAll({ where: { zone_id: { [Op.in]: zoneIds } }, order: [['aggregate_date', 'ASC']] }),
    SensorReading.findAll({ where: { zone_id: { [Op.in]: zoneIds } }, order: [['recorded_at', 'ASC']] }),
    CareTask.findAll({ where: { zone_id: { [Op.in]: zoneIds } } }),
    AlertLog.findAll({ where: { zone_id: { [Op.in]: zoneIds } } }),
    ZonePlant.findAll({ where: { zone_id: { [Op.in]: zoneIds } } })
  ]);

  const plantIds = zonePlantsAll.map((zp) => Number(zp.id));
  const journalEntries = plantIds.length > 0
    ? await GrowthJournal.findAll({ where: { zone_plant_id: { [Op.in]: plantIds } } })
    : [];

  // Filter water logs within window
  const waterLogs = waterLogsAll.filter((w) => {
    const ts = new Date(w.recorded_at).getTime();
    return Number.isFinite(ts) && ts >= startMs;
  });

  const waterByDayMap = new Map();
  const waterByMethodMap = new Map();
  const waterByZoneMap = new Map();
  let totalWater = 0;

  for (const w of waterLogs) {
    const liters = Number(w.liters_applied || 0);
    totalWater += liters;
    const dayStr = toIsoDate(w.recorded_at) || endDateStr;
    const method = w.method || 'MANUAL_HOSE';
    const zId = Number(w.zone_id);

    const dayAcc = waterByDayMap.get(dayStr) || { date: dayStr, liters: 0, events: 0 };
    dayAcc.liters = round(dayAcc.liters + liters, 2);
    dayAcc.events += 1;
    waterByDayMap.set(dayStr, dayAcc);

    const methodAcc = waterByMethodMap.get(method) || { method, liters: 0, events: 0 };
    methodAcc.liters = round(methodAcc.liters + liters, 2);
    methodAcc.events += 1;
    waterByMethodMap.set(method, methodAcc);

    waterByZoneMap.set(zId, round((waterByZoneMap.get(zId) || 0) + liters, 2));
  }

  // Merge stored daily aggregates + today's/unrolled raw sensor readings inside window
  const dailyMap = new Map();
  const zoneTelemetryMap = new Map();

  const pushTelemetrySample = (dateStr, zId, { moist, temp, hum, lux, count }) => {
    const dayAcc = dailyMap.get(dateStr) || {
      date: dateStr,
      moistSum: 0,
      moistCount: 0,
      tempSum: 0,
      tempCount: 0,
      humSum: 0,
      humCount: 0,
      luxMax: 0,
      sample_count: 0
    };
    const zAcc = zoneTelemetryMap.get(zId) || { moistSum: 0, moistCount: 0, tempSum: 0, tempCount: 0 };

    const weight = Math.max(1, count);
    if (moist !== null && Number.isFinite(moist)) {
      dayAcc.moistSum += moist * weight;
      dayAcc.moistCount += weight;
      zAcc.moistSum += moist * weight;
      zAcc.moistCount += weight;
    }
    if (temp !== null && Number.isFinite(temp)) {
      dayAcc.tempSum += temp * weight;
      dayAcc.tempCount += weight;
      zAcc.tempSum += temp * weight;
      zAcc.tempCount += weight;
    }
    if (hum !== null && Number.isFinite(hum)) {
      dayAcc.humSum += hum * weight;
      dayAcc.humCount += weight;
    }
    if (lux !== null && Number.isFinite(lux) && lux > dayAcc.luxMax) {
      dayAcc.luxMax = lux;
    }
    dayAcc.sample_count += weight;
    dailyMap.set(dateStr, dayAcc);
    zoneTelemetryMap.set(zId, zAcc);
  };

  const aggregatedKeySet = new Set();
  for (const agg of aggregatesAll) {
    const dStr = String(agg.aggregate_date).slice(0, 10);
    if (dStr < startDateStr || dStr > endDateStr) continue;
    aggregatedKeySet.add(`${Number(agg.zone_id)}:${Number(agg.device_id)}:${dStr}`);
    pushTelemetrySample(dStr, Number(agg.zone_id), {
      moist: Number(agg.avg_soil_moisture),
      temp: Number(agg.avg_temperature),
      hum: Number(agg.avg_humidity),
      lux: Number(agg.peak_light_lux),
      count: Number(agg.sample_count || 1)
    });
  }

  for (const r of rawReadingsAll) {
    const ts = new Date(r.recorded_at || r.created_at).getTime();
    if (!Number.isFinite(ts) || ts < startMs) continue;
    const dStr = toIsoDate(r.recorded_at || r.created_at);
    if (!dStr) continue;
    const bucketKey = `${Number(r.zone_id)}:${Number(r.device_id)}:${dStr}`;
    if (aggregatedKeySet.has(bucketKey)) continue;
    pushTelemetrySample(dStr, Number(r.zone_id), {
      moist: r.soil_moisture !== null ? Number(r.soil_moisture) : null,
      temp: r.temperature !== null ? Number(r.temperature) : null,
      hum: r.humidity !== null ? Number(r.humidity) : null,
      lux: r.light_lux !== null ? Number(r.light_lux) : null,
      count: 1
    });
  }

  const daily_telemetry = Array.from(dailyMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      avg_soil_moisture: d.moistCount > 0 ? round(d.moistSum / d.moistCount, 1) : null,
      avg_temperature: d.tempCount > 0 ? round(d.tempSum / d.tempCount, 1) : null,
      avg_humidity: d.humCount > 0 ? round(d.humSum / d.humCount, 1) : null,
      peak_light_lux: round(d.luxMax, 0),
      sample_count: d.sample_count
    }));

  const overallMoistSum = Array.from(dailyMap.values()).reduce((s, d) => s + d.moistSum, 0);
  const overallMoistCount = Array.from(dailyMap.values()).reduce((s, d) => s + d.moistCount, 0);
  const overallTempSum = Array.from(dailyMap.values()).reduce((s, d) => s + d.tempSum, 0);
  const overallTempCount = Array.from(dailyMap.values()).reduce((s, d) => s + d.tempCount, 0);
  const overallHumSum = Array.from(dailyMap.values()).reduce((s, d) => s + d.humSum, 0);
  const overallHumCount = Array.from(dailyMap.values()).reduce((s, d) => s + d.humCount, 0);

  const completedTasks = tasksAll.filter((t) => Boolean(t.is_completed)).length;
  const unreadAlerts = alertsAll.filter((a) => !a.is_read).length;

  const zone_summary = selectedZones.map((z) => {
    const zId = Number(z.id);
    const zPlants = zonePlantsAll.filter((p) => Number(p.zone_id) === zId);
    const zTasks = tasksAll.filter((t) => Number(t.zone_id) === zId);
    const zCompleted = zTasks.filter((t) => Boolean(t.is_completed)).length;
    const zTele = zoneTelemetryMap.get(zId);
    return {
      zone_id: zId,
      zone_name: z.name,
      area_sqm: Number(z.area_sq_m || 0),
      plant_count: zPlants.reduce((sum, p) => sum + Number(p.quantity || 1), 0),
      water_liters: waterByZoneMap.get(zId) || 0,
      avg_soil_moisture: zTele && zTele.moistCount > 0 ? round(zTele.moistSum / zTele.moistCount, 1) : null,
      avg_temperature: zTele && zTele.tempCount > 0 ? round(zTele.tempSum / zTele.tempCount, 1) : null,
      tasks_completed: zCompleted,
      tasks_total: zTasks.length
    };
  });

  return {
    garden: {
      id: Number(garden.id),
      name: garden.name,
      location_address: garden.location_address
    },
    range: normalizedRange,
    window: {
      start_date: startDateStr,
      end_date: endDateStr,
      days
    },
    kpis: {
      total_water_liters: round(totalWater, 2),
      watering_events: waterLogs.length,
      total_tasks: tasksAll.length,
      completed_tasks: completedTasks,
      task_completion_rate_pct: tasksAll.length > 0 ? round((completedTasks / tasksAll.length) * 100, 1) : 0,
      avg_soil_moisture: overallMoistCount > 0 ? round(overallMoistSum / overallMoistCount, 1) : null,
      avg_temperature: overallTempCount > 0 ? round(overallTempSum / overallTempCount, 1) : null,
      avg_humidity: overallHumCount > 0 ? round(overallHumSum / overallHumCount, 1) : null,
      unread_alerts: unreadAlerts,
      journal_entries_count: journalEntries.length
    },
    water_by_day: Array.from(waterByDayMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    water_by_method: Array.from(waterByMethodMap.values()).sort((a, b) => b.liters - a.liters),
    daily_telemetry,
    zone_summary
  };
}

async function exportAnalyticsCsv(gardenId, options = {}) {
  const analytics = await getGardenAnalytics(gardenId, options);
  const waterByDay = new Map(analytics.water_by_day.map((w) => [w.date, w]));
  const teleByDay = new Map(analytics.daily_telemetry.map((t) => [t.date, t]));
  const allDates = [...new Set([...waterByDay.keys(), ...teleByDay.keys()])].sort();

  const headers = [
    'Garden',
    'Window',
    'RecordType',
    'DateOrZone',
    'WaterLiters',
    'WateringEvents',
    'AvgSoilMoisturePct',
    'AvgTemperatureC',
    'AvgHumidityPct',
    'PeakLightLux',
    'SamplesOrTasks'
  ];

  const rows = [];
  for (const d of allDates) {
    const w = waterByDay.get(d);
    const t = teleByDay.get(d);
    rows.push([
      analytics.garden.name,
      analytics.range,
      'DAILY',
      d,
      w ? w.liters : 0,
      w ? w.events : 0,
      t && t.avg_soil_moisture !== null ? t.avg_soil_moisture : '',
      t && t.avg_temperature !== null ? t.avg_temperature : '',
      t && t.avg_humidity !== null ? t.avg_humidity : '',
      t && t.peak_light_lux !== null ? t.peak_light_lux : '',
      t ? t.sample_count : 0
    ]);
  }

  for (const z of analytics.zone_summary) {
    rows.push([
      analytics.garden.name,
      analytics.range,
      'ZONE_SUMMARY',
      z.zone_name,
      z.water_liters,
      '',
      z.avg_soil_moisture !== null ? z.avg_soil_moisture : '',
      z.avg_temperature !== null ? z.avg_temperature : '',
      '',
      '',
      `${z.tasks_completed}/${z.tasks_total}`
    ]);
  }

  return toCsv(headers, rows);
}

async function exportAnalyticsPdf(gardenId, options = {}) {
  const analytics = await getGardenAnalytics(gardenId, options);
  return generateAnalyticsPdf({
    garden: analytics.garden,
    rangeLabel: analytics.range,
    generatedAt: new Date().toISOString(),
    kpis: analytics.kpis,
    waterByMethod: analytics.water_by_method,
    dailyTelemetry: analytics.daily_telemetry,
    zoneSummary: analytics.zone_summary
  });
}

module.exports = {
  runDailyTelemetryRollup,
  getGardenAnalytics,
  exportAnalyticsCsv,
  exportAnalyticsPdf
};
