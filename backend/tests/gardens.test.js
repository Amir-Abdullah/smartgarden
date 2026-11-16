const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const { buildServer } = require('../server');
const { connectDb } = require('../config/database');
const { runMigrations } = require('../scripts/migrate');
const { User, Garden, GardenMember, Zone } = require('../models');

describe('Milestone 5: Feature 3 (F3) - Garden & Zone Management Suite', () => {
  let app;
  let ownerToken, familyToken, guestToken, outsiderToken;
  let ownerUser, familyUser, guestUser, outsiderUser;
  let createdGardenId, createdOutdoorZoneId, createdIndoorZoneId;

  async function createUserAndLogin(name, email) {
    const password = 'Password123!';
    const hash = await bcrypt.hash(password, 10);
    let user = await User.findOne({ where: { email } });
    if (!user) {
      user = await User.create({
        name,
        email,
        password_hash: hash,
        is_admin: false,
        location_region: 'US-East'
      });
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
    app = buildServer();

    const o = await createUserAndLogin('Garden Owner', 'f3_owner@test.com');
    ownerUser = o.user;
    ownerToken = o.token;

    const f = await createUserAndLogin('Family CoGardener', 'f3_family@test.com');
    familyUser = f.user;
    familyToken = f.token;

    const g = await createUserAndLogin('Guest Observer', 'f3_guest@test.com');
    guestUser = g.user;
    guestToken = g.token;

    const out = await createUserAndLogin('Outsider User', 'f3_outsider@test.com');
    outsiderUser = out.user;
    outsiderToken = out.token;
  });

  describe('Garden CRUD & Timezone Persistence', () => {
    test('POST /api/gardens creates a garden with IANA timezone and auto-assigns OWNER membership', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/gardens',
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          name: 'Dhaka Rooftop Sanctuary',
          latitude: 23.8103,
          longitude: 90.4125,
          location_address: 'Banani, Dhaka',
          timezone: 'Asia/Dhaka',
          area_sq_m: 65.5,
          description: 'Subtropical rooftop container and raised bed garden'
        })
      });

      assert.strictEqual(res.statusCode, 201);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.role, 'OWNER');
      assert.strictEqual(body.data.garden.name, 'Dhaka Rooftop Sanctuary');
      assert.strictEqual(body.data.garden.timezone, 'Asia/Dhaka');
      assert.strictEqual(body.data.garden.area_sq_m, 65.5);
      assert.strictEqual(body.data.garden.location_address, 'Banani, Dhaka');

      createdGardenId = body.data.garden.id;
      assert.ok(createdGardenId, 'Created garden must have an ID');

      // Add FAMILY and GUEST members to this garden for subsequent RBAC + CRUD tests
      await GardenMember.create({
        garden_id: createdGardenId,
        user_id: familyUser.id,
        role: 'FAMILY'
      });
      await GardenMember.create({
        garden_id: createdGardenId,
        user_id: guestUser.id,
        role: 'GUEST',
        expires_at: new Date(Date.now() + 7 * 86400000)
      });
    });

    test('POST /api/gardens rejects missing name or invalid IANA timezone with 400', async () => {
      const noNameRes = await app.inject({
        method: 'POST',
        url: '/api/gardens',
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({ timezone: 'UTC' })
      });
      assert.strictEqual(noNameRes.statusCode, 400);
      assert.strictEqual(noNameRes.json().error.code, 'INVALID_GARDEN_NAME');

      const badTzRes = await app.inject({
        method: 'POST',
        url: '/api/gardens',
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          name: 'Invalid Timezone Garden',
          timezone: 'Invalid/Not_A_Real_Timezone'
        })
      });
      assert.strictEqual(badTzRes.statusCode, 400);
      assert.strictEqual(badTzRes.json().error.code, 'INVALID_TIMEZONE');
    });

    test('GET /api/gardens lists gardens where user is an active member with role and counts', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/gardens',
        headers: { authorization: `Bearer ${familyToken}` }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data.gardens));
      const found = body.data.gardens.find(g => g.id === createdGardenId);
      assert.ok(found, 'Family member should see the shared garden');
      assert.strictEqual(found.role, 'FAMILY');
      assert.strictEqual(found.timezone, 'Asia/Dhaka');

      // Outsider should not see the garden
      const outRes = await app.inject({
        method: 'GET',
        url: '/api/gardens',
        headers: { authorization: `Bearer ${outsiderToken}` }
      });
      assert.strictEqual(outRes.statusCode, 200);
      const outFound = outRes.json().data.gardens.find(g => g.id === createdGardenId);
      assert.strictEqual(outFound, undefined);
    });

    test('GET /api/gardens/:id returns garden details, zones, and members for members', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/gardens/${createdGardenId}`,
        headers: { authorization: `Bearer ${guestToken}` }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.garden.id, createdGardenId);
      assert.strictEqual(body.data.garden.role, 'GUEST');
      assert.strictEqual(body.data.garden.timezone, 'Asia/Dhaka');
      assert.strictEqual(body.data.members.length, 3);
    });

    test('PUT /api/gardens/:id allows OWNER to update garden metadata and timezone, rejects FAMILY and GUEST', async () => {
      const ownerRes = await app.inject({
        method: 'PUT',
        url: `/api/gardens/${createdGardenId}`,
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          name: 'Dhaka Botanical Terrace',
          timezone: 'America/New_York',
          area_sq_m: 80.0
        })
      });

      assert.strictEqual(ownerRes.statusCode, 200);
      const updated = ownerRes.json().data.garden;
      assert.strictEqual(updated.name, 'Dhaka Botanical Terrace');
      assert.strictEqual(updated.timezone, 'America/New_York');
      assert.strictEqual(updated.area_sq_m, 80);

      // FAMILY cannot update garden metadata
      const familyRes = await app.inject({
        method: 'PUT',
        url: `/api/gardens/${createdGardenId}`,
        headers: {
          authorization: `Bearer ${familyToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({ name: 'Unauthorized Rename' })
      });
      assert.strictEqual(familyRes.statusCode, 403);
      assert.strictEqual(familyRes.json().error.code, 'INSUFFICIENT_PERMISSIONS');

      // GUEST cannot update garden metadata
      const guestRes = await app.inject({
        method: 'PUT',
        url: `/api/gardens/${createdGardenId}`,
        headers: {
          authorization: `Bearer ${guestToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({ name: 'Guest Rename' })
      });
      assert.strictEqual(guestRes.statusCode, 403);
    });
  });

  describe('Zone CRUD & Indoor/Outdoor Designation', () => {
    test('POST /api/gardens/:gardenId/zones allows OWNER and FAMILY to create outdoor and indoor zones', async () => {
      // OWNER creates outdoor raised bed
      const outdoorRes = await app.inject({
        method: 'POST',
        url: `/api/gardens/${createdGardenId}/zones`,
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          name: 'South Raised Bed',
          is_outdoor: true,
          zone_type: 'RAISED_BED',
          soil_type: 'LOAM',
          sunlight_level: 'FULL_SUN',
          area_sq_m: 6.0,
          dimensions_description: '4m x 1.5m cedar frame'
        })
      });

      assert.strictEqual(outdoorRes.statusCode, 201);
      const outZone = outdoorRes.json().data.zone;
      assert.strictEqual(outZone.name, 'South Raised Bed');
      assert.strictEqual(outZone.is_outdoor, true);
      assert.strictEqual(outZone.zone_type, 'RAISED_BED');
      assert.strictEqual(outZone.soil_type, 'LOAM');
      assert.strictEqual(outZone.sunlight_level, 'FULL_SUN');
      assert.strictEqual(outZone.area_sq_m, 6);
      createdOutdoorZoneId = outZone.id;

      // FAMILY creates indoor greenhouse zone (is_outdoor: false)
      const indoorRes = await app.inject({
        method: 'POST',
        url: `/api/gardens/${createdGardenId}/zones`,
        headers: {
          authorization: `Bearer ${familyToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          name: 'Indoor Seed Nursery',
          is_outdoor: false,
          zone_type: 'GREENHOUSE',
          soil_type: 'PEAT',
          sunlight_level: 'PART_SHADE',
          area_sq_m: 3.5,
          dimensions_description: 'Indoor grow rack'
        })
      });

      assert.strictEqual(indoorRes.statusCode, 201);
      const inZone = indoorRes.json().data.zone;
      assert.strictEqual(inZone.name, 'Indoor Seed Nursery');
      assert.strictEqual(inZone.is_outdoor, false);
      assert.strictEqual(inZone.zone_type, 'GREENHOUSE');
      assert.strictEqual(inZone.soil_type, 'PEAT');
      assert.strictEqual(inZone.sunlight_level, 'PART_SHADE');
      createdIndoorZoneId = inZone.id;
    });

    test('POST /api/gardens/:gardenId/zones blocks GUEST with 403 and rejects invalid enums with 400', async () => {
      const guestRes = await app.inject({
        method: 'POST',
        url: `/api/gardens/${createdGardenId}/zones`,
        headers: {
          authorization: `Bearer ${guestToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({ name: 'Guest Bed' })
      });
      assert.strictEqual(guestRes.statusCode, 403);
      assert.strictEqual(guestRes.json().error.code, 'INSUFFICIENT_PERMISSIONS');

      const badEnumRes = await app.inject({
        method: 'POST',
        url: `/api/gardens/${createdGardenId}/zones`,
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          name: 'Bad Soil Zone',
          soil_type: 'VOLCANIC_ASH'
        })
      });
      assert.strictEqual(badEnumRes.statusCode, 400);
      assert.strictEqual(badEnumRes.json().error.code, 'INVALID_SOIL_TYPE');
    });

    test('GET /api/zones/:id resolves garden RBAC from zone ID and returns zone details', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/zones/${createdIndoorZoneId}`,
        headers: { authorization: `Bearer ${guestToken}` }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.zone.id, createdIndoorZoneId);
      assert.strictEqual(body.data.zone.is_outdoor, false);
      assert.strictEqual(body.data.zone.soil_type, 'PEAT');

      // Outsider is rejected with 403
      const outRes = await app.inject({
        method: 'GET',
        url: `/api/zones/${createdIndoorZoneId}`,
        headers: { authorization: `Bearer ${outsiderToken}` }
      });
      assert.strictEqual(outRes.statusCode, 403);
      assert.strictEqual(outRes.json().error.code, 'NOT_A_GARDEN_MEMBER');
    });

    test('PUT /api/zones/:id allows OWNER and FAMILY to update zone properties, blocks GUEST', async () => {
      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/zones/${createdOutdoorZoneId}`,
        headers: {
          authorization: `Bearer ${familyToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          name: 'South Sun Bed (Polytunnel Covered)',
          is_outdoor: false,
          sunlight_level: 'PART_SHADE',
          area_sq_m: 7.5
        })
      });

      assert.strictEqual(updateRes.statusCode, 200);
      const updated = updateRes.json().data.zone;
      assert.strictEqual(updated.name, 'South Sun Bed (Polytunnel Covered)');
      assert.strictEqual(updated.is_outdoor, false);
      assert.strictEqual(updated.sunlight_level, 'PART_SHADE');
      assert.strictEqual(updated.area_sq_m, 7.5);

      const guestRes = await app.inject({
        method: 'PUT',
        url: `/api/zones/${createdOutdoorZoneId}`,
        headers: {
          authorization: `Bearer ${guestToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({ name: 'Guest Edit' })
      });
      assert.strictEqual(guestRes.statusCode, 403);
    });

    test('DELETE /api/zones/:id allows OWNER only, rejecting FAMILY and GUEST', async () => {
      const familyDel = await app.inject({
        method: 'DELETE',
        url: `/api/zones/${createdIndoorZoneId}`,
        headers: { authorization: `Bearer ${familyToken}` }
      });
      assert.strictEqual(familyDel.statusCode, 403);

      const ownerDel = await app.inject({
        method: 'DELETE',
        url: `/api/zones/${createdIndoorZoneId}`,
        headers: { authorization: `Bearer ${ownerToken}` }
      });
      assert.strictEqual(ownerDel.statusCode, 200);

      const verifyGone = await app.inject({
        method: 'GET',
        url: `/api/zones/${createdIndoorZoneId}`,
        headers: { authorization: `Bearer ${ownerToken}` }
      });
      assert.strictEqual(verifyGone.statusCode, 404);
    });

    test('DELETE /api/gardens/:id cascades deletion of garden, zones, and memberships', async () => {
      // Create a disposable garden and zone
      const gRes = await app.inject({
        method: 'POST',
        url: '/api/gardens',
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({ name: 'Temp Garden', timezone: 'UTC', area_sq_m: 10 })
      });
      const tempGardenId = gRes.json().data.garden.id;

      const zRes = await app.inject({
        method: 'POST',
        url: `/api/gardens/${tempGardenId}/zones`,
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({ name: 'Temp Zone' })
      });
      const tempZoneId = zRes.json().data.zone.id;

      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/gardens/${tempGardenId}`,
        headers: { authorization: `Bearer ${ownerToken}` }
      });
      assert.strictEqual(delRes.statusCode, 200);

      const checkGarden = await Garden.findByPk(tempGardenId);
      const checkZone = await Zone.findByPk(tempZoneId);
      assert.strictEqual(checkGarden, null);
      assert.strictEqual(checkZone, null);
    });
  });
});
