const { verifyJwt } = require('../middleware/auth');
const { resolveGardenAndRole } = require('../middleware/rbac');
const alertService = require('../services/alertService');

async function alertRoutes(fastify) {
  // GET /api/zones/:zoneId/alerts/config
  fastify.get('/zones/:zoneId/alerts/config', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const data = await alertService.getAlertConfigWithDefaults(request.params.zoneId);
    return reply.send({ success: true, data });
  });

  // PUT /api/zones/:zoneId/alerts/config (OWNER only per PROJECT.md)
  fastify.put('/zones/:zoneId/alerts/config', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER'])]
  }, async (request, reply) => {
    const config = await alertService.upsertAlertConfig(request.params.zoneId, request.body || {});
    return reply.send({ success: true, data: { config } });
  });

  // GET /api/zones/:zoneId/alerts/logs
  fastify.get('/zones/:zoneId/alerts/logs', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const alerts = await alertService.listZoneAlertLogs(request.params.zoneId, request.query || {});
    return reply.send({ success: true, data: { alerts } });
  });

  // GET /api/gardens/:gardenId/alerts
  fastify.get('/gardens/:gardenId/alerts', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const data = await alertService.listGardenAlerts(request.params.gardenId, request.query || {});
    return reply.send({ success: true, data });
  });

  // PATCH /api/alerts/:alertId/read
  fastify.patch('/alerts/:alertId/read', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const alert = await alertService.markAlertRead(request.params.alertId);
    return reply.send({ success: true, data: { alert } });
  });

  // POST /api/gardens/:gardenId/alerts/read-all
  fastify.post('/gardens/:gardenId/alerts/read-all', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const data = await alertService.markAllGardenAlertsRead(request.params.gardenId);
    return reply.send({ success: true, data });
  });
}

module.exports = alertRoutes;
