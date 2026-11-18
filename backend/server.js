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
    try {
      const activeDb = getDatabase();
      await activeDb.authenticate();
      dbStatus = 'connected';
    } catch (err) {
      dbStatus = 'error';
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: dbStatus
    };
  };

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // Register Feature Routes
  app.register(require('./routes/auth'), { prefix: '/api/auth' });
  app.register(require('./routes/gardens'), { prefix: '/api/gardens' });
  app.register(require('./routes/invitations'), { prefix: '/api/invitations' });
  app.register(require('./routes/zones'), { prefix: '/api/zones' });
  app.register(require('./routes/catalog'), { prefix: '/api/catalog' });
  app.register(require('./routes/plants'), { prefix: '/api/zones' });

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

module.exports = {
  buildServer,
  start,
  getDatabase
};
