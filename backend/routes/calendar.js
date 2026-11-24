const { verifyJwt } = require('../middleware/auth');
const calendarService = require('../services/calendarService');

async function calendarRoutes(fastify) {
  // GET /api/calendar?garden_id=&region=&latitude=&hemisphere=&month=&category=
  fastify.get('/calendar', {
    preHandler: [verifyJwt]
  }, async (request, reply) => {
    const q = request.query || {};
    const data = await calendarService.getSeasonalCalendar({
      gardenId: q.garden_id,
      region: q.region,
      latitude: q.latitude,
      hemisphere: q.hemisphere,
      month: q.month,
      category: q.category
    });
    return reply.send({ success: true, data });
  });

  // GET /api/calendar/export.ics?garden_id=&region=&latitude=&hemisphere=&month=
  fastify.get('/calendar/export.ics', {
    preHandler: [verifyJwt]
  }, async (request, reply) => {
    const q = request.query || {};
    const icsContent = await calendarService.generateIcsExport({
      gardenId: q.garden_id,
      region: q.region,
      latitude: q.latitude,
      hemisphere: q.hemisphere,
      month: q.month,
      category: q.category
    });
    reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="smartgarden-planting-calendar.ics"')
      .send(icsContent);
  });
}

module.exports = calendarRoutes;
