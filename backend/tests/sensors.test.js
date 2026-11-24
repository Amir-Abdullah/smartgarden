const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const bcrypt = require('bcryptjs');
const { buildServer } = require('../server');
const { connectDb } = require('../config/database');
const { runMigrations } = require('../scripts/migrate');
const { User, Garden, GardenMember, Zone, Device, SensorAggregateDaily, DeviceWatchdogAlert } = require('../models');
const { resetRateLimits } = require('../routes/sensors');
const { runDeviceWatchdog } = require('../jobs/scheduler');
const { generateTelemetry } = require('../simulator/sensorSimulator');

describe('Sprint 2 F7: Device Keys, Telemetry Ingest, Simulator & Watchdog Suite', () => {
  let app;
  let ownerUser, familyUser, outsiderUser;
  let ownerToken, familyToken, outsiderToken;
  let garden, zone;
  let deviceId, rawApiKey;

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

    ({ user: ownerUser, token: ownerToken } = await createUserAndLogin('Sensor Owner', 'sensor_owner@test.com'));
    ({ user: familyUser, token: familyToken } = await createUserAndLogin('Sensor Family', 'sensor_family@test.com'));
    ({ user: outsiderUser, token: outsiderToken } = await createUserAndLogin('Sensor Outsider', 'sensor_outsider@test.com'));

    garden = await Garden.create({ owner_id: ownerUser.id, name: 'Sensor Garden', timezone: 'UTC', area_sq_m: 40 });
    await GardenMember.create({ garden_id: garden.id, user_id: ownerUser.id, role: 'OWNER' });
    await GardenMember.create({ garden_id: garden.id, user_id: familyUser.id, role: 'FAMILY' });

    zone = await Zone.create({ garden_id: garden.id, name: 'Telemetry Bed', is_outdoor: true, area_sq_m: 12 });
  });

  after(async () => {
    resetRateLimits();
    if (app) await app.close();
  });

  test('Device registration returns sg_live_ key once, strips key_hash in GET devices & GET zone', async () => {
    const famRes = await app.inject({
      method: 'POST',
      url: `/api/zones/${zone.id}/devices`,
      headers: { authorization: `Bearer ${familyToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ device_name: 'Forbidden Node' })
    });
    assert.strictEqual(famRes.statusCode, 403);

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/zones/${zone.id}/devices`,
      headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ device_name: 'Bed Sensor Alpha', device_type: 'ESP32_WROOM' })
    });
    assert.strictEqual(createRes.statusCode, 201);
    const data = createRes.json().data;
    assert.ok(data.api_key.startsWith('sg_live_'));
    assert.strictEqual(data.device.key_hash, undefined);
    deviceId = data.device.id;
    rawApiKey = data.api_key;

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/zones/${zone.id}/devices`,
      headers: { authorization: `Bearer ${familyToken}` }
    });
    assert.strictEqual(listRes.statusCode, 200);
    assert.strictEqual(listRes.json().data.devices.length, 1);
    assert.strictEqual(listRes.json().data.devices[0].key_hash, undefined);

    const zoneDetailRes = await app.inject({
      method: 'GET',
      url: `/api/zones/${zone.id}`,
      headers: { authorization: `Bearer ${familyToken}` }
    });
    assert.strictEqual(zoneDetailRes.statusCode, 200);
    assert.strictEqual(zoneDetailRes.json().data.active_devices.length, 1);
    assert.strictEqual(zoneDetailRes.json().data.active_devices[0].key_hash, undefined);
  });

  test('Ingest authenticates timing-safe X-Device-Key, accepts hardware & flat payloads, normalizes clock skew', async () => {
    // Wrong suffix with matching prefix -> 401
    const badSuffix = `${rawApiKey.slice(0, 16)}${'0'.repeat(40)}`;
    const badAuthRes = await app.inject({
      method: 'POST',
      url: '/api/sensors/ingest',
      headers: { 'x-device-key': badSuffix, 'content-type': 'application/json' },
      payload: JSON.stringify({ soilMoisture: 55, temperature: 22, humidity: 60, lightLux: 1200 })
    });
    assert.strictEqual(badAuthRes.statusCode, 401);

    // Hardware nested payload with valid epoch-seconds (< 1e12) near now
    const recentSec = Math.floor(Date.now() / 1000) - 30;
    const hwRes = await app.inject({
      method: 'POST',
      url: '/api/sensors/ingest',
      headers: { 'x-device-key': rawApiKey, 'content-type': 'application/json' },
      payload: JSON.stringify({
        timestamp: recentSec,
        firmwareVersion: 'v1.5.0',
        metrics: {
          soilMoisture: 52.5,
          temperature: 23.1,
          humidity: 58.0,
          lightLux: 18500,
          batteryPercent: 93,
          signalRssi: -64
        }
      })
    });
    assert.strictEqual(hwRes.statusCode, 201);
    const hwData = hwRes.json().data;
    assert.strictEqual(hwData.status, 'PROCESSED');
    assert.strictEqual(hwData.clock_skew_corrected, false);
    assert.strictEqual(Math.floor(Date.parse(hwData.recorded_at) / 1000), recentSec);

    // Flat payload with huge clock skew (year 2000) -> overridden to server time
    const skewRes = await app.inject({
      method: 'POST',
      url: '/sensors/ingest',
      headers: { 'x-device-key': rawApiKey, 'content-type': 'application/json' },
      payload: JSON.stringify({
        timestamp: 946684800,
        soilMoisture: 53.0,
        temperature: 23.5,
        humidity: 59.0,
        lightLux: 19000
      })
    });
    assert.strictEqual(skewRes.statusCode, 201);
    assert.strictEqual(skewRes.json().data.clock_skew_corrected, true);
    assert.ok(Date.now() - Date.parse(skewRes.json().data.recorded_at) < 10000);
  });

  test('Ingest enforces strict HTTP 400 physical bounds without clamping', async () => {
    const invalidPayloads = [
      { soilMoisture: 101, temperature: 22, humidity: 50, lightLux: 500 },
      { soilMoisture: 50, temperature: -50, humidity: 50, lightLux: 500 },
      { soilMoisture: 50, temperature: 22, humidity: -5, lightLux: 500 },
      { soilMoisture: 50, temperature: 22, humidity: 50, lightLux: 130000 },
      { soilMoisture: 50, temperature: 22, humidity: 50, lightLux: 500, batteryPercent: 105 },
      { soilMoisture: 50, temperature: 22, humidity: 50, lightLux: 500, signalRssi: 5 }
    ];

    for (const payload of invalidPayloads) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sensors/ingest',
        headers: { 'x-device-key': rawApiKey, 'content-type': 'application/json' },
        payload: JSON.stringify(payload)
      });
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.json().error.code, 'METRIC_OUT_OF_RANGE');
    }
  });

  test('Per-device 60/min rate limit rejects 61st request with HTTP 429', async () => {
    resetRateLimits();
    for (let i = 0; i < 60; i++) {
      const okRes = await app.inject({
        method: 'POST',
        url: '/api/sensors/ingest',
        headers: { 'x-device-key': rawApiKey, 'content-type': 'application/json' },
        payload: JSON.stringify({ soilMoisture: 50, temperature: 22, humidity: 55, lightLux: 1000 })
      });
      assert.strictEqual(okRes.statusCode, 201);
    }

    const limitedRes = await app.inject({
      method: 'POST',
      url: '/api/sensors/ingest',
      headers: { 'x-device-key': rawApiKey, 'content-type': 'application/json' },
      payload: JSON.stringify({ soilMoisture: 50, temperature: 22, humidity: 55, lightLux: 1000 })
    });
    assert.strictEqual(limitedRes.statusCode, 429);
    assert.strictEqual(limitedRes.json().error.code, 'RATE_LIMIT_EXCEEDED');
    resetRateLimits();
  });

  test('Readings, daily stats, key rotation, revocation & claim endpoints work with RBAC', async () => {
    await SensorAggregateDaily.create({
      zone_id: zone.id,
      device_id: deviceId,
      aggregate_date: new Date().toISOString().slice(0, 10),
      min_soil_moisture: 50,
      max_soil_moisture: 55,
      avg_soil_moisture: 52,
      min_temperature: 22,
      max_temperature: 24,
      avg_temperature: 23,
      min_humidity: 55,
      max_humidity: 60,
      avg_humidity: 58,
      peak_light_lux: 19000,
      avg_light_lux: 10000,
      sample_count: 62
    });

    const readRes = await app.inject({
      method: 'GET',
      url: `/api/zones/${zone.id}/readings?hours=24&limit=10`,
      headers: { authorization: `Bearer ${ownerToken}` }
    });
    assert.strictEqual(readRes.statusCode, 200);
    assert.strictEqual(readRes.json().data.readings.length, 10);

    const statsRes = await app.inject({
      method: 'GET',
      url: `/api/zones/${zone.id}/stats/daily?days=7`,
      headers: { authorization: `Bearer ${ownerToken}` }
    });
    assert.strictEqual(statsRes.statusCode, 200);
    assert.strictEqual(statsRes.json().data.stats.length, 1);

    // Rotate key -> old key rejected, new key accepted
    const rotRes = await app.inject({
      method: 'POST',
      url: `/api/devices/${deviceId}/rotate-key`,
      headers: { authorization: `Bearer ${ownerToken}` }
    });
    assert.strictEqual(rotRes.statusCode, 200);
    const rotatedKey = rotRes.json().data.api_key;
    assert.notStrictEqual(rotatedKey, rawApiKey);

    const oldKeyRes = await app.inject({
      method: 'POST',
      url: '/api/sensors/ingest',
      headers: { 'x-device-key': rawApiKey, 'content-type': 'application/json' },
      payload: JSON.stringify({ soilMoisture: 50, temperature: 22, humidity: 55, lightLux: 1000 })
    });
    assert.strictEqual(oldKeyRes.statusCode, 401);

    // Revoke device -> new key rejected
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/devices/${deviceId}`,
      headers: { authorization: `Bearer ${ownerToken}` }
    });
    assert.strictEqual(delRes.statusCode, 200);

    const revokedRes = await app.inject({
      method: 'POST',
      url: '/api/sensors/ingest',
      headers: { 'x-device-key': rotatedKey, 'content-type': 'application/json' },
      payload: JSON.stringify({ soilMoisture: 50, temperature: 22, humidity: 55, lightLux: 1000 })
    });
    assert.strictEqual(revokedRes.statusCode, 401);

    // Device claim RBAC & 409 conflict
    const outsiderClaim = await app.inject({
      method: 'POST',
      url: '/api/devices/claim',
      headers: { authorization: `Bearer ${outsiderToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ deviceUid: 'SG-CLAIM-001', pin: '4829', zoneId: zone.id, name: 'Claimed Node' })
    });
    assert.strictEqual(outsiderClaim.statusCode, 403);

    const claimOk = await app.inject({
      method: 'POST',
      url: '/api/devices/claim',
      headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ deviceUid: 'SG-CLAIM-001', pin: '4829', zoneId: zone.id, name: 'Claimed Node' })
    });
    assert.strictEqual(claimOk.statusCode, 201);
    assert.ok(claimOk.json().data.api_key.startsWith('sg_live_'));

    const claimDup = await app.inject({
      method: 'POST',
      url: '/api/devices/claim',
      headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ deviceUid: 'SG-CLAIM-001', pin: '4829', zoneId: zone.id, name: 'Dup Node' })
    });
    assert.strictEqual(claimDup.statusCode, 409);
  });

  test('Simulator diurnal curves + irrigation pulse and 30m offline watchdog deduplication', async () => {
    const state = { soilMoisture: 14.0, batteryPercent: 90 };
    const simPayload = generateTelemetry(state, new Date('2026-11-24T12:00:00Z'));
    assert.strictEqual(simPayload.metrics.soilMoisture, 85, 'Irrigation pulse should reset dry moisture to 85%');
    assert.ok(simPayload.metrics.lightLux > 10000, 'Noon solar light should be high');

    // Create stale device > 3h offline
    const staleDevice = await Device.create({
      zone_id: zone.id,
      device_name: 'Stale Node',
      device_uid: 'SG-STALE-01',
      key_prefix: 'sg_live_stale001',
      key_hash: 'f'.repeat(64),
      device_type: 'ESP32_WROOM',
      is_active: true,
      last_seen_at: new Date(Date.now() - 4 * 3600000)
    });

    const firstRun = await runDeviceWatchdog();
    assert.strictEqual(firstRun.alerts_created, 1);

    const secondRun = await runDeviceWatchdog();
    assert.strictEqual(secondRun.alerts_created, 0, 'Watchdog must deduplicate within 24h');

    const wdAlerts = await DeviceWatchdogAlert.findAll({ where: { device_id: staleDevice.id } });
    assert.strictEqual(wdAlerts.length, 1);
  });

  test('Input hardening: reject boolean telemetry and invalid claim zoneId / whitespace deviceUid with HTTP 400', async () => {
    const devRes = await app.inject({
      method: 'POST',
      url: `/api/zones/${zone.id}/devices`,
      headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ device_name: 'Bool Guard Node' })
    });
    assert.strictEqual(devRes.statusCode, 201);
    const guardKey = devRes.json().data.api_key;

    const boolIngest = await app.inject({
      method: 'POST',
      url: '/api/sensors/ingest',
      headers: { 'x-device-key': guardKey, 'content-type': 'application/json' },
      payload: JSON.stringify({ soilMoisture: false, temperature: 22, humidity: 55, lightLux: 1000 })
    });
    assert.strictEqual(boolIngest.statusCode, 400);
    assert.strictEqual(boolIngest.json().error.code, 'INVALID_TELEMETRY_PAYLOAD');

    const objZoneClaim = await app.inject({
      method: 'POST',
      url: '/api/devices/claim',
      headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ deviceUid: 'SG-CLAIM-OBJ', pin: '4829', zoneId: {} })
    });
    assert.strictEqual(objZoneClaim.statusCode, 400);
    assert.strictEqual(objZoneClaim.json().error.code, 'INVALID_ZONE_ID');

    const blankUidClaim = await app.inject({
      method: 'POST',
      url: '/api/devices/claim',
      headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ deviceUid: '   ', pin: '4829', zoneId: zone.id })
    });
    assert.strictEqual(blankUidClaim.statusCode, 400);
    assert.strictEqual(blankUidClaim.json().error.code, 'MISSING_FIELDS');
  });
});
