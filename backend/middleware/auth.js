const developerService = require('../services/developerService');

async function verifyJwt(request, reply) {
  try {
    const authHeader = request.headers && (request.headers.authorization || request.headers.Authorization);
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.toLowerCase().startsWith('bearer ')) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization token',
          details: { reason: 'header_missing', headerKeys: Object.keys(request.headers || {}) },
          statusCode: 401
        }
      });
    }

    const token = authHeader.slice(7).trim();
    if (token.startsWith('sg_pat_')) {
      const patAuth = await developerService.authenticatePat(token);
      if (!patAuth) {
        throw new Error('Invalid or revoked personal access token');
      }
      request.user = patAuth.user;
      request.apiKeyScopes = patAuth.scopes;
      request.apiKeyId = patAuth.keyId;
      return;
    }

    if (typeof request.jwtVerify === 'function') {
      await request.jwtVerify();
    } else {
      throw new Error('JWT verification function not available on request');
    }
  } catch (err) {
    return reply.code(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization token',
        details: { reason: 'verify_failed', message: err.message },
        statusCode: 401
      }
    });
  }
}

async function checkAdmin(request, reply) {
  if (!request.user || !request.user.is_admin) {
    return reply.code(403).send({
      success: false,
      error: {
        code: 'ADMIN_REQUIRED',
        message: 'Administrator privileges are required for this action.',
        details: {},
        statusCode: 403
      }
    });
  }
}

module.exports = {
  verifyJwt,
  checkAdmin
};

