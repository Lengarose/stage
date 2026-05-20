/**
 * In-memory rate limiter — zero dependencies.
 *
 * Usage:
 *   const { rateLimiter } = require('./middleware/rateLimiter');
 *   app.use('/api/stage/auth', rateLimiter({ windowMs: 15*60*1000, max: 20 }));
 *
 * Each IP gets a sliding-window counter.  Expired entries are lazily purged
 * every `windowMs` to avoid unbounded memory growth.
 */

function rateLimiter({ windowMs = 15 * 60 * 1000, max = 100, message } = {}) {
  const hits = new Map();          // key = ip, value = { count, resetAt }

  const msg = message || { error: 'Too many requests, please try again later.' };

  // Lazy cleanup — runs at most once per window
  let lastPurge = Date.now();
  function purge() {
    const now = Date.now();
    if (now - lastPurge < windowMs) return;
    lastPurge = now;
    for (const [ip, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(ip);
    }
  }

  return (req, res, next) => {
    purge();

    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = hits.get(ip);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }

    entry.count += 1;

    // Always set informational headers
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json(msg);
    }

    next();
  };
}

module.exports = { rateLimiter };
