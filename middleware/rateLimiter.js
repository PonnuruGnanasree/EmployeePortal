// Simple in-memory rate limiter (no external dependency needed)
const rateLimitStore = new Map();

function createRateLimiter({ windowMs = 60000, max = 100, message = 'Too many requests. Please try again later.' } = {}) {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    const entry = rateLimitStore.get(key);

    if (now > entry.resetAt) {
      entry.count = 1;
      entry.resetAt = now + windowMs;
      return next();
    }

    entry.count++;

    if (entry.count > max) {
      res.set('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: message });
    }

    next();
  };
}

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

// Pre-configured limiters
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: 'Too many login attempts. Please try again in 15 minutes.'
});

const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: 'Too many requests. Please slow down.'
});

const uploadLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many uploads. Please wait a moment.'
});

const chatLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  message: 'Too many AI requests. Please wait a moment.'
});

module.exports = { createRateLimiter, authLimiter, apiLimiter, uploadLimiter, chatLimiter };
