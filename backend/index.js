const { buildServer } = require('./server');
const { connectDb } = require('./config/database');

let appPromise = null;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const app = buildServer();
      try {
        await connectDb();
      } catch (err) {
        console.error('[Vercel Backend] DB Connection error:', err.message);
      }
      await app.ready();
      return app;
    })();
  }
  return appPromise;
}

module.exports = async (req, res) => {
  const app = await getApp();
  app.server.emit('request', req, res);
};
