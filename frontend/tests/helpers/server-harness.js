import http from 'node:http';
import net from 'node:net';
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
  req.setTimeout?.(0);
  res.setTimeout?.(0);

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

  proxyReq.setTimeout(0);

  const abortUpstream = () => {
    if (!proxyReq.destroyed) {
      proxyReq.destroy();
    }
  };
  req.on('aborted', abortUpstream);
  res.on('close', abortUpstream);

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: { message: err.message } }));
    } else if (!res.writableEnded) {
      res.end();
    }
  });

  req.pipe(proxyReq, { end: true });
}

function proxyWsUpgrade(req, clientSocket, head, backendPort, wsSockets) {
  const rawUrl = req.url || '/';
  const urlPath = rawUrl.split('?')[0];
  if (!(urlPath.startsWith('/ws') || urlPath.startsWith('/api/ws'))) {
    clientSocket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    clientSocket.destroy();
    return;
  }

  const backendSocket = net.connect({ host: '127.0.0.1', port: backendPort });
  wsSockets.add(clientSocket);
  wsSockets.add(backendSocket);

  const cleanup = () => {
    wsSockets.delete(clientSocket);
    wsSockets.delete(backendSocket);
    if (!clientSocket.destroyed) clientSocket.destroy();
    if (!backendSocket.destroyed) backendSocket.destroy();
  };

  clientSocket.on('error', cleanup);
  backendSocket.on('error', cleanup);
  clientSocket.on('close', cleanup);
  backendSocket.on('close', cleanup);

  backendSocket.on('connect', () => {
    clientSocket.setNoDelay(true);
    backendSocket.setNoDelay(true);

    const rawHeaders = req.rawHeaders || [];
    const headerLines = [];
    let hasHost = false;
    for (let i = 0; i < rawHeaders.length; i += 2) {
      const name = rawHeaders[i];
      const val = rawHeaders[i + 1];
      if (String(name).toLowerCase() === 'host') {
        headerLines.push(`${name}: 127.0.0.1:${backendPort}`);
        hasHost = true;
      } else {
        headerLines.push(`${name}: ${val}`);
      }
    }
    if (!hasHost) {
      headerLines.push(`Host: 127.0.0.1:${backendPort}`);
    }

    const reqHead = `${req.method || 'GET'} ${rawUrl} HTTP/${req.httpVersion || '1.1'}\r\n${headerLines.join('\r\n')}\r\n\r\n`;
    backendSocket.write(reqHead);
    if (head && head.length > 0) {
      backendSocket.write(head);
    }

    backendSocket.pipe(clientSocket);
    clientSocket.pipe(backendSocket);
  });
}

