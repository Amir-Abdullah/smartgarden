const { Device, Zone, SensorReading, SensorAggregateDaily } = require('../models');
const eventBus = require('./eventBus');
const alertService = require('./alertService');

const MAX_CLOCK_SKEW_MS = 15 * 60 * 1000;
const MIN_VALID_EPOCH_MS = Date.UTC(2000, 0, 1);

const PHYSICAL_BOUNDS = {
  soilMoisture: { min: 0, max: 100, required: true },
  temperature: { min: -40, max: 85, required: true },
  humidity: { min: 0, max: 100, required: true },
  lightLux: { min: 0, max: 120000, required: true },
  batteryPercent: { min: 0, max: 100, required: false },
  signalRssi: { min: -120, max: 0, required: false }
};

function createHttpError(statusCode, code, message, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

function normalizeTelemetryPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createHttpError(400, 'INVALID_TELEMETRY_PAYLOAD', 'Telemetry payload must be a JSON object.');
  }

  const src = (body.metrics && typeof body.metrics === 'object' && !Array.isArray(body.metrics))
    ? body.metrics
    : body;

  const normalized = {
    soilMoisture: src.soilMoisture !== undefined ? src.soilMoisture : src.soil_moisture,
    temperature: src.temperature,
    humidity: src.humidity,
    lightLux: src.lightLux !== undefined ? src.lightLux : src.light_lux,
    batteryPercent: src.batteryPercent !== undefined ? src.batteryPercent : src.battery_percent,
    signalRssi: src.signalRssi !== undefined ? src.signalRssi : src.signal_rssi
  };

  const validated = {};
  for (const [field, spec] of Object.entries(PHYSICAL_BOUNDS)) {
    const raw = normalized[field];
    if (raw === undefined || raw === null || raw === '') {
      if (spec.required) {
        throw createHttpError(
          400,
          'INVALID_TELEMETRY_PAYLOAD',
          `Missing required telemetry metric '${field}'.`,
          { field }
        );
      }
      validated[field] = null;
      continue;
    }

    if (typeof raw !== 'number' && (typeof raw !== 'string' || raw.trim() === '')) {
      throw createHttpError(
        400,
        'INVALID_TELEMETRY_PAYLOAD',
        `Telemetry metric '${field}' must be a finite number.`,
        { field, value: raw }
      );
    }

    const num = Number(raw);
    if (!Number.isFinite(num)) {
      throw createHttpError(
        400,
        'INVALID_TELEMETRY_PAYLOAD',
        `Telemetry metric '${field}' must be a finite number.`,
        { field, value: raw }
      );
    }

    if (num < spec.min || num > spec.max) {
      throw createHttpError(
        400,
        'METRIC_OUT_OF_RANGE',
        `Telemetry metric '${field}' (${num}) is outside physical bounds [${spec.min}, ${spec.max}].`,
        { field, value: num, min: spec.min, max: spec.max }
      );
    }

    validated[field] = field === 'signalRssi' ? Math.round(num) : num;
  }

  return {
    metrics: validated,
    timestamp: body.timestamp !== undefined ? body.timestamp : src.timestamp,
    firmwareVersion: body.firmwareVersion || body.firmware_version || null,
    deviceUid: body.deviceUid || body.device_uid || null
  };
}

function sanitizeTimestamp(rawTs, now = new Date()) {
  if (rawTs === undefined || rawTs === null || rawTs === '') {
    return { recordedAt: now, clockSkewCorrected: false };
  }

  let ms = NaN;
  if (typeof rawTs === 'number' || (typeof rawTs === 'string' && /^\d+(\.\d+)?$/.test(rawTs.trim()))) {
    let num = Number(rawTs);
    if (num < 1e12) {
      num = num * 1000;
    }
    ms = num;
  } else {
    ms = Date.parse(String(rawTs));
  }

  const nowMs = now.getTime();
  if (!Number.isFinite(ms) || ms < MIN_VALID_EPOCH_MS || Math.abs(nowMs - ms) > MAX_CLOCK_SKEW_MS) {
    return { recordedAt: now, clockSkewCorrected: true };
  }

  return { recordedAt: new Date(ms), clockSkewCorrected: false };
}

