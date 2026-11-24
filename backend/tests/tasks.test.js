const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const bcrypt = require('bcryptjs');
const { buildServer } = require('../server');
const { sequelize, connectDb } = require('../config/database');
const { runMigrations } = require('../scripts/migrate');
const { User, Garden, GardenMember, Zone, CareTask, WaterUsageLog } = require('../models');
const taskService = require('../services/taskService');
const eventBus = require('../services/eventBus');

describe('Sprint 2 F6: Recurring Care Tasks & Water Logging Suite', () => {
  let app;
  let ownerUser, familyUser, guestUser;
  let ownerToken, familyToken, guestToken;
  let gardenLA, zone1, zone2, otherGarden, otherZone;

  async function createUserAndLogin(name, email) {
    const password = 'Password123!';
    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password_hash, location_region: 'US-West' });
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

    ({ user: ownerUser, token: ownerToken } = await createUserAndLogin('Task Owner', 'task_owner@test.com'));
    ({ user: familyUser, token: familyToken } = await createUserAndLogin('Task Family', 'task_family@test.com'));
    ({ user: guestUser, token: guestToken } = await createUserAndLogin('Task Guest', 'task_guest@test.com'));

    gardenLA = await Garden.create({
      owner_id: ownerUser.id,
      name: 'LA Test Garden',
      timezone: 'America/Los_Angeles',
      area_sq_m: 30
    });
    await GardenMember.create({ garden_id: gardenLA.id, user_id: ownerUser.id, role: 'OWNER' });
    await GardenMember.create({ garden_id: gardenLA.id, user_id: familyUser.id, role: 'FAMILY' });
    await GardenMember.create({ garden_id: gardenLA.id, user_id: guestUser.id, role: 'GUEST' });

    zone1 = await Zone.create({ garden_id: gardenLA.id, name: 'South Bed', is_outdoor: true, area_sq_m: 10 });
    zone2 = await Zone.create({ garden_id: gardenLA.id, name: 'Herb Corner', is_outdoor: true, area_sq_m: 5 });

    otherGarden = await Garden.create({ owner_id: familyUser.id, name: 'Other Garden', timezone: 'UTC', area_sq_m: 10 });
    await GardenMember.create({ garden_id: otherGarden.id, user_id: familyUser.id, role: 'OWNER' });
    otherZone = await Zone.create({ garden_id: otherGarden.id, name: 'Other Zone', is_outdoor: true, area_sq_m: 5 });
  });

  after(async () => {
    if (app) await app.close();
  });

  test('POST /api/zones/:zoneId/tasks allows OWNER/FAMILY, rejects GUEST with 403, and emits TASK_UPDATED', async () => {
    const events = [];
    const unsub = eventBus.subscribeGarden(gardenLA.id, (f) => events.push(f));

    const guestRes = await app.inject({
      method: 'POST',
      url: `/api/zones/${zone1.id}/tasks`,
      headers: { authorization: `Bearer ${guestToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ task_type: 'WATER', due_date: '2026-11-24' })
    });
    assert.strictEqual(guestRes.statusCode, 403);

    const famRes = await app.inject({
      method: 'POST',
      url: `/api/zones/${zone1.id}/tasks`,
      headers: { authorization: `Bearer ${familyToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({
        task_type: 'WATER',
        due_date: '2026-11-24',
        recurrence_days: 3,
        notes: 'Morning drip check'
      })
    });
    unsub();

    assert.strictEqual(famRes.statusCode, 201);
    const body = famRes.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.task.task_type, 'WATER');
    assert.strictEqual(body.data.task.recurrence_days, 3);
    assert.ok(events.some((e) => e.event === 'TASK_UPDATED' && e.data.taskId === body.data.task.id));
  });

  test('Timezone-aware recurrence uses garden.timezone local date instead of UTC date', async () => {
    // 2026-11-24T04:00:00Z is 2026-11-23 20:00:00 in America/Los_Angeles (PST, UTC-8)
    const utcInstant = new Date('2026-11-24T04:00:00.000Z');
    const created = await taskService.createTask(zone1.id, {
      task_type: 'WATER',
      due_date: '2026-11-23',
      recurrence_days: 3,
      notes: 'TZ recurrence test'
    }, ownerUser);

    const result = await taskService.updateOrCompleteTask(
      zone1.id,
      created.id,
      { is_completed: true, water_volume_liters: 6.5, irrigation_method: 'DRIP_IRRIGATION' },
      familyUser,
      { now: utcInstant }
    );

    assert.strictEqual(result.task.is_completed, true);
    assert.strictEqual(result.task.completed_by, familyUser.id);
    assert.ok(result.task.next_scheduled_task_id, 'Next recurring task should be scheduled');

    const nextTask = await CareTask.findByPk(result.task.next_scheduled_task_id);
    // 2026-11-23 + 3 days = 2026-11-26 (NOT 2026-11-27 from UTC!)
    assert.strictEqual(String(nextTask.due_date).slice(0, 10), '2026-11-26');
    assert.strictEqual(Boolean(nextTask.is_completed), false);

    assert.ok(result.water_log, 'WaterUsageLog should be created atomically');
    assert.strictEqual(Number(result.water_log.liters_applied), 6.5);
    assert.strictEqual(result.water_log.logged_by_user_id, familyUser.id);
    assert.strictEqual(result.water_log.method, 'DRIP_IRRIGATION');
  });

  test('Completing WATER task without water_volume_liters creates NO WaterUsageLog', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: `/zones/${zone2.id}/tasks`, // dual-prefix check without /api
      headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ task_type: 'WATER', due_date: '2026-11-24', notes: 'Dry check' })
    });
    assert.strictEqual(createRes.statusCode, 201);
    const taskId = createRes.json().data.task.id;

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/zones/${zone2.id}/tasks/${taskId}`,
      headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ is_completed: true })
    });
    assert.strictEqual(patchRes.statusCode, 200);
    assert.strictEqual(patchRes.json().data.water_log, null);

    const logs = await WaterUsageLog.findAll({ where: { task_id: taskId } });
    assert.strictEqual(logs.length, 0);
  });

  test('Compound RBAC scoping rejects cross-zone task PATCH/DELETE with 404 TASK_NOT_FOUND', async () => {
    const otherTask = await CareTask.create({
      zone_id: otherZone.id,
      task_type: 'PRUNE',
      due_date: '2026-11-25',
      source: 'MANUAL'
    });

    // Owner of zone1 tries to patch task belonging to otherZone via zone1's path
    const crossRes = await app.inject({
      method: 'PATCH',
      url: `/api/zones/${zone1.id}/tasks/${otherTask.id}`,
      headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ is_completed: true })
    });
    assert.strictEqual(crossRes.statusCode, 404);
    assert.strictEqual(crossRes.json().error.code, 'TASK_NOT_FOUND');

    // Also verify task belonging to zone2 cannot be deleted via zone1
    const z2Task = await CareTask.create({
      zone_id: zone2.id,
      task_type: 'HARVEST',
      due_date: '2026-11-25',
      source: 'MANUAL'
    });
    const wrongZoneDel = await app.inject({
      method: 'DELETE',
      url: `/api/zones/${zone1.id}/tasks/${z2Task.id}`,
      headers: { authorization: `Bearer ${ownerToken}` }
    });
    assert.strictEqual(wrongZoneDel.statusCode, 404);
    assert.strictEqual(wrongZoneDel.json().error.code, 'TASK_NOT_FOUND');
  });

  test('GET /api/gardens/:gardenId/tasks, GET /api/gardens/:id/water-logs & POST /api/zones/:zoneId/water-logs', async () => {
    const manualLogRes = await app.inject({
      method: 'POST',
      url: `/api/zones/${zone2.id}/water-logs`,
      headers: { authorization: `Bearer ${familyToken}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ liters_applied: 4.25, method: 'WATERING_CAN', notes: 'Herb misting' })
    });
    assert.strictEqual(manualLogRes.statusCode, 201);
    assert.strictEqual(manualLogRes.json().data.water_log.logged_by_user_id, familyUser.id);

    const tasksRes = await app.inject({
      method: 'GET',
      url: `/api/gardens/${gardenLA.id}/tasks?is_completed=false`,
      headers: { authorization: `Bearer ${guestToken}` }
    });
    assert.strictEqual(tasksRes.statusCode, 200);
    assert.ok(tasksRes.json().data.tasks.length >= 2);
    assert.ok(tasksRes.json().data.tasks.every((t) => t.is_completed === false));

    const waterRes = await app.inject({
      method: 'GET',
      url: `/api/gardens/${gardenLA.id}/water-logs`,
      headers: { authorization: `Bearer ${guestToken}` }
    });
    assert.strictEqual(waterRes.statusCode, 200);
    assert.ok(waterRes.json().data.water_logs.length >= 2);
  });
});
