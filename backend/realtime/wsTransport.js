const eventBus = require('../services/eventBus');
const { checkMemberAccess } = require('../middleware/rbac');

const HEARTBEAT_INTERVAL_MS = 30000;
const PONG_TIMEOUT_MS = 10000;

function extractWsToken(request) {
  if (request.query && request.query.token) {
    return String(request.query.token);
  }
  const authHeader = request.headers && request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

async function wsTransport(fastify) {
  const activeSockets = new Set();

  const heartbeatInterval = setInterval(() => {
    for (const entry of activeSockets) {
      const { ws } = entry;
      if (ws.readyState !== 1) continue;
      entry.isAlive = false;
      if (entry.pongTimer) {
        clearTimeout(entry.pongTimer);
        entry.pongTimer = null;
      }
      try {
        if (typeof ws.ping === 'function') {
          ws.ping();
        }
      } catch (_) {
        try { ws.terminate(); } catch (__) {}
        continue;
      }
      entry.pongTimer = setTimeout(() => {
        if (!entry.isAlive) {
          try {
            if (typeof ws.terminate === 'function') ws.terminate();
            else ws.close(4008, 'Heartbeat timeout');
          } catch (_) {}
        }
      }, PONG_TIMEOUT_MS);
      if (typeof entry.pongTimer.unref === 'function') {
        entry.pongTimer.unref();
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  if (typeof heartbeatInterval.unref === 'function') {
    heartbeatInterval.unref();
  }

  fastify.addHook('onClose', async () => {
    clearInterval(heartbeatInterval);
    for (const entry of activeSockets) {
      if (entry.pongTimer) clearTimeout(entry.pongTimer);
      if (entry.unsubscribe) entry.unsubscribe();
      try {
        entry.ws.close(1001, 'Server shutting down');
      } catch (_) {}
    }
    activeSockets.clear();
  });

  fastify.get('/ws/gardens/:gardenId', { websocket: true }, async (connectionOrSocket, request) => {
    const ws = (connectionOrSocket && connectionOrSocket.socket) ? connectionOrSocket.socket : connectionOrSocket;
    const gardenId = Number(request.params.gardenId);

    const token = extractWsToken(request);
    if (!token) {
      ws.close(4001, 'Unauthorized: missing token');
      return;
    }

    let decoded;
    try {
      decoded = fastify.jwt.verify(token);
    } catch (_) {
      ws.close(4001, 'Unauthorized: invalid or expired token');
      return;
    }

    let access;
    try {
      access = await checkMemberAccess(decoded, gardenId, ['OWNER', 'FAMILY', 'GUEST']);
    } catch (_) {
      ws.close(4003, 'Forbidden');
      return;
    }

    if (!access.allowed) {
      ws.close(4003, access.message || 'Forbidden');
      return;
    }

    const entry = {
      ws,
      gardenId,
      isAlive: true,
      pongTimer: null,
      unsubscribe: null
    };

    const cleanup = () => {
      if (entry.pongTimer) {
        clearTimeout(entry.pongTimer);
        entry.pongTimer = null;
      }
      if (entry.unsubscribe) {
        entry.unsubscribe();
        entry.unsubscribe = null;
      }
      activeSockets.delete(entry);
    };

    entry.unsubscribe = eventBus.subscribeGarden(gardenId, (frame) => {
      if (ws.readyState === 1) {
        try {
          ws.send(JSON.stringify(frame));
        } catch (_) {
          cleanup();
        }
      }
    });

    activeSockets.add(entry);

    ws.on('pong', () => {
      entry.isAlive = true;
      if (entry.pongTimer) {
        clearTimeout(entry.pongTimer);
        entry.pongTimer = null;
      }
    });

    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });
}

module.exports = wsTransport;
