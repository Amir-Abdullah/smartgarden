const { verifyJwt } = require('../middleware/auth');
const { resolveGardenAndRole } = require('../middleware/rbac');
const sustainabilityService = require('../services/sustainabilityService');

async function sustainabilityRoutes(fastify) {
  fastify.get('/gardens/:id/sustainability', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const data = await sustainabilityService.getGardenSustainability(request.params.id);
    return reply.send({ success: true, data });
  });

  fastify.post('/gardens/:id/sustainability/logs', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY'])]
  }, async (request, reply) => {
    const created = await sustainabilityService.addSustainabilityLog(
      request.params.id,
      request.user.id,
      request.body || {}
    );
    return reply.code(201).send({ success: true, data: created });
  });

  fastify.delete('/gardens/:id/sustainability/logs/:logId', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY'])]
  }, async (request, reply) => {
    const res = await sustainabilityService.deleteSustainabilityLog(request.params.id, request.params.logId);
    return reply.send({ success: true, data: res });
  });
}

module.exports = sustainabilityRoutes;
