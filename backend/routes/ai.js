const { verifyJwt } = require('../middleware/auth');
const { parseMultipart } = require('../utils/multipartParser');
const aiService = require('../services/aiService');

async function aiRoutes(fastify) {
  // POST /api/ai/diagnose-leaf
  fastify.post('/ai/diagnose-leaf', {
    preHandler: [verifyJwt]
  }, async (request, reply) => {
    const ct = String(request.headers['content-type'] || '').toLowerCase();
    let payload;
    if (ct.includes('multipart/form-data')) {
      const { fields, files } = parseMultipart(request);
      payload = {
        ...fields,
        file: files.photo || files.image || Object.values(files)[0] || null
      };
    } else {
      payload = request.body && typeof request.body === 'object' ? { ...request.body } : {};
    }

    const result = await aiService.diagnoseLeaf({
      userId: request.user.id,
      ...payload
    });

    return reply.send({ success: true, data: result });
  });

  // POST /api/ai/chat
  fastify.post('/ai/chat', {
    preHandler: [verifyJwt]
  }, async (request, reply) => {
    const body = request.body && typeof request.body === 'object' ? request.body : {};
    const result = await aiService.chatWithAssistant({
      userId: request.user.id,
      message: body.message,
      garden_id: body.garden_id,
      zone_id: body.zone_id,
      history: body.history
    });

    return reply.send({ success: true, data: result });
  });
}

module.exports = aiRoutes;
