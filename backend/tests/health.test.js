const { test, describe, before } = require('node:test');
const assert = require('node:assert');

// Ensure test environment uses SQLite in-memory dialect
process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const { buildServer } = require('../server');
const { sequelize, connectDb } = require('../config/database');
const { runMigrations } = require('../scripts/migrate');
const { runSeed } = require('../scripts/seed');

describe('Milestone 2: Core Foundation & Database Health Suite', () => {
  let app;

  before(async () => {
    await connectDb();
    await runMigrations();
    await runSeed();
    app = buildServer();
    app.post('/test/body', async (req) => ({ ok: true, data: req.body }));
  });

  test('Fastify server GET /health returns 200 and db: connected', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health'
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.status, 'ok');
    assert.strictEqual(body.db, 'connected');
    assert.ok(body.timestamp, 'Timestamp should be present in response');
    assert.ok(!isNaN(Date.parse(body.timestamp)), 'Timestamp must be valid ISO-8601');
  });

  test('Fastify server GET /api/health returns 200 and db: connected', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health'
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.status, 'ok');
    assert.strictEqual(body.db, 'connected');
    assert.ok(body.timestamp, 'Timestamp should be present in response');
  });

  test('Error handling returns RFC 7807 compliant JSON format on 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/unknown-endpoint'
    });

    assert.strictEqual(res.statusCode, 404);
    const body = res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error, 'Error object must be present');
    assert.strictEqual(body.error.statusCode, 404);
    assert.ok(body.error.code, 'Error code must be present');
    assert.ok(body.error.message, 'Human readable message must be present');
  });

  test('Error handling returns RFC 7807 compliant HTTP 400 on malformed JSON payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/body',
      headers: { 'content-type': 'application/json' },
      payload: '{"broken": json without quotes'
    });

    assert.strictEqual(res.statusCode, 400);
    const body = res.json();
    assert.strictEqual(body.success, false);
    assert.deepStrictEqual(body.error, {
      code: 'BAD_REQUEST',
      message: 'Invalid or malformed JSON payload',
      details: {},
      statusCode: 400
    });
  });

  test('Fastify server correctly parses both JSON objects and JSON arrays', async () => {
    const objRes = await app.inject({
      method: 'POST',
      url: '/test/body',
      headers: { 'content-type': 'application/json' },
      payload: '{"temperature": 24.5, "unit": "celsius"}'
    });
    assert.strictEqual(objRes.statusCode, 200);
    assert.deepStrictEqual(objRes.json().data, { temperature: 24.5, unit: 'celsius' });

    const arrRes = await app.inject({
      method: 'POST',
      url: '/test/body',
      headers: { 'content-type': 'application/json' },
      payload: '[{"zoneId": 1}, {"zoneId": 2}]'
    });
    assert.strictEqual(arrRes.statusCode, 200);
    assert.deepStrictEqual(arrRes.json().data, [{ zoneId: 1 }, { zoneId: 2 }]);
  });

  test('CORS headers are properly attached to responses', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: 'http://localhost:5173'
      }
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:5173');
  });

  test('All 21 database entities are created in schema migrations', async () => {
    const expectedTables = [
      'users',
      'password_reset_tokens',
      'gardens',
      'garden_members',
      'garden_invitations',
      'zones',
      'plant_catalog',
      'zone_plants',
      'devices',
      'sensor_readings',
      'sensor_aggregates_daily',
      'care_tasks',
      'water_usage_logs',
      'automation_rules',
      'alert_configs',
      'alert_logs',
      'growth_journals',
      'community_posts',
      'community_comments',
      'user_follows',
      'weather_cache'
    ];

    const tablesInDb = await sequelize.getQueryInterface().showAllTables();
    for (const table of expectedTables) {
      assert.ok(
        tablesInDb.includes(table),
        `Table '${table}' must be created by migrations`
      );
    }
  });

  test('Plant catalog seed populates at least 30 real-world plant species', async () => {
    const rows = await sequelize.query('SELECT * FROM plant_catalog ORDER BY id ASC;');
    assert.ok(rows.length >= 30, `Expected at least 30 plants, found ${rows.length}`);

    // Verify key plant profiles exist with accurate care parameters
    const tomato = rows.find(r => r.common_name === 'Tomato');
    assert.ok(tomato, 'Tomato species should be in catalog');
    assert.strictEqual(tomato.scientific_name, 'Solanum lycopersicum');
    assert.strictEqual(tomato.category, 'VEGETABLE');
    assert.strictEqual(tomato.sunlight_req, 'FULL_SUN');
    assert.ok(tomato.ideal_moisture_min > 0);
    assert.ok(tomato.ideal_moisture_max > tomato.ideal_moisture_min);
    assert.ok(tomato.ideal_temp_min > 0);
    assert.ok(tomato.ideal_temp_max > tomato.ideal_temp_min);
    assert.ok(tomato.spacing_cm > 0);

    const basil = rows.find(r => r.common_name === 'Basil');
    assert.ok(basil, 'Basil species should be in catalog');
    assert.strictEqual(basil.category, 'HERB');
  });

  test('Explicit index idx_cp_author exists on community_posts', async () => {
    const indexRows = await sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='community_posts';"
    );
    const indexNames = indexRows.map(r => r.name);
    assert.ok(
      indexNames.includes('idx_cp_author'),
      'Explicit index idx_cp_author should exist on community_posts'
    );
  });
});
