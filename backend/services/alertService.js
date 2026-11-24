const {
  Sequelize,
  Garden,
  GardenMember,
  Zone,
  ZonePlant,
  PlantCatalog,
  AlertConfig,
  AlertLog,
  DeviceWatchdogAlert,
  User
} = require('../models');
const { Op } = Sequelize;
const eventBus = require('./eventBus');
const emailService = require('./emailService');
const { getLocalTimeString } = require('../utils/dbHelpers');

const VALID_METRICS = ['SOIL_MOISTURE', 'TEMPERATURE', 'HUMIDITY', 'LIGHT_LUX'];
const VALID_SEVERITIES = ['INFO', 'WARNING', 'CRITICAL'];
const METRIC_TO_COLUMN = {
  SOIL_MOISTURE: 'soil_moisture',
  TEMPERATURE: 'temperature',
  HUMIDITY: 'humidity',
  LIGHT_LUX: 'light_lux'
};
const METRIC_UNIT = {
  SOIL_MOISTURE: '%',
  TEMPERATURE: '°C',
  HUMIDITY: '%',
  LIGHT_LUX: 'lux'
};
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

function createHttpError(statusCode, code, message, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

function normalizeTimeStr(val) {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).trim();
  if (!TIME_RE.test(s)) return null;
  return s.length === 5 ? `${s}:00` : s;
}

function isWithinQuietHours(timeZone = 'UTC', startStr, endStr, now = new Date()) {
  const start = normalizeTimeStr(startStr);
  const end = normalizeTimeStr(endStr);
  if (!start || !end || start === end) return false;

  const cur = getLocalTimeString(timeZone || 'UTC', now);
  if (start < end) {
    return cur >= start && cur < end;
  }
  // Crosses midnight (e.g. 22:00:00 -> 07:00:00)
  return cur >= start || cur < end;
}

function serializeAlertConfig(cfg) {
  const raw = cfg && cfg.toJSON ? cfg.toJSON() : { ...cfg };
  return {
    ...raw,
    min_threshold: raw.min_threshold !== null && raw.min_threshold !== undefined ? Number(raw.min_threshold) : null,
    max_threshold: raw.max_threshold !== null && raw.max_threshold !== undefined ? Number(raw.max_threshold) : null,
    is_email_enabled: Boolean(raw.is_email_enabled),
    is_in_app_enabled: Boolean(raw.is_in_app_enabled),
    is_active: Boolean(raw.is_active),
    cooldown_minutes: Number(raw.cooldown_minutes || 60)
  };
}

function serializeAlertLog(log, extra = {}) {
  const raw = log && log.toJSON ? log.toJSON() : { ...log };
  return {
    ...raw,
    triggered_value: raw.triggered_value !== undefined ? Number(raw.triggered_value) : null,
    threshold_value: raw.threshold_value !== undefined ? Number(raw.threshold_value) : null,
    is_read: Boolean(raw.is_read),
    email_sent: Boolean(raw.email_sent),
    is_suppressed: Boolean(raw.is_suppressed),
    alert_source: extra.alert_source || 'THRESHOLD',
    ...extra
  };
}

function serializeWatchdogAlert(wd, zoneName = null) {
  const raw = wd && wd.toJSON ? wd.toJSON() : { ...wd };
  return {
    id: `wd-${raw.id}`,
    raw_id: Number(raw.id),
    alert_config_id: null,
    zone_id: Number(raw.zone_id),
    zone_name: zoneName,
    device_id: Number(raw.device_id),
    garden_id: Number(raw.garden_id),
    metric: raw.alert_type || 'DEVICE_OFFLINE',
    alert_type: raw.alert_type || 'DEVICE_OFFLINE',
    triggered_value: null,
    threshold_value: null,
    severity: raw.severity || 'WARNING',
    message: raw.message,
    is_read: Boolean(raw.is_read),
    email_sent: false,
    is_suppressed: false,
    triggered_at: raw.triggered_at,
    resolved_at: raw.resolved_at || null,
    alert_source: 'WATCHDOG'
  };
}

