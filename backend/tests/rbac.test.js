const { test, describe, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

// Ensure test environment uses SQLite in-memory dialect
process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const { buildServer } = require('../server');
const { connectDb } = require('../config/database');
const { runMigrations } = require('../scripts/migrate');
const { User, Garden, GardenMember, GardenInvitation, Zone, ZonePlant, PlantCatalog } = require('../models');
const { verifyJwt } = require('../middleware/auth');
const { resolveGardenAndRole, resolveGardenId } = require('../middleware/rbac');

describe('Milestone 4: Feature 2 (F2) - RBAC & Invitations Suite', () => {
  let app;
  let ownerUser, familyUser, guestUser, expiredGuestUser, outsiderUser, adminUser;
  let ownerToken, familyToken, guestToken, expiredGuestToken, outsiderToken, adminToken;
  let testGarden, secondaryGarden, testZone;

  // Helper to register user and obtain token
  async function createUserAndToken(name, email, isAdmin = false) {
    const password = 'Password123!';
    const bcrypt = require('bcryptjs');
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
      user.password_hash = hash;
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
    app = buildServer();

    // Register a test route to verify zone resolution and IDOR prevention
    app.get('/api/test/zones/:zoneId', {
      preHandler: [verifyJwt, resolveGardenAndRole(['OWNER', 'FAMILY'])]
    }, async (request, reply) => {
      return reply.send({
        success: true,
        resolvedGardenId: request.resolvedGardenId,
        role: request.gardenRole
      });
    });

    // Create test users
    const ownerData = await createUserAndToken('Alice Owner', 'alice_owner@test.com', false);
    ownerUser = ownerData.user;
    ownerToken = ownerData.token;

    const familyData = await createUserAndToken('Bob Family', 'bob_family@test.com', false);
    familyUser = familyData.user;
    familyToken = familyData.token;

    const guestData = await createUserAndToken('Charlie Guest', 'charlie_guest@test.com', false);
    guestUser = guestData.user;
    guestToken = guestData.token;

    const expiredGuestData = await createUserAndToken('Diana Expired', 'diana_expired@test.com', false);
    expiredGuestUser = expiredGuestData.user;
    expiredGuestToken = expiredGuestData.token;

    const outsiderData = await createUserAndToken('Evan Outsider', 'evan_outsider@test.com', false);
    outsiderUser = outsiderData.user;
    outsiderToken = outsiderData.token;

    const adminData = await createUserAndToken('Super Admin', 'super_admin@test.com', true);
    adminUser = adminData.user;
    adminToken = adminData.token;

    // Create Primary Garden
    testGarden = await Garden.create({
      owner_id: ownerUser.id,
      name: 'Eden Sanctuary',
      timezone: 'America/New_York',
      area_sq_m: 120.5
    });

    // Assign memberships for Primary Garden
    await GardenMember.create({
      garden_id: testGarden.id,
      user_id: ownerUser.id,
      role: 'OWNER'
    });

    await GardenMember.create({
      garden_id: testGarden.id,
      user_id: familyUser.id,
      role: 'FAMILY'
    });

    await GardenMember.create({
      garden_id: testGarden.id,
      user_id: guestUser.id,
      role: 'GUEST',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days future
    });

    await GardenMember.create({
      garden_id: testGarden.id,
      user_id: expiredGuestUser.id,
      role: 'GUEST',
      expires_at: new Date(Date.now() - 3600 * 1000) // 1 hour past
    });

    // Create Zone in Primary Garden
    testZone = await Zone.create({
      garden_id: testGarden.id,
      name: 'North Terrace',
      is_outdoor: true,
      soil_type: 'LOAM',
      sunlight_level: 'FULL_SUN',
      area_sq_m: 35.0
    });

    // Create Secondary Garden (owned by outsiderUser)
    secondaryGarden = await Garden.create({
      owner_id: outsiderUser.id,
      name: 'Outsider Patch',
      timezone: 'UTC',
      area_sq_m: 50.0
    });
    await GardenMember.create({
      garden_id: secondaryGarden.id,
      user_id: outsiderUser.id,
      role: 'OWNER'
    });
  });

  // ==========================================
  // Suite 1: Garden Member Listing & Access
  // ==========================================
  describe('Suite 1: Member Listing & Access Control', () => {
    test('GET /api/gardens/:id/members allows OWNER to list all members with user metadata', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/gardens/${testGarden.id}/members`,
        headers: { authorization: `Bearer ${ownerToken}` }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data.members));
      assert.ok(body.data.members.length >= 4);

      const ownerMember = body.data.members.find(m => m.user_id === ownerUser.id);
      assert.ok(ownerMember);
      assert.strictEqual(ownerMember.role, 'OWNER');
      assert.strictEqual(ownerMember.user.email, ownerUser.email);
      assert.strictEqual(ownerMember.user.password_hash, undefined);
    });

    test('GET /api/gardens/:id/members allows FAMILY and unexpired GUEST to list members', async () => {
      const resFamily = await app.inject({
        method: 'GET',
        url: `/api/gardens/${testGarden.id}/members`,
        headers: { authorization: `Bearer ${familyToken}` }
      });
      assert.strictEqual(resFamily.statusCode, 200);

      const resGuest = await app.inject({
        method: 'GET',
        url: `/api/gardens/${testGarden.id}/members`,
        headers: { authorization: `Bearer ${guestToken}` }
      });
      assert.strictEqual(resGuest.statusCode, 200);
    });

    test('GET /api/gardens/:id/members rejects non-member with 403 NOT_A_GARDEN_MEMBER', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/gardens/${testGarden.id}/members`,
        headers: { authorization: `Bearer ${outsiderToken}` }
      });

      assert.strictEqual(res.statusCode, 403);
      const body = res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'NOT_A_GARDEN_MEMBER');
      assert.strictEqual(body.error.statusCode, 403);
    });

    test('GET /api/gardens/:id/members rejects unauthenticated request with 401 UNAUTHORIZED', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/gardens/${testGarden.id}/members`
      });

      assert.strictEqual(res.statusCode, 401);
      const body = res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'UNAUTHORIZED');
    });

    test('GET /api/gardens/:id/members returns 404 GARDEN_NOT_FOUND if garden does not exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/gardens/999999/members',
        headers: { authorization: `Bearer ${ownerToken}` }
      });

      assert.strictEqual(res.statusCode, 404);
      const body = res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'GARDEN_NOT_FOUND');
    });
  });

  // ==========================================
  // Suite 2: Role Updating & Demotion Guards
  // ==========================================
  describe('Suite 2: Member Role Updates & Sole Owner Safety Guards', () => {
    test('OWNER can change member role between FAMILY and GUEST', async () => {
      // Change Bob (Family) to GUEST
      const res = await app.inject({
        method: 'PUT',
        url: `/api/gardens/${testGarden.id}/members/${familyUser.id}`,
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({ role: 'GUEST' })
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.member.role, 'GUEST');

      // Revert Bob back to FAMILY
      const resRevert = await app.inject({
        method: 'PUT',
        url: `/api/gardens/${testGarden.id}/members/${familyUser.id}`,
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({ role: 'FAMILY' })
      });
      assert.strictEqual(resRevert.statusCode, 200);
      assert.strictEqual(resRevert.json().data.member.role, 'FAMILY');
    });

    test('Non-owner cannot update member roles (403 INSUFFICIENT_PERMISSIONS)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/gardens/${testGarden.id}/members/${guestUser.id}`,
        headers: {
          authorization: `Bearer ${familyToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({ role: 'FAMILY' })
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.json().error.code, 'INSUFFICIENT_PERMISSIONS');
    });

    test('Updating non-existent member returns 404 MEMBER_NOT_FOUND', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/gardens/${testGarden.id}/members/888888`,
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({ role: 'FAMILY' })
      });

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.json().error.code, 'MEMBER_NOT_FOUND');
    });

    test('Invalid role input returns 400 INVALID_ROLE', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/gardens/${testGarden.id}/members/${familyUser.id}`,
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({ role: 'SUPERUSER' })
      });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.json().error.code, 'INVALID_ROLE');
    });

    test('Sole owner cannot demote self (400 CANNOT_DEMOTE_SOLE_OWNER)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/gardens/${testGarden.id}/members/${ownerUser.id}`,
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({ role: 'FAMILY' })
      });

      assert.strictEqual(res.statusCode, 400);
      const body = res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'CANNOT_DEMOTE_SOLE_OWNER');
    });

    test('Multi-owner demotion succeeds when another owner exists', async () => {
      // Temporarily promote Bob to OWNER
      await GardenMember.update(
        { role: 'OWNER' },
        { where: { garden_id: testGarden.id, user_id: familyUser.id } }
      );

      // Alice can now demote herself because Bob is also OWNER
      const res = await app.inject({
        method: 'PUT',
        url: `/api/gardens/${testGarden.id}/members/${ownerUser.id}`,
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({ role: 'FAMILY' })
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json().data.member.role, 'FAMILY');

      // Restore Alice back to OWNER and Bob back to FAMILY
      await GardenMember.update(
        { role: 'OWNER' },
        { where: { garden_id: testGarden.id, user_id: ownerUser.id } }
      );
      await GardenMember.update(
        { role: 'FAMILY' },
        { where: { garden_id: testGarden.id, user_id: familyUser.id } }
      );
    });
  });

  // ==========================================
  // Suite 3: Member Removal & Self-Leave Guards
  // ==========================================
  describe('Suite 3: Member Removal & Self-Leave Restrictions', () => {
    test('Sole owner cannot leave garden (400 CANNOT_REMOVE_SOLE_OWNER)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/gardens/${testGarden.id}/members/${ownerUser.id}`,
        headers: { authorization: `Bearer ${ownerToken}` }
      });

      assert.strictEqual(res.statusCode, 400);
      const body = res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'CANNOT_REMOVE_SOLE_OWNER');
    });

    test('Non-owner cannot remove another member (403 CANNOT_REMOVE_MEMBER)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/gardens/${testGarden.id}/members/${guestUser.id}`,
        headers: { authorization: `Bearer ${familyToken}` }
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.json().error.code, 'CANNOT_REMOVE_MEMBER');
    });

    test('Non-owner can remove self (voluntarily leave garden)', async () => {
      // Create temporary member to leave
      const tempUser = await User.create({
        name: 'Temp Leaver',
        email: 'temp_leaver@test.com',
        password_hash: 'hash'
      });
      await GardenMember.create({
        garden_id: testGarden.id,
        user_id: tempUser.id,
        role: 'GUEST'
      });

      // Log in as tempUser
      const { token: tempToken } = await createUserAndToken('Temp Leaver', 'temp_leaver@test.com', false);

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/gardens/${testGarden.id}/members/${tempUser.id}`,
        headers: { authorization: `Bearer ${tempToken}` }
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json().success, true);

      // Verify no longer member
      const member = await GardenMember.findOne({
        where: { garden_id: testGarden.id, user_id: tempUser.id }
      });
      assert.strictEqual(member, null);
    });

    test('OWNER can remove non-owner members', async () => {
      const tempUser = await User.create({
        name: 'Ejected User',
        email: 'ejected_user@test.com',
        password_hash: 'hash'
      });
      await GardenMember.create({
        garden_id: testGarden.id,
        user_id: tempUser.id,
        role: 'GUEST'
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/gardens/${testGarden.id}/members/${tempUser.id}`,
        headers: { authorization: `Bearer ${ownerToken}` }
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json().success, true);
    });
  });

  // ==========================================
  // Suite 4: Guest Expiration Enforcement
  // ==========================================
  describe('Suite 4: Guest Expiration Enforcement', () => {
    test('Expired guest is denied access with 403 GUEST_ACCESS_EXPIRED', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/gardens/${testGarden.id}/members`,
        headers: { authorization: `Bearer ${expiredGuestToken}` }
      });

      assert.strictEqual(res.statusCode, 403);
      const body = res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'GUEST_ACCESS_EXPIRED');
    });

    test('Active guest with future expiration is permitted access', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/gardens/${testGarden.id}/members`,
        headers: { authorization: `Bearer ${guestToken}` }
      });

      assert.strictEqual(res.statusCode, 200);
    });

    test('Guest with NULL expiration is permitted access indefinitely', async () => {
      const permGuest = await User.create({
        name: 'Perm Guest',
        email: 'perm_guest@test.com',
        password_hash: 'hash'
      });
      await GardenMember.create({
        garden_id: testGarden.id,
        user_id: permGuest.id,
        role: 'GUEST',
        expires_at: null
      });

      const { token: permToken } = await createUserAndToken('Perm Guest', 'perm_guest@test.com', false);

      const res = await app.inject({
        method: 'GET',
        url: `/api/gardens/${testGarden.id}/members`,
        headers: { authorization: `Bearer ${permToken}` }
      });

      assert.strictEqual(res.statusCode, 200);
    });
  });

  // ==========================================
  // Suite 5: Platform Admin Bypass
  // ==========================================
  describe('Suite 5: Platform Admin Superuser Bypass', () => {
    test('Platform admin accesses garden without entry in garden_members', async () => {
      // Verify adminUser is not in testGarden members
      const member = await GardenMember.findOne({
        where: { garden_id: testGarden.id, user_id: adminUser.id }
      });
      assert.strictEqual(member, null);

      const res = await app.inject({
        method: 'GET',
        url: `/api/gardens/${testGarden.id}/members`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json().success, true);
    });

    test('Platform admin can remove members bypassing membership check', async () => {
      const tempUser = await User.create({
        name: 'Admin Ejected',
        email: 'admin_ejected@test.com',
        password_hash: 'hash'
      });
      await GardenMember.create({
        garden_id: testGarden.id,
        user_id: tempUser.id,
        role: 'GUEST'
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/gardens/${testGarden.id}/members/${tempUser.id}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      assert.strictEqual(res.statusCode, 200);
    });
  });

  // ==========================================
  // Suite 6: Resource Resolver & IDOR Prevention
  // ==========================================
  describe('Suite 6: Resource Resolver & IDOR Prevention', () => {
    test('Resolving garden from :zoneId correctly authorizes member', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/test/zones/${testZone.id}`,
        headers: { authorization: `Bearer ${ownerToken}` }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.resolvedGardenId, testGarden.id);
      assert.strictEqual(body.role, 'OWNER');
    });

    test('Accessing non-existent zone returns 404 ZONE_NOT_FOUND', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/test/zones/999999',
        headers: { authorization: `Bearer ${ownerToken}` }
      });

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.json().error.code, 'ZONE_NOT_FOUND');
    });

    test('Cross-garden IDOR: User authorized in Garden A cannot access Zone in Garden B', async () => {
      // Create Zone in secondaryGarden (owned by outsiderUser)
      const foreignZone = await Zone.create({
        garden_id: secondaryGarden.id,
        name: 'Foreign Zone',
        is_outdoor: false,
        soil_type: 'CLAY',
        sunlight_level: 'PARTIAL_SHADE',
        area_sq_m: 15.0
      });

      // Alice (Owner of primaryGarden) attempts to access Foreign Zone
      const res = await app.inject({
        method: 'GET',
        url: `/api/test/zones/${foreignZone.id}`,
        headers: { authorization: `Bearer ${ownerToken}` }
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.json().error.code, 'NOT_A_GARDEN_MEMBER');
    });
  });

  // ==========================================
  // Suite 7: Invitation Issuance & Management
  // ==========================================
  describe('Suite 7: Invitation Issuance & Management', () => {
    test('OWNER can create an invitation with secure 64-char token and invite_url', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/gardens/${testGarden.id}/invitations`,
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          email: 'new_collaborator@example.com',
          role: 'FAMILY',
          expiresInDays: 14
        })
      });

      assert.strictEqual(res.statusCode, 201);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.email, 'new_collaborator@example.com');
      assert.strictEqual(body.data.role, 'FAMILY');
      assert.strictEqual(body.data.token.length, 64, 'Raw token must be 64-character hex');
      assert.strictEqual(body.data.status, 'PENDING');
      assert.ok(body.data.invite_url.includes(body.data.token));

      // Verify token is hashed in DB
      const hashed = crypto.createHash('sha256').update(body.data.token).digest('hex');
      const dbInvite = await GardenInvitation.findOne({ where: { token: hashed } });
      assert.ok(dbInvite, 'Invitation must be saved with SHA-256 hash in DB');
    });

    test('Non-owner cannot create invitation (403 INSUFFICIENT_PERMISSIONS)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/gardens/${testGarden.id}/invitations`,
        headers: {
          authorization: `Bearer ${familyToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          email: 'another@example.com',
          role: 'GUEST'
        })
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.json().error.code, 'INSUFFICIENT_PERMISSIONS');
    });

    test('Inviting with invalid role returns 400 INVALID_INVITATION_ROLE', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/gardens/${testGarden.id}/invitations`,
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          email: 'bad_role@example.com',
          role: 'OWNER' // OWNER cannot be invited directly
        })
      });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.json().error.code, 'INVALID_INVITATION_ROLE');
    });

    test('Inviting an existing garden member returns 409 USER_ALREADY_MEMBER', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/gardens/${testGarden.id}/invitations`,
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          email: familyUser.email,
          role: 'GUEST'
        })
      });

      assert.strictEqual(res.statusCode, 409);
      assert.strictEqual(res.json().error.code, 'USER_ALREADY_MEMBER');
    });

    test('Duplicate active pending invite returns 409 INVITATION_ALREADY_EXISTS', async () => {
      const email = 'duplicate_invite@example.com';
      await app.inject({
        method: 'POST',
        url: `/api/gardens/${testGarden.id}/invitations`,
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({ email, role: 'GUEST' })
      });

      const resDupe = await app.inject({
        method: 'POST',
        url: `/api/gardens/${testGarden.id}/invitations`,
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({ email, role: 'GUEST' })
      });

      assert.strictEqual(resDupe.statusCode, 409);
      assert.strictEqual(resDupe.json().error.code, 'INVITATION_ALREADY_EXISTS');
    });

    test('OWNER can list and cancel pending invitations', async () => {
      // List invitations
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/gardens/${testGarden.id}/invitations`,
        headers: { authorization: `Bearer ${ownerToken}` }
      });
      assert.strictEqual(listRes.statusCode, 200);
      assert.ok(Array.isArray(listRes.json().data.invitations));

      const firstInvite = listRes.json().data.invitations[0];
      assert.ok(firstInvite);

      // Cancel invitation
      const cancelRes = await app.inject({
        method: 'DELETE',
        url: `/api/gardens/${testGarden.id}/invitations/${firstInvite.id}`,
        headers: { authorization: `Bearer ${ownerToken}` }
      });
      assert.strictEqual(cancelRes.statusCode, 200);

      // Verify status is CANCELED in DB
      const updated = await GardenInvitation.findByPk(firstInvite.id);
      assert.strictEqual(updated.status, 'CANCELED');
    });
  });

  // ==========================================
  // Suite 8: Global Invitation Acceptance Workflow
  // ==========================================
  describe('Suite 8: Invitation Acceptance, Rejection & Expiration Lifecycle', () => {
    test('Invited user accepts valid token, becomes garden member, and invite is marked ACCEPTED', async () => {
      // 1. Create invite
      const inviteRes = await app.inject({
        method: 'POST',
        url: `/api/gardens/${testGarden.id}/invitations`,
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          email: 'recipient@example.com',
          role: 'FAMILY'
        })
      });
      const rawToken = inviteRes.json().data.token;

      // 2. Register/login recipient user
      const { user: recipientUser, token: recipientToken } = await createUserAndToken(
        'Recipient User',
        'recipient@example.com',
        false
      );

      // 3. Recipient accepts invitation
      const acceptRes = await app.inject({
        method: 'POST',
        url: `/api/invitations/${rawToken}/accept`,
        headers: { authorization: `Bearer ${recipientToken}` }
      });

      assert.strictEqual(acceptRes.statusCode, 200);
      const body = acceptRes.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.gardenId, testGarden.id);
      assert.strictEqual(body.data.role, 'FAMILY');

      // 4. Verify membership in DB
      const member = await GardenMember.findOne({
        where: { garden_id: testGarden.id, user_id: recipientUser.id }
      });
      assert.ok(member, 'GardenMember must be created');
      assert.strictEqual(member.role, 'FAMILY');

      // 5. Replay attack: accepting again returns 400 INVITATION_ALREADY_USED
      const replayRes = await app.inject({
        method: 'POST',
        url: `/api/invitations/${rawToken}/accept`,
        headers: { authorization: `Bearer ${recipientToken}` }
      });
      assert.strictEqual(replayRes.statusCode, 400);
      assert.strictEqual(replayRes.json().error.code, 'INVITATION_ALREADY_USED');
    });

    test('Invited user rejects invitation, status becomes REJECTED, subsequent accept fails', async () => {
      // 1. Create invite
      const inviteRes = await app.inject({
        method: 'POST',
        url: `/api/gardens/${testGarden.id}/invitations`,
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          email: 'decliner@example.com',
          role: 'GUEST'
        })
      });
      const rawToken = inviteRes.json().data.token;

      const { token: declinerToken } = await createUserAndToken(
        'Decliner User',
        'decliner@example.com',
        false
      );

      // 2. Reject invitation
      const rejectRes = await app.inject({
        method: 'POST',
        url: `/api/invitations/${rawToken}/reject`,
        headers: { authorization: `Bearer ${declinerToken}` }
      });

      assert.strictEqual(rejectRes.statusCode, 200);
      assert.strictEqual(rejectRes.json().success, true);

      // 3. Attempting to accept rejected invitation fails
      const acceptRes = await app.inject({
        method: 'POST',
        url: `/api/invitations/${rawToken}/accept`,
        headers: { authorization: `Bearer ${declinerToken}` }
      });

      assert.strictEqual(acceptRes.statusCode, 400);
      assert.strictEqual(acceptRes.json().error.code, 'INVITATION_ALREADY_USED');
    });

    test('Accepting expired invitation returns 400 INVITATION_EXPIRED and sets status EXPIRED', async () => {
      const expiredRawToken = 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899';
      const tokenHash = crypto.createHash('sha256').update(expiredRawToken).digest('hex');

      await GardenInvitation.create({
        garden_id: testGarden.id,
        invited_by: ownerUser.id,
        invitee_email: 'late_user@example.com',
        role: 'GUEST',
        token: tokenHash,
        status: 'PENDING',
        expires_at: new Date(Date.now() - 5000) // 5 seconds ago
      });

      const { token: lateToken } = await createUserAndToken(
        'Late User',
        'late_user@example.com',
        false
      );

      const res = await app.inject({
        method: 'POST',
        url: `/api/invitations/${expiredRawToken}/accept`,
        headers: { authorization: `Bearer ${lateToken}` }
      });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.json().error.code, 'INVITATION_EXPIRED');

      const inv = await GardenInvitation.findOne({ where: { token: tokenHash } });
      assert.strictEqual(inv.status, 'EXPIRED');
    });

    test('Accepting non-existent invitation token returns 404 INVITATION_NOT_FOUND', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/invitations/non_existent_token_00000000000000000000000000000000/accept',
        headers: { authorization: `Bearer ${guestToken}` }
      });

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.json().error.code, 'INVITATION_NOT_FOUND');
    });
  });
});
