module.exports = async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const debug = {
      cwd: process.cwd(),
      dirname: __dirname,
      nodeEnv: process.env.NODE_ENV,
      dbHost: process.env.DB_HOST ? 'SET' : 'NOT_SET',
      dbUser: process.env.DB_USER ? 'SET' : 'NOT_SET',
      jwtSecret: process.env.JWT_SECRET ? 'SET' : 'NOT_SET',
      dirContents: fs.readdirSync(__dirname)
    };

    let serverError = null;
    let serverMod = null;
    try {
      serverMod = require('./server.js');
      debug.serverModType = typeof serverMod;
      debug.serverModKeys = Object.keys(serverMod || {});
    } catch (e) {
      serverError = { message: e.message, stack: e.stack };
    }

    if (serverError) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ debug, serverError }));
    }

    if (req.url === '/api/debug') {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ debug }));
    }

    // Call the server handler
    return serverMod(req, res);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      fatalError: err.message,
      stack: err.stack
    }));
  }
};
