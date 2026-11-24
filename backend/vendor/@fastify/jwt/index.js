const crypto = require('node:crypto');

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

function signJwt(payload, secret, options = {}) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    iat: now,
    ...payload
  };

  const expiresIn = options.expiresIn || '7d';
  if (typeof expiresIn === 'string') {
    if (expiresIn.endsWith('d')) {
      fullPayload.exp = now + parseInt(expiresIn) * 86400;
    } else if (expiresIn.endsWith('h')) {
      fullPayload.exp = now + parseInt(expiresIn) * 3600;
    } else if (expiresIn.endsWith('m')) {
      fullPayload.exp = now + parseInt(expiresIn) * 60;
    } else if (expiresIn.endsWith('s')) {
      fullPayload.exp = now + parseInt(expiresIn);
    }
  } else if (typeof expiresIn === 'number') {
    fullPayload.exp = now + expiresIn;
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJwt(token, secret) {
  if (!token || typeof token !== 'string') {
    const err = new Error('No authorization token was found');
    err.statusCode = 401;
    throw err;
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    const err = new Error('Invalid authorization token format');
    err.statusCode = 401;
    throw err;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSignature) {
    const err = new Error('Invalid token signature');
    err.statusCode = 401;
    throw err;
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch (e) {
    const err = new Error('Malformed token payload');
    err.statusCode = 401;
    throw err;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    const err = new Error('Authorization token has expired');
    err.statusCode = 401;
    throw err;
  }

  return payload;
}

function decodeJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    return null;
  }
}

async function fastifyJwt(fastify, options = {}) {
  const secret = options.secret || 'default_jwt_secret_key_antigravity';

  const jwtService = {
    sign: (payload, signOpts) => signJwt(payload, secret, signOpts),
    verify: (token, verifyOpts) => verifyJwt(token, secret),
    decode: (token) => decodeJwt(token)
  };

  fastify.decorate('jwt', jwtService);

  fastify.decorateRequest('jwtVerify', async function() {
    const authHeader = this.headers['authorization'];
    if (!authHeader) {
      const err = new Error('No Authorization was found in request.headers');
      err.statusCode = 401;
      throw err;
    }
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const user = verifyJwt(token, secret);
    this.user = user;
    return user;
  });
}

module.exports = fastifyJwt;
module.exports.default = fastifyJwt;
