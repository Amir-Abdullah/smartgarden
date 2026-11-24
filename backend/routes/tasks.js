const { verifyJwt } = require('../middleware/auth');
const { resolveGardenAndRole } = require('../middleware/rbac');
const taskService = require('../services/taskService');

async function taskRoutes(fastify) {
  // GET /api/zones/:zoneId/tasks
  fastify.get('/zones/:zoneId/tasks', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const tasks = await taskService.listZoneTasks(request.params.zoneId, request.query || {});
    return reply.send({ success: true, data: { tasks } });
  });

  // POST /api/zones/:zoneId/tasks
  fastify.post('/zones/:zoneId/tasks', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY'])]
  }, async (request, reply) => {
    const task = await taskService.createTask(request.params.zoneId, request.body || {}, request.user);
    return reply.code(201).send({ success: true, data: { task } });
  });

  // PATCH /api/zones/:zoneId/tasks/:taskId
  fastify.patch('/zones/:zoneId/tasks/:taskId', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY'])]
  }, async (request, reply) => {
    const result = await taskService.updateOrCompleteTask(
      request.params.zoneId,
      request.params.taskId,
      request.body || {},
      request.user
    );
    return reply.send({ success: true, data: result });
  });

  // DELETE /api/zones/:zoneId/tasks/:taskId
  fastify.delete('/zones/:zoneId/tasks/:taskId', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY'])]
  }, async (request, reply) => {
    const result = await taskService.deleteTask(request.params.zoneId, request.params.taskId);
    return reply.send({ success: true, data: result });
  });

  // GET /api/gardens/:gardenId/tasks
  fastify.get('/gardens/:gardenId/tasks', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const tasks = await taskService.listGardenTasks(request.params.gardenId, request.query || {});
    return reply.send({ success: true, data: { tasks } });
  });

  // GET /api/gardens/:id/water-logs
  fastify.get('/gardens/:id/water-logs', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const water_logs = await taskService.listGardenWaterLogs(request.params.id, request.query || {});
    return reply.send({ success: true, data: { water_logs } });
  });

  // POST /api/zones/:zoneId/water-logs
  fastify.post('/zones/:zoneId/water-logs', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY'])]
  }, async (request, reply) => {
    const water_log = await taskService.createWaterLog(request.params.zoneId, request.body || {}, request.user);
    return reply.code(201).send({ success: true, data: { water_log } });
  });
}

module.exports = taskRoutes;
