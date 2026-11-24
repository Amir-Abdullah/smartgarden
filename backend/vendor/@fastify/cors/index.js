async function fastifyCors(fastify, options = {}) {
  const origin = options.origin || '*';
  const methods = options.methods || 'GET,HEAD,PUT,PATCH,POST,DELETE';
  const allowedHeaders = options.allowedHeaders || 'Content-Type,Authorization';
  const credentials = options.credentials ? 'true' : null;

  fastify.addHook('onRequest', async (request, reply) => {
    const reqOrigin = request.headers['origin'];
    let allowOrigin = origin;
    if (typeof origin === 'function') {
      allowOrigin = origin(reqOrigin);
    } else if (Array.isArray(origin)) {
      allowOrigin = origin.includes(reqOrigin) ? reqOrigin : origin[0];
    } else if (origin === true) {
      allowOrigin = reqOrigin || '*';
    }

    reply.header('Access-Control-Allow-Origin', allowOrigin);
    reply.header('Access-Control-Allow-Methods', Array.isArray(methods) ? methods.join(',') : methods);
    reply.header('Access-Control-Allow-Headers', Array.isArray(allowedHeaders) ? allowedHeaders.join(',') : allowedHeaders);
    if (credentials) {
      reply.header('Access-Control-Allow-Credentials', credentials);
    }

    if (request.raw && request.raw.method === 'OPTIONS') {
      reply.code(204).send('');
    }
  });
}

module.exports = fastifyCors;
module.exports.default = fastifyCors;
