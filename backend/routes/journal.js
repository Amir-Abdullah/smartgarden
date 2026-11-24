const { verifyJwt } = require('../middleware/auth');
const { resolveGardenAndRole } = require('../middleware/rbac');
const { parseMultipart } = require('../utils/multipartParser');
const storageService = require('../services/storageService');
const journalService = require('../services/journalService');

function extractPayloadWithOptionalMultipart(request, fileFieldName = 'photo') {
  const ct = String(request.headers['content-type'] || '').toLowerCase();
  if (ct.includes('multipart/form-data')) {
    const { fields, files } = parseMultipart(request);
    return {
      ...fields,
      file: files[fileFieldName] || Object.values(files)[0] || null
    };
  }
  return request.body && typeof request.body === 'object' ? { ...request.body } : {};
}

async function journalRoutes(fastify) {
  // Public media asset streaming for stored photos (/api/media/:key)
  fastify.get('/media/:key', async (request, reply) => {
    const media = await storageService.getMediaByKey(request.params.key);
    if (!media || !media.buffer) {
      return reply.code(404).send({
        success: false,
        error: { code: 'MEDIA_NOT_FOUND', message: 'Media asset not found.', statusCode: 404 }
      });
    }
    reply.header('Content-Type', media.asset.mime_type);
    reply.header('Cache-Control', 'public, max-age=86400');
    return reply.send(media.buffer);
  });

  // GET /api/plants/:id/journal
  fastify.get('/plants/:id/journal', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const data = await journalService.getPlantJournal(request.params.id);
    return reply.send({ success: true, data });
  });

  // POST /api/plants/:id/journal
  fastify.post('/plants/:id/journal', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY'])]
  }, async (request, reply) => {
    const payload = extractPayloadWithOptionalMultipart(request, 'photo');
    const created = await journalService.createJournalEntry(request.params.id, request.user.id, payload);
    return reply.code(201).send({ success: true, data: created });
  });

  // PUT /api/plants/:id/journal/:entryId
  fastify.put('/plants/:id/journal/:entryId', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY'])]
  }, async (request, reply) => {
    const payload = extractPayloadWithOptionalMultipart(request, 'photo');
    const updated = await journalService.updateJournalEntry(
      request.params.id,
      request.params.entryId,
      request.user.id,
      payload
    );
    return reply.send({ success: true, data: updated });
  });

  // DELETE /api/plants/:id/journal/:entryId
  fastify.delete('/plants/:id/journal/:entryId', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY'])]
  }, async (request, reply) => {
    const result = await journalService.deleteJournalEntry(request.params.id, request.params.entryId);
    return reply.send({ success: true, data: result });
  });

  // GET /api/gardens/:id/journal
  fastify.get('/gardens/:id/journal', {
    preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])]
  }, async (request, reply) => {
    const data = await journalService.getGardenJournal(request.params.id);
    return reply.send({ success: true, data });
  });
}

module.exports = journalRoutes;
