const crypto = require('crypto');
const { Device, Zone } = require('../models');

async function verifyDeviceKey(request, reply) {
  const rawKey = request.headers['x-device-key'];
  if (!rawKey || typeof rawKey !== 'string' || !rawKey.startsWith('sg_live_') || rawKey.length < 24) {
    return reply.code(401).send({
      success: false,
      error: {
        code: 'MISSING_OR_INVALID_DEVICE_KEY',
        message: "Header 'X-Device-Key' is missing or malformed.",
        statusCode: 401
      }
    });
  }

  const keyPrefix = rawKey.slice(0, 16);
  const incomingHashHex = crypto.createHash('sha256').update(rawKey).digest('hex');
  const incomingBuf = Buffer.from(incomingHashHex, 'utf8');

  const candidates = await Device.findAll({
    where: { key_prefix: keyPrefix, is_active: true }
  });

  let matchedDevice = null;
  for (const candidate of candidates) {
    const storedHash = candidate.key_hash ? String(candidate.key_hash) : '';
    const storedBuf = Buffer.from(storedHash, 'utf8');
    if (storedBuf.length === incomingBuf.length && crypto.timingSafeEqual(storedBuf, incomingBuf)) {
      matchedDevice = candidate;
      break;
    }
  }

  if (!matchedDevice) {
    return reply.code(401).send({
      success: false,
      error: {
        code: 'INVALID_DEVICE_KEY',
        message: 'Device API key is invalid or revoked.',
        statusCode: 401
      }
    });
  }

  const zone = await Zone.findByPk(matchedDevice.zone_id);
  if (!zone) {
    return reply.code(401).send({
      success: false,
      error: {
        code: 'INVALID_DEVICE_KEY',
        message: 'Device zone binding is no longer valid.',
        statusCode: 401
      }
    });
  }

  request.device = matchedDevice;
  request.deviceZone = zone;
}

module.exports = {
  verifyDeviceKey
};
