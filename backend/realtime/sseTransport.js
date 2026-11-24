const eventBus = require('../services/eventBus');
const { checkMemberAccess } = require('../middleware/rbac');

const KEEPALIVE_INTERVAL_MS = 25000;

function extractSseToken(request) {
  const authHeader = request.headers && request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (request.query && request.query.token) {
    return String(request.query.token);
  }
  return null;
}

async function sseTransport(fastify) {
  const activeStreams = new Set();

  fastify.addHook('onClose', async () => {
    for (const stream of activeStreams) {
      stream.close();
    }
    activeStreams.clear();
  });

  fastify.get('/gardens/:gardenId/stream', async (request, reply) => {
    const token = extractSseToken(request);
    if (!token) {
      return reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication token required', statusCode: 401 }
      });
    }

    let decoded;
    try {
      decoded = fastify.jwt.verify(token);
    } catch (_) {
      return reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired authentication token', statusCode: 401 }
      });
    }

    const gardenId = Number(request.params.gardenId);
    const access = await checkMemberAccess(decoded, gardenId, ['OWNER', 'FAMILY', 'GUEST']);
    if (!access.allowed) {
      return reply.code(access.statusCode).send({
        success: false,
        error: {
          code: access.code,
          message: access.message,
          statusCode: access.statusCode
        }
      });
    }

    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    if (typeof raw.flushHeaders === 'function') {
      raw.flushHeaders();
    }
    raw.write(': connected\n\n');

    let closed = false;
    let keepaliveTimer = null;
    let unsubscribe = null;
    const reqSocket = request.raw && request.raw.socket;

    const closeStream = () => {
      if (closed) return;
      closed = true;
      if (keepaliveTimer) {
        clearInterval(keepaliveTimer);
        keepaliveTimer = null;
      }
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      activeStreams.delete(streamHandle);
      if (typeof raw.off === 'function') {
        raw.off('close', closeStream);
        raw.off('error', closeStream);
      }
      if (request.raw && typeof request.raw.off === 'function') {
        request.raw.off('close', closeStream);
        request.raw.off('error', closeStream);
      }
      if (reqSocket && typeof reqSocket.off === 'function') {
        reqSocket.off('close', closeStream);
        reqSocket.off('error', closeStream);
      }
      try {
        if (!raw.writableEnded && !raw.destroyed) raw.end();
      } catch (_) {}
    };

    const streamHandle = { close: closeStream };
    activeStreams.add(streamHandle);

    unsubscribe = eventBus.subscribeGarden(gardenId, (frame) => {
      if (closed) return;
      if (raw.writableEnded || raw.destroyed) {
        closeStream();
        return;
      }
      try {
        raw.write(`event: ${frame.event}\ndata: ${JSON.stringify(frame)}\n\n`);
      } catch (_) {
        closeStream();
      }
    });

    keepaliveTimer = setInterval(() => {
      if (closed) return;
      if (raw.writableEnded || raw.destroyed) {
        closeStream();
        return;
      }
      try {
        raw.write(': keepalive\n\n');
      } catch (_) {
        closeStream();
      }
    }, KEEPALIVE_INTERVAL_MS);
    if (typeof keepaliveTimer.unref === 'function') {
      keepaliveTimer.unref();
    }

    if (typeof raw.on === 'function') {
      raw.on('close', closeStream);
      raw.on('error', closeStream);
    }
    if (request.raw && typeof request.raw.on === 'function') {
      request.raw.on('close', closeStream);
      request.raw.on('error', closeStream);
    }
    if (reqSocket && typeof reqSocket.on === 'function') {
      reqSocket.on('close', closeStream);
      reqSocket.on('error', closeStream);
    }
    if (raw.destroyed || raw.writableEnded || (reqSocket && reqSocket.destroyed)) {
      closeStream();
    }
  });
}

module.exports = sseTransport;
