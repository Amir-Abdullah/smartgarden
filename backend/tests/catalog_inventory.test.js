const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const { buildServer } = require('../server');
const { connectDb } = require('../config/database');
const { runMigrations } = require('../scripts/migrate');
const { runSeed } = require('../scripts/seed');
const { User, Garden, GardenMember, Zone, PlantCatalog } = require('../models');

describe('Milestones 6 & 7: Features 4 & 5 (F4 Catalog & F5 Zone Plant Inventory) Suite', () => {
  let app;
  let ownerToken, familyToken, guestToken, adminToken;
  let ownerUser, familyUser, guestUser, adminUser;
  let testGarden, mainZone, secondaryZone;
  let tomatoCatalog, basilCatalog, fennelCatalog;

  async function createUserAndLogin(name, email, isAdmin = false) {
    const password = 'Password123!';
    const hash = await bcrypt.hash(password, 10);
    let user = await User.findOne({ where: { email } });
    if (!user) {
      user = await User.create({
        name,
        email,
        password_hash: hash,
        is_admin: isAdmin,
        location_region: 'US-West'
      });
    } else {
      user.is_admin = isAdmin;
      await user.save();
    }
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

    const o = await createUserAndLogin('Catalog Owner', 'f4_owner@test.com', false);
    ownerUser = o.user;
    ownerToken = o.token;

    const f = await createUserAndLogin('Catalog Family', 'f4_family@test.com', false);
    familyUser = f.user;
    familyToken = f.token;

    const g = await createUserAndLogin('Catalog Guest', 'f4_guest@test.com', false);
    guestUser = g.user;
    guestToken = g.token;

    const a = await createUserAndLogin('Catalog Admin', 'f4_admin@test.com', true);
    adminUser = a.user;
    adminToken = a.token;

    testGarden = await Garden.create({
      owner_id: ownerUser.id,
      name: 'Precision Market Garden',
      timezone: 'America/Los_Angeles',
      area_sq_m: 50.0
    });

    await GardenMember.create({ garden_id: testGarden.id, user_id: ownerUser.id, role: 'OWNER' });
    await GardenMember.create({ garden_id: testGarden.id, user_id: familyUser.id, role: 'FAMILY' });
    await GardenMember.create({
      garden_id: testGarden.id,
      user_id: guestUser.id,
      role: 'GUEST',
      expires_at: new Date(Date.now() + 7 * 86400000)
    });

    mainZone = await Zone.create({
      garden_id: testGarden.id,
      name: 'Bed A - Solanaceae Guild',
      is_outdoor: true,
      zone_type: 'RAISED_BED',
      soil_type: 'LOAM',
      sunlight_level: 'FULL_SUN',
      area_sq_m: 2.0 // 2.0 m2 bed to test optimal vs overcrowded thresholds
    });

    secondaryZone = await Zone.create({
      garden_id: testGarden.id,
      name: 'Bed B - Isolation Bed',
      is_outdoor: true,
      zone_type: 'OUTDOOR_BED',
      soil_type: 'SANDY',
      sunlight_level: 'FULL_SUN',
      area_sq_m: 4.0
    });

    tomatoCatalog = await PlantCatalog.findOne({ where: { common_name: 'Tomato' } });
    basilCatalog = await PlantCatalog.findOne({ where: { common_name: 'Basil' } });
    fennelCatalog = await PlantCatalog.findOne({ where: { common_name: 'Fennel' } });
  });

  describe('Feature 4 (F4): Plant Catalog Search, Filtering, Pagination & Admin CRUD', () => {
    test('GET /api/catalog returns paginated list of seeded plants with care thresholds and spacing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/catalog?page=1&limit=10',
        headers: { authorization: `Bearer ${ownerToken}` }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.plants.length, 10);
      assert.ok(body.meta.total >= 30, `Expected >= 30 seeded plants, got ${body.meta.total}`);
      assert.strictEqual(body.meta.page, 1);
      assert.strictEqual(body.meta.limit, 10);
      assert.ok(body.meta.totalPages >= 3);

      const sample = body.data.plants[0];
      assert.ok(sample.common_name);
      assert.ok(sample.scientific_name);
      assert.ok(sample.spacing_cm > 0);
      assert.ok(Array.isArray(sample.good_companions));
      assert.ok(Array.isArray(sample.planting_months));
    });

    test('GET /api/catalog supports text query (q), category filter, and sunlight filter', async () => {
      const searchRes = await app.inject({
        method: 'GET',
        url: '/api/catalog?q=Solanum',
        headers: { authorization: `Bearer ${ownerToken}` }
      });
      assert.strictEqual(searchRes.statusCode, 200);
      const searchPlants = searchRes.json().data.plants;
      assert.ok(searchPlants.length >= 1);
      assert.ok(searchPlants.some(p => p.scientific_name.includes('Solanum')));

      const herbRes = await app.inject({
        method: 'GET',
        url: '/api/catalog?category=HERB&sunlight=FULL_SUN',
        headers: { authorization: `Bearer ${ownerToken}` }
      });
      assert.strictEqual(herbRes.statusCode, 200);
      const herbs = herbRes.json().data.plants;
      assert.ok(herbs.length >= 1);
      for (const h of herbs) {
        assert.strictEqual(h.category, 'HERB');
        assert.strictEqual(h.sunlight_req, 'FULL_SUN');
      }
    });

    test('GET /api/catalog/:id returns a single plant or 404 CATALOG_PLANT_NOT_FOUND', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/catalog/${tomatoCatalog.id}`,
        headers: { authorization: `Bearer ${guestToken}` }
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json().data.plant.common_name, 'Tomato');

      const notFoundRes = await app.inject({
        method: 'GET',
        url: '/api/catalog/99999',
        headers: { authorization: `Bearer ${guestToken}` }
      });
      assert.strictEqual(notFoundRes.statusCode, 404);
      assert.strictEqual(notFoundRes.json().error.code, 'CATALOG_PLANT_NOT_FOUND');
    });

    test('Admin CRUD on /api/catalog enforces checkAdmin and creates/updates/deletes species', async () => {
      // Non-admin blocked
      const nonAdminPost = await app.inject({
        method: 'POST',
        url: '/api/catalog',
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          scientific_name: 'Capsicum chinense',
          common_name: 'Habanero Pepper'
        })
      });
      assert.strictEqual(nonAdminPost.statusCode, 403);
      assert.strictEqual(nonAdminPost.json().error.code, 'ADMIN_REQUIRED');

      // Admin creates new catalog species
      const adminPost = await app.inject({
        method: 'POST',
        url: '/api/catalog',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          scientific_name: 'Capsicum chinense',
          common_name: 'Habanero Pepper',
          category: 'VEGETABLE',
          sunlight_req: 'FULL_SUN',
          ideal_moisture_min: 45,
          ideal_moisture_max: 70,
          ideal_temp_min: 20,
          ideal_temp_max: 32,
          spacing_cm: 40,
          row_spacing_cm: 50
        })
      });
      assert.strictEqual(adminPost.statusCode, 201);
      const createdId = adminPost.json().data.plant.id;

      // Admin updates species
      const adminPut = await app.inject({
        method: 'PUT',
        url: `/api/catalog/${createdId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({ common_name: 'Orange Habanero Pepper', spacing_cm: 45 })
      });
      assert.strictEqual(adminPut.statusCode, 200);
      assert.strictEqual(adminPut.json().data.plant.common_name, 'Orange Habanero Pepper');
      assert.strictEqual(adminPut.json().data.plant.spacing_cm, 45);

      // Admin deletes unused species
      const adminDel = await app.inject({
        method: 'DELETE',
        url: `/api/catalog/${createdId}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual(adminDel.statusCode, 200);
    });
  });

  describe('Feature 5 (F5): Zone Plant Inventory, Capacity Warnings & Lifecycle Tracking', () => {
    let plantedTomatoId, plantedBasilId;

    test('POST /api/zones/:zoneId/plants assigns catalog plant to zone and calculates utilization', async () => {
      const futureHarvest = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
      const res = await app.inject({
        method: 'POST',
        url: `/api/zones/${mainZone.id}/plants`,
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          plant_catalog_id: tomatoCatalog.id,
          custom_nickname: 'San Marzano Row 1',
          quantity: 4,
          planted_date: '2026-04-01',
          expected_harvest_date: futureHarvest,
          status: 'SEEDLING',
          notes: 'Started from certified organic seed'
        })
      });

      assert.strictEqual(res.statusCode, 201);
      const body = res.json();
      assert.strictEqual(body.success, true);
      const zp = body.data.zone_plant;
      assert.strictEqual(zp.custom_nickname, 'San Marzano Row 1');
      assert.strictEqual(zp.quantity, 4);
      assert.strictEqual(zp.status, 'SEEDLING');
      assert.strictEqual(zp.common_name, 'Tomato');
      assert.ok(zp.days_until_harvest >= 59 && zp.days_until_harvest <= 61);
      assert.strictEqual(body.meta.warning, null);
      assert.ok(body.meta.utilization_ratio > 0 && body.meta.utilization_ratio <= 1.0);

      plantedTomatoId = zp.id;
    });

    test('POST /api/zones/:zoneId/plants allows FAMILY, blocks GUEST, and emits ZONE_OVERCROWDED warning when capacity > 100%', async () => {
      // Guest cannot add plants
      const guestRes = await app.inject({
        method: 'POST',
        url: `/api/zones/${mainZone.id}/plants`,
        headers: {
          authorization: `Bearer ${guestToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          plant_catalog_id: basilCatalog.id,
          quantity: 2,
          planted_date: '2026-04-10'
        })
      });
      assert.strictEqual(guestRes.statusCode, 403);

      // Family member adds large quantity of Basil causing bed utilization > 100%
      const familyRes = await app.inject({
        method: 'POST',
        url: `/api/zones/${mainZone.id}/plants`,
        headers: {
          authorization: `Bearer ${familyToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          catalog_plant_id: basilCatalog.id,
          custom_nickname: 'Genovese Companion Border',
          quantity: 25,
          planted_date: '2026-04-10',
          status: 'GROWING'
        })
      });

      assert.strictEqual(familyRes.statusCode, 201);
      const body = familyRes.json();
      plantedBasilId = body.data.zone_plant.id;
      assert.strictEqual(body.meta.warning, 'ZONE_OVERCROWDED');
      assert.ok(body.meta.utilization_ratio > 1.0);
    });

    test('GET /api/zones/:zoneId/plants returns inventory list, zone_utilization, and companion_analysis', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/zones/${mainZone.id}/plants`,
        headers: { authorization: `Bearer ${guestToken}` }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.plants.length, 2);
      assert.strictEqual(body.data.zone_utilization.status, 'OVERCROWDED');
      assert.ok(body.data.companion_analysis);
      assert.ok(body.data.companion_analysis.synergies.length >= 1, 'Tomato and Basil synergy should be detected');
    });

    test('PUT /api/zones/:zoneId/plants/:plantId updates status, quantity, and enforces compound scoping', async () => {
      // Reduce basil quantity from 25 to 4 so bed returns to OPTIMAL capacity
      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/zones/${mainZone.id}/plants/${plantedBasilId}`,
        headers: {
          authorization: `Bearer ${familyToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          quantity: 4,
          status: 'HARVEST_READY',
          health_status: 'HEALTHY',
          notes: 'Thinned out border row'
        })
      });

      assert.strictEqual(updateRes.statusCode, 200);
      const body = updateRes.json();
      assert.strictEqual(body.data.zone_plant.quantity, 4);
      assert.strictEqual(body.data.zone_plant.status, 'HARVEST_READY');
      assert.strictEqual(body.meta.warning, null);

      // Cross-zone compound scoping check: trying to update plantedBasilId via secondaryZone.id returns 404
      const crossZoneRes = await app.inject({
        method: 'PUT',
        url: `/api/zones/${secondaryZone.id}/plants/${plantedBasilId}`,
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({ quantity: 1 })
      });
      assert.strictEqual(crossZoneRes.statusCode, 404);
      assert.strictEqual(crossZoneRes.json().error.code, 'PLANT_NOT_FOUND');
    });

    test('Admin cannot delete a catalog species that is referenced in active zone_plants (409 Conflict)', async () => {
      const delActiveRes = await app.inject({
        method: 'DELETE',
        url: `/api/catalog/${tomatoCatalog.id}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual(delActiveRes.statusCode, 409);
      assert.strictEqual(delActiveRes.json().error.code, 'CANNOT_DELETE_ACTIVE_PLANT');
    });

    test('DELETE /api/zones/:zoneId/plants/:plantId removes plant from zone inventory', async () => {
      const guestDel = await app.inject({
        method: 'DELETE',
        url: `/api/zones/${mainZone.id}/plants/${plantedBasilId}`,
        headers: { authorization: `Bearer ${guestToken}` }
      });
      assert.strictEqual(guestDel.statusCode, 403);

      const ownerDel = await app.inject({
        method: 'DELETE',
        url: `/api/zones/${mainZone.id}/plants/${plantedBasilId}`,
        headers: { authorization: `Bearer ${ownerToken}` }
      });
      assert.strictEqual(ownerDel.statusCode, 200);

      const listRes = await app.inject({
        method: 'GET',
        url: `/api/zones/${mainZone.id}/plants`,
        headers: { authorization: `Bearer ${ownerToken}` }
      });
      assert.strictEqual(listRes.json().data.plants.length, 1);
    });
  });
});
