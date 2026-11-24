const { verifyJwt } = require('../middleware/auth');
const seedVaultService = require('../services/seedVaultService');

async function seedVaultRoutes(fastify) {
  fastify.get('/seeds', { preHandler: [verifyJwt] }, async (request, reply) => {
    const { status = 'ALL', search = '' } = request.query || {};
    const data = await seedVaultService.listSeeds(request.user.id, { status, search });
    return reply.send({ success: true, data });
  });

  fastify.post('/seeds', { preHandler: [verifyJwt] }, async (request, reply) => {
    const created = await seedVaultService.createSeed(request.user.id, request.body || {});
    return reply.code(201).send({ success: true, data: created });
  });

  fastify.put('/seeds/:id', { preHandler: [verifyJwt] }, async (request, reply) => {
    const updated = await seedVaultService.updateSeed(request.user.id, request.params.id, request.body || {});
    return reply.send({ success: true, data: updated });
  });

  fastify.delete('/seeds/:id', { preHandler: [verifyJwt] }, async (request, reply) => {
    const res = await seedVaultService.deleteSeed(request.user.id, request.params.id);
    return reply.send({ success: true, data: res });
  });

  fastify.post('/seeds/:id/allocate', { preHandler: [verifyJwt] }, async (request, reply) => {
    const result = await seedVaultService.allocateSeedToZone(request.user.id, request.params.id, request.body || {});
    return reply.code(201).send({ success: true, data: result });
  });
}

module.exports = seedVaultRoutes;
