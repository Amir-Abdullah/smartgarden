const { Device, Zone, DeviceWatchdogAlert } = require('../models');
const eventBus = require('../services/eventBus');
const ruleEngineService = require('../services/ruleEngineService');

const OFFLINE_THRESHOLD_MS = 2 * 60 * 60 * 1000;
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

let scheduledTasks = [];

async function runDeviceWatchdog(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const thresholdMs = options.offlineThresholdMs || OFFLINE_THRESHOLD_MS;

  const activeDevices = await Device.findAll({
    where: { is_active: true }
  });

  let checked = 0;
  let offlineCount = 0;
  let alertsCreated = 0;

  for (const device of activeDevices) {
    checked++;
    const referenceTs = device.last_seen_at
      ? new Date(device.last_seen_at).getTime()
      : (device.created_at ? new Date(device.created_at).getTime() : null);

    if (!referenceTs || Number.isNaN(referenceTs)) continue;

    const ageMs = now.getTime() - referenceTs;
    if (ageMs <= thresholdMs) {
      continue;
    }

    offlineCount++;

    if (device.last_offline_alert_at) {
      const sinceLastAlert = now.getTime() - new Date(device.last_offline_alert_at).getTime();
      if (sinceLastAlert < ALERT_COOLDOWN_MS) {
        continue;
      }
    }

    const zone = await Zone.findByPk(device.zone_id);
    if (!zone) continue;

    const hoursOffline = Math.max(2, Math.floor(ageMs / 3600000));
    const message = `Device "${device.device_name}" (${device.device_uid}) in ${zone.name} has been offline for >${hoursOffline}h.`.slice(0, 255);

    const wdAlert = await DeviceWatchdogAlert.create({
      device_id: device.id,
      zone_id: zone.id,
      garden_id: zone.garden_id,
      alert_type: 'DEVICE_OFFLINE',
      severity: 'WARNING',
      message,
      is_read: false,
      triggered_at: now
    });

    device.last_offline_alert_at = now;
    await device.save();

    eventBus.emitEvent(zone.garden_id, 'ALERT_TRIGGERED', {
      alertId: `wd-${wdAlert.id}`,
      zoneId: zone.id,
      zoneName: zone.name,
      deviceId: device.id,
      metric: 'DEVICE_OFFLINE',
      severity: 'WARNING',
      message,
      timestamp: now.toISOString()
    });

    alertsCreated++;
  }

  return {
    checked,
    offline_count: offlineCount,
    alerts_created: alertsCreated
  };
}

function startScheduler() {
  if (scheduledTasks.length > 0) {
    return scheduledTasks;
  }

  const cron = require('node-cron');

  const ruleTask = cron.schedule('*/15 * * * *', async () => {
    try {
      await ruleEngineService.evaluateAllRules();
    } catch (err) {
      console.error('[Scheduler] Rule engine job error:', err.message);
    }
  });

  const watchdogTask = cron.schedule('*/30 * * * *', async () => {
    try {
      await runDeviceWatchdog();
    } catch (err) {
      console.error('[Scheduler] Device watchdog job error:', err.message);
    }
  });

  scheduledTasks = [ruleTask, watchdogTask];
  console.log('[Scheduler] Started rule evaluation (*/15) and device watchdog (*/30) jobs.');
  return scheduledTasks;
}

function stopScheduler() {
  for (const task of scheduledTasks) {
    try {
      if (task && typeof task.stop === 'function') {
        task.stop();
      }
    } catch (_) {
      // ignore stop errors
    }
  }
  scheduledTasks = [];
}

module.exports = {
  runDeviceWatchdog,
  startScheduler,
  stopScheduler
};
