import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(FRONTEND_DIR, '..');
const BACKEND_DIR = path.join(REPO_ROOT, 'backend');
const DIST_DIR = path.join(FRONTEND_DIR, 'dist');

const requireFromBackend = createRequire(path.join(BACKEND_DIR, 'package.json'));

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function proxyToBackend(req, res, backendPort) {
  const proxyReq = http.request(
    {
      hostname: '127.0.0.1',
      port: backendPort,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${backendPort}`
      }
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    }
  );

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
    }
    res.end(JSON.stringify({ success: false, error: { message: err.message } }));
  });

  req.pipe(proxyReq, { end: true });
}

function createFrontendProxyServer(backendPort) {
  return http.createServer((req, res) => {
    const rawUrl = req.url || '/';
    const urlPath = rawUrl.split('?')[0];

    if (urlPath.startsWith('/api') || urlPath === '/health') {
      proxyToBackend(req, res, backendPort);
      return;
    }

    const safeRelPath = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
    let filePath = path.join(DIST_DIR, safeRelPath === '\\' || safeRelPath === '/' ? 'index.html' : safeRelPath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      // SPA history fallback for client-side routes
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

export async function startE2EEnvironment() {
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    execSync('npm run build', { cwd: FRONTEND_DIR, stdio: 'inherit' });
  }

  // Load backend env before loading backend config/models
  const dotenv = requireFromBackend('dotenv');
  dotenv.config({ path: path.join(BACKEND_DIR, '.env') });
  process.env.NODE_ENV = 'test';
  process.env.DB_DIALECT = process.env.DB_DIALECT || 'mariadb';

  const dbConfig = requireFromBackend('./config/database.js');
  await dbConfig.connectDb();

  const { runDemoSeed } = requireFromBackend('./scripts/seed-demo.js');
  await runDemoSeed();

  const serverModule = requireFromBackend('./server.js');
  const app = serverModule.buildServer({ logger: false });
  const listenAddress = await app.listen({ port: 0, host: '127.0.0.1' });
  const backendPort = Number(new URL(listenAddress).port);

  const frontendServer = createFrontendProxyServer(backendPort);
  await new Promise((resolve) => frontendServer.listen(0, '127.0.0.1', resolve));
  const frontendAddress = frontendServer.address();
  const frontendPort = typeof frontendAddress === 'object' && frontendAddress ? frontendAddress.port : 5173;

  const baseUrl = `http://127.0.0.1:${frontendPort}`;
  const apiBaseUrl = `http://127.0.0.1:${backendPort}`;

  async function cleanupE2EData() {
    const models = requireFromBackend('./models');
    const { Op } = requireFromBackend('sequelize');
    const { User, PasswordResetToken, Garden, GardenMember, GardenInvitation, Zone, ZonePlant } = models;

    const testUsers = await User.findAll({
      where: {
        email: {
          [Op.like]: 'e2e-%@smartgarden.test'
        }
      }
    });

    for (const u of testUsers) {
      const ownedGardens = await Garden.findAll({ where: { owner_id: u.id } });
      for (const g of ownedGardens) {
        const zones = await Zone.findAll({ where: { garden_id: g.id } });
        for (const z of zones) {
          await ZonePlant.destroy({ where: { zone_id: z.id } });
        }
        await Zone.destroy({ where: { garden_id: g.id } });
        await GardenInvitation.destroy({ where: { garden_id: g.id } });
        await GardenMember.destroy({ where: { garden_id: g.id } });
        await Garden.destroy({ where: { id: g.id } });
      }
      await GardenMember.destroy({ where: { user_id: u.id } });
      await PasswordResetToken.destroy({ where: { user_id: u.id } });
      await User.destroy({ where: { id: u.id } });
    }

    // Also clean any leftover E2E gardens owned by demo user if a test failed mid-run
    const demoUser = await User.findOne({ where: { email: 'demo@smartgarden.app' } });
    if (demoUser) {
      const e2eGardens = await Garden.findAll({
        where: {
          owner_id: demoUser.id,
          name: { [Op.like]: 'E2E %' }
        }
      });
      for (const g of e2eGardens) {
        const zones = await Zone.findAll({ where: { garden_id: g.id } });
        for (const z of zones) {
          await ZonePlant.destroy({ where: { zone_id: z.id } });
        }
        await Zone.destroy({ where: { garden_id: g.id } });
        await GardenInvitation.destroy({ where: { garden_id: g.id } });
        await GardenMember.destroy({ where: { garden_id: g.id } });
        await Garden.destroy({ where: { id: g.id } });
      }
    }

    const e2eZones = await Zone.findAll({
      where: {
        name: { [Op.like]: 'E2E %' }
      }
    });
    for (const z of e2eZones) {
      await ZonePlant.destroy({ where: { zone_id: z.id } });
      await Zone.destroy({ where: { id: z.id } });
    }

    await ZonePlant.destroy({
      where: {
        custom_nickname: { [Op.like]: 'E2E %' }
      }
    });
  }

  async function stop() {
    await cleanupE2EData().catch(() => {});
    if (typeof frontendServer.closeAllConnections === 'function') {
      frontendServer.closeAllConnections();
    }
    await new Promise((resolve) => frontendServer.close(() => resolve()));
    if (app.server && typeof app.server.closeAllConnections === 'function') {
      app.server.closeAllConnections();
    }
    await app.close();
    await dbConfig.sequelize.close();
  }

  return {
    baseUrl,
    apiBaseUrl,
    backendPort,
    frontendPort,
    dialect: dbConfig.sequelize.options.dialect,
    cleanupE2EData,
    stop
  };
}
