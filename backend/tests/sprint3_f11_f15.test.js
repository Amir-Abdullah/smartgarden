process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';
process.env.CRON_SECRET = 'test_sprint3_cron_secret_123456';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

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
  ZonePlant,
  CareTask,
  Device,
  SensorReading,
  AutomationRule,
  AlertLog,
  WeatherCache
} = require('../models');
const weatherService = require('../services/weatherService');
const ruleEngineService = require('../services/ruleEngineService');

function buildMockForecast({ tempC = 22, minTempC = 14, maxTempC = 25, precipProb = 15, precipMm = 0, windKmh = 12 } = {}) {
  const now = new Date();
  const hourly = [];
  for (let i = 0; i < 24; i++) {
    hourly.push({
      time: new Date(now.getTime() + i * 3600000).toISOString(),
      temperature_c: i === 3 ? minTempC : (i === 14 ? maxTempC : tempC),
      precipitation_probability: precipProb,
      precipitation_mm: precipMm,
      wind_speed_kmh: windKmh,
      uv_index: 5
    });
  }
  const daily = [];
  for (let d = 0; d < 7; d++) {
    daily.push({
      date: new Date(now.getTime() + d * 86400000).toISOString().slice(0, 10),
      temp_min_c: minTempC,
      temp_max_c: maxTempC,
      precipitation_prob_max: precipProb,
      precipitation_sum_mm: precipMm * 4,
      uv_index_max: 6,
      et0_mm: 3.4,
      gdd_base10: 8.5,
      wind_speed_max_kmh: windKmh,
      condition: precipProb >= 60 ? 'Rain Showers' : 'Clear Sky'
    });
  }
  return {
    provider: 'test-mock-weather',
    current: {
      temperature_c: tempC,
      humidity_percent: 62,
      wind_speed_kmh: windKmh,
      precipitation_mm: precipMm,
      uv_index: 5,
      condition: daily[0].condition
    },
    hourly,
    daily
  };
}

