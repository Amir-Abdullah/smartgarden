const ipBuckets = new Map();

function resetIpRateLimits() {
  ipBuckets.clear();
}

function createRateLimitHook({ windowMs = 60000, max = 300 } = {}) {
  return async function rateLimitHook(request, reply) {
    if (process.env.NODE_ENV === 'test' && process.env.ENFORCE_RATE_LIMIT_IN_TEST !== 'true') {
      return;
    }

    const effectiveMax = Number(process.env.RATE_LIMIT_MAX || max);
    if (!Number.isFinite(effectiveMax) || effectiveMax <= 0) return;

    const now = Date.now();
    const key = request.ip || '127.0.0.1';
    const hits = (ipBuckets.get(key) || []).filter((ts) => now - ts < windowMs);

    if (hits.length >= effectiveMax) {
      const retryAfterSec = Math.max(1, Math.ceil(windowMs / 1000));
      reply.header('Retry-After', String(retryAfterSec));
      return reply.code(429).send({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please slow down and try again shortly.',
          statusCode: 429
        }
      });
    }

    hits.push(now);
    ipBuckets.set(key, hits);
  };
}

module.exports = {
  createRateLimitHook,
  resetIpRateLimits
};
