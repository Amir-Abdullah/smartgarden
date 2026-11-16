async function verifyJwt(request, reply) {
  try {
    const authHeader = request.headers && (request.headers.authorization || request.headers.Authorization);
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.toLowerCase().startsWith('bearer ')) {
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
        details: {},
        statusCode: 401
      }
    });
  }
}

module.exports = {
  verifyJwt
};

