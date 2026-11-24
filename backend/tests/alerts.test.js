const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const net = require('node:net');
const bcrypt = require('bcryptjs');
const { buildServer } = require('../server');
const { connectDb } = require('../config/database');
const { runMigrations } = require('../scripts/migrate');
const { runSeed } = require('../scripts/seed');
const { User, Garden, GardenMember, Zone, PlantCatalog, ZonePlant, AlertConfig, AlertLog } = require('../models');
const alertService = require('../services/alertService');
const emailService = require('../services/emailService');
const eventBus = require('../services/eventBus');

describe('Sprint 2 F9: Smart Threshold Alerts & Quiet Hours Suite', () => {
  let app;
  let ownerUser, familyUser, guestUser;
  let ownerToken, familyToken, guestToken;
  let gardenLA, zoneWithCatalog, zoneWithConfig;

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
    await runSeed();
    app = buildServer();

    ({ user: ownerUser, token: ownerToken } = await createUserAndLogin('Alert Owner', 'alert_owner@test.com'));
    ({ user: familyUser, token: familyToken } = await createUserAndLogin('Alert Family', 'alert_family@test.com'));
    ({ user: guestUser, token: guestToken } = await createUserAndLogin('Alert Guest', 'alert_guest@test.com'));

    gardenLA = await Garden.create({
      owner_id: ownerUser.id,
      name: 'Quiet Hours Garden',
      timezone: 'America/Los_Angeles',
      area_sq_m: 35
    });
    await GardenMember.create({ garden_id: gardenLA.id, user_id: ownerUser.id, role: 'OWNER' });
    await GardenMember.create({ garden_id: gardenLA.id, user_id: familyUser.id, role: 'FAMILY' });
    await GardenMember.create({ garden_id: gardenLA.id, user_id: guestUser.id, role: 'GUEST' });

    zoneWithCatalog = await Zone.create({ garden_id: gardenLA.id, name: 'Tomato Bed', is_outdoor: true, area_sq_m: 10 });
    zoneWithConfig = await Zone.create({ garden_id: gardenLA.id, name: 'Custom Alert Bed', is_outdoor: false, area_sq_m: 8 });

    const tomato = await PlantCatalog.findOne({ where: { scientific_name: 'Solanum lycopersicum' } });
    await ZonePlant.create({
      zone_id: zoneWithCatalog.id,
      plant_catalog_id: tomato.id,
      quantity: 2,
      planted_date: '2026-10-01',
      status: 'GROWING',
      health_status: 'HEALTHY'
    });
  });

  after(async () => {
    if (app) await app.close();
  });

  test('PUT /api/zones/:zoneId/alerts/config is OWNER-only (FAMILY/GUEST get 403) and validates bounds', async () => {
    const famRes = await app.inject({
      method: 'PUT',
      url: `/api/zones/${zoneWithConfig.id}/alerts/config`,
      headers: { authorization: `Bearer ${familyToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ metric: 'SOIL_MOISTURE', min_threshold: 30, max_threshold: 80 })
    });
    assert.strictEqual(famRes.statusCode, 403);

    const guestRes = await app.inject({
      method: 'PUT',
      url: `/api/zones/${zoneWithConfig.id}/alerts/config`,
      headers: { authorization: `Bearer ${guestToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ metric: 'SOIL_MOISTURE', min_threshold: 30, max_threshold: 80 })
    });
    assert.strictEqual(guestRes.statusCode, 403);

    const invalidBounds = await app.inject({
      method: 'PUT',
      url: `/api/zones/${zoneWithConfig.id}/alerts/config`,
      headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ metric: 'SOIL_MOISTURE', min_threshold: 85, max_threshold: 30 })
    });
    assert.strictEqual(invalidBounds.statusCode, 400);

    const okRes = await app.inject({
      method: 'PUT',
      url: `/api/zones/${zoneWithConfig.id}/alerts/config`,
      headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({
        metric: 'SOIL_MOISTURE',
        min_threshold: 35,
        max_threshold: 85,
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00',
        cooldown_minutes: 60
      })
    });
    assert.strictEqual(okRes.statusCode, 200);
    assert.strictEqual(okRes.json().data.config.min_threshold, 35);
    assert.strictEqual(okRes.json().data.config.quiet_hours_start, '22:00:00');

    // Partial PUT validation against existing stored bounds
    const partialInvalidMin = await app.inject({
      method: 'PUT',
      url: `/api/zones/${zoneWithConfig.id}/alerts/config`,
      headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ metric: 'SOIL_MOISTURE', min_threshold: 90 })
    });
    assert.strictEqual(partialInvalidMin.statusCode, 400);
    assert.strictEqual(partialInvalidMin.json().error.code, 'INVALID_THRESHOLDS');

    const partialInvalidMax = await app.inject({
      method: 'PUT',
      url: `/api/zones/${zoneWithConfig.id}/alerts/config`,
      headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ metric: 'SOIL_MOISTURE', max_threshold: 30 })
    });
    assert.strictEqual(partialInvalidMax.statusCode, 400);
    assert.strictEqual(partialInvalidMax.json().error.code, 'INVALID_THRESHOLDS');
  });

  test('Midnight-crossing quiet hours in garden.timezone suppresses notifications & emails while logging AlertLog', async () => {
    const events = [];
    const unsub = eventBus.subscribeGarden(gardenLA.id, (f) => events.push(f));

    // 2026-11-24T07:30:00Z = 2026-11-23 23:30:00 America/Los_Angeles (inside 22:00 -> 07:00 quiet hours)
    const quietNow = new Date('2026-11-24T07:30:00.000Z');
    const quietAlerts = await alertService.evaluateReading(
      zoneWithConfig,
      { soil_moisture: 20, temperature: 22, humidity: 60, light_lux: 500 },
      { now: quietNow, garden: gardenLA }
    );
    assert.strictEqual(quietAlerts.length, 1);
    assert.strictEqual(quietAlerts[0].is_suppressed, true);
    assert.strictEqual(quietAlerts[0].email_sent, false);
    assert.strictEqual(events.length, 0, 'Quiet hours must suppress ALERT_TRIGGERED WS/SSE broadcast');

    // Cooldown guard: another breach 10 minutes later is ignored
    const cooldownAlerts = await alertService.evaluateReading(
      zoneWithConfig,
      { soil_moisture: 18, temperature: 22, humidity: 60, light_lux: 500 },
      { now: new Date(quietNow.getTime() + 10 * 60000), garden: gardenLA }
    );
    assert.strictEqual(cooldownAlerts.length, 0, 'Cooldown must block duplicate alert within 60 minutes');

    // Outside quiet hours & past cooldown: 2026-11-24T20:00:00Z = 12:00:00 America/Los_Angeles
    const activeNow = new Date('2026-11-24T20:00:00.000Z');
    const activeAlerts = await alertService.evaluateReading(
      zoneWithConfig,
      { soil_moisture: 20, temperature: 22, humidity: 60, light_lux: 500 },
      { now: activeNow, garden: gardenLA }
    );
    unsub();

    assert.strictEqual(activeAlerts.length, 1);
    assert.strictEqual(activeAlerts[0].is_suppressed, false);
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].event, 'ALERT_TRIGGERED');
  });

  test('Catalog fallback defaults evaluate readings when no AlertConfig exists, unless explicitly disabled', async () => {
    const cfgRes = await app.inject({
      method: 'GET',
      url: `/api/zones/${zoneWithCatalog.id}/alerts/config`,
      headers: { authorization: `Bearer ${ownerToken}` }
    });
    assert.strictEqual(cfgRes.statusCode, 200);
    assert.ok(cfgRes.json().data.catalog_defaults.SOIL_MOISTURE.min_threshold > 0);

    // Reading way below Tomato moisture minimum triggers fallback alert
    const triggered = await alertService.evaluateReading(
      zoneWithCatalog,
      { soil_moisture: 12, temperature: 22, humidity: 55, light_lux: 15000 },
      { now: new Date('2026-11-24T19:00:00.000Z'), garden: gardenLA }
    );
    assert.strictEqual(triggered.length, 1);
    assert.strictEqual(triggered[0].metric, 'SOIL_MOISTURE');
    assert.strictEqual(triggered[0].severity, 'CRITICAL');

    // Disable config explicitly -> fallback must NOT trigger
    await AlertConfig.create({
      zone_id: zoneWithCatalog.id,
      metric: 'SOIL_MOISTURE',
      min_threshold: 50,
      max_threshold: 80,
      is_active: false
    });
    const skipped = await alertService.evaluateReading(
      zoneWithCatalog,
      { soil_moisture: 5, temperature: 22, humidity: 55, light_lux: 15000 },
      { now: new Date('2026-11-24T23:00:00.000Z'), garden: gardenLA }
    );
    assert.strictEqual(skipped.length, 0);
  });

  test('Garden alert feed unread_count, PATCH read, and POST read-all work cleanly', async () => {
    const feedRes = await app.inject({
      method: 'GET',
      url: `/api/gardens/${gardenLA.id}/alerts`,
      headers: { authorization: `Bearer ${guestToken}` }
    });
    assert.strictEqual(feedRes.statusCode, 200);
    const feed = feedRes.json().data;
    assert.ok(feed.alerts.length >= 3);
    assert.strictEqual(feed.unread_count, feed.alerts.length);

    const firstId = feed.alerts[0].id;
    const readOneRes = await app.inject({
      method: 'PATCH',
      url: `/api/alerts/${firstId}/read`,
      headers: { authorization: `Bearer ${guestToken}` }
    });
    assert.strictEqual(readOneRes.statusCode, 200);
    assert.strictEqual(readOneRes.json().data.alert.is_read, true);

    const readAllRes = await app.inject({
      method: 'POST',
      url: `/api/gardens/${gardenLA.id}/alerts/read-all`,
      headers: { authorization: `Bearer ${familyToken}` }
    });
    assert.strictEqual(readAllRes.statusCode, 200);
    assert.ok(readAllRes.json().data.updated_count >= 2);

    const afterFeed = await app.inject({
      method: 'GET',
      url: `/api/gardens/${gardenLA.id}/alerts?is_read=false`,
      headers: { authorization: `Bearer ${ownerToken}` }
    });
    assert.strictEqual(afterFeed.json().data.unread_count, 0);
    assert.strictEqual(afterFeed.json().data.alerts.length, 0);
  });

  test('emailService delivers over SMTP when SMTP_HOST and SMTP_PORT are set without SMTP_USER', async () => {
    const receivedData = [];
    const server = net.createServer((socket) => {
      let inData = false;
      let buf = '';
      let msgBuf = '';
      socket.write('220 localhost ESMTP mock\r\n');
      socket.on('data', (chunk) => {
        buf += chunk.toString('utf8');
        while (true) {
          const idx = buf.indexOf('\r\n');
          if (idx === -1) break;
          const line = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          if (inData) {
            if (line === '.') {
              inData = false;
              receivedData.push(msgBuf);
              msgBuf = '';
              socket.write('250 2.0.0 Ok\r\n');
            } else {
              msgBuf += `${line}\r\n`;
            }
          } else {
            const upper = line.toUpperCase();
            if (upper.startsWith('EHLO') || upper.startsWith('HELO')) {
              socket.write('250-localhost\r\n250 OK\r\n');
            } else if (upper.startsWith('MAIL FROM') || upper.startsWith('RCPT TO')) {
              socket.write('250 OK\r\n');
            } else if (upper === 'DATA') {
              inData = true;
              socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
            } else if (upper === 'QUIT') {
              socket.write('221 Bye\r\n');
              socket.end();
            } else {
              socket.write('250 OK\r\n');
            }
          }
        }
      });
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    const prevHost = process.env.SMTP_HOST;
    const prevPort = process.env.SMTP_PORT;
    const prevUser = process.env.SMTP_USER;
    const prevPass = process.env.SMTP_PASS;
    const prevSecure = process.env.SMTP_SECURE;

    try {
      emailService.closeTransporter();
      process.env.SMTP_HOST = '127.0.0.1';
      process.env.SMTP_PORT = String(port);
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      process.env.SMTP_SECURE = 'false';

      const res = await emailService.sendAlertEmail({
        to: 'alert_owner@test.com',
        subject: 'Unauth SMTP test',
        text: 'Soil moisture low'
      });

      assert.strictEqual(res.delivered, true);
      assert.strictEqual(res.mode, 'smtp');
      assert.strictEqual(receivedData.length, 1);
      assert.ok(receivedData[0].includes('Subject: Unauth SMTP test'));
    } finally {
      emailService.closeTransporter();
      if (prevHost === undefined) delete process.env.SMTP_HOST; else process.env.SMTP_HOST = prevHost;
      if (prevPort === undefined) delete process.env.SMTP_PORT; else process.env.SMTP_PORT = prevPort;
      if (prevUser === undefined) delete process.env.SMTP_USER; else process.env.SMTP_USER = prevUser;
      if (prevPass === undefined) delete process.env.SMTP_PASS; else process.env.SMTP_PASS = prevPass;
      if (prevSecure === undefined) delete process.env.SMTP_SECURE; else process.env.SMTP_SECURE = prevSecure;
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
