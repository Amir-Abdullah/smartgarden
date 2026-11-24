const crypto = require('crypto');
const { Device, Zone } = require('../models');
const { verifyJwt } = require('../middleware/auth');
const { resolveGardenAndRole } = require('../middleware/rbac');
const { isUniqueConstraintError } = require('../utils/dbHelpers');

const VALID_DEVICE_TYPES = ['SIMULATOR', 'ESP32_WROOM', 'SG_PRO_V1', 'GENERIC_IOT'];
const CLAIM_PIN_RE = /^[A-Za-z0-9]{4,12}$/;

function generateDeviceKeyMaterial() {
  const rawKey = `sg_live_${crypto.randomBytes(24).toString('hex')}`;
  const key_prefix = rawKey.slice(0, 16);
  const key_hash = crypto.createHash('sha256').update(rawKey).digest('hex');
  return { rawKey, key_prefix, key_hash };
}

function computeConnectivityStatus(device, now = new Date()) {
  if (!device.is_active) return 'REVOKED';
  if (!device.last_seen_at) return 'OFFLINE';
  const ageMs = now.getTime() - new Date(device.last_seen_at).getTime();
  if (ageMs <= 2 * 3600000) return 'ONLINE';
  if (ageMs <= 24 * 3600000) return 'STALE';
  return 'OFFLINE';
}

function serializeDevice(device) {
  const raw = device && device.toJSON ? device.toJSON() : { ...device };
  delete raw.key_hash;
  return {
    ...raw,
    is_active: Boolean(raw.is_active),
    connectivity_status: computeConnectivityStatus(raw)
  };
}

