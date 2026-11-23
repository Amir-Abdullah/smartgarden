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
const { User, PasswordResetToken } = require('../models');

describe('Milestone 3: Feature 1 (F1) - Accounts & Authentication Suite', () => {
  let app;

  before(async () => {
    await connectDb();
    await runMigrations();
    app = buildServer();
  });

  // Helper method tests on User model
  describe('User Model Methods', () => {
    test('User helper validPassword returns true for matching password and false for wrong password', async () => {
      const email = 'modeltest@example.com';
      await User.destroy({ where: { email } });

      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('Secret123!', 10);
      const user = await User.create({
        name: 'Model Tester',
        email,
        password_hash: hash,
        is_admin: false
      });

      assert.strictEqual(await user.validPassword('Secret123!'), true);
      assert.strictEqual(await user.validPassword('WrongPassword'), false);
      assert.strictEqual(await user.validPassword(''), false);
      assert.strictEqual(await user.validPassword(null), false);
    });

    test('User toJSON() helper omits password_hash from JSON serialization', async () => {
      const user = await User.findOne({ where: { email: 'modeltest@example.com' } });
      assert.ok(user, 'User should exist');

      const json = user.toJSON();
      assert.strictEqual(json.email, 'modeltest@example.com');
      assert.strictEqual(json.name, 'Model Tester');
      assert.strictEqual(json.password_hash, undefined, 'password_hash must be omitted');

      const stringified = JSON.stringify(user);
      assert.ok(!stringified.includes('password_hash'), 'Serialized string must not contain password_hash');
    });
  });

  // Registration Endpoints
  describe('POST /api/auth/register', () => {
    test('Registration happy path returns 201 with created user and JWT token', async () => {
      const email = 'gardener_alice@example.com';
      await User.destroy({ where: { email } });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          name: 'Alice Gardener',
          email,
          password: 'SuperSecurePassword123!',
          location_region: 'US-Zone-6b'
        })
      });

      assert.strictEqual(res.statusCode, 201);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data, 'Data payload must be present');
      assert.ok(body.data.token, 'JWT token must be present');
      assert.ok(typeof body.data.token === 'string' && body.data.token.split('.').length === 3, 'Token must be valid JWT');

      const user = body.data.user;
      assert.ok(user.id, 'User ID must be assigned');
      assert.strictEqual(user.name, 'Alice Gardener');
      assert.strictEqual(user.email, email);
      assert.strictEqual(user.location_region, 'US-Zone-6b');
      assert.strictEqual(user.is_admin, false);
      assert.strictEqual(user.password_hash, undefined, 'password_hash must never be returned');
    });

    test('Registration rejects missing name, email, or password with 400 Bad Request', async () => {
      const cases = [
        { name: '', email: 'b@example.com', password: 'pass' },
        { name: 'Bob', email: '', password: 'pass' },
        { name: 'Bob', email: 'b@example.com', password: '' },
        {}
      ];

      for (const payload of cases) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/auth/register',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify(payload)
        });

        assert.strictEqual(res.statusCode, 400);
        const body = res.json();
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.statusCode, 400);
        assert.strictEqual(body.error.code, 'BAD_REQUEST');
      }
    });

    test('Registration rejects duplicate email with RFC 7807 409 Conflict', async () => {
      const email = 'duplicate@example.com';
      // First registration
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          name: 'Original User',
          email,
          password: 'Password123!'
        })
      });

      // Attempt duplicate registration
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          name: 'Imposter User',
          email,
          password: 'AnotherPassword456!'
        })
      });

      assert.strictEqual(res.statusCode, 409);
      const body = res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'EMAIL_ALREADY_EXISTS');
      assert.strictEqual(body.error.statusCode, 409);
      assert.ok(body.error.message.includes(email), 'Error message should mention the duplicate email');
    });
  });

  // Login Endpoints
  describe('POST /api/auth/login', () => {
    const loginUser = {
      name: 'Charlie Botanist',
      email: 'charlie@example.com',
      password: 'CorrectHorseBatteryStaple!'
    };

    before(async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify(loginUser)
      });
    });

    test('Login happy path returns 200 with user profile and JWT token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          email: loginUser.email,
          password: loginUser.password
        })
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data.token);
      assert.strictEqual(body.data.user.email, loginUser.email);
      assert.strictEqual(body.data.user.password_hash, undefined);
    });

    test('Login rejects wrong password with 401 INVALID_CREDENTIALS', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          email: loginUser.email,
          password: 'CompletelyWrongPassword!'
        })
      });

      assert.strictEqual(res.statusCode, 401);
      const body = res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'INVALID_CREDENTIALS');
      assert.strictEqual(body.error.statusCode, 401);
    });

    test('Login rejects non-existent email with 401 INVALID_CREDENTIALS', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          email: 'ghost_user@example.com',
          password: 'AnyPassword123!'
        })
      });

      assert.strictEqual(res.statusCode, 401);
      const body = res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'INVALID_CREDENTIALS');
      assert.strictEqual(body.error.statusCode, 401);
    });

    test('Login rejects missing email or password with 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ email: loginUser.email })
      });

      assert.strictEqual(res.statusCode, 400);
      const body = res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'BAD_REQUEST');
    });
  });

  // Current User (/me) Endpoint
  describe('GET /api/auth/me', () => {
    let validToken;
    const meUser = {
      name: 'Diana Green',
      email: 'diana@example.com',
      password: 'DianaPassword123!',
      location_region: 'US-Zone-5a'
    };

    before(async () => {
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify(meUser)
      });
      validToken = regRes.json().data.token;
    });

    test('GET /me with valid JWT token returns 200 and authenticated user object', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${validToken}`
        }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.user.email, meUser.email);
      assert.strictEqual(body.data.user.name, meUser.name);
      assert.strictEqual(body.data.user.location_region, 'US-Zone-5a');
      assert.strictEqual(body.data.user.password_hash, undefined);
    });

    test('GET /me without authorization header returns 401 UNAUTHORIZED', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me'
      });

      assert.strictEqual(res.statusCode, 401);
      const body = res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'UNAUTHORIZED');
      assert.strictEqual(body.error.statusCode, 401);
      assert.strictEqual(body.error.message, 'Missing or invalid authorization token');
    });

    test('GET /me with invalid / forged token returns 401 UNAUTHORIZED', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: 'Bearer forged.invalid.token'
        }
      });

      assert.strictEqual(res.statusCode, 401);
      const body = res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'UNAUTHORIZED');
      assert.strictEqual(body.error.statusCode, 401);
    });
  });

  // Password Reset Flow
  describe('Password Reset Flow (Forgot & Reset Endpoints)', () => {
    const resetUser = {
      name: 'Edward Planter',
      email: 'edward@example.com',
      password: 'OldPassword123!'
    };

    before(async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify(resetUser)
      });
    });

    test('POST /forgot-password generates single-use token in test mode', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ email: resetUser.email })
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data.message.includes('If an account with that email exists'));

      // In test mode, _debug_token must be provided
      const rawToken = body.data._debug_token || body._debug_token;
      assert.ok(rawToken, '_debug_token must be returned in test mode');
      assert.strictEqual(rawToken.length, 64, '32-byte hex token length must be 64 characters');

      // Verify token hash is stored in database
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const tokenRecord = await PasswordResetToken.findOne({ where: { token_hash: tokenHash } });
      assert.ok(tokenRecord, 'Token hash must be recorded in password_reset_tokens table');
      assert.strictEqual(tokenRecord.used_at, null);
      assert.ok(new Date(tokenRecord.expires_at) > new Date(), 'expires_at must be in the future');
    });

    test('POST /forgot-password with non-existent email returns generic 200 without leaking account existence', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ email: 'nonexistent_account@example.com' })
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data.message.includes('If an account with that email exists'));
      assert.strictEqual(body.data._debug_token, undefined);
    });

    test('Full password reset flow: resets password, invalidates old password, allows new login', async () => {
      // 1. Request reset token
      const forgotRes = await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ email: resetUser.email })
      });
      const token = forgotRes.json().data._debug_token || forgotRes.json()._debug_token;
      assert.ok(token, 'Must receive token');

      // 2. Perform reset
      const newPassword = 'BrandNewSecretPassword999!';
      const resetRes = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          token,
          new_password: newPassword
        })
      });

      assert.strictEqual(resetRes.statusCode, 200);
      assert.strictEqual(resetRes.json().success, true);
      assert.ok(resetRes.json().data.message.includes('reset successfully'));

      // 3. Old password should now fail
      const oldLoginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          email: resetUser.email,
          password: resetUser.password
        })
      });
      assert.strictEqual(oldLoginRes.statusCode, 401);

      // 4. New password should now succeed
      const newLoginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          email: resetUser.email,
          password: newPassword
        })
      });
      assert.strictEqual(newLoginRes.statusCode, 200);
      assert.ok(newLoginRes.json().data.token);

      // 5. Attempting to reuse the same token should fail
      const reuseRes = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          token,
          new_password: 'YetAnotherPassword123!'
        })
      });
      assert.strictEqual(reuseRes.statusCode, 400);
      assert.strictEqual(reuseRes.json().error.code, 'INVALID_OR_EXPIRED_TOKEN');
    });

    test('POST /reset-password rejects expired tokens with 400 INVALID_OR_EXPIRED_TOKEN', async () => {
      const expiredRawToken = '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff';
      const expiredHash = crypto.createHash('sha256').update(expiredRawToken).digest('hex');

      const user = await User.findOne({ where: { email: resetUser.email } });
      await PasswordResetToken.create({
        user_id: user.id,
        token_hash: expiredHash,
        expires_at: new Date(Date.now() - 10000) // 10 seconds in the past
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          token: expiredRawToken,
          new_password: 'ExpiredTokenNewPassword123!'
        })
      });

      assert.strictEqual(res.statusCode, 400);
      const body = res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'INVALID_OR_EXPIRED_TOKEN');
      assert.strictEqual(body.error.statusCode, 400);
    });

    test('POST /reset-password rejects missing token or new_password with 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          token: ''
        })
      });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.json().error.code, 'BAD_REQUEST');
    });
  });

  // OAuth Endpoints
  describe('POST /api/auth/oauth', () => {
    test('POST /oauth rejects missing access_token with 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/oauth',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          provider: 'google'
        })
      });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.json().error.code, 'BAD_REQUEST');
    });

    test('POST /oauth rejects invalid access_token with 401 INVALID_OAUTH_TOKEN', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/oauth',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          provider: 'google',
          access_token: 'invalid_dummy_token_12345'
        })
      });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.json().error.code, 'INVALID_OAUTH_TOKEN');
    });
  });
});
