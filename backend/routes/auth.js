const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User, PasswordResetToken } = require('../models');
const { verifyJwt } = require('../middleware/auth');

async function authRoutes(fastify, options) {
  // POST /register
  fastify.post('/register', async (request, reply) => {
    const { name, email, password, location_region } = request.body || {};

    if (
      !name || typeof name !== 'string' || !name.trim() ||
      !email || typeof email !== 'string' || !email.trim() ||
      !password || typeof password !== 'string' || !password.trim()
    ) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Name, email, and password are required.',
          details: {},
          statusCode: 400
        }
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      return reply.code(409).send({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: `The email address '${normalizedEmail}' is already registered.`,
          details: {},
          statusCode: 409
        }
      });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password_hash,
      location_region: location_region ? location_region.trim() : null,
      is_admin: false
    });

    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      name: user.name,
      is_admin: user.is_admin
    });

    return reply.code(201).send({
      success: true,
      data: {
        user: user.toJSON(),
        token
      }
    });
  });

  // POST /login
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body || {};

    if (
      !email || typeof email !== 'string' || !email.trim() ||
      !password || typeof password !== 'string' || !password.trim()
    ) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Email and password are required.',
          details: {},
          statusCode: 400
        }
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ where: { email: normalizedEmail } });
    if (!user) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
          details: {},
          statusCode: 401
        }
      });
    }

    const isValid = await user.validPassword(password);
    if (!isValid) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
          details: {},
          statusCode: 401
        }
      });
    }

    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      name: user.name,
      is_admin: user.is_admin
    });

    return reply.code(200).send({
      success: true,
      data: {
        user: user.toJSON(),
        token
      }
    });
  });

  // POST /oauth (Supabase OAuth token verification & exchange)
  fastify.post('/oauth', async (request, reply) => {
    const { provider, access_token } = request.body || {};

    if (!access_token || typeof access_token !== 'string') {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Access token is required for OAuth authentication.',
          details: {},
          statusCode: 400
        }
      });
    }

    try {
      const supabaseUrl = process.env.SUPABASE_URL || 'https://bpfpjnhaawwrgykxduef.supabase.co';
      const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_WiQtvSpqGV48q8iLkltZlw_lFURGytX';

      // Verify token with Supabase Auth
      let supaRes;
      try {
        supaRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: {
            Authorization: `Bearer ${access_token}`,
            apikey: supabaseKey
          }
        });
      } catch (fetchErr) {
        if (process.env.NODE_ENV === 'test') {
          return reply.code(401).send({
            success: false,
            error: {
              code: 'INVALID_OAUTH_TOKEN',
              message: 'Unable to verify OAuth session with provider.',
              details: {},
              statusCode: 401
            }
          });
        }
        throw fetchErr;
      }

      if (!supaRes.ok) {
        return reply.code(401).send({
          success: false,
          error: {
            code: 'INVALID_OAUTH_TOKEN',
            message: 'Unable to verify OAuth session with provider.',
            details: {},
            statusCode: 401
          }
        });
      }

      const supaUser = await supaRes.json();
      const email = (supaUser.email || '').toLowerCase().trim();
      const googleId = supaUser.id;
      const fullName = (supaUser.user_metadata && (supaUser.user_metadata.full_name || supaUser.user_metadata.name)) || email.split('@')[0];

      if (!email) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'EMAIL_REQUIRED',
            message: 'OAuth provider did not return an email address.',
            details: {},
            statusCode: 400
          }
        });
      }

      // Check if user already exists by email or google_id
      let user = await User.findOne({
        where: {
          [Op.or]: [
            { email },
            { google_id: googleId }
          ]
        }
      });

      if (user) {
        if (!user.google_id) {
          user.google_id = googleId;
          await user.save();
        }
      } else {
        const dummyPassword = crypto.randomBytes(32).toString('hex');
        const password_hash = await bcrypt.hash(dummyPassword, 10);
        user = await User.create({
          name: fullName,
          email,
          password_hash,
          google_id: googleId,
          location_region: 'US-East',
          is_admin: false
        });
      }

      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        name: user.name,
        is_admin: user.is_admin
      });

      return reply.code(200).send({
        success: true,
        data: {
          user: user.toJSON(),
          token
        }
      });
    } catch (err) {
      request.log.error(err, '[OAuth Exchange Error]');
      return reply.code(500).send({
        success: false,
        error: {
          code: 'OAUTH_EXCHANGE_FAILED',
          message: 'An error occurred while completing OAuth sign-in.',
          details: { error: err.message },
          statusCode: 500
        }
      });
    }
  });

  // GET /me
  fastify.get('/me', { preHandler: verifyJwt }, async (request, reply) => {
    const userId = request.user && request.user.id;
    if (!userId) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization token',
          details: {},
          statusCode: 401
        }
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User account not found',
          details: {},
          statusCode: 401
        }
      });
    }

    return reply.code(200).send({
      success: true,
      data: {
        user: user.toJSON()
      }
    });
  });

  // PUT /me — persist authenticated user profile updates
  fastify.put('/me', { preHandler: verifyJwt }, async (request, reply) => {
    const userId = request.user && request.user.id;
    const user = userId ? await User.findByPk(userId) : null;
    if (!user) {
      return reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User account not found.', statusCode: 401 }
      });
    }

    const body = request.body && typeof request.body === 'object' ? request.body : {};
    const updates = {};

    if (body.name !== undefined) {
      const cleanName = String(body.name || '').trim();
      if (cleanName.length < 2 || cleanName.length > 100) {
        return reply.code(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Full name must be between 2 and 100 characters.', statusCode: 400 }
        });
      }
      updates.name = cleanName;
    }

    if (body.location_region !== undefined) {
      const cleanRegion = String(body.location_region || '').trim();
      if (cleanRegion.length > 100) {
        return reply.code(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Location region must be 100 characters or fewer.', statusCode: 400 }
        });
      }
      updates.location_region = cleanRegion || null;
    }

    if (Object.keys(updates).length > 0) {
      await user.update(updates);
    }

    return reply.code(200).send({
      success: true,
      data: {
        user: user.toJSON()
      }
    });
  });

  // POST /forgot-password
  fastify.post('/forgot-password', async (request, reply) => {
    const { email } = request.body || {};

    if (!email || typeof email !== 'string' || !email.trim()) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Email is required.',
          details: {},
          statusCode: 400
        }
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ where: { email: normalizedEmail } });
    let rawToken = null;

    if (user) {
      rawToken = crypto.randomBytes(32).toString('hex');
      const token_hash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expires_at = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes TTL

      await PasswordResetToken.create({
        user_id: user.id,
        token_hash,
        expires_at
      });
    }

    const responseBody = {
      success: true,
      data: {
        message: 'If an account with that email exists, reset instructions have been sent.',
        ...(process.env.NODE_ENV === 'test' && rawToken ? { _debug_token: rawToken } : {})
      },
      ...(process.env.NODE_ENV === 'test' && rawToken ? { _debug_token: rawToken } : {})
    };

    return reply.code(200).send(responseBody);
  });

  // POST /reset-password
  fastify.post('/reset-password', async (request, reply) => {
    const { token, new_password } = request.body || {};

    if (
      !token || typeof token !== 'string' || !token.trim() ||
      !new_password || typeof new_password !== 'string' || !new_password.trim()
    ) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Token and new password are required.',
          details: {},
          statusCode: 400
        }
      });
    }

    const token_hash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const resetRecord = await PasswordResetToken.findOne({
      where: {
        token_hash,
        used_at: null,
        expires_at: {
          [Op.gt]: new Date()
        }
      }
    });

    if (!resetRecord) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'INVALID_OR_EXPIRED_TOKEN',
          message: 'Reset token is invalid or has expired.',
          details: {},
          statusCode: 400
        }
      });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await User.update(
      { password_hash: newHash },
      { where: { id: resetRecord.user_id } }
    );

    await resetRecord.update({ used_at: new Date() });

    return reply.code(200).send({
      success: true,
      data: {
        message: 'Password has been reset successfully.'
      }
    });
  });
}

module.exports = authRoutes;
