const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';
process.env.CRON_SECRET = 'test_cron_secret_at_least_32_chars_long';

const bcrypt = require('bcryptjs');
const { buildServer } = require('../server');
const { connectDb } = require('../config/database');
const { runMigrations } = require('../scripts/migrate');
const { User, Garden, GardenMember, Zone, Device, SensorReading, CareTask, AutomationRule } = require('../models');
const ruleEngineService = require('../services/ruleEngineService');
const dbHelpers = require('../utils/dbHelpers');

describe('Sprint 2 F10: Automation Rule Engine, 3-Layer Dedup & Scheduler Jobs Suite', () => {
  let app;
  let ownerUser, familyUser, guestUser;
  let ownerToken, familyToken, guestToken;
  let gardenNY, zone, device;

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

    ({ user: ownerUser, token: ownerToken } = await createUserAndLogin('Rule Owner', 'rule_owner@test.com'));
    ({ user: familyUser, token: familyToken } = await createUserAndLogin('Rule Family', 'rule_family@test.com'));
    ({ user: guestUser, token: guestToken } = await createUserAndLogin('Rule Guest', 'rule_guest@test.com'));

    gardenNY = await Garden.create({
      owner_id: ownerUser.id,
      name: 'NY Automation Garden',
      timezone: 'America/New_York',
      area_sq_m: 25
    });
    await GardenMember.create({ garden_id: gardenNY.id, user_id: ownerUser.id, role: 'OWNER' });
    await GardenMember.create({ garden_id: gardenNY.id, user_id: familyUser.id, role: 'FAMILY' });
    await GardenMember.create({ garden_id: gardenNY.id, user_id: guestUser.id, role: 'GUEST' });

    zone = await Zone.create({ garden_id: gardenNY.id, name: 'Automated Bed', is_outdoor: true, area_sq_m: 8 });
    device = await Device.create({
      zone_id: zone.id,
      device_name: 'Rule Test Node',
      device_uid: 'SG-RULE-01',
      key_prefix: 'sg_live_rule0001',
      key_hash: 'a'.repeat(64),
      device_type: 'SIMULATOR',
      is_active: true
    });
  });

  after(async () => {
    if (app) await app.close();
  });

  test('RBAC: GET rules allows OWNER & FAMILY, denies GUEST (403); mutations require OWNER', async () => {
    const guestGet = await app.inject({
      method: 'GET',
      url: `/api/zones/${zone.id}/rules`,
      headers: { authorization: `Bearer ${guestToken}` }
    });
    assert.strictEqual(guestGet.statusCode, 403);

    const famGet = await app.inject({
      method: 'GET',
      url: `/api/zones/${zone.id}/rules`,
      headers: { authorization: `Bearer ${familyToken}` }
    });
    assert.strictEqual(famGet.statusCode, 200);

    const famPost = await app.inject({
      method: 'POST',
      url: `/api/zones/${zone.id}/rules`,
      headers: { authorization: `Bearer ${familyToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'Dry Trigger', metric: 'SOIL_MOISTURE', operator: 'LT', threshold_value: 30 })
    });
    assert.strictEqual(famPost.statusCode, 403);

    const ownerPost = await app.inject({
      method: 'POST',
      url: `/api/zones/${zone.id}/rules`,
      headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({
        name: 'Dry Trigger',
        metric: 'SOIL_MOISTURE',
        operator: 'LT',
        threshold_value: 30,
        weather_condition: 'NO_RAIN',
        action_type: 'CREATE_TASK',
        task_type: 'WATER',
        cooldown_minutes: 0,
        max_daily_executions: 1
      })
    });
    assert.strictEqual(ownerPost.statusCode, 201);
    const ruleId = ownerPost.json().data.rule.id;

    const toggleRes = await app.inject({
      method: 'PATCH',
      url: `/api/zones/${zone.id}/rules/${ruleId}/toggle`,
      headers: { authorization: `Bearer ${ownerToken}` }
    });
    assert.strictEqual(toggleRes.statusCode, 200);
    assert.strictEqual(toggleRes.json().data.rule.is_active, false);

    // Re-enable for engine tests
    const putRes = await app.inject({
      method: 'PUT',
      url: `/api/zones/${zone.id}/rules/${ruleId}`,
      headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ is_active: true })
    });
    assert.strictEqual(putRes.statusCode, 200);
    assert.strictEqual(putRes.json().data.rule.is_active, true);
  });

  test('Staleness check skips readings older than RULE_STALENESS_MINUTES (120m)', async () => {
    const now = new Date('2026-11-24T15:00:00.000Z');
    await SensorReading.create({
      zone_id: zone.id,
      device_id: device.id,
      soil_moisture: 20,
      temperature: 22,
      humidity: 50,
      light_lux: 10000,
      recorded_at: new Date(now.getTime() - 130 * 60000) // 130m old (> 120m)
    });

    const res = await ruleEngineService.evaluateAllRules({ now });
    assert.strictEqual(res.triggered, 0);
    assert.strictEqual(res.details[0].reason, 'stale_reading');
  });

  test('Layer 2 hasOpenTask runs BEFORE Layer 3 atomic increment (never burns daily quota)', async () => {
    const now = new Date('2026-11-24T15:00:00.000Z');
    await SensorReading.create({
      zone_id: zone.id,
      device_id: device.id,
      soil_moisture: 18,
      temperature: 22,
      humidity: 50,
      light_lux: 12000,
      recorded_at: new Date(now.getTime() - 5 * 60000)
    });

    const openTask = await CareTask.create({
      zone_id: zone.id,
      task_type: 'WATER',
      due_date: '2026-11-24',
      is_completed: false,
      source: 'MANUAL'
    });

    const evalRes = await ruleEngineService.evaluateAllRules({ now });
    assert.strictEqual(evalRes.triggered, 0);
    assert.strictEqual(evalRes.details[0].reason, 'open_task_exists');

    const rule = await AutomationRule.findOne({ where: { zone_id: zone.id } });
    assert.strictEqual(Number(rule.executions_today), 0, 'executions_today must remain 0 when skipped by open task');

    // Also test weather guard when rainLikelyFn returns true
    openTask.is_completed = true;
    await openTask.save();
    const rainSkip = await ruleEngineService.evaluateAllRules({ now, rainLikelyFn: async () => true });
    assert.strictEqual(rainSkip.triggered, 0);
    assert.strictEqual(rainSkip.details[0].reason, 'rain_likely');
  });

  test('Layer 3 concurrent Promise.all evaluation enforces max_daily_executions atomically', async () => {
    const now = new Date('2026-11-24T15:05:00.000Z');
    const [r1, r2] = await Promise.all([
      ruleEngineService.evaluateAllRules({ now }),
      ruleEngineService.evaluateAllRules({ now })
    ]);

    assert.strictEqual(r1.triggered + r2.triggered, 1, 'Exactly one concurrent evaluation must win the atomic slot');

    const rule = await AutomationRule.findOne({ where: { zone_id: zone.id } });
    assert.strictEqual(Number(rule.executions_today), 1);

    const ruleTasks = await CareTask.findAll({ where: { zone_id: zone.id, source: 'RULE_ENGINE' } });
    assert.strictEqual(ruleTasks.length, 1);

    // Complete task and roll over local date in America/New_York -> resets executions_today and triggers again
    ruleTasks[0].is_completed = true;
    await ruleTasks[0].save();

    // 2026-11-25T05:30:00Z = 2026-11-25 00:30:00 America/New_York
    const nextDay = new Date('2026-11-25T05:30:00.000Z');
    await SensorReading.create({
      zone_id: zone.id,
      device_id: device.id,
      soil_moisture: 15,
      temperature: 22,
      humidity: 50,
      light_lux: 1000,
      recorded_at: new Date(nextDay.getTime() - 2 * 60000)
    });

    const rolloverRes = await ruleEngineService.evaluateAllRules({ now: nextDay });
    assert.strictEqual(rolloverRes.triggered, 1, 'Local date rollover must reset executions_today');
    const reloadedRule = await AutomationRule.findByPk(rule.id);
    assert.strictEqual(String(reloadedRule.last_execution_date).slice(0, 10), '2026-11-25');
    assert.strictEqual(Number(reloadedRule.executions_today), 1);
  });

  test('POST /api/jobs/evaluate-rules & device-watchdog validate CRON_SECRET', async () => {
    const unauth = await app.inject({
      method: 'POST',
      url: '/api/jobs/evaluate-rules'
    });
    assert.strictEqual(unauth.statusCode, 401);

    const badSecret = await app.inject({
      method: 'POST',
      url: '/api/jobs/evaluate-rules',
      headers: { 'x-cron-secret': 'wrong_secret' }
    });
    assert.strictEqual(badSecret.statusCode, 401);

    const okEval = await app.inject({
      method: 'POST',
      url: '/api/jobs/evaluate-rules',
      headers: { 'x-cron-secret': process.env.CRON_SECRET }
    });
    assert.strictEqual(okEval.statusCode, 200);
    assert.strictEqual(okEval.json().success, true);

    const okWatchdog = await app.inject({
      method: 'POST',
      url: '/jobs/device-watchdog',
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }
    });
    assert.strictEqual(okWatchdog.statusCode, 200);
    assert.strictEqual(okWatchdog.json().success, true);
  });

  test('Concurrent Promise.all evaluateAllRules prevents duplicate tasks & quota burn for max_daily_executions=3 (cooldown=180 and cooldown=0)', async () => {
    const now = new Date('2026-11-26T15:00:00.000Z');

    for (const cooldownMinutes of [180, 0]) {
      const concZone = await Zone.create({
        garden_id: gardenNY.id,
        name: `Concurrent Zone ${cooldownMinutes}`,
        is_outdoor: false,
        area_sq_m: 5
      });
      const concDevice = await Device.create({
        zone_id: concZone.id,
        device_name: `Conc Sensor ${cooldownMinutes}`,
        device_uid: `SG-CONC-${cooldownMinutes}`,
        key_prefix: `sg_live_conc${cooldownMinutes}`,
        key_hash: (cooldownMinutes === 180 ? 'b' : 'c').repeat(64),
        device_type: 'SIMULATOR',
        is_active: true
      });
      await SensorReading.create({
        zone_id: concZone.id,
        device_id: concDevice.id,
        soil_moisture: 12,
        temperature: 22,
        humidity: 50,
        light_lux: 5000,
        recorded_at: new Date(now.getTime() - 2 * 60000)
      });

      const rule = await AutomationRule.create({
        zone_id: concZone.id,
        name: `Dry Concurrent Rule ${cooldownMinutes}`,
        metric: 'SOIL_MOISTURE',
        operator: 'LT',
        threshold_value: 30,
        weather_condition: 'ANY',
        action_type: 'CREATE_TASK',
        task_type: 'WATER',
        cooldown_minutes: cooldownMinutes,
        max_daily_executions: 3,
        is_active: true
      });

      const [res1, res2] = await Promise.all([
        ruleEngineService.evaluateAllRules({ now }),
        ruleEngineService.evaluateAllRules({ now })
      ]);

      const d1 = res1.details.find((d) => d.ruleId === rule.id);
      const d2 = res2.details.find((d) => d.ruleId === rule.id);
      assert.strictEqual(
        (d1 && d1.status === 'triggered' ? 1 : 0) + (d2 && d2.status === 'triggered' ? 1 : 0),
        1,
        `Exactly one concurrent evaluation must trigger for cooldown_minutes=${cooldownMinutes}`
      );

      const openTasks = await CareTask.findAll({
        where: { zone_id: concZone.id, task_type: 'WATER', is_completed: false }
      });
      assert.strictEqual(openTasks.length, 1, `Expected 1 open WATER task for cooldown_minutes=${cooldownMinutes}`);

      const reloaded = await AutomationRule.findByPk(rule.id);
      assert.strictEqual(Number(reloaded.executions_today), 1, `Expected executions_today === 1 for cooldown_minutes=${cooldownMinutes}`);
    }
  });

  test('dbHelpers edge cases: MariaDB backslash escape, invalid Date -> NULL, BigInt affected count', () => {
    assert.strictEqual(dbHelpers.escapeSqlLiteral('foo\\', 'mariadb'), "'foo\\\\'");
    assert.strictEqual(dbHelpers.escapeSqlLiteral("it's \\ ok", 'mysql'), "'it''s \\\\ ok'");
    assert.strictEqual(dbHelpers.escapeSqlLiteral('foo\\', 'sqlite'), "'foo\\'");
    assert.strictEqual(dbHelpers.escapeSqlLiteral('foo\\', 'postgres'), "'foo\\'");
    assert.strictEqual(dbHelpers.escapeSqlLiteral(new Date('not-a-date'), 'sqlite'), 'NULL');
    assert.strictEqual(dbHelpers.escapeSqlLiteral(new Date('not-a-date'), 'mariadb'), 'NULL');

    assert.strictEqual(dbHelpers.normalizeAffectedCount({ affectedRows: 3n }), 3);
    assert.strictEqual(dbHelpers.normalizeAffectedCount({ changes: 2n }), 2);
    assert.strictEqual(dbHelpers.normalizeAffectedCount([undefined, { affectedRows: 5n }]), 5);
    assert.strictEqual(dbHelpers.normalizeAffectedCount([{ affectedRows: 4n }, undefined]), 4);
  });
});
