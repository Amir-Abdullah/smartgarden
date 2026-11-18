const serverMod = require('./server.js');
const dbConfig = require('./config/database.js');

let app = null;
let initPromise = null;

async function init() {
  if (!app) {
    const buildFn = typeof serverMod === 'function' ? serverMod : (serverMod.buildServer || serverMod.default);
    if (typeof buildFn !== 'function') {
      throw new Error(`buildServer resolution failed. serverMod type: ${typeof serverMod}, keys: ${Object.keys(serverMod || {})}`);
    }
    app = buildFn();
    try {
      const connectFn = dbConfig.connectDb || dbConfig;
      if (typeof connectFn === 'function') {
        await connectFn();
      }
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
      if (typeof server.inject === 'function') {
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
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        });
      } else if (server.server && typeof server.server.emit === 'function') {
        server.server.emit('request', req, res);
      } else {
        res.statusCode = 500;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: 'Server dispatcher could not handle request' }));
      }
    });
  }).catch(err => {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: err.message }));
  });
};
