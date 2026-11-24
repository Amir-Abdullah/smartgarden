const { verifyJwt } = require('../middleware/auth');
const { resolveGardenAndRole } = require('../middleware/rbac');
const { verifyDeviceKey } = require('../middleware/verifyDeviceKey');
const ingestService = require('../services/ingestService');

const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 60;
const deviceRateBuckets = new Map();

function checkDeviceRateLimit(deviceId, nowMs = Date.now()) {
  const key = Number(deviceId);
  let timestamps = deviceRateBuckets.get(key) || [];
  const cutoff = nowMs - RATE_WINDOW_MS;
  timestamps = timestamps.filter((ts) => ts > cutoff);
  if (timestamps.length >= RATE_LIMIT_MAX) {
    deviceRateBuckets.set(key, timestamps);
    return false;
  }
  timestamps.push(nowMs);
  deviceRateBuckets.set(key, timestamps);
  return true;
}

function resetRateLimits() {
  deviceRateBuckets.clear();
}

async function sensorRoutes(fastify) {
  // POST /api/sensors/ingest
  fastify.post('/sensors/ingest', {
    preHandler: [verifyDeviceKey]
  }, async (request, reply) => {
    if (!checkDeviceRateLimit(request.device.id)) {
      return reply.code(429).send({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Device ingestion rate limit (60 req/min) exceeded.',
          statusCode: 429
        }
      });
    }

    const result = await ingestService.processTelemetry(
      request.device,
      request.body,
      request.ip,
      { zone: request.deviceZone }
    );

    return reply.code(201).send({
      success: true,
      data: result
    });
  });

  // GET /api/zones/:id/readings
  fastify.get('/zones/:id/readings', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const readings = await ingestService.getZoneReadings(request.params.id, request.query || {});
    return reply.send({
      success: true,
      data: { readings }
    });
  });

  // GET /api/zones/:id/stats/daily
  fastify.get('/zones/:id/stats/daily', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const stats = await ingestService.getZoneDailyStats(request.params.id, request.query || {});
    return reply.send({
      success: true,
      data: { stats }
    });
  });
}

module.exports = sensorRoutes;
module.exports.resetRateLimits = resetRateLimits;
