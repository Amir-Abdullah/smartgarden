process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const { buildServer } = require('../server');
const dbConfig = require('../config/database');
const { runMigrations } = require('../scripts/migrate');
const { runSeed } = require('../scripts/seed');
const {
  User,
  Garden,
  GardenMember,
  Zone,
  PlantCatalog,
  Device,
  WaterUsageLog,
  Notification,
  SensorReading
} = require('../models');
const notificationService = require('../services/notificationService');
const mqttBridge = require('../services/mqttBridge');
const { resetIpRateLimits } = require('../middleware/rateLimit');

describe('Sprint 5 Backend F21-F24 Suite (Notifications, Sustainability, Seed Vault, Developer API, Security & MQTT)', () => {
  let app;
  let ownerUser;
  let guestUser;
  let ownerToken;
  let guestToken;
  let garden;
  let zone;
  let tomatoSpecies;

  before(async () => {
    await dbConfig.connectDb();
    await runMigrations();
    await runSeed();

    app = buildServer();
    await app.ready();

    const hash = await bcrypt.hash('Sprint5Pass123!', 4);
    ownerUser = await User.create({
      name: 'Sprint5 Owner',
      email: 's5-owner@test.com',
      password_hash: hash,
      location_region: 'Zone 8b',
      is_admin: false
    });
    guestUser = await User.create({
      name: 'Sprint5 Guest',
      email: 's5-guest@test.com',
      password_hash: hash,
      is_admin: false
    });

    ownerToken = app.jwt.sign({ id: ownerUser.id, email: ownerUser.email, is_admin: false });
    guestToken = app.jwt.sign({ id: guestUser.id, email: guestUser.email, is_admin: false });

    garden = await Garden.create({
      owner_id: ownerUser.id,
      name: 'Sprint5 Pollinator Plot',
      location_address: '99 Bloom St, Eugene, OR',
      timezone: 'America/Los_Angeles',
      area_sq_m: 40
    });
    await GardenMember.create({ garden_id: garden.id, user_id: ownerUser.id, role: 'OWNER' });
    await GardenMember.create({ garden_id: garden.id, user_id: guestUser.id, role: 'GUEST' });

    zone = await Zone.create({
      garden_id: garden.id,
      name: 'Rain-Fed Bed',
      zone_type: 'RAISED_BED',
      sunlight_level: 'FULL_SUN',
      soil_type: 'LOAM',
      is_outdoor: true,
      area_sq_m: 10
    });

    tomatoSpecies = await PlantCatalog.findOne({ where: { scientific_name: 'Solanum lycopersicum' } });

    await WaterUsageLog.create({
      zone_id: zone.id,
      logged_by_user_id: ownerUser.id,
      liters_applied: 30,
      method: 'DRIP_IRRIGATION',
      recorded_at: new Date(),
      notes: 'Efficient drip cycle'
    });
  });

  after(async () => {
    notificationService.setWebhookFetcher(null);
    delete process.env.ENFORCE_RATE_LIMIT_IN_TEST;
    delete process.env.RATE_LIMIT_MAX;
    resetIpRateLimits();
    if (app) await app.close();
    if (dbConfig && dbConfig.sequelize) await dbConfig.sequelize.close();
  });

  it('F21: Manages notification inbox, SSRF-blocks unsafe webhook URLs, signs test webhooks & persists profile updates', async () => {
    await Notification.create({
      user_id: ownerUser.id,
      channel: 'IN_APP',
      category: 'SYSTEM',
      title: 'Test Alert Inbox Item',
      message: 'Welcome to Sprint 5 notifications',
      is_read: false
    });

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(listRes.statusCode, 200);
    assert.equal(listRes.json().data.unread_count, 1);

    // Reject SSRF targets
    for (const badUrl of [
      'http://hooks.example.com/hook',
      'https://127.0.0.1/steal',
      'https://169.254.169.254/latest/meta-data',
      'https://localhost/internal',
      'https://10.0.0.1/admin',
      'https://192.168.1.10/api'
    ]) {
      const badRes = await app.inject({
        method: 'PUT',
        url: '/api/notifications/preferences',
        headers: { Authorization: `Bearer ${ownerToken}` },
        payload: { webhook_url: badUrl }
      });
      assert.equal(badRes.statusCode, 400, `Expected 400 SSRF_BLOCKED_URL for ${badUrl}`);
      assert.equal(badRes.json().error.code, 'SSRF_BLOCKED_URL');
    }

    // Save valid HTTPS webhook + test HMAC dispatch
    let capturedHeaders = null;
    notificationService.setWebhookFetcher(async (_url, opts) => {
      capturedHeaders = opts.headers;
      return { ok: true, status: 202 };
    });

    const putPref = await app.inject({
      method: 'PUT',
      url: '/api/notifications/preferences',
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: {
        email_digest_freq: 'DAILY',
        webhook_url: 'https://hooks.slack.com/services/T000/B000/XXX',
        webhook_secret: 'my-secret-signing-key'
      }
    });
    assert.equal(putPref.statusCode, 200);
    assert.equal(putPref.json().data.email_digest_freq, 'DAILY');

    const hookRes = await app.inject({
      method: 'POST',
      url: '/api/notifications/test-webhook',
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(hookRes.statusCode, 200);
    assert.equal(hookRes.json().data.delivered, true);
    assert.ok(capturedHeaders['X-SmartGarden-Signature'].startsWith('sha256='));

    const readAllRes = await app.inject({
      method: 'POST',
      url: '/api/notifications/read-all',
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(readAllRes.statusCode, 200);

    // PUT /api/auth/me updates name & region cleanly
    const profileRes = await app.inject({
      method: 'PUT',
      url: '/api/auth/me',
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Sprint5 Updated Grower', location_region: 'US-Zone-9a' }
    });
    assert.equal(profileRes.statusCode, 200);
    assert.equal(profileRes.json().data.user.name, 'Sprint5 Updated Grower');
    assert.equal(profileRes.json().data.user.location_region, 'US-Zone-9a');
  });

  it('F22: Computes garden water/CO2 sustainability metrics, creates & deletes logs with RBAC check', async () => {
    const guestDeny = await app.inject({
      method: 'POST',
      url: `/api/gardens/${garden.id}/sustainability/logs`,
      headers: { Authorization: `Bearer ${guestToken}` },
      payload: { log_type: 'RAINWATER_HARVEST', quantity: 100 }
    });
    assert.equal(guestDeny.statusCode, 403);

    const addRain = await app.inject({
      method: 'POST',
      url: `/api/gardens/${garden.id}/sustainability/logs`,
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: {
        log_type: 'RAINWATER_HARVEST',
        quantity: 150,
        notes: 'Barrel capture from storm'
      }
    });
    assert.equal(addRain.statusCode, 201);
    const createdLog = addRain.json().data;

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/gardens/${garden.id}/sustainability`,
      headers: { Authorization: `Bearer ${guestToken}` }
    });
    assert.equal(getRes.statusCode, 200);
    const data = getRes.json().data;
    assert.equal(data.scorecard.rainwater_harvested_l, 150);
    assert.equal(data.scorecard.drip_savings_l, 20);
    assert.equal(data.scorecard.total_water_saved_l, 170);
    assert.ok(['A+', 'A', 'B', 'C', 'D'].includes(data.scorecard.grade));

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/gardens/${garden.id}/sustainability/logs/${createdLog.id}`,
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(delRes.statusCode, 200);
  });

  it('F23: Seed Vault tracks packet viability and allocates seeds directly into ZonePlant inventory', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/seeds',
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: {
        variety_name: 'Brandywine Pink Tomato',
        plant_catalog_id: tomatoSpecies.id,
        lot_number: 'LOT-BW-26',
        seeds_remaining: 10,
        germination_rate_pct: 91,
        expiry_date: '2028-05-01'
      }
    });
    assert.equal(createRes.statusCode, 201);
    const packet = createRes.json().data;
    assert.equal(packet.viability_status, 'FRESH');

    // Over-allocating seeds triggers 400 INSUFFICIENT_SEEDS
    const tooManyRes = await app.inject({
      method: 'POST',
      url: `/api/seeds/${packet.id}/allocate`,
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: { zone_id: zone.id, quantity: 1, seeds_used: 25 }
    });
    assert.equal(tooManyRes.statusCode, 400);
    assert.equal(tooManyRes.json().error.code, 'INSUFFICIENT_SEEDS');

    // Valid sow allocation creates ZonePlant and decrements seeds_remaining
    const allocRes = await app.inject({
      method: 'POST',
      url: `/api/seeds/${packet.id}/allocate`,
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: { zone_id: zone.id, quantity: 2, seeds_used: 6, custom_nickname: 'Brandywine Sow #1' }
    });
    assert.equal(allocRes.statusCode, 201);
    const allocData = allocRes.json().data;
    assert.equal(allocData.seed_packet.seeds_remaining, 4);
    assert.equal(allocData.seed_packet.viability_status, 'LOW_STOCK');
    assert.equal(allocData.zone_plant.zone_id, zone.id);
    assert.equal(allocData.zone_plant.status, 'SEEDLING');
  });

  it('F24: Creates & authenticates sg_pat_ keys, revokes keys, and serves opt-in public showcase profiles without PII', async () => {
    // 1. Create scoped API key
    const keyRes = await app.inject({
      method: 'POST',
      url: '/api/developer/keys',
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Home Assistant Script', scopes: ['gardens:read', 'sensors:read'] }
    });
    assert.equal(keyRes.statusCode, 201);
    const keyData = keyRes.json().data;
    assert.ok(keyData.token.startsWith('sg_pat_'));

    // 2. Authenticate standard REST endpoint using sg_pat_ token
    const patGardensRes = await app.inject({
      method: 'GET',
      url: '/api/gardens',
      headers: { Authorization: `Bearer ${keyData.token}` }
    });
    assert.equal(patGardensRes.statusCode, 200);
    assert.ok(patGardensRes.json().data.gardens.some((g) => g.id === garden.id));

    // 3. Revoke API key -> rejects with 401
    const revokeRes = await app.inject({
      method: 'DELETE',
      url: `/api/developer/keys/${keyData.id}`,
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(revokeRes.statusCode, 200);

    const revokedAttempt = await app.inject({
      method: 'GET',
      url: '/api/gardens',
      headers: { Authorization: `Bearer ${keyData.token}` }
    });
    assert.equal(revokedAttempt.statusCode, 401);

    // 4. Opt-in Public Profile hidden until is_public=true, no email leaked
    const privateRes = await app.inject({
      method: 'GET',
      url: '/api/public/growers/s5-pollinator-guru'
    });
    assert.equal(privateRes.statusCode, 404);

    const pubUpdate = await app.inject({
      method: 'PUT',
      url: '/api/developer/public-profile',
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: {
        handle: 's5-pollinator-guru',
        is_public: true,
        bio: 'Raised bed tomato and pollinator specialist',
        featured_garden_id: garden.id
      }
    });
    assert.equal(pubUpdate.statusCode, 200);

    const publicRes = await app.inject({
      method: 'GET',
      url: '/api/public/growers/s5-pollinator-guru'
    });
    assert.equal(publicRes.statusCode, 200);
    const showcase = publicRes.json().data;
    assert.equal(showcase.profile.handle, 's5-pollinator-guru');
    assert.equal(showcase.profile.email, undefined);
    assert.equal(showcase.featured_garden.name, 'Sprint5 Pollinator Plot');
  });

  it('Security Hardening & MQTT Bridge: injects security headers, enforces rate limit 429, and ingests MQTT telemetry', async () => {
    // 1. Security headers check
    const healthRes = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(healthRes.statusCode, 200);
    assert.equal(healthRes.headers['x-content-type-options'], 'nosniff');
    assert.equal(healthRes.headers['x-frame-options'], 'DENY');

    // 2. MQTT bridge authentication & SensorReading creation
    const rawDeviceKey = 'sg_live_mqtt_test_key_1234567890';
    const keyHash = crypto.createHash('sha256').update(rawDeviceKey).digest('hex');
    const mqttDevice = await Device.create({
      zone_id: zone.id,
      device_name: 'MQTT Node 1',
      device_uid: 'SG-MQTT-001',
      key_prefix: rawDeviceKey.slice(0, 16),
      key_hash: keyHash,
      is_active: true
    });

    await mqttBridge.handleMqttMessage(
      'smartgarden/SG-MQTT-001/telemetry',
      JSON.stringify({
        device_key: rawDeviceKey,
        soil_moisture: 58.2,
        temperature: 23.1,
        humidity: 61.0,
        light_lux: 24500
      })
    );
    const storedCount = await SensorReading.count({ where: { device_id: mqttDevice.id } });
    assert.equal(storedCount, 1);

    // 3. Rate-limit 429 verification
    process.env.ENFORCE_RATE_LIMIT_IN_TEST = 'true';
    process.env.RATE_LIMIT_MAX = '2';
    resetIpRateLimits();
    try {
      const a1 = await app.inject({ method: 'GET', url: '/health' });
      const a2 = await app.inject({ method: 'GET', url: '/health' });
      const a3 = await app.inject({ method: 'GET', url: '/health' });
      assert.equal(a1.statusCode, 200);
      assert.equal(a2.statusCode, 200);
      assert.equal(a3.statusCode, 429);
      assert.equal(a3.json().error.code, 'RATE_LIMIT_EXCEEDED');
    } finally {
      delete process.env.ENFORCE_RATE_LIMIT_IN_TEST;
      delete process.env.RATE_LIMIT_MAX;
      resetIpRateLimits();
    }
  });
});
