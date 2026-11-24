const { verifyJwt } = require('../middleware/auth');
const { resolveGardenAndRole } = require('../middleware/rbac');
const weatherService = require('../services/weatherService');

async function weatherRoutes(fastify) {
  // GET /api/weather?latitude=&longitude=&force_refresh=
  fastify.get('/weather', {
    preHandler: [verifyJwt]
  }, async (request, reply) => {
    const q = request.query || {};
    const data = await weatherService.getWeatherData(q.latitude, q.longitude, {
      forceRefresh: q.force_refresh === 'true' || q.force_refresh === '1'
    });
    return reply.send({ success: true, data });
  });

  // GET /api/gardens/:id/weather
  fastify.get('/gardens/:id/weather', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const q = request.query || {};
    const data = await weatherService.getGardenWeather(request.params.id, {
      forceRefresh: q.force_refresh === 'true' || q.force_refresh === '1'
    });
    return reply.send({ success: true, data });
  });

  // POST /api/gardens/:id/weather/rain-skip
  fastify.post('/gardens/:id/weather/rain-skip', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY'])]
  }, async (request, reply) => {
    const data = await weatherService.applyRainSkipForGarden(request.params.id);
    return reply.send({ success: true, data });
  });
}

module.exports = weatherRoutes;
