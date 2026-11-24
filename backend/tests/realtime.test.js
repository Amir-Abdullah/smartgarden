const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';
process.env.ENABLE_SCHEDULER = 'false';

const http = require('node:http');
const bcrypt = require('bcryptjs');
const { buildServer } = require('../server');
const { connectDb } = require('../config/database');
const { runMigrations } = require('../scripts/migrate');
const { User, Garden, GardenMember, Zone } = require('../models');
const eventBus = require('../services/eventBus');

describe('Sprint 2 F8: WebSocket & SSE Realtime Suite', () => {
  let app;
  let ownerUser, expiredGuestUser, outsiderUser;
  let ownerToken, expiredGuestToken, outsiderToken;
  let garden, zone, deviceKey;

  async function createUserAndLogin(name, email) {
    const password = 'Password123!';
    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password_hash });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email, password })
    });
    return { user, token: res.json().data.token };
  }

  before(async () => {
    await connectDb();
    await runMigrations();
    app = buildServer();

    ({ user: ownerUser, token: ownerToken } = await createUserAndLogin('RT Owner', 'rt_owner@test.com'));
    ({ user: expiredGuestUser, token: expiredGuestToken } = await createUserAndLogin('RT ExpGuest', 'rt_expguest@test.com'));
    ({ user: outsiderUser, token: outsiderToken } = await createUserAndLogin('RT Outsider', 'rt_outsider@test.com'));

    garden = await Garden.create({ owner_id: ownerUser.id, name: 'Realtime Garden', timezone: 'UTC', area_sq_m: 20 });
    await GardenMember.create({ garden_id: garden.id, user_id: ownerUser.id, role: 'OWNER' });
    await GardenMember.create({
      garden_id: garden.id,
      user_id: expiredGuestUser.id,
      role: 'GUEST',
      expires_at: new Date(Date.now() - 3600000)
    });

    zone = await Zone.create({ garden_id: garden.id, name: 'Live Zone', is_outdoor: true, area_sq_m: 6 });

    const devRes = await app.inject({
      method: 'POST',
      url: `/api/zones/${zone.id}/devices`,
      headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ device_name: 'Live Sensor' })
    });
    deviceKey = devRes.json().data.api_key;

    await app.inject({
      method: 'PUT',
      url: `/api/zones/${zone.id}/alerts/config`,
      headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ metric: 'SOIL_MOISTURE', min_threshold: 40, max_threshold: 85 })
    });
  });

  after(async () => {
    if (app) await app.close();
  });

  async function waitForClose(wsPath) {
    const ws = await app.injectWs(wsPath);
    if (ws.readyState === 3 && ws.closeCode !== null) {
      return ws.closeCode;
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        try { ws.terminate(); } catch (_) {}
        reject(new Error(`Timed out waiting for WebSocket close on ${wsPath}`));
      }, 4000);
      ws.on('close', (code) => {
        clearTimeout(timer);
        resolve(code);
      });
    });
  }

  test('WebSocket rejects invalid JWT with 4001 and non-member/expired guest with 4003', async () => {
    const codeNoToken = await waitForClose(`/ws/gardens/${garden.id}`);
    assert.strictEqual(codeNoToken, 4001);

    const codeBadJwt = await waitForClose(`/ws/gardens/${garden.id}?token=not.a.valid.jwt`);
    assert.strictEqual(codeBadJwt, 4001);

    const codeOutsider = await waitForClose(`/ws/gardens/${garden.id}?token=${outsiderToken}`);
    assert.strictEqual(codeOutsider, 4003);

    const codeExpiredGuest = await waitForClose(`/ws/gardens/${garden.id}?token=${expiredGuestToken}`);
    assert.strictEqual(codeExpiredGuest, 4003);
  });

  test('WebSocket & SSE streams deliver SENSOR_UPDATE, ALERT_TRIGGERED, TASK_UPDATED and support ping/pong', async () => {
    const wsMessages = [];
    const ws = await app.injectWs(`/ws/gardens/${garden.id}?token=${ownerToken}`);
    assert.strictEqual(ws.readyState, 1);

    ws.on('message', (data) => {
      wsMessages.push(JSON.parse(data.toString('utf8')));
    });

    // Verify RFC 6455 ping/pong heartbeat
    const pongPromise = new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('WS pong timeout')), 2000);
      ws.once('pong', (payload) => {
        clearTimeout(t);
        resolve(payload.toString('utf8'));
      });
    });
    ws.ping('hb-check');
    const pongPayload = await pongPromise;
    assert.strictEqual(pongPayload, 'hb-check');

    // Open SSE stream in-process
    const sseResp = await app.inject({
      method: 'GET',
      url: `/api/gardens/${garden.id}/stream?token=${ownerToken}`,
      stream: true
    });
    assert.strictEqual(sseResp.statusCode, 200);
    assert.ok(sseResp.headers['content-type'].includes('text/event-stream'));

    let sseBuffer = '';
    sseResp.stream.on('data', (chunk) => {
      sseBuffer += chunk.toString('utf8');
    });

    // Wait until both WS and SSE subscriptions are attached on eventBus
    const attachDeadline = Date.now() + 2000;
    while (eventBus.listenerCount(garden.id) < 2 && Date.now() < attachDeadline) {
      await new Promise((r) => setTimeout(r, 15));
    }
    assert.ok(eventBus.listenerCount(garden.id) >= 2, 'Expected both WS and SSE listeners attached');

    // Trigger SENSOR_UPDATE + ALERT_TRIGGERED via low-moisture ingest
    const ingestRes = await app.inject({
      method: 'POST',
      url: '/api/sensors/ingest',
      headers: { 'x-device-key': deviceKey, 'content-type': 'application/json' },
      payload: JSON.stringify({ soilMoisture: 22.5, temperature: 24, humidity: 55, lightLux: 2000 })
    });
    assert.strictEqual(ingestRes.statusCode, 201);

    // Trigger TASK_UPDATED via task creation
    const taskRes = await app.inject({
      method: 'POST',
      url: `/api/zones/${zone.id}/tasks`,
      headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ task_type: 'WATER', due_date: '2026-11-24' })
    });
    assert.strictEqual(taskRes.statusCode, 201);

    // Wait up to 2s for all 3 events on WS & SSE
    const deadline = Date.now() + 2000;
    while (
      (wsMessages.length < 3 || !sseBuffer.includes('event: TASK_UPDATED')) &&
      Date.now() < deadline
    ) {
      await new Promise((r) => setTimeout(r, 20));
    }

    const wsEvents = wsMessages.map((m) => m.event);
    assert.ok(wsEvents.includes('SENSOR_UPDATE'), `Expected SENSOR_UPDATE in ${JSON.stringify(wsEvents)}`);
    assert.ok(wsEvents.includes('ALERT_TRIGGERED'), `Expected ALERT_TRIGGERED in ${JSON.stringify(wsEvents)}`);
    assert.ok(wsEvents.includes('TASK_UPDATED'), `Expected TASK_UPDATED in ${JSON.stringify(wsEvents)}`);

    assert.ok(sseBuffer.includes(': connected'));
    assert.ok(sseBuffer.includes('event: SENSOR_UPDATE'));
    assert.ok(sseBuffer.includes('event: ALERT_TRIGGERED'));
    assert.ok(sseBuffer.includes('event: TASK_UPDATED'));

    ws.close(1000, 'test done');
    sseResp.close();
  });

  test('SSE returns HTTP 401/403 before opening stream when unauthorized', async () => {
    const noTokenRes = await app.inject({
      method: 'GET',
      url: `/api/gardens/${garden.id}/stream`
    });
    assert.strictEqual(noTokenRes.statusCode, 401);

    const outsiderRes = await app.inject({
      method: 'GET',
      url: `/api/gardens/${garden.id}/stream`,
      headers: { authorization: `Bearer ${outsiderToken}` }
    });
    assert.strictEqual(outsiderRes.statusCode, 403);
  });

  test('Real-TCP SSE client disconnect cleans up eventBus listener within 500ms', async () => {
    const baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
    const streamUrl = `${baseUrl}/api/gardens/${garden.id}/stream?token=${ownerToken}`;

    const req = http.get(streamUrl);
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timed out waiting for SSE TCP headers')), 2000);
        req.on('response', (res) => {
          assert.strictEqual(res.statusCode, 200);
          res.once('data', () => {
            clearTimeout(timer);
            resolve();
          });
        });
        req.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      assert.strictEqual(eventBus.listenerCount(garden.id), 1);

      req.destroy();

      const deadline = Date.now() + 500;
      while (eventBus.listenerCount(garden.id) > 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 10));
      }

      assert.strictEqual(
        eventBus.listenerCount(garden.id),
        0,
        'eventBus listener must be removed within 500ms after real-TCP SSE disconnect'
      );
    } finally {
      if (!req.destroyed) req.destroy();
    }
  });
});
