const crypto = require('crypto');
const { Device } = require('../models');
const ingestService = require('./ingestService');

/**
 * Parses SmartGarden MQTT topic payloads of form:
 *   smartgarden/<deviceUid>/telemetry
 * Validates the embedded or header X-Device-Key via timing-safe SHA-256 hash comparison
 * and delegates to ingestService.processTelemetry().
 */
async function handleMqttMessage(topic, rawPayload) {
  const match = String(topic || '').trim().match(/^smartgarden\/([^/]+)\/telemetry$/);
  if (!match) {
    const err = new Error(`Unsupported MQTT topic: ${topic}`);
    err.statusCode = 400;
    err.code = 'INVALID_MQTT_TOPIC';
    throw err;
  }

  const deviceUid = match[1];
  let payload;
  try {
    payload = Buffer.isBuffer(rawPayload)
      ? JSON.parse(rawPayload.toString('utf8'))
      : (typeof rawPayload === 'string' ? JSON.parse(rawPayload) : { ...rawPayload });
  } catch {
    const err = new Error('Malformed JSON payload in MQTT telemetry message.');
    err.statusCode = 400;
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const deviceKey = payload?.device_key || payload?.api_key;
  if (!deviceKey || typeof deviceKey !== 'string') {
    const err = new Error('Missing device_key in MQTT payload.');
    err.statusCode = 401;
    err.code = 'INVALID_DEVICE_KEY';
    throw err;
  }

  const device = await Device.findOne({ where: { device_uid: deviceUid, is_active: true } });
  if (!device) {
    const err = new Error(`Active device "${deviceUid}" not found.`);
    err.statusCode = 401;
    err.code = 'INVALID_DEVICE_KEY';
    throw err;
  }

  const hash = crypto.createHash('sha256').update(deviceKey).digest('hex');
  const expected = Buffer.from(String(device.key_hash || ''), 'utf8');
  const provided = Buffer.from(hash, 'utf8');
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    const err = new Error('Invalid MQTT device key.');
    err.statusCode = 401;
    err.code = 'INVALID_DEVICE_KEY';
    throw err;
  }

  return ingestService.processTelemetry(device, payload);
}

module.exports = {
  handleMqttMessage
};
