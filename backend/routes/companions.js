const { verifyJwt } = require('../middleware/auth');
const { resolveGardenAndRole } = require('../middleware/rbac');
const companionService = require('../services/companionService');

async function companionRoutes(fastify) {
  // GET /api/zones/:zoneId/companions?candidate_catalog_ids=1,2
  fastify.get('/zones/:zoneId/companions', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const q = request.query || {};
    const candidateIds = typeof q.candidate_catalog_ids === 'string' && q.candidate_catalog_ids.trim()
      ? q.candidate_catalog_ids.split(',').map((s) => Number(s.trim())).filter(Number.isFinite)
      : [];
    const data = await companionService.getZoneCompanionAnalysis(request.params.zoneId, candidateIds);
    return reply.send({ success: true, data });
  });

  // POST /api/zones/:zoneId/companions/simulate
  fastify.post('/zones/:zoneId/companions/simulate', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const body = request.body || {};
    const candidateIds = Array.isArray(body.candidate_catalog_ids) ? body.candidate_catalog_ids : [];
    const data = await companionService.getZoneCompanionAnalysis(request.params.zoneId, candidateIds);
    return reply.send({ success: true, data });
  });
}

module.exports = companionRoutes;