async function processTelemetry(device, rawBody, ipAddress = null, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const parsed = normalizeTelemetryPayload(rawBody);

  if (parsed.deviceUid && device.device_uid && parsed.deviceUid !== device.device_uid) {
    throw createHttpError(
      400,
      'DEVICE_UID_MISMATCH',
      `Payload deviceUid '${parsed.deviceUid}' does not match authenticated device '${device.device_uid}'.`
    );
  }

  const { recordedAt, clockSkewCorrected } = sanitizeTimestamp(parsed.timestamp, now);
  const { metrics, firmwareVersion } = parsed;

  const reading = await SensorReading.create({
    zone_id: device.zone_id,
    device_id: device.id,
    soil_moisture: metrics.soilMoisture,
    temperature: metrics.temperature,
    humidity: metrics.humidity,
    light_lux: metrics.lightLux,
    battery_percent: metrics.batteryPercent,
    signal_rssi: metrics.signalRssi,
    recorded_at: recordedAt
  });

  device.last_seen_at = now;
  device.last_offline_alert_at = null;
  if (ipAddress) {
    device.ip_address = String(ipAddress).slice(0, 45);
  }
  if (firmwareVersion) {
    device.firmware_version = String(firmwareVersion).slice(0, 32);
  }
  await device.save();

  const zone = options.zone || await Zone.findByPk(device.zone_id);
  if (zone) {
    eventBus.emitEvent(zone.garden_id, 'SENSOR_UPDATE', {
      zoneId: zone.id,
      deviceId: device.id,
      soilMoisture: reading.soil_moisture,
      temperature: reading.temperature,
      humidity: reading.humidity,
      lightLux: reading.light_lux,
      batteryPercent: reading.battery_percent,
      signalRssi: reading.signal_rssi,
      timestamp: recordedAt.toISOString()
    });

    try {
      await alertService.evaluateReading(zone, reading, { now });
    } catch (err) {
      console.error('[IngestService] Alert evaluation error:', err.message);
    }
  }

  return {
    reading_id: reading.id,
    zone_id: device.zone_id,
    recorded_at: recordedAt.toISOString(),
    status: 'PROCESSED',
    clock_skew_corrected: clockSkewCorrected
  };
}

function serializeReading(r) {
  const raw = r && r.toJSON ? r.toJSON() : { ...r };
  return {
    ...raw,
    soil_moisture: Number(raw.soil_moisture),
    temperature: Number(raw.temperature),
    humidity: Number(raw.humidity),
    light_lux: Number(raw.light_lux),
    battery_percent: raw.battery_percent !== null && raw.battery_percent !== undefined ? Number(raw.battery_percent) : null,
    signal_rssi: raw.signal_rssi !== null && raw.signal_rssi !== undefined ? Number(raw.signal_rssi) : null
  };
}

async function getZoneReadings(zoneId, query = {}) {
  const zone = await Zone.findByPk(zoneId);
  if (!zone) {
    throw createHttpError(404, 'ZONE_NOT_FOUND', `Zone ${zoneId} not found`);
  }

  const hours = query.hours !== undefined ? Number(query.hours) : 24;
  if (!Number.isFinite(hours) || hours < 1 || hours > 168) {
    throw createHttpError(400, 'INVALID_QUERY_PARAM', 'hours must be between 1 and 168.');
  }

  const limit = query.limit !== undefined ? Number(query.limit) : 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw createHttpError(400, 'INVALID_QUERY_PARAM', 'limit must be an integer between 1 and 1000.');
  }

  const cutoffMs = Date.now() - hours * 3600000;
  const rows = await SensorReading.findAll({
    where: { zone_id: zone.id },
    order: [['recorded_at', 'DESC'], ['id', 'DESC']]
  });

  const filtered = rows
    .filter((r) => new Date(r.recorded_at).getTime() >= cutoffMs)
    .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime() || b.id - a.id)
    .slice(0, limit);

  return filtered.map(serializeReading);
}

async function getZoneDailyStats(zoneId, query = {}) {
  const zone = await Zone.findByPk(zoneId);
  if (!zone) {
    throw createHttpError(404, 'ZONE_NOT_FOUND', `Zone ${zoneId} not found`);
  }

  const days = query.days !== undefined ? Number(query.days) : 30;
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw createHttpError(400, 'INVALID_QUERY_PARAM', 'days must be an integer between 1 and 365.');
  }

  const cutoffDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const rows = await SensorAggregateDaily.findAll({
    where: { zone_id: zone.id },
    order: [['aggregate_date', 'DESC'], ['id', 'DESC']]
  });

  const stats = rows
    .filter((r) => String(r.aggregate_date).slice(0, 10) >= cutoffDate)
    .map((r) => (r.toJSON ? r.toJSON() : { ...r }));

  return stats;
}

module.exports = {
  PHYSICAL_BOUNDS,
  MAX_CLOCK_SKEW_MS,
  normalizeTelemetryPayload,
  sanitizeTimestamp,
  processTelemetry,
  getZoneReadings,
  getZoneDailyStats
};