async function getCatalogDefaults(zoneId) {
  const plants = await ZonePlant.findAll({
    where: { zone_id: Number(zoneId) },
    include: [{ model: PlantCatalog, as: 'catalogPlant' }]
  });

  const active = plants.filter((zp) => zp.status !== 'HARVESTED' && zp.status !== 'DEAD' && zp.catalogPlant);
  if (active.length === 0) {
    return { SOIL_MOISTURE: null, TEMPERATURE: null };
  }

  const mMins = active.map((zp) => Number(zp.catalogPlant.ideal_moisture_min)).filter(Number.isFinite);
  const mMaxs = active.map((zp) => Number(zp.catalogPlant.ideal_moisture_max)).filter(Number.isFinite);
  const tMins = active.map((zp) => Number(zp.catalogPlant.ideal_temp_min)).filter(Number.isFinite);
  const tMaxs = active.map((zp) => Number(zp.catalogPlant.ideal_temp_max)).filter(Number.isFinite);

  function collapseRange(mins, maxs) {
    if (mins.length === 0 && maxs.length === 0) return null;
    let minVal = mins.length > 0 ? Math.max(...mins) : null;
    let maxVal = maxs.length > 0 ? Math.min(...maxs) : null;
    if (minVal !== null && maxVal !== null && minVal > maxVal) {
      minVal = Math.min(...mins);
      maxVal = Math.max(...maxs);
    }
    return { min_threshold: minVal, max_threshold: maxVal };
  }

  return {
    SOIL_MOISTURE: collapseRange(mMins, mMaxs),
    TEMPERATURE: collapseRange(tMins, tMaxs)
  };
}

async function getAlertConfigWithDefaults(zoneId) {
  const zone = await Zone.findByPk(zoneId);
  if (!zone) {
    throw createHttpError(404, 'ZONE_NOT_FOUND', `Zone ${zoneId} not found`);
  }

  const rows = await AlertConfig.findAll({
    where: { zone_id: zone.id },
    order: [['id', 'ASC']]
  });

  const catalog_defaults = await getCatalogDefaults(zone.id);
  return {
    configs: rows.map(serializeAlertConfig),
    catalog_defaults
  };
}

