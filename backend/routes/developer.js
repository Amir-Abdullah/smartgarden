const { verifyJwt } = require('../middleware/auth');
const developerService = require('../services/developerService');

async function developerRoutes(fastify) {
  fastify.get('/developer/keys', { preHandler: [verifyJwt] }, async (request, reply) => {
    const keys = await developerService.listApiKeys(request.user.id);
    return reply.send({ success: true, data: { keys, valid_scopes: developerService.VALID_SCOPES } });
  });

  fastify.post('/developer/keys', { preHandler: [verifyJwt] }, async (request, reply) => {
    const created = await developerService.createApiKey(request.user.id, request.body || {});
    return reply.code(201).send({ success: true, data: created });
  });

  fastify.delete('/developer/keys/:keyId', { preHandler: [verifyJwt] }, async (request, reply) => {
    const result = await developerService.revokeApiKey(request.user.id, request.params.keyId);
    return reply.send({ success: true, data: result });
  });

  fastify.get('/developer/public-profile', { preHandler: [verifyJwt] }, async (request, reply) => {
    const profile = await developerService.getMyPublicProfile(request.user.id);
    return reply.send({ success: true, data: profile });
  });

  fastify.put('/developer/public-profile', { preHandler: [verifyJwt] }, async (request, reply) => {
    const profile = await developerService.upsertMyPublicProfile(request.user.id, request.body || {});
    return reply.send({ success: true, data: profile });
  });

  // Unauthenticated opt-in public grower showcase
  fastify.get('/public/growers/:handle', async (request, reply) => {
    const showcase = await developerService.getPublicShowcaseByHandle(request.params.handle);
    return reply.send({ success: true, data: showcase });
  });
}

module.exports = developerRoutes;
