const crypto = require('crypto');
const ruleEngineService = require('../services/ruleEngineService');
const weatherService = require('../services/weatherService');
const scheduler = require('../jobs/scheduler');

function verifyCronSecret(request, reply, done) {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    reply.code(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Cron execution secret is not configured.', statusCode: 401 }
    });
    return;
  }

  let provided = request.headers['x-cron-secret'];
  if (!provided) {
    const auth = request.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      provided = auth.slice(7).trim();
    }
  }

  if (!provided || typeof provided !== 'string') {
    reply.code(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing cron secret.', statusCode: 401 }
    });
    return;
  }

  const expectedBuf = Buffer.from(String(configuredSecret), 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');
  if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
    reply.code(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid cron secret.', statusCode: 401 }
    });
    return;
  }

  done();
}

async function jobRoutes(fastify) {
  // POST /api/jobs/evaluate-rules
  fastify.post('/jobs/evaluate-rules', {
    preHandler: [verifyCronSecret]
  }, async (_request, reply) => {
    const result = await ruleEngineService.evaluateAllRules();
    return reply.send({
      success: true,
      data: {
        evaluated: result.evaluated,
        triggered: result.triggered,
        skipped: result.skipped
      }
    });
  });

  // POST /api/jobs/device-watchdog
  fastify.post('/jobs/device-watchdog', {
    preHandler: [verifyCronSecret]
  }, async (_request, reply) => {
    const result = await scheduler.runDeviceWatchdog();
    return reply.send({
      success: true,
      data: result
    });
  });

  // POST /api/jobs/weather-watchdog
  fastify.post('/jobs/weather-watchdog', {
    preHandler: [verifyCronSecret]
  }, async (_request, reply) => {
    const result = await weatherService.runSevereWeatherWatchdog();
    return reply.send({
      success: true,
      data: result
    });
  });
}

module.exports = jobRoutes;
