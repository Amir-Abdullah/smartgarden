const { verifyJwt } = require('../middleware/auth');
const { resolveGardenAndRole } = require('../middleware/rbac');
const recommendationService = require('../services/recommendationService');

async function recommendationRoutes(fastify) {
  // GET /api/zones/:zoneId/recommendations?month=&category=&limit=
  fastify.get('/zones/:zoneId/recommendations', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const q = request.query || {};
    const data = await recommendationService.getZoneRecommendations(request.params.zoneId, {
      month: q.month,
      category: q.category,
      limit: q.limit
    });
    return reply.send({ success: true, data });
  });
}

module.exports = recommendationRoutes;
