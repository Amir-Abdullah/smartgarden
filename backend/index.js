const { buildServer } = require('./server');
const { connectDb } = require('./config/database');

let app = null;
let initPromise = null;

async function init() {
  if (!app) {
    app = buildServer();
    try {
      await connectDb();
    } catch (err) {
      console.error('[Vercel Backend] DB Connection error:', err.message);
    }
  }
  return app;
}

module.exports = (req, res) => {
  if (!initPromise) {
    initPromise = init();
  }
  initPromise.then(server => {
    let rawBody = '';
    req.on('data', chunk => {
      rawBody += chunk;
    });
    req.on('end', () => {
      // In Vercel serverless functions, Fastify's internal _handleRequest delivers response directly to res
      const FastifyReply = require('fastify/index.js');
      // If server has listen-style handler or direct dispatch:
      if (typeof server._handleRequest === 'function') {
        const { parse: parseUrl } = require('node:url');
        // Construct reply instance
        server.inject({
          method: req.method,
          url: req.url,
          headers: req.headers,
          payload: rawBody
        }).then(injected => {
          res.statusCode = injected.statusCode;
          for (const [k, v] of Object.entries(injected.headers || {})) {
            res.setHeader(k, v);
          }
          res.end(injected.payload);
        }).catch(err => {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        });
      } else {
        server.server.emit('request', req, res);
      }
    });
  }).catch(err => {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message }));
  });
};
