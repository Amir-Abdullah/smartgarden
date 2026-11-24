const { verifyJwt } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

async function notificationRoutes(fastify) {
  fastify.get('/notifications', { preHandler: [verifyJwt] }, async (request, reply) => {
    const { unread_only: unreadOnly, limit } = request.query || {};
    const data = await notificationService.listNotifications(request.user.id, { unreadOnly, limit });
    return reply.send({ success: true, data });
  });

  fastify.patch('/notifications/:id/read', { preHandler: [verifyJwt] }, async (request, reply) => {
    const item = await notificationService.markRead(request.user.id, request.params.id);
    return reply.send({ success: true, data: item });
  });

  fastify.post('/notifications/read-all', { preHandler: [verifyJwt] }, async (request, reply) => {
    const res = await notificationService.markAllRead(request.user.id);
    return reply.send({ success: true, data: res });
  });

  fastify.get('/notifications/preferences', { preHandler: [verifyJwt] }, async (request, reply) => {
    const prefs = await notificationService.getPreferences(request.user.id);
    return reply.send({ success: true, data: prefs });
  });

  fastify.put('/notifications/preferences', { preHandler: [verifyJwt] }, async (request, reply) => {
    const prefs = await notificationService.updatePreferences(request.user.id, request.body || {});
    return reply.send({ success: true, data: prefs });
  });

  fastify.post('/notifications/test-webhook', { preHandler: [verifyJwt] }, async (request, reply) => {
    const { webhook_url: webhookUrl } = request.body || {};
    const result = await notificationService.sendTestWebhook(request.user.id, webhookUrl);
    return reply.send({ success: true, data: result });
  });
}

module.exports = notificationRoutes;