async function upsertAlertConfig(zoneId, payload = {}) {
  const zone = await Zone.findByPk(zoneId);
  if (!zone) {
    throw createHttpError(404, 'ZONE_NOT_FOUND', `Zone ${zoneId} not found`);
  }

  const { metric } = payload;
  if (!metric || !VALID_METRICS.includes(metric)) {
    throw createHttpError(400, 'INVALID_METRIC', `metric must be one of: ${VALID_METRICS.join(', ')}`);
  }

  let min_threshold = null;
  if (payload.min_threshold !== undefined && payload.min_threshold !== null && payload.min_threshold !== '') {
    min_threshold = Number(payload.min_threshold);
    if (!Number.isFinite(min_threshold)) {
      throw createHttpError(400, 'INVALID_THRESHOLDS', 'min_threshold must be a finite number.');
    }
  }

  let max_threshold = null;
  if (payload.max_threshold !== undefined && payload.max_threshold !== null && payload.max_threshold !== '') {
    max_threshold = Number(payload.max_threshold);
    if (!Number.isFinite(max_threshold)) {
      throw createHttpError(400, 'INVALID_THRESHOLDS', 'max_threshold must be a finite number.');
    }
  }

  let quiet_hours_start = null;
  if (payload.quiet_hours_start !== undefined && payload.quiet_hours_start !== null && payload.quiet_hours_start !== '') {
    quiet_hours_start = normalizeTimeStr(payload.quiet_hours_start);
    if (!quiet_hours_start) {
      throw createHttpError(400, 'INVALID_QUIET_HOURS', 'quiet_hours_start must be HH:mm or HH:mm:ss.');
    }
  }

  let quiet_hours_end = null;
  if (payload.quiet_hours_end !== undefined && payload.quiet_hours_end !== null && payload.quiet_hours_end !== '') {
    quiet_hours_end = normalizeTimeStr(payload.quiet_hours_end);
    if (!quiet_hours_end) {
      throw createHttpError(400, 'INVALID_QUIET_HOURS', 'quiet_hours_end must be HH:mm or HH:mm:ss.');
    }
  }

  let cooldown_minutes = 60;
  if (payload.cooldown_minutes !== undefined && payload.cooldown_minutes !== null && payload.cooldown_minutes !== '') {
    cooldown_minutes = Number(payload.cooldown_minutes);
    if (!Number.isInteger(cooldown_minutes) || cooldown_minutes < 1) {
      throw createHttpError(400, 'INVALID_COOLDOWN', 'cooldown_minutes must be an integer >= 1.');
    }
  }

  let existing = await AlertConfig.findOne({
    where: { zone_id: zone.id, metric }
  });

  const effectiveMin = payload.min_threshold !== undefined
    ? min_threshold
    : (existing && existing.min_threshold !== null && existing.min_threshold !== undefined
      ? Number(existing.min_threshold)
      : null);
  const effectiveMax = payload.max_threshold !== undefined
    ? max_threshold
    : (existing && existing.max_threshold !== null && existing.max_threshold !== undefined
      ? Number(existing.max_threshold)
      : null);

  if (effectiveMin !== null && effectiveMax !== null && effectiveMin >= effectiveMax) {
    throw createHttpError(400, 'INVALID_THRESHOLDS', 'min_threshold must be strictly less than max_threshold.');
  }

  if (existing) {
    if (payload.min_threshold !== undefined) existing.min_threshold = min_threshold;
    if (payload.max_threshold !== undefined) existing.max_threshold = max_threshold;
    if (payload.is_email_enabled !== undefined) existing.is_email_enabled = Boolean(payload.is_email_enabled);
    if (payload.is_in_app_enabled !== undefined) existing.is_in_app_enabled = Boolean(payload.is_in_app_enabled);
    if (payload.quiet_hours_start !== undefined) existing.quiet_hours_start = quiet_hours_start;
    if (payload.quiet_hours_end !== undefined) existing.quiet_hours_end = quiet_hours_end;
    if (payload.cooldown_minutes !== undefined) existing.cooldown_minutes = cooldown_minutes;
    if (payload.is_active !== undefined) existing.is_active = Boolean(payload.is_active);
    await existing.save();
  } else {
    existing = await AlertConfig.create({
      zone_id: zone.id,
      metric,
      min_threshold,
      max_threshold,
      is_email_enabled: payload.is_email_enabled !== undefined ? Boolean(payload.is_email_enabled) : true,
      is_in_app_enabled: payload.is_in_app_enabled !== undefined ? Boolean(payload.is_in_app_enabled) : true,
      quiet_hours_start,
      quiet_hours_end,
      cooldown_minutes,
      is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : true
    });
  }

  return serializeAlertConfig(existing);
}

function computeSeverity(metric, value, threshold) {
  if (metric === 'SOIL_MOISTURE' && (value < 10 || value > 95)) return 'CRITICAL';
  if (metric === 'TEMPERATURE' && (value < 2 || value > 40)) return 'CRITICAL';
  const diff = Math.abs(value - threshold);
  if (diff >= Math.max(10, Math.abs(threshold) * 0.25)) return 'CRITICAL';
  return 'WARNING';
}