function createFrontendProxyServer(backendPort, wsSockets) {
  const server = http.createServer((req, res) => {
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

  server.on('upgrade', (req, socket, head) => {
    proxyWsUpgrade(req, socket, head, backendPort, wsSockets);
  });

  return server;
}

export async function startE2EEnvironment() {
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    execSync('npm run build', { cwd: FRONTEND_DIR, stdio: 'inherit' });
  }

  // Capture caller overrides before loading backend/.env
  const callerDialect = process.env.DB_DIALECT;
  const callerStorage = process.env.DB_STORAGE;
  const callerCronSecret = process.env.CRON_SECRET;

  // Load backend env before loading backend config/models
  const dotenv = requireFromBackend('dotenv');
  dotenv.config({ path: path.join(BACKEND_DIR, '.env') });
  process.env.NODE_ENV = 'test';
  process.env.ENABLE_SCHEDULER = process.env.ENABLE_SCHEDULER || 'false';
  process.env.CRON_SECRET =
    callerCronSecret || process.env.CRON_SECRET || 'e2e_cron_secret_at_least_32_characters_long';

  if (process.env.SG_E2E_USE_ENV_DB !== 'true') {
    process.env.DB_DIALECT = callerDialect || 'sqlite';
    if (process.env.DB_DIALECT === 'sqlite') {
      process.env.DB_STORAGE = callerStorage || ':memory:';
    }
  }

  const dbConfig = requireFromBackend('./config/database.js');
  await dbConfig.connectDb();

  const { runDemoSeed } = requireFromBackend('./scripts/seed-demo.js');
  await runDemoSeed();

  const serverModule = requireFromBackend('./server.js');
  const app = serverModule.buildServer({ logger: false });
  const listenAddress = await app.listen({ port: 0, host: '127.0.0.1' });
  const backendPort = Number(new URL(listenAddress).port);

  const wsSockets = new Set();
  const frontendServer = createFrontendProxyServer(backendPort, wsSockets);
  await new Promise((resolve) => frontendServer.listen(0, '127.0.0.1', resolve));
  const frontendAddress = frontendServer.address();
  const frontendPort = typeof frontendAddress === 'object' && frontendAddress ? frontendAddress.port : 5173;

  const baseUrl = `http://127.0.0.1:${frontendPort}`;
  const apiBaseUrl = `http://127.0.0.1:${backendPort}`;

  async function cleanupE2EData() {
    const models = requireFromBackend('./models');
    const { Op } = requireFromBackend('sequelize');
    const {
      User,
      PasswordResetToken,
      Garden,
      GardenMember,
      GardenInvitation,
      Zone,
      ZonePlant,
      Device,
      SensorReading,
      SensorAggregateDaily,
      CareTask,
      WaterUsageLog,
      AutomationRule,
      AlertConfig,
      AlertLog,
      DeviceWatchdogAlert
    } = models;

    async function destroyZoneChildren(zoneId) {
      await WaterUsageLog.destroy({ where: { zone_id: zoneId } });
      await CareTask.destroy({ where: { zone_id: zoneId } });
      await DeviceWatchdogAlert.destroy({ where: { zone_id: zoneId } });
      await SensorReading.destroy({ where: { zone_id: zoneId } });
      await SensorAggregateDaily.destroy({ where: { zone_id: zoneId } });
      await Device.destroy({ where: { zone_id: zoneId } });
      await AlertLog.destroy({ where: { zone_id: zoneId } });
      await AlertConfig.destroy({ where: { zone_id: zoneId } });
      await AutomationRule.destroy({ where: { zone_id: zoneId } });
      await ZonePlant.destroy({ where: { zone_id: zoneId } });
    }

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
          await destroyZoneChildren(z.id);
        }
        await DeviceWatchdogAlert.destroy({ where: { garden_id: g.id } });
        await Zone.destroy({ where: { garden_id: g.id } });
        await GardenInvitation.destroy({ where: { garden_id: g.id } });
        await GardenMember.destroy({ where: { garden_id: g.id } });
        await Garden.destroy({ where: { id: g.id } });
      }
      await WaterUsageLog.destroy({ where: { logged_by_user_id: u.id } });
      await CareTask.destroy({ where: { assigned_to: u.id } });
      await GardenInvitation.destroy({ where: { invited_by: u.id } });
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
          await destroyZoneChildren(z.id);
        }
        await DeviceWatchdogAlert.destroy({ where: { garden_id: g.id } });
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
      await destroyZoneChildren(z.id);
      await Zone.destroy({ where: { id: z.id } });
    }

    await ZonePlant.destroy({
      where: {
        custom_nickname: { [Op.like]: 'E2E %' }
      }
    });

    // Clean any E2E Sprint 2 records left on seeded zones
    await WaterUsageLog.destroy({ where: { notes: { [Op.like]: 'E2E %' } } });
    await CareTask.destroy({ where: { notes: { [Op.like]: 'E2E %' } } });
    await AutomationRule.destroy({ where: { name: { [Op.like]: 'E2E %' } } });
    const e2eDevices = await Device.findAll({ where: { device_name: { [Op.like]: 'E2E %' } } });
    for (const d of e2eDevices) {
      await DeviceWatchdogAlert.destroy({ where: { device_id: d.id } });
      await SensorReading.destroy({ where: { device_id: d.id } });
      await SensorAggregateDaily.destroy({ where: { device_id: d.id } });
      await Device.destroy({ where: { id: d.id } });
    }
  }

  async function stop() {
    await cleanupE2EData().catch(() => {});
    for (const sock of wsSockets) {
      if (!sock.destroyed) sock.destroy();
    }
    wsSockets.clear();
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
