const { verifyJwt } = require('../middleware/auth');
const { resolveGardenAndRole } = require('../middleware/rbac');
const carePlanService = require('../services/carePlanService');

async function carePlanRoutes(fastify) {
  // GET /api/zones/:zoneId/care-plans/preview
  fastify.get('/zones/:zoneId/care-plans/preview', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const q = request.query || {};
    const data = await carePlanService.previewCarePlan(request.params.zoneId, {
      plantId: q.plant_id
    });
    return reply.send({ success: true, data });
  });

  // POST /api/zones/:zoneId/plants/:plantId/care-plan/preview
  fastify.post('/zones/:zoneId/plants/:plantId/care-plan/preview', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const data = await carePlanService.previewCarePlan(request.params.zoneId, {
      plantId: request.params.plantId
    });
    return reply.send({ success: true, data });
  });

  // POST /api/zones/:zoneId/care-plans/generate
  fastify.post('/zones/:zoneId/care-plans/generate', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY'])]
  }, async (request, reply) => {
    const body = request.body || {};
    const data = await carePlanService.generateCarePlan(
      request.params.zoneId,
      { plantId: body.plant_id },
      request.user
    );
    return reply.code(201).send({ success: true, data });
  });

  // POST /api/zones/:zoneId/plants/:plantId/care-plan
  fastify.post('/zones/:zoneId/plants/:plantId/care-plan', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY'])]
  }, async (request, reply) => {
    const data = await carePlanService.generateCarePlan(
      request.params.zoneId,
      { plantId: request.params.plantId },
      request.user
    );
    return reply.code(201).send({ success: true, data });
  });
}

module.exports = carePlanRoutes;