async function deviceRoutes(fastify) {
  // POST /api/zones/:zoneId/devices
  fastify.post('/zones/:zoneId/devices', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER'])]
  }, async (request, reply) => {
    const zone = await Zone.findByPk(request.params.zoneId);
    if (!zone) {
      return reply.code(404).send({
        success: false,
        error: { code: 'ZONE_NOT_FOUND', message: `Zone ${request.params.zoneId} not found`, statusCode: 404 }
      });
    }

    const body = request.body || {};
    const device_name = body.device_name || body.name;
    if (!device_name || typeof device_name !== 'string' || !device_name.trim() || device_name.trim().length > 100) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_DEVICE_NAME', message: 'device_name is required (1-100 chars).', statusCode: 400 }
      });
    }

    const device_type = body.device_type || 'SIMULATOR';
    if (!VALID_DEVICE_TYPES.includes(device_type)) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_DEVICE_TYPE', message: `device_type must be one of: ${VALID_DEVICE_TYPES.join(', ')}`, statusCode: 400 }
      });
    }

    const device_uid = body.device_uid && String(body.device_uid).trim()
      ? String(body.device_uid).trim().slice(0, 64)
      : `SG-${device_type === 'SIMULATOR' ? 'SIM' : 'DEV'}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const existingUid = await Device.findOne({ where: { device_uid } });
    if (existingUid) {
      return reply.code(409).send({
        success: false,
        error: { code: 'DEVICE_ALREADY_EXISTS', message: `Device UID '${device_uid}' already exists.`, statusCode: 409 }
      });
    }

    const { rawKey, key_prefix, key_hash } = generateDeviceKeyMaterial();

    try {
      const device = await Device.create({
        zone_id: zone.id,
        device_name: device_name.trim(),
        device_uid,
        key_prefix,
        key_hash,
        device_type,
        firmware_version: body.firmware_version ? String(body.firmware_version).trim().slice(0, 32) : 'v1.0.0',
        is_active: true
      });

      return reply.code(201).send({
        success: true,
        data: {
          device: serializeDevice(device),
          api_key: rawKey
        }
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        return reply.code(409).send({
          success: false,
          error: { code: 'DEVICE_ALREADY_EXISTS', message: 'Device UID already exists.', statusCode: 409 }
        });
      }
      throw err;
    }
  });

  // GET /api/zones/:zoneId/devices
  fastify.get('/zones/:zoneId/devices', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const devices = await Device.findAll({
      where: { zone_id: Number(request.params.zoneId) },
      order: [['id', 'ASC']]
    });

    return reply.send({
      success: true,
      data: {
        devices: devices.map(serializeDevice)
      }
    });
  });

  // DELETE /api/devices/:deviceId (soft revoke)
  fastify.delete('/devices/:deviceId', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER'])]
  }, async (request, reply) => {
    const device = await Device.findByPk(request.params.deviceId);
    if (!device) {
      return reply.code(404).send({
        success: false,
        error: { code: 'DEVICE_NOT_FOUND', message: `Device ${request.params.deviceId} not found`, statusCode: 404 }
      });
    }

    device.is_active = false;
    await device.save();

    return reply.send({
      success: true,
      data: {
        message: 'Device revoked.',
        device: serializeDevice(device)
      }
    });
  });

  // POST /api/devices/:deviceId/rotate-key
  fastify.post('/devices/:deviceId/rotate-key', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER'])]
  }, async (request, reply) => {
    const device = await Device.findByPk(request.params.deviceId);
    if (!device) {
      return reply.code(404).send({
        success: false,
        error: { code: 'DEVICE_NOT_FOUND', message: `Device ${request.params.deviceId} not found`, statusCode: 404 }
      });
    }

    const { rawKey, key_prefix, key_hash } = generateDeviceKeyMaterial();
    device.key_prefix = key_prefix;
    device.key_hash = key_hash;
    device.is_active = true;
    await device.save();

    return reply.send({
      success: true,
      data: {
        device: serializeDevice(device),
        api_key: rawKey
      }
    });
  });

  // POST /api/devices/claim
  fastify.post('/devices/claim', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER'])]
  }, async (request, reply) => {
    const body = request.body || {};
    const { deviceUid, pin, zoneId, name } = body;

    if (!deviceUid || !pin || !zoneId) {
      return reply.code(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'deviceUid, pin, and zoneId are required.', statusCode: 400 }
      });
    }

    if (typeof deviceUid !== 'string' || !deviceUid.trim()) {
      return reply.code(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'deviceUid must be a non-empty string.', statusCode: 400 }
      });
    }

    const parsedZoneId = Number(zoneId);
    if (
      typeof zoneId === 'boolean' ||
      typeof zoneId === 'object' ||
      (typeof zoneId === 'string' && !zoneId.trim()) ||
      !Number.isInteger(parsedZoneId) ||
      parsedZoneId <= 0
    ) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_ZONE_ID', message: 'zoneId must be a positive integer.', statusCode: 400 }
      });
    }

    if (typeof pin !== 'string' || !CLAIM_PIN_RE.test(pin.trim())) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_CLAIM_PIN', message: 'pin must be 4-12 alphanumeric characters.', statusCode: 400 }
      });
    }

    const trimmedUid = deviceUid.trim().slice(0, 64);
    const existing = await Device.findOne({ where: { device_uid: trimmedUid } });
    if (existing) {
      return reply.code(409).send({
        success: false,
        error: { code: 'DEVICE_ALREADY_CLAIMED', message: `Device '${trimmedUid}' has already been claimed.`, statusCode: 409 }
      });
    }

    const deviceType = body.deviceType && VALID_DEVICE_TYPES.includes(body.deviceType)
      ? body.deviceType
      : 'SG_PRO_V1';

    const { rawKey, key_prefix, key_hash } = generateDeviceKeyMaterial();
    try {
      const device = await Device.create({
        zone_id: parsedZoneId,
        device_name: (name && String(name).trim()) ? String(name).trim().slice(0, 100) : trimmedUid,
        device_uid: trimmedUid,
        key_prefix,
        key_hash,
        device_type: deviceType,
        firmware_version: 'v1.0.0',
        is_active: true
      });

      return reply.code(201).send({
        success: true,
        data: {
          device: serializeDevice(device),
          api_key: rawKey
        }
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        return reply.code(409).send({
          success: false,
          error: { code: 'DEVICE_ALREADY_CLAIMED', message: `Device '${trimmedUid}' has already been claimed.`, statusCode: 409 }
        });
      }
      throw err;
    }
  });
}

module.exports = deviceRoutes;
module.exports.computeConnectivityStatus = computeConnectivityStatus;
module.exports.generateDeviceKeyMaterial = generateDeviceKeyMaterial;
