const fastify = require('fastify');
const cors = require('@fastify/cors');
const jwt = require('@fastify/jwt');
const config = require('./config/config');
const dbConfig = require('./config/database');
const { connectDb } = dbConfig;

function getDatabase() {
  return typeof dbConfig.getDatabase === 'function' ? dbConfig.getDatabase() : dbConfig.sequelize;
}

function buildServer(opts = {}) {
  const app = fastify({
    logger: config.env === 'development',
    ...opts
  });

  // Register CORS
  const corsOrigin = config.cors.origin === '*' ? true : config.cors.origin;
  app.register(cors, {
    origin: corsOrigin,
    credentials: config.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });

  // Register JWT
  app.register(jwt, {
    secret: config.jwt.secret
  });

  // Standard Error Response Handler conforming to RFC 7807 & PROJECT.md
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || error.status || 500;
    const code = error.code || (
      statusCode === 400 ? 'BAD_REQUEST' :
      statusCode === 401 ? 'UNAUTHORIZED' :
      statusCode === 403 ? 'FORBIDDEN' :
      statusCode === 404 ? 'NOT_FOUND' :
      statusCode === 409 ? 'CONFLICT' :
      statusCode === 422 ? 'UNPROCESSABLE_ENTITY' :
      'INTERNAL_SERVER_ERROR'
    );
    const message = error.message || 'An unexpected error occurred';

    reply.code(statusCode).send({
      success: false,
      error: {
        code,
        message,
        details: error.details || {},
        statusCode
      }
    });
  });

  // Not Found Handler
  app.setNotFoundHandler((request, reply) => {
    const method = request.raw ? request.raw.method : 'GET';
    const url = request.raw ? request.raw.url : '';
    reply.code(404).send({
      success: false,
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: `Route ${method}:${url} not found`,
        details: { path: url, method },
        statusCode: 404
      }
    });
  });

  // Health Check Handler
  const healthHandler = async (request, reply) => {
    let dbStatus = 'disconnected';
    let dbError = null;
    const activeDb = getDatabase();
    try {
      await activeDb.authenticate();
      dbStatus = 'connected';
    } catch (err) {
      dbStatus = 'error';
      dbError = err.message;
    }

    return {
      status: 'ok',
      version: '1.0.2-supabase',
      timestamp: new Date().toISOString(),
      db: dbStatus,
      dialect: activeDb && activeDb.options ? activeDb.options.dialect : 'unknown',
      ...(dbError ? { error: dbError } : {})
    };
  };

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // Register Feature Routes with both /api prefix and direct path for flexible Vercel rewrites
  const authRoutes = require('./routes/auth');
  const gardensRoutes = require('./routes/gardens');
  const invitationsRoutes = require('./routes/invitations');
  const zonesRoutes = require('./routes/zones');
  const catalogRoutes = require('./routes/catalog');
  const plantsRoutes = require('./routes/plants');

  // Prefixed with /api
  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(gardensRoutes, { prefix: '/api/gardens' });
  app.register(invitationsRoutes, { prefix: '/api/invitations' });
  app.register(zonesRoutes, { prefix: '/api/zones' });
  app.register(catalogRoutes, { prefix: '/api/catalog' });
  app.register(plantsRoutes, { prefix: '/api/zones' });

  // Direct without /api (for rewrites that strip the /api prefix)
  app.register(authRoutes, { prefix: '/auth' });
  app.register(gardensRoutes, { prefix: '/gardens' });
  app.register(invitationsRoutes, { prefix: '/invitations' });
  app.register(zonesRoutes, { prefix: '/zones' });
  app.register(catalogRoutes, { prefix: '/catalog' });
  app.register(plantsRoutes, { prefix: '/zones' });

  return app;
}

async function start() {
  const app = buildServer();
  try {
    await connectDb();
    const address = await app.listen({ port: config.port, host: config.host });
    console.log(`[smartgarden-backend] Server listening at ${address}`);
  } catch (err) {
    console.error('[smartgarden-backend] Startup error:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

let cachedServer = null;
let initPromise = null;

async function getOrCreateServer() {
  if (!cachedServer) {
    cachedServer = buildServer();
    try {
      await connectDb();
    } catch (err) {
      console.error('[Serverless DB connect error]', err.message);
    }
    await cachedServer.ready();
  }
  return cachedServer;
}

// Serverless entrypoint for Vercel
async function serverlessHandler(req, res) {
  try {
    if (!initPromise) {
      initPromise = getOrCreateServer();
    }
    const server = await initPromise;

    const payload = (req.body !== undefined && req.body !== null)
      ? (typeof req.body === 'object' ? JSON.stringify(req.body) : String(req.body))
      : undefined;

    const headers = { ...(req.headers || {}) };
    if (payload !== undefined) {
      delete headers['content-length'];
      delete headers['Content-Length'];
    }

    const injected = await server.inject({
      method: req.method || 'GET',
      url: req.url || '/',
      headers,
      payload
    });

    res.statusCode = injected.statusCode;
    for (const [k, v] of Object.entries(injected.headers || {})) {
      res.setHeader(k, v);
    }
    res.end(injected.payload);
  } catch (err) {
    console.error('[Serverless Handler Error]', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Server error',
          statusCode: 500
        }
      }));
    }
  }
}

serverlessHandler.buildServer = buildServer;
serverlessHandler.start = start;
serverlessHandler.getDatabase = getDatabase;
serverlessHandler.default = serverlessHandler;

module.exports = serverlessHandler;