describe('Sprint 3 (F11–F15): Horticultural Intelligence Suite', () => {
  let app;
  let ownerUser;
  let guestUser;
  let ownerToken;
  let guestToken;
  let garden;
  let outdoorZone;
  let indoorZone;
  let clayShadeZone;
  let tomatoCat;
  let basilCat;
  let fennelCat;
  let tomatoZonePlant;

  before(async () => {
    await dbConfig.connectDb();
    await runMigrations();
    await runSeed();
    app = buildServer();

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('TestPass123!', 10);

    ownerUser = await User.create({
      name: 'Sprint3 Owner',
      email: 's3.owner@smartgarden.test',
      password_hash: hash,
      location_region: 'US-Zone-8b',
      is_admin: false
    });
    guestUser = await User.create({
      name: 'Sprint3 Guest',
      email: 's3.guest@smartgarden.test',
      password_hash: hash,
      location_region: 'US-Zone-8b',
      is_admin: false
    });

    ownerToken = app.jwt.sign({ id: ownerUser.id, email: ownerUser.email, name: ownerUser.name, is_admin: false });
    guestToken = app.jwt.sign({ id: guestUser.id, email: guestUser.email, name: guestUser.name, is_admin: false });

    garden = await Garden.create({
      owner_id: ownerUser.id,
      name: 'Sprint 3 Test Plot',
      latitude: 45.5152,
      longitude: -122.6784,
      location_address: 'Portland, OR',
      timezone: 'America/Los_Angeles',
      area_sq_m: 40
    });
    await GardenMember.create({ garden_id: garden.id, user_id: ownerUser.id, role: 'OWNER' });
    await GardenMember.create({ garden_id: garden.id, user_id: guestUser.id, role: 'GUEST' });

    outdoorZone = await Zone.create({
      garden_id: garden.id,
      name: 'Sandy Sun Outdoor Bed',
      zone_type: 'RAISED_BED',
      soil_type: 'SANDY',
      sunlight_level: 'FULL_SUN',
      area_sq_m: 10,
      is_outdoor: true
    });
    indoorZone = await Zone.create({
      garden_id: garden.id,
      name: 'Indoor Micro Tent',
      zone_type: 'INDOOR_POTS',
      soil_type: 'PEAT',
      sunlight_level: 'PART_SHADE',
      area_sq_m: 4,
      is_outdoor: false
    });
    clayShadeZone = await Zone.create({
      garden_id: garden.id,
      name: 'Clay Shade Corner',
      zone_type: 'OUTDOOR_BED',
      soil_type: 'CLAY',
      sunlight_level: 'FULL_SHADE',
      area_sq_m: 8,
      is_outdoor: true
    });

    const allCats = await PlantCatalog.findAll();
    tomatoCat = allCats.find((c) => c.common_name === 'Tomato');
    basilCat = allCats.find((c) => c.common_name === 'Basil');
    fennelCat = allCats.find((c) => c.common_name === 'Kale') || allCats.find((c) => c.common_name === 'Potato');

    tomatoZonePlant = await ZonePlant.create({
      zone_id: outdoorZone.id,
      plant_catalog_id: tomatoCat.id,
      custom_nickname: 'Early Girl Tomato',
      quantity: 3,
      planted_date: '2026-04-01',
      expected_harvest_date: '2026-07-15',
      status: 'GROWING',
      health_status: 'HEALTHY'
    });
    await ZonePlant.create({
      zone_id: outdoorZone.id,
      plant_catalog_id: basilCat.id,
      custom_nickname: 'Genovese Basil',
      quantity: 4,
      planted_date: '2026-04-10',
      status: 'GROWING',
      health_status: 'HEALTHY'
    });
    await ZonePlant.create({
      zone_id: clayShadeZone.id,
      plant_catalog_id: tomatoCat.id,
      custom_nickname: 'Shade Comparison Tomato',
      quantity: 3,
      planted_date: '2026-04-01',
      status: 'GROWING',
      health_status: 'HEALTHY'
    });
  });

  after(async () => {
    weatherService.setWeatherFetcher(null);
    if (app && typeof app.close === 'function') {
      await app.close();
    }
  });

  it('F11: computeGridKey normalizes negative zero (-0.001) to grid_0.00_0.00 and rejects bad coords', async () => {
    const negZero = weatherService.computeGridKey(-0.001, -0.004);
    assert.equal(negZero.gridKey, 'grid_0.00_0.00');
    assert.equal(Object.is(negZero.latGrid, -0), false);
    assert.equal(Object.is(negZero.lngGrid, -0), false);

    const portland = weatherService.computeGridKey(45.5152, -122.6784);
    assert.equal(portland.gridKey, 'grid_45.52_-122.68');

    const badRes = await app.inject({
      method: 'GET',
      url: '/api/weather?latitude=999&longitude=0',
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(badRes.statusCode, 400);
    assert.equal(badRes.json().error.code, 'INVALID_COORDINATES');
  });

  it('F11: spatial weather cache coalesces concurrent requests and honors 30m TTL + force_refresh', async () => {
    let providerCalls = 0;
    weatherService.setWeatherFetcher(async () => {
      providerCalls++;
      await new Promise((r) => setTimeout(r, 25));
      return buildMockForecast({ tempC: 24, precipProb: 10 });
    });

    // 5 concurrent cache misses for same grid -> only 1 provider call via single-flight coalescing
    const results = await Promise.all([
      weatherService.getWeatherData(12.341, 56.781),
      weatherService.getWeatherData(12.342, 56.782),
      weatherService.getWeatherData(12.343, 56.783),
      weatherService.getWeatherData(12.344, 56.784),
      weatherService.getWeatherData(12.340, 56.779)
    ]);
    assert.equal(providerCalls, 1);
    assert.equal(results[0].grid_key, 'grid_12.34_56.78');

    // Subsequent call returns cached data without invoking provider
    const cachedRes = await app.inject({
      method: 'GET',
      url: '/api/weather?latitude=12.341&longitude=56.781',
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(cachedRes.statusCode, 200);
    assert.equal(cachedRes.json().data.cached, true);
    assert.equal(providerCalls, 1);

    // force_refresh=true fetches fresh payload
    const refreshRes = await app.inject({
      method: 'GET',
      url: '/api/weather?latitude=12.341&longitude=56.781&force_refresh=true',
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(refreshRes.statusCode, 200);
    assert.equal(refreshRes.json().data.cached, false);
    assert.equal(providerCalls, 2);
  });

  it('F11 + F10: rain-skip postpones outdoor WATER tasks by 24h while exempting indoor zones & skips NO_RAIN rules', async () => {
    const todayLocal = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    const outdoorTask = await CareTask.create({
      zone_id: outdoorZone.id,
      task_type: 'WATER',
      due_date: todayLocal,
      recurrence_days: 3,
      is_completed: false,
      source: 'MANUAL',
      notes: 'Outdoor test irrigation'
    });
    const indoorTask = await CareTask.create({
      zone_id: indoorZone.id,
      task_type: 'WATER',
      due_date: todayLocal,
      recurrence_days: 3,
      is_completed: false,
      source: 'MANUAL',
      notes: 'Indoor grow tent watering'
    });

    // Clear weather cache for garden grid and mock heavy rain (85%)
    const { gridKey } = weatherService.computeGridKey(garden.latitude, garden.longitude);
    await WeatherCache.destroy({ where: { grid_key: gridKey } });
    weatherService.setWeatherFetcher(async () => buildMockForecast({ precipProb: 85, precipMm: 3.5, minTempC: 1.2 }));

    const rainSkipRes = await app.inject({
      method: 'POST',
      url: `/api/gardens/${garden.id}/weather/rain-skip`,
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(rainSkipRes.statusCode, 200);
    const body = rainSkipRes.json().data;
    assert.equal(body.rain_likely, true);
    assert.equal(body.postponed_tasks.length, 1);
    assert.equal(body.postponed_tasks[0].id, outdoorTask.id);
    assert.ok(body.exempt_indoor_zones.some((z) => z.id === indoorZone.id));

    const updatedOutdoor = await CareTask.findByPk(outdoorTask.id);
    const untouchedIndoor = await CareTask.findByPk(indoorTask.id);
    assert.notEqual(String(updatedOutdoor.due_date).slice(0, 10), todayLocal);
    assert.ok(updatedOutdoor.notes.includes('[Rain-Skip'));
    assert.equal(String(untouchedIndoor.due_date).slice(0, 10), todayLocal);

    // Re-running rain-skip same day is idempotent (does not double-postpone)
    const rainSkipRes2 = await app.inject({
      method: 'POST',
      url: `/api/gardens/${garden.id}/weather/rain-skip`,
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(rainSkipRes2.json().data.postponed_tasks.length, 0);
    assert.equal(rainSkipRes2.json().data.already_postponed_tasks.length, 1);

    // Wire check with F10 AutomationRule NO_RAIN guard
    const crypto = require('node:crypto');
    const rawKey = 'sg_live_sprint3_weather_device_abcdef12';
    const dev = await Device.create({
      zone_id: outdoorZone.id,
      device_name: 'S3 Rain Test Sensor',
      device_uid: 'SG-S3-RAIN-01',
      key_prefix: rawKey.slice(0, 16),
      key_hash: crypto.createHash('sha256').update(rawKey).digest('hex'),
      is_active: true,
      last_seen_at: new Date()
    });
    await SensorReading.create({
      zone_id: outdoorZone.id,
      device_id: dev.id,
      soil_moisture: 18,
      temperature: 12,
      humidity: 70,
      light_lux: 5000,
      recorded_at: new Date()
    });
    const rule = await AutomationRule.create({
      zone_id: outdoorZone.id,
      name: 'S3 NO_RAIN Guard Rule',
      metric: 'SOIL_MOISTURE',
      operator: 'LT',
      threshold_value: 30,
      weather_condition: 'NO_RAIN',
      action_type: 'SEND_ALERT',
      cooldown_minutes: 0,
      max_daily_executions: 3,
      executions_today: 0,
      is_active: true
    });

    const evalOutcome = await ruleEngineService.evaluateAllRules();
    const ruleDetail = evalOutcome.details.find((d) => d.ruleId === rule.id);
    assert.equal(ruleDetail.status, 'skipped');
    assert.equal(ruleDetail.reason, 'rain_likely');

    // Weather watchdog endpoint triggers frost alert (< 2C)
    const watchdogRes = await app.inject({
      method: 'POST',
      url: '/api/jobs/weather-watchdog',
      headers: { 'X-Cron-Secret': process.env.CRON_SECRET }
    });
    assert.equal(watchdogRes.statusCode, 200);
    assert.ok(watchdogRes.json().data.alerts_created >= 1);
    const frostAlerts = await AlertLog.findAll({ where: { zone_id: outdoorZone.id } });
    assert.ok(frostAlerts.some((a) => a.message.includes('[WeatherWatchdog:FROST]')));

    await rule.update({ is_active: false });
  });

  it('F12: seasonal calendar applies +6 month Southern Hemisphere shift and exports valid RFC 5545 .ics', async () => {
    const northRes = await app.inject({
      method: 'GET',
      url: '/api/calendar?hemisphere=NORTHERN&month=4',
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(northRes.statusCode, 200);
    const north = northRes.json().data;
    assert.equal(north.hemisphere, 'NORTHERN');
    const northTomato = north.matrix.find((s) => s.common_name === 'Tomato');
    assert.deepEqual(northTomato.direct_sow_months, [3, 4, 5]);
    assert.ok(north.current_month_plan.direct_sow.some((s) => s.common_name === 'Tomato'));

    const southRes = await app.inject({
      method: 'GET',
      url: '/api/calendar?latitude=-33.8688&month=10',
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(southRes.statusCode, 200);
    const south = southRes.json().data;
    assert.equal(south.hemisphere, 'SOUTHERN');
    const southTomato = south.matrix.find((s) => s.common_name === 'Tomato');
    assert.deepEqual(southTomato.direct_sow_months, [9, 10, 11]);
    assert.ok(south.current_month_plan.direct_sow.some((s) => s.common_name === 'Tomato'));

    const icsRes = await app.inject({
      method: 'GET',
      url: `/api/calendar/export.ics?garden_id=${garden.id}&month=4`,
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(icsRes.statusCode, 200);
    assert.ok(icsRes.headers['content-type'].includes('text/calendar'));
    assert.ok(icsRes.payload.includes('BEGIN:VCALENDAR'));
    assert.ok(icsRes.payload.includes('BEGIN:VEVENT'));
    assert.ok(icsRes.payload.includes('END:VCALENDAR'));
  });

  it('F13: personalized care plan calibrates frequencies by soil & sun and generates idempotent CARE_PLAN tasks', async () => {
    const sandPreviewRes = await app.inject({
      method: 'GET',
      url: `/api/zones/${outdoorZone.id}/care-plans/preview?plant_id=${tomatoZonePlant.id}`,
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(sandPreviewRes.statusCode, 200);
    const sandWater = sandPreviewRes.json().data.planned_tasks.find((t) => t.task_type === 'WATER');

    const clayPreviewRes = await app.inject({
      method: 'GET',
      url: `/api/zones/${clayShadeZone.id}/care-plans/preview`,
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(clayPreviewRes.statusCode, 200);
    const clayWater = clayPreviewRes.json().data.planned_tasks.find((t) => t.task_type === 'WATER');

    // Sandy + Full Sun waters noticeably more often than Clay + Full Shade
    assert.ok(sandWater.recurrence_days < clayWater.recurrence_days);

    // GUEST forbidden to generate mutations
    const guestGenRes = await app.inject({
      method: 'POST',
      url: `/api/zones/${outdoorZone.id}/plants/${tomatoZonePlant.id}/care-plan`,
      headers: { Authorization: `Bearer ${guestToken}` }
    });
    assert.equal(guestGenRes.statusCode, 403);

    // OWNER generates tasks
    const genRes = await app.inject({
      method: 'POST',
      url: `/api/zones/${outdoorZone.id}/plants/${tomatoZonePlant.id}/care-plan`,
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(genRes.statusCode, 201);
    assert.equal(genRes.json().data.created_count, 3);
    assert.ok(genRes.json().data.created_tasks.every((t) => t.source === 'CARE_PLAN'));

    // Second call skips duplicates
    const genRes2 = await app.inject({
      method: 'POST',
      url: `/api/zones/${outdoorZone.id}/plants/${tomatoZonePlant.id}/care-plan`,
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(genRes2.statusCode, 201);
    assert.equal(genRes2.json().data.created_count, 0);
    assert.equal(genRes2.json().data.skipped_count, 3);
  });

  it('F14: recommendation engine ranks species 0-100 across 5 weighted factors', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/zones/${outdoorZone.id}/recommendations?month=4&limit=10`,
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(res.statusCode, 200);
    const data = res.json().data;
    assert.ok(data.recommendations.length > 0 && data.recommendations.length <= 10);

    // Verify descending score order and bounded breakdown
    for (let i = 0; i < data.recommendations.length; i++) {
      const r = data.recommendations[i];
      assert.ok(r.total_score >= 0 && r.total_score <= 100);
      assert.equal(
        r.total_score,
        r.breakdown.sunlight + r.breakdown.season + r.breakdown.soil + r.breakdown.space + r.breakdown.companions
      );
      if (i > 0) {
        assert.ok(data.recommendations[i - 1].total_score >= r.total_score);
      }
    }
  });

  it('F15: companion planting advisor detects Tomato+Basil synergy, group conflicts, and What-If delta', async () => {
    const baseRes = await app.inject({
      method: 'GET',
      url: `/api/zones/${outdoorZone.id}/companions`,
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(baseRes.statusCode, 200);
    const base = baseRes.json().data;
    assert.ok(base.synergies.some((s) =>
      (s.plantA === 'Tomato' && s.plantB === 'Basil') ||
      (s.plantA === 'Basil' && s.plantB === 'Tomato')
    ));
    assert.equal(base.overall_score, 80); // 70 + 10*1 - 25*0
    assert.ok(Array.isArray(base.matrix) && base.matrix.length === 2);

    // Simulate adding antagonistic Fennel / Cabbage (Brassicas alias)
    const simRes = await app.inject({
      method: 'POST',
      url: `/api/zones/${outdoorZone.id}/companions/simulate`,
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      payload: { candidate_catalog_ids: [fennelCat.id] }
    });
    assert.equal(simRes.statusCode, 200);
    const sim = simRes.json().data;
    assert.ok(sim.conflicts.length >= 1);
    assert.ok(sim.simulated_delta < 0);
    assert.ok(sim.overall_score < base.overall_score);
  });
});
