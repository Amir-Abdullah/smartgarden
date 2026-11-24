process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';
process.env.CRON_SECRET = 'test_sprint4_cron_secret_123456';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

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
  Device,
  SensorReading,
  SensorAggregateDaily,
  WaterUsageLog,
  CareTask,
  MediaAsset
} = require('../models');
const analyticsService = require('../services/analyticsService');
const aiService = require('../services/aiService');
const storageService = require('../services/storageService');

const TINY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

function buildMultipartBody(fields = {}, fileSpec = null) {
  const boundary = `----SmartGardenBoundary${Date.now().toString(16)}`;
  const chunks = [];

  for (const [key, val] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${String(val)}\r\n`,
        'utf8'
      )
    );
  }

  if (fileSpec) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${fileSpec.field || 'photo'}"; filename="${fileSpec.filename || 'photo.png'}"\r\nContent-Type: ${fileSpec.mimeType || 'image/png'}\r\n\r\n`,
        'utf8'
      )
    );
    chunks.push(fileSpec.buffer);
    chunks.push(Buffer.from('\r\n', 'utf8'));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    payload: Buffer.concat(chunks)
  };
}

describe('Sprint 4 Backend F16-F20 Suite (Journal, Analytics, AI & Community)', () => {
  let app;
  let ownerUser;
  let peerUser;
  let guestUser;
  let adminUser;
  let ownerToken;
  let peerToken;
  let guestToken;
  let adminToken;
  let garden;
  let zone;
  let zonePlant;
  let device;

  before(async () => {
    await dbConfig.connectDb();
    await runMigrations();
    await runSeed();

    app = buildServer();
    await app.ready();

    const hash = await bcrypt.hash('Sprint4Pass123!', 4);
    ownerUser = await User.create({
      name: 'Sprint4 Owner',
      email: 's4-owner@test.com',
      password_hash: hash,
      is_admin: false
    });
    peerUser = await User.create({
      name: 'Sprint4 Peer',
      email: 's4-peer@test.com',
      password_hash: hash,
      is_admin: false
    });
    guestUser = await User.create({
      name: 'Sprint4 Guest',
      email: 's4-guest@test.com',
      password_hash: hash,
      is_admin: false
    });
    adminUser = await User.create({
      name: 'Sprint4 Admin',
      email: 's4-admin@test.com',
      password_hash: hash,
      is_admin: true
    });

    ownerToken = app.jwt.sign({ id: ownerUser.id, email: ownerUser.email, is_admin: false });
    peerToken = app.jwt.sign({ id: peerUser.id, email: peerUser.email, is_admin: false });
    guestToken = app.jwt.sign({ id: guestUser.id, email: guestUser.email, is_admin: false });
    adminToken = app.jwt.sign({ id: adminUser.id, email: adminUser.email, is_admin: true });

    garden = await Garden.create({
      owner_id: ownerUser.id,
      name: 'Sprint4 Test Garden',
      location_address: '100 Cedar Way, Portland, OR',
      latitude: 45.5152,
      longitude: -122.6784,
      timezone: 'America/Los_Angeles',
      area_sq_m: 32
    });

    await GardenMember.create({ garden_id: garden.id, user_id: ownerUser.id, role: 'OWNER' });
    await GardenMember.create({ garden_id: garden.id, user_id: guestUser.id, role: 'GUEST' });

    zone = await Zone.create({
      garden_id: garden.id,
      name: 'Heirloom Terrace',
      zone_type: 'RAISED_BED',
      sunlight_level: 'FULL_SUN',
      soil_type: 'LOAM',
      is_outdoor: true,
      area_sq_m: 8
    });

    const tomatoCatalog = await PlantCatalog.findOne({ where: { scientific_name: 'Solanum lycopersicum' } });
    zonePlant = await ZonePlant.create({
      zone_id: zone.id,
      plant_catalog_id: tomatoCatalog.id,
      custom_nickname: 'Sungold Cherry Tomato',
      quantity: 3,
      planted_date: '2026-04-01'
    });

    device = await Device.create({
      zone_id: zone.id,
      device_name: 'Terrace Sensor 1',
      device_uid: 'SG-S4-TEST-01',
      key_prefix: 'sg_live_s4t1',
      key_hash: 'hash_placeholder_sprint4_test_0123456789abcdef0123456789abcdef',
      is_active: true
    });

    await WaterUsageLog.create({
      zone_id: zone.id,
      zone_plant_id: zonePlant.id,
      logged_by_user_id: ownerUser.id,
      liters_applied: 12.5,
      method: 'DRIP_IRRIGATION',
      recorded_at: new Date(),
      notes: 'Morning drip cycle'
    });

    await CareTask.create({
      zone_id: zone.id,
      zone_plant_id: zonePlant.id,
      assigned_to: ownerUser.id,
      task_type: 'WATER',
      due_date: new Date().toISOString().slice(0, 10),
      is_completed: true,
      completed_at: new Date(),
      completed_by: ownerUser.id,
      source: 'MANUAL'
    });
  });

  after(async () => {
    aiService.resetRateLimits();
    storageService.setR2Fetcher(null);
    aiService.setAiFetcher(null);
    if (app) await app.close();
    if (dbConfig && dbConfig.sequelize) await dbConfig.sequelize.close();
  });

  it('F16: Supports multipart PNG upload, exact binary /api/media retrieval, validation (400/413), timeline, edit/delete & RBAC', async () => {
    // 1. Reject non-image multipart upload with 400 INVALID_FILE_TYPE
    const badFile = buildMultipartBody(
      { entry_date: '2026-04-10', note: 'Bad file test' },
      { field: 'photo', filename: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image', 'utf8') }
    );
    const badRes = await app.inject({
      method: 'POST',
      url: `/api/plants/${zonePlant.id}/journal`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'content-type': badFile.contentType
      },
      payload: badFile.payload
    });
    assert.equal(badRes.statusCode, 400);
    assert.equal(badRes.json().error.code, 'INVALID_FILE_TYPE');

    // 2. Reject oversized PNG (>5 MB) with 413 PAYLOAD_TOO_LARGE
    const oversizedBuf = Buffer.concat([TINY_PNG_BUFFER, Buffer.alloc(5 * 1024 * 1024 + 64, 0x00)]);
    const bigFile = buildMultipartBody(
      { entry_date: '2026-04-10', note: 'Huge upload' },
      { field: 'photo', filename: 'huge.png', mimeType: 'image/png', buffer: oversizedBuf }
    );
    const bigRes = await app.inject({
      method: 'POST',
      url: `/api/plants/${zonePlant.id}/journal`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'content-type': bigFile.contentType
      },
      payload: bigFile.payload
    });
    assert.equal(bigRes.statusCode, 413);
    assert.equal(bigRes.json().error.code, 'PAYLOAD_TOO_LARGE');

    // 3. Reject GUEST write with 403
    const guestRes = await app.inject({
      method: 'POST',
      url: `/api/plants/${zonePlant.id}/journal`,
      headers: { Authorization: `Bearer ${guestToken}` },
      payload: { entry_date: '2026-04-10', note: 'Guest attempt' }
    });
    assert.equal(guestRes.statusCode, 403);

    // 4. Create first entry via valid multipart PNG
    const mp1 = buildMultipartBody(
      { entry_date: '2026-04-10', height_cm: '18.5', note: 'Transplanted seedlings' },
      { field: 'photo', filename: 'seedling.png', mimeType: 'image/png', buffer: TINY_PNG_BUFFER }
    );
    const create1 = await app.inject({
      method: 'POST',
      url: `/api/plants/${zonePlant.id}/journal`,
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'content-type': mp1.contentType
      },
      payload: mp1.payload
    });
    assert.equal(create1.statusCode, 201);
    const entry1 = create1.json().data;
    assert.ok(entry1.photo_url.startsWith('/api/media/'), `Expected /api/media url, got ${entry1.photo_url}`);
    assert.equal(entry1.height_cm, 18.5);

    // Verify stored PNG binary matches exact bytes via GET /api/media/:key
    const mediaRes = await app.inject({
      method: 'GET',
      url: entry1.photo_url
    });
    assert.equal(mediaRes.statusCode, 200);
    assert.equal(mediaRes.headers['content-type'], 'image/png');
    assert.equal(Buffer.compare(mediaRes.rawPayload, TINY_PNG_BUFFER), 0);

    // 5. Create second entry with higher height for progression series
    const create2 = await app.inject({
      method: 'POST',
      url: `/api/plants/${zonePlant.id}/journal`,
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: { entry_date: '2026-04-25', height_cm: 39.25, note: 'Flower buds forming cleanly' }
    });
    assert.equal(create2.statusCode, 201);
    const entry2 = create2.json().data;

    // 6. Verify plant timeline & height_series order
    const getPlantRes = await app.inject({
      method: 'GET',
      url: `/api/plants/${zonePlant.id}/journal`,
      headers: { Authorization: `Bearer ${guestToken}` }
    });
    assert.equal(getPlantRes.statusCode, 200);
    const journalData = getPlantRes.json().data;
    assert.equal(journalData.entries.length, 2);
    assert.deepEqual(
      journalData.height_series.map((p) => p.height_cm),
      [18.5, 39.25]
    );

    // 7. Verify garden-wide journal endpoint
    const gardenJournalRes = await app.inject({
      method: 'GET',
      url: `/api/gardens/${garden.id}/journal`,
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(gardenJournalRes.statusCode, 200);
    assert.equal(gardenJournalRes.json().data.entries.length, 2);
    assert.equal(gardenJournalRes.json().data.entries[0].zone_name, 'Heirloom Terrace');

    // 8. Edit & delete second entry
    const putRes = await app.inject({
      method: 'PUT',
      url: `/api/plants/${zonePlant.id}/journal/${entry2.id}`,
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: { height_cm: 41.0, note: 'Updated height measurement' }
    });
    assert.equal(putRes.statusCode, 200);
    assert.equal(putRes.json().data.height_cm, 41);

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/plants/${zonePlant.id}/journal/${entry2.id}`,
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(delRes.statusCode, 200);
  });

  it('F17: Rolls up daily telemetry, purges >30d readings, runs cron hook, and exports Analytics JSON, CSV, and valid PDF', async () => {
    const now = new Date();
    const oldDate = new Date(now.getTime() - 40 * 86400000); // > 30 days ago
    const recentDate = new Date(now.getTime() - 2 * 86400000); // 2 days ago

    await SensorReading.create({
      zone_id: zone.id,
      device_id: device.id,
      soil_moisture: 40,
      temperature: 20,
      humidity: 60,
      light_lux: 15000,
      recorded_at: oldDate
    });
    await SensorReading.create({
      zone_id: zone.id,
      device_id: device.id,
      soil_moisture: 60,
      temperature: 24,
      humidity: 64,
      light_lux: 25000,
      recorded_at: oldDate
    });
    await SensorReading.create({
      zone_id: zone.id,
      device_id: device.id,
      soil_moisture: 55,
      temperature: 22,
      humidity: 58,
      light_lux: 28000,
      recorded_at: recentDate
    });

    // Cron secret guard check + run rollup
    const unauthJob = await app.inject({ method: 'POST', url: '/api/jobs/telemetry-rollup' });
    assert.equal(unauthJob.statusCode, 401);

    const jobRes = await app.inject({
      method: 'POST',
      url: '/api/jobs/telemetry-rollup',
      headers: { 'x-cron-secret': process.env.CRON_SECRET }
    });
    assert.equal(jobRes.statusCode, 200);
    const jobData = jobRes.json().data;
    assert.equal(jobData.aggregates_written, 2);
    assert.equal(jobData.readings_purged, 2);

    const oldDateStr = oldDate.toISOString().slice(0, 10);
    const aggRow = await SensorAggregateDaily.findOne({
      where: { zone_id: zone.id, device_id: device.id, aggregate_date: oldDateStr }
    });
    assert.ok(aggRow);
    assert.equal(Number(aggRow.avg_soil_moisture), 50);
    assert.equal(Number(aggRow.sample_count), 2);

    // Remaining raw readings should only contain recent reading
    const remainingRaw = await SensorReading.count({ where: { device_id: device.id } });
    assert.equal(remainingRaw, 1);

    // Analytics JSON
    const jsonRes = await app.inject({
      method: 'GET',
      url: `/api/gardens/${garden.id}/analytics?range=30d`,
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(jsonRes.statusCode, 200);
    const analytics = jsonRes.json().data;
    assert.equal(analytics.kpis.total_water_liters, 12.5);
    assert.equal(analytics.kpis.task_completion_rate_pct, 100);
    assert.ok(analytics.daily_telemetry.length >= 1);

    // CSV Export
    const csvRes = await app.inject({
      method: 'GET',
      url: `/api/gardens/${garden.id}/analytics/export.csv?range=30d`,
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(csvRes.statusCode, 200);
    assert.ok(String(csvRes.headers['content-type']).includes('text/csv'));
    assert.ok(csvRes.payload.includes('RecordType,DateOrZone,WaterLiters'));
    assert.ok(csvRes.payload.includes('Heirloom Terrace'));

    // PDF Export
    const pdfRes = await app.inject({
      method: 'GET',
      url: `/api/gardens/${garden.id}/analytics/export.pdf?range=30d`,
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(pdfRes.statusCode, 200);
    assert.equal(pdfRes.headers['content-type'], 'application/pdf');
    const pdfHead = pdfRes.rawPayload.subarray(0, 8).toString('latin1');
    const pdfTail = pdfRes.rawPayload.subarray(-6).toString('latin1');
    assert.ok(pdfHead.startsWith('%PDF-1.4'), `Expected %PDF-1.4 header, got ${pdfHead}`);
    assert.ok(pdfTail.includes('%%EOF'), `Expected %%EOF trailer, got ${pdfTail}`);
  });

  it('F18: AI Leaf Diagnosis accepts multipart leaf photo and returns structured pathology fallback report', async () => {
    const mp = buildMultipartBody(
      { crop_name: 'Roma Tomato', symptoms_notes: 'White powdery patches on upper leaves' },
      { field: 'photo', filename: 'leaf.png', mimeType: 'image/png', buffer: TINY_PNG_BUFFER }
    );
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/diagnose-leaf',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'content-type': mp.contentType
      },
      payload: mp.payload
    });
    assert.equal(res.statusCode, 200);
    const report = res.json().data;
    assert.equal(report.provider, 'deterministic-fallback');
    assert.ok(report.disease_name.includes('Powdery Mildew'));
    assert.ok(report.organic_treatments.length > 0);
    assert.ok(report.photo_url.startsWith('/api/media/'));

    // Missing image fails with 400
    const missingRes = await app.inject({
      method: 'POST',
      url: '/api/ai/diagnose-leaf',
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: { crop_name: 'Tomato' }
    });
    assert.equal(missingRes.statusCode, 400);
    assert.equal(missingRes.json().error.code, 'IMAGE_REQUIRED');
  });

  it('F19: AI Gardening Assistant injects live garden context, guards foreign gardens (403) & enforces rate limits (429)', async () => {
    // Valid contextual query
    const chatRes = await app.inject({
      method: 'POST',
      url: '/api/ai/chat',
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: {
        garden_id: garden.id,
        message: 'Should I water my tomatoes today?'
      }
    });
    assert.equal(chatRes.statusCode, 200);
    const data = chatRes.json().data;
    assert.equal(data.provider, 'deterministic-fallback');
    assert.ok(data.reply.includes('Sprint4 Test Garden'));
    assert.ok(data.reply.includes('Sungold Cherry Tomato'));
    assert.equal(data.context_summary.garden_id, garden.id);

    // Non-member garden context -> 403
    const forbiddenRes = await app.inject({
      method: 'POST',
      url: '/api/ai/chat',
      headers: { Authorization: `Bearer ${peerToken}` },
      payload: { garden_id: garden.id, message: 'Tell me about sensors' }
    });
    assert.equal(forbiddenRes.statusCode, 403);

    // Rate limit enforcement
    const prevMax = process.env.AI_RATE_LIMIT_MAX;
    process.env.AI_RATE_LIMIT_MAX = '2';
    aiService.resetRateLimits();
    try {
      const r1 = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        headers: { Authorization: `Bearer ${peerToken}` },
        payload: { message: 'Question 1' }
      });
      const r2 = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        headers: { Authorization: `Bearer ${peerToken}` },
        payload: { message: 'Question 2' }
      });
      const r3 = await app.inject({
        method: 'POST',
        url: '/api/ai/chat',
        headers: { Authorization: `Bearer ${peerToken}` },
        payload: { message: 'Question 3' }
      });
      assert.equal(r1.statusCode, 200);
      assert.equal(r2.statusCode, 200);
      assert.equal(r3.statusCode, 429);
      assert.equal(r3.json().error.code, 'RATE_LIMIT_EXCEEDED');
    } finally {
      if (prevMax === undefined) delete process.env.AI_RATE_LIMIT_MAX;
      else process.env.AI_RATE_LIMIT_MAX = prevMax;
      aiService.resetRateLimits();
    }
  });

  it('F20: Community posts, likes, threaded comments, follows (no self-follow) & admin moderation', async () => {
    // 1. Peer creates post
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/community/posts',
      headers: { Authorization: `Bearer ${peerToken}` },
      payload: {
        title: 'Mulch Depth Experiment',
        content: 'Testing 6 cm cedar shavings around Sungold tomatoes.',
        category: 'TIP'
      }
    });
    assert.equal(postRes.statusCode, 201);
    const post = postRes.json().data;
    assert.equal(post.category, 'TIP');

    // 2. Owner likes and unlikes
    const like1 = await app.inject({
      method: 'POST',
      url: `/api/community/posts/${post.id}/like`,
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(like1.statusCode, 200);
    assert.equal(like1.json().data.liked, true);
    assert.equal(like1.json().data.likes_count, 1);

    const like2 = await app.inject({
      method: 'POST',
      url: `/api/community/posts/${post.id}/like`,
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(like2.statusCode, 200);
    assert.equal(like2.json().data.liked, false);
    assert.equal(like2.json().data.likes_count, 0);

    // 3. Threaded comments
    const c1Res = await app.inject({
      method: 'POST',
      url: `/api/community/posts/${post.id}/comments`,
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: { content: 'Did soil stay cooler under cedar shavings?' }
    });
    assert.equal(c1Res.statusCode, 201);
    const c1 = c1Res.json().data;

    const c2Res = await app.inject({
      method: 'POST',
      url: `/api/community/posts/${post.id}/comments`,
      headers: { Authorization: `Bearer ${peerToken}` },
      payload: { content: 'Yes, about 3 degrees cooler at noon!', parent_comment_id: c1.id }
    });
    assert.equal(c2Res.statusCode, 201);
    assert.equal(c2Res.json().data.comments_count, 2);

    // 4. Follow peer + reject self-follow
    const selfFollowRes = await app.inject({
      method: 'POST',
      url: `/api/community/users/${ownerUser.id}/follow`,
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(selfFollowRes.statusCode, 400);
    assert.equal(selfFollowRes.json().error.code, 'CANNOT_FOLLOW_SELF');

    const followRes = await app.inject({
      method: 'POST',
      url: `/api/community/users/${peerUser.id}/follow`,
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(followRes.statusCode, 200);
    assert.equal(followRes.json().data.following, true);

    // 5. Filter feed by following_only & search
    const feedRes = await app.inject({
      method: 'GET',
      url: '/api/community/posts?category=TIP&following_only=true&search=Cedar',
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(feedRes.statusCode, 200);
    assert.equal(feedRes.json().data.posts.length, 1);
    assert.equal(feedRes.json().data.posts[0].author_followed_by_me, true);

    // 6. Admin moderation (non-admin denied 403, admin pin/flag & delete comment succeeds)
    const nonAdminPin = await app.inject({
      method: 'PATCH',
      url: `/api/admin/community/posts/${post.id}`,
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: { is_pinned: true }
    });
    assert.equal(nonAdminPin.statusCode, 403);
    assert.equal(nonAdminPin.json().error.code, 'ADMIN_REQUIRED');

    const adminPin = await app.inject({
      method: 'PATCH',
      url: `/api/admin/community/posts/${post.id}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { is_pinned: true, is_flagged: true }
    });
    assert.equal(adminPin.statusCode, 200);
    assert.equal(adminPin.json().data.is_pinned, true);
    assert.equal(adminPin.json().data.is_flagged, true);

    // Deleting parent comment cascades child reply cleanly & resets comments_count to 0
    const adminDelComment = await app.inject({
      method: 'DELETE',
      url: `/api/admin/community/comments/${c1.id}`,
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(adminDelComment.statusCode, 200);

    const commentsAfter = await app.inject({
      method: 'GET',
      url: `/api/community/posts/${post.id}/comments`,
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(commentsAfter.json().data.comments.length, 0);
  });
});