async function getGardenNotificationEmails(garden) {
  if (!garden) return [];
  const members = await GardenMember.findAll({
    where: { garden_id: garden.id }
  });
  const ownerAndFamilyIds = members
    .filter((m) => m.role === 'OWNER' || m.role === 'FAMILY')
    .map((m) => Number(m.user_id));

  if (!ownerAndFamilyIds.includes(Number(garden.owner_id)) && garden.owner_id) {
    ownerAndFamilyIds.push(Number(garden.owner_id));
  }
  const uniqueIds = [...new Set(ownerAndFamilyIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const users = uniqueIds.length === 1
    ? await User.findAll({ where: { id: uniqueIds[0] } })
    : await User.findAll({ where: { id: { [Op.in]: uniqueIds } } });

  return users.map((u) => u.email).filter(Boolean);
}

async function evaluateReading(zone, reading, options = {}) {
  if (!zone || !reading) return [];
  const now = options.now instanceof Date ? options.now : new Date();
  const garden = options.garden || await Garden.findByPk(zone.garden_id);
  const timeZone = (garden && garden.timezone) ? garden.timezone : 'UTC';

  const configs = await AlertConfig.findAll({ where: { zone_id: zone.id } });
  const configMap = new Map(configs.map((c) => [c.metric, c]));
  const catalogDefaults = await getCatalogDefaults(zone.id);

  const triggeredAlerts = [];

  for (const metric of VALID_METRICS) {
    const col = METRIC_TO_COLUMN[metric];
    const rawVal = reading[col];
    if (rawVal === null || rawVal === undefined) continue;
    const value = Number(rawVal);
    if (!Number.isFinite(value)) continue;

    const cfg = configMap.get(metric);
    let minThreshold = null;
    let maxThreshold = null;
    let cooldownMinutes = 60;
    let isEmailEnabled = true;
    let isInAppEnabled = true;
    let quietStart = null;
    let quietEnd = null;
    let alertConfigId = null;

    if (cfg) {
      if (!cfg.is_active) continue;
      alertConfigId = cfg.id;
      minThreshold = cfg.min_threshold !== null && cfg.min_threshold !== undefined ? Number(cfg.min_threshold) : null;
      maxThreshold = cfg.max_threshold !== null && cfg.max_threshold !== undefined ? Number(cfg.max_threshold) : null;
      cooldownMinutes = Number(cfg.cooldown_minutes || 60);
      isEmailEnabled = Boolean(cfg.is_email_enabled);
      isInAppEnabled = Boolean(cfg.is_in_app_enabled);
      quietStart = cfg.quiet_hours_start;
      quietEnd = cfg.quiet_hours_end;
    } else if (catalogDefaults[metric]) {
      minThreshold = catalogDefaults[metric].min_threshold;
      maxThreshold = catalogDefaults[metric].max_threshold;
    } else {
      continue;
    }

    let breached = false;
    let thresholdValue = null;
    let direction = null;
    if (minThreshold !== null && value < minThreshold) {
      breached = true;
      thresholdValue = minThreshold;
      direction = 'below';
    } else if (maxThreshold !== null && value > maxThreshold) {
      breached = true;
      thresholdValue = maxThreshold;
      direction = 'above';
    }

    if (!breached) continue;

    // Cooldown check
    const recentLogs = await AlertLog.findAll({
      where: { zone_id: zone.id, metric },
      order: [['triggered_at', 'DESC'], ['id', 'DESC']],
      limit: 1
    });
    if (recentLogs.length > 0) {
      const lastTs = new Date(recentLogs[0].triggered_at).getTime();
      if (now.getTime() - lastTs < cooldownMinutes * 60000) {
        continue;
      }
    }

    const severity = computeSeverity(metric, value, thresholdValue);
    const unit = METRIC_UNIT[metric] || '';
    const opWord = direction === 'below' ? '<' : '>';
    const message = `${severity === 'CRITICAL' ? 'Critical ' : ''}${metric.toLowerCase().replace('_', ' ')} ${direction} threshold in ${zone.name} (${value}${unit} ${opWord} ${thresholdValue}${unit}).`.slice(0, 255);

    const isSuppressed = isWithinQuietHours(timeZone, quietStart, quietEnd, now);

    const alertLog = await AlertLog.create({
      alert_config_id: alertConfigId,
      zone_id: zone.id,
      metric,
      triggered_value: value,
      threshold_value: thresholdValue,
      severity,
      message,
      is_read: false,
      email_sent: false,
      is_suppressed: isSuppressed,
      triggered_at: now
    });

    if (!isSuppressed) {
      if (isInAppEnabled) {
        eventBus.emitEvent(zone.garden_id, 'ALERT_TRIGGERED', {
          alertId: alertLog.id,
          zoneId: zone.id,
          zoneName: zone.name,
          metric,
          triggeredValue: value,
          thresholdValue,
          severity,
          message,
          timestamp: now.toISOString()
        });
      }

      if (isEmailEnabled) {
        const recipients = await getGardenNotificationEmails(garden);
        if (recipients.length > 0) {
          const emailRes = await emailService.sendAlertEmail({
            to: recipients,
            subject: `[SmartGarden ${severity}] ${zone.name}: ${metric} alert`,
            text: message,
            html: `<p><strong>${severity}</strong>: ${message}</p>`
          });
          if (emailRes.delivered) {
            alertLog.email_sent = true;
            await alertLog.save();
          }
        }
      }
    }

    triggeredAlerts.push(serializeAlertLog(alertLog, { zone_name: zone.name }));
  }

  return triggeredAlerts;
}

async function triggerRuleAlert({ zone, garden, rule, value, now = new Date() }) {
  const timeZone = (garden && garden.timezone) ? garden.timezone : 'UTC';
  const cfg = await AlertConfig.findOne({ where: { zone_id: zone.id, metric: rule.metric } });
  const isSuppressed = cfg
    ? isWithinQuietHours(timeZone, cfg.quiet_hours_start, cfg.quiet_hours_end, now)
    : false;
  const severity = computeSeverity(rule.metric, value, Number(rule.threshold_value));
  const unit = METRIC_UNIT[rule.metric] || '';
  const message = `Automation rule "${rule.name}" triggered in ${zone.name}: ${rule.metric} = ${value}${unit} (threshold ${rule.threshold_value}${unit}).`.slice(0, 255);

  const alertLog = await AlertLog.create({
    alert_config_id: cfg ? cfg.id : null,
    zone_id: zone.id,
    metric: rule.metric,
    triggered_value: value,
    threshold_value: Number(rule.threshold_value),
    severity,
    message,
    is_read: false,
    email_sent: false,
    is_suppressed: isSuppressed,
    triggered_at: now
  });

  if (!isSuppressed) {
    eventBus.emitEvent(zone.garden_id, 'ALERT_TRIGGERED', {
      alertId: alertLog.id,
      zoneId: zone.id,
      zoneName: zone.name,
      metric: rule.metric,
      triggeredValue: value,
      thresholdValue: Number(rule.threshold_value),
      severity,
      message,
      timestamp: now.toISOString()
    });

    if (!cfg || cfg.is_email_enabled) {
      const recipients = await getGardenNotificationEmails(garden);
      if (recipients.length > 0) {
        const emailRes = await emailService.sendAlertEmail({
          to: recipients,
          subject: `[SmartGarden Rule Alert] ${zone.name}: ${rule.name}`,
          text: message,
          html: `<p>${message}</p>`
        });
        if (emailRes.delivered) {
          alertLog.email_sent = true;
          await alertLog.save();
        }
      }
    }
  }

  return serializeAlertLog(alertLog, { zone_name: zone.name });
}

async function listZoneAlertLogs(zoneId, query = {}) {
  const where = { zone_id: Number(zoneId) };

  if (query.is_read !== undefined && query.is_read !== '') {
    if (query.is_read === true || query.is_read === 'true' || query.is_read === '1') {
      where.is_read = true;
    } else if (query.is_read === false || query.is_read === 'false' || query.is_read === '0') {
      where.is_read = false;
    } else {
      throw createHttpError(400, 'INVALID_QUERY_PARAM', 'is_read must be true or false.');
    }
  }

  if (query.severity) {
    if (!VALID_SEVERITIES.includes(query.severity)) {
      throw createHttpError(400, 'INVALID_QUERY_PARAM', `severity must be one of: ${VALID_SEVERITIES.join(', ')}`);
    }
    where.severity = query.severity;
  }

  const limit = query.limit !== undefined ? Number(query.limit) : 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw createHttpError(400, 'INVALID_QUERY_PARAM', 'limit must be an integer between 1 and 500.');
  }

  const logs = await AlertLog.findAll({
    where,
    order: [['triggered_at', 'DESC'], ['id', 'DESC']],
    limit
  });

  return logs.map((l) => serializeAlertLog(l));
}

async function listGardenAlerts(gardenId, query = {}) {
  const zones = await Zone.findAll({ where: { garden_id: Number(gardenId) } });
  const zoneMap = new Map(zones.map((z) => [Number(z.id), z]));
  const zoneIds = zones.map((z) => Number(z.id));

  let isReadFilter;
  if (query.is_read !== undefined && query.is_read !== '') {
    if (query.is_read === true || query.is_read === 'true' || query.is_read === '1') {
      isReadFilter = true;
    } else if (query.is_read === false || query.is_read === 'false' || query.is_read === '0') {
      isReadFilter = false;
    } else {
      throw createHttpError(400, 'INVALID_QUERY_PARAM', 'is_read must be true or false.');
    }
  }

  if (query.severity && !VALID_SEVERITIES.includes(query.severity)) {
    throw createHttpError(400, 'INVALID_QUERY_PARAM', `severity must be one of: ${VALID_SEVERITIES.join(', ')}`);
  }

  const limit = query.limit !== undefined ? Number(query.limit) : 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw createHttpError(400, 'INVALID_QUERY_PARAM', 'limit must be an integer between 1 and 500.');
  }

  let thresholdLogs = [];
  if (zoneIds.length > 0) {
    const where = zoneIds.length === 1
      ? { zone_id: zoneIds[0] }
      : { zone_id: { [Op.in]: zoneIds } };
    thresholdLogs = await AlertLog.findAll({
      where,
      order: [['triggered_at', 'DESC'], ['id', 'DESC']]
    });
  }

  const watchdogRows = await DeviceWatchdogAlert.findAll({
    where: { garden_id: Number(gardenId) },
    order: [['triggered_at', 'DESC'], ['id', 'DESC']]
  });

  const serializedThreshold = thresholdLogs.map((l) => {
    const z = zoneMap.get(Number(l.zone_id));
    return serializeAlertLog(l, { zone_name: z ? z.name : null });
  });
  const serializedWatchdog = watchdogRows.map((wd) => {
    const z = zoneMap.get(Number(wd.zone_id));
    return serializeWatchdogAlert(wd, z ? z.name : null);
  });

  const allCombined = [...serializedThreshold, ...serializedWatchdog];
  const unread_count = allCombined.filter((a) => !a.is_read).length;

  let filtered = allCombined;
  if (isReadFilter !== undefined) {
    filtered = filtered.filter((a) => a.is_read === isReadFilter);
  }
  if (query.severity) {
    filtered = filtered.filter((a) => a.severity === query.severity);
  }

  filtered.sort((a, b) => new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime());

  return {
    alerts: filtered.slice(0, limit),
    unread_count,
    watchdog_alerts: serializedWatchdog.slice(0, limit)
  };
}

