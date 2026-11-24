const { verifyJwt } = require('../middleware/auth');
const { resolveGardenAndRole } = require('../middleware/rbac');
const analyticsService = require('../services/analyticsService');

async function analyticsRoutes(fastify) {
  // GET /api/gardens/:id/analytics
  fastify.get('/gardens/:id/analytics', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const { range = '30d', zone_id: zoneId } = request.query || {};
    const data = await analyticsService.getGardenAnalytics(request.params.id, { range, zoneId });
    return reply.send({ success: true, data });
  });

  // GET /api/gardens/:id/analytics/export.csv
  fastify.get('/gardens/:id/analytics/export.csv', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const { range = '30d', zone_id: zoneId } = request.query || {};
    const csv = await analyticsService.exportAnalyticsCsv(request.params.id, { range, zoneId });
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header(
      'Content-Disposition',
      `attachment; filename="smartgarden-analytics-garden-${request.params.id}.csv"`
    );
    return reply.send(csv);
  });

  // GET /api/gardens/:id/analytics/export.pdf
  fastify.get('/gardens/:id/analytics/export.pdf', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const { range = '30d', zone_id: zoneId } = request.query || {};
    const pdfBuffer = await analyticsService.exportAnalyticsPdf(request.params.id, { range, zoneId });
    reply.header('Content-Type', 'application/pdf');
    reply.header(
      'Content-Disposition',
      `attachment; filename="smartgarden-report-garden-${request.params.id}.pdf"`
    );
    return reply.send(pdfBuffer);
  });
}

module.exports = analyticsRoutes;