async function markAlertRead(alertId) {
  const rawId = String(alertId);
  if (rawId.startsWith('wd-')) {
    const wdId = Number(rawId.slice(3));
    const wd = await DeviceWatchdogAlert.findByPk(wdId);
    if (!wd) {
      throw createHttpError(404, 'ALERT_NOT_FOUND', `Alert ${alertId} not found`);
    }
    wd.is_read = true;
    await wd.save();
    return serializeWatchdogAlert(wd);
  }

  const alert = await AlertLog.findByPk(Number(alertId));
  if (!alert) {
    throw createHttpError(404, 'ALERT_NOT_FOUND', `Alert ${alertId} not found`);
  }
  alert.is_read = true;
  await alert.save();
  return serializeAlertLog(alert);
}

async function markAllGardenAlertsRead(gardenId) {
  const zones = await Zone.findAll({ where: { garden_id: Number(gardenId) } });
  const zoneIds = zones.map((z) => Number(z.id));
  let updatedCount = 0;

  if (zoneIds.length > 0) {
    const where = zoneIds.length === 1
      ? { zone_id: zoneIds[0], is_read: false }
      : { zone_id: { [Op.in]: zoneIds }, is_read: false };
    const unreadLogs = await AlertLog.findAll({ where });
    for (const log of unreadLogs) {
      log.is_read = true;
      await log.save();
      updatedCount++;
    }
  }

  const unreadWatchdog = await DeviceWatchdogAlert.findAll({
    where: { garden_id: Number(gardenId), is_read: false }
  });
  for (const wd of unreadWatchdog) {
    wd.is_read = true;
    await wd.save();
    updatedCount++;
  }

  return { updated_count: updatedCount };
}

module.exports = {
  VALID_METRICS,
  VALID_SEVERITIES,
  isWithinQuietHours,
  normalizeTimeStr,
  getCatalogDefaults,
  getAlertConfigWithDefaults,
  upsertAlertConfig,
  evaluateReading,
  triggerRuleAlert,
  listZoneAlertLogs,
  listGardenAlerts,
  markAlertRead,
  markAllGardenAlertsRead,
  serializeAlertConfig,
  serializeAlertLog,
  serializeWatchdogAlert
};
